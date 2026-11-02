import Phaser from 'phaser';
import {
  balloonNeed,
  BUILDINGS,
  checkClear,
  checkPlace,
  footprint,
  indexOf,
  placeSize,
  roadMask,
  serviceOf,
  type Building,
  type BuildingKind,
  type Cell,
  type GameState,
  type NeedKind,
} from '../core';
import { C, shade } from './palette';
import { COLS, DEPTH, HH, HW, ROWS, cellHash, depthAt, footCenter, gridToWorld, rectCorners } from './iso';
import { HEIGHT, PARTS, TEX, VARIANTS, setTex } from './textures';
import { isPlaceTool, type Tool } from './tools';

interface BuildingView {
  kind: BuildingKind;
  root: Phaser.GameObjects.Container;
  main: Phaser.GameObjects.Image;
  wheat: Phaser.GameObjects.Image[];
  flame?: Phaser.GameObjects.Image;
  glow?: Phaser.GameObjects.Image;
  smoke?: Phaser.GameObjects.Particles.ParticleEmitter;
}

interface Balloon {
  need: NeedKind;
  root: Phaser.GameObjects.Container;
  icon: Phaser.GameObjects.Image;
  baseY: number;
  phase: number;
}

const local = (x: number, y: number, z = 0) => ({ x: (x - y) * HW, y: (x + y) * HH - z });

/** Origin (top-left) of a footprint centered on the hovered cell. */
export function originFor(kind: Tool, cell: Cell): Cell {
  const size = isPlaceTool(kind) ? placeSize(kind) : 1;
  const off = Math.floor((size - 1) / 2);
  return { x: cell.x - off, y: cell.y - off };
}

export class MapView {
  private features = new Map<number, { key: string; img: Phaser.GameObjects.Image }>();
  private roads = new Map<number, Phaser.GameObjects.Image>();
  private views = new Map<number, BuildingView>();
  private balloons = new Map<number, Balloon>();
  private riverCells: Cell[] = [];
  private water: Phaser.GameObjects.Graphics;
  private overlay: Phaser.GameObjects.Graphics;
  private preview: Phaser.GameObjects.Image;

  constructor(private scene: Phaser.Scene, state: GameState) {
    this.drawGround(state);
    this.water = scene.add.graphics().setDepth(DEPTH.groundFx);
    this.overlay = scene.add.graphics().setDepth(DEPTH.overlay);
    this.preview = scene.add.image(0, 0, TEX.building('house')).setDepth(DEPTH.preview).setVisible(false);
    this.sync(state);
  }

