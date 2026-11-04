import Phaser from 'phaser';
import {
  type Economy,
  isWorking,
  balloonNeed,
  needLocked,
  BUILDINGS,
  checkClear,
  checkPlace,
  computeEconomy,
  footprint,
  indexOf,
  placeSize,
  roadMask,
  serviceOf,
  placeSpots,
  plazaHouseSpots,
  servedHouses,
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
  byRiver,
  foodCapacity,
} from '../core';
import { C, CSS, shade } from './palette';
import { T } from './strings';
import { text } from './ui';
import { COLS, DEPTH, HH, HW, ROWS, cellHash, depthAt, footCenter, fromView, gridToWorld, rectCorners, viewDims, viewMask, viewToWorld } from './iso';
import VISUAL from '../data/visual.json';
import { GRANARY_STOCKS, HEIGHT, PARTS, TEX, VARIANTS, cropImages, hasSnowTexture, scaffoldTexture, setTex, snowTexture } from './textures';
import type { RoadWear } from './RoadWear';
import { mixColor, mulColor, treeKind, type CropStage, type SeasonLook, type TreeKind, type TreeState } from './Seasons';
import { isPlaceTool, type Tool } from './tools';
import { FieldCrew } from './Fieldhands';
import { Lights } from './Lights';

/** Tutorial hints on the tool overlay. */
export interface OverlayGuide {
  ghost: Cell[];
  houseSpots: boolean;
}

interface BuildingView {
  kind: BuildingKind;
  root: Phaser.GameObjects.Container;
  main: Phaser.GameObjects.Image;
  /** Texture of the finished drawing without snow, and the house shade of mud or stone. */
  key: string;
  shade: number;
  /** Wheat or barley: the crop changes colour with the year (the other crops only grow and wither). */
  grain: boolean;
  wheat: Phaser.GameObjects.Image[];
  /** Field stage shown, and whether the field touches the river (a drought does not thin it). */
  stage?: CropStage;
  byRiver?: boolean;
  /** Farmers working in a field. */
  crew?: FieldCrew;
  flame?: Phaser.GameObjects.Image;
  glow?: Phaser.GameObjects.Image;
  smoke?: Phaser.GameObjects.Particles.ParticleEmitter;
  /** House level shown (a level up shows the scaffold first). */
  level: number;
  /** Scaffold while the building goes up; the finished drawing is hidden until it is done. */
  scaffold?: { img: Phaser.GameObjects.Image; timer: Phaser.Time.TimerEvent };
}

