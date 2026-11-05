import * as THREE from 'three';
import { type Building, type BuildingCategory, type Cell, type Rect } from '../core';
import VISUAL from '../data/visual.json';
import { Gestures, TOUCH_LIFT, type GestureView, type PointerIn } from '../game/gestures';
import { keyCommand, runKey } from '../game/keys';
import type { GameOut } from '../game/events';
import type { Session, SessionView } from '../game/session';
import type { ToastOptions, Tone } from '../game/toastQueue';
import { settings } from '../render/settings';
import { Hud, type HudHost } from '../ui/hud';
import { CameraRig } from './camera';
import { changedLayers, cityKeys, type CityKeys } from './diff';
import { marksOf } from './marks';
import { Overlay } from './overlay';
import { cellOfPoint, pickBox, rayToGround, type PickBox } from './picking';
import { yawOfRotation } from './plan';
import { canRun3D, loadModels, Stage, type Level, type ViewOverride } from './stage';
import { advanceDay, dayTime } from './time/day';
import LOOK from './look3d.json';

export interface Game3DOptions {
  /** Where the camera starts: a grid cell and the 2D view's quarter turns (default the altar, turn 0). */
  start?: { focus: Cell; rotation: number };
  /** Time of day to start at (0..1). */
  dayT?: number;
  /** Back to the 2D game (null when there is none). */
  exit: (() => void) | null;
  /** A new game after a defeat: the same map or a new one. */
  restart(sameMap: boolean): void;
  /** Model pack manifest (null: code models only). */
  pack?: string | null;
}

/** Rough height of each building's box for picking (a tap on a roof picks the building). */
const PICK_TOP = 1.4;
const TEMPLE_TOP = 3;

/**
 * The playable city in 3D: the same Session the 2D plays, drawn with Three.js under an HTML
 * interface. Pointer and keys go through the shared Gestures and key commands, so building,
 * demolishing and the tutorial behave as in the 2D. The game keeps running (the day too).
 */
export class Game3D implements SessionView, GestureView, HudHost {
  readonly root: HTMLDivElement;
  readonly stage: Stage;
  readonly rig: CameraRig;
  readonly hud: Hud;
  readonly gestures: Gestures;
  readonly exit: (() => void) | null;
  private overlayMesh: Overlay;
  private keys: CityKeys;
  private dayT: number;
  private glide: THREE.Vector3 | null = null;
  private clock = new THREE.Clock();
  private off: (() => void)[] = [];
  private marksDirty = true;
  private closed = false;
  private lastTouch = false;

  private constructor(
    readonly session: Session,
    stage: Stage,
    private opts: Game3DOptions,
    models: Awaited<ReturnType<typeof loadModels>>,
  ) {
    const s = session.state;
    this.stage = stage;
    this.exit = opts.exit;
    this.dayT = dayTime(opts.dayT ?? LOOK.day.start);
    const root = (this.root = document.createElement('div'));
    root.className = 'g3d';
    root.style.cssText = 'position:fixed;inset:0;z-index:5;background:#6b5236;overflow:hidden;touch-action:none;';
    const el = stage.el;
    el.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;';
    root.append(el);
    document.body.append(root);

    const altar = s.buildings.find((b) => b.kind === 'altar');
    const f = opts.start?.focus;
    const centre = f ? new THREE.Vector3(f.x + 0.5, 0, f.y + 0.5) : new THREE.Vector3((altar?.x ?? s.cols / 2) + (altar?.w ?? 0) / 2, 0, (altar?.y ?? s.rows / 2) + (altar?.h ?? 0) / 2);
    this.rig = new CameraRig(el, centre, { min: new THREE.Vector2(-4, -4), max: new THREE.Vector2(s.cols + 4, s.rows + 4) }, false);
    this.rig.set({ yaw: yawOfRotation(opts.start?.rotation ?? 0) });

    this.overlayMesh = new Overlay((x, z) => this.stage.world.ground.height(x, z), models);
    stage.scene.add(this.overlayMesh.group);
    this.keys = cityKeys(s);
    this.hud = new Hud(root, this);
    this.gestures = new Gestures(session, this);
    this.listen();
    this.resize();
    session.attach(this);
    session.refresh();
    stage.renderer.setAnimationLoop(() => this.loop());
    if (import.meta.env.DEV) this.hooks();
  }

