import Phaser from 'phaser';
import { type Building, type BuildableKind, type BuildingCategory, type Cell, type Economy, type GameEvent, type GameState, type Rect } from '../core';
import { Ambient } from '../render/Ambient';
import { CameraRig } from '../render/CameraRig';
import { DayNight } from '../render/DayNight';
import { Effects } from '../render/Effects';
import { Haulers } from '../render/Haulers';
import { footCenter, getRotation, gridToWorld, setRotation, worldToCell, worldToGrid } from '../render/iso';
import { VIEW_CY } from '../render/layout';
import { MapView, type OverlayGuide } from '../render/MapView';
import type { TutorialTarget } from '../render/Tutorial';
import VISUAL from '../data/visual.json';
import { RoadWear } from '../render/RoadWear';
import { C, CSS } from '../render/palette';
import { T } from '../render/strings';
import { generateTextures, HEIGHT, TEX } from '../render/textures';
import { generateUiArt, setHandCursor } from '../render/uiArt';
import { type Speed, type Tool } from '../render/tools';
import { launch3D } from '../render/view3d';
import { Walkers } from '../render/Walkers';
import { mulColor, SeasonClock } from '../render/Seasons';
import type { Weather } from '../render/Weather';
import type { GameOut } from '../game/events';
import { Gestures, TOUCH_LIFT, type GestureView, type PointerIn } from '../game/gestures';
import { keyCommand, runKey } from '../game/keys';
import { Session, type SessionView } from '../game/session';
import type { ToastOptions, Tone } from '../game/toastQueue';
import { tutorialSeen } from '../game/tutorial';
import type { UIScene, UiHost } from './UIScene';

/** Dev builds: `?seed=N` fixes the map (the visual tests use it); null otherwise. */
function devSeed(): number | null {
  if (!import.meta.env.DEV) return null;
  const v = new URLSearchParams(location.search).get('seed');
  return v === null ? null : Number(v) >>> 0;
}

/** The 2D (Phaser) view of a game: draws the session (src/game) and passes the player's input to it. */
export class GameScene extends Phaser.Scene implements UiHost, SessionView, GestureView {
  session!: Session;
  private map!: MapView;
  private walkers!: Walkers;
  private fx!: Effects;
  /** Grain carriers in the harvest, fishermen and fruit gatherers (only a sight). */
  private haulers!: Haulers;
  private rig!: CameraRig;
  private dayNight!: DayNight;
  private wear!: RoadWear;
  private ambient!: Ambient;
  private ui: UIScene | null = null;
  /** Rain, snow and what the wind carries, on its own overlay scene (null until it starts). */
  private weather: Weather | null = null;
  /** The look of the year (seasons, and the rare snowy winters and droughts drawn from the map seed). */
  private seasons!: SeasonClock;

  /** The camera follows the first family for a moment (family step). */
  private follow: { id: number; until: number } | null = null;
  private followed = false;
  /** The camera glides to a place (a new tutorial step, a temple area): a world point. */
  private pan: { x: number; y: number } | null = null;
  /** Touch, mouse and pen on the map (shared with the 3D view). */
  private gestures!: Gestures;
  /** Mouse cursor shown now (see updateCursor). */
  private cursor: 'open' | 'grab' | null = null;

  constructor() {
    super('game');
  }

  // Short names the interface and the visual tests read (the session holds the game).
  get state(): GameState {
    return this.session.state;
  }
  get tool(): Tool {
    return this.session.tool;
  }
  get selected(): Cell | null {
    return this.session.selected;
  }
  set selected(c: Cell | null) {
    this.session.selected = c;
  }
  get hover() {
    return this.session.hover;
  }
  get guide() {
    return this.session.guide;
  }
  get templeAreas() {
    return this.session.templeAreas;
  }
  get ghost() {
    return this.session.ghost;
  }
  get spot() {
    return this.session.spot;
  }
  get lumberHint() {
    return this.session.lumberHint;
  }
  get houseHint() {
    return this.session.houseHint;
  }
  get fieldHint() {
    return this.session.fieldHint;
  }
  get seed() {
    return this.session.seed;
  }
  set seed(v: number) {
    this.session.seed = v;
  }
  get speed(): Speed {
    return this.session.speed;
  }
  get eco(): Economy {
    return this.session.city.eco;
  }
  get modalOpen() {
    return this.ui?.modalOpen ?? false;
  }

