import Phaser from 'phaser';
import {
  advanceClock,
  canRotate,
  clearCell,
  computeEconomy,
  createGame,
  createRng,
  dimsOf,
  currentGoal,
  ghostRoad,
  GOALS,
  goalProgress,
  indexOf,
  place,
  placeSpots,
  RULES,
  stepMonth,
  templeSpots,
  upkeepCharged,
  type ActionResult,
  type Cell,
  type Economy,
  type GameEvent,
  type GameState,
  type Rng,
} from '../core';
import { Ambient } from '../render/Ambient';
import { CameraRig } from '../render/CameraRig';
import { DayNight, phaseIcon } from '../render/DayNight';
import { Effects } from '../render/Effects';
import { SPEEDS, type Speed } from '../render/Hud';
import { describeCell, hintSegments, toolSegments } from '../render/info';
import { footCenter, getRotation, gridToWorld, setRotation, worldToCell, worldToGrid } from '../render/iso';
import { PLAQUE, plaqueSlot, VIEW_CY } from '../render/layout';
import { MapView, originFor, type OverlayGuide } from '../render/MapView';
import { TutorialGuide, tutorialSeen, type TutorialTarget } from '../render/Tutorial';
import VISUAL from '../data/visual.json';
import { RoadWear } from '../render/RoadWear';
import { C, CSS } from '../render/palette';
import { T } from '../render/strings';
import { generateTextures, HEIGHT, TEX } from '../render/textures';
import { DRAG_TOOLS, isPlaceTool, TOOLS, type Tool } from '../render/tools';
import { Walkers } from '../render/Walkers';
import { mulColor, SeasonClock } from '../render/Seasons';
import type { Weather } from '../render/Weather';
import type { UIScene, UiHost } from './UIScene';

const TAP_SLOP = 10;
/** A touch drag only starts building after this long with one finger, so a pinch never builds. */
const TOUCH_BUILD_DELAY = 150;
/** On touch, single buildings are aimed this far above the finger so the preview is not hidden by it. */
const TOUCH_LIFT = 90;
const sameCell = (a: Cell | null, b: Cell | null) => !!a && !!b && a.x === b.x && a.y === b.y;

/** Cells from a to b (excluding a), stepping orthogonally so dragged roads stay connected. */
function orthoSteps(a: Cell, b: Cell): Cell[] {
  const out: Cell[] = [];
  let { x, y } = a;
  while (x !== b.x || y !== b.y) {
    if (Math.abs(b.x - x) >= Math.abs(b.y - y)) x += Math.sign(b.x - x);
    else y += Math.sign(b.y - y);
    out.push({ x, y });
  }
  return out;
}

interface Gesture {
  id: number;
  start: Cell | null;
  last: Cell | null;
  downX: number;
  downY: number;
  /** Time of the press (ms), for TOUCH_BUILD_DELAY. */
  downAt: number;
  touch: boolean;
  lastX: number;
  lastY: number;
  moved: boolean;
  applied: boolean;
  cancelled: boolean;
  toastedSilver: boolean;
  /** Road cells placed during this gesture, checked for connection when it ends. */
  roads: Cell[];
}

export class GameScene extends Phaser.Scene implements UiHost {
  private state!: GameState;
  private rng!: Rng;
  private eco!: Economy;
  private map!: MapView;
  private walkers!: Walkers;
  private fx!: Effects;
  private rig!: CameraRig;
  private dayNight!: DayNight;
  private wear!: RoadWear;
  private ambient!: Ambient;
  private ui: UIScene | null = null;
  /** Rain, snow and what the wind carries, on its own overlay scene (null until it starts). */
  private weather: Weather | null = null;
  /** The look of the year (seasons, and the rare snowy winters and droughts drawn from the map seed). */
  private seasons!: SeasonClock;

  private tool: Tool = 'view';
  /** Non-square buildings (the market) are placed rotated; kept between placements. */
  private rotated = false;
  private speedIndex = 0;
  private clock = 0;
  private hover: Cell | null = null;
  private selected: Cell | null = null;
  /** The info line shows the silver breakdown or the whole goal (after tapping them), kept up to date. */
  private infoMode: 'silver' | 'happiness' | 'goal' | null = null;
  /** First-game tutorial (null when seen before or skipped). */
  private guide: TutorialGuide | null = null;
  /** The road the tutorial suggests (chosen once per game). */
  private ghost: Cell[] = [];
  /** A free house spot for the tutorial arrow (houses step). */
  private houseHint: Cell | null = null;
  /** The camera follows the first family for a moment (family step). */
  private follow: { id: number; until: number } | null = null;
  private followed = false;
  private gesture: Gesture | null = null;
  private touches = new Map<number, { x: number; y: number }>();
  private pinch: { dist: number; zoom: number; midX: number; midY: number } | null = null;
  private rightPan: { id: number; x: number; y: number } | null = null;