  /** Opens the 3D game on a session; throws when the device cannot draw WebGL 2. */
  static async open(session: Session, opts: Game3DOptions): Promise<Game3D> {
    if (!canRun3D()) throw new Error('no WebGL 2');
    const models = await loadModels(opts.pack);
    const s = session.state;
    const stage = new Stage(s, session.seed, models, new THREE.Vector3(s.cols / 2, 0, s.rows / 2));
    try {
      return new Game3D(session, stage, opts, models);
    } catch (e) {
      stage.dispose();
      throw e;
    }
  }

  // ---------------------------------------------------------------- input

  private listen() {
    const el = this.stage.el;
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
  }

  private resize() {
    const w = this.root.clientWidth || innerWidth;
    const h = this.root.clientHeight || innerHeight;
    this.stage.resize(w, h, this.rig);
  }

  // ---------------------------------------------------------------- GestureView

  get modalOpen() {
    return this.hud.modalOpen;
  }

  /** The cell under a screen point: a building's box first (Mover, Demolir), else the ground. */
  cellAt(sx: number, sy: number): Cell | null {
    const s = this.session.state;
    const ray = this.rig.rayAt(sx, sy);
    const t = this.session.tool;
    if (t === 'view' || t === 'clear') {
      const hit = pickBox(ray.origin, ray.direction, this.boxes());
      if (hit) return { x: hit.b.x, y: hit.b.y };
    }
    // The ground is not flat: meet the plane at the height found under the last guess.
    let h = 0;
    let p = rayToGround(ray.origin, ray.direction, h);
    for (let k = 0; k < 3 && p; k++) {
      h = this.stage.world.ground.height(p.x, p.z);
      p = rayToGround(ray.origin, ray.direction, h);
    }
    return cellOfPoint(p, s.cols, s.rows);
  }