  private drawGround(s: GameState) {
    const sc = this.scene;
    // Diorama sides along the two front edges.
    const sides = sc.add.graphics().setDepth(DEPTH.ground);
    const depth = 26;
    for (let k = 0; k < COLS; k++) {
      const south = s.ground[indexOf(s, k, ROWS - 1)] === 'river' ? C.waterDeep : C.earthLit;
      sides.fillStyle(south);
      sides.fillPoints([gridToWorld(k, ROWS), gridToWorld(k + 1, ROWS), gridToWorld(k + 1, ROWS, -depth), gridToWorld(k, ROWS, -depth)], true);
    }
    for (let k = 0; k < ROWS; k++) {
      const east = s.ground[indexOf(s, COLS - 1, k)] === 'river' ? shade(C.waterDeep, 0.8) : C.earthDark;
      sides.fillStyle(east);
      sides.fillPoints([gridToWorld(COLS, k), gridToWorld(COLS, k + 1), gridToWorld(COLS, k + 1, -depth), gridToWorld(COLS, k, -depth)], true);
    }
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const g = s.ground[indexOf(s, x, y)];
        if (g === 'river') this.riverCells.push({ x, y });
        const c = footCenter(x, y);
        sc.add.image(c.x, c.y, TEX.ground(g, cellHash(x, y) % VARIANTS)).setDepth(DEPTH.ground);
      }
    }
    // Light sandy bank where land meets the river.
    const bank = sc.add.graphics().setDepth(DEPTH.ground);
    for (const { x, y } of this.riverCells) {
      if (x > 0 && s.ground[indexOf(s, x - 1, y)] !== 'river') {
        const a = gridToWorld(x, y);
        const b = gridToWorld(x, y + 1);
        bank.lineStyle(5, C.bank, 0.9);
        bank.lineBetween(a.x, a.y, b.x, b.y);
      }
    }
  }

  // ---------- sync with the simulation ----------

  sync(s: GameState) {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        this.syncFeature(s, x, y);
        this.syncRoad(s, x, y);
      }
    }
    const alive = new Set<number>();
    for (const b of s.buildings) {
      alive.add(b.id);
      this.syncBuilding(b);
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
    const key = TEX.road(roadMask(s, x, y));
    if (cur) {
      if (cur.texture.key !== key) cur.setTexture(key);
      return;
    }
    const c = footCenter(x, y);
    this.roads.set(i, this.scene.add.image(c.x, c.y, key).setDepth(DEPTH.road));
  }

  private syncBuilding(b: Building) {
    let v = this.views.get(b.id);
    if (!v) {
      v = this.createView(b);
      this.views.set(b.id, v);
    }
    const key = TEX.building(b.kind, b.level);
    if (v.main.texture.key !== key) setTex(v.main, key);
  }

  private createView(b: Building): BuildingView {
    const sc = this.scene;
    const c = footCenter(b.x, b.y, b.size);
    const root = sc.add.container(c.x, c.y).setDepth(depthAt(b.x + b.size / 2, b.y + b.size / 2));
    const key = TEX.building(b.kind, b.level);
    const main = setTex(sc.add.image(0, 0, key), key);
    root.add(main);
    const view: BuildingView = { kind: b.kind, root, main, wheat: [] };
    if (b.kind === 'field') {
      view.wheat = PARTS.wheat.map((w) => {
        const o = local(w.x, w.y);
        return sc.add.image(o.x, o.y + 2, TEX.wheat).setOrigin(0.5, 1);
      });
      root.add(view.wheat);
    }
    if (b.kind === 'altar') {
      const f = local(PARTS.altarFire.x, PARTS.altarFire.y, PARTS.altarFire.z);
      view.glow = sc.add.image(f.x, f.y - 4, TEX.soft).setTint(0xf6a03c).setAlpha(0.5).setScale(1.3);
      view.flame = sc.add.image(f.x, f.y + 1, TEX.flame).setOrigin(0.5, 1);
      root.add([view.glow, view.flame]);
    }
    if (b.kind === 'workshop') {
      const ch = local(PARTS.chimney.x, PARTS.chimney.y, PARTS.chimney.z);
      view.smoke = sc.add
        .particles(c.x + ch.x, c.y + ch.y, TEX.soft, {
          lifespan: 2000,
          speedY: { min: -24, max: -14 },
          speedX: { min: 2, max: 12 },
          scale: { start: 0.3, end: 0.9 },
          alpha: { start: 0.6, end: 0 },
          tint: 0xe4e0d8,
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
    const c = footCenter(b.x, b.y, b.size);
    const baseY = c.y - (HEIGHT[TEX.building(b.kind, b.level)] ?? 20) - 6;
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
    const groundY = footCenter(b.x, b.y, b.size).y;
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

  private coverageCells(s: GameState, covered: boolean[]): Cell[] {
    const out: Cell[] = [];
    covered.forEach((on, i) => on && out.push({ x: i % s.cols, y: Math.floor(i / s.cols) }));
    return out;
  }

  showOverlay(s: GameState, tool: Tool, hover: Cell | null, selected: Cell | null) {
    const g = this.overlay;
    g.clear();
    this.preview.setVisible(false);

    if (tool === 'view') {
      if (selected) {
        const b = s.grid[indexOf(s, selected.x, selected.y)];
        const area = b ? rectCorners(b.x, b.y, b.size, b.size) : rectCorners(selected.x, selected.y, 1, 1);
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

    if (!hover) return;
    const o = originFor(tool, hover);
    const size = isPlaceTool(tool) ? placeSize(tool) : 1;
    if (service && isPlaceTool(tool) && tool !== 'road') {
      const r = BUILDINGS[tool].radius ?? 0;
      const x0 = Math.max(0, o.x - r);
      const y0 = Math.max(0, o.y - r);
      const x1 = Math.min(COLS, o.x + size + r);
      const y1 = Math.min(ROWS, o.y + size + r);
      const area = rectCorners(x0, y0, x1 - x0, y1 - y0);
      g.fillStyle(C.need[service], 0.12);
      g.fillPoints(area, true);
      g.lineStyle(3, C.need[service], 0.9);
      g.strokePoints(area, true, true);
    }
    const ok = (isPlaceTool(tool) ? checkPlace(s, tool, o.x, o.y) : checkClear(s, o.x, o.y)).ok;
    const color = ok ? 0xfff3b0 : C.famine;
    this.fillCells(footprint(o.x, o.y, size), color, 0.3);
    g.lineStyle(2, color, 0.9);
    g.strokePoints(rectCorners(o.x, o.y, size, size), true, true);
    if (!isPlaceTool(tool)) return;
    const key = tool === 'road' ? TEX.road(roadMask(s, o.x, o.y)) : TEX.building(tool);
    const c = footCenter(o.x, o.y, size);
    setTex(this.preview, key).setPosition(c.x, c.y).setAlpha(0.7).setVisible(true);
    if (ok) this.preview.clearTint();
    else this.preview.setTint(0xff6a5a);
  }

  // ---------- per-frame animation ----------

  update(time: number) {
    const t = time / 1000;
    this.drawWater(t);
    for (const v of this.views.values()) {
      v.wheat.forEach((w, k) => w.setAngle(Math.sin(t * 2.2 + k * 0.7 + v.root.x * 0.05) * 7));
      if (v.flame) {
        const f = Math.sin(t * 14) * 0.08 + Math.sin(t * 23) * 0.05;
        v.flame.setScale(1 - f * 0.6, 1 + f);
        v.glow?.setAlpha(0.45 + f);
      }
    }
    for (const b of this.balloons.values()) b.root.y = b.baseY + Math.sin(t * 3 + b.phase) * 2;
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
