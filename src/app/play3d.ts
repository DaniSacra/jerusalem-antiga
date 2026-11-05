import type { BuildingCategory, Cell, Rect } from '../core';
import type { GameOut } from '../game/events';
import { Gestures, TOUCH_LIFT, type GestureView, type PointerIn } from '../game/gestures';
import { keyCommand, runKey } from '../game/keys';
import type { Session, SessionView } from '../game/session';
import type { ToastOptions, Tone } from '../game/toastQueue';
import { settings } from '../render/settings';
import { Scene3D, type Scene3DOptions } from '../render3d/scene3d';
import type { Level, ViewOverride } from '../render3d/stage';
import { Hud, type HudHost } from '../ui/hud';

/** Time between frames while the game is paused and nothing moves (10 a second). */
const IDLE_FRAME_MS = 100;

export interface Play3DOptions extends Scene3DOptions {
  /** Back to the 2D game (null when there is none). */
  exit: (() => void) | null;
  /** A new game after a defeat: the same map or a new one. */
  restart(sameMap: boolean): void;
}

/**
 * The playable city in 3D: the same Session the 2D plays, drawn by `Scene3D` under the HTML
 * interface. This owns the page: its root element, the interface, pointer and keys (through the
 * shared Gestures and key commands, so building, demolishing and the tutorial behave as in the 2D).
 * The game keeps running (the day too).
 */
export class Play3D implements SessionView, GestureView, HudHost {
  readonly root: HTMLDivElement;
  readonly hud: Hud;
  readonly gestures: Gestures;
  readonly exit: (() => void) | null;
  private start = performance.now();
  private last = performance.now();
  private off: (() => void)[] = [];
  private marksDirty = true;
  private closed = false;
  /** The last input was a finger (a touch screen until the first input says otherwise). */
  private lastTouch = navigator.maxTouchPoints > 0;
  /** Something happened since the last frame drawn (input, the game): draw the next one. */
  private wake = true;

  private constructor(
    readonly session: Session,
    readonly scene: Scene3D,
    private opts: Play3DOptions,
  ) {
    this.exit = opts.exit;
    const root = (this.root = document.createElement('div'));
    root.className = 'g3d';
    root.style.cssText = 'position:fixed;inset:0;z-index:5;background:#6b5236;overflow:hidden;touch-action:none;';
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
      this.gestures.wheel(e.clientX, e.clientY, e.deltaY);
    }, { passive: false });
    on<Event>(el, 'contextmenu', (e) => e.preventDefault());
    on<KeyboardEvent>(window, 'keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
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
    return this.hud.modalOpen;
  }

  /** The cell under a screen point: a building's box first with Mover and Demolir, else the ground. */
  cellAt(sx: number, sy: number): Cell | null {
    const t = this.session.tool;
    return this.scene.cellAt(sx, sy, t === 'view' || t === 'clear');
  }

  overUi(sx: number, sy: number) {
    return this.hud.overUi(sx, sy);
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
    this.scene.el.style.cursor = c === 'grab' ? 'grabbing' : c === 'open' ? 'grab' : 'default';
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

  overlay() {
    this.wake = true;
    this.marksDirty = true;
    this.hud.update();
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
    this.hud.frame(dt * 1000);
    const speed = this.modalOpen ? 0 : s.speed;
    this.scene.frame(dt, (now - this.start) / 1000, s.state.week + s.weekFrac, speed, settings.dayNight, !!this.gestures.press);
  }

  /** The game stands still, the camera too, and nothing happened since the last frame. */
  private get idle() {
    const s = this.session;
    return !this.wake && (s.speed === 0 || this.modalOpen) && !this.gestures.press && !this.marksDirty && this.scene.still;
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
        close: () => g.exit?.(),
      },
    });
  }
}
