import type { BuildingCategory, Cell, Rect } from '../core';
import { COLUMN_ORDER } from '../game/tools';
import type { GameOut } from '../game/events';
import { Gestures, TOUCH_LIFT, type GestureView, type PointerIn } from '../game/gestures';
import { keyCommand, runKey } from '../game/keys';
import type { Session, SessionView } from '../game/session';
import type { ToastOptions, Tone } from '../game/toastQueue';
import { NOVA_CSS } from '../game/palette';
import { settings } from '../game/settings';
import { Scene3D, type Scene3DOptions } from '../render3d/scene3d';
import type { Level, ViewOverride } from '../render3d/stage';
import { Hud, type HudHost } from '../ui/hud';
import { CURSORS } from '../ui/icons';

/** Time between frames while the game is paused and nothing moves (10 a second). */
const IDLE_FRAME_MS = 100;
/** How near (px) a tap must be to a walking resident's head to open their sheet. */
const PERSON_REACH_TOUCH = 26;
const PERSON_REACH_MOUSE = 16;

export interface Play3DOptions extends Scene3DOptions {
  /** A new game after a defeat: the same map or a new one. */
  restart(sameMap: boolean): void;
  /** Opens behind the title screen: the weeks wait, the interface hides, the camera circles slowly until `begin`. */
  behind?: boolean;
}

/** The camera's slow turn behind the title screen (radians a second: a full circle in ~3 minutes). */
const TITLE_ORBIT = 0.035;

/**
 * The playable city in 3D: the Session drawn by `Scene3D` under the HTML interface. This owns the
 * page: its root element, the interface, pointer and keys (through Gestures and the key commands).
 * The game keeps running (the day too).
 */
export class Play3D implements SessionView, GestureView, HudHost {
  readonly root: HTMLDivElement;
  readonly hud: Hud;
  readonly gestures: Gestures;
  private start = performance.now();
  private last = performance.now();
  private off: (() => void)[] = [];
  private marksDirty = true;
  private closed = false;
  /** The last input was a finger (a touch screen until the first input says otherwise). */
  private lastTouch = navigator.maxTouchPoints > 0;
  /** Something happened since the last frame drawn (input, the game): draw the next one. */
  private wake = true;
  /** Behind the title screen (see `Play3DOptions.behind`). */
  private behind: boolean;
  /** The opening view's heading, put back when the game begins. */
  private readonly openingYaw: number;

  private constructor(
    readonly session: Session,
    readonly scene: Scene3D,
    private opts: Play3DOptions,
  ) {
    const root = (this.root = document.createElement('div'));
    root.className = opts.behind ? 'g3d behind' : 'g3d';
    this.behind = !!opts.behind;
    this.openingYaw = scene.rig.heading;
    root.style.cssText = `position:fixed;inset:0;z-index:5;background:${NOVA_CSS.bg};overflow:hidden;touch-action:none;`;
    const el = scene.el;
    el.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;';
    root.append(el);
    document.body.append(root);
    this.hud = new Hud(root, this);
    this.gestures = new Gestures(session, this);
    this.listen();
    this.resize();
    session.attach(this);
    session.refresh();
    scene.stage.renderer.setAnimationLoop(() => this.loop());
    if (import.meta.env.DEV) this.hooks();
  }

  /** Opens the 3D game on a session; throws when the device cannot draw WebGL 2. */
  static async open(session: Session, opts: Play3DOptions): Promise<Play3D> {
    const scene = Scene3D.create(session.state, session.seed, opts);
    try {
      return new Play3D(session, scene, opts);
    } catch (e) {
      scene.dispose();
      throw e;
    }
  }

  // ---------------------------------------------------------------- input