  constructor() {
    super('game');
  }

  private get speed(): Speed {
    return SPEEDS[this.speedIndex];
  }

  /** `tutorial` forces the tutorial ("Ver tutorial de novo"); otherwise it runs until seen once. */
  create(data?: { tutorial?: boolean }) {
    generateTextures(this);
    const seed = (Math.random() * 2 ** 32) >>> 0;
    this.rng = createRng(seed);
    this.seasons = new SeasonClock(seed);
    this.state = createGame(this.rng);
    this.guide = data?.tutorial || !tutorialSeen() ? new TutorialGuide(this.state) : null;
    this.ghost = this.guide ? ghostRoad(this.state) : [];
    this.houseHint = null;
    this.follow = null;
    this.followed = false;
    this.eco = computeEconomy(this.state);
    this.tool = 'view';
    this.rotated = false;
    this.speedIndex = 0;
    this.clock = 0;
    this.ui = null;
    this.weather = null;
    this.selected = null;
    this.infoMode = null;

    setRotation(0);
    this.cameras.main.setBackgroundColor(C.bg);
    this.wear = new RoadWear(this.state);
    this.map = new MapView(this, this.state, this.wear);
    this.dayNight = new DayNight(this);
    this.walkers = new Walkers(this, this.wear);
    this.ambient = new Ambient(this, (x, y, r) => this.walkers.near(x, y, r));
    this.ambient.sync(this.state);
    this.fx = new Effects(this);
    this.rig = new CameraRig(this.cameras.main);
    const a = this.state.buildings.find((b) => b.kind === 'altar')!;
    const altar = footCenter(a.x, a.y, a.w, a.h);
    this.rig.centerAt(altar.x, altar.y - 20, this.cameras.main.width / 2, VIEW_CY);

    this.setupInput();
    this.scene.launch('weather', { host: this });
    this.scene.launch('ui', { host: this });
    if (import.meta.env.DEV) {
      Promise.all([import('../core'), import('../render/iso'), import('../render/layout')]).then(([core, iso, layout]) =>
        Object.assign(window, { game: this, state: this.state, core, iso, layout }),
      );
    }
  }

  attachWeather(w: Weather) {
    this.weather = w;
  }

  attachUi(ui: UIScene) {
    this.ui = ui;
    this.selectTool('view');
  }

  update(_time: number, delta: number) {
    const speed = this.ui?.modalOpen ? 0 : this.speed;
    const { acc, steps } = advanceClock(this.clock, delta / 1000, speed);
    this.clock = acc;
    for (let k = 0; k < steps; k++) this.handleEvents(stepMonth(this.state, this.rng));
    if (steps) this.refresh();
    // Seasons and weather: the ground, trees, river and roads of the season, wet ground and
    // puddles after rain, a tint over the world and the sky, rain or snow, heat shimmer in summer.
    const look = this.seasons.at(this.state.month, this.clock / RULES.monthSeconds);
    const w = this.weather;
    w?.update((delta / 1000) * speed, look, this.dayNight.degraded);
    this.map.setSeason(look, w?.wet ?? 0, w?.puddles ?? 0);
    this.dayNight.setExtraTint(mulColor(look.tint, w?.tint ?? 0xffffff), mulColor(look.sky, w?.skyTint ?? 0xffffff));
    this.dayNight.setShimmer(w && w.sky !== 'clear' ? 0 : look.shimmer);
    this.dayNight.update((delta / 1000) * speed, delta);
    const light = this.dayNight.current;
    if (this.dayNight.degraded !== this.map.degraded) {
      this.map.degraded = this.dayNight.degraded;
      this.map.sync(this.state, this.eco.efficiency);
    }
    this.map.update(this.time.now, this.rig.zoom, (delta / 1000) * speed, light.night);
    this.ambient.update(this.time.now / 1000, (delta / 1000) * speed, light.night, Math.max(look.clouds, w?.clouds ?? 0), look);
    this.walkers.update(delta, this.state, this.eco.residents, speed, this.clock / RULES.monthSeconds, light.walkers * (this.weather?.walkers ?? 1));
    if (this.guide) this.updateTutorial(delta);
    this.ui?.setDayPhase(phaseIcon(light.phase), this.dayNight.degraded);
    this.ui?.setDrought(look.drought);
  }