  /**
   * `tutorial` forces the tutorial ("Ver tutorial de novo"); otherwise it runs until seen once.
   * `seed` replays a map ("Mesmo mapa" on the defeat screen).
   */
  create(data?: { tutorial?: boolean; seed?: number }) {
    generateTextures(this);
    generateUiArt(this);
    const seed = data?.seed ?? devSeed() ?? (Math.random() * 2 ** 32) >>> 0;
    this.session = new Session({ seed, tutorial: !!data?.tutorial, seen: tutorialSeen() });
    this.seasons = new SeasonClock(seed);
    this.follow = null;
    this.followed = false;
    this.pan = null;
    this.ui = null;
    this.cursor = null;
    this.weather = null;

    setRotation(0);
    this.cameras.main.setBackgroundColor(C.bg);
    const state = this.state;
    this.wear = new RoadWear(state);
    this.map = new MapView(this, state, this.wear);
    this.dayNight = new DayNight(this);
    this.walkers = new Walkers(this, this.wear);
    this.haulers = new Haulers(this);
    this.haulers.sync(state);
    this.ambient = new Ambient(this, (x, y, r) => this.walkers.near(x, y, r));
    this.ambient.sync(state);
    this.fx = new Effects(this);
    this.rig = new CameraRig(this.cameras.main);
    const a = state.buildings.find((b) => b.kind === 'altar')!;
    const altar = footCenter(a.x, a.y, a.w, a.h);
    this.rig.centerAt(altar.x, altar.y - 20, this.cameras.main.width / 2, VIEW_CY);
    this.session.attach(this);
    this.gestures = new Gestures(this.session, this);

    this.setupInput();
    this.scene.launch('weather', { host: this });
    this.scene.launch('ui', { host: this });
    if (import.meta.env.DEV) {
      Promise.all([import('../core'), import('../render/iso'), import('../render/layout')]).then(([core, iso, layout]) =>
        Object.assign(window, { game: this, session: this.session, state, core, iso, layout }),
      );
    }
  }

  attachWeather(w: Weather) {
    this.weather = w;
  }

  attachUi(ui: UIScene) {
    this.ui = ui;
    // The opening sentence first, with the caravan the seed drew (the game does not pause): the
    // warnings of the first refresh wait behind it.
    // The weeks are the forecast's, the same the food pill and goal 1 show.
    const s = this.state;
    const c = s.start;
    const weeks = this.session.city.forecast?.weeks ?? c.foodWeeks;
    if (s.week === 0) {
      ui.toast(T.caravan(c.families, weeks), 'good', { big: true, ms: 5000 });
      // The tutorial's house step speaks of the couple; out of it, a toast names them.
      const [a, b] = c.couple.map((id) => this.session.nameOf(id));
      if (a && b && !this.guide) ui.toast(T.wantToMarry(a, b), 'good', { ms: 5000 });
    }
    this.selectTool('view');
  }