  private listen() {
    const el = this.scene.el;
    const on = <E extends Event>(t: EventTarget, type: string, f: (e: E) => void, o?: AddEventListenerOptions) => {
      t.addEventListener(type, f as EventListener, o);
      this.off.push(() => t.removeEventListener(type, f as EventListener, o));
    };
    const at = (e: PointerEvent): PointerIn => ({ id: e.pointerId, sx: e.clientX, sy: e.clientY, touch: e.pointerType !== 'mouse', button: e.button === 2 ? 2 : e.button === 1 ? 1 : 0, t: performance.now() });
    const down = new Set<number>();
    on<PointerEvent>(el, 'pointerdown', (e) => {
      // A panel or person sheet open: a touch on the map only closes it (nothing picked under it).
      if (this.hud.closePanels()) return;
      el.setPointerCapture(e.pointerId);
      down.add(e.pointerId);
      this.lastTouch = e.pointerType !== 'mouse';
      this.gestures.down(at(e));
    });
    on<PointerEvent>(el, 'pointermove', (e) => {
      // A mouse moving with a button held after a press elsewhere (on the interface) is not a drag.
      this.gestures.move({ ...at(e), button: e.buttons & 2 ? 2 : e.buttons & 4 ? 1 : 0 }, down.has(e.pointerId));
    });
    const up = (e: PointerEvent) => {
      if (!down.delete(e.pointerId)) return;
      this.gestures.up(at(e));
    };
    on<PointerEvent>(el, 'pointerup', up);
    on<PointerEvent>(el, 'pointercancel', up);
    on<WheelEvent>(el, 'wheel', (e) => {
      e.preventDefault();
      // Lines or pages (some mice) to pixels.
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
      this.gestures.wheel(e.clientX, e.clientY, e.deltaY * unit);
    }, { passive: false });
    on<Event>(el, 'contextmenu', (e) => e.preventDefault());
    on<KeyboardEvent>(window, 'keydown', (e) => {
      if (e.target instanceof HTMLInputElement || this.behind) return;
      const c = keyCommand(e.key, true);
      if (!c) return;
      e.preventDefault();
      runKey(c, this.session, { closeTop: () => this.hud.closeTop(), turnMap: (d) => this.turn(d), panBy: (dx, dy) => this.panBy(dx, dy) });
    });
    on<Event>(window, 'resize', () => this.resize());
    // Any input on the page (map or interface) wakes the frame rate up (see `loop`).
    const wake = () => (this.wake = true);
    for (const t of ['pointerdown', 'pointermove', 'pointerup', 'wheel']) on<Event>(this.root, t, wake, { capture: true, passive: true });
    on<Event>(window, 'keydown', wake, { capture: true });
  }

  private resize() {
    this.scene.resize(this.root.clientWidth || innerWidth, this.root.clientHeight || innerHeight);
  }

  // ---------------------------------------------------------------- GestureView

  get modalOpen() {
    return this.behind || this.hud.modalOpen;
  }

  /** The title screen closed: the camera back at the opening view, the interface and the weeks start. */
  begin(tutorial: boolean) {
    if (!this.behind) return;
    this.behind = false;
    this.root.classList.remove('behind');
    this.scene.rig.set({ yaw: this.openingYaw });
    this.wake = true;
    this.session.begin(tutorial);
  }

  /** The cell under a screen point: a building's box first with Mover and Demolir, else the ground. */
  cellAt(sx: number, sy: number): Cell | null {
    const t = this.session.tool;
    return this.scene.cellAt(sx, sy, t === 'view' || t === 'clear');
  }

  overUi(sx: number, sy: number) {
    return this.hud.overUi(sx, sy);
  }

  /** A tap with Mover near a resident on the street opens their sheet (a finger gets a wider reach). */
  tapPerson(sx: number, sy: number, touch: boolean) {
    const id = this.scene.personAt(sx, sy, touch ? PERSON_REACH_TOUCH : PERSON_REACH_MOUSE);
    if (id === null) return false;
    this.hud.showPerson(id);
    return true;
  }