interface Balloon {
  need: BalloonKind;
  root: Phaser.GameObjects.Container;
  icon: Phaser.GameObjects.Image;
  /** Small lock over the icon while the need's building is still locked. */
  lock: Phaser.GameObjects.Image;
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

/** Houses get a small per-plot nudge and a slightly different shade of mud or stone (returned). */
function applyLook(img: Phaser.GameObjects.Image, b: Building): number {
  if (b.kind !== 'house') return 0xffffff;
  const h = cellHash(b.x, b.y);
  const grey = Math.round(255 * (0.9 + ((h >>> 5) % 11) * 0.01));
  img.setPosition((h % 5) - 2, ((h >>> 3) % 3) - 1);
  return (grey << 16) | (grey << 8) | grey;
}

const SV = VISUAL.seasons;
const MOMENTS = VISUAL.moments;

/** Stages that tint every crop; the others (green, ripe, gold) only tint wheat and barley. */
const ALL_CROPS: ReadonlySet<CropStage> = new Set<CropStage>(['plowed', 'sprout', 'young', 'straw', 'dry']);
/** Stages a drought turns thin and yellow on fields away from the river. */
const THIRSTY: ReadonlySet<CropStage> = new Set<CropStage>(['green', 'ripe', 'gold', 'straw']);

/** Granary drawing for the share of the stores in use: empty, a third, two thirds or full. */
export function granaryStock(s: GameState): number {
  const f = s.food / Math.max(1, foodCapacity(s));
  const k = MOMENTS.granaryStock.findIndex((t) => f < t);
  return k < 0 ? GRANARY_STOCKS - 1 : k;
}
const WEATHER = SV.weather;
const WET_TINT = Number(WEATHER.wetTint);
const CROP_STAGES = Object.fromEntries(Object.entries(SV.crops.stages).map(([k, v]) => [k, { tint: Number(v.tint), scale: v.scale }])) as Record<CropStage, { tint: number; scale: number }>;
/** Snow lies on roofs and trees once the cover passes this, and lies on a ground cell past its own threshold. */
const ROOF_SNOW = 0.35;
/** Snowy copies of building and tree textures drawn per frame at most (they are made on first use). */
const SNOW_BUDGET = 3;

/** A ground cell and what it shows now (texture class and tint). */
interface Tile {
  img: Phaser.GameObjects.Image;
  ground: 'sand' | 'grass' | 'river';
  v: number;
  deco: boolean;
  /** 0..1: when this cell changes in a blend (so changes spread over the map). */
  turn: number;
  /** River cells on the bank (1 = the first, 2 = the next where the river is wide) dry to mud in a drought. */
  bank: number;
  show: 'sand' | 'grass' | 'snow' | 'mud' | 'river';
  key: string;
}

interface FeatureView {
  key: string;
  img: Phaser.GameObjects.Image;
  sway: number;
  tree: TreeKind;
}

/** Road texture for a cell, with its junctions turned to the current view. */
const roadKey = (s: GameState, x: number, y: number, wear = 0) => TEX.road(viewMask(roadMask(s, x, y)), wear);

export class MapView {
  private features = new Map<number, FeatureView>();
  private roads = new Map<number, Phaser.GameObjects.Image>();
  /** Puddles on some road cells, shown after rain. */
  private puddles = new Map<number, Phaser.GameObjects.Image>();
  private views = new Map<number, BuildingView>();
  private balloons = new Map<number, Balloon>();
  private riverCells: (Cell & { tile: Tile })[] = [];
  private water: Phaser.GameObjects.Graphics;
  /** Dashed marks over roads that are not connected to the altar. */
  private looseRoads: Phaser.GameObjects.Graphics;
  private overlay: Phaser.GameObjects.Graphics;
  private preview: Phaser.GameObjects.Image;
  /** "Atende N casas" above the preview of a plaza, market or park. */
  private serves: Phaser.GameObjects.Text;
  /** Game-speed clock in seconds for work animations (stops when paused). */
  private work = 0;
  /** Ground tiles, diorama sides and river banks (rebuilt only with the whole view). */
  private ground: Phaser.GameObjects.GameObject[] = [];
  private tiles: Tile[] = [];
  /** The season look and wetness last applied: nothing is redone until they change. */
  private look: SeasonLook | null = null;
  private wetStep = -1;
  private puddleStep = -1;
  /** Colours applied now: roads, trees, rocks and buildings (wet roofs are darker), puddle alpha. */
  private tints = { road: 0xffffff, trees: 0xffffff, rock: 0xffffff, build: 0xffffff, sand: 0xffffff, water: 0xffffff, ripple: C.waterLight };
  private puddleAlpha = 0;
  private trees: Record<'almond' | 'fig', TreeState> = { almond: 'leaf', fig: 'leaf' };
  /** Crop stage of the year for sown fields, and whether the drought thins the thirsty ones. */
  private crop: CropStage = 'gold';
  private dry = false;
  /** The state last synced (fields read their sowing week, the granary the stores). */
  private state: GameState;
  /** Granary drawing for the stores now (see granaryStock). */
  private stock = 0;
  /** Snow on roofs and trees; `snowDirty` while some still have to swap their texture. */
  private snowy = false;
  private snowDirty = false;
  /** Chimney smoke over the houses (thicker in winter), from one emitter. */
  private smoke: Phaser.GameObjects.Particles.ParticleEmitter;
  private chimneys: { x: number; y: number }[] = [];
  private smokeShare = 0;
  private lights: Lights;
  /** Set when the frame rate stayed low: no campfire sparks. */
  degraded = false;
  /** False during the first sync: buildings already standing appear without a scaffold. */
  private ready = false;
  private dust: Phaser.GameObjects.Particles.ParticleEmitter;
  /** Worn dirt paths between neighbouring houses (under everything but the ground). */
  private trails: Phaser.GameObjects.Graphics;
  /** Building under the demolish tool (tinted red, pulsing), and the places that would solve a need. */
  private demolishId: number | null = null;
  private solve: Phaser.GameObjects.Graphics;