  update(_time: number, delta: number) {
    const session = this.session;
    const speed = this.modalOpen ? 0 : this.speed;
    session.tick(delta / 1000);
    // Seasons and weather: the ground, trees, river and roads of the season, wet ground and
    // puddles after rain, a tint over the world and the sky, rain or snow, heat shimmer in summer.
    const look = this.seasons.at(this.state.week, session.weekFrac, this.state);
    const w = this.weather;
    w?.update((delta / 1000) * speed, look, this.dayNight.degraded);
    this.map.setSeason(look, w?.wet ?? 0, w?.puddles ?? 0);
    this.dayNight.setExtraTint(mulColor(look.tint, w?.tint ?? 0xffffff), mulColor(look.sky, w?.skyTint ?? 0xffffff));
    this.dayNight.setShimmer(w && w.sky !== 'clear' ? 0 : look.shimmer);
    this.dayNight.update((delta / 1000) * speed, delta);
    const light = this.dayNight.current;
    if (this.dayNight.degraded !== this.map.degraded) {
      this.map.degraded = this.dayNight.degraded;
      this.map.sync(this.state, this.eco);
    }
    this.map.update(this.time.now, this.rig.zoom, (delta / 1000) * speed, light.night);
    this.ambient.update(this.time.now / 1000, (delta / 1000) * speed, light.night, Math.max(look.clouds, w?.clouds ?? 0), look);
    this.walkers.update(delta, this.state, this.eco.residents, speed, session.weekFrac, light.walkers * (this.weather?.walkers ?? 1));
    this.haulers.update(delta / 1000, speed);
    if (this.guide) this.updateTutorial(delta);
    else if (this.pan && (this.gestures.press || this.glide(this.pan, delta))) this.pan = null; // the camera going to a temple area
    this.ui?.setSlow(this.dayNight.degraded);
    this.ui?.setDrought(look.drought);
  }

  // ---------- session -> view (SessionView) ----------

  /** Recomputes the city and redraws (the visual tests call it). */
  refresh() {
    this.session.refresh();
  }

  /** The week's events (the visual tests feed them by hand). */
  handleEvents(events: GameEvent[]) {
    this.session.handleEvents(events);
  }

  redraw() {
    const s = this.session;
    this.map.setTempleAreas(s.templeAreas, s.templeRoad);
    this.map.sync(this.state, this.eco);
    this.ambient.sync(this.state);
    this.haulers.sync(this.state);
    this.drawOverlay();
    this.ui?.refresh(this.state, s.city, this.speed, this.tool, this.guide?.running ?? false, this.selected);
  }

  overlay() {
    this.drawOverlay();
  }

  toast(msg: string, tone: Tone, opt?: ToastOptions) {
    this.ui?.toast(msg, tone, opt);
  }

  drawSpots(rects: readonly Rect[] | null) {
    if (rects) this.map.showSpots(rects);
    else this.map.clearSpots();
  }

  glideTo(r: Rect | null) {
    this.pan = r && footCenter(r.x, r.y, r.w, r.h);
  }

  openCategory(c: BuildingCategory) {
    this.ui?.openCategory(c);
  }

  setTutorial(sentence: string | null) {
    this.ui?.setTutorial(sentence, false);
  }

  /** Draws an effect or passes interface news (see GameOut). */
  out(o: GameOut) {
    const s = this.state;
    const at = (r: Rect) => footCenter(r.x, r.y, r.w, r.h);
    switch (o.do) {
      case 'cheer':
        this.cheerHouse(o.x, o.y, o.gain);
        break;
      case 'floatBad': {
        const c = footCenter(o.x, o.y, o.w ?? 1, o.h ?? 1);
        this.fx.floatText(c.x, c.y - 30, o.text, CSS.bad);
        break;
      }
      case 'milestone':
        this.map.shine(o.building.id);
        this.fx.milestone(s, o.building, this.map.heightOf(o.building));
        if (o.note) this.ui?.milestone(o.id);
        break;
      case 'spoil': {
        const c = at(o.building);
        this.fx.spoil(c.x, c.y - 12);
        break;
      }
      case 'harvestRing': {
        const c = at(o.building);
        this.fx.ring(c.x, c.y, C.grain, 2.4);
        break;
      }
      case 'fell':
        this.map.fell(o.x, o.y);
        break;
      case 'leave':
        this.walkers.leave(s, o.x, o.y);
        break;
      case 'invite3D':
        this.ui?.invite3D();
        break;
      case 'unlocked':
        this.ui?.unlocked(o.kind);
        break;
      case 'victory':
        this.ui?.showVictory(o.week, o.residents, o.births, o.weddings);
        break;
      case 'defeat':
        this.ui?.showDefeat(o.week, o.peak);
        break;
      case 'placed': {
        const c = at(o);
        if (o.temple) this.fx.celebrate(c.x, c.y);
        else this.fx.ring(c.x, c.y);
        break;
      }
      case 'dust': {
        const c = at(o);
        this.fx.dust(c.x, c.y, Math.max(o.w, o.h));
        break;
      }
      case 'upgraded': {
        const b = o.building;
        const c = at(b);
        this.map.bounce(s, b.x, b.y);
        this.fx.ring(c.x, c.y, C.ui.goldLight, Math.max(b.w, b.h));
        break;
      }
    }
  }

