import Phaser from 'phaser';
import {
  balloonNeed,
  BUILDINGS,
  checkClear,
  checkPlace,
  computeEconomy,
  footprint,
  indexOf,
  placeSize,
  roadMask,
  serviceOf,
  templeSpots,
  type Building,
  type BuildingKind,
  type Cell,
  type GameState,
  type BalloonKind,
  canRotate,
  craftOf,
  dimsOf,
  type Dims,
  type Rect,
} from '../core';
import { C, shade } from './palette';
import { COLS, DEPTH, HH, HW, ROWS, cellHash, depthAt, footCenter, fromView, gridToWorld, rectCorners, viewDims, viewMask, viewToWorld } from './iso';
import { HEIGHT, PARTS, TEX, VARIANTS, cropImages, setTex } from './textures';
import { isPlaceTool, type Tool } from './tools';
import { FieldCrew } from './Fieldhands';

interface BuildingView {
  kind: BuildingKind;
  root: Phaser.GameObjects.Container;
  main: Phaser.GameObjects.Image;
  wheat: Phaser.GameObjects.Image[];
  /** Farmers working in a field. */
  crew?: FieldCrew;
  flame?: Phaser.GameObjects.Image;
  glow?: Phaser.GameObjects.Image;
  smoke?: Phaser.GameObjects.Particles.ParticleEmitter;
}

interface Balloon {
  need: BalloonKind;
  root: Phaser.GameObjects.Container;
  icon: Phaser.GameObjects.Image;
  baseY: number;
  phase: number;
}

const local = (x: number, y: number, z = 0) => ({ x: (x - y) * HW, y: (x + y) * HH - z });

/** Footprint of a tool (1x1 for Ver and Limpar). */
export const toolDims = (kind: Tool, rotated = false): Dims => (isPlaceTool(kind) ? placeSize(kind, rotated) : { w: 1, h: 1 });

/** Origin (top-left) of a footprint centered on the hovered cell. */
export function originFor(kind: Tool, cell: Cell, rotated = false): Cell {
  const { w, h } = toolDims(kind, rotated);
  return { x: cell.x - Math.floor((w - 1) / 2), y: cell.y - Math.floor((h - 1) / 2) };
}

/**
 * Texture of a building; non-square footprints lying the other way on screen have their own drawing.
 * Mirrored houses and fields have their own drawing too (flipping the image would move the light).
 */
/** Balloon size on screen relative to zoom 1 (they are scaled up when zoomed out). */
const BALLOON_SCREEN_SCALE = 1.2;

const keyOf = (b: Rect & { kind: BuildingKind; level?: number; variant?: number; mirrored?: boolean }) =>
  TEX.building(b.kind, b.level ?? 0, canRotate(b.kind) && viewDims(b.w, b.h).w !== dimsOf(b.kind).w, b.variant ?? 0, b.mirrored ?? false);

/** Houses get a small per-plot nudge and a slightly different shade of mud or stone. */
function applyLook(img: Phaser.GameObjects.Image, b: Building) {
  if (b.kind !== 'house') return;
  const h = cellHash(b.x, b.y);
  const grey = Math.round(255 * (0.9 + ((h >>> 5) % 11) * 0.01));
  img.setPosition((h % 5) - 2, ((h >>> 3) % 3) - 1).setTint((grey << 16) | (grey << 8) | grey);
}

/** Road texture for a cell, with its junctions turned to the current view. */
const roadKey = (s: GameState, x: number, y: number) => TEX.road(viewMask(roadMask(s, x, y)));

export class MapView {
  private features = new Map<number, { key: string; img: Phaser.GameObjects.Image }>();
  private roads = new Map<number, Phaser.GameObjects.Image>();
  private views = new Map<number, BuildingView>();
  private balloons = new Map<number, Balloon>();
  private riverCells: Cell[] = [];
  private water: Phaser.GameObjects.Graphics;
  /** Dashed marks over roads that are not connected to the altar. */
  private looseRoads: Phaser.GameObjects.Graphics;
  private overlay: Phaser.GameObjects.Graphics;
  private preview: Phaser.GameObjects.Image;
  /** Game-speed clock in seconds for work animations (stops when paused). */
  private work = 0;
  /** Ground tiles, diorama sides and river banks (rebuilt only with the whole view). */
  private ground: Phaser.GameObjects.GameObject[] = [];