  panBy(dx: number, dy: number) {
    this.scene.rig.panBy(dx, dy);
  }

  get zoom() {
    return this.scene.rig.zoom;
  }

  zoomAt(sx: number, sy: number, zoom: number) {
    this.scene.rig.zoomAt(sx, sy, zoom);
  }

  turnBy(radians: number) {
    this.scene.rig.turnBy(radians);
  }

  stopGlide() {
    this.scene.glideTo(null);
  }

  cursorChanged() {
    const c = this.gestures.cursor;
    this.scene.el.style.cursor = c === 'grab' ? CURSORS.grab : c === 'open' ? CURSORS.open : 'default';
  }

  hoverChanged() {
    this.wake = true;
    this.marksDirty = true;
  }

  // ---------------------------------------------------------------- HudHost

  screenOf(r: Rect, top = 0) {
    return this.scene.screenOf(r, top);
  }

  turn(dir: 1 | -1) {
    this.scene.turn(dir);
  }

  nudge(dx: number) {
    // The ground now at the screen centre moved by -dx comes to the centre: the map slides dx.
    const r = this.root.getBoundingClientRect();
    const c = this.scene.cellAt(r.width / 2 - dx, r.height / 2, false);
    if (c) this.scene.glideTo({ x: c.x, y: c.y, w: 1, h: 1 });
  }

  restart(sameMap: boolean) {
    this.opts.restart(sameMap);
  }

  // ---------------------------------------------------------------- SessionView

  redraw() {
    this.wake = true;
    this.scene.cityChanged();
    this.marksDirty = true;
    this.hud.update();
  }

  /** Hover or rotation changed: only the marks and the preview pill (drawn with them), not the whole interface. */
  overlay() {
    this.wake = true;
    this.marksDirty = true;
  }

  toast(msg: string, tone: Tone, opt?: ToastOptions) {
    this.wake = true;
    this.hud.toast(msg, tone, opt);
  }

  out(o: GameOut) {
    this.wake = true;
    this.scene.effect(o);
    switch (o.do) {
      case 'victory':
        this.hud.showVictory(o.week, o.residents, o.births, o.weddings);
        break;
      case 'defeat':
        this.hud.showDefeat(o.week, o.peak);
        break;
      case 'cheer':
        this.hud.float(o.gain, { x: o.x, y: o.y, w: 1, h: 1 }, 'gold');
        break;
      case 'floatBad':
        this.hud.float(o.text, { x: o.x, y: o.y, w: o.w ?? 1, h: o.h ?? 1 }, 'bad');
        break;
      default:
        break;
    }
  }

  drawSpots() {
    this.marksDirty = true;
  }

  /** To the middle of the free map (on touch a single building leaves room for the finger under it). */
  glideTo(r: Rect | null) {
    const lift = this.lastTouch && r && r.w * r.h <= 9 ? TOUCH_LIFT : 0;
    this.scene.glideTo(r, r ? this.hud.focusPoint(lift) : undefined);
  }

  openCategory(_c: BuildingCategory) {
    // The building column shows every category at once.
  }

  setTutorial(sentence: string | null) {
    this.hud.setTutorial(sentence);
  }

  // ---------------------------------------------------------------- frame

  private loop() {
    const now = performance.now();
    // Paused and nothing moving: 10 frames a second are enough (heat and battery on a phone).
    if (this.idle && now - this.last < IDLE_FRAME_MS) {
      this.scene.stage.holdQuality();
      return;
    }
    this.wake = false;
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    const s = this.session;
    s.tick(dt);
    if (this.marksDirty) this.drawMarks();
    this.pointTutorial();
    this.drawThumbs();
    this.hud.frame(dt * 1000);
    // Behind the title the weeks wait but the town lives (people, smoke, water) under a turning camera.
    if (this.behind) this.scene.rig.turnBy(dt * TITLE_ORBIT);
    const speed = this.behind ? 1 : this.modalOpen ? 0 : s.speed;
    this.scene.frame(dt, (now - this.start) / 1000, s.state.week + s.weekFrac, speed, settings.dayNight, !!this.gestures.press);
  }