  /** A house that grew (a level or a baby): it hops, a ring of light spreads and the gain floats up. */
  private cheerHouse(x: number, y: number, gain: string) {
    const b = this.state.grid[y * this.state.cols + x];
    const c = footCenter(x, y);
    this.map.bounce(this.state, x, y);
    this.fx.ring(c.x, c.y);
    this.fx.floatText(c.x, c.y - (b ? this.map.heightOf(b) : 20) - 8, gain);
  }

  // ---------- UI host ----------

  selectTool(tool: Tool) {
    this.session.selectTool(tool);
  }

  /** Screen point of the center of a grid footprint (UI coordinates) and the camera zoom. */
  cellScreen(x: number, y: number, w: number, h: number) {
    const p = footCenter(x, y, w, h);
    return { ...this.toScreen(p.x, p.y), zoom: this.cameras.main.zoom };
  }

  showSpots(kind: BuildableKind | 'road', target: Building) {
    this.session.showSpots(kind, target);
  }

  upgradeAt(cell: Cell) {
    this.session.upgradeAt(cell);
  }

  demolishAt(cell: Cell) {
    this.session.demolishAt(cell);
  }

  /** Moves the camera to a house (at once) and opens its balloon (person sheet, Povo tab). */
  showHouse(houseId: number) {
    const b = this.state.buildings.find((o) => o.id === houseId);
    if (!b) return;
    const at = this.ui?.freeCenter() ?? { x: this.cameras.main.width / 2, y: VIEW_CY };
    const c = footCenter(b.x, b.y, b.w, b.h);
    this.rig.centerAt(c.x, c.y, at.x, at.y);
    this.pan = null;
    this.session.selectHouse(houseId);
  }

  /** The tapped building's balloon is too wide beside it: the camera glides so the building goes `dx` screen px sideways. */
  nudge(dx: number) {
    const at = this.ui?.freeCenter() ?? { x: this.cameras.main.width / 2, y: VIEW_CY };
    this.pan = this.rig.toWorld(at.x - dx, at.y);
  }

  deselect() {
    this.session.deselect();
  }

  rotate() {
    this.session.rotate();
  }

  /** Turns the view a quarter turn (1 = clockwise, -1 = counterclockwise), keeping the same spot centered. */
  turnMap(dir: 1 | -1) {
    if (this.modalOpen) return;
    const cam = this.cameras.main;
    const sx = cam.width / 2;
    const sy = VIEW_CY;
    const w = this.rig.toWorld(sx, sy);
    const g = worldToGrid(w.x, w.y);
    setRotation(getRotation() + dir);
    this.map.destroy();
    this.map = new MapView(this, this.state, this.wear);
    this.map.degraded = this.dayNight.degraded;
    this.ambient.rebuild(this.state);
    this.drawSpots(this.session.spotRects());
    const n = gridToWorld(g.x, g.y);
    this.rig.centerAt(n.x, n.y, sx, sy);
    this.refresh();
  }

  pickCategory(c: BuildingCategory) {
    this.session.pickCategory(c);
  }

  /** The player changed the display options (day and night, miniature blur). */
  applySettings() {
    this.dayNight.applySettings();
  }

  /** Back to the start of the game: a new map (new seed), or the same map with `sameMap`. */
  restart(sameMap = false) {
    this.scene.stop('ui');
    this.scene.stop('weather');
    // Always new data: Phaser keeps the last start data when none is given (an old seed or tutorial flag).
    this.scene.restart(sameMap ? { seed: this.seed } : {});
  }