  // ---------- state -> view ----------

  private refresh() {
    this.eco = computeEconomy(this.state);
    this.map.sync(this.state, this.eco.efficiency);
    this.ambient.sync(this.state);
    this.checkTutorial();
    this.drawOverlay();
    this.ui?.refresh(this.state, this.eco, this.speed, this.tool, this.guide?.allowed() ?? null);
    if (this.tool === 'view' && this.selected) this.ui?.setInfo(describeCell(this.state, this.selected.x, this.selected.y));
    else if (this.tool === 'view' && this.infoMode === 'silver') this.ui?.setInfo(hintSegments(T.silverBreakdown(this.eco)));
    else if (this.tool === 'view' && this.infoMode === 'happiness') this.ui?.setInfo(hintSegments(T.happinessBreakdown(this.eco)));
    else if (this.infoMode === 'goal') this.ui?.setInfo(hintSegments(this.goalInfo()));
  }

  private goalInfo(): string {
    const goal = currentGoal(this.state);
    if (!goal) return T.allGoals;
    return T.goalInfo(this.state.goalIndex + 1, GOALS.length, goal, goalProgress(this.state, goal));
  }

  private handleEvents(events: GameEvent[]) {
    for (const e of events) {
      switch (e.type) {
        case 'houseUp': {
          const c = footCenter(e.x, e.y);
          this.map.bounce(this.state, e.x, e.y);
          this.fx.ring(c.x, c.y);
          this.fx.floatText(c.x, c.y - (HEIGHT[TEX.building('house', e.level)] ?? 20) - 8, `+${e.delta}`);
          break;
        }
        case 'houseDown': {
          const c = footCenter(e.x, e.y);
          this.fx.floatText(c.x, c.y - 30, e.famine ? `Fome ${e.delta}` : `${e.delta}`, CSS.bad);
          break;
        }
        case 'famineStart':
          this.ui?.toast(T.famine, 'bad');
          break;
        case 'goal':
          this.ui?.toast(T.goalDone(e.reward, e.unlock), 'good');
          if (e.unlock && T.unlocked[e.unlock]) this.ui?.toast(T.unlocked[e.unlock]!, 'good');
          break;
        case 'victory':
          this.ui?.showVictory(e.month, e.residents);
          break;
        case 'familyLeft':
          this.walkers.leave(this.state, e.x, e.y);
          break;
        case 'debtStart':
          this.ui?.toast(T.debtStart, 'bad');
          if (this.speed === 3) this.speedIndex = SPEEDS.indexOf(1); // slow down once so the player can react
          break;
        case 'debtEnd':
          this.ui?.toast(T.debtEnd, 'good');
          break;
        case 'defeat':
          this.ui?.showDefeat(e.month, e.peak);
          break;
        case 'season':
          this.ui?.toast(T.seasonStart[e.season], 'info');
          break;
        case 'upkeepStart':
          if (!this.guide?.upkeepStarted()) this.ui?.toast(T.upkeepStart, 'info');
          break;
      }
    }
  }

  // ---------- UI host ----------

  selectTool(tool: Tool) {
    if (this.ui?.modalOpen) return;
    if (tool === this.tool && isPlaceTool(tool) && tool !== 'road' && canRotate(tool)) {
      this.rotate();
      return;
    }
    const allowed = this.guide?.allowed();
    if (allowed && !allowed.has(tool)) {
      this.ui?.setInfo(hintSegments(T.tutorial.locked));
      return;
    }
    if (isPlaceTool(tool) && !this.state.unlocked.includes(tool)) {
      this.ui?.setInfo(hintSegments(T.lockedHint(tool)));
      return;
    }
    this.tool = tool;
    this.selected = null;
    this.infoMode = null;
    this.ui?.setInfo(toolSegments(tool, upkeepCharged(this.state)));
    if (tool === 'temple' && templeSpots(this.state).length === 0) this.ui?.setInfo([{ text: T.noTempleSpot, color: CSS.badLight }]);
    this.refresh();
  }

  /** Turns the footprint of the current tool (only non-square buildings). */
  rotate() {
    if (!isPlaceTool(this.tool) || this.tool === 'road' || !canRotate(this.tool)) return;
    this.rotated = !this.rotated;
    this.drawOverlay();
  }