  constructor(private scene: Phaser.Scene, state: GameState) {
    this.drawGround(state);
    this.water = scene.add.graphics().setDepth(DEPTH.groundFx);
    this.looseRoads = scene.add.graphics().setDepth(DEPTH.road + 0.5);
    this.overlay = scene.add.graphics().setDepth(DEPTH.overlay);
    this.preview = scene.add.image(0, 0, TEX.building('house')).setDepth(DEPTH.preview).setVisible(false);
    this.sync(state, computeEconomy(state).efficiency);
  }

  private drawGround(s: GameState) {
    const sc = this.scene;
    // Diorama sides along the two front edges of the view.
    const sides = sc.add.graphics().setDepth(DEPTH.ground);
    this.ground.push(sides);
    const depth = 26;
    const groundAtView = (vx: number, vy: number) => {
      const g = fromView(vx + 0.5, vy + 0.5);
      return s.ground[indexOf(s, Math.floor(g.x), Math.floor(g.y))];
    };
    const W = viewToWorld;
    for (let k = 0; k < COLS; k++) {
      sides.fillStyle(groundAtView(k, ROWS - 1) === 'river' ? C.waterDeep : C.earthLit);
      sides.fillPoints([W(k, ROWS), W(k + 1, ROWS), W(k + 1, ROWS, -depth), W(k, ROWS, -depth)], true);
    }
    for (let k = 0; k < ROWS; k++) {
      sides.fillStyle(groundAtView(COLS - 1, k) === 'river' ? shade(C.waterDeep, 0.8) : C.earthDark);
      sides.fillPoints([W(COLS, k), W(COLS, k + 1), W(COLS, k + 1, -depth), W(COLS, k, -depth)], true);
    }
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const g = s.ground[indexOf(s, x, y)];
        if (g === 'river') this.riverCells.push({ x, y });
        const c = footCenter(x, y);
        this.ground.push(sc.add.image(c.x, c.y, TEX.ground(g, cellHash(x, y) % VARIANTS)).setDepth(DEPTH.ground));
      }
    }
    // Light sandy bank where land meets the river.
    const bank = sc.add.graphics().setDepth(DEPTH.ground);
    this.ground.push(bank);
    for (const { x, y } of this.riverCells) {
      if (x > 0 && s.ground[indexOf(s, x - 1, y)] !== 'river') {
        const a = gridToWorld(x, y);
        const b = gridToWorld(x, y + 1);
        bank.lineStyle(5, C.bank, 0.9);
        bank.lineBetween(a.x, a.y, b.x, b.y);
      }
    }
  }

  /** Removes everything this view drew (used to rebuild it after turning the map). */
  destroy() {
    for (const o of this.ground) o.destroy();
    for (const f of this.features.values()) f.img.destroy();
    for (const r of this.roads.values()) r.destroy();
    for (const v of this.views.values()) this.destroyView(v);
    for (const b of this.balloons.values()) b.root.destroy();
    [this.water, this.looseRoads, this.overlay, this.preview].forEach((o) => o.destroy());
  }

  // ---------- sync with the simulation ----------

  sync(s: GameState, efficiency: number) {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        this.syncFeature(s, x, y);
        this.syncRoad(s, x, y);
      }
    }
    this.drawLooseRoads(s);
    const alive = new Set<number>();
    // Farmers per field follow the share of jobs filled; none on a field without a road.
    const farmers = Math.round(BUILDINGS.field.jobs * efficiency);
    for (const b of s.buildings) {
      alive.add(b.id);
      this.syncBuilding(b);
      this.views.get(b.id)!.crew?.setCount(b.connected ? farmers : 0);
      this.syncBalloon(s, b);
    }
    for (const [id, v] of this.views) {
      if (alive.has(id)) continue;
      this.destroyView(v);
      this.views.delete(id);
      this.balloons.get(id)?.root.destroy();
      this.balloons.delete(id);
    }
  }

  private syncFeature(s: GameState, x: number, y: number) {
    const i = indexOf(s, x, y);
    const f = s.feature[i];
    const key = f ? TEX.feature(f, cellHash(x, y) % VARIANTS) : null;
    const cur = this.features.get(i);
    if (cur?.key === key) return;
    cur?.img.destroy();
    this.features.delete(i);
    if (!key) return;
    const c = footCenter(x, y);
    this.features.set(i, { key, img: setTex(this.scene.add.image(c.x, c.y, key), key).setDepth(depthAt(x + 0.5, y + 0.5)) });
  }

  private syncRoad(s: GameState, x: number, y: number) {
    const i = indexOf(s, x, y);
    const cur = this.roads.get(i);
    if (!s.roads[i]) {
      cur?.destroy();
      this.roads.delete(i);
      return;
    }
    const key = roadKey(s, x, y);
    const alpha = s.network[i] ? 1 : 0.45;
    if (cur) {
      if (cur.texture.key !== key) cur.setTexture(key);
      cur.setAlpha(alpha);
      return;
    }
    const c = footCenter(x, y);
    this.roads.set(i, this.scene.add.image(c.x, c.y, key).setDepth(DEPTH.road).setAlpha(alpha));
  }

  /** Faded roads get a dashed center line along each arm, so "not connected" reads at a glance. */
  private drawLooseRoads(s: GameState) {
    const g = this.looseRoads;
    g.clear();
    g.lineStyle(2, C.cream, 0.9);
    const arms = [
      [0, -0.5],
      [0.5, 0],
      [0, 0.5],
      [-0.5, 0],
    ];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const i = indexOf(s, x, y);
        if (!s.roads[i] || s.network[i]) continue;
        const mask = roadMask(s, x, y);
        arms.forEach(([dx, dy], k) => {
          if (mask && !(mask & (1 << k))) return;
          for (let t = 0.08; t < 0.5; t += 0.2) {
            const a = gridToWorld(x + 0.5 + dx * 2 * t, y + 0.5 + dy * 2 * t);
            const b = gridToWorld(x + 0.5 + dx * 2 * (t + 0.1), y + 0.5 + dy * 2 * (t + 0.1));
            g.lineBetween(a.x, a.y, b.x, b.y);
          }
        });
      }
    }
  }

  private syncBuilding(b: Building) {
    let v = this.views.get(b.id);
    if (!v) {
      v = this.createView(b);
      this.views.set(b.id, v);
    }
    const key = keyOf(b);
    if (v.main.texture.key !== key) setTex(v.main, key);
    applyLook(v.main, b);
  }

  private createView(b: Building): BuildingView {
    const sc = this.scene;
    const c = footCenter(b.x, b.y, b.w, b.h);
    const key = keyOf(b);
    const root = sc.add.container(c.x, c.y).setDepth(depthAt(b.x + b.w / 2, b.y + b.h / 2));
    const main = setTex(sc.add.image(0, 0, key), key);
    root.add(main);
    const view: BuildingView = { kind: b.kind, root, main, wheat: [] };
    if (b.kind === 'field') {
      view.wheat = cropImages(sc, 0, 0, 1, b.variant, b.mirrored);
      root.add(view.wheat);
      view.crew = new FieldCrew(sc, root, view.wheat, b.mirrored ?? false);
    }
    if (b.kind === 'altar') {
      const { x, y, z, scale } = PARTS.altarFire;
      const f = local(x, y, z);
      view.glow = sc.add.image(f.x, f.y - 4 * scale, TEX.soft).setTint(0xf6a03c).setAlpha(0.5).setScale(1.3 * scale);
      view.flame = sc.add.image(f.x, f.y + 1, TEX.flame).setOrigin(0.5, 1).setScale(scale);
      root.add([view.glow, view.flame]);
    }
    const fire = b.kind === 'workshop' ? PARTS.craftFire[craftOf(b)!] : undefined;
    if (fire) {
      // A mirrored drawing swaps the local axes.
      const at = ({ x, y, z }: { x: number; y: number; z: number }) => (b.mirrored ? local(y, x, z) : local(x, y, z));
      const g = at(fire.glow);
      view.glow = sc.add.image(g.x, g.y - 2, TEX.soft).setTint(0xf0702c).setAlpha(0.5).setScale(0.9);
      root.add(view.glow);
      const ch = at(fire.smoke);
      view.smoke = sc.add
        .particles(c.x + ch.x, c.y + ch.y, TEX.soft, {
          lifespan: 2000,
          speedY: { min: -24, max: -14 },
          speedX: { min: 2, max: 12 },
          scale: { start: 0.3, end: 0.9 },
          alpha: { start: 0.6, end: 0 },
          tint: craftOf(b) === 'smithy' ? 0xb8b2aa : 0xe4e0d8,
          frequency: 420,
        })
        .setDepth(DEPTH.fx);
    }
    return view;
  }

  private destroyView(v: BuildingView) {
    this.scene.tweens.killTweensOf(v.root);
    v.smoke?.destroy();
    v.root.destroy();
  }

  private syncBalloon(s: GameState, b: Building) {
    const need = balloonNeed(s, b);
    const cur = this.balloons.get(b.id);
    if (!need) {
      cur?.root.destroy();
      this.balloons.delete(b.id);
      return;
    }
    const c = footCenter(b.x, b.y, b.w, b.h);
    const baseY = c.y - (HEIGHT[keyOf(b)] ?? 20) - 6;
    if (cur) {
      cur.baseY = baseY;
      if (cur.need !== need) {
        cur.icon.setTexture(TEX.need(need));
        cur.need = need;
      }
      return;
    }
    const sc = this.scene;
    const bg = sc.add.image(0, 0, TEX.balloon).setOrigin(0.5, 1);
    const icon = sc.add.image(0, -16, TEX.need(need)).setScale(0.8);
    const root = sc.add.container(c.x + 6, baseY, [bg, icon]).setDepth(DEPTH.fx + 1);
    this.balloons.set(b.id, { need, root, icon, baseY, phase: cellHash(b.x, b.y) % 100 });
  }

  // ---------- feedback ----------

  bounce(s: GameState, x: number, y: number) {
    const b = s.grid[indexOf(s, x, y)];
    const v = b && this.views.get(b.id);
    if (!b || !v) return;
    const tweens = this.scene.tweens;
    const groundY = footCenter(b.x, b.y, b.w, b.h).y;
    tweens.killTweensOf(v.root);
    v.root.setY(groundY).setScale(1);
    tweens.add({ targets: v.root, y: groundY - 10, scaleX: 0.92, scaleY: 1.08, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
  }

  // ---------- tool overlay ----------

  private fillCells(cells: Iterable<Cell>, color: number, alpha: number) {
    const g = this.overlay;
    g.fillStyle(color, alpha);
    for (const c of cells) g.fillPoints(rectCorners(c.x, c.y, 1, 1), true);
  }

  /** Cells covered by any position where the temple fits. */
  private templeArea(s: GameState): Cell[] {
    const seen = new Set<number>();
    const { w, h } = dimsOf('temple');
    for (const o of templeSpots(s)) for (const c of footprint(o.x, o.y, w, h)) seen.add(indexOf(s, c.x, c.y));
    return [...seen].map((i) => ({ x: i % s.cols, y: Math.floor(i / s.cols) }));
  }

  private coverageCells(s: GameState, covered: boolean[]): Cell[] {
    const out: Cell[] = [];
    covered.forEach((on, i) => on && out.push({ x: i % s.cols, y: Math.floor(i / s.cols) }));
    return out;
  }

  showOverlay(s: GameState, tool: Tool, hover: Cell | null, selected: Cell | null, rotated = false) {
    const g = this.overlay;
    g.clear();
    this.preview.setVisible(false);

    if (tool === 'view') {
      if (selected) {
        const b = s.grid[indexOf(s, selected.x, selected.y)];
        const area = b ? rectCorners(b.x, b.y, b.w, b.h) : rectCorners(selected.x, selected.y, 1, 1);
        g.lineStyle(3, 0xfff3b0, 0.95);
        g.strokePoints(area, true, true);
      }
      return;
    }

    g.lineStyle(1, C.ink, 0.12);
    for (let k = 0; k <= COLS; k++) {
      const a = gridToWorld(k, 0);
      const b = gridToWorld(k, ROWS);
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
    for (let k = 0; k <= ROWS; k++) {
      const a = gridToWorld(0, k);
      const b = gridToWorld(COLS, k);
      g.lineBetween(a.x, a.y, b.x, b.y);
    }

    const service = isPlaceTool(tool) && tool !== 'road' ? serviceOf(tool) : null;
    if (tool === 'house') this.fillCells(this.coverageCells(s, s.coverage.sacred), C.gold, 0.14);
    if (service) this.fillCells(this.coverageCells(s, s.coverage[service]), C.need[service], 0.16);

    if (tool === 'temple') this.fillCells(this.templeArea(s), C.fits, 0.4);

    if (!hover) return;
    const o = originFor(tool, hover, rotated);
    const { w, h } = toolDims(tool, rotated);
    if (service && isPlaceTool(tool) && tool !== 'road') {
      const r = BUILDINGS[tool].radius ?? 0;
      const x0 = Math.max(0, o.x - r);
      const y0 = Math.max(0, o.y - r);
      const x1 = Math.min(COLS, o.x + w + r);
      const y1 = Math.min(ROWS, o.y + h + r);
      const area = rectCorners(x0, y0, x1 - x0, y1 - y0);
      g.fillStyle(C.need[service], 0.12);
      g.fillPoints(area, true);
      g.lineStyle(3, C.need[service], 0.9);
      g.strokePoints(area, true, true);
    }
    const ok = (isPlaceTool(tool) ? checkPlace(s, tool, o.x, o.y, rotated) : checkClear(s, o.x, o.y)).ok;
    const color = ok ? 0xfff3b0 : C.famine;
    this.fillCells(footprint(o.x, o.y, w, h), color, 0.3);
    g.lineStyle(2, color, 0.9);
    g.strokePoints(rectCorners(o.x, o.y, w, h), true, true);
    if (!isPlaceTool(tool)) return;
    const key = tool === 'road' ? roadKey(s, o.x, o.y) : keyOf({ kind: tool, ...o, w, h });
    const c = footCenter(o.x, o.y, w, h);
    setTex(this.preview, key).setPosition(c.x, c.y).setAlpha(0.7).setVisible(true);
    if (ok) this.preview.clearTint();
    else this.preview.setTint(0xff6a5a);
  }

  // ---------- per-frame animation ----------

  /**
   * `zoom` keeps balloons readable when zoomed out: they never shrink below ~1.2x / zoom on screen.
   * `workDt` is the frame time in seconds times the game speed (0 when paused).
   */
  update(time: number, zoom: number, workDt: number) {
    const t = time / 1000;
    this.work += workDt;
    const balloonScale = Math.max(1, BALLOON_SCREEN_SCALE / zoom);
    this.drawWater(t);
    for (const v of this.views.values()) {
      v.wheat.forEach((w, k) => w.setAngle(Math.sin(t * 2.2 + k * 0.7 + v.root.x * 0.05) * 7));
      v.crew?.update(this.work);
      if (v.glow) {
        const f = Math.sin(t * 14 + v.root.x) * 0.08 + Math.sin(t * 23) * 0.05;
        const k = PARTS.altarFire.scale;
        v.flame?.setScale(k * (1 - f * 0.6), k * (1 + f));
        v.glow.setAlpha(0.45 + f);
      }
    }
    for (const b of this.balloons.values()) {
      b.root.y = b.baseY + Math.sin(t * 3 + b.phase) * 2;
      b.root.setScale(balloonScale);
    }
  }

  /** Ripples drifting downstream (south) along the river. */
  private drawWater(t: number) {
    const g = this.water;
    g.clear();
    for (const { x, y } of this.riverCells) {
      const h = cellHash(x, y);
      const o = (t * 0.35 + (h % 100) / 100) % 1;
      const gx = x + 0.25 + ((h >> 8) % 50) / 100;
      const a = gridToWorld(gx, y + o);
      const b = gridToWorld(gx, y + Math.min(1, o + 0.22));
      g.lineStyle(1.6, C.waterLight, 0.75 * Math.sin(o * Math.PI));
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
  }
}