  private boxes(): (PickBox & { b: Building })[] {
    return this.session.state.buildings.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h, top: b.kind === 'temple' ? TEMPLE_TOP : b.kind === 'field' ? 0.2 : PICK_TOP, b }));
  }

  overUi(sx: number, sy: number) {
    return this.hud.overUi(sx, sy);
  }

  panBy(dx: number, dy: number) {
    this.rig.panBy(dx, dy);
  }

  get zoom() {
    return this.rig.zoom;
  }

  zoomAt(sx: number, sy: number, zoom: number) {
    this.rig.zoomAt(sx, sy, zoom);
  }

  turnBy(radians: number) {
    this.rig.turnBy(radians);
  }

  stopGlide() {
    this.glide = null;
  }

  cursorChanged() {
    const c = this.gestures.cursor;
    this.stage.el.style.cursor = c === 'grab' ? 'grabbing' : c === 'open' ? 'grab' : 'default';
  }

  hoverChanged() {
    this.marksDirty = true;
  }

  // ---------------------------------------------------------------- HudHost

  /** Screen point over the centre of a footprint, `top` units above the ground (null behind the camera). */
  screenOf(r: Rect, top = 0): { x: number; y: number } | null {
    const cx = r.x + r.w / 2;
    const cz = r.y + r.h / 2;
    const v = new THREE.Vector3(cx, this.stage.world.ground.height(cx, cz) + top, cz).project(this.rig.camera);
    if (v.z > 1) return null;
    const b = this.stage.el.getBoundingClientRect();
    return { x: b.left + ((v.x + 1) / 2) * b.width, y: b.top + ((1 - v.y) / 2) * b.height };
  }

  /** A quarter turn of the map (Q/E and the buttons). */
  turn(dir: 1 | -1) {
    this.rig.turn((dir * Math.PI) / 2);
  }

  restart(sameMap: boolean) {
    this.opts.restart(sameMap);
  }

  // ---------------------------------------------------------------- SessionView

  redraw() {
    const keys = cityKeys(this.session.state);
    if (changedLayers(this.keys, keys).length) this.stage.cityChanged();
    this.keys = keys;
    this.marksDirty = true;
    this.hud.update();
  }

  overlay() {
    this.marksDirty = true;
    this.hud.update();
  }

  toast(msg: string, tone: Tone, opt?: ToastOptions) {
    this.hud.toast(msg, tone, opt);
  }

  out(o: GameOut) {
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
        // The effects (rings, dust, sparks) come with the 3D effects phase.
        break;
    }
  }

  drawSpots() {
    this.marksDirty = true;
  }

  glideTo(r: Rect | null) {
    this.glide = r && new THREE.Vector3(r.x + r.w / 2, 0, r.y + r.h / 2);
  }

  openCategory(_c: BuildingCategory) {
    // The building column shows every category at once.
  }

  setTutorial(sentence: string | null) {
    this.hud.setTutorial(sentence);
  }

  // ---------------------------------------------------------------- frame

  private loop() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const s = this.session;
    s.tick(dt);
    const speed = this.modalOpen ? 0 : s.speed;
    this.dayT = advanceDay(this.dayT, dt * speed, settings.dayNight, VISUAL.dayNight.cycleSeconds);
    if (this.glide) {
      if (this.gestures.press) this.glide = null;
      else {
        const f = this.rig.focus;
        const k = Math.min(1, dt * 4);
        this.rig.set({ x: f.x + (this.glide.x - f.x) * k, z: f.z + (this.glide.z - f.z) * k });
        if (Math.hypot(this.glide.x - f.x, this.glide.z - f.z) < 0.05) this.glide = null;
      }
    }
    this.rig.update(dt);
    if (this.marksDirty) this.drawMarks();
    this.pointTutorial();
    this.hud.frame(dt * 1000);
    this.stage.frame(dt, this.clock.elapsedTime, s.state.week + s.weekFrac, this.dayT, this.rig);
  }

  private drawMarks() {
    this.marksDirty = false;
    const s = this.session;
    const id = s.guide?.step?.id;
    const ghostRoad = s.tool === 'temple' && s.templeRoad.length ? s.templeRoad : s.guideGhost;
    const marks = marksOf(s.state, {
      tool: s.tool,
      hover: s.hover,
      selected: s.selected,
      rotated: s.rotated,
      ghostRoad,
      houseSpots: id === 'house',
      templeAreas: s.templeAreas,
      spots: s.spots ? s.spotRects() : null,
      doomed: s.doomed,
    });
    this.overlayMesh.draw(marks);
    this.hud.setTag(marks.preview?.lines ?? null, marks.preview?.rect ?? null);
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
    for (const f of this.off) f();
    this.off = [];
    this.hud.dispose();
    this.overlayMesh.dispose();
    this.stage.dispose();
    this.root.remove();
    if (import.meta.env.DEV) delete (window as { view3d?: unknown }).view3d;
  }

  /** Hooks for the visual tests (dev builds): the 3D view's own, plus the game. */
  private hooks() {
    const g = this;
    Object.assign(window, {
      view3d: {
        get frames() {
          return g.stage.frames;
        },
        fps: () => g.stage.fps(),
        rig: g.rig,
        game: g,
        view: (o: ViewOverride | null) => g.stage.view(o),
        quality: (l: Level) => g.stage.setLevel(l),
        info: () => ({ ...g.stage.info(), yaw: g.rig.heading, focus: { x: g.rig.focus.x, z: g.rig.focus.z } }),
        /** Screen point of a cell's centre (tests tap there). */
        cellPoint: (x: number, y: number) => g.screenOf({ x, y, w: 1, h: 1 }),
        cellAt: (sx: number, sy: number) => g.cellAt(sx, sy),
        close: () => g.exit?.(),
      },
    });
  }
}