  /** Turns the view a quarter turn (1 = clockwise, -1 = counterclockwise), keeping the same spot centered. */
  turnMap(dir: 1 | -1) {
    if (this.ui?.modalOpen) return;
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
    const n = gridToWorld(g.x, g.y);
    this.rig.centerAt(n.x, n.y, sx, sy);
    this.refresh();
  }

  /**
   * Shows a breakdown in the info line, kept up to date: the silver (taxes, production, upkeep and
   * balance) or the happiness (moods, effects and causes).
   */
  showBreakdown(mode: 'silver' | 'happiness') {
    if (this.ui?.modalOpen) return;
    if (this.tool !== 'view') this.selectTool('view');
    this.selected = null;
    this.infoMode = mode;
    this.refresh();
  }

  /** Shows the whole current goal, its progress, reward and unlock in the info line (kept up to date). */
  showGoal() {
    if (this.ui?.modalOpen) return;
    this.selected = null;
    this.infoMode = 'goal';
    this.refresh();
  }

  /** The player changed the display options (day and night, miniature blur). */
  applySettings() {
    this.dayNight.applySettings();
  }

  /** New map, new seed: back to the start of the game. */
  restart() {
    this.scene.stop('ui');
    this.scene.stop('weather');
    this.scene.restart();
  }

  cycleSpeed() {
    this.setSpeed(SPEEDS[(this.speedIndex + 1) % SPEEDS.length]);
  }

  setSpeed(v: Speed) {
    if (this.ui?.modalOpen) return;
    this.speedIndex = SPEEDS.indexOf(v);
    this.refresh();
  }

  // ---------- tutorial ----------

  skipTutorial() {
    if (!this.guide) return;
    if (this.guide.skip()) this.ui?.toast(T.upkeepStart, 'info');
    this.guide = null;
    this.ui?.setTutorial(null);
    this.refresh();
  }

  tutorialOk() {
    this.guide?.tap(this.state);
    this.refresh();
  }

  private drawOverlay() {
    const id = this.guide?.step?.id;
    const guide: OverlayGuide | null = id === 'road' || id === 'houses' ? { ghost: id === 'road' ? this.ghost : [], houseSpots: id === 'houses' } : null;
    this.map.showOverlay(this.state, this.tool, this.hover, this.selected, this.rotated, guide);
  }

  /** Moves the tutorial past finished steps and shows the current one. */
  private checkTutorial() {
    const guide = this.guide;
    if (!guide) return;
    const change = guide.update(this.state);
    if (change === 'done') this.ui?.toast(T.tutorial.done, 'good');
    const step = guide.step;
    if (!step) {
      this.ui?.setTutorial(null);
      return;
    }
    // A tool the step does not allow goes back to Ver (after the drag, so a long road is not cut).
    const allowed = guide.allowed();
    if (!this.gesture && allowed && !allowed.has(this.tool)) {
      this.tool = 'view';
      this.ui?.setInfo([]);
    }
    if (step.id === 'houses') {
      const a = RULES.map.altar;
      const d = (c: Cell) => Math.abs(c.x - a.x) + Math.abs(c.y - a.y);
      this.houseHint = placeSpots(this.state, 'house').reduce<Cell | null>((best, c) => (!best || d(c) < d(best) ? c : best), null);
    }
    this.ui?.setTutorial(T.tutorial.step[step.id], step.id === 'upkeep');
  }

  /** Per frame: the arrow follows the map under the camera, and the camera follows the first family. */
  private updateTutorial(delta: number) {
    const step = this.guide!.step;
    if (step?.id === 'family' && !this.followed && this.state.families.length) {
      this.follow = { id: this.state.families[0].id, until: this.time.now + VISUAL.tutorial.followSeconds * 1000 };
      this.followed = true;
    }
    if (this.follow) {
      const p = this.walkers.familyPos(this.follow.id);
      if (!p || this.time.now > this.follow.until) this.follow = null;
      else {
        const cam = this.cameras.main;
        const c = this.rig.toWorld(cam.width / 2, VIEW_CY);
        const k = Math.min(1, (delta / 1000) * 4);
        this.rig.centerAt(c.x + (p.x - c.x) * k, c.y + (p.y - c.y) * k, cam.width / 2, VIEW_CY);
      }
    }
    this.ui?.pointTutorial(step ? this.tutorialTarget() : null);
  }