  /**
   * The 3D button: the playable 3D takes over this game (the same session) and Phaser's loop
   * sleeps, so only one view draws and takes input. "2D" in the 3D comes back here, where the
   * session is given back and redrawn as it is now.
   */
  open3D() {
    if (this.modalOpen) return;
    // Nothing stays open under the 3D (nor is still open on the way back).
    this.ui?.closeAll();
    if (this.selected) this.deselect();
    const session = this.session;
    const input = this.game.input;
    // The 3D opens on the cell at the centre of the 2D camera, turned like the 2D view.
    const mid = this.cameras.main.midPoint;
    const g = worldToGrid(mid.x, mid.y);
    void launch3D({
      session,
      start: { focus: { x: g.x, y: g.y }, rotation: getRotation() },
      dayT: this.dayNight.current.t,
      pause: () => {
        // Keys and touches go to the 3D only (Q/E, Esc would also act on the sleeping map).
        input.enabled = false;
        if (input.keyboard) input.keyboard.enabled = false;
        this.game.loop.sleep();
      },
      resume: () => {
        input.enabled = true;
        if (input.keyboard) input.keyboard.enabled = true;
        this.game.loop.resetDelta();
        this.game.loop.wake();
        session.attach(this);
        session.refresh();
      },
      restart: (sameMap) => this.restart(sameMap),
      fail: () => this.ui?.toast(T.view3d.failed, 'bad'),
    });
  }

  cycleSpeed() {
    this.session.cycleSpeed();
  }

  setSpeed(v: Speed) {
    this.session.setSpeed(v);
  }

  // ---------- tutorial ----------

  skipTutorial() {
    this.session.skipTutorial();
  }

  tutorialOk() {
    this.refresh();
  }

  /** The place a tutorial step is about (the visual tests read it). */
  stepSpot(id: string) {
    return this.session.stepSpot(id);
  }

  private drawOverlay() {
    const s = this.session;
    const id = this.guide?.step?.id;
    // The marked road: to the food on the road step, to the lumber spot on its step (when it needs one).
    const ghost = s.guideGhost;
    const guide: OverlayGuide | null = id === 'road' || id === 'house' || ghost.length ? { ghost, houseSpots: id === 'house' } : null;
    this.map.showOverlay(this.state, this.tool, this.hover, this.selected, s.rotated, guide);
    // The building the demolish tool would remove turns red.
    this.map.highlightDemolish(s.doomed);
    this.updateCursor();
  }

  /** Mouse only: the open hand over the map with Mover, the closed hand while dragging the map. */
  private updateCursor() {
    const mode = this.gestures.cursor;
    if (mode === this.cursor) return;
    this.cursor = mode;
    setHandCursor(this, mode);
  }

  /** Per frame: the arrow follows the map under the camera, and the camera follows the first family. */
  private updateTutorial(delta: number) {
    const step = this.guide!.step;
    if (step?.id === 'wedding' && !this.followed && this.state.families.length) {
      this.follow = { id: this.state.families[0].id, until: this.time.now + VISUAL.tutorial.followSeconds * 1000 };
      this.followed = true;
    }
    if (this.gestures.press) this.pan = null; // a press on the map (a road being dragged) stops the glide under it
    if (this.follow) {
      const p = this.walkers.familyPos(this.follow.id);
      if (!p || this.time.now > this.follow.until) this.follow = null;
      else this.glide(p, delta);
    } else if (this.pan && this.glide(this.pan, delta)) this.pan = null;
    this.ui?.pointTutorial(step ? this.tutorialTarget() : null);
  }

  /**
   * Moves the camera a step toward bringing a world point to the middle of the free map (clear of
   * the top bar, the column, the tutorial bubble and the toasts); true once it is there.
   */
  private glide(p: { x: number; y: number }, delta: number): boolean {
    const cam = this.cameras.main;
    const at = this.ui?.freeCenter() ?? { x: cam.width / 2, y: VIEW_CY };
    const c = this.rig.toWorld(at.x, at.y);
    const k = Math.min(1, (delta / 1000) * 4);
    this.rig.centerAt(c.x + (p.x - c.x) * k, c.y + (p.y - c.y) * k, at.x, at.y);
    // There, or held back by the map edge (the camera no longer moves).
    const now = this.rig.toWorld(at.x, at.y);
    return Math.hypot(p.x - c.x, p.y - c.y) < 2 || Math.hypot(now.x - c.x, now.y - c.y) < 0.05;
  }