  /** Which models the thumbnails were drawn from: none yet, the code models, the final ones (the pack). */
  private thumbsOf: 'none' | 'code' | 'final' = 'none';

  /** The buildings' thumbnails: at once from the code models, again when the model pack is in. */
  private drawThumbs() {
    const want = this.scene.ready ? 'final' : 'code';
    if (this.thumbsOf === want || this.thumbsOf === 'final') return;
    this.thumbsOf = want;
    this.hud.setThumbs(this.scene.thumbs(COLUMN_ORDER));
  }

  /** The game stands still, the camera too, and nothing happened since the last frame. */
  private get idle() {
    const s = this.session;
    return !this.wake && !this.behind && (s.speed === 0 || this.modalOpen) && !this.gestures.press && !this.marksDirty && this.scene.still;
  }

  private drawMarks() {
    this.marksDirty = false;
    const s = this.session;
    const ghostRoad = s.tool === 'temple' && s.templeRoad.length ? s.templeRoad : s.guideGhost;
    const marks = this.scene.drawMarks({
      tool: s.tool,
      hover: s.hover,
      selected: s.selected,
      rotated: s.rotated,
      ghostRoad,
      houseSpots: s.guide?.step?.id === 'house',
      templeAreas: s.templeAreas,
      spots: s.spots ? s.spotRects() : null,
      doomed: s.doomed,
    });
    this.hud.setTag(marks.preview?.lines ?? null, marks.preview?.rect ?? null, marks.preview?.bad);
  }

  private pointTutorial() {
    const p = this.session.tutorialPoint(this.lastTouch);
    if (!p) this.hud.setArrow(null);
    else if ('tool' in p) this.hud.setArrow(p);
    else if ('road' in p) this.hud.setArrow({ rect: { ...p.road, w: 1, h: 1 }, lift: 0 });
    else this.hud.setArrow({ rect: p.spot, lift: p.lift ? TOUCH_LIFT : 0 });
  }

  // ---------------------------------------------------------------- closing

  /** Stops drawing, frees the GPU and removes the page elements (the session stays). */
  close() {
    if (this.closed) return;
    this.closed = true;
    this.session.detach(this);
    for (const f of this.off) f();
    this.off = [];
    this.hud.dispose();
    this.scene.dispose();
    this.root.remove();
    if (import.meta.env.DEV) delete (window as { view3d?: unknown }).view3d;
  }

  /** Hooks for the visual tests (dev builds): the 3D view's own, plus the game. */
  private hooks() {
    const g = this;
    const { stage, rig } = this.scene;
    Object.assign(window, {
      view3d: {
        get frames() {
          return stage.frames;
        },
        /** The model pack arrived (or failed, or none was asked): the city has its final look. */
        get ready() {
          return g.scene.ready;
        },
        fps: () => stage.fps(),
        rig,
        game: g,
        view: (o: ViewOverride | null) => stage.view(o),
        quality: (l: Level) => stage.setLevel(l),
        info: () => ({ ...stage.info(), yaw: rig.heading, focus: { x: rig.focus.x, z: rig.focus.z } }),
        /** Screen point of a cell's centre (tests tap there). */
        cellPoint: (x: number, y: number) => g.screenOf({ x, y, w: 1, h: 1 }),
        cellAt: (sx: number, sy: number) => g.cellAt(sx, sy),
        /** Screen points of the residents walking now (tests tap one). */
        residents: () => g.scene.residentPoints(),
        /** Who a mouse click on (sx, sy) picks (tests pick a walker no one else stands next to). */
        personAt: (sx: number, sy: number) => g.scene.personAt(sx, sy, PERSON_REACH_MOUSE),
      },
    });
  }
}