  /** Where the arrow points: the step's tool button until it is picked, then the spot on the map. */
  private tutorialTarget(): TutorialTarget | null {
    const step = this.guide!.step!;
    if (step.id === 'upkeep') {
      const r = plaqueSlot(1);
      return { x: r.x + 24, y: PLAQUE.h + 2, dir: 'up' };
    }
    if (step.tool && this.tool !== step.tool) {
      const b = this.ui?.buttonOf(step.tool);
      if (!b) return null;
      return b.side === 'right' ? { x: b.x - b.w / 2 + 4, y: b.y, dir: 'right' } : { x: b.x + b.w / 2 - 4, y: b.y, dir: 'left' };
    }
    const cell = step.id === 'road' ? this.ghost.find((c) => !this.state.roads[indexOf(this.state, c.x, c.y)]) : step.id === 'houses' ? this.houseHint : null;
    if (!cell) return null;
    const { w, h } = step.id === 'houses' ? dimsOf('house') : { w: 1, h: 1 };
    const p = footCenter(cell.x, cell.y, w, h);
    return { ...this.toScreen(p.x, p.y), dir: 'down' };
  }

  private toScreen(wx: number, wy: number) {
    const cam = this.cameras.main;
    const cx = cam.width / 2;
    const cy = cam.height / 2;
    return { x: (wx - cam.scrollX - cx) * cam.zoom + cx, y: (wy - cam.scrollY - cy) * cam.zoom + cy };
  }

  // ---------- input ----------

  private overUi(sx: number, sy: number) {
    return this.ui?.isOverUi(sx, sy) ?? false;
  }

  /** Cell a pointer aims at: lifted above the finger for single buildings on touch; none if the
   * finger or the aimed point is under the interface (the preview is never hidden by it). */
  private aimAt(p: Phaser.Input.Pointer): Cell | null {
    const lift = p.wasTouch && isPlaceTool(this.tool) && !DRAG_TOOLS.has(this.tool) ? TOUCH_LIFT : 0;
    if (this.overUi(p.x, p.y) || (lift && this.overUi(p.x, p.y - lift))) return null;
    return this.cellAt(p.x, p.y - lift);
  }

  private cellAt(sx: number, sy: number): Cell | null {
    const w = this.rig.toWorld(sx, sy);
    return worldToCell(w.x, w.y);
  }

  private setHover(cell: Cell | null) {
    if (sameCell(cell, this.hover) || (!cell && !this.hover)) return;
    this.hover = cell;
    this.drawOverlay();
  }