  constructor(
    private scene: Phaser.Scene,
    state: GameState,
    private wear: RoadWear,
  ) {
    this.state = state;
    this.drawGround(state);
    this.water = scene.add.graphics().setDepth(DEPTH.groundFx);
    this.looseRoads = scene.add.graphics().setDepth(DEPTH.road + 0.5);
    this.trails = scene.add.graphics().setDepth(DEPTH.road - 0.5);
    this.overlay = scene.add.graphics().setDepth(DEPTH.overlay);
    this.solve = scene.add.graphics().setDepth(DEPTH.overlay + 0.5).setVisible(false);
    this.preview = scene.add.image(0, 0, TEX.building('house')).setDepth(DEPTH.preview).setVisible(false);
    this.serves = text(scene, 0, 0, '', 18, CSS.light, true).setOrigin(0.5, 1).setStroke(CSS.ink, 5).setDepth(DEPTH.preview + 1).setVisible(false);
    this.lights = new Lights(scene);
    this.dust = scene.add
      .particles(0, 0, TEX.soft, {
        lifespan: 900,
        speed: { min: 10, max: 40 },
        angle: { min: 200, max: 340 },
        scale: { start: 0.5, end: 1.4 },
        alpha: { start: 0.5, end: 0 },
        tint: C.sand[0],
        emitting: false,
      })
      .setDepth(DEPTH.fx);
    const chimney = new Phaser.Geom.Point();
    this.smoke = scene.add
      .particles(0, 0, TEX.soft, {
        lifespan: 3200,
        speedY: { min: -22, max: -12 },
        speedX: { min: 5, max: 16 },
        scale: { start: 0.5, end: 1.7 },
        alpha: { start: 0.85, end: 0 },
        tint: 0xd6d2ca,
        frequency: 1000,
        emitting: false,
        emitZone: {
          type: 'random',
          source: {
            getRandomPoint: (p: Phaser.Types.Math.Vector2Like) => {
              const c = this.chimneys[Math.floor(Math.random() * this.chimneys.length)] ?? chimney;
              p.x = c.x + (Math.random() - 0.5) * 6;
              p.y = c.y;
              return p;
            },
          },
        } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      })
      .setDepth(DEPTH.fx);
    this.sync(state, computeEconomy(state));
    this.ready = true;
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
        const c = footCenter(x, y);
        const h = cellHash(x, y);
        const deco = g !== 'river' && ((h >>> 8) % 1000) / 1000 < VISUAL.ambient.decoShare;
        const key = TEX.ground(g, h % VARIANTS, deco);
        const img = sc.add.image(c.x, c.y, key).setDepth(DEPTH.ground);
        this.ground.push(img);
        const land = (dx: number) => x - dx >= 0 && s.ground[indexOf(s, x - dx, y)] !== 'river';
        const wide = x + 2 < s.cols && s.ground[indexOf(s, x + 2, y)] === 'river';
        const bank = g !== 'river' ? 0 : land(1) ? 1 : land(2) && wide ? 2 : 0;
        const tile: Tile = { img, ground: g, v: h % VARIANTS, deco, turn: ((h >>> 16) % 1000) / 1000, bank, show: g, key };
        this.tiles.push(tile);
        if (g === 'river') this.riverCells.push({ x, y, tile });
      }
    }
    // Light sandy bank where land meets the river (on both sides: there is land east of it too).
    const bank = sc.add.graphics().setDepth(DEPTH.ground);
    this.ground.push(bank);
    bank.lineStyle(5, C.bank, 0.9);
    for (const { x, y } of this.riverCells) {
      for (const [dx, edge] of [[-1, x], [1, x + 1]]) {
        const nx = x + dx;
        if (nx < 0 || nx >= s.cols || s.ground[indexOf(s, nx, y)] === 'river') continue;
        const a = gridToWorld(edge, y);
        const b = gridToWorld(edge, y + 1);
        bank.lineBetween(a.x, a.y, b.x, b.y);
      }
    }
  }

  /** Removes everything this view drew (used to rebuild it after turning the map). */
  destroy() {
    for (const o of this.ground) o.destroy();
    for (const f of this.features.values()) f.img.destroy();
    for (const r of this.roads.values()) r.destroy();
    for (const r of this.puddles.values()) r.destroy();
    this.smoke.destroy();
    for (const v of this.views.values()) this.destroyView(v);
    for (const b of this.balloons.values()) b.root.destroy();
    [this.water, this.looseRoads, this.trails, this.overlay, this.solve, this.preview, this.serves].forEach((o) => o.destroy());
    this.lights.destroyAll();
    this.dust.destroy();
  }

  // ---------- sync with the simulation ----------

  sync(s: GameState, eco: Economy) {
    this.state = s;
    this.stock = granaryStock(s);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        this.syncFeature(s, x, y);
        this.syncRoad(s, x, y);
      }
    }
    this.drawLooseRoads(s);
    this.drawTrails(s);
    const alive = new Set<number>();
    // Farmers per field follow the share of jobs filled; none on a field without a road or out of its harvest.
    const farmers = Math.round(BUILDINGS.field.jobs * eco.efficiency);
    for (const b of s.buildings) {
      alive.add(b.id);
      this.syncBuilding(b);
      const v = this.views.get(b.id)!;
      v.crew?.setCount(b.connected && isWorking(b, s.week) ? farmers : 0);
      if (v.kind === 'field') this.paintCrop(v);
      this.syncBalloon(s, b, eco);
    }
    for (const [id, v] of this.views) {
      if (alive.has(id)) continue;
      this.destroyView(v);
      this.views.delete(id);
      this.balloons.get(id)?.root.destroy();
      this.balloons.delete(id);
    }
    this.lights.sync(s, (b) => HEIGHT[keyOf(b)] ?? 20, this.degraded);
    this.chimneys = s.buildings
      .filter((b) => b.kind === 'house')
      .map((b) => {
        const c = footCenter(b.x, b.y, b.w, b.h);
        return { x: c.x, y: c.y - (HEIGHT[keyOf(b)] ?? 20) * 0.85 };
      });
    this.paintSmoke();
  }

  /** Texture of a tree or rock: almonds and figs follow the year. */
  private featureKey(tree: TreeKind, x: number, y: number) {
    const v = cellHash(x, y) % VARIANTS;
    return tree === 'almond' || tree === 'fig' ? TEX.tree(tree, v, this.trees[tree]) : TEX.feature(tree, v);
  }

  private syncFeature(s: GameState, x: number, y: number) {
    const i = indexOf(s, x, y);
    const f = s.feature[i];
    const tree = f ? treeKind(f, x, y) : null;
    const key = tree ? this.featureKey(tree, x, y) : null;
    const cur = this.features.get(i);
    if (cur?.key === key) return;
    cur?.img.destroy();
    this.features.delete(i);
    if (!key || !tree) return;
    const c = footCenter(x, y);
    // Palms sway more than the other trees in the light wind; rocks stay still.
    const sway = tree === 'palm' ? 1.6 : tree === 'rock' || tree === 'stump' ? 0 : 0.7;
    const img = setTex(this.scene.add.image(c.x, c.y, key), this.dress(key)).setDepth(depthAt(x + 0.5, y + 0.5));
    img.setTint(sway ? this.tints.trees : this.tints.rock);
    this.features.set(i, { key, img, sway, tree });
  }

  /** The texture to show for a drawing: its snowy copy while snow lies, once it is drawn. */
  private dress(key: string) {
    if (!this.snowy) return key;
    if (hasSnowTexture(this.scene, key)) return `${key}-snow`;
    this.snowDirty = true;
    return key;
  }

  private syncRoad(s: GameState, x: number, y: number) {
    const i = indexOf(s, x, y);
    const cur = this.roads.get(i);
    if (!s.roads[i]) {
      cur?.destroy();
      this.roads.delete(i);
      this.puddles.get(i)?.destroy();
      this.puddles.delete(i);
      return;
    }
    const key = roadKey(s, x, y, this.wear.level(s, x, y));
    const alpha = s.network[i] ? 1 : 0.45;
    if (cur) {
      if (cur.texture.key !== key) cur.setTexture(key);
      cur.setAlpha(alpha);
      return;
    }
    const c = footCenter(x, y);
    this.roads.set(i, this.scene.add.image(c.x, c.y, key).setDepth(DEPTH.road).setAlpha(alpha).setTint(this.tints.road));
    const h = cellHash(x, y);
    if (((h >>> 10) % 1000) / 1000 < WEATHER.puddleShare) {
      const p = this.scene.add.image(c.x, c.y, TEX.puddle(h % VARIANTS)).setDepth(DEPTH.road + 0.2);
      this.puddles.set(i, p.setAlpha(this.puddleAlpha).setVisible(this.puddleAlpha > 0));
    }
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

  /** A faint trodden path between houses that stand 1 to 3 cells apart. */
  private drawTrails(s: GameState) {
    const g = this.trails.clear();
    const houses = s.buildings.filter((b) => b.kind === 'house');
    for (let i = 0; i < houses.length; i++) {
      for (let j = i + 1; j < houses.length; j++) {
        const a = houses[i];
        const b = houses[j];
        const gap = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), b.y - (a.y + a.h), a.y - (b.y + b.h));
        if (gap < 1 || gap > 3) continue;
        const p = footCenter(a.x, a.y, a.w, a.h);
        const q = footCenter(b.x, b.y, b.w, b.h);
        g.lineStyle(7, C.earthLit, 0.22);
        g.lineBetween(p.x, p.y, q.x, q.y);
        g.lineStyle(3, C.earthDark, 0.12);
        g.lineBetween(p.x, p.y, q.x, q.y);
      }
    }
  }

  private syncBuilding(b: Building) {
    let v = this.views.get(b.id);
    if (!v) {
      v = this.createView(b);
      this.views.set(b.id, v);
    }
    const key = this.keyFor(b);
    if (v.key !== key) {
      // A house going up a level shows the scaffold briefly, then its new drawing.
      if (this.ready && b.kind === 'house' && b.level > v.level && !v.scaffold) this.raise(v, b, VISUAL.build.upgradeMs);
      v.key = key;
      if (!v.scaffold) setTex(v.main, this.dress(key));
    }
    v.level = b.level;
    v.shade = applyLook(v.main, b);
    v.main.setTint(mulColor(v.shade, this.tints.build));
  }

  /** Hides a building behind a wooden scaffold with dust for `ms`, then shows it with a little bounce. */
  private raise(v: BuildingView, b: Building, ms: number) {
    const { w, h } = viewDims(b.w, b.h);
    const key = scaffoldTexture(this.scene, w, h);
    const parts = v.root.list as (Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible)[];
    parts.forEach((o) => o.setVisible(false));
    const img = setTex(this.scene.add.image(0, 0, key), key);
    v.root.add(img);
    this.puff(v.root.x, v.root.y, b.w * b.h);
    const timer = this.scene.time.delayedCall(ms, () => {
      img.destroy();
      v.scaffold = undefined;
      parts.forEach((o) => o.active && o.setVisible(true));
      setTex(v.main, this.dress(v.key));
      applyLook(v.main, b);
      this.puff(v.root.x, v.root.y, b.w * b.h);
      this.scene.tweens.add({ targets: v.root, scaleY: { from: 0.9, to: 1 }, duration: 220, ease: 'Back.easeOut' });
    });
    v.scaffold = { img, timer };
  }

  private puff(x: number, y: number, cells: number) {
    this.dust.explode(Math.min(14, 4 + cells), x, y);
  }

  /** Texture of a standing building: the granary shows the stores. */
  private keyFor(b: Building) {
    return b.kind === 'granary' ? TEX.building('granary', 0, false, this.stock) : keyOf(b);
  }

  private createView(b: Building): BuildingView {
    const sc = this.scene;
    const c = footCenter(b.x, b.y, b.w, b.h);
    const key = this.keyFor(b);
    const root = sc.add.container(c.x, c.y).setDepth(depthAt(b.x + b.w / 2, b.y + b.h / 2));
    const main = setTex(sc.add.image(0, 0, key), this.dress(key));
    root.add(main);
    const grain = b.kind === 'field' && SV.crops.grains.includes(b.variant ?? 0);
    const view: BuildingView = { kind: b.kind, root, main, key, shade: 0xffffff, grain, wheat: [], level: b.level };
    if (b.kind === 'field') {
      view.wheat = cropImages(sc, 0, 0, 1, b.variant, b.mirrored);
      view.byRiver = byRiver(this.state, b);
      this.paintCrop(view);
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
    if (this.ready) this.raise(view, b, VISUAL.build.scaffoldMs);
    return view;
  }

  private destroyView(v: BuildingView) {
    v.scaffold?.timer.remove();
    this.scene.tweens.killTweensOf(v.root);
    v.smoke?.destroy();
    v.root.destroy();
  }

  private syncBalloon(s: GameState, b: Building, eco: Economy) {
    const need = balloonNeed(s, b, eco);
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
      cur.lock.setVisible(needLocked(s, need));
      return;
    }
    const sc = this.scene;
    const bg = sc.add.image(0, 0, TEX.balloon).setOrigin(0.5, 1);
    const icon = sc.add.image(0, -16, TEX.need(need)).setScale(0.8);
    const lock = sc.add.image(8, -9, TEX.uiIcon('lock')).setDisplaySize(12, 12).setVisible(needLocked(s, need));
    const root = sc.add.container(c.x + 6, baseY, [bg, icon, lock]).setDepth(DEPTH.fx + 1);
    this.balloons.set(b.id, { need, root, icon, lock, baseY, phase: cellHash(b.x, b.y) % 100 });
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

  /** Height of a building's drawing in px (effects above it). */
  heightOf(b: Building) {
    return HEIGHT[this.keyFor(b)] ?? 20;
  }

  /** A warm glow over a building's drawing (milestones): an additive gold copy that pulses a few times. */
  shine(id: number) {
    const v = this.views.get(id);
    if (!v) return;
    const m = v.main;
    const img = this.scene.add.image(m.x, m.y, m.texture.key).setOrigin(m.originX, m.originY).setTint(C.milestone).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    v.root.add(img);
    const ms = VISUAL.moments.milestoneSeconds * 1000;
    this.scene.tweens.add({ targets: img, alpha: 0.5, duration: ms / 6, yoyo: true, repeat: 2, ease: 'Sine.easeInOut', onComplete: () => img.destroy() });
  }

  /**
   * Tints a building red (pulsing) to show it is the one the demolish tool would remove; null puts
   * the last one back. Only the drawing is tinted: crops and fires keep their colours.
   */
  highlightDemolish(b: Building | null) {
    const id = b?.id ?? null;
    if (id === this.demolishId) return;
    const old = this.demolishId !== null ? this.views.get(this.demolishId) : undefined;
    if (old) old.main.setTint(mulColor(old.shade, this.tints.build));
    this.demolishId = id;
  }

  /**
   * Shows the places that would solve a need (e.g. where a market would reach a house): the union of
   * these grid rectangles in a soft gold-green that pulses, with a light edge. Replaces the last ones.
   */
  showSpots(rects: readonly Rect[]) {
    const g = this.solve;
    g.clear();
    const cells = new Set<number>();
    for (const r of rects) for (const c of footprint(r.x, r.y, r.w, r.h)) cells.add(c.y * COLS + c.x);
    const list = [...cells].map((i) => ({ x: i % COLS, y: Math.floor(i / COLS) }));
    g.fillStyle(C.solve.fill, 0.42);
    for (const c of list) g.fillPoints(rectCorners(c.x, c.y, 1, 1), true);
    // The edge of the area: a wide soft line and a thin bright one.
    const edges: [number, number, number, number, number, number][] = [
      [0, -1, 0, 0, 1, 0],
      [1, 0, 1, 0, 1, 1],
      [0, 1, 0, 1, 1, 1],
      [-1, 0, 0, 0, 0, 1],
    ];
    for (const [width, color, alpha] of [[6, C.solve.edge, 0.45], [2, C.solve.glow, 1]] as const) {
      g.lineStyle(width, color, alpha);
      for (const c of list) {
        for (const [dx, dy, x0, y0, x1, y1] of edges) {
          if (cells.has((c.y + dy) * COLS + c.x + dx) && c.x + dx >= 0 && c.x + dx < COLS) continue;
          const a = gridToWorld(c.x + x0, c.y + y0);
          const b = gridToWorld(c.x + x1, c.y + y1);
          g.lineBetween(a.x, a.y, b.x, b.y);
        }
      }
    }
    g.setVisible(list.length > 0);
  }

  clearSpots() {
    this.solve.clear().setVisible(false);
  }

  // ---------- tool overlay ----------

  private fillCells(cells: Iterable<Cell>, color: number, alpha: number) {
    const g = this.overlay;
    g.fillStyle(color, alpha);
    for (const c of cells) g.fillPoints(rectCorners(c.x, c.y, 1, 1), true);
  }

  /**
   * Free spots in green with a light dotted outline around the area, so they read over the
   * green grass of winter and spring as well as over sand and dry grass.
   */
  private spots(cells: Cell[]) {
    this.fillCells(cells, C.fits, 0.45);
    const inside = new Set(cells.map((c) => c.y * COLS + c.x));
    const g = this.overlay;
    g.lineStyle(2, C.cream, 0.95);
    const edges: [number, number, number, number, number, number][] = [
      [0, -1, 0, 0, 1, 0],
      [1, 0, 1, 0, 1, 1],
      [0, 1, 0, 1, 1, 1],
      [-1, 0, 0, 0, 0, 1],
    ];
    for (const c of cells) {
      for (const [dx, dy, x0, y0, x1, y1] of edges) {
        const nx = c.x + dx;
        const ny = c.y + dy;
        if (nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS && inside.has(ny * COLS + nx)) continue;
        for (let t = 0.1; t < 1; t += 0.3) {
          const a = gridToWorld(c.x + x0 + (x1 - x0) * t, c.y + y0 + (y1 - y0) * t);
          const b = gridToWorld(c.x + x0 + (x1 - x0) * (t + 0.15), c.y + y0 + (y1 - y0) * (t + 0.15));
          g.lineBetween(a.x, a.y, b.x, b.y);
        }
      }
    }
  }

  /** Cells covered by every spot where a building of this kind fits next to the network. */
  private spotsArea(s: GameState, kind: 'temple' | 'house'): Cell[] {
    const seen = new Set<number>();
    const { w, h } = dimsOf(kind);
    // The tutorial's house spots are the ones a plaza reaches (a tent there becomes a mud house).
    const spots = kind === 'house' ? plazaHouseSpots(s) : placeSpots(s, kind);
    for (const o of spots) for (const c of footprint(o.x, o.y, w, h)) seen.add(indexOf(s, c.x, c.y));
    return [...seen].map((i) => ({ x: i % s.cols, y: Math.floor(i / s.cols) }));
  }

  private coverageCells(s: GameState, covered: boolean[]): Cell[] {
    const out: Cell[] = [];
    covered.forEach((on, i) => on && out.push({ x: i % s.cols, y: Math.floor(i / s.cols) }));
    return out;
  }

  /**
   * Draws the tool overlay. `guide` (tutorial) adds a suggested road and, for houses, the free spots
   * next to the network in green.
   */
  showOverlay(s: GameState, tool: Tool, hover: Cell | null, selected: Cell | null, rotated = false, guide: OverlayGuide | null = null) {
    const g = this.overlay;
    g.clear();
    this.preview.setVisible(false);
    this.serves.setVisible(false);
    if (guide?.ghost.length) {
      const ghost = guide.ghost.filter((c) => !s.roads[indexOf(s, c.x, c.y)]);
      this.fillCells(ghost, C.ui.goldLight, 0.45);
      g.lineStyle(2, C.ui.goldDark, 0.9);
      for (const c of ghost) g.strokePoints(rectCorners(c.x, c.y, 1, 1), true, true);
    }

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
    if (tool === 'house') this.fillCells(this.coverageCells(s, s.coverage.plaza), C.need.plaza, 0.14);
    if (service) this.fillCells(this.coverageCells(s, s.coverage[service]), C.need[service], 0.16);

    if (tool === 'temple') this.spots(this.spotsArea(s, 'temple'));
    if (tool === 'house' && guide?.houseSpots) this.spots(this.spotsArea(s, 'house'));

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
      // The houses it would serve, outlined, and how many above the preview.
      const served = servedHouses(s, tool, o.x, o.y, rotated);
      g.lineStyle(3, C.need[service], 1);
      for (const b of served) g.strokePoints(rectCorners(b.x, b.y, b.w, b.h), true, true);
      const top = footCenter(o.x, o.y, w, h);
      this.serves
        .setText(T.serves(served.length))
        .setPosition(top.x, top.y - (HEIGHT[keyOf({ kind: tool, ...o, w, h })] ?? 40) - 6)
        .setVisible(true);
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

  /**
   * The season and the weather on the map. Grass and sand cells take the next season's texture
   * once the blend passes their own threshold (so the change spreads over the map), and snow, a
   * drought's cracked earth and the dry river bank spread the same way; roads, trees, the river
   * and the buildings get the season's colours and darken while wet; puddles fill the roads after
   * rain. Only redone when the look (quantized in time) or the quantized wetness changes.
   */
  setSeason(look: SeasonLook, wet: number, puddles: number) {
    const wetStep = Math.round(wet * WEATHER.wetSteps);
    const puddleStep = Math.round(puddles * WEATHER.wetSteps);
    const prev = this.look;
    if (look === prev && wetStep === this.wetStep && puddleStep === this.puddleStep) return;
    this.look = look;
    const ground = look.groundKey !== prev?.groundKey;
    if (ground) for (const t of this.tiles) this.pickTile(t, look);
    if (puddleStep !== this.puddleStep) {
      this.puddleStep = puddleStep;
      this.puddleAlpha = puddleStep / WEATHER.wetSteps;
      for (const p of this.puddles.values()) p.setAlpha(this.puddleAlpha).setVisible(this.puddleAlpha > 0);
    }
    const snowy = look.snow > ROOF_SNOW;
    const trees = look.almond !== this.trees.almond || look.fig !== this.trees.fig;
    if (snowy !== this.snowy || trees) {
      this.snowy = snowy;
      this.trees = { almond: look.almond, fig: look.fig };
      this.redress();
    }
    const dry = look.drought > 0.5;
    if (look.crop !== this.crop || dry !== this.dry) {
      this.crop = look.crop;
      this.dry = dry;
      for (const b of this.state.buildings) {
        const v = b.kind === 'field' ? this.views.get(b.id) : undefined;
        if (v) this.paintCrop(v);
      }
    }
    if (look !== prev || wetStep !== this.wetStep || ground) {
      this.wetStep = wetStep;
      this.paintTints(look);
    }
    this.paintSmoke();
  }

  /** Texture of a ground cell for the look. */
  private pickTile(t: Tile, look: SeasonLook) {
    let show: Tile['show'] = t.ground;
    let key: string;
    if (t.ground === 'river') {
      const dry = t.bank === 1 ? look.drought > t.turn * 0.6 : t.bank === 2 && look.drought > 0.6 + t.turn * 0.4;
      show = dry ? 'mud' : 'river';
      key = show === 'mud' ? TEX.mud(t.v) : TEX.ground('river', t.v);
    } else if (look.snow > t.turn) {
      show = 'snow';
      key = TEX.snowGround(t.v, t.deco);
    } else {
      const state = look.drought > t.turn ? 'drought' : look.f > t.turn ? look.next : look.season;
      key = (t.ground === 'grass' ? TEX.grass : TEX.sand)(state, t.v, t.deco);
    }
    t.show = show;
    if (key !== t.key) t.img.setTexture((t.key = key));
  }

  /** Re-tints the ground, roads, trees and buildings for the look and the wetness. */
  private paintTints(look: SeasonLook) {
    const wet = mixColor(0xffffff, WET_TINT, this.wetStep / WEATHER.wetSteps);
    const t = this.tints;
    t.sand = wet;
    t.water = look.water;
    t.ripple = look.ripple;
    t.road = mulColor(look.road, wet);
    t.rock = wet;
    t.trees = mulColor(look.trees, mixColor(0xffffff, wet, 0.5));
    t.build = this.snowy ? 0xffffff : wet;
    for (const tile of this.tiles) {
      const tint = tile.show === 'river' ? t.water : tile.show === 'snow' || tile.show === 'mud' ? 0xffffff : t.sand;
      if (tile.img.tintTopLeft !== tint) tile.img.setTint(tint);
    }
    for (const r of this.roads.values()) r.setTint(t.road);
    for (const f of this.features.values()) f.img.setTint(f.sway ? t.trees : t.rock);
    for (const v of this.views.values()) v.main.setTint(mulColor(v.shade, t.build));
  }

  /** Swaps trees and buildings to their texture for the year (snowy copies a few per frame, see update). */
  private redress() {
    for (const [i, f] of this.features) {
      const x = i % COLS;
      const y = Math.floor(i / COLS);
      const key = this.featureKey(f.tree, x, y);
      f.key = key;
      setTex(f.img, this.dress(key));
    }
    for (const v of this.views.values()) if (!v.scaffold) setTex(v.main, this.dress(v.key));
  }

  /** Draws the missing snowy copies, a few per frame, and puts them on. */
  private snowWork() {
    if (!this.snowDirty) return;
    let budget = SNOW_BUDGET;
    const take = (img: Phaser.GameObjects.Image, key: string) => {
      if (budget <= 0 || img.texture.key !== key) return;
      if (!hasSnowTexture(this.scene, key)) budget--;
      setTex(img, snowTexture(this.scene, key));
    };
    for (const f of this.features.values()) take(f.img, f.key);
    for (const v of this.views.values()) if (!v.scaffold) take(v.main, v.key);
    if (budget > 0) this.snowDirty = false;
  }

  /**
   * A field's crop for the year (looks only): it sprouts in autumn, is green in winter, golden in
   * spring and stubble in summer. In a drought the crops away from the river turn thin and yellow.
   */
  private fieldStage(v: BuildingView): CropStage {
    return this.dry && !v.byRiver && THIRSTY.has(this.crop) ? 'dry' : this.crop;
  }

  private paintCrop(v: BuildingView) {
    const stage = this.fieldStage(v);
    if (stage === v.stage) return;
    v.stage = stage;
    const st = CROP_STAGES[stage];
    const tint = v.grain || ALL_CROPS.has(stage) ? st.tint : 0xffffff;
    for (const w of v.wheat) w.setTint(tint).setScale(1, st.scale);
  }

  /** Chimney smoke: a little all year, from every house in winter. */
  private paintSmoke() {
    const per = (this.look?.smoke ?? 0) * WEATHER.smokePerHouse * (this.degraded ? 0.5 : 1);
    const rate = per * this.chimneys.length;
    const on = rate > 0.2;
    if (on && rate !== this.smokeShare) this.smoke.setFrequency(1000 / rate);
    this.smokeShare = rate;
    if (this.smoke.emitting !== on) this.smoke.emitting = on;
  }

  // ---------- per-frame animation ----------

  /**
   * `zoom` keeps balloons readable when zoomed out: they never shrink below ~1.2x / zoom on screen.
   * `workDt` is the frame time in seconds times the game speed (0 when paused); `night` 0..1.
   */
  update(time: number, zoom: number, workDt: number, night: number) {
    const t = time / 1000;
    this.work += workDt;
    const balloonScale = Math.max(1, BALLOON_SCREEN_SCALE / zoom);
    this.serves.setScale(balloonScale);
    this.drawWater(t);
    this.snowWork();
    this.lights.update(t, night);
    for (const f of this.features.values()) if (f.sway) f.img.setAngle(Math.sin(t * 1.3 + f.img.x * 0.03) * f.sway);
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
    if (this.solve.visible) this.solve.setAlpha(0.65 + Math.sin(t * 3.2) * 0.35);
    const doomed = this.demolishId !== null ? this.views.get(this.demolishId) : undefined;
    if (doomed) {
      const red = mixColor(C.demolish.soft, C.demolish.strong, 0.5 + Math.sin(t * 6) * 0.5);
      doomed.main.setTint(mulColor(mulColor(doomed.shade, this.tints.build), red));
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
    for (const { x, y, tile } of this.riverCells) {
      if (tile.show === 'mud') continue;
      const h = cellHash(x, y);
      const o = (t * 0.35 + (h % 100) / 100) % 1;
      const gx = x + 0.25 + ((h >>> 8) % 50) / 100;
      const a = gridToWorld(gx, y + o);
      const b = gridToWorld(gx, y + Math.min(1, o + 0.22));
      g.lineStyle(1.6, this.tints.ripple, 0.75 * Math.sin(o * Math.PI));
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
  }
}