  /** Where the arrow points on screen: the step's tool button until it is picked, then the spot on the map. */
  tutorialTarget(): TutorialTarget | null {
    const point = this.session.tutorialPoint(this.input.activePointer.wasTouch);
    if (!point) return null;
    if ('tool' in point) {
      const b = this.ui?.buttonOf(point.tool);
      if (!b) return null;
      if (b.side === 'bottom') return { x: b.x, y: b.y - b.w / 2 - 4, dir: 'down' };
      return b.side === 'right' ? { x: b.x - b.w / 2 + 4, y: b.y, dir: 'right' } : { x: b.x + b.w / 2 - 4, y: b.y, dir: 'left' };
    }
    if ('road' in point) {
      const p = footCenter(point.road.x, point.road.y);
      const at = this.toScreen(p.x, p.y);
      return { x: at.x, y: at.y, dir: 'down' };
    }
    const { spot } = point;
    const p = footCenter(spot.x, spot.y, spot.w, spot.h);
    const at = this.toScreen(p.x, p.y);
    // On touch a single building is aimed TOUCH_LIFT above the finger: the arrow shows where the
    // finger goes, so a tap on its tip builds on the marked spot. Otherwise the tip stays over the
    // top of the building, so the arrow never covers its preview.
    if (point.lift) return { x: at.x, y: at.y + TOUCH_LIFT, dir: 'down' };
    const top = (HEIGHT[TEX.building(this.tool as BuildableKind)] ?? 20) * this.cameras.main.zoom;
    // Above the preview pill ("Rende N…") when it shows, so the arrow never covers its text.
    return { x: at.x, y: Math.min(at.y - top, (this.ui?.tagTop() ?? Infinity) - 2), dir: 'down' };
  }

  private toScreen(wx: number, wy: number) {
    const cam = this.cameras.main;
    const cx = cam.width / 2;
    const cy = cam.height / 2;
    return { x: (wx - cam.scrollX - cx) * cam.zoom + cx, y: (wy - cam.scrollY - cy) * cam.zoom + cy };
  }

  // ---------- input (GestureView) ----------

  overUi(sx: number, sy: number) {
    return this.ui?.isOverUi(sx, sy) ?? false;
  }

  cellAt(sx: number, sy: number): Cell | null {
    const w = this.rig.toWorld(sx, sy);
    return worldToCell(w.x, w.y);
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

  stopGlide() {
    this.pan = null;
  }

  cursorChanged() {
    this.updateCursor();
  }

  hoverChanged(cell: Cell | null) {
    this.ui?.setHover(cell);
  }

  setHover(cell: Cell | null) {
    if (this.session.setHover(cell)) this.ui?.setHover(cell);
  }

  /** A tap with Mover on a cell (the visual tests call it). */
  select(cell: Cell) {
    this.session.select(cell);
  }

  /** Uses the current tool on a cell (the visual tests call it). */
  apply(cell: Cell, first: boolean, touch = false) {
    this.session.apply(cell, first, touch, this.gestures.press);
  }

  private setupInput() {
    this.input.mouse?.disableContextMenu();
    this.input.addPointer(1);
    const at = (p: Phaser.Input.Pointer): PointerIn => ({
      id: p.id,
      sx: p.x,
      sy: p.y,
      touch: p.wasTouch,
      button: p.rightButtonDown() ? 2 : p.middleButtonDown() ? 1 : 0,
      t: this.time.now,
    });
    const g = this.gestures;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => g.down(at(p)));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => g.move(at(p), p.isDown));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => g.up(at(p)));
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => g.up(at(p)));
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => g.wheel(p.x, p.y, dy));
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      const c = keyCommand(e.key);
      if (c) runKey(c, this.session, { closeTop: () => this.ui?.closeTop() ?? false, turnMap: (d) => this.turnMap(d) });
    });
  }
}