  private setupInput() {
    this.input.mouse?.disableContextMenu();
    this.input.addPointer(1);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.rig.zoomAt(p.x, p.y, this.rig.zoom * (dy > 0 ? 0.9 : 1.1));
    });
    const keys = this.input.keyboard;
    const digits = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'ZERO'];
    TOOLS.forEach((t, k) => keys?.on(`keydown-${digits[k]}`, () => this.selectTool(t)));
    keys?.on('keydown-SPACE', () => this.cycleSpeed());
    keys?.on('keydown-R', () => this.rotate());
    keys?.on('keydown-Q', () => this.turnMap(-1));
    keys?.on('keydown-E', () => this.turnMap(1));
    keys?.on('keydown-ESC', () => this.selectTool('view'));
  }

  private onDown(p: Phaser.Input.Pointer) {
    if (this.ui?.modalOpen || this.overUi(p.x, p.y)) return;
    if (p.rightButtonDown() || p.middleButtonDown()) {
      this.rightPan = { id: p.id, x: p.x, y: p.y };
      return;
    }
    this.touches.set(p.id, { x: p.x, y: p.y });
    if (this.touches.size >= 2) {
      if (this.gesture) this.gesture.cancelled = true;
      const [a, b] = [...this.touches.values()];
      this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.rig.zoom, midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2 };
      return;
    }
    const cell = this.aimAt(p);
    this.gesture = {
      id: p.id,
      start: cell,
      last: cell,
      downX: p.x,
      downY: p.y,
      downAt: this.time.now,
      touch: p.wasTouch,
      lastX: p.x,
      lastY: p.y,
      moved: false,
      applied: false,
      cancelled: false,
      toastedSilver: false,
      roads: [],
    };
    if (this.tool !== 'view') this.setHover(cell);
  }

  private onMove(p: Phaser.Input.Pointer) {
    if (this.rightPan?.id === p.id) {
      this.rig.panBy(p.x - this.rightPan.x, p.y - this.rightPan.y);
      this.rightPan.x = p.x;
      this.rightPan.y = p.y;
      return;
    }
    if (this.touches.has(p.id)) this.touches.set(p.id, { x: p.x, y: p.y });

    if (this.pinch && this.touches.size >= 2) {
      const [a, b] = [...this.touches.values()];
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      this.rig.panBy(midX - this.pinch.midX, midY - this.pinch.midY);
      this.rig.zoomAt(midX, midY, (this.pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / Math.max(1, this.pinch.dist));
      this.pinch.midX = midX;
      this.pinch.midY = midY;
      return;
    }

    const g = this.gesture;
    if (!g || g.id !== p.id || !p.isDown) {
      if (!p.isDown && !p.wasTouch) this.setHover(this.overUi(p.x, p.y) ? null : this.cellAt(p.x, p.y));
      return;
    }
    if (g.cancelled) return;
    if (Math.hypot(p.x - g.downX, p.y - g.downY) > TAP_SLOP) g.moved = true;

    if (this.tool === 'view') {
      if (g.moved) this.rig.panBy(p.x - g.lastX, p.y - g.lastY);
    } else {
      const cell = this.aimAt(p);
      this.setHover(cell);
      // Never build under the UI, and give a second finger time to land before a touch drag builds.
      const ready = g.moved && (!g.touch || this.time.now - g.downAt >= TOUCH_BUILD_DELAY);
      if (DRAG_TOOLS.has(this.tool) && ready && cell && !sameCell(cell, g.last)) {
        if (!g.applied && g.start) this.apply(g.start, true);
        for (const c of g.last ? orthoSteps(g.last, cell) : [cell]) this.apply(c, false);
        g.last = cell;
        g.applied = true;
      }
    }
    g.lastX = p.x;
    g.lastY = p.y;
  }

  private onUp(p: Phaser.Input.Pointer) {
    if (this.rightPan?.id === p.id) {
      this.rightPan = null;
      return;
    }
    this.touches.delete(p.id);
    if (this.touches.size < 2) this.pinch = null;
    const g = this.gesture;
    if (!g || g.id !== p.id) return;
    this.gesture = null;
    if (!g.cancelled) {
      if (this.tool === 'view') {
        if (!g.moved && g.start) this.select(g.start);
      } else if (!g.applied) {
        // Single-placement tools drop where the finger is released, so the preview can be adjusted.
        // Releasing a single building over the UI cancels it.
        const cell = DRAG_TOOLS.has(this.tool) ? g.start : this.aimAt(p);
        if (cell) this.apply(cell, true);
      }
      this.warnLooseRoads(g.roads);
    }
    if (p.wasTouch) this.setHover(null);
    const allowed = this.guide?.allowed();
    if (allowed && !allowed.has(this.tool)) this.refresh(); // a step ended during the drag
  }

  /** Warns once if any road just built is not connected to the altar. */
  private warnLooseRoads(cells: Cell[]) {
    const s = this.state;
    if (cells.some((c) => !s.network[indexOf(s, c.x, c.y)])) this.ui?.toast(T.looseRoad, 'bad');
  }

  private select(cell: Cell) {
    this.selected = cell;
    this.infoMode = null;
    this.refresh();
  }

  private apply(cell: Cell, first: boolean) {
    if (this.tool === 'view') return;
    const s = this.state;
    const o = originFor(this.tool, cell, this.rotated);
    // Continuing a road from an existing one: nothing to build there, and nothing wrong either.
    if (this.tool === 'road' && s.roads[indexOf(s, o.x, o.y)]) return;
    const r: ActionResult = isPlaceTool(this.tool) ? place(s, this.tool, o.x, o.y, this.rotated, this.rng) : clearCell(s, o.x, o.y);
    if (r.ok) {
      if (this.tool === 'road') {
        if (this.gesture) this.gesture.roads.push(o);
        else this.warnLooseRoads([o]); // a tap ends the gesture before placing
      }
      const b = s.grid[indexOf(s, o.x, o.y)];
      const c = b ? footCenter(b.x, b.y, b.w, b.h) : footCenter(o.x, o.y);
      if (this.tool === 'clear') this.fx.dust(c.x, c.y);
      else if (this.tool === 'temple') this.fx.celebrate(c.x, c.y);
      else this.fx.ring(c.x, c.y);
      this.refresh();
      return;
    }
    const g = this.gesture;
    if (r.reason === 'silver') {
      if (g?.toastedSilver) return;
      if (g) g.toastedSilver = true;
      this.ui?.toast(T.fail.silver, 'bad');
    } else if (first) {
      this.ui?.toast(T.fail[r.reason], 'bad');
    }
  }
}
