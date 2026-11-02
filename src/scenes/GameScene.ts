import Phaser from 'phaser';
import {
  advanceClock,
  canRotate,
  clearCell,
  computeEconomy,
  createGame,
  createRng,
  currentGoal,
  GOALS,
  goalProgress,
  indexOf,
  place,
  RULES,
  stepMonth,
  templeSpots,
  type ActionResult,
  type Cell,
  type Economy,
  type GameEvent,
  type GameState,
  type Rng,
} from '../core';
import { CameraRig } from '../render/CameraRig';
import { DayNight, phaseIcon } from '../render/DayNight';
import { Effects } from '../render/Effects';
import { SPEEDS, type Speed } from '../render/Hud';
import { describeCell, hintSegments, toolSegments } from '../render/info';
import { footCenter, getRotation, gridToWorld, setRotation, worldToCell, worldToGrid } from '../render/iso';
import { VIEW_CY } from '../render/layout';
import { MapView, originFor } from '../render/MapView';
import { RoadWear } from '../render/RoadWear';
import { C, CSS } from '../render/palette';
import { T } from '../render/strings';
import { generateTextures, HEIGHT, TEX } from '../render/textures';
import { DRAG_TOOLS, isPlaceTool, TOOLS, type Tool } from '../render/tools';
import { Walkers } from '../render/Walkers';
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
  private ui: UIScene | null = null;

  private tool: Tool = 'view';
  /** Non-square buildings (the market) are placed rotated; kept between placements. */
  private rotated = false;
  private speedIndex = 0;
  private clock = 0;
  private hover: Cell | null = null;
  private selected: Cell | null = null;
  /** The info line shows the silver breakdown or the whole goal (after tapping them), kept up to date. */
  private infoMode: 'silver' | 'goal' | null = null;
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

  create() {
    generateTextures(this);
    this.rng = createRng((Math.random() * 2 ** 32) >>> 0);
    this.state = createGame(this.rng);
    this.eco = computeEconomy(this.state);
    this.tool = 'view';
    this.rotated = false;
    this.speedIndex = 0;
    this.clock = 0;
    this.ui = null;
    this.selected = null;
    this.infoMode = null;

    setRotation(0);
    this.cameras.main.setBackgroundColor(C.bg);
    this.wear = new RoadWear(this.state);
    this.map = new MapView(this, this.state, this.wear);
    this.dayNight = new DayNight(this);
    this.walkers = new Walkers(this, this.wear);
    this.fx = new Effects(this);
    this.rig = new CameraRig(this.cameras.main);
    const a = this.state.buildings.find((b) => b.kind === 'altar')!;
    const altar = footCenter(a.x, a.y, a.w, a.h);
    this.rig.centerAt(altar.x, altar.y - 20, this.cameras.main.width / 2, VIEW_CY);

    this.setupInput();
    this.scene.launch('ui', { host: this });
    if (import.meta.env.DEV) {
      Promise.all([import('../core'), import('../render/iso'), import('../render/layout')]).then(([core, iso, layout]) =>
        Object.assign(window, { game: this, state: this.state, core, iso, layout }),
      );
    }
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
    this.dayNight.update((delta / 1000) * speed, delta);
    const light = this.dayNight.current;
    if (this.dayNight.degraded !== this.map.degraded) {
      this.map.degraded = this.dayNight.degraded;
      this.map.sync(this.state, this.eco.efficiency);
    }
    this.map.update(this.time.now, this.rig.zoom, (delta / 1000) * speed, light.night);
    this.walkers.update(delta, this.state, this.eco.residents, speed, this.clock / RULES.monthSeconds, light.walkers);
    this.ui?.setDayPhase(phaseIcon(light.phase), this.dayNight.degraded);
  }

  // ---------- state -> view ----------

  private refresh() {
    this.eco = computeEconomy(this.state);
    this.map.sync(this.state, this.eco.efficiency);
    this.map.showOverlay(this.state, this.tool, this.hover, this.selected, this.rotated);
    this.ui?.refresh(this.state, this.eco, this.speed, this.tool);
    if (this.tool === 'view' && this.selected) this.ui?.setInfo(describeCell(this.state, this.selected.x, this.selected.y));
    else if (this.tool === 'view' && this.infoMode === 'silver') this.ui?.setInfo(hintSegments(T.silverBreakdown(this.eco)));
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
    if (isPlaceTool(tool) && !this.state.unlocked.includes(tool)) {
      this.ui?.setInfo(hintSegments(T.lockedHint(tool)));
      return;
    }
    this.tool = tool;
    this.selected = null;
    this.infoMode = null;
    this.ui?.setInfo(toolSegments(tool));
    if (tool === 'temple' && templeSpots(this.state).length === 0) this.ui?.setInfo([{ text: T.noTempleSpot, color: CSS.badLight }]);
    this.refresh();
  }

  /** Turns the footprint of the current tool (only non-square buildings). */
  rotate() {
    if (!isPlaceTool(this.tool) || this.tool === 'road' || !canRotate(this.tool)) return;
    this.rotated = !this.rotated;
    this.map.showOverlay(this.state, this.tool, this.hover, this.selected, this.rotated);
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
    const n = gridToWorld(g.x, g.y);
    this.rig.centerAt(n.x, n.y, sx, sy);
    this.refresh();
  }

  /** Shows taxes, production and upkeep per kind and balance in the info line (kept up to date). */
  showSilver() {
    if (this.ui?.modalOpen) return;
    if (this.tool !== 'view') this.selectTool('view');
    this.selected = null;
    this.infoMode = 'silver';
    this.refresh();
  }

  /** Shows the whole current goal, its progress, reward and unlock in the info line (kept up to date). */
  showGoal() {
    if (this.ui?.modalOpen) return;
    this.selected = null;
    this.infoMode = 'goal';
    this.refresh();
  }

  /** New map, new seed: back to the start of the game. */
  /** The player changed the display options (day and night, miniature blur). */
  applySettings() {
    this.dayNight.applySettings();
  }

  restart() {
    this.scene.stop('ui');
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
    this.map.showOverlay(this.state, this.tool, this.hover, this.selected, this.rotated);
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
    const digits = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
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
