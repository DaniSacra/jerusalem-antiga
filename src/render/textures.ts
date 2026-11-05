/**
 * All art is generated here as named textures. To switch to sprite files later, load images
 * with the same keys (see TEX) and keep the anchors in ORIGIN / HEIGHT, then skip generateTextures().
 *
 * Drawing uses a tiny 3D pen: local grid units (x east, y south, tile = 1) plus z in pixels.
 * Light comes from the late-afternoon sun in the west: south faces (+y, left on screen) are lit,
 * east faces (+x, right on screen) are in shade, and shadows fall toward the east.
 */
import Phaser from 'phaser';
import VISUAL from '../data/visual.json';
import { BUILDINGS, SEASONS, createRng, dimsOf, HOUSE_LEVELS, WALKERS, type BuildingKind, type Craft, type Feature, type Ground, type BalloonKind, type BuildableKind, type BuildingCategory, type Mood, type Season, type WalkerType } from '../core';
import * as F from './fauna';
import { FAUNA_SIZE, type FaunaKind } from './fauna';
import { HH, HW, TH, TW } from './iso';
import { C, shade } from './palette';
import { mixColor, type TreeState } from './Seasons';
import { drawFieldhand, drawHauler, drawResident, drawTraveler, FIELDHAND_LOOK_COUNT, FIELDHAND_POSES, FIELDHAND_SIZE, HAULER_KINDS, HAULER_SIZE, residentSize, TRAVELER_SIZE, TRAVELER_KINDS, type HaulerKind, type TravelerKind } from './residents';

type G = Phaser.GameObjects.Graphics;
type P3 = [number, number, number?];

export const TEX = {
  /** Ground tile; `deco` adds wild flowers, a bush or pebbles (some cells only). */
  ground: (g: Ground, v: number, deco = false) => `ground-${g}-${v}${deco ? '-d' : ''}`,
  /** Grass and sand of a season or a drought (the map swaps them as the year turns). */
  grass: (look: Season | 'drought', v: number, deco = false) => `grass-${look}-${v}${deco ? '-d' : ''}`,
  sand: (look: Season | 'drought', v: number, deco = false) => `sand-${look}-${v}${deco ? '-d' : ''}`,
  /** Snow-covered ground (snowy winters) and the dry cracked mud of a shrunken river (drought). */
  snowGround: (v: number, deco = false) => `snow-${v}${deco ? '-d' : ''}`,
  mud: (v: number) => `mud-${v}`,
  /** Almond and fig trees (drawn on some olive cells) in each state of the year. */
  tree: (kind: 'almond' | 'fig', v: number, state: TreeState) => `${kind}-${v}-${state}`,
  /** Rain puddle on a road, and a basket of picked olives (autumn harvest). */
  puddle: (v: number) => `puddle-${v}`,
  basket: 'basket',
  /** Animals, boats, washerwomen and cloth (frame = colour or pose). */
  fauna: (kind: FaunaKind, frame = 0) => `fauna-${kind}-${frame}`,
  /** Street with junctions `mask`; `wear` 0 packed earth, 1 wider and lighter (busy), 2 stone paving. */
  road: (mask: number, wear = 0) => `road-${mask}${wear ? `-${wear}` : ''}`,
  /** Wooden scaffold over a w x h footprint (as seen on screen) while a building goes up. */
  scaffold: (w: number, h: number) => `scaffold-${w}x${h}`,
  feature: (f: Feature, v: number) => `${f}-${v}`,
  /**
   * Houses have one texture per level and variant, fields one per crop, workshops one per craft and
   * the granary one per stock level (its "variant", 0 empty to GRANARY_STOCKS - 1 full, chosen by the map),
   * all also drawn mirrored (so light and shadows keep their side); non-square buildings have their
   * own rotated drawing.
   */
  building: (kind: BuildingKind, level = 0, rotated = false, variant = 0, mirrored = false) => {
    if (kind === 'house') return `house-${level}-${variant}${mirrored ? '-m' : ''}`;
    // Granary, market and workshop are drawn per level (1 has no suffix, so callers can skip it).
    const lv = LEVELED.has(kind) && level >= 2 ? `-l${level}` : '';
    if (kind === 'field' || kind === 'workshop' || kind === 'granary') return `${kind}${lv}-${variant}${mirrored ? '-m' : ''}`;
    return `${kind}${lv}${rotated ? '-rotated' : ''}`;
  },
  /**
   * An empty house that kept its level (`emptyLevel` 2..4): that level's drawing with the door shut,
   * no people, smoke nor washing. One per plot variant (an empty house keeps `variant % plot variants`).
   */
  emptyHouse: (level: number, variant: number, mirrored = false) => `house-e${level}-${variant}${mirrored ? '-m' : ''}`,
  /** People walking to a house: a couple hand in hand, or a caravan family with a laden donkey (frame 0 or 1). */
  traveler: (kind: TravelerKind, frame: number) => `traveler-${kind}-${frame}`,
  /** Crop tuft of a field variant (wheat, barley, lentils, flax). */
  crop: (variant: number) => `crop-${variant}`,
  flame: 'flame',
  /** Oil lamp on a wooden post, lit at night (roads near the altar and the market). */
  lamp: 'lamp',
  soft: 'soft',
  ring: 'ring',
  balloon: 'balloon',
  need: (k: BalloonKind) => `need-${k}`,
  /**
   * A resident of a type, in one of WALKER_LOOKS skin/clothes looks, at step frame 0 or 1. Artisans
   * also have one texture per craft, carrying its goods (no craft: a small pot).
   */
  walker: (type: WalkerType, look: number, frame: number, craft: Craft | null = null) =>
    `walker-${type}-${look}-${frame}${craft ? `-${craft}` : ''}`,
  family: 'family',
  /** A food worker (see Haulers.ts): grain carrier loaded or coming back, fisherman, fruit gatherer. */
  hauler: (kind: HaulerKind, look: number, frame: number) => `hauler-${kind}-${look}-${frame}`,
  /** A fly over spoiling food, and a four-pointed gold sparkle (milestones). */
  fly: 'fly',
  spark: 'spark',
  /** A farmer working inside a field, in one of FIELDHAND_LOOK_COUNT looks and a pose (see FIELDHAND_POSES). */
  fieldhand: (look: number, pose: number) => `fieldhand-${look}-${pose}`,
  /** `drought`: a strong sun over cracked earth (shown next to the season icon in a drought). */
  icon: (name: 'view' | 'clear' | 'road' | 'silver' | 'food' | 'people' | 'work' | 'goal' | 'sun' | 'dusk' | 'moon' | 'options' | 'drought' | Season) => `icon-${name}`,
  /** Weather particles: rain streak, splash ring and petal (snow and dust use `soft`). */
  rain: 'rain',
  splash: 'splash',
  petal: 'petal',
  /** Face of a mood (plaque happiness slot). */
  mood: (m: Mood) => `mood-${m}`,
  /** Small stone thrown out when something is demolished. */
  pebble: 'pebble',
  /**
   * Round-button thumbnails (THUMB x THUMB, centered, clipped to a circle; see uiArt.ts): a building,
   * a build-menu category, and their greyed locked versions.
   */
  thumb: (kind: BuildableKind) => `thumb-${kind}`,
  thumbLocked: (kind: BuildableKind) => `thumb-${kind}-locked`,
  categoryThumb: (c: BuildingCategory) => `thumb-cat-${c}`,
  categoryThumbLocked: (c: BuildingCategory) => `thumb-cat-${c}-locked`,
  /** Interface line icon (ICON x ICON, see uiArt.ts), drawn dark (for light buttons) or light (for dark ones). */
  uiIcon: (name: UiIcon, tone: 'dark' | 'light' = 'dark') => `ui-${name}-${tone}`,
};
/** Line icons of the interface (see TEX.uiIcon). */
export type UiIcon = 'hand' | 'handGrab' | 'road' | 'hammer' | 'flag' | 'alert' | 'stats' | 'gear' | 'pause' | 'play' | 'lock';
export const VARIANTS = 4;
/** Buildings drawn once per level (see TEX.building). */
const LEVELED: ReadonlySet<BuildingKind> = new Set<BuildingKind>(['granary', 'market', 'workshop']);
/** Levels drawn for a building kind (1 plus its `levels`). */
export const levelCount = (kind: BuildingKind) => 1 + (BUILDINGS[kind].levels?.length ?? 0);
/** Granary drawings by stock: empty, a third, two thirds and full. */
export const GRANARY_STOCKS = 4;
/** Skin and clothes combinations drawn for each walker type. */
export const WALKER_LOOKS = 3;

/** Texture origin (anchor = ground point at the footprint center), as Phaser origin fractions. */
export const ORIGIN: Record<string, [number, number]> = {};
/** Height in pixels above the ground, for balloons. */
export const HEIGHT: Record<string, number> = {};

type Spot = { x: number; y: number; z: number };

/**
 * Animated parts, in local grid units from the footprint center (z in pixels): wheat tufts in rows
 * over the 2 x 2 field (back to front), the chimney smoke and fire glow of the workshop crafts that
 * burn (unmirrored drawing; a mirrored one swaps x and y), the altar fire and the tent campfires.
 */
export const PARTS = {
  wheat: [-0.66, -0.33, 0, 0.33, 0.66]
    .flatMap((y, row) => [-0.68, -0.34, 0, 0.34, 0.68].map((x) => ({ x: x + (row % 2 ? 0.08 : -0.04), y, z: 4 })))
    .sort((a, b) => a.x + a.y - b.x - b.y),
  craftFire: {
    pottery: { smoke: { x: 0.78, y: -0.78, z: 44 }, glow: { x: 0.58, y: -0.43, z: 4 } },
    smithy: { smoke: { x: 1.04, y: -1.12, z: 48 }, glow: { x: 0.74, y: -0.86, z: 14 } },
  } as Partial<Record<Craft, { smoke: Spot; glow: Spot }>>,
  altarFire: { x: 0, y: -0.2, z: 24, scale: 2.2 },
  /** Campfires drawn in front of some tents, by tent variant (lit brighter at night). */
  tentFire: { 2: { x: -0.2, y: 0.62, z: 2, scale: 0.7 }, 4: { x: 0.42, y: 0.52, z: 2, scale: 1 } } as Record<number, Spot & { scale: number }>,
};

const SHADOW_K = 0.016;

const SL = VISUAL.seasons.snowLook;
const SNOW = { base: Number(SL.base), shade: Number(SL.shade), roof: SL.roof };
/** Set while drawing the snowy copy of a texture (see snowTexture). */
let snowing = false;
/**
 * Set while drawing an empty house (see TEX.emptyHouse): doors are shut and barred, and nobody is
 * home: no people, animals, smoke, fire, washing or awnings.
 */
let vacant = false;

/** A drawing made with nobody home (see `vacant`). */
const emptied = (draw: (p: Pen) => void) => (p: Pen) => {
  vacant = true;
  try {
    draw(p);
  } finally {
    vacant = false;
  }
};
const SQRT2 = Math.SQRT2;

class Pen {
  /**
   * A mirrored pen swaps the local x and y axes, so the drawing comes out mirrored on screen while
   * box faces and shadows stay lit from the same side (unlike flipping the finished image).
   */
  constructor(readonly g: G, readonly ax: number, readonly ay: number, readonly mirror = false) {}

  p(x: number, y: number, z = 0) {
    if (this.mirror) [x, y] = [y, x];
    return { x: this.ax + (x - y) * HW, y: this.ay + (x + y) * HH - z };
  }

  /** Colour of a face that is lit when it faces south (+y), shaded when mirrored. */
  south(color: number, lit = 0.88, dark = 0.66) {
    return shade(color, this.mirror ? dark : lit);
  }

  /** Colour of a face that is shaded when it faces east (+x), lit when mirrored. */
  east(color: number, lit = 0.88, dark = 0.66) {
    return shade(color, this.mirror ? lit : dark);
  }

  /** A local point moved d units toward where shadows fall (screen right). */
  away(x: number, y: number, d: number): [number, number] {
    return this.mirror ? [x - d * 0.25, y + d] : [x + d, y - d * 0.25];
  }

  poly(color: number, pts: P3[], alpha = 1) {
    this.g.fillStyle(color, alpha);
    this.g.fillPoints(pts.map(([x, y, z]) => this.p(x, y, z ?? 0)), true);
  }

  line(color: number, width: number, a: P3, b: P3, alpha = 1) {
    const pa = this.p(a[0], a[1], a[2] ?? 0);
    const pb = this.p(b[0], b[1], b[2] ?? 0);
    this.g.lineStyle(width, color, alpha);
    this.g.lineBetween(pa.x, pa.y, pb.x, pb.y);
  }

  /** Flat quad on the ground (or at height z). Snow covers the solid ones above the ground (roofs, tops). */
  rect(color: number, x0: number, y0: number, x1: number, y1: number, z = 0, alpha = 1) {
    if (snowing && z > 0.5 && alpha > 0.9) color = mixColor(color, SNOW.base, SNOW.roof);
    this.poly(color, [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], alpha);
  }

  /** Box with a top, a lit south face and a shaded east face. */
  box(x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, top: number, lit = shade(top, 0.88), dark = shade(top, 0.66)) {
    if (this.mirror) [lit, dark] = [dark, lit];
    this.poly(lit, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]);
    this.poly(dark, [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]);
    this.rect(top, x0, y0, x1, y1, z1);
  }

  /** Soft shadow of a box of height h, cast toward the east. */
  shadow(x0: number, y0: number, x1: number, y1: number, h: number, alpha = 0.24) {
    const d = h * SHADOW_K;
    for (const [grow, a] of [[0.07, alpha * 0.45], [0, alpha * 0.7]]) {
      const corners: P3[] = [[x0 - grow, y0 - grow], [x1 + grow, y0 - grow], [x1 + grow, y1 + grow], [x0 - grow, y1 + grow]];
      const shifted = corners.map(([x, y]) => this.away(x, y, d) as P3);
      this.g.fillStyle(C.shadow, a);
      this.g.fillPoints(hull([...corners, ...shifted].map(([x, y]) => this.p(x, y))), true);
    }
  }

  /** Flat circle of radius r (grid units) at height z. */
  disc(color: number, x: number, y: number, z: number, r: number, alpha = 1) {
    const c = this.p(x, y, z);
    this.g.fillStyle(color, alpha);
    this.g.fillEllipse(c.x, c.y, r * 2 * SQRT2 * HW, r * 2 * SQRT2 * HH);
  }

  /** Screen-space circle (for foliage, fruit and other round things). */
  ball(color: number, x: number, y: number, z: number, radiusPx: number, alpha = 1) {
    const c = this.p(x, y, z);
    this.g.fillStyle(color, alpha);
    this.g.fillCircle(c.x, c.y, radiusPx);
  }

  /** Quad on the south face plane (y = const), e.g. a door or window. */
  southQuad(color: number, y: number, x0: number, x1: number, z0: number, z1: number) {
    this.poly(color, [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]]);
  }

  /** Quad on the east face plane (x = const). */
  eastQuad(color: number, x: number, y0: number, y1: number, z0: number, z1: number) {
    this.poly(color, [[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]]);
  }
}

function hull(pts: { x: number; y: number }[]) {
  const s = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: typeof s) => {
    const out: typeof s = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(s), ...half([...s].reverse())];
}

// ---------- texture factory ----------

const SMALL = { w: 108, h: 128, ax: 40, ay: 96 };
const TILE = { w: TW + 2, h: TH + 2, ax: TW / 2 + 1, ay: TH / 2 + 1 };

type Size = { w: number; h: number; ax: number; ay: number };
/** How each texture was drawn, so a snowy copy can be drawn later. */
const RECIPE = new Map<string, { size: Size; draw: (p: Pen) => void; height: number; mirror: boolean }>();

function make(scene: Phaser.Scene, key: string, size: Size, draw: (p: Pen) => void, height = 0, mirror = false) {
  later(key, size, draw, height, mirror);
  ensureTexture(scene, key);
}

/**
 * Registers a texture (anchor, height and how to draw it) without drawing it yet: rarer drawings
 * (upgraded buildings, empty houses) are only drawn the first time the map asks for them, which
 * keeps memory low on phones. See ensureTexture.
 */
function later(key: string, size: Size, draw: (p: Pen) => void, height = 0, mirror = false) {
  RECIPE.set(key, { size, draw, height, mirror });
  ORIGIN[key] = [size.ax / size.w, size.ay / size.h];
  HEIGHT[key] = height;
}

/** Draws a registered texture if it is not drawn yet (no-op for unknown keys). Returns the key. */
export function ensureTexture(scene: Phaser.Scene, key: string): string {
  const r = RECIPE.get(key);
  if (!r || scene.textures.exists(key)) return key;
  const g = new Phaser.GameObjects.Graphics(scene);
  r.draw(new Pen(g, r.size.ax, r.size.ay, r.mirror));
  g.generateTexture(key, r.size.w, r.size.h);
  g.destroy();
  return key;
}

/**
 * The snowy copy of a texture (roofs, tops and tree crowns under snow), drawn the first time it is
 * asked for: snow is rare, so these are only made in snowy winters, a few at a time.
 */
export function snowTexture(scene: Phaser.Scene, key: string): string {
  const r = RECIPE.get(key);
  if (!r) return key;
  const snowKey = `${key}-snow`;
  snowing = true;
  try {
    make(scene, snowKey, r.size, r.draw, r.height, r.mirror);
  } finally {
    snowing = false;
  }
  return snowKey;
}

/** True when the snowy copy of a texture is already drawn. */
export const hasSnowTexture = (scene: Phaser.Scene, key: string) => scene.textures.exists(`${key}-snow`);

function makeFlat(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void) {
  ORIGIN[key] = [0.5, 0.5];
  if (scene.textures.exists(key)) return;
  const g = new Phaser.GameObjects.Graphics(scene);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

const DIAMOND = 0.515;

// ---------- ground ----------

/** Ground of a season or a drought: base and tuft colours, flowers of the decorated tiles, flowers on the plain ones, cracks. */
interface Turf {
  base: number;
  tuft: number;
  deco: number[];
  flowers: number;
  cracks?: number;
}
const DL = VISUAL.seasons.droughtLook;
const SEASON_TURF = Object.fromEntries(
  (Object.entries(VISUAL.seasons.looks) as [Season, (typeof VISUAL.seasons.looks)['spring']][]).map(([k, l]) => {
    const grass: Turf = { base: Number(l.grassBase), tuft: Number(l.grassTuft), deco: l.grassDeco.map(Number), flowers: l.grassFlowers };
    const sand: Turf = { base: Number(l.sandBase), tuft: C.tuft, deco: [], flowers: 0 };
    return [k, { grass, sand }];
  }),
) as Record<Season | 'drought', { grass: Turf; sand: Turf }>;
SEASON_TURF.drought = {
  grass: { base: Number(DL.grassBase), tuft: Number(DL.grassTuft), deco: [0xa88a58, 0x8c7048], flowers: 0, cracks: Number(DL.crack) },
  sand: { base: Number(DL.sandBase), tuft: C.tuft, deco: [], flowers: 0, cracks: Number(DL.crack) },
};
/** Small tone steps between the four ground variants. */
const VARIANT_TONE = [1, 0.985, 1.015, 0.975];

/** Thin dark cracks of dry earth, with a light lip on one side. */
function cracks(p: Pen, color: number, r: () => number, n: number) {
  for (let i = 0; i < n; i++) {
    let x = -0.38 + r() * 0.76;
    let y = -0.38 + r() * 0.76;
    let a = r() * Math.PI * 2;
    for (let k = 0; k < 3; k++) {
      a += (r() - 0.5) * 1.6;
      const nx = Math.max(-0.45, Math.min(0.45, x + Math.cos(a) * 0.14));
      const ny = Math.max(-0.45, Math.min(0.45, y + Math.sin(a) * 0.14));
      p.line(shade(color, 1.5), 1, [x, y + 0.02], [nx, ny + 0.02], 0.35);
      p.line(color, k ? 1 : 1.4, [x, y], [nx, ny], 0.75);
      x = nx;
      y = ny;
    }
  }
}

/** A small red anemone (or other wild flower) with a dark heart. */
function flower(p: Pen, color: number, x: number, y: number) {
  p.ball(color, x, y, 2, 1.5);
  p.ball(shade(color, 0.45), x, y, 2, 0.5);
}

function groundTile(p: Pen, kind: Ground, v: number, turf: Turf | null = null) {
  const r = createRng(300 + v * 7 + kind.length);
  const base = turf ? shade(turf.base, VARIANT_TONE[v]) : kind === 'sand' ? C.sand[v] : kind === 'grass' ? C.grass[v] : C.water;
  const tuft = turf ? turf.tuft : C.tuft;
  p.rect(base, -DIAMOND, -DIAMOND, DIAMOND, DIAMOND);
  const spot = (m = 0.4) => [-m + r() * m * 2, -m + r() * m * 2] as const;
  if (kind === 'river') {
    p.rect(C.waterDeep, -0.2, -DIAMOND, 0.2, DIAMOND, 0, 0.35);
    return;
  }
  // Large soft patches break the tile grid; small speckles give grain (gentle on seasonal grass,
  // so a green winter meadow reads clean instead of dotted).
  const soft = !!turf && kind === 'grass';
  for (let i = 0; i < (soft ? 3 : 2); i++) {
    const [x, y] = spot(0.25);
    p.disc(shade(base, r() < 0.5 ? 0.95 : 1.05), x, y, 0, 0.18 + r() * 0.1, 0.55);
  }
  for (let i = 0; i < (soft ? 4 : 7); i++) {
    const [x, y] = spot();
    p.disc(shade(base, r() < 0.5 ? (soft ? 0.97 : 0.92) : soft ? 1.03 : 1.08), x, y, 0, 0.03 + r() * 0.06, 0.7);
  }
  if (turf?.cracks) cracks(p, turf.cracks, r, kind === 'sand' ? 4 : 2);
  if (kind === 'sand') {
    // Wind ripples and a few pebbles.
    for (let i = 0; i < (turf?.cracks ? 1 : 3); i++) {
      const [x, y] = spot(0.35);
      const a = p.p(x - 0.1, y + 0.02);
      const m = p.p(x, y - 0.03);
      const b = p.p(x + 0.1, y + 0.02);
      p.g.lineStyle(1, shade(base, 1.14), 0.85);
      p.g.lineBetween(a.x, a.y, m.x, m.y);
      p.g.lineBetween(m.x, m.y, b.x, b.y);
      p.g.lineStyle(1, shade(base, 0.9), 0.5);
      p.g.lineBetween(a.x, a.y + 1, m.x, m.y + 1);
      p.g.lineBetween(m.x, m.y + 1, b.x, b.y + 1);
    }
    for (let i = 0; i < 2 + (v % 2); i++) {
      const [px, py] = spot();
      const c = p.p(px, py);
      p.g.fillStyle(C.rockDark, 0.5);
      p.g.fillEllipse(c.x + 0.6, c.y + 0.6, 3, 1.8);
      p.g.fillStyle(C.rockLight);
      p.g.fillEllipse(c.x, c.y, 2.6, 1.6);
    }
    return;
  }
  for (let i = 0; i < (turf?.cracks ? 3 : 6); i++) {
    const [x, y] = spot();
    const b = p.p(x, y);
    const tall = (turf?.cracks ? 2 : 3) + r() * 3;
    p.g.lineStyle(1.2, i % 3 ? tuft : shade(base, 1.18), 0.9);
    p.g.lineBetween(b.x, b.y, b.x - 2, b.y - tall * 0.8);
    p.g.lineBetween(b.x, b.y, b.x, b.y - tall);
    p.g.lineBetween(b.x, b.y, b.x + 2, b.y - tall * 0.8);
  }
  if (!turf && v === 0) {
    const [x, y] = spot(0.3);
    p.ball(0xf2e6b0, x, y, 2, 1.1);
    p.ball(0xd98a6a, x + 0.08, y - 0.04, 2, 1.1);
  }
  // Wild flowers on plain tiles too (anemones in spring), in small clusters.
  if (turf && turf.flowers && v % 2 === 0) {
    const [x, y] = spot(0.3);
    for (let i = 0; i < turf.flowers; i++) flower(p, turf.deco[(i + v) % turf.deco.length], x + (r() - 0.5) * 0.22, y + (r() - 0.5) * 0.22);
  }
}

/** Snow over the ground: soft blue-grey hollows, a few grass tips and stones poking through. */
function snowTile(p: Pen, v: number, deco: boolean) {
  const r = createRng(500 + v * 11);
  const spot = (m = 0.4) => [-m + r() * m * 2, -m + r() * m * 2] as const;
  p.rect(shade(SNOW.base, VARIANT_TONE[v]), -DIAMOND, -DIAMOND, DIAMOND, DIAMOND);
  for (let i = 0; i < 3; i++) {
    const [x, y] = spot(0.28);
    p.disc(SNOW.shade, x, y, 0, 0.12 + r() * 0.12, 0.45);
  }
  for (let i = 0; i < 3; i++) {
    const [x, y] = spot();
    const b = p.p(x, y);
    p.g.lineStyle(1, 0x7d8a6a, 0.7);
    p.g.lineBetween(b.x, b.y, b.x - 1.5, b.y - 2.5);
    p.g.lineBetween(b.x, b.y, b.x + 1, b.y - 3);
  }
  if (!deco) return;
  const [bx, by] = spot(0.22);
  p.ball(C.oliveDark, bx, by, 3, 3.2);
  p.ball(SNOW.base, bx - 0.02, by - 0.02, 5, 2.6);
}

/** Dry cracked mud where the river shrank in a drought. */
function mudTile(p: Pen, v: number) {
  const r = createRng(600 + v * 5);
  const mud = shade(Number(DL.mud), VARIANT_TONE[v]);
  p.rect(mud, -DIAMOND, -DIAMOND, DIAMOND, DIAMOND);
  // Curled plates of dried mud: light tops between dark cracks, and a few stones left by the water.
  for (let i = 0; i < 5; i++) p.disc(shade(mud, 1.16), -0.32 + r() * 0.64, -0.32 + r() * 0.64, 0, 0.1 + r() * 0.06, 0.8);
  cracks(p, shade(mud, 0.55), r, 6);
  for (let i = 0; i < 2; i++) p.ball(C.rock, -0.3 + r() * 0.6, -0.3 + r() * 0.6, 0.5, 1.6);
}

/** A rain puddle on a packed-earth road: dark water with a pale reflection of the sky. */
function puddle(p: Pen, v: number) {
  const r = createRng(800 + v * 3);
  const x = (r() - 0.5) * 0.16;
  const y = (r() - 0.5) * 0.16;
  p.disc(0x6a5a48, x, y, 0, 0.17 + v * 0.015, 0.35);
  p.disc(0x7c8c98, x, y, 0, 0.14 + v * 0.015, 0.85);
  p.disc(0xc4d4e0, x - 0.03, y - 0.02, 0, 0.07, 0.6);
  p.disc(0x7c8c98, x + 0.12, y + 0.06, 0, 0.05, 0.8);
}

/**
 * Packed-earth street: a soft verge, a wide trodden surface with an arm toward each connected
 * neighbour (N, E, S, W), cart ruts, worn edge stones and a few pebbles.
 */
function road(p: Pen, mask: number, wear = 0) {
  const w = wear ? 0.38 : 0.32;
  const arms: [number, number, number, number][] = [
    [-w, -0.5, w, -w], // N (y - 1)
    [w, -w, 0.5, w], // E (x + 1)
    [-w, w, w, 0.5], // S (y + 1)
    [-0.5, -w, -w, w], // W (x - 1)
  ];
  const has = (k: number) => !!(mask & (1 << k));
  const draw = (color: number, grow: number, alpha: number) => {
    p.rect(color, -w - grow, -w - grow, w + grow, w + grow, 0, alpha);
    arms.forEach(([x0, y0, x1, y1], k) => {
      if (!has(k)) return;
      const gx = k % 2 ? 0 : grow;
      const gy = k % 2 ? grow : 0;
      p.rect(color, x0 - gx, y0 - gy, x1 + gx, y1 + gy, 0, alpha);
    });
  };
  // A soft trodden verge, then a crisp dark kerb line so streets read on sand at the minimum zoom.
  draw(C.roadEdge, 0.13, 0.28);
  draw(C.roadEdge, 0.055, 1);
  if (wear === 2) {
    pavers(p, w, has);
    return;
  }
  const surface = wear ? shade(C.road, 1.12) : C.road;
  draw(surface, 0, 1);
  draw(shade(surface, 1.08), -0.08, 0.7);
  const rut = shade(C.road, 0.82);
  arms.forEach((_, k) => {
    if (!has(k)) return;
    const sign = k === 0 || k === 3 ? -0.5 : 0.5;
    for (const o of [-0.13, 0.13]) {
      if (k % 2) p.line(rut, 1.2, [0, o], [sign, o], 0.7);
      else p.line(rut, 1.2, [o, 0], [o, sign], 0.7);
    }
  });
  // Worn edge stones along the open sides of each arm.
  const r = createRng(900 + mask);
  const stone = (x: number, y: number) => {
    const c = p.p(x, y);
    p.g.fillStyle(C.rockDark, 0.6);
    p.g.fillEllipse(c.x + 0.7, c.y + 0.7, 3.4, 2);
    p.g.fillStyle(r() < 0.5 ? C.rock : C.rockLight);
    p.g.fillEllipse(c.x, c.y, 3.2, 1.9);
  };
  arms.forEach(([x0, y0, x1, y1], k) => {
    if (!has(k)) return;
    for (const t of [0.55]) {
      const along = k % 2 ? x0 + (x1 - x0) * t : y0 + (y1 - y0) * t;
      if (k % 2) {
        stone(along, -w - 0.03);
        stone(along, w + 0.03);
      } else {
        stone(-w - 0.03, along);
        stone(w + 0.03, along);
      }
    }
  });
  for (let i = 0; i < 4; i++) {
    const x = -0.2 + r() * 0.4;
    const y = -0.2 + r() * 0.4;
    p.ball(i % 2 ? shade(C.road, 1.2) : shade(C.road, 0.75), x, y, 0, 0.9);
  }
}

// ---------- features ----------

function rock(p: Pen, v: number) {
  const boulders: [number, number, number][] = v % 2 ? [[-0.1, -0.05, 11], [0.17, 0.12, 7]] : [[0.05, 0, 12], [-0.2, 0.15, 6], [0.2, -0.2, 5]];
  p.shadow(-0.3, -0.25, 0.3, 0.3, 14, 0.2);
  for (const [x, y, r] of boulders) {
    const c = p.p(x, y);
    p.g.fillStyle(C.rockDark);
    p.g.fillEllipse(c.x, c.y - r * 0.45, r * 2.2, r * 1.5);
    p.g.fillStyle(C.rock);
    p.g.fillEllipse(c.x - r * 0.12, c.y - r * 0.7, r * 1.9, r * 1.2);
    p.g.fillStyle(C.rockLight);
    p.g.fillEllipse(c.x - r * 0.4, c.y - r * 0.9, r * 0.9, r * 0.5);
  }
}

function olive(p: Pen, v: number) {
  const m = v % 2 ? -1 : 1;
  p.disc(C.shadow, 0.3, -0.05, 0, 0.32, 0.2);
  p.disc(C.shadow, 0.18, 0, 0, 0.22, 0.15);
  const base = p.p(0, 0);
  p.g.lineStyle(5, C.trunk);
  p.g.lineBetween(base.x, base.y, base.x + 2 * m, base.y - 12);
  p.g.lineStyle(3, C.trunk);
  p.g.lineBetween(base.x + 2 * m, base.y - 10, base.x - 5 * m, base.y - 18);
  const blobs: [number, number, number][] = [[-8 * m, -22, 9], [7 * m, -24, 10], [0, -31, 10], [0, -19, 8]];
  for (const [color, dy] of [[C.oliveDark, 2], [C.olive, 0]] as const) {
    p.g.fillStyle(color);
    blobs.forEach(([x, y, r]) => p.g.fillCircle(base.x + x, base.y + y + dy, r));
  }
  p.g.fillStyle(C.oliveLight);
  blobs.forEach(([x, y, r]) => p.g.fillCircle(base.x + x - 3, base.y + y - 3, r * 0.45));
  p.g.fillStyle(0x4b5a33);
  [[-6, -24], [5, -28], [2, -18], [-2, -34], [9, -21]].forEach(([x, y]) => p.g.fillCircle(base.x + x * m, base.y + y, 1.3));
  snowCaps(p.g, blobs, base.x, base.y);
}

function palm(p: Pen, v: number) {
  const m = v % 2 ? -1 : 1;
  const height = 46 + (v % 3) * 4;
  const lean = 7 * m;
  p.disc(C.shadow, 0.55, -0.15, 0, 0.3, 0.18);
  p.line(C.shadow, 3, [0, 0], [0.5, -0.12], 0.15);
  const base = p.p(0, 0);
  const at = (t: number) => ({ x: base.x + lean * t * t, y: base.y - height * t });
  for (let i = 0; i < 8; i++) {
    const a = at(i / 8);
    const b = at((i + 1) / 8);
    p.g.lineStyle(5 - i * 0.25, i % 2 ? C.palmTrunk : shade(C.palmTrunk, 0.82));
    p.g.lineBetween(a.x, a.y, b.x, b.y);
  }
  const top = at(1);
  const leaves = 8;
  for (const pass of [0, 1]) {
    for (let k = 0; k < leaves; k++) {
      const ang = (k / leaves) * Math.PI * 2 + v;
      const dx = Math.cos(ang) * 20;
      const dy = Math.sin(ang) * 9;
      const back = dy < 0;
      if ((pass === 0) !== back) continue;
      const tip = { x: top.x + dx, y: top.y + dy + 9 };
      const mid = { x: top.x + dx * 0.55, y: top.y + dy * 0.55 - 4 };
      const nx = -dy * 0.18;
      const ny = dx * 0.12;
      p.g.fillStyle(back ? C.palmDark : C.palm);
      p.g.fillTriangle(top.x, top.y, mid.x + nx, mid.y + ny, tip.x, tip.y);
      p.g.fillTriangle(top.x, top.y, mid.x - nx, mid.y - ny, tip.x, tip.y);
    }
  }
  p.g.fillStyle(0x7a4f2a);
  [[-2, 3], [2, 4], [0, 2]].forEach(([x, y]) => p.g.fillCircle(top.x + x, top.y + y, 2.2));
  if (snowing) {
    p.g.fillStyle(SNOW.base, 0.9);
    p.g.fillEllipse(top.x, top.y - 1, 16, 5);
  }
}

/** Snow caps on round crowns (the upper part of each blob), when drawing a snowy copy. */
function snowCaps(g: G, blobs: [number, number, number][], bx: number, by: number) {
  if (!snowing) return;
  g.fillStyle(SNOW.base, 0.95);
  blobs.forEach(([x, y, r]) => g.fillEllipse(bx + x - 1, by + y - r * 0.5, r * 1.5, r * 0.8));
}

/** Branches of a bare deciduous tree from (x, y) on screen: forks drawn to `depth`, returning the tips. */
function branches(g: G, x: number, y: number, len: number, ang: number, width: number, depth: number, color: number, r: () => number, tips: [number, number][]) {
  const ex = x + Math.cos(ang) * len;
  const ey = y + Math.sin(ang) * len;
  g.lineStyle(width, color);
  g.lineBetween(x, y, ex, ey);
  if (depth === 0) {
    tips.push([ex, ey]);
    return;
  }
  for (const d of [-0.45, 0.42]) branches(g, ex, ey, len * (0.66 + r() * 0.12), ang + d + (r() - 0.5) * 0.3, Math.max(1, width * 0.65), depth - 1, color, r, tips);
}

/**
 * Almond tree: a slender grey-brown tree. Bare in winter, a cloud of white and pink blossom at
 * the end of winter (before the leaves), light green leaves from spring to autumn.
 */
function almond(p: Pen, v: number, state: TreeState) {
  const r = createRng(60 + v);
  const m = v % 2 ? -1 : 1;
  p.disc(C.shadow, 0.26, -0.04, 0, 0.26, 0.18);
  const b = p.p(0, 0);
  const bark = 0x6a5446;
  p.g.lineStyle(4, bark);
  p.g.lineBetween(b.x, b.y, b.x + m, b.y - 12);
  const tips: [number, number][] = [];
  for (const a of [-2.2, -1.55, -0.95]) branches(p.g, b.x + m, b.y - 12, 9, a + m * 0.05, 2.4, 2, bark, r, tips);
  if (state === 'bare') {
    if (snowing) tips.forEach(([x, y]) => p.g.fillStyle(SNOW.base).fillCircle(x, y - 0.5, 1.8));
    return;
  }
  const colors = state === 'bloom' ? [0xfbf6f2, 0xf6d4dc, 0xffffff, 0xeeb4c4] : [0x8fae5c, 0xa8c470, 0x7a9a4c];
  const size = state === 'bloom' ? 3.2 : 3.6;
  tips.forEach(([x, y], k) => {
    for (let i = 0; i < 3; i++) {
      p.g.fillStyle(colors[(k + i) % colors.length]);
      p.g.fillCircle(x + (r() - 0.5) * 6, y + (r() - 0.5) * 5, size * (0.7 + r() * 0.5));
    }
  });
  if (state === 'bloom') tips.forEach(([x, y]) => p.g.fillStyle(0xd86a8a).fillCircle(x + 1, y + 1, 0.9));
  if (snowing) tips.forEach(([x, y]) => p.g.fillStyle(SNOW.base).fillCircle(x, y - 2, 2));
}

/**
 * Fig tree: a low tree with a pale grey trunk and a wide crown of big leaves. Bare in winter,
 * leafing out in spring, yellowing in autumn.
 */
function fig(p: Pen, v: number, state: TreeState) {
  const r = createRng(80 + v);
  const m = v % 2 ? -1 : 1;
  p.disc(C.shadow, 0.3, -0.05, 0, 0.34, 0.2);
  const b = p.p(0, 0);
  const bark = 0x9a9084;
  p.g.lineStyle(5, shade(bark, 0.8));
  p.g.lineBetween(b.x, b.y, b.x - m, b.y - 8);
  const tips: [number, number][] = [];
  for (const a of [-2.6, -2, -1.15, -0.55]) branches(p.g, b.x - m, b.y - 8, 8, a, 3, 1, bark, r, tips);
  if (state === 'bare') {
    tips.forEach(([x, y]) => p.g.fillStyle(shade(bark, 0.8)).fillCircle(x, y, 1.4));
    if (snowing) tips.forEach(([x, y]) => p.g.fillStyle(SNOW.base).fillCircle(x, y - 1, 2));
    return;
  }
  const [dark, light] = state === 'yellow' ? [0xc0a03c, 0xe2c862] : [0x4f8a32, 0x74ac46];
  const blobs: [number, number, number][] = tips.map(([x, y]) => [x - b.x, y - b.y, 6 + r() * 2]);
  blobs.push([0, -18, 8]);
  // Yellowing figs have already lost part of their leaves.
  const keep = state === 'yellow' ? blobs.filter((_, k) => k % 3 !== 1) : blobs;
  for (const [color, dy] of [[dark, 2], [light, 0]] as const) {
    p.g.fillStyle(color);
    keep.forEach(([x, y, s]) => p.g.fillCircle(b.x + x, b.y + y + dy, s));
  }
  p.g.fillStyle(shade(light, 1.2));
  keep.forEach(([x, y, s]) => p.g.fillCircle(b.x + x - 2, b.y + y - 2, s * 0.35));
  snowCaps(p.g, keep, b.x, b.y);
}

// ---------- building helpers ----------

/** Draw calls collected with a painter's key (x + y of the part) and drawn back to front. */
class Layers {
  private list: { key: number; draw: () => void }[] = [];
  add(gx: number, gy: number, draw: () => void) {
    this.list.push({ key: gx + gy, draw });
  }
  flush() {
    this.list.sort((a, b) => a.key - b.key).forEach((it) => it.draw());
    this.list = [];
  }
}

/** A standing person drawn on the ground point (x, y, z). */
function person(p: Pen, x: number, y: number, z: number, v: number, scale = 0.9) {
  if (vacant) return;
  const c = p.p(x, y, z);
  p.g.fillStyle(C.shadow, 0.22);
  p.g.fillEllipse(c.x + 1, c.y, 9 * scale, 3 * scale);
  figure(p.g, c.x, c.y, C.clothes[v % C.clothes.length], C.skin[v % C.skin.length], v % 2 === 0, scale);
}

/** Terracotta jar with a lit rim. */
function jar(p: Pen, x: number, y: number, z: number, r = 3, color = C.terracotta) {
  p.ball(C.shadow, ...p.away(x, y, 0.04), z, r * 0.8, 0.25);
  p.ball(shade(color, 0.8), x, y, z + r, r);
  p.ball(color, x - 0.012, y - 0.012, z + r + 0.6, r * 0.82);
  p.ball(shade(color, 0.6), x, y, z + r * 2 + 0.5, r * 0.45);
  p.ball(shade(color, 1.3), x - 0.02, y - 0.02, z + r * 1.3, r * 0.3);
}

/** Vertical cylinder (silo drum, kiln base), lit on the left like the south faces. */
function cylinder(p: Pen, x: number, y: number, r: number, z0: number, z1: number, color: number) {
  const top = p.p(x, y, z1);
  const bot = p.p(x, y, z0);
  const w = r * 2 * SQRT2 * HW;
  const eh = r * 2 * SQRT2 * HH;
  p.g.fillStyle(shade(color, 0.62));
  p.g.fillEllipse(bot.x, bot.y, w, eh);
  p.g.fillRect(bot.x - w / 2, top.y, w, bot.y - top.y);
  p.g.fillStyle(shade(color, 0.88));
  p.g.fillEllipse(bot.x - w / 5, bot.y, w * 0.6, eh * 0.92);
  p.g.fillRect(bot.x - w / 2, top.y, w * 0.5, bot.y - top.y);
  p.g.fillStyle(shade(color, 0.75));
  p.g.fillRect(bot.x - w * 0.05, top.y, w * 0.2, bot.y - top.y);
  p.g.fillStyle(color);
  p.g.fillEllipse(top.x, top.y, w, eh);
}

/** Dome sitting on the ground ellipse of radius r (bread oven, kiln). */
function dome(p: Pen, x: number, y: number, z: number, r: number, h: number, color: number) {
  const c = p.p(x, y, z);
  const rx = r * SQRT2 * HW;
  const ry = r * SQRT2 * HH;
  const shape = (cx: number, sx: number, sh: number) => {
    const pts: { x: number; y: number }[] = [];
    for (let k = 0; k <= 16; k++) {
      const a = Math.PI + (k / 16) * Math.PI;
      pts.push({ x: cx + sx * Math.cos(a), y: c.y + sh * Math.sin(a) });
    }
    for (let k = 0; k <= 16; k++) {
      const a = (k / 16) * Math.PI;
      pts.push({ x: cx + sx * Math.cos(a), y: c.y + ry * Math.sin(a) });
    }
    return pts;
  };
  p.g.fillStyle(shade(color, 0.66));
  p.g.fillPoints(shape(c.x, rx, h), true);
  p.g.fillStyle(shade(color, 0.92));
  p.g.fillPoints(shape(c.x - rx * 0.22, rx * 0.74, h * 0.96), true);
  p.g.fillStyle(shade(color, 1.12));
  p.g.fillEllipse(c.x - rx * 0.3, c.y - h * 0.62, rx * 0.5, h * 0.4);
}

/** Small fig or olive tree with a trunk, layered round foliage and a soft shadow. */
function tree(p: Pen, x: number, y: number, z: number, size: number, leaf = C.leaf) {
  const t = p.p(x, y, z);
  p.disc(C.shadow, ...p.away(x, y, 0.2 * size), z, 0.22 * size, 0.2);
  p.g.lineStyle(3 * size, C.trunk);
  p.g.lineBetween(t.x, t.y, t.x + 1.5 * size, t.y - 14 * size);
  p.g.lineStyle(2 * size, C.trunk);
  p.g.lineBetween(t.x + size, t.y - 10 * size, t.x - 4 * size, t.y - 16 * size);
  const blobs: [number, number, number][] = [[-6, -19, 7], [6, -21, 7.5], [0, -27, 7.5], [1, -17, 6]];
  for (const [color, dy] of [[shade(leaf, 0.72), 2], [leaf, 0]] as const) {
    p.g.fillStyle(color);
    blobs.forEach(([bx, by, r]) => p.g.fillCircle(t.x + bx * size, t.y + (by + dy) * size, r * size));
  }
  p.g.fillStyle(shade(leaf, 1.3));
  blobs.forEach(([bx, by, r]) => p.g.fillCircle(t.x + (bx - 2.5) * size, t.y + (by - 2.5) * size, r * 0.4 * size));
}

/** Stack of firewood logs along y, seen end-on from the east. */
function logs(p: Pen, x: number, y: number, z = 0, n = 3) {
  const ends: [number, number][] = n >= 3 ? [[0, 3], [-0.07, 3], [-0.035, 8]] : [[0, 3], [-0.07, 3]];
  p.box(x - 0.2, y - 0.1, x, y + 0.03, z, z + (n >= 3 ? 10 : 6), C.wood, shade(C.wood, 0.9), shade(C.woodDark, 0.9));
  for (const [dy, dz] of ends) {
    const c = p.p(x, y + dy, z + dz);
    p.g.fillStyle(C.woodDark);
    p.g.fillCircle(c.x, c.y, 3.3);
    p.g.fillStyle(0xc89a68);
    p.g.fillCircle(c.x, c.y, 2);
  }
}

/** Flat roof with a low parapet: the inner floor sits a little lower than the wall top. */
function roofTop(p: Pen, x0: number, y0: number, x1: number, y1: number, z: number, color: number) {
  const i = 0.05;
  p.rect(shade(color, 0.9), x0 + i, y0 + i, x1 - i, y1 - i, z);
  p.poly(shade(color, 0.74), [[x0 + i, y0 + i, z], [x1 - i, y0 + i, z], [x1 - i, y0 + i, z - 2.5], [x0 + i, y0 + i, z - 2.5]]);
  p.poly(shade(color, 0.8), [[x0 + i, y0 + i, z], [x0 + i, y1 - i, z], [x0 + i, y1 - i, z - 2.5], [x0 + i, y0 + i, z - 2.5]]);
}

/** Faint mud-brick courses on the visible faces of a box. */
function bricks(p: Pen, x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, color: number, alpha = 0.3) {
  let row = 0;
  for (let z = z0 + 3.5; z < z1 - 1; z += 3.5, row++) {
    const [s, e] = [p.south(color, 0.72, 0.48), p.east(color, 0.72, 0.48)];
    p.line(s, 1, [x0, y1, z], [x1, y1, z], alpha);
    p.line(e, 1, [x1, y0, z], [x1, y1, z], alpha);
    for (let x = x0 + (row % 2 ? 0.09 : 0.18); x < x1 - 0.02; x += 0.18) p.line(s, 1, [x, y1, z - 3.5], [x, y1, z], alpha * 0.8);
    for (let y = y0 + (row % 2 ? 0.09 : 0.18); y < y1 - 0.02; y += 0.18) p.line(e, 1, [x1, y, z - 3.5], [x1, y, z], alpha * 0.8);
  }
}

/**
 * A box built of unhewn fieldstones: rough courses of irregular stones in varied tones over dark
 * mortar, on the lit south face, the shaded east face and the top.
 */
function rubble(p: Pen, x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, color: number, seed: number, course = 5) {
  const r = createRng(seed);
  const j = (a: number) => (r() - 0.5) * a;
  const lit = p.south(color, 0.92, 0.64);
  const dark = p.east(color, 0.92, 0.64);
  p.box(x0, y0, x1, y1, z0, z1, shade(color, 0.7), shade(color, 0.92 * 0.62), shade(color, 0.64 * 0.62));
  for (let z = z0; z < z1 - 1; z += course) {
    const zt = Math.min(z1, z + course);
    for (const face of ['south', 'east'] as const) {
      const [a0, a1] = face === 'south' ? [x0, x1] : [y0, y1];
      const base = face === 'south' ? lit : dark;
      for (let a = a0; a < a1 - 0.03; ) {
        const b = Math.min(a1, a + 0.09 + r() * 0.13);
        const q: [number, number][] = [[a + 0.012, z + 0.7 + j(1)], [b - 0.012, z + 0.7 + j(1)], [b - 0.012 + j(0.02), zt - 0.6 + j(1)], [a + 0.012 + j(0.02), zt - 0.6]];
        const col = shade(base, 0.9 + r() * 0.2);
        p.poly(col, q.map(([s, zz]) => (face === 'south' ? [s, y1, Math.min(zt, zz)] : [x1, s, Math.min(zt, zz)]) as P3));
        a = b;
      }
    }
  }
  for (let x = x0; x < x1 - 0.03; x += 0.16) {
    for (let y = y0; y < y1 - 0.03; y += 0.16) {
      const xb = Math.min(x1, x + 0.16);
      const yb = Math.min(y1, y + 0.16);
      p.poly(shade(color, 0.92 + r() * 0.22), [[x + 0.015 + j(0.02), y + 0.015, z1], [xb - 0.015, y + 0.015 + j(0.02), z1], [xb - 0.015 + j(0.02), yb - 0.015, z1], [x + 0.015, yb - 0.015 + j(0.02), z1]]);
    }
  }
}

/** Canvas for a w x h footprint (cells) with art rising up to `height` px above the ground. */
function footCanvas(w: number, h: number, height: number) {
  const pad = 8;
  const east = 36; // room for shadows cast to the east
  const halfW = ((w + h) / 2) * HW;
  const halfH = ((w + h) / 2) * HH;
  return { w: Math.ceil(halfW * 2 + pad * 2 + east), h: Math.ceil(height + halfH * 2 + pad * 2), ax: halfW + pad, ay: height + halfH + pad };
}

/** Stone paving over a street: a mortar bed and rows of worn limestone setts (center and arms). */
function pavers(p: Pen, w: number, has: (k: number) => boolean) {
  const inside = (x: number, y: number) =>
    (Math.abs(x) <= w && Math.abs(y) <= w) ||
    (has(0) && Math.abs(x) <= w && y < 0) ||
    (has(2) && Math.abs(x) <= w && y > 0) ||
    (has(1) && Math.abs(y) <= w && x > 0) ||
    (has(3) && Math.abs(y) <= w && x < 0);
  const r = createRng(77);
  const step = 0.125;
  for (let y = -0.5 + step / 2; y < 0.5; y += step) {
    for (let x = -0.5 + step / 2; x < 0.5; x += step) {
      if (!inside(x, y)) continue;
      p.rect(shade(C.rockDark, 1.1), x - step / 2, y - step / 2, x + step / 2, y + step / 2);
      const k = 0.9 + r() * 0.18;
      const o = (Math.round((y + 0.5) / step) % 2) * 0.02;
      p.rect(shade(C.stone, k), x - step / 2 + 0.012 + o, y - step / 2 + 0.012, x + step / 2 - 0.012 + o, y + step / 2 - 0.012);
    }
  }
}

/** Wooden scaffold over a footprint: a stone course, corner poles, beams, a ladder and a pile of stones. */
function scaffold(p: Pen, w: number, h: number) {
  const x0 = -w / 2 + 0.12;
  const y0 = -h / 2 + 0.12;
  const x1 = w / 2 - 0.12;
  const y1 = h / 2 - 0.12;
  const top = 18 + 6 * Math.min(w, h);
  p.rect(shade(C.sand[0], 0.92), x0 - 0.06, y0 - 0.06, x1 + 0.06, y1 + 0.06);
  // First course of stones along the back walls.
  p.box(x0, y0, x1, y0 + 0.16, 0, 7, C.stone);
  p.box(x0, y0, x0 + 0.16, y1, 0, 7, C.stone);
  const pole = (x: number, y: number) => p.line(C.woodDark, 2.4, [x, y, 0], [x, y, top]);
  const beam = (a: P3, b: P3) => p.line(C.wood, 2, a, b);
  pole(x0, y0);
  pole(x1, y0);
  pole(x0, y1);
  for (const z of [top * 0.5, top]) {
    beam([x0, y0, z], [x1, y0, z]);
    beam([x0, y0, z], [x0, y1, z]);
  }
  // Planks on the upper beams.
  p.rect(C.wood, x0, y0, x1, y0 + 0.14, top * 0.5 + 1);
  pole(x1, y1);
  for (const z of [top * 0.5, top]) {
    beam([x1, y0, z], [x1, y1, z]);
    beam([x0, y1, z], [x1, y1, z]);
  }
  beam([x0, y1, 2], [x1, y1, top * 0.5]); // diagonal brace
  // Ladder leaning on the front.
  const lx = x1 - 0.25;
  p.line(C.wood, 1.6, [lx, y1 + 0.18, 0], [lx, y1, top * 0.55]);
  p.line(C.wood, 1.6, [lx + 0.14, y1 + 0.18, 0], [lx + 0.14, y1, top * 0.55]);
  for (let k = 1; k < 5; k++) {
    const t = k / 5;
    p.line(C.woodDark, 1, [lx, y1 + 0.18 * (1 - t), top * 0.55 * t], [lx + 0.14, y1 + 0.18 * (1 - t), top * 0.55 * t]);
  }
  // Stones piled at the front corner.
  const r = createRng(31);
  for (let k = 0; k < 7; k++) p.ball(r() < 0.5 ? C.rock : C.rockLight, x0 + 0.15 + r() * 0.3, y1 - 0.05 + r() * 0.15, 2 + (k > 4 ? 3 : 0), 2.4);
}

/** Creates the scaffold texture for a footprint size on first use and returns its key. */
export function scaffoldTexture(scene: Phaser.Scene, w: number, h: number): string {
  const key = TEX.scaffold(w, h);
  make(scene, key, footCanvas(w, h, 24 + 6 * Math.min(w, h)), (p) => scaffold(p, w, h));
  return key;
}

/** Extra ground detail on some cells: wild flowers and a bush on grass, pebbles and a shrub on sand. */
function groundDeco(p: Pen, kind: Ground, v: number, turf: Turf | null = null) {
  const r = createRng(700 + v * 13 + kind.length);
  const spot = (m: number) => [-m + r() * m * 2, -m + r() * m * 2] as const;
  if (kind === 'grass') {
    const petals = turf ? turf.deco : [0xf2e6b0, 0xd98a6a, 0xb59ad8, 0xf4f0e6, 0xe8c040];
    for (let i = 0; i < 9; i++) {
      const [x, y] = spot(0.36);
      if (turf?.flowers) flower(p, petals[(i + v) % petals.length], x, y);
      else p.ball(petals[(i + v) % petals.length], x, y, 2, 1.1);
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const [x, y] = spot(0.3);
      p.ball(i % 2 ? C.rockLight : C.rock, x, y, 0.5, 1.3);
    }
  }
  // A low round bush with a soft shadow, on half of the variants.
  if (v % 2) return;
  const [bx, by] = spot(0.22);
  const c = p.p(bx, by);
  p.g.fillStyle(C.shadow, 0.12);
  p.g.fillEllipse(c.x + 2, c.y + 1, 9, 3);
  const leaf = kind === 'grass' ? (turf ? shade(turf.tuft, 1.05) : C.olive) : turf?.cracks ? 0xa08a58 : shade(C.oliveLight, 0.95);
  p.ball(leaf, bx, by, 3, 3.2);
  p.ball(shade(leaf, 1.15), bx - 0.03, by - 0.02, 4.5, 2);
}

// ---------- houses (2 x 2: local x, y in [-1, 1]) ----------
// Every level has its own look so it reads at a glance even zoomed out: dark cloth tents, ochre
// mud cubes, stone-and-mud houses, big limestone houses. Variants change the shape, not only colour.

const HOLE = 0x3a2818;
const REED = [0xc2a463, 0xa98a4c, 0x8a6f3a] as const;

/** Point inside quad q at (u, v): u runs from q[0] to q[1], v from q[0] to q[3]. */
function inQuad(q: P3[], u: number, v: number): P3 {
  const w = [(1 - u) * (1 - v), u * (1 - v), u * v, (1 - u) * v];
  return [0, 1, 2].map((i) => q.reduce((sum, c, k) => sum + (c[i] ?? 0) * w[k], 0)) as P3;
}

/** Part of quad q between u0..u1 and v0..v1 (stripes, patches, panels on any face). */
function subQuad(q: P3[], u0: number, u1: number, v0: number, v1: number): P3[] {
  return [inQuad(q, u0, v0), inQuad(q, u1, v0), inQuad(q, u1, v1), inQuad(q, u0, v1)];
}

/** Trodden earth under a house. */
function yard(p: Pen, s = 0.84, alpha = 0.85) {
  p.rect(shade(C.sand[0], 0.9), -s, -s, s, s, 0, alpha);
}

/** Door on the south face (plane y), with an optional frame or lintel colour. */
function doorS(p: Pen, y: number, x0: number, x1: number, h: number, frame?: number) {
  if (frame !== undefined) p.southQuad(frame, y + 0.001, x0 - 0.03, x1 + 0.03, 0, h + 2.5);
  if (!vacant) return p.southQuad(C.door, y + 0.002, x0, x1, 0, h);
  shutDoor(p, y, x0, x1, h);
}

/** A shut plank door barred with a beam across (an empty house). */
function shutDoor(p: Pen, y: number, x0: number, x1: number, h: number) {
  p.southQuad(p.south(C.wood, 0.95, 0.72), y + 0.002, x0, x1, 0, h);
  for (let x = x0 + (x1 - x0) / 3; x < x1 - 0.01; x += (x1 - x0) / 3) p.line(C.woodDark, 1, [x, y + 0.003, 0], [x, y + 0.003, h], 0.8);
  p.line(C.woodDark, 2.2, [x0 - 0.04, y + 0.004, h * 0.62], [x1 + 0.04, y + 0.004, h * 0.48]);
}

/** Small window on the south face, optionally framed in limestone. */
function winS(p: Pen, y: number, x: number, z: number, w = 0.12, h = 6, frame?: number) {
  if (frame !== undefined) p.southQuad(frame, y + 0.002, x - 0.025, x + w + 0.025, z - 1.5, z + h + 1.5);
  p.southQuad(HOLE, y + 0.003, x, x + w, z, z + h);
}

/** Small window on the east face. */
function winE(p: Pen, x: number, y: number, z: number, w = 0.12, h = 6, frame?: number) {
  if (frame !== undefined) p.eastQuad(frame, x + 0.002, y - 0.025, y + w + 0.025, z - 1.5, z + h + 1.5);
  p.eastQuad(HOLE, x + 0.003, y, y + w, z, z + h);
}

/** Reed mat roof or shade on top of a box. */
function reedTop(p: Pen, x0: number, y0: number, x1: number, y1: number, z: number) {
  p.box(x0, y0, x1, y1, z, z + 2, REED[0], REED[1], REED[2]);
  for (let y = y0 + 0.04; y < y1 - 0.02; y += 0.06) p.line(0x9c7f45, 1, [x0 + 0.02, y, z + 2], [x1 - 0.02, y, z + 2], 0.7);
}

/** Reed shade on four poles over a roof at height z. */
function reedShade(p: Pen, x0: number, y0: number, x1: number, y1: number, z: number, high = 14) {
  for (const [x, y] of [[x0 + 0.04, y0 + 0.04], [x1 - 0.04, y0 + 0.04], [x0 + 0.04, y1 - 0.04], [x1 - 0.04, y1 - 0.04]] as const)
    p.line(C.woodDark, 1.5, [x, y, z], [x, y, z + high]);
  reedTop(p, x0, y0, x1, y1, z + high);
}

/** Puffs of pale smoke rising from (x, y, z). */
function smoke(p: Pen, x: number, y: number, z: number) {
  if (vacant) return;
  [[0, 0, 3.5, 0.45], [0.05, -0.04, 4.5, 0.35], [0.12, -0.08, 5.5, 0.25]].forEach(([dx, dy, r, a], k) =>
    p.ball(0xf0ebe2, x + dx, y + dy, z + 5 + k * 7, r, a * 0.8),
  );
}

/** Ring of stones with burning logs, a tripod and a pot. */
function campfire(p: Pen, x: number, y: number, big = false) {
  const r = createRng(5);
  const rr = big ? 0.17 : 0.12;
  p.disc(0x3a2c20, x, y, 0, rr);
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    p.ball(shade(C.rock, 0.9 + r() * 0.2), x + Math.cos(a) * rr, y + Math.sin(a) * rr, 1.5, big ? 2.4 : 2);
  }
  p.line(C.woodDark, 2, [x - 0.08, y + 0.05, 1], [x + 0.08, y - 0.05, 2]);
  p.line(C.woodDark, 2, [x - 0.06, y - 0.07, 2], [x + 0.07, y + 0.06, 1]);
  const c = p.p(x, y, 2);
  const h = big ? 15 : 9;
  p.g.fillStyle(0xe8742c, 0.9);
  p.g.fillTriangle(c.x - 5, c.y, c.x + 5, c.y, c.x - 1, c.y - h);
  p.g.fillTriangle(c.x - 3, c.y, c.x + 6, c.y, c.x + 3, c.y - h * 0.75);
  p.g.fillStyle(0xf6c84c);
  p.g.fillTriangle(c.x - 3, c.y, c.x + 3, c.y, c.x, c.y - h * 0.6);
  p.g.fillStyle(0xfff3c4);
  p.g.fillCircle(c.x, c.y - 1.5, 1.6);
  if (!big) return;
  // Tripod with a hanging pot.
  for (const [dx, dy] of [[-0.2, 0.1], [0.2, 0.1], [0, -0.22]] as const) p.line(C.woodDark, 1.5, [x + dx, y + dy, 0], [x, y, 26]);
  p.line(0x2a2420, 1, [x, y, 26], [x, y, 18]);
  p.ball(0x3a3330, x, y, 15, 4);
  p.ball(0x5a524c, x - 0.03, y - 0.03, 17, 1.6);
  smoke(p, x + 0.05, y - 0.05, 26);
}

/** A goat standing on the ground point (x, y), seen from the side. */
function goat(p: Pen, x: number, y: number, coat: number, patch: number, face = -1) {
  if (vacant) return;
  const g = p.p(x, y, 0);
  p.g.fillStyle(C.shadow, 0.22);
  p.g.fillEllipse(g.x + 1, g.y, 14, 4);
  p.g.lineStyle(1.5, 0x3a2c20);
  for (const dx of [-4, -2, 3, 5]) p.g.lineBetween(g.x + dx, g.y - 4, g.x + dx, g.y);
  p.g.fillStyle(coat);
  p.g.fillEllipse(g.x, g.y - 6, 13, 6);
  p.g.fillStyle(patch);
  p.g.fillEllipse(g.x - face, g.y - 6.5, 5, 4);
  p.g.fillStyle(coat);
  p.g.fillCircle(g.x + 7 * face, g.y - 8, 2.5);
  p.g.lineStyle(1, 0x3a2c20);
  p.g.lineBetween(g.x + 8 * face, g.y - 10, g.x + 10 * face, g.y - 12);
  p.g.lineBetween(g.x - 6 * face, g.y - 7, g.x - 8 * face, g.y - 9);
}

/** Small hen pecking. */
function hen(p: Pen, x: number, y: number, color: number) {
  if (vacant) return;
  const c = p.p(x, y, 0);
  p.g.fillStyle(C.shadow, 0.2);
  p.g.fillEllipse(c.x + 1, c.y, 6, 2);
  p.g.fillStyle(color);
  p.g.fillEllipse(c.x, c.y - 2.5, 5, 3.5);
  p.g.fillCircle(c.x + 2.2, c.y - 4.2, 1.5);
  p.g.fillStyle(C.red);
  p.g.fillCircle(c.x + 2.4, c.y - 5.6, 0.8);
}

/** Pile of fieldstones stacked in layers around (x, y). */
function stonePile(p: Pen, x: number, y: number, layers: number, seed: number) {
  const r = createRng(seed);
  p.shadow(x - 0.18, y - 0.14, x + 0.18, y + 0.14, layers * 4, 0.18);
  for (let l = 0; l < layers; l++) {
    const n = layers - l;
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 2; k++) {
        const sx = x - n * 0.06 + i * 0.12 + (r() - 0.5) * 0.02;
        const sy = y - 0.08 + k * 0.1;
        const h = 3.2 + r() * 1.2;
        p.box(sx, sy, sx + 0.11, sy + 0.09, l * 3.6, l * 3.6 + h, shade(C.rock, 1.0 + r() * 0.16));
      }
    }
  }
}

/** Water jar and a smaller one beside it. */
function jars(p: Pen, x: number, y: number, z = 0, color = C.terracotta) {
  jar(p, x, y, z, 3.4, color);
  jar(p, x + 0.12, y + 0.1, z, 2.6, color);
}

/** Clothesline between two posts on a roof at height z, with drying cloths. */
function clothesline(p: Pen, a: [number, number], b: [number, number], z: number, cloths: number[]) {
  p.line(C.woodDark, 1.5, [a[0], a[1], z], [a[0], a[1], z + 12]);
  p.line(C.woodDark, 1.5, [b[0], b[1], z], [b[0], b[1], z + 12]);
  p.line(C.rope, 1, [a[0], a[1], z + 12], [b[0], b[1], z + 12]);
  if (vacant) return; // a bare line: the washing went with the family
  cloths.forEach((color, k) => {
    const t0 = (k + 0.4) / (cloths.length + 0.4);
    const t1 = t0 + 0.55 / (cloths.length + 0.4);
    const at = (t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const [ax, ay] = at(t0);
    const [bx, by] = at(t1);
    p.poly(color, [[ax, ay, z + 12], [bx, by, z + 12], [bx, by, z + 5], [ax, ay, z + 6]]);
  });
}

/** Courses of stone blocks on the lit (south) and shaded (east) faces of a box. */
function masonry(p: Pen, x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, color: number, alpha = 1) {
  const lit = p.south(color, 0.8, 0.5);
  const dark = p.east(color, 0.8, 0.5);
  let row = 0;
  for (let z = z0 + 4; z < z1; z += 4, row++) {
    p.line(lit, 1, [x0, y1, z], [x1, y1, z], 0.55 * alpha);
    p.line(dark, 1, [x1, y0, z], [x1, y1, z], 0.55 * alpha);
    for (let x = x0 + (row % 2 ? 0.07 : 0.14); x < x1; x += 0.14) p.line(lit, 1, [x, y1, z - 4], [x, y1, z], 0.45 * alpha);
    for (let y = y0 + (row % 2 ? 0.07 : 0.14); y < y1; y += 0.14) p.line(dark, 1, [x1, y, z - 4], [x1, y, z], 0.45 * alpha);
  }
}

// ----- level 0: plots -----

/** Plot, variant 0: the plan staked out with pegs and ropes, wall trenches dug along them. */
function plotStakes(p: Pen) {
  const s = 0.82;
  const earth = 0xcfa874;
  p.rect(earth, -s, -s, s, s, 0, 0.7);
  const [x0, x1, y0, y1] = [-0.62, 0.5, -0.62, 0.36];
  const lines: [P3, P3][] = [
    [[x0, y0], [x1, y0]], [[x0, y0], [x0, y1]], [[x1, y0], [x1, y1]], [[x0, y1], [-0.12, y1]], [[0.12, y1], [x1, y1]],
    [[x0, -0.3], [x1, -0.3]], [[-0.25, -0.3], [-0.25, y1]], [[0.13, -0.3], [0.13, y1]],
  ];
  for (const [a, b] of lines) p.line(shade(earth, 0.7), 4, a, b, 0.7);
  for (const [a, b] of lines) p.line(shade(earth, 1.15), 1, [a[0] - 0.04, a[1] + 0.04], [b[0] - 0.04, b[1] + 0.04], 0.6);
  const corners: P3[] = [[-s, -s], [s, -s], [s, s], [-s, s]];
  corners.forEach((c, k) => p.line(C.rope, 1.4, [c[0], c[1], 6], [corners[(k + 1) % 4][0], corners[(k + 1) % 4][1], 6]));
  corners.forEach(([x, y]) => p.box(x - 0.04, y - 0.04, x + 0.04, y + 0.04, 0, 11, C.wood));
  const flag = p.p(s, -s, 11);
  p.g.fillStyle(C.red);
  p.g.fillTriangle(flag.x, flag.y, flag.x + 9, flag.y + 2, flag.x, flag.y + 5);
  for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1], [-0.25, -0.3], [0.13, -0.3]] as const) p.box(x - 0.025, y - 0.025, x + 0.025, y + 0.025, 0, 5, C.woodDark);
  // Earth thrown out of the trenches, a basket of pegs, a coil of rope and a mallet.
  for (const [x, y] of [[-0.72, 0.1], [-0.4, -0.72], [0.6, -0.1]] as const) dome(p, x, y, 0, 0.09, 4, shade(earth, 0.9));
  cylinder(p, 0.52, 0.62, 0.09, 0, 6, 0xb08a52);
  for (const dx of [-0.03, 0, 0.03]) p.line(C.woodDark, 1.5, [0.52 + dx, 0.62 - dx, 5], [0.52 + dx, 0.62 - dx, 10]);
  p.disc(shade(C.rope, 0.8), -0.4, 0.62, 0, 0.1);
  p.disc(C.rope, -0.4, 0.62, 1.5, 0.07);
  p.disc(shade(C.rope, 0.8), -0.4, 0.62, 1.6, 0.03);
  p.line(C.wood, 2, [0.05, 0.58], [0.25, 0.66]);
  p.box(0.0, 0.53, 0.08, 0.62, 0, 3, C.woodDark);
}

/** Plot, variant 1: a foundation course laid and fieldstones stacked ready to build. */
function plotStones(p: Pen) {
  const s = 0.82;
  p.rect(0xcfa874, -s, -s, s, s, 0, 0.7);
  p.rect(shade(0xcfa874, 0.92), -0.62, -0.62, 0.36, 0.22, 0, 0.8);
  const r = createRng(17);
  const stones: [number, number][] = [];
  for (let t = -0.62; t <= 0.36; t += 0.11) stones.push([t, -0.62], [t, 0.22]);
  for (let t = -0.51; t < 0.22; t += 0.11) stones.push([-0.62, t], [0.36, t]);
  stones.sort((a, b) => a[0] + a[1] - b[0] - b[1]).forEach(([x, y]) => {
    if (y === 0.22 && x > -0.2 && x < 0.0) return; // door gap
    const h = 3 + r() * 2.5;
    p.box(x - 0.05, y - 0.045, x + 0.05, y + 0.045, 0, h, shade(C.rock, 1.04 + r() * 0.12));
  });
  stonePile(p, 0.55, -0.45, 3, 31);
  stonePile(p, 0.52, 0.5, 4, 37);
  stonePile(p, -0.48, 0.58, 2, 39);
  // Wooden sledge for hauling stones and a water jar.
  p.box(-0.05, 0.48, 0.25, 0.64, 0, 2.5, C.wood);
  p.box(0.02, 0.51, 0.13, 0.61, 2.5, 6, shade(C.rock, 1.1));
  jar(p, -0.72, 0.3, 0, 3.2);
  for (const [x, y] of [[-0.1, -0.2], [0.1, -0.35]] as const) p.ball(shade(C.rock, 0.95), x, y, 1.5, 2);
}

// ----- level 1: tents -----

interface Cloth {
  color: number;
  /** Long strips sewn along the ridge, in alternating shades. */
  stripes?: boolean;
  /** Number of patches sewn on the cloth. */
  patches?: number;
}

/** Stripes and patches over a cloth face q (u along the ridge). */
function clothDetail(p: Pen, q: P3[], c: Cloth, base: number, seed: number) {
  if (c.stripes) {
    const n = 5;
    for (let k = 0; k < n; k += 2) p.poly(shade(base, 0.8), subQuad(q, 0, 1, k / n, (k + 0.7) / n));
    for (let k = 1; k < n; k += 2) p.poly(shade(base, 1.15), subQuad(q, 0, 1, k / n + 0.04, k / n + 0.1), 0.8);
  }
  const r = createRng(seed);
  for (let k = 0; k < (c.patches ?? 0); k++) {
    const u = 0.08 + r() * 0.7;
    const v = 0.1 + r() * 0.55;
    const pc = [shade(base, 0.74), 0x8a5a3c, shade(base, 1.12), 0x6e4a32][k % 4];
    const quad = subQuad(q, u, u + 0.12 + r() * 0.08, v, v + 0.25 + r() * 0.15);
    p.poly(pc, quad);
    p.g.lineStyle(1, shade(base, 0.55), 0.6);
    p.g.strokePoints(quad.map(([x, y, z]) => p.p(x, y, z ?? 0)), true);
  }
}

/**
 * Long low tent with the ridge along x, its front slope raised on poles so the south side is open:
 * the dark interior shows a rug and cushions.
 */
function longTent(p: Pen, x0: number, x1: number, yb: number, yf: number, zr: number, ze: number, c: Cloth, seed = 3) {
  const ry = (yb + yf) / 2;
  const cloth = c.color;
  p.shadow(x0, yb, x1, yf, zr * 0.8);
  for (let x = x0 + 0.1; x < x1; x += Math.max(0.3, (x1 - x0 - 0.2) / 2)) p.line(C.rope, 1, [x, yb, ze], [x, yb - 0.2, 0], 0.8);
  p.poly(shade(cloth, 0.9), [[x0, yb, ze], [x1, yb, ze], [x1, ry, zr], [x0, ry, zr]]);
  p.southQuad(0x231a12, yb, x0, x1, 0, ze);
  p.rect(0x2e231a, x0, yb, x1, yf);
  p.rect(C.red, x0 + 0.12, ry - 0.18, x1 - 0.16, yf - 0.06, 0, 0.9);
  for (let x = x0 + 0.2; x < x1 - 0.16; x += 0.14) p.line(C.cream, 1, [x, ry - 0.18], [x, yf - 0.06], 0.5);
  p.ball(C.cream, x0 + 0.28, ry - 0.1, 3, 3);
  p.ball(C.gold, x0 + 0.48, ry - 0.12, 3, 3);
  const front: P3[] = [[x0, ry, zr], [x1, ry, zr], [x1, yf, ze], [x0, yf, ze]];
  const lit = p.south(cloth, 1.18, 0.86);
  p.poly(lit, front);
  clothDetail(p, front, c, lit, seed);
  p.line(shade(cloth, 1.5), 1, [x0, yf, ze], [x1, yf, ze], 0.8);
  p.line(C.woodDark, 2, [x0, ry, zr], [x1, ry, zr]);
  // East end curtain.
  p.poly(p.east(cloth, 1.05, 0.72), [[x1, yb, 0], [x1, yf, 0], [x1, yf, ze], [x1, ry, zr], [x1, yb, ze]]);
  p.line(shade(cloth, 0.55), 1.5, [x1, ry, 0], [x1, ry, zr], 0.8);
  for (const x of [x0 + 0.04, (x0 + x1) / 2, x1 - 0.04]) p.line(C.wood, 2, [x, yf, 0], [x, yf, ze + 1]);
  for (const x of [x0 + 0.04, x1 - 0.04]) p.line(C.rope, 1, [x, yf, ze], [x, yf + 0.26, 0], 0.9);
  p.line(C.rope, 1, [x1, ry, zr], [x1 + 0.28, ry, 0], 0.9);
}

/** Tent with the ridge along y: a tall triangular door end faces south. */
function gableTent(p: Pen, xc: number, y0: number, y1: number, half: number, zr: number, c: Cloth, seed = 7) {
  const [xa, xb] = [xc - half, xc + half];
  const cloth = c.color;
  p.shadow(xa, y0, xb, y1, zr * 0.7);
  p.line(C.rope, 1, [xc, y0, zr], [xc, y0 - 0.25, 0], 0.8);
  p.poly(shade(cloth, 0.9), [[xa, y0, 1], [xc, y0, zr], [xc, y1, zr], [xa, y1, 1]]);
  const east: P3[] = [[xc, y1, zr], [xc, y0, zr], [xb, y0, 1], [xb, y1, 1]];
  const side = p.east(cloth, 1.15, 0.74);
  p.poly(side, east);
  clothDetail(p, east, c, side, seed);
  p.line(shade(cloth, 0.5), 1, [xb, y0, 1], [xb, y1, 1], 0.8);
  const gable = p.south(cloth, 1.02, 0.7);
  p.poly(gable, [[xa, y1, 1], [xb, y1, 1], [xc, y1, zr]]);
  p.poly(0x231a12, [[xc - half * 0.38, y1 + 0.002, 0], [xc + half * 0.38, y1 + 0.002, 0], [xc, y1 + 0.002, zr * 0.66]]);
  p.poly(shade(gable, 1.15), [[xc + half * 0.38, y1 + 0.004, 0], [xc + half * 0.62, y1 + 0.004, 0], [xc + 0.01, y1 + 0.004, zr * 0.66]]);
  p.line(C.woodDark, 2, [xc, y1, zr - 2], [xc, y1, zr + 4]);
  p.line(C.rope, 1, [xc, y1, zr], [xc, y1 + 0.3, 0], 0.9);
  for (const x of [xa + 0.05, xb - 0.05]) p.box(x - 0.02, y1 + 0.04, x + 0.02, y1 + 0.08, 0, 3, C.woodDark);
}

const DARK_CLOTH: Cloth = { color: C.tentCloth, stripes: true };

/** Tent 0: the long dark goat-hair tent with striped cloth. */
function tentStriped(p: Pen) {
  yard(p, 0.9, 0.5);
  longTent(p, -0.84, 0.55, -0.72, 0.18, 28, 12, DARK_CLOTH);
  jars(p, -0.66, 0.5);
  logs(p, 0.66, 0.42, 0, 3);
  p.box(-0.25, 0.48, 0.05, 0.6, 0, 3, 0xd8c08a);
  p.disc(shade(C.rock, 0.85), 0.22, 0.62, 0, 0.08);
  p.disc(C.rock, 0.22, 0.62, 3, 0.06);
}

/** Tent 1: a gable tent of light, much-patched cloth with a water skin on a tripod. */
function tentPatched(p: Pen) {
  yard(p, 0.9, 0.5);
  gableTent(p, -0.15, -0.8, 0.3, 0.5, 31, { color: 0xa88f6a, patches: 6 });
  p.rect(0xc9a46a, -0.5, 0.42, 0.1, 0.78);
  for (let x = -0.46; x < 0.1; x += 0.08) p.line(0xa98a4c, 1, [x, 0.44], [x, 0.76], 0.7);
  cylinder(p, -0.3, 0.6, 0.08, 0, 6, 0xb08a52);
  for (const k of [0, 1, 2]) p.ball([C.red, C.gold, 0x7a4f6a][k], -0.32 + k * 0.03, 0.58, 7, 1.6);
  const [tx, ty] = [0.55, 0.45];
  for (const [dx, dy] of [[-0.12, 0.08], [0.12, 0.08], [0, -0.13]] as const) p.line(C.woodDark, 1.5, [tx + dx, ty + dy, 0], [tx, ty, 22]);
  p.ball(0x6e4b2e, tx, ty, 12, 4.5);
  p.ball(0x8a6040, tx - 0.03, ty - 0.03, 14, 2);
  jar(p, 0.6, -0.4, 0, 3.4);
}

/** Tent 2: two tents, a long one at the back and a small gable tent in front. */
function tentDouble(p: Pen) {
  yard(p, 0.9, 0.5);
  longTent(p, -0.88, 0.25, -0.86, -0.16, 24, 10, DARK_CLOTH, 4);
  gableTent(p, 0.45, -0.42, 0.55, 0.32, 23, { color: shade(C.tentCloth, 1.3), patches: 2 }, 9);
  p.line(C.rope, 1, [-0.7, 0.0, 10], [0.2, 0.5, 12], 0.9);
  p.poly(C.clothes[1], [[-0.5, 0.11, 10.5], [-0.35, 0.19, 10.8], [-0.35, 0.19, 4], [-0.5, 0.11, 4]]);
  p.poly(C.cream, [[-0.2, 0.28, 11.2], [-0.05, 0.36, 11.4], [-0.05, 0.36, 5], [-0.2, 0.28, 5]]);
  jars(p, -0.72, 0.5);
  campfire(p, -0.2, 0.62);
}

/** Tent 3: a dark tent with a striped awning stretched in front over a mat and cushions. */
function tentAwning(p: Pen) {
  yard(p, 0.9, 0.5);
  const [x0, x1, yf, ya] = [-0.84, 0.5, 0.0, 0.62];
  longTent(p, x0, x1, -0.86, yf, 26, 12, { color: C.tentCloth, patches: 2 }, 5);
  p.rect(0xb8653e, x0 + 0.08, yf + 0.04, x1 - 0.1, ya - 0.06, 0, 0.9);
  for (let x = x0 + 0.16; x < x1 - 0.1; x += 0.12) p.line(C.cream, 1, [x, yf + 0.04], [x, ya - 0.06], 0.45);
  p.ball(C.gold, -0.5, 0.3, 3, 3.2);
  p.ball(C.cream, -0.3, 0.36, 3, 3.2);
  jar(p, 0.2, 0.3, 0, 3);
  const aw: P3[] = [[x0, yf, 12], [x1, yf, 12], [x1, ya, 11], [x0, ya, 11]];
  const n = 8;
  for (let k = 0; k < n; k++) p.poly(k % 2 ? C.cream : C.woodWarm, subQuad(aw, k / n, (k + 1) / n, 0, 1), 0.95);
  p.line(shade(C.cream, 0.7), 1, [x0, ya, 11], [x1, ya, 11]);
  for (const x of [x0 + 0.03, x1 - 0.03]) {
    p.line(C.wood, 2, [x, ya, 0], [x, ya, 12]);
    p.line(C.rope, 1, [x, ya, 11], [x, ya + 0.24, 0], 0.9);
  }
  jars(p, 0.66, 0.2);
}

/** Tent 4: a gable tent with a big campfire, a cooking pot on a tripod and log seats. */
function tentFire(p: Pen) {
  yard(p, 0.9, 0.5);
  gableTent(p, -0.38, -0.86, 0.22, 0.46, 29, { color: C.tentCloth, stripes: true }, 11);
  logs(p, 0.25, -0.5, 0, 3);
  p.line(C.wood, 4, [0.12, 0.26], [0.36, 0.2]);
  p.line(C.wood, 4, [0.72, 0.42], [0.74, 0.66]);
  campfire(p, 0.42, 0.52, true);
  jars(p, -0.66, 0.5);
}

/** Tent 5: a long tent with two goats tethered to a stake and a manger of hay. */
function tentGoats(p: Pen) {
  yard(p, 0.9, 0.5);
  longTent(p, -0.84, 0.4, -0.84, 0.02, 25, 11, { color: C.tentCloth, stripes: true, patches: 1 }, 6);
  p.box(0.52, -0.6, 0.78, -0.2, 0, 6, C.wood);
  p.rect(C.wheat, 0.55, -0.57, 0.75, -0.23, 6);
  for (let k = 0; k < 5; k++) p.ball(shade(C.wheat, 0.9 + k * 0.05), 0.58 + (k % 3) * 0.07, -0.52 + k * 0.06, 7.5, 2);
  const stake: P3 = [0.3, 0.5, 0];
  p.line(C.woodDark, 2, stake, [0.3, 0.5, 7]);
  p.line(C.rope, 1, [0.3, 0.5, 5], [0.0, 0.66, 6], 0.9);
  p.line(C.rope, 1, [0.3, 0.5, 5], [0.62, 0.62, 6], 0.9);
  goat(p, -0.02, 0.66, 0xe9ddc8, 0x6b4a30, -1);
  goat(p, 0.64, 0.64, 0x4a3a2c, 0x2e231a, 1);
  jar(p, -0.66, 0.46, 0, 3.4);
}

// ----- level 2: mud houses -----

const MUD_H = 28;

/** A mud-brick block with brick courses and a flat roof with a parapet. */
function mudBlock(p: Pen, x0: number, y0: number, x1: number, y1: number, h: number, color = C.mud) {
  p.box(x0, y0, x1, y1, 0, h, shade(color, 1.06), color, shade(color, 0.66));
  bricks(p, x0, y0, x1, y1, 0, h, color);
  roofTop(p, x0, y0, x1, y1, h, color);
}

/** Roof beam ends sticking out of the south face. */
function beamEnds(p: Pen, x0: number, x1: number, y: number, h: number) {
  for (let x = x0 + 0.1; x < x1 - 0.05; x += 0.16) p.box(x, y, x + 0.05, y + 0.05, h - 6, h - 3, C.woodDark);
}

/** The one-room mud house: body, beam ends, door and a small window on both faces. */
function mudRoom(p: Pen, x0: number, y0: number, x1: number, y1: number, h = MUD_H, door = 0.35) {
  mudBlock(p, x0, y0, x1, y1, h);
  beamEnds(p, x0, x1, y1, h);
  const dx = x0 + (x1 - x0) * door;
  p.southQuad(shade(C.mud, 0.8), y1 + 0.001, dx - 0.02, dx + 0.24, 0, 17);
  doorS(p, y1, dx + 0.01, dx + 0.21, 15);
  winS(p, y1, x1 - 0.2, 15, 0.1, 5);
  winE(p, x1, y0 + 0.3, 15, 0.1, 5);
}

/** Low mud yard wall segment. */
function mudWall(p: Pen, x0: number, y0: number, x1: number, y1: number, h = 9) {
  p.box(x0, y0, x1, y1, 0, h, shade(C.mud, 0.98), shade(C.mud, 0.9), shade(C.mud, 0.64));
}

/** Mud 0: a plain cube with a rolled mat on the roof and a threshold stone. */
function mudPlain(p: Pen) {
  yard(p);
  const [x0, y0, x1, y1] = [-0.62, -0.66, 0.44, 0.3];
  p.shadow(x0, y0, x1, y1, MUD_H);
  mudRoom(p, x0, y0, x1, y1);
  p.box(-0.3, -0.4, 0.0, -0.3, MUD_H, MUD_H + 3, C.red);
  jar(p, 0.2, -0.45, MUD_H, 3);
  p.box(-0.3, y1, 0.02, y1 + 0.1, 0, 1.5, C.rock);
  jar(p, 0.58, 0.48, 0, 3.4);
  p.disc(shade(C.rock, 0.8), -0.5, 0.56, 0, 0.1);
  p.disc(C.rock, -0.5, 0.54, 3, 0.09);
}

/** Mud 1: the room with a lower side annex roofed with reeds for the animals. */
function mudAnnex(p: Pen) {
  yard(p);
  const [x0, y0, x1, y1] = [-0.86, -0.82, 0.08, 0.14];
  p.shadow(x0, y0, x1, y1, MUD_H);
  p.shadow(x1, -0.6, 0.78, 0.3, 17);
  mudRoom(p, x0, y0, x1, y1, MUD_H, 0.25);
  mudBlock(p, x1, -0.6, 0.78, 0.3, 16, shade(C.mud, 0.96));
  reedTop(p, x1 - 0.02, -0.64, 0.82, 0.34, 16);
  p.southQuad(HOLE, 0.301, 0.3, 0.56, 0, 11);
  p.line(C.wood, 1.5, [0.3, 0.302, 5], [0.56, 0.302, 5]);
  jar(p, -0.2, -0.55, MUD_H, 3);
  p.rect(0xc9a46a, -0.66, -0.6, -0.36, -0.3, MUD_H);
  p.ball(0xd8c08a, -0.62, 0.48, 4, 4.5);
  p.ball(shade(0xd8c08a, 0.85), -0.5, 0.56, 3, 4);
  goat(p, 0.5, 0.62, 0xe9ddc8, 0x6b4a30, 1);
}

/** Mud 2: a mud-brick stair against the east wall climbing to the roof. */
function mudStair(p: Pen) {
  yard(p);
  const [x0, y0, x1, y1] = [-0.82, -0.8, 0.22, 0.18];
  p.shadow(x0, y0, x1 + 0.22, y1, MUD_H);
  mudRoom(p, x0, y0, x1, y1, MUD_H, 0.3);
  const n = 7;
  const d = (y1 - y0 - 0.1) / n;
  for (let k = n - 1; k >= 0; k--) {
    const ya = y1 - (k + 1) * d;
    p.box(x1, ya, x1 + 0.2, ya + d, 0, ((k + 1) * MUD_H) / n, shade(C.mud, 1.04), shade(C.mud, 0.92), shade(C.mud, 0.64));
  }
  p.rect(0xc9a46a, -0.65, -0.62, -0.25, -0.3, MUD_H);
  for (let k = 0; k < 9; k++) p.ball(0x7a4f6a, -0.6 + (k % 3) * 0.13, -0.57 + Math.floor(k / 3) * 0.1, MUD_H + 1, 1.4);
  person(p, -0.05, -0.2, MUD_H, 3, 0.8);
  jars(p, 0.55, 0.45);
  jar(p, -0.6, 0.5, 0, 3);
}

/** Mud 3: a big clay bread oven smoking in the front yard, with firewood and loaves. */
function mudOven(p: Pen) {
  yard(p);
  const [x0, y0, x1, y1] = [-0.86, -0.86, 0.2, 0.02];
  p.shadow(x0, y0, x1, y1, MUD_H);
  mudRoom(p, x0, y0, x1, y1);
  jar(p, 0.0, -0.6, MUD_H, 3);
  mudWall(p, 0.0, 0.16, 0.7, 0.24, 8);
  // Round clay oven (tabun) with a glowing mouth and a lid on top.
  dome(p, 0.36, 0.5, 0, 0.26, 15, shade(C.mud, 0.92));
  p.disc(shade(C.mud, 0.7), 0.36, 0.5, 15, 0.07);
  p.disc(0x2a1f17, 0.36, 0.5, 15.5, 0.045);
  const m = p.p(0.26, 0.72, 4);
  p.g.fillStyle(0x2a1f17);
  p.g.fillEllipse(m.x, m.y, 8, 6);
  if (!vacant) {
    p.g.fillStyle(0xe8742c);
    p.g.fillEllipse(m.x, m.y + 1, 5, 3);
    p.g.fillStyle(0xf6c84c);
    p.g.fillEllipse(m.x, m.y + 1.4, 2.4, 1.4);
  }
  smoke(p, 0.36, 0.5, 14);
  logs(p, 0.72, 0.1, 0, 3);
  for (let k = 0; k < 3; k++) p.disc(shade(C.cream, 0.92 - k * 0.04), -0.3, 0.55, k * 1.4, 0.1);
  p.box(-0.42, 0.44, -0.18, 0.66, 0, 0.1, C.wood);
  jar(p, -0.66, 0.36, 0, 3.4);
}

/** Mud 4: a yard fenced with brushwood and thorns, with hens. */
function mudFence(p: Pen) {
  yard(p);
  const [x0, y0, x1, y1] = [-0.72, -0.86, 0.32, 0.0];
  p.shadow(x0, y0, x1, y1, MUD_H);
  mudRoom(p, x0, y0, x1, y1, MUD_H, 0.4);
  jar(p, 0.1, -0.6, MUD_H, 3);
  p.box(-0.5, -0.5, -0.2, -0.4, MUD_H, MUD_H + 3, C.clothes[1]);
  hen(p, -0.2, 0.4, 0xe9ddc8);
  hen(p, 0.1, 0.55, 0x9a6a40);
  hen(p, 0.25, 0.3, 0xc28a5e);
  jar(p, -0.55, 0.18, 0, 3.2);
  const r = createRng(23);
  const fence = (a: [number, number], b: [number, number]) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(2, Math.round(len / 0.07));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const x = a[0] + (b[0] - a[0]) * t;
      const y = a[1] + (b[1] - a[1]) * t;
      const h = 8 + r() * 4;
      const lean = (r() - 0.5) * 0.05;
      p.line(k % 2 ? 0x7a5636 : 0x8f6a44, 1.5, [x, y, 0], [x + lean, y - lean, h]);
      p.ball(0x6a6a3a, x + lean, y - lean, h, 1.4, 0.9);
    }
    p.line(0x6e4b2e, 1.5, [a[0], a[1], 5], [b[0], b[1], 5]);
    p.line(0x6e4b2e, 1.2, [a[0], a[1], 8.5], [b[0], b[1], 8.5]);
  };
  fence([-0.86, 0.02], [-0.86, 0.86]);
  fence([0.86, -0.7], [0.86, 0.86]);
  fence([-0.86, 0.86], [-0.15, 0.86]);
  fence([0.15, 0.86], [0.86, 0.86]);
}

/** Mud 5: the flat roof crowded with storage jars, and a big jar by the door. */
function mudJars(p: Pen) {
  yard(p);
  const [x0, y0, x1, y1] = [-0.76, -0.76, 0.36, 0.24];
  p.shadow(x0, y0, x1, y1, MUD_H);
  mudRoom(p, x0, y0, x1, y1, MUD_H, 0.5);
  const spots: [number, number, number][] = [[-0.6, -0.6, 3.6], [-0.42, -0.6, 3.2], [-0.24, -0.62, 3.6], [-0.06, -0.6, 3], [0.14, -0.58, 3.4], [-0.6, -0.4, 3], [0.2, -0.38, 3.6], [-0.56, -0.2, 3.4], [0.16, -0.14, 3], [0.18, 0.06, 3.4]];
  spots.forEach(([x, y, r], k) => jar(p, x, y, MUD_H, r, k % 3 === 1 ? shade(C.terracotta, 1.15) : C.terracotta));
  p.rect(0xc9a46a, -0.4, -0.3, -0.05, 0.05, MUD_H);
  for (let k = 0; k < 6; k++) p.ball(C.wheat, -0.34 + (k % 3) * 0.1, -0.24 + Math.floor(k / 3) * 0.14, MUD_H + 1, 1.8);
  jar(p, -0.52, 0.42, 0, 5);
  jar(p, 0.56, 0.5, 0, 3);
}

// ----- level 3: stone houses -----

/**
 * The stone base is pale limestone and takes up most of the wall, so a stone house reads as a light
 * block with a thin mud-brick top even at the minimum zoom (a mud house is tan all the way up).
 */
const STONE_BASE = 26;
const STONE_H = 38;
/** Window sill height on the mud-brick upper part. */
const STONE_WIN = 28;

/** Pale limestone box: lit and shaded faces kept light so the stone reads against mud brick. */
function paleStone(p: Pen, x0: number, y0: number, x1: number, y1: number, z0: number, z1: number) {
  p.box(x0, y0, x1, y1, z0, z1, C.limestone, shade(C.limestone, 0.97), shade(C.limestone, 0.74));
}

/** Stone ground floor with a mud-brick upper part (or all stone when h <= base). */
function stoneBlock(p: Pen, x0: number, y0: number, x1: number, y1: number, base = STONE_BASE, h = STONE_H) {
  paleStone(p, x0, y0, x1, y1, 0, Math.min(base, h));
  masonry(p, x0, y0, x1, y1, 0, Math.min(base, h), C.stone, 0.75);
  if (h > base) {
    p.box(x0, y0, x1, y1, base, h, shade(C.mud, 1.08), C.mud, shade(C.mud, 0.66));
    bricks(p, x0, y0, x1, y1, base, h, C.mud, 0.22);
    // A dark joint where the mud brick sits on the stone.
    p.line(p.south(C.mud, 0.5, 0.4), 1.2, [x0, y1, base], [x1, y1, base], 0.8);
    p.line(p.east(C.mud, 0.5, 0.4), 1.2, [x1, y0, base], [x1, y1, base], 0.8);
  }
  roofTop(p, x0, y0, x1, y1, h, h > base ? C.mud : C.stone);
}

/** Low stone yard wall segment. */
function stoneWall(p: Pen, x0: number, y0: number, x1: number, y1: number, h = 10) {
  paleStone(p, x0, y0, x1, y1, 0, h);
  masonry(p, x0, y0, x1, y1, 0, h, C.stone, 0.6);
}

/** Potted plant at height z. */
function pot(p: Pen, x: number, y: number, z: number, size = 1) {
  p.box(x - 0.06 * size, y - 0.06 * size, x + 0.06 * size, y + 0.06 * size, z, z + 4 * size, C.terracotta);
  p.ball(C.leaf, x, y, z + 9 * size, 5 * size);
  p.ball(shade(C.leaf, 1.3), x - 0.02, y - 0.02, z + 11 * size, 2 * size);
}

/** The usual stone house front: a door with a limestone lintel and framed windows. */
function stoneFront(p: Pen, y0: number, x1: number, y1: number, door: number) {
  p.southQuad(C.limestone, y1 + 0.002, door - 0.03, door + 0.19, 12, 15);
  doorS(p, y1, door, door + 0.16, 12);
  winS(p, y1, x1 - 0.28, STONE_WIN, 0.13, 7, C.limestone);
  winE(p, x1, y0 + 0.3, STONE_WIN, 0.13, 7, C.limestone);
}

/** Stone 0: small framed windows, the outside stair and a bench by the door. */
function stoneWindow(p: Pen) {
  yard(p);
  const [x0, y0, x1, y1] = [-0.86, -0.86, 0.38, 0.16];
  p.shadow(x0, y0, x1, y1, STONE_H);
  stoneBlock(p, x0, y0, x1, y1);
  stoneFront(p, y0, x1, y1, -0.2);
  winS(p, y1, -0.55, STONE_WIN + 1, 0.08, 5, C.limestone);
  winE(p, x1, -0.6, 8, 0.08, 4);
  const steps = 8;
  for (let k = 0; k < steps; k++) {
    const sx = -0.86 + (steps - 1 - k) * 0.06;
    p.box(sx, y1, sx + 0.06, y1 + 0.13, 0, ((k + 1) * STONE_H) / steps, C.limestone, shade(C.limestone, 0.94), shade(C.limestone, 0.7));
  }
  jars(p, -0.3, -0.6, STONE_H);
  pot(p, 0.2, -0.1, STONE_H);
  p.box(0.02, 0.36, 0.38, 0.46, 0, 5, C.stone);
  jars(p, 0.58, 0.38);
  p.ball(C.wheat, -0.42, 0.52, 4, 4);
  p.ball(shade(C.wheat, 0.8), -0.42, 0.52, 2, 4);
}

/** Stone 1: two long clotheslines full of washing across the roof. */
function stoneLaundry(p: Pen) {
  yard(p);
  const [x0, y0, x1, y1] = [-0.74, -0.84, 0.5, 0.18];
  p.shadow(x0, y0, x1, y1, STONE_H);
  stoneBlock(p, x0, y0, x1, y1);
  stoneFront(p, y0, x1, y1, -0.4);
  clothesline(p, [-0.62, -0.72], [0.4, -0.72], STONE_H, [C.clothes[0], C.cream, C.clothes[1], C.clothes[2]]);
  clothesline(p, [-0.62, -0.18], [0.4, -0.18], STONE_H, [C.cream, C.clothes[3], C.clothes[0], C.cream]);
  cylinder(p, 0.0, -0.45, 0.1, STONE_H, STONE_H + 5, 0xb08a52);
  p.ball(C.cream, 0.0, -0.45, STONE_H + 6, 3);
  jars(p, 0.6, 0.4);
  jar(p, -0.55, 0.4, 0, 3.4);
}

/** Stone 2: a grapevine climbing the wall onto a pergola over the door. */
function stoneVine(p: Pen) {
  yard(p);
  const [x0, y0, x1, y1] = [-0.82, -0.86, 0.42, 0.06];
  p.shadow(x0, y0, x1, y1, STONE_H);
  stoneBlock(p, x0, y0, x1, y1);
  stoneFront(p, y0, x1, y1, -0.15);
  jars(p, -0.5, -0.6, STONE_H);
  const py = 0.5;
  p.box(-0.5, 0.26, -0.15, 0.36, 0, 5, C.stone);
  for (const x of [-0.6, 0.3]) p.line(C.woodDark, 2, [x, py, 0], [x, py, 24]);
  for (const x of [-0.6, -0.3, 0.0, 0.3]) p.line(C.wood, 1.5, [x, y1, 24], [x, py + 0.04, 24]);
  p.line(C.wood, 2, [-0.62, py, 24], [0.32, py, 24]);
  // Vine stem up the wall, leaves over the beams and the wall, hanging grapes.
  p.line(0x6e4b2e, 2, [-0.62, y1 + 0.01, 0], [-0.6, y1 + 0.01, 24]);
  const r = createRng(29);
  for (let k = 0; k < 26; k++) {
    const x = -0.64 + r() * 0.98;
    const y = y1 + r() * (py - y1 + 0.05);
    p.ball(k % 3 ? C.leaf : shade(C.leaf, 0.75), x, y, 24 + r() * 3, 3 + r() * 2);
  }
  for (let k = 0; k < 8; k++) p.ball(shade(C.leaf, 1.25), -0.6 + r() * 0.9, y1 + r() * 0.4, 27, 1.5);
  for (let k = 0; k < 7; k++) {
    const x = -0.62 + r() * 0.04;
    p.ball(k % 2 ? C.leaf : shade(C.leaf, 0.8), x, y1 + 0.01, 4 + k * 3, 3);
  }
  for (const [x, y] of [[-0.4, 0.4], [-0.1, 0.3], [0.15, 0.45]] as const) {
    p.ball(0x5e3a6a, x, y, 20, 2.4);
    p.ball(0x7a4f86, x - 0.01, y - 0.01, 18, 1.8);
  }
  jars(p, 0.6, 0.45);
}

/** Stone 3: a tall arched doorway of dressed limestone with steps and potted plants. */
function stoneArch(p: Pen) {
  yard(p);
  const [x0, y0, x1, y1] = [-0.74, -0.78, 0.48, 0.24];
  p.shadow(x0, y0, x1, y1, STONE_H);
  stoneBlock(p, x0, y0, x1, y1);
  const cx = -0.12;
  const arch = (r: number, z0: number, color: number, dy: number) => {
    const pts: P3[] = [[cx - r, y1 + dy, 0]];
    for (let k = 0; k <= 12; k++) {
      const a = Math.PI - (k / 12) * Math.PI;
      pts.push([cx + Math.cos(a) * r, y1 + dy, z0 + Math.sin(a) * r * 32]);
    }
    pts.push([cx + r, y1 + dy, 0]);
    p.poly(color, pts);
  };
  arch(0.2, 15, C.limestone, 0.002);
  arch(0.14, 13, C.door, 0.003);
  for (let k = 0; k < 7; k++) {
    const a = Math.PI - (k / 6) * Math.PI;
    p.line(shade(C.limestone, 0.75), 1, [cx + Math.cos(a) * 0.14, y1 + 0.004, 13 + Math.sin(a) * 4.5], [cx + Math.cos(a) * 0.2, y1 + 0.004, 15 + Math.sin(a) * 6.4]);
  }
  p.box(cx - 0.24, y1, cx + 0.24, y1 + 0.1, 0, 2.5, C.limestone);
  p.box(cx - 0.18, y1 + 0.1, cx + 0.18, y1 + 0.18, 0, 1.2, C.limestone);
  winS(p, y1, 0.22, STONE_WIN, 0.12, 7, C.limestone);
  winE(p, x1, -0.4, STONE_WIN, 0.12, 7, C.limestone);
  pot(p, cx - 0.36, y1 + 0.14, 0, 1.1);
  pot(p, cx + 0.36, y1 + 0.14, 0, 1.1);
  reedShade(p, -0.6, -0.66, -0.1, -0.2, STONE_H, 12);
  jars(p, 0.15, -0.5, STONE_H);
  jar(p, 0.62, 0.55, 0, 3.4);
}

/** Stone 4: two volumes, the tall house and a lower all-stone room with a roof terrace. */
function stoneTwo(p: Pen) {
  yard(p);
  const [x0, y0, x1, y1] = [-0.9, -0.9, 0.1, 0.02];
  p.shadow(x0, y0, x1, y1, STONE_H + 4);
  p.shadow(x1, -0.58, 0.8, 0.36, 20);
  stoneBlock(p, x0, y0, x1, y1, STONE_BASE, STONE_H + 4);
  p.southQuad(C.limestone, y1 + 0.002, -0.7, -0.48, 12, 15);
  doorS(p, y1, -0.67, -0.51, 12);
  winS(p, y1, -0.3, STONE_WIN + 2, 0.13, 7, C.limestone);
  stoneBlock(p, x1, -0.58, 0.8, 0.36, 20, 20);
  doorS(p, 0.36, 0.2, 0.36, 12, C.limestone);
  winS(p, 0.36, 0.52, 9, 0.1, 5);
  winE(p, 0.8, -0.3, 9, 0.12, 5);
  for (let x = x1 + 0.08; x < 0.78; x += 0.12) p.box(x, 0.32, x + 0.06, 0.36, 20, 23, C.limestone);
  p.rect(C.red, 0.2, -0.45, 0.6, -0.1, 20, 0.9);
  for (let x = 0.24; x < 0.6; x += 0.08) p.line(C.cream, 1, [x, -0.45, 20], [x, -0.1, 20], 0.5);
  jars(p, 0.55, 0.05, 20);
  jars(p, -0.6, -0.7, STONE_H + 4);
  pot(p, -0.2, -0.3, STONE_H + 4);
  jar(p, -0.6, 0.45, 0, 3.4);
}

/** Stone 5: a small yard walled in fieldstone, with an olive tree and a gate. */
function stoneYard(p: Pen) {
  yard(p);
  const [x0, y0, x1, y1] = [-0.86, -0.86, 0.3, 0.1];
  p.shadow(x0, y0, x1, y1, STONE_H);
  stoneWall(p, -0.86, y1, -0.76, 0.86);
  stoneBlock(p, x0, y0, x1, y1);
  stoneFront(p, y0, x1, y1, -0.4);
  reedShade(p, -0.1, -0.84, 0.26, -0.36, STONE_H);
  jars(p, -0.6, -0.6, STONE_H);
  tree(p, 0.56, -0.42, 0, 0.95, C.olive);
  p.box(-0.1, 0.36, 0.25, 0.46, 0, 5, C.stone);
  jars(p, 0.5, 0.3);
  stoneWall(p, 0.76, -0.4, 0.86, 0.86);
  stoneWall(p, -0.86, 0.76, -0.16, 0.86);
  stoneWall(p, 0.16, 0.76, 0.86, 0.86);
  for (const x of [-0.16, 0.16]) p.box(x - 0.05, 0.74, x + 0.05, 0.88, 0, 14, C.limestone);
}

// ----- level 4: big limestone houses -----

const TALL = 52;
const WING = 26;

/** Limewashed block. */
function lime(p: Pen, x0: number, y0: number, x1: number, y1: number, z0: number, z1: number) {
  p.box(x0, y0, x1, y1, z0, z1, shade(C.limeWash, 1.04), shade(C.limeWash, 0.9), shade(C.limeWash, 0.64));
}

/** Two-storey limestone range: masonry below, a string course, windows above and a flat roof. */
function upperRange(p: Pen, x0: number, y0: number, x1: number, y1: number, h = TALL) {
  lime(p, x0, y0, x1, y1, 0, h);
  masonry(p, x0, y0, x1, y1, 0, 22, shade(C.limeWash, 0.95), 0.6);
  p.line(p.south(C.limeWash, 0.8, 0.5), 1.5, [x0, y1, 24], [x1, y1, 24]);
  p.line(p.east(C.limeWash, 0.8, 0.5), 1.5, [x1, y0, 24], [x1, y1, 24]);
  roofTop(p, x0, y0, x1, y1, h, C.limeWash);
  for (let x = x0 + 0.24; x < x1 - 0.15; x += 0.44) {
    winS(p, y1, x, 33.5, 0.1, 9.5, C.limestone);
    p.southQuad(C.woodDark, y1 + 0.004, x + 0.04, x + 0.06, 33.5, 43);
  }
  for (let y = y0 + 0.2; y < y1 - 0.15; y += 0.44) winE(p, x1, y, 33.5, 0.1, 9.5, C.limestone);
}

/** Single-storey limestone wing. */
function wing(p: Pen, x0: number, y0: number, x1: number, y1: number, h = WING) {
  lime(p, x0, y0, x1, y1, 0, h);
  masonry(p, x0, y0, x1, y1, 0, 12, shade(C.limeWash, 0.95), 0.6);
  roofTop(p, x0, y0, x1, y1, h, C.limeWash);
  for (let x = x0 + 0.16; x < x1 - 0.1; x += 0.5) winS(p, y1, x, 14, 0.09, 6);
  for (let y = y0 + 0.3; y < y1 - 0.1; y += 0.5) winE(p, x1, y, 14, 0.09, 6);
}

/** Front wall with a gate under a stone lintel. */
function gateWall(p: Pen, x0: number, x1: number, y0: number, y1: number, gate = 0) {
  lime(p, x0, y0, gate - 0.12, y1, 0, 16);
  lime(p, gate + 0.12, y0, x1, y1, 0, 16);
  p.box(gate - 0.14, y0, gate + 0.14, y1, 15, 20, C.limestone, shade(C.limestone, 0.88), shade(C.limestone, 0.66));
  if (vacant) return shutDoor(p, y1, gate - 0.12, gate + 0.12, 15);
  p.southQuad(C.wood, y1 + 0.002, gate - 0.12, gate + 0.12, 0, 15);
  p.line(C.woodDark, 1, [gate, y1 + 0.003, 0], [gate, y1 + 0.003, 15]);
}

/** Striped awning on poles at height z. */
function awning(p: Pen, x0: number, y0: number, x1: number, y1: number, z: number, n = 7) {
  if (vacant) return;
  for (const [x, y] of [[x1 - 0.03, y0 + 0.03], [x1 - 0.03, y1 - 0.03]] as const) p.line(C.woodDark, 1.5, [x, y, z], [x, y, z + 12]);
  for (let k = 0; k < n; k++) {
    const ya = y0 + (k * (y1 - y0)) / n;
    const yb = ya + (y1 - y0) / n;
    p.poly(k % 2 ? C.cream : C.red, [[x0, ya, z + 16], [x1, ya, z + 11], [x1, yb, z + 11], [x0, yb, z + 16]]);
  }
}

interface Courtyard {
  tree?: boolean;
  bigAwning?: boolean;
}

/**
 * The "four-room house": a two-storey back range, pillared side wings and a front wall with a
 * gate around an open courtyard.
 */
function fourRoom(p: Pen, o: Courtyard) {
  const s = 0.92;
  const [back, cx0, cx1, front] = [-0.22, -0.36, 0.36, 0.74];
  p.shadow(-s, -s, s, back, TALL);
  p.shadow(-s, back, s, s, WING);
  upperRange(p, -s, -s, s, back);
  p.rect(shade(C.sand[0], 0.94), cx0, back, cx1, front);
  for (let y = back + 0.16; y < front; y += 0.16) p.line(shade(C.sand[0], 0.84), 1, [cx0, y], [cx1, y], 0.5);
  dome(p, 0.2, -0.05, 0, 0.11, 11, shade(C.mud, 0.9));
  p.ball(0x2a1f17, 0.15, 0.04, 4, 1.8);
  p.disc(C.stone, -0.18, 0.5, 0, 0.1);
  p.disc(0x2a3a44, -0.18, 0.5, 1, 0.055);
  jars(p, 0.14, 0.52);
  // West wing with stone pillars opening onto the courtyard.
  wing(p, -s, back, cx0, s);
  for (let y = back + 0.06; y < front - 0.1; y += 0.24) p.eastQuad(0x4a3a2c, cx0 + 0.002, y + 0.06, y + 0.2, 0, 17);
  if (o.tree) tree(p, -0.04, 0.22, 0, 1.55, C.leaf);
  else {
    // A loom with a half-woven cloth.
    for (const x of [-0.2, 0.1]) p.line(C.woodDark, 1.5, [x, 0.2, 0], [x, 0.2, 18]);
    p.line(C.wood, 2, [-0.22, 0.2, 18], [0.12, 0.2, 18]);
    p.poly(C.clothes[1], [[-0.18, 0.2, 17], [0.08, 0.2, 17], [0.08, 0.2, 9], [-0.18, 0.2, 9]]);
    for (let k = 0; k < 5; k++) p.ball(0x6e6e6e, -0.16 + k * 0.06, 0.2, 2, 1.5);
  }
  gateWall(p, cx0, cx1, front, s);
  wing(p, cx1, back, s, s);
  // Roof life.
  if (o.bigAwning) {
    awning(p, -0.86, -0.88, 0.86, -0.28, TALL, 11);
    for (const [x, c] of [[-0.6, C.gold], [-0.3, C.clothes[1]], [0.1, C.cream]] as const) p.box(x, -0.7, x + 0.16, -0.5, TALL, TALL + 3, c);
    p.rect(C.red, -0.82, 0.4, -0.42, 0.8, WING, 0.9);
    awning(p, 0.4, -0.15, 0.88, 0.6, WING, 6);
  } else {
    awning(p, 0.36, -0.86, 0.86, -0.28, TALL);
    p.rect(C.red, 0.42, -0.8, 0.78, -0.4, TALL, 0.85);
    clothesline(p, [-0.78, -0.76], [-0.78, -0.34], TALL, [C.clothes[3], C.clothes[2], C.cream]);
    jars(p, -0.3, -0.7, TALL);
    pot(p, -0.71, 0.59, WING, 1.2);
    p.rect(0xd8c58a, -0.82, -0.1, -0.46, 0.3, WING);
    for (let y = -0.06; y < 0.3; y += 0.06) p.line(0xb8a46a, 1, [-0.8, y, WING], [-0.48, y, WING], 0.8);
    jars(p, 0.62, 0.5, WING);
  }
}

/** Big 0: the classic courtyard house, with a loom, oven and cistern in the court. */
const bigCourt = (p: Pen) => fourRoom(p, {});
/** Big 1: a large fig tree rising out of the courtyard. */
const bigTree = (p: Pen) => fourRoom(p, { tree: true });
/** Big 2: a wide striped awning shading the whole upper roof. */
const bigAwning = (p: Pen) => fourRoom(p, { bigAwning: true });

/** Big 3: a compact two-storey block with a grand outside staircase and a walled forecourt. */
function bigStair(p: Pen) {
  yard(p, 0.9);
  const [x0, y0, x1, y1] = [-0.9, -0.92, 0.55, 0.0];
  p.shadow(x0, y0, x1, y1, TALL);
  p.shadow(x1, -0.92, 0.92, 0.2, 24);
  upperRange(p, x0, y0, x1, y1, 50);
  doorS(p, y1, 0.2, 0.36, 15, C.limestone);
  wing(p, x1, -0.92, 0.92, 0.2, 24);
  // Staircase rising westward along the south face to an upper door.
  const steps = 10;
  const sx0 = -0.85;
  for (let k = 0; k < steps; k++) {
    const sx = sx0 + (steps - 1 - k) * 0.07;
    p.box(sx, y1, sx + 0.07, y1 + 0.18, 0, ((k + 1) * 24) / steps, shade(C.limestone, 1.02), shade(C.limestone, 0.88), shade(C.limestone, 0.62));
  }
  p.box(sx0, y1 + 0.18, sx0 + steps * 0.07, y1 + 0.21, 0, 4, C.limestone);
  for (let k = 0; k < steps; k += 3) p.line(C.woodDark, 1, [sx0 + (steps - 1 - k) * 0.07, y1 + 0.2, ((k + 1) * 24) / steps], [sx0 + (steps - 1 - k) * 0.07, y1 + 0.2, ((k + 1) * 24) / steps + 6]);
  awning(p, -0.4, -0.86, 0.5, -0.4, 50, 6);
  jars(p, -0.75, -0.75, 50);
  pot(p, -0.75, -0.25, 50);
  pot(p, 0.75, -0.1, 24);
  // Forecourt with a palm, jars and a stone bench behind a low wall.
  jars(p, 0.2, 0.35);
  p.box(-0.5, 0.4, -0.1, 0.5, 0, 5, C.limestone);
  tree(p, 0.68, 0.45, 0, 0.9, C.olive);
  lime(p, -0.92, 0.82, -0.15, 0.92, 0, 12);
  lime(p, 0.15, 0.82, 0.92, 0.92, 0, 12);
  for (const x of [-0.15, 0.15]) p.box(x - 0.05, 0.8, x + 0.05, 0.94, 0, 16, C.limestone);
}

/** Big 4: an L of a two-storey back range and a long west wing around an open yard. */
function bigL(p: Pen) {
  yard(p, 0.9);
  const s = 0.92;
  const back = -0.2;
  p.shadow(-s, -s, s, back, TALL);
  p.shadow(-s, back, -0.3, s, WING);
  upperRange(p, -s, -s, s, back);
  // Yard: cistern, trough, a donkey's manger and a fig tree.
  p.disc(C.stone, 0.15, 0.1, 0, 0.13);
  p.disc(0x2a3a44, 0.15, 0.1, 1, 0.07);
  p.box(0.45, 0.0, 0.8, 0.15, 0, 6, C.stone);
  p.rect(C.wheat, 0.48, 0.03, 0.77, 0.12, 6);
  tree(p, 0.5, 0.45, 0, 1.1, C.leaf);
  wing(p, -s, back, -0.3, s);
  doorS(p, s, -0.75, -0.6, 14, C.limestone);
  for (let y = back + 0.15; y < s - 0.1; y += 0.3) p.eastQuad(C.door, -0.3 + 0.002, y, y + 0.14, 0, 14);
  reedShade(p, -0.85, 0.2, -0.38, 0.8, WING, 12);
  jars(p, -0.7, -0.05, WING);
  jars(p, -0.1, 0.45);
  // Low wall closing the yard on the east and south.
  lime(p, 0.84, back, s, s, 0, 12);
  lime(p, -0.3, 0.84, 0.0, s, 0, 12);
  lime(p, 0.3, 0.84, 0.84, s, 0, 12);
  clothesline(p, [-0.78, -0.76], [0.2, -0.76], TALL, [C.clothes[0], C.cream, C.clothes[1], C.clothes[3]]);
  jars(p, 0.55, -0.7, TALL);
}

/** Big 5: a two-storey house with a walled vegetable garden in rows in front. */
function bigGarden(p: Pen) {
  yard(p, 0.9);
  const s = 0.92;
  const back = -0.18;
  p.shadow(-s, -s, s, back, TALL);
  upperRange(p, -s, -s, s, back, 48);
  doorS(p, back, -0.15, 0.02, 15, C.limestone);
  p.rect(C.soilDark, -0.84, back + 0.06, 0.84, 0.84);
  p.rect(0xc9b58a, -0.12, back + 0.06, 0.04, 0.84);
  const r = createRng(61);
  for (const [xa, xb] of [[-0.8, -0.18], [0.1, 0.8]] as const) {
    for (let y = back + 0.16; y < 0.8; y += 0.14) {
      p.rect(C.soil, xa, y - 0.04, xb, y + 0.04);
      for (let x = xa + 0.05; x < xb; x += 0.09) {
        const leaf = y < 0.3 ? C.leaf : xa < 0 ? 0x7fa65a : 0x5e8a3e;
        p.ball(shade(leaf, 0.75), x, y, 1, 2.6 + r() * 0.8);
        p.ball(leaf, x - 0.01, y - 0.01, 2.2, 2 + r() * 0.6);
      }
    }
  }
  for (const [x, y] of [[0.3, 0.6], [0.5, 0.46], [0.66, 0.6]] as const) p.ball(C.red, x, y, 2.5, 1.5);
  tree(p, 0.68, 0.0, 0, 0.8, C.olive);
  jars(p, -0.06, 0.4);
  awning(p, 0.3, -0.86, 0.86, -0.3, 48, 6);
  jars(p, -0.6, -0.7, 48);
  pot(p, -0.2, -0.4, 48);
  // Low garden wall with a gap.
  lime(p, -s, back, -0.84, s, 0, 10);
  lime(p, 0.84, back, s, s, 0, 10);
  lime(p, -s, 0.84, -0.14, s, 0, 10);
  lime(p, 0.06, 0.84, s, s, 0, 10);
}

/** Drawings of each house level and variant: [draw, canvas height above ground, balloon height]. */
const HOUSE_ART: [((p: Pen) => void)[], number, number][] = [
  [[plotStakes, plotStones], 16, 12],
  [[tentStriped, tentPatched, tentDouble, tentAwning, tentFire, tentGoats], 36, 30],
  [[mudPlain, mudAnnex, mudStair, mudOven, mudFence, mudJars], 44, 36],
  [[stoneWindow, stoneLaundry, stoneVine, stoneArch, stoneTwo, stoneYard], 62, 52],
  [[bigCourt, bigTree, bigAwning, bigStair, bigL, bigGarden], 80, 64],
];

// ---------- other buildings ----------

/** Crops of the field variants, in order: their soil and the tuft sprite drawn over each row. */
const CROPS = [
  { soil: C.soil, draw: wheat },
  { soil: C.soil, draw: barley },
  { soil: 0x6e4a2c, draw: lentils },
  { soil: 0x8f6a44, draw: flax },
];

/**
 * Field (2 x 2): a terrace of ploughed soil held by a fieldstone wall; the crop tufts are sprites.
 * Variant 3 (flax) has a small water channel along its front edge.
 */
function field(p: Pen, v: number) {
  const s = 0.96;
  const z = PARTS.wheat[0].z;
  const soil = CROPS[v].soil;
  p.shadow(-s, -s, s, s, z);
  rubble(p, -s, -s, s, s, 0, z, C.rock, 41, 4);
  p.rect(shade(soil, 0.78), -s + 0.04, -s + 0.04, s - 0.04, s - 0.04, z);
  p.rect(soil, -s + 0.1, -s + 0.1, s - 0.1, s - 0.1, z);
  const rows = [...new Set(PARTS.wheat.map((w) => w.y))];
  for (const y of rows) {
    p.rect(shade(soil, 0.82), -s + 0.12, y - 0.03, s - 0.12, y + 0.1, z);
    p.line(shade(soil, 1.18), 1.2, [-s + 0.12, y - 0.08, z], [s - 0.12, y - 0.08, z], 0.7);
  }
  if (v === 3) {
    p.rect(shade(C.stone, 0.8), -s + 0.12, s - 0.2, s - 0.12, s - 0.1, z);
    p.rect(C.water, -s + 0.14, s - 0.18, s - 0.14, s - 0.12, z, 0.95);
    p.line(C.waterLight, 1, [-s + 0.3, s - 0.16, z], [-s + 0.6, s - 0.16, z], 0.8);
    p.line(C.waterLight, 1, [0.2, s - 0.15, z], [0.45, s - 0.15, z], 0.8);
  }
  // Grass tufts along the terrace edge.
  const r = createRng(43);
  for (let k = 0; k < 10; k++) {
    const t = -s + 0.1 + r() * (2 * s - 0.2);
    const [x, y] = k % 2 ? [t, s - 0.06] : [s - 0.06, t];
    const b = p.p(x, y, z);
    p.g.lineStyle(1.2, C.tuft, 0.9);
    p.g.lineBetween(b.x, b.y, b.x - 2, b.y - 4);
    p.g.lineBetween(b.x, b.y, b.x + 1, b.y - 5);
  }
}

/** A cluster of five wheat stalks with fat golden ears. */
function wheat(g: G) {
  g.lineStyle(1.3, C.wheatStem, 1);
  const tips: [number, number][] = [[3, 8], [7, 4], [11, 3], [15, 5], [19, 9]];
  tips.forEach(([x, y]) => g.lineBetween(11, 21, x, y + 3));
  g.fillStyle(shade(C.wheat, 0.85));
  tips.forEach(([x, y]) => g.fillEllipse(x + 0.5, y + 0.5, 3.6, 7.5));
  g.fillStyle(C.wheat);
  tips.forEach(([x, y]) => g.fillEllipse(x, y, 3.2, 7));
  g.fillStyle(shade(C.wheat, 1.3));
  tips.forEach(([x, y]) => g.fillEllipse(x - 0.6, y - 1, 1.2, 3.5));
}

/** A dense tuft of barley: pale green-yellow nodding heads with long whiskers. */
function barley(g: G) {
  const head = 0xcdd07a;
  const tips: [number, number][] = [[2, 10], [5, 7], [8, 5], [11, 4], [14, 5], [17, 7], [20, 10]];
  g.lineStyle(1.2, 0x9aa04a, 1);
  tips.forEach(([x, y]) => g.lineBetween(11, 21, x, y + 2));
  tips.forEach(([x, y], k) => {
    const d = k < 3 ? -1 : 1;
    g.fillStyle(shade(head, 0.8));
    g.fillEllipse(x + d * 1.2, y + 1.5, 3, 6);
    g.fillStyle(head);
    g.fillEllipse(x + d * 0.8, y + 1, 2.6, 5.5);
    g.lineStyle(1, shade(head, 1.2), 0.9);
    g.lineBetween(x + d * 0.8, y - 1, x + d * 3, y - 5);
    g.lineBetween(x + d * 0.3, y - 1, x + d * 0.8, y - 5.5);
  });
}

/** A low mound of lentil plants with pale pods. */
function lentils(g: G) {
  const leaf = 0x5e8a3a;
  const blobs: [number, number, number][] = [[5, 17, 4.5], [11, 15, 5.5], [17, 17, 4.5], [8, 19, 4], [14, 19, 4]];
  g.fillStyle(shade(leaf, 0.7));
  blobs.forEach(([x, y, r]) => g.fillCircle(x, y + 1, r));
  g.fillStyle(leaf);
  blobs.forEach(([x, y, r]) => g.fillCircle(x - 0.5, y - 0.5, r * 0.85));
  g.fillStyle(shade(leaf, 1.35));
  blobs.forEach(([x, y, r]) => g.fillCircle(x - 1.5, y - 2, r * 0.35));
  g.fillStyle(0xd8d08a);
  [[7, 15], [12, 12], [15, 16], [10, 18]].forEach(([x, y]) => g.fillEllipse(x, y, 2.4, 1.4));
}

/** Slender flax stalks topped with small blue flowers. */
function flax(g: G) {
  const tips: [number, number][] = [[4, 6], [7, 3], [10, 5], [13, 2], [16, 5], [19, 7]];
  g.lineStyle(1, 0x6f9040, 1);
  tips.forEach(([x, y]) => g.lineBetween(11, 21, x, y + 1));
  g.fillStyle(0x6f9040);
  tips.forEach(([x, y]) => g.fillEllipse((x + 11) / 2, (y + 21) / 2, 1.6, 3));
  tips.forEach(([x, y], k) => {
    g.fillStyle(k % 3 === 2 ? 0xe9ecf6 : 0x6f8fe0);
    g.fillCircle(x, y, 2.2);
    g.fillStyle(0xf2e27a);
    g.fillCircle(x, y, 0.7);
  });
}

/** A pen whose origin is moved to the local point (x, y), to reuse tree drawings inside a building. */
const moved = (p: Pen, x: number, y: number) => {
  const c = p.p(x, y);
  return new Pen(p.g, c.x, c.y, p.mirror);
};

/** Plaza (2 x 2): a square paved with light limestone slabs, a shade tree, a cloth awning and a stone bench. */
function plaza(p: Pen) {
  const s = 0.86;
  const kerb = 2;
  p.shadow(-s, -s, s, s, 6, 0.14);
  p.box(-s, -s, s, s, 0, kerb, C.limestone, shade(C.limestone, 0.86), shade(C.limestone, 0.62));
  // Slabs in staggered rows, each a slightly different tone, with mortar joints.
  const r = createRng(77);
  const n = 5;
  const step = (2 * s) / n;
  p.rect(shade(C.limestone, 0.76), -s, -s, s, s, kerb);
  for (let j = 0; j < n; j++) {
    const off = j % 2 ? step / 2 : 0;
    for (let i = -1; i < n; i++) {
      const x0 = Math.max(-s, -s + i * step + off);
      const x1 = Math.min(s, -s + (i + 1) * step + off);
      if (x1 - x0 < 0.02) continue;
      const y0 = -s + j * step;
      p.rect(shade(C.limestone, 0.88 + r() * 0.14), x0 + 0.02, y0 + 0.02, x1 - 0.02, y0 + step - 0.02, kerb);
    }
  }
  // A shade tree in a square stone planter at the back corner.
  p.box(-0.78, -0.78, -0.3, -0.3, kerb, kerb + 4, C.stone, shade(C.stone, 0.86), shade(C.stone, 0.62));
  p.rect(C.earthDark, -0.72, -0.72, -0.36, -0.36, kerb + 4);
  olive(moved(p, -0.54, -0.54), 1);
  // A plain linen awning on four poles at the back right, a mat and a jar under it.
  const [ax0, ay0, ax1, ay1, az] = [0.12, -0.8, 0.8, -0.12, kerb];
  p.rect(C.shadow, ax0 + 0.08, ay0 + 0.04, ax1 + 0.2, ay1, az, 0.16);
  p.rect(C.woodWarm, ax0 + 0.12, ay0 + 0.14, ax1 - 0.14, ay1 - 0.12, az);
  p.rect(shade(C.woodWarm, 1.2), ax0 + 0.18, ay0 + 0.2, ax1 - 0.2, ay0 + 0.26, az, 0.8);
  jar(p, ax1 - 0.22, ay0 + 0.22, az, 3);
  const posts: [number, number][] = [[ax0, ay0], [ax1, ay0], [ax0, ay1], [ax1, ay1]];
  posts.forEach(([x, y]) => p.line(C.woodDark, 1.6, [x, y, az], [x, y, az + 20]));
  // Dyed ochre linen, sagging a little between the posts, with a scalloped hem at the front.
  const cloth = C.shadeCloth;
  p.poly(shade(cloth, 0.92), [[ax0, ay0, az + 22], [ax1, ay0, az + 22], [ax1, ay1, az + 18], [ax0, ay1, az + 18]]);
  p.poly(cloth, [[ax0 + 0.06, ay0 + 0.06, az + 21], [ax1 - 0.06, ay0 + 0.06, az + 21], [ax1 - 0.06, ay1 - 0.06, az + 18.5], [ax0 + 0.06, ay1 - 0.06, az + 18.5]]);
  p.line(shade(cloth, 1.15), 2, [ax0 + 0.1, ay0 + 0.3, az + 21], [ax1 - 0.1, ay0 + 0.3, az + 21], 0.7);
  const hem = 6;
  for (let k = 0; k < hem; k++) {
    const xa = ax0 + ((ax1 - ax0) * k) / hem;
    const xb = ax0 + ((ax1 - ax0) * (k + 1)) / hem;
    p.poly(shade(cloth, 0.72), [[xa, ay1, az + 18], [xb, ay1, az + 18], [(xa + xb) / 2, ay1, az + 14.5]]);
  }
  // A long stone bench on the left edge and two neighbours talking in the open middle.
  p.shadow(-0.74, 0.0, -0.56, 0.72, 5, 0.18);
  p.box(-0.74, 0.0, -0.56, 0.72, kerb, kerb + 5, C.stone, shade(C.stone, 0.86), shade(C.stone, 0.62));
  person(p, 0.05, 0.25, kerb, 2);
  person(p, 0.3, 0.42, kerb, 5);
  jar(p, 0.62, 0.6, kerb, 3.4);
}

/** Park (2 x 2): a lawn in a low stone border with paths, flower beds, shade trees and benches. */
function park(p: Pen) {
  const s = 0.86;
  const kerb = 2.5;
  p.box(-s, -s, s, s, 0, kerb, C.stone, shade(C.stone, 0.88), shade(C.stone, 0.64));
  p.rect(C.lawn, -s + 0.08, -s + 0.08, s - 0.08, s - 0.08, kerb);
  p.rect(shade(C.lawn, 1.1), -s + 0.08, -s + 0.08, -0.05, -0.05, kerb, 0.6);
  // Cross-shaped paths from a round flower bed to the middle of each side.
  p.rect(C.sand[0], -0.12, -s + 0.08, 0.12, s - 0.08, kerb);
  p.rect(C.sand[0], -s + 0.08, -0.12, s - 0.08, 0.12, kerb);
  // Pools of shade under the trees, cast toward the east.
  for (const [x, y] of [[-0.5, -0.5], [-0.5, 0.5], [0.5, -0.5]] as const) p.disc(shade(C.lawn, 0.72), ...p.away(x, y, 0.12), kerb, 0.34, 0.7);
  const flowers = [C.red, C.gold, 0x9a6ab0, C.cream];
  const bed = (x: number, y: number, r: number, k: number) => {
    p.disc(shade(C.lawn, 0.8), x, y, kerb, r);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + k;
      p.ball(flowers[(i + k) % flowers.length], x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, kerb + 2, 1.8);
    }
  };
  // Back and side trees, then the middle bed in a stone ring, a front bed and two benches.
  olive(moved(p, -0.5, -0.5), 0);
  palm(moved(p, 0.52, -0.52), 2);
  olive(moved(p, -0.5, 0.5), 1);
  cylinder(p, 0, 0, 0.24, kerb, kerb + 3, C.stone);
  bed(0, 0, 0.19, 1);
  bed(0.52, 0.52, 0.2, 2);
  p.box(0.22, 0.24, 0.6, 0.32, kerb, kerb + 4, C.wood);
  p.box(0.22, 0.32, 0.6, 0.36, kerb, kerb + 8, C.woodDark);
  p.box(0.24, -0.6, 0.32, -0.22, kerb, kerb + 4, C.wood);
  p.box(0.32, -0.6, 0.36, -0.22, kerb, kerb + 8, C.woodDark);
}

// ---------- food stores and gatherers ----------

/** A bulging burlap sack of grain standing on the ground point (x, y, z), tied at the neck. */
function grainSack(p: Pen, x: number, y: number, z: number, k = 1, tone = 1) {
  const c = p.p(x, y, z);
  const col = shade(C.sack, tone);
  const g = p.g;
  g.fillStyle(C.shadow, 0.22);
  g.fillEllipse(c.x + 2.5 * k, c.y - 0.5 * k, 12 * k, 4.5 * k);
  g.fillStyle(shade(col, 0.7));
  g.fillEllipse(c.x + 0.8 * k, c.y - 5.2 * k, 10.5 * k, 10.5 * k);
  g.fillStyle(col);
  g.fillEllipse(c.x - 0.7 * k, c.y - 5.6 * k, 8.2 * k, 9.8 * k);
  g.fillStyle(shade(col, 1.12));
  g.fillEllipse(c.x - 2.2 * k, c.y - 6.8 * k, 3 * k, 4.6 * k);
  // Gathered neck and the cord around it.
  g.fillStyle(shade(col, 0.86));
  g.fillTriangle(c.x - 2.6 * k, c.y - 9.6 * k, c.x + 2.8 * k, c.y - 9.6 * k, c.x + 0.4 * k, c.y - 13.6 * k);
  g.lineStyle(1.3 * k, C.sackDark, 1);
  g.lineBetween(c.x - 1.8 * k, c.y - 10.6 * k, c.x + 2 * k, c.y - 10.6 * k);
  g.lineStyle(1, shade(col, 0.5), 0.6);
  g.strokeEllipse(c.x + 0.3 * k, c.y - 5.3 * k, 10 * k, 10.2 * k);
}

/** A low wooden pallet that keeps the sacks off the ground. */
function pallet(p: Pen, x0: number, y0: number, x1: number, y1: number) {
  p.box(x0, y0, x1, y1, 0, 3, C.wood, shade(C.wood, 0.86), shade(C.woodDark, 0.9));
  for (let x = x0 + 0.08; x < x1 - 0.02; x += 0.12) p.line(C.woodDark, 1, [x, y0 + 0.02, 3], [x, y1 - 0.02, 3], 0.6);
}

/** A heap of loose grain with a wooden shovel stuck in it. */
function grainHeap(p: Pen, x: number, y: number, r: number) {
  p.disc(C.shadow, ...p.away(x, y, 0.08), 0, r * 1.05, 0.2);
  dome(p, x, y, 0, r, r * 30, C.grain);
  const c = p.p(x, y, r * 24);
  const r2 = createRng(19);
  p.g.fillStyle(shade(C.grain, 1.2));
  for (let k = 0; k < 9; k++) p.g.fillCircle(c.x - 6 + r2() * 10, c.y - 2 + r2() * 8, 0.9);
  p.line(C.woodDark, 2, [x + r * 0.2, y - r * 0.1, r * 22], [x + r * 0.7, y - r * 0.6, r * 22 + 18]);
  p.poly(C.wood, [[x + r * 0.05, y + r * 0.05, r * 18], [x + r * 0.35, y - r * 0.25, r * 18], [x + r * 0.3, y - r * 0.2, r * 26], [x, y, r * 26]]);
}

/** A domed mud-brick grain silo with a hatch on top (golden grain shows when the stores are full). */
function silo(p: Pen, x: number, y: number, r: number, h: number, full: boolean) {
  p.shadow(x - r, y - r, x + r, y + r, h + r * 34, 0.2);
  cylinder(p, x, y, r, 0, h, C.mud);
  // Plastered bands around the drum.
  for (const z of [h * 0.35, h * 0.72]) {
    const c = p.p(x, y, z);
    p.g.lineStyle(1, shade(C.mud, 0.62), 0.55);
    p.g.beginPath();
    p.g.arc(c.x, c.y, r * SQRT2 * HW, 0.12, Math.PI - 0.12);
    p.g.strokePath();
  }
  dome(p, x, y, h, r, r * 34, shade(C.mud, 1.04));
  const top = h + r * 34 - 2;
  cylinder(p, x, y, r * 0.3, top - 1, top + 2, shade(C.mud, 0.95));
  p.disc(full ? C.grain : 0x3a2818, x, y, top + 2, r * 0.22);
  if (full) p.disc(shade(C.grain, 1.2), x - 0.02, y - 0.02, top + 2, r * 0.1);
}

/** A ladder leaning against a south-facing wall at y, from the ground up to height h. */
function ladder(p: Pen, x: number, y: number, h: number, foot = 0.22) {
  for (const dx of [-0.07, 0.07]) p.line(C.woodDark, 1.6, [x + dx, y + foot, 0], [x + dx, y, h]);
  for (let t = 0.12; t < 1; t += 0.16) p.line(C.wood, 1.2, [x - 0.07, y + foot * (1 - t), h * t], [x + 0.07, y + foot * (1 - t), h * t]);
}

/**
 * Granary (3 x 3): a pale limestone storehouse along the back, domed mud-brick silos on the east
 * side and, under a reed awning, the yard where the stock shows: bare pallets when empty, then
 * sacks and storage jars, and at full a heap of loose grain (`stock` 0 to GRANARY_STOCKS - 1).
 * Each level adds a silo (2, 3, then 4 and taller), and level 3 raises the storehouse a storey.
 */
function granary(p: Pen, stock: number, level = 1) {
  const s = 1.44;
  const wallH = 8;
  p.rect(shade(C.sand[0], 0.86), -s, -s, s, s, 0, 0.9);
  // Threshing floor of beaten earth in the yard.
  p.disc(shade(C.sand[0], 0.78), -0.35, 0.45, 0, 0.62, 0.55);
  rubble(p, -s, -s, s, -s + 0.14, 0, wallH, C.rock, 61, 4);
  rubble(p, -s, -s + 0.14, -s + 0.14, s, 0, wallH, C.rock, 62, 4);
  // Storehouse: limestone hall with a stone roof, a framed door and two slit windows.
  const [hx0, hy0, hx1, hy1, hh] = [-1.28, -1.28, 0.36, -0.42, level >= 3 ? 42 : 32];
  p.shadow(hx0, hy0, hx1, hy1, hh);
  paleStone(p, hx0, hy0, hx1, hy1, 0, hh);
  masonry(p, hx0, hy0, hx1, hy1, 0, hh, C.stone, 0.8);
  roofTop(p, hx0, hy0, hx1, hy1, hh, C.stone);
  p.southQuad(shade(C.stone, 0.7), hy1 + 0.002, -0.62, -0.26, 0, 22);
  doorS(p, hy1, -0.58, -0.3, 19);
  winS(p, hy1, -1.05, 20, 0.07, 7);
  winS(p, hy1, 0.08, 20, 0.07, 7);
  winE(p, hx1, -1.0, 20, 0.07, 7);
  if (level >= 3) {
    // The upper storey: a string course, a row of slit windows and a loading hatch.
    p.line(p.south(C.stone, 0.7, 0.5), 1.5, [hx0, hy1, 32], [hx1, hy1, 32]);
    p.line(p.east(C.stone, 0.7, 0.5), 1.5, [hx1, hy0, 32], [hx1, hy1, 32]);
    for (const x of [-1.05, -0.72, 0.08]) winS(p, hy1, x, 34, 0.07, 5);
    p.southQuad(C.wood, hy1 + 0.002, -0.4, -0.22, 31, 39);
    p.line(C.woodDark, 1.6, [-0.31, hy1 + 0.1, 41], [-0.31, hy1 + 0.003, 41]);
  }
  // Sacks waiting on the roof when the stores are full.
  if (stock >= 3) for (const [x, y] of [[-1.0, -1.0], [-0.75, -0.95], [-0.88, -0.72]] as const) grainSack(p, x, y, hh, 0.9);
  else jars(p, -1.0, -0.95, hh);
  // Reed awning on poles in front of the door, over part of the stock.
  const [ax0, ay0, ax1, ay1, az] = [-1.2, -0.42, 0.3, 0.2, 24];
  const awning = () => {
    for (const x of [ax0 + 0.04, ax1 - 0.04]) p.line(C.woodDark, 2, [x, ay1, 0], [x, ay1, az]);
    p.box(ax0, ay0, ax1, ay1, az, az + 2, REED[0], REED[1], REED[2]);
    for (let x = ax0 + 0.05; x < ax1; x += 0.07) p.line(0x9c7f45, 1, [x, ay0, az + 2], [x, ay1, az + 2], 0.7);
  };

  // The stock, sorted back to front with the silos: what stands under the awning goes before it.
  const items: [number, () => void, boolean][] = [];
  const add = (d: number, draw: () => void, x = 9, y = 9) => items.push([d, draw, x < ax1 && y < ay1]);
  const tall = level >= 3 ? 6 : 0;
  add(0.9 - 0.9, () => silo(p, 0.92, -0.92, 0.4, 20 + tall, stock >= 2));
  add(0.95 + 0.12, () => silo(p, 0.95, 0.12, 0.36, 16 + tall, stock >= 3));
  add(0.92 + 0.62, () => ladder(p, 0.95, 0.47, 18 + tall));
  if (level >= 2) add(0.98 + 0.98, () => silo(p, 0.98, 0.98, 0.33, 15 + tall, stock >= 1));
  if (level >= 3) add(-1.0 + 1.0, () => silo(p, -1.0, 1.0, 0.33, 15 + tall, stock >= 1), -1.0, 1.0);
  const pallets: [number, number, number, number][] = [[-1.1, -0.3, -0.42, 0.06], [-0.3, 0.3, 0.38, 0.66], ...(level >= 3 ? [] : [[-1.1, 0.42, -0.5, 0.78] as [number, number, number, number]])];
  pallets.forEach(([x0, y0, x1, y1], k) => {
    add(x0 + y0, () => pallet(p, x0, y0, x1, y1), x0, y0);
    // Sacks per pallet: none when empty, then a row on the front one, then two rows, then a top layer.
    const rows = stock === 0 ? 0 : stock === 1 ? (k === 1 ? 1 : 0) : stock === 2 ? (k < 2 ? 2 : 1) : 3;
    const spots: P3[] = [];
    const n = Math.round((x1 - x0) / 0.22);
    for (let r = 0; r < Math.min(rows, 2); r++) for (let i = 0; i < n; i++) spots.push([x0 + 0.13 + i * 0.22, y0 + 0.1 + r * 0.17, 3]);
    if (rows >= 3) for (let i = 0; i < n - 1; i++) spots.push([x0 + 0.24 + i * 0.22, y0 + 0.18, 12]);
    spots.forEach(([x, y, z], i) => add(x + y + (z ?? 0) * 0.002, () => grainSack(p, x, y, z ?? 3, 1, 0.94 + ((i * 37) % 10) * 0.012), x, y));
  });
  // Tall storage jars along the hall, more as the stores fill.
  const jarSpots: [number, number][] = [[0.66, 0.6], [0.5, 0.82], [0.5, 0.05], [0.12, 0.05], [0.15, -0.3], [0.32, -0.12]];
  const nJars = [0, 2, 4, 6][stock];
  jarSpots.slice(0, nJars).forEach(([x, y], i) => add(x + y, () => jar(p, x, y, 0, 4.4, i % 2 ? shade(C.terracotta, 1.1) : C.terracotta), x, y));
  const heap: [number, number] = level >= 3 ? [-0.42, 0.98] : [-0.85, 1.02];
  if (stock >= 3) add(heap[0] + heap[1], () => grainHeap(p, ...heap, 0.26));
  items.sort((a, b) => a[0] - b[0]);
  for (const [, draw, under] of items) if (under) draw();
  awning();
  for (const [, draw, under] of items) if (!under) draw();
  // Front and east walls, with a gate toward the road.
  rubble(p, s - 0.14, -s + 0.14, s, s, 0, wallH, C.rock, 63, 4);
  rubble(p, -s + 0.14, s - 0.14, -0.55, s, 0, wallH, C.rock, 64, 4);
  rubble(p, 0.25, s - 0.14, s - 0.14, s, 0, wallH, C.rock, 65, 4);
}

/** A fishing net hung to dry along x = const, from y0 to y1, sagging between its poles. */
function dryingNet(p: Pen, x: number, y0: number, y1: number, top: number) {
  for (const y of [y0, y1]) p.line(C.woodDark, 2, [x, y, 0], [x, y, top + 3]);
  p.line(C.rope, 1, [x, y0, top], [x, y1, top]);
  const low = (t: number) => 5 + Math.sin(t * Math.PI) * 4;
  const N = 9;
  const pt = (t: number, f: number): P3 => [x + 0.01, y0 + (y1 - y0) * t, top - (top - low(t)) * f];
  // A light mesh of cords: verticals and a few sagging rows.
  p.poly(C.net, [pt(0, 0), pt(1, 0), pt(1, 1), pt(0.5, 1), pt(0, 1)], 0.28);
  for (let i = 0; i <= N; i++) p.line(shade(C.net, 0.82), 1, pt(i / N, 0), pt(i / N, 1), 0.85);
  for (const f of [0.25, 0.5, 0.75, 1]) for (let i = 0; i < N; i++) p.line(C.net, 1, pt(i / N, f), pt((i + 1) / N, f), 0.85);
  // Cork floats along the top cord.
  for (let i = 1; i < N; i += 2) p.ball(0xd9a85a, x, y0 + ((y1 - y0) * i) / N, top - 1, 1.6);
}

/** A small wooden boat pulled up on the ground, its bow along +y, tarred outside. */
function boat(p: Pen, x: number, y0: number, y1: number) {
  const N = 12;
  const rimZ = 8;
  const half = (t: number) => 0.2 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15)), 0.6);
  const at = (t: number, side: number, z: number, k = 1): P3 => [x + side * half(t) * k, y0 + (y1 - y0) * t, z];
  const ts = Array.from({ length: N + 1 }, (_, i) => i / N);
  p.shadow(x - 0.2, y0, x + 0.2, y1, 8, 0.2);
  // Shaded east side of the hull, then the lit inside and the thwarts.
  p.poly(shade(C.hull, 0.8), [...ts.map((t) => at(t, 1, rimZ)), ...ts.slice().reverse().map((t) => at(t, 1, 1, 0.55))]);
  p.poly(shade(C.wood, 0.95), [...ts.map((t) => at(t, 1, rimZ, 0.92)), ...ts.slice().reverse().map((t) => at(t, -1, rimZ, 0.92))]);
  p.poly(shade(C.wood, 0.75), [...ts.map((t) => at(t, 1, rimZ - 4, 0.5)), ...ts.slice().reverse().map((t) => at(t, -1, rimZ - 4, 0.5))]);
  for (const t of [0.35, 0.65]) p.line(C.woodDark, 2, at(t, -1, rimZ - 1, 0.9), at(t, 1, rimZ - 1, 0.9));
  for (const side of [-1, 1]) for (let i = 0; i < N; i++) p.line(side < 0 ? shade(C.hull, 1.2) : C.hull, 1.6, at(ts[i], side, rimZ), at(ts[i + 1], side, rimZ));
  // Oars resting across it.
  p.line(C.wood, 1.6, [x - 0.32, y0 + 0.25, 2], [x + 0.3, y0 + 0.45, rimZ + 2]);
}

/** A rack of fish drying on a cord between two posts along y. */
function fishRack(p: Pen, x: number, y0: number, y1: number, top: number) {
  for (const y of [y0, y1]) p.line(C.woodDark, 2, [x, y, 0], [x, y, top + 2]);
  p.line(C.rope, 1, [x, y0, top], [x, y1, top]);
  for (let t = 0.14; t < 0.95; t += 0.16) {
    const c = p.p(x, y0 + (y1 - y0) * t, top);
    p.g.fillStyle(shade(C.fish, 0.8));
    p.g.fillEllipse(c.x + 0.5, c.y + 5, 3.6, 8.5);
    p.g.fillStyle(C.fish);
    p.g.fillEllipse(c.x, c.y + 4.6, 2.6, 7.6);
    p.g.fillTriangle(c.x - 2, c.y + 10, c.x + 2, c.y + 10, c.x, c.y + 7.5);
  }
}

/** A round wicker basket heaped with fruit (or fish) of the given colours. */
function heapedBasket(p: Pen, x: number, y: number, r: number, fruit: number[], seed: number, size = 2.6) {
  const h = 8;
  p.disc(C.shadow, ...p.away(x, y, 0.06), 0, r * 1.05, 0.22);
  cylinder(p, x, y, r, 0, h, C.wicker);
  const c = p.p(x, y, h);
  const rx = r * SQRT2 * HW;
  for (const z of [2.5, 5.5]) {
    const b = p.p(x, y, z);
    p.g.lineStyle(1, shade(C.wicker, 0.6), 0.7);
    p.g.beginPath();
    p.g.arc(b.x, b.y, rx, 0.15, Math.PI - 0.15);
    p.g.strokePath();
  }
  p.disc(shade(C.wicker, 0.7), x, y, h, r * 0.92);
  const rng = createRng(seed);
  // A mound of fruit: back ones first, each with a small highlight.
  const n = Math.round(r * 64);
  const pts = Array.from({ length: n }, () => {
    const a = rng() * Math.PI * 2;
    const d = Math.sqrt(rng()) * 0.8;
    return { dx: Math.cos(a) * d * rx, dy: Math.sin(a) * d * rx * 0.5, col: fruit[Math.floor(rng() * fruit.length)] };
  }).sort((a, b) => a.dy - b.dy);
  for (const f of pts) {
    const lift = (1 - Math.hypot(f.dx / rx, (f.dy * 2) / rx)) * 5;
    p.g.fillStyle(shade(f.col, 0.8));
    p.g.fillCircle(c.x + f.dx + 0.4, c.y + f.dy - lift + 0.4, size);
    p.g.fillStyle(f.col);
    p.g.fillCircle(c.x + f.dx, c.y + f.dy - lift, size * 0.85);
    p.g.fillStyle(shade(f.col, 1.45));
    p.g.fillCircle(c.x + f.dx - size * 0.35, c.y + f.dy - lift - size * 0.35, size * 0.3);
  }
}

/**
 * Fisher (2 x 2): a reed-roofed mud hut, a net drying between poles, a small boat pulled up on the
 * ground with its oars, fish drying on a cord and a basket of the day's catch.
 */
function fisher(p: Pen) {
  const s = 0.9;
  p.rect(shade(C.bank, 0.92), -s, -s, s, s, 0, 0.85);
  const r = createRng(71);
  for (let k = 0; k < 14; k++) p.disc(shade(C.rock, 0.9 + r() * 0.2), -s + 0.1 + r() * 1.6, -s + 0.1 + r() * 1.6, 0, 0.03 + r() * 0.03, 0.8);
  // The hut: low mud walls under a thick reed roof.
  const [x0, y0, x1, y1, h] = [-0.84, -0.84, 0.1, -0.2, 18];
  p.shadow(x0, y0, x1, y1, h + 6);
  p.box(x0, y0, x1, y1, 0, h, shade(C.mud, 1.04), shade(C.mud, 0.94), shade(C.mud, 0.66));
  bricks(p, x0, y0, x1, y1, 0, h, C.mud, 0.22);
  p.box(x0 - 0.06, y0 - 0.06, x1 + 0.06, y1 + 0.08, h, h + 5, REED[0], REED[1], REED[2]);
  for (let y = y0; y < y1 + 0.06; y += 0.06) p.line(0x9c7f45, 1, [x0 - 0.06, y, h + 5], [x1 + 0.06, y, h + 5], 0.7);
  doorS(p, y1, -0.5, -0.28, 13);
  winE(p, x1, -0.6, 9, 0.1, 4);
  fishRack(p, -0.66, 0.0, 0.62, 16);
  dryingNet(p, 0.6, -0.82, 0.12, 24);
  boat(p, 0.02, 0.0, 0.84);
  heapedBasket(p, 0.62, 0.5, 0.16, [C.fish, shade(C.fish, 1.1), 0x9fb0b6], 73, 2.2);
}

/**
 * Gatherer (2 x 2): a small mud house with figs drying on a mat on its roof, a ladder for the
 * trees, and big baskets of olives, figs and dates in the yard beside a drying mat.
 */
function gatherer(p: Pen) {
  const s = 0.9;
  p.rect(shade(C.sand[0], 0.9), -s, -s, s, s, 0, 0.85);
  const [x0, y0, x1, y1, h] = [-0.84, -0.84, 0.12, -0.22, 24];
  p.shadow(x0, y0, x1, y1, h);
  mudBlock(p, x0, y0, x1, y1, h);
  beamEnds(p, x0, x1, y1, h);
  doorS(p, y1, -0.3, -0.1, 15);
  winE(p, x1, -0.62, 14, 0.1, 5);
  // Figs drying on a reed mat on the roof.
  p.rect(REED[0], -0.72, -0.72, 0.0, -0.32, h + 0.5);
  const r = createRng(83);
  for (let k = 0; k < 14; k++) p.ball(k % 3 ? C.figFruit : C.dateFruit, -0.68 + r() * 0.64, -0.7 + r() * 0.34, h + 2, 1.5);
  ladder(p, -0.62, y1, h, 0.26);
  // Drying mat with figs on the ground.
  p.rect(shade(REED[0], 0.95), -0.8, 0.12, -0.2, 0.74, 0.5);
  for (let y = 0.16; y < 0.72; y += 0.07) p.line(REED[2], 1, [-0.78, y, 0.6], [-0.22, y, 0.6], 0.5);
  for (let k = 0; k < 16; k++) p.ball(k % 4 ? C.figFruit : shade(C.figFruit, 1.3), -0.74 + r() * 0.48, 0.18 + r() * 0.5, 1.5, 1.7);
  heapedBasket(p, 0.52, -0.5, 0.22, [C.oliveFruit, C.oliveGreen, shade(C.oliveFruit, 0.8)], 85);
  heapedBasket(p, 0.0, 0.58, 0.2, [C.dateFruit, shade(C.dateFruit, 0.85), C.gold], 87);
  heapedBasket(p, 0.55, 0.2, 0.22, [C.figFruit, shade(C.figFruit, 1.2), C.oliveGreen], 86);
  // A long stick for beating the olive branches, leaning on the basket.
  p.line(C.woodDark, 1.6, [0.82, -0.1, 0], [0.4, -0.75, 34]);
}

/**
 * Market (2 x 4, or 4 x 2 when rotated): rows of stalls with striped awnings along an aisle. Each
 * level adds stalls: 4 with goods laid on mats at the far end, then 6, then 8 along a limestone
 * aisle with more shoppers.
 */
function market(p: Pen, rotated: boolean, level = 1) {
  // u runs along the long side, v across it.
  const xy = (u: number, v: number): [number, number] => (rotated ? [u, v] : [v, u]);
  const rect4 = (u0: number, v0: number, u1: number, v1: number) => (rotated ? [u0, v0, u1, v1] : [v0, u0, v1, u1]) as [number, number, number, number];
  const P = (u: number, v: number, z = 0): P3 => [...xy(u, v), z];
  const box = (u0: number, v0: number, u1: number, v1: number, z0: number, z1: number, top: number, lit?: number, dark?: number) =>
    p.box(...rect4(u0, v0, u1, v1), z0, z1, top, lit, dark);
  const L = 1.92;
  const W = 0.94;
  p.rect(shade(C.sand[0], 0.9), ...rect4(-L, -W, L, W), 0, 0.85);
  const aisle = level >= 3 ? C.limestone : shade(C.stone, 0.92);
  p.rect(aisle, ...rect4(-L, -0.26, L, 0.26));
  for (let u = -L + 0.2; u < L; u += 0.2) p.line(shade(aisle, 0.8), 1, P(u, -0.26), P(u, 0.26), 0.6);
  p.line(shade(aisle, 0.8), 1, P(-L, 0), P(L, 0), 0.5);

  const awnings = [C.red, C.ochre, 0x5a7fb5, 0x7fa65a, C.red, 0x9a6ab0];
  const goods: ((u: number, v: number, z: number) => void)[] = [
    (u, v, z) => [-0.3, -0.1, 0.1, 0.3].forEach((d, k) => jar(p, ...xy(u + d, v), z, k % 2 ? 2.6 : 3.2)),
    (u, v, z) => [-0.32, -0.16, 0, 0.16, 0.32].forEach((d, k) => p.ball(k % 2 ? 0x8a3b5a : 0xc8402e, ...xy(u + d, v), z + 2.5, 3)),
    (u, v, z) => [0xc0503c, 0x5a7fb5, 0xe2b544, 0xf6ecd6].forEach((c, k) => box(u - 0.34 + k * 0.17, v - 0.05, u - 0.2 + k * 0.17, v + 0.05, z, z + 4, c)),
    (u, v, z) => [-0.25, 0, 0.25].forEach((d) => {
      p.ball(shade(C.fabric, 0.8), ...xy(u + d, v), z + 4, 5);
      p.ball(C.fabric, ...xy(u + d - 0.02, v - 0.02), z + 5, 4);
      p.ball(C.wheat, ...xy(u + d, v), z + 8, 2.5);
    }),
    (u, v, z) => [-0.3, -0.1, 0.1, 0.3].forEach((d, k) => p.ball(k % 2 ? 0x7a4f2a : 0x6b3f5a, ...xy(u + d, v), z + 2.5, 3)),
    (u, v, z) => [-0.28, -0.08, 0.12, 0.3].forEach((d) => p.ball(0xd8a35a, ...xy(u + d, v), z + 2, 3.4)),
  ];
  const layers = new Layers();
  const stall = (u0: number, u1: number, side: number, k: number) => {
    const front = side * 0.3;
    const back = side * 0.9;
    const [va, vb] = side < 0 ? [back, front] : [front, back];
    const um = (u0 + u1) / 2;
    const color = awnings[k % awnings.length];
    const parts: { v: number; draw: () => void }[] = [];
    // Sacks and jars at the back, the merchant, the counter with goods, the posts.
    parts.push({
      v: side * 0.78,
      draw: () => {
        p.ball(shade(C.fabric, 0.8), ...xy(u0 + 0.2, side * 0.78), 5, 5);
        p.ball(C.fabric, ...xy(u0 + 0.18, side * 0.76), 6, 4.2);
        jar(p, ...xy(u1 - 0.2, side * 0.78), 0, 3.4);
      },
    });
    parts.push({ v: side * 0.6, draw: () => person(p, ...xy(um + 0.12, side * 0.6), 0, k + 1) });
    parts.push({
      v: side * 0.37,
      draw: () => {
        box(u0 + 0.08, side < 0 ? front - 0.14 : front, u1 - 0.08, side < 0 ? front : front + 0.14, 0, 9, C.wood);
        goods[k % goods.length](um, side * 0.37, 9);
      },
    });
    for (const u of [u0 + 0.04, u1 - 0.04]) {
      parts.push({ v: back, draw: () => box(u - 0.025, back - 0.025, u + 0.025, back + 0.025, 0, 30, C.wood) });
      parts.push({ v: front, draw: () => box(u - 0.025, front - 0.025, u + 0.025, front + 0.025, 0, 24, C.wood) });
    }
    // Striped awning sloping down toward the aisle, with a valance on the edge facing the viewer.
    parts.push({
      v: 9,
      draw: () => {
        const n = 5;
        for (let i = 0; i < n; i++) {
          const a = u0 + ((u1 - u0) * i) / n;
          const b = u0 + ((u1 - u0) * (i + 1)) / n;
          const c = i % 2 ? C.cream : color;
          p.poly(c, [P(a, back, 30), P(b, back, 30), P(b, front, 24), P(a, front, 24)]);
          const ev = side < 0 ? front : back;
          const ez = side < 0 ? 24 : 30;
          p.poly(shade(c, 0.82), [P(a, ev, ez), P(b, ev, ez), P(b, ev, ez - 5), P(a, ev, ez - 5)]);
        }
        p.poly(shade(color, 0.6), [P(u1, va, side < 0 ? 30 : 24), P(u1, vb, side < 0 ? 24 : 30), P(u1, vb, side < 0 ? 19 : 25), P(u1, va, side < 0 ? 25 : 19)]);
      },
    });
    const [cx, cy] = xy(um, side * 0.6);
    layers.add(cx, cy, () => parts.sort((a, b) => a.v - b.v).forEach((it) => it.draw()));
  };
  // Stall spans along the long side: 2 (the far end left open), 3 or 4 a side.
  const quarter = (2 * L - 0.08) / 4;
  const spans: [number, number][] =
    level === 1
      ? [[-L + 0.04, -0.66], [-0.62, 0.58]]
      : level === 2
        ? [[-L + 0.04, -0.66], [-0.62, 0.62], [0.66, L - 0.04]]
        : [0, 1, 2, 3].map((i) => [-L + 0.04 + i * quarter + (i ? 0.02 : 0), -L + 0.04 + (i + 1) * quarter - (i < 3 ? 0.02 : 0)]);
  spans.forEach(([u0, u1], k) => {
    stall(u0, u1, -1, k);
    stall(u0, u1, 1, k + 3);
  });
  if (level === 1) {
    for (const side of [-1, 1]) {
      const [cx, cy] = xy(1.1, side * 0.6);
      layers.add(cx, cy, () => {
        p.rect(side < 0 ? C.red : 0x5a7fb5, ...rect4(0.66, side < 0 ? -0.86 : 0.34, 1.5, side < 0 ? -0.34 : 0.86), 0.5, 0.9);
        p.rect(C.cream, ...rect4(0.74, side < 0 ? -0.8 : 0.4, 1.42, side < 0 ? -0.4 : 0.8), 0.6, 0.35);
        goods[side < 0 ? 5 : 1](1.1, side * 0.62, 1);
        jar(p, ...xy(0.78, side * 0.72), 0, 3.6);
        p.ball(shade(C.fabric, 0.8), ...xy(1.45, side * 0.72), 4, 4.5);
        p.ball(C.fabric, ...xy(1.43, side * 0.7), 5, 3.8);
        person(p, ...xy(1.1, side * 0.78), 0, side < 0 ? 4 : 1);
      });
    }
  }
  // Shoppers in the aisle (more at the bigger markets) and a donkey with baskets.
  const shoppers: [number, number, number][] = [[-1.0, 0.04, 0], [0.2, -0.08, 2], [1.1, 0.06, 5]];
  if (level >= 2) shoppers.push([-0.4, 0.1, 3]);
  if (level >= 3) shoppers.push([-1.55, -0.06, 1], [0.7, -0.04, 4]);
  shoppers.forEach(([u, v, c]) => layers.add(...xy(u, v), () => person(p, ...xy(u, v), 0, c)));
  layers.add(...xy(1.65, 0), () => {
    const d = p.p(...xy(1.65, 0));
    p.g.fillStyle(C.shadow, 0.22);
    p.g.fillEllipse(d.x + 1, d.y, 20, 5);
    p.g.lineStyle(2, 0x5a4a3c);
    for (const dx of [-6, -3, 4, 7]) p.g.lineBetween(d.x + dx, d.y - 7, d.x + dx, d.y);
    p.g.fillStyle(0x8a7a6a);
    p.g.fillEllipse(d.x, d.y - 10, 18, 8);
    p.g.fillEllipse(d.x - 10, d.y - 14, 6, 5);
    p.g.fillStyle(0x6a5a4c);
    p.g.fillTriangle(d.x - 11, d.y - 16, d.x - 10, d.y - 22, d.x - 8, d.y - 16);
    p.g.fillStyle(0xb88f35);
    p.g.fillEllipse(d.x - 3, d.y - 9, 7, 8);
    p.g.fillEllipse(d.x + 4, d.y - 9, 7, 8);
  });
  layers.flush();
}

// ---------- workshops (3 x 3: local x, y in [-1.5, 1.5]) ----------
// One drawing per craft, each with its own dominant shape and colour so they read apart zoomed
// out: orange kiln and pots, dark forge with a red glow, yellow timber stacks, a loom under a
// striped awning, round vats of blue, red and yellow, tan hides on frames.

const WS = 1.46;
const WS_WALL = 10;
const WS_MUD = 0xd2a26a;
/**
 * Level of the workshop being drawn (set by `atLevel`): the yard grows more solid with it, from
 * low mud walls (1) to fieldstone walls with a paved gateway (2) and dressed limestone walls with a
 * gatehouse and a paved yard (3).
 */
let wsLevel = 1;

/** A workshop drawing at a level (see `wsLevel`). */
const atLevel = (draw: (p: Pen) => void, level: number) => (p: Pen) => {
  wsLevel = level;
  try {
    draw(p);
  } finally {
    wsLevel = 1;
  }
};

/** A yard wall segment of the current workshop level. */
function workWall(p: Pen, x0: number, y0: number, x1: number, y1: number, seed: number) {
  if (wsLevel === 1) return p.box(x0, y0, x1, y1, 0, WS_WALL, shade(WS_MUD, 0.95));
  if (wsLevel === 2) return rubble(p, x0, y0, x1, y1, 0, WS_WALL + 3, C.rock, seed, 4);
  paleStone(p, x0, y0, x1, y1, 0, WS_WALL + 6);
  masonry(p, x0, y0, x1, y1, 0, WS_WALL + 6, C.stone, 0.7);
}

/** Trodden yard and the back (north and west) walls; from level 2 a paved way in from the gate. */
function workBack(p: Pen, ground = shade(C.sand[0], 0.88)) {
  p.rect(ground, -WS, -WS, WS, WS, 0, 0.9);
  if (wsLevel >= 2) {
    const [x0, x1, y0] = wsLevel === 3 ? [-0.55, 0.55, -0.1] : [-0.32, 0.32, 0.7];
    p.rect(shade(C.stone, 0.9), x0, y0, x1, WS, 0, 0.95);
    for (let y = y0 + 0.12; y < WS; y += 0.12) p.line(shade(C.stone, 0.72), 1, [x0, y], [x1, y], 0.5);
    for (let x = x0 + 0.18; x < x1; x += 0.18) p.line(shade(C.stone, 0.72), 1, [x, y0], [x, WS], 0.35);
  }
  workWall(p, -WS, -WS, -WS + 0.1, WS, 71);
  workWall(p, -WS + 0.1, -WS, WS, -WS + 0.1, 72);
}

/** Front (south) and east yard walls with a gate in the middle of the front (a gatehouse at level 3). */
function workFront(p: Pen) {
  const s = WS;
  workWall(p, s - 0.1, -s, s, s, 73);
  workWall(p, -s, s - 0.1, -0.35, s, 74);
  workWall(p, 0.35, s - 0.1, s, s, 75);
  const post = wsLevel === 1 ? shade(WS_MUD, 1.05) : C.limestone;
  const top = WS_WALL + [4, 8, 14][wsLevel - 1];
  for (const x of [-0.35, 0.35]) p.box(x - 0.05, s - 0.12, x + 0.05, s, 0, top, post);
  // Level 3: a stone lintel with a flat roof over the gate.
  if (wsLevel === 3) {
    p.shadow(-0.42, s - 0.2, 0.42, s, top + 4, 0.16);
    paleStone(p, -0.42, s - 0.2, 0.42, s, top, top + 5);
    p.rect(shade(C.limestone, 0.9), -0.4, s - 0.18, 0.4, s - 0.02, top + 5);
  }
}

/** Mud-brick workroom with a flat roof, beam ends, a door and two small windows. */
function workroom(p: Pen, x0: number, y0: number, x1: number, y1: number, h: number, color = WS_MUD) {
  p.shadow(x0, y0, x1, y1, h);
  p.box(x0, y0, x1, y1, 0, h, shade(color, 1.06), color, shade(color, 0.66));
  bricks(p, x0, y0, x1, y1, 0, h, color);
  roofTop(p, x0, y0, x1, y1, h, color);
  for (let x = x0 + 0.1; x < x1 - 0.05; x += 0.18) p.box(x, y1, x + 0.05, y1 + 0.05, h - 6, h - 3, C.woodDark);
  const mid = (x0 + x1) / 2;
  p.southQuad(0x3a2c20, y1 + 0.002, mid - 0.24, mid + 0.08, 0, 18);
  p.southQuad(HOLE, y1 + 0.002, x1 - 0.3, x1 - 0.15, h - 16, h - 10);
  p.eastQuad(HOLE, x1 + 0.002, (y0 + y1) / 2 - 0.08, (y0 + y1) / 2 + 0.08, h - 16, h - 10);
}

/** Quad standing on the plane y = const (a loom, a frame, a hanging cloth), lit like a south face. */
function standS(p: Pen, color: number, y: number, x0: number, x1: number, z0: number, z1: number) {
  p.southQuad(p.south(color, 1, 0.78), y, x0, x1, z0, z1);
}

/** Glowing coals: a dark bed with orange and yellow embers and a soft halo. */
function embers(p: Pen, x: number, y: number, z: number, r: number, seed: number) {
  const rng = createRng(seed);
  p.disc(0x2a1f17, x, y, z, r);
  const c = p.p(x, y, z);
  for (let i = 3; i >= 1; i--) {
    p.g.fillStyle(0xf06a28, 0.22 * (4 - i));
    p.g.fillCircle(c.x, c.y - 1, i * 3.4);
  }
  for (let k = 0; k < 10; k++)
    p.ball(k % 3 ? 0xe8502a : 0xf6c84c, x + (rng() - 0.5) * r * 1.4, y + (rng() - 0.5) * r * 1.4, z + 0.5, 1.4 + rng());
}

/**
 * Potter (0): a mud-brick workroom, a domed kiln with a chimney (smoke and glow from
 * PARTS.craftFire), a reed shade over the wheel, rows of pots drying in the yard and firewood.
 */
function workPottery(p: Pen) {
  const mud = WS_MUD;
  workBack(p);
  const [x0, y0, x1, y1, h] = [-1.36, -1.36, 0.2, -0.3, 32];
  workroom(p, x0, y0, x1, y1, h);
  for (const [x, y] of [[-1.1, -1.1], [-0.95, -1.15], [-1.0, -0.95], [-0.8, -1.0], [-0.85, -0.82]] as const) jar(p, x, y, h, 3.2);
  logs(p, -0.2, -0.75, h, 2);
  // Kiln: a round mud base with a dome and a chimney, glowing firing hole.
  const k = PARTS.craftFire.pottery!.smoke;
  p.shadow(k.x - 0.45, k.y - 0.45, k.x + 0.45, k.y + 0.45, 30, 0.18);
  cylinder(p, k.x, k.y, 0.46, 0, 12, shade(mud, 0.9));
  dome(p, k.x, k.y, 12, 0.46, 16, shade(mud, 0.9));
  p.box(k.x - 0.08, k.y - 0.08, k.x + 0.08, k.y + 0.08, 20, k.z, C.rock, shade(C.rock, 0.9), C.rockDark);
  p.rect(0x2a1f17, k.x - 0.05, k.y - 0.05, k.x + 0.05, k.y + 0.05, k.z);
  const hole = p.p(k.x - 0.2, k.y + 0.35, 4);
  p.g.fillStyle(0x2a1f17);
  p.g.fillEllipse(hole.x, hole.y, 12, 9);
  for (let i = 3; i >= 1; i--) {
    p.g.fillStyle(0xf08a32, 0.28 * (4 - i));
    p.g.fillCircle(hole.x, hole.y + 1, i * 2);
  }
  logs(p, 1.38, -0.15, 0, 3);
  // Reed shade over the potter's wheel.
  const [sx0, sy0, sx1, sy1, sz] = [-1.3, 0.0, -0.3, 0.85, 22];
  person(p, -0.75, 0.3, 0, 1);
  cylinder(p, -0.62, 0.42, 0.1, 0, 5, C.wood);
  p.disc(shade(C.terracotta, 0.9), -0.62, 0.42, 5, 0.08);
  p.ball(C.terracotta, -0.62, 0.42, 8, 3);
  for (const [x, y] of [[sx0, sy0], [sx1, sy0], [sx0, sy1], [sx1, sy1]] as const) p.box(x, y, x + 0.04, y + 0.04, 0, sz, C.wood);
  p.box(sx0 - 0.04, sy0 - 0.04, sx1 + 0.08, sy1 + 0.08, sz, sz + 2, REED[0], REED[1], REED[2]);
  for (let y = sy0; y < sy1 + 0.05; y += 0.07) p.line(0x9c7f45, 1, [sx0 - 0.04, y, sz + 2], [sx1 + 0.08, y, sz + 2], 0.7);
  // Rows of big storage jars and pots drying in the yard.
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 4; i++) jar(p, 0.15 + i * 0.26, 0.25 + row * 0.3, 0, row === 1 ? 4 : 3.4, row === 2 ? shade(C.terracotta, 1.15) : C.terracotta);
  }
  p.disc(0x8a5a3a, -0.05, 1.1, 0, 0.18);
  p.disc(0x6e4630, -0.05, 1.1, 0.5, 0.12);
  workFront(p);
}

/** Hanging smith's tool: tongs, a hammer, a sickle or an axe, from a bar at height z. */
function hangingTool(p: Pen, x: number, y: number, z: number, kind: number) {
  const iron = 0x3e3b38;
  const lit = 0x8c8780;
  p.line(C.rope, 1, [x, y, z], [x, y, z - 3]);
  if (kind === 0) {
    p.line(iron, 1.6, [x - 0.02, y, z - 3], [x - 0.05, y, z - 15]);
    p.line(iron, 1.6, [x + 0.02, y, z - 3], [x + 0.05, y, z - 15]);
  } else if (kind === 1) {
    p.line(C.woodDark, 2, [x, y, z - 3], [x, y, z - 14]);
    p.box(x - 0.06, y - 0.02, x + 0.06, y + 0.02, z - 17, z - 13, iron, lit, iron);
  } else if (kind === 2) {
    p.line(C.woodDark, 2, [x, y, z - 3], [x, y, z - 8]);
    const c = p.p(x, y, z - 13);
    p.g.lineStyle(2, lit);
    p.g.beginPath();
    p.g.arc(c.x + 2, c.y, 5, Math.PI * 0.6, Math.PI * 1.9, false);
    p.g.strokePath();
  } else {
    p.line(C.woodDark, 2, [x, y, z - 3], [x, y, z - 15]);
    p.poly(lit, [[x, y, z - 5], [x + 0.1, y, z - 3], [x + 0.1, y, z - 10], [x, y, z - 8]]);
  }
}

/**
 * Smithy (1): a rough-stone workroom with a sooty roof, a stone forge with a tall chimney and a
 * glowing coal bed, leather bellows, a big anvil on a stump with a red-hot bar, a rack of hanging
 * tools, a heap of charcoal and a quenching trough.
 */
function workSmithy(p: Pen) {
  const stone = 0xb4a48a;
  const soot = 0x4a423a;
  workBack(p, shade(C.sand[0], 0.8));
  p.disc(soot, 0.55, -0.4, 0, 0.75, 0.35);
  p.disc(soot, 0.3, 0.3, 0, 0.5, 0.3);
  // Workroom.
  const [x0, y0, x1, y1, h] = [-1.36, -1.36, -0.15, -0.55, 26];
  p.shadow(x0, y0, x1, y1, h);
  rubble(p, x0, y0, x1, y1, 0, h, stone, 21);
  p.rect(shade(soot, 1.1), x0 + 0.04, y0 + 0.04, x1 - 0.04, y1 - 0.04, h, 0.85);
  p.southQuad(0x2a2018, y1 + 0.002, -0.95, -0.65, 0, 17);
  logs(p, -0.35, -1.0, h, 2);
  // Forge: a stone hearth with coals, a tall chimney at its back and bellows on the west side.
  const gl = PARTS.craftFire.smithy!.glow;
  const sm = PARTS.craftFire.smithy!.smoke;
  const [fx0, fy0, fx1, fy1] = [0.3, -1.34, 1.3, -0.5];
  p.shadow(fx0, fy0, fx1, fy1, 40, 0.2);
  rubble(p, fx0, fy0 + 0.25, fx1, fy1, 0, gl.z, stone, 23);
  embers(p, gl.x, gl.y + 0.05, gl.z, 0.24, 9);
  rubble(p, sm.x - 0.2, sm.y - 0.2, sm.x + 0.2, sm.y + 0.2, gl.z, sm.z, stone, 22, 6);
  p.rect(0x1e1814, sm.x - 0.13, sm.y - 0.13, sm.x + 0.13, sm.y + 0.13, sm.z);
  // Firing mouth on the front of the hearth.
  p.southQuad(0x1e1814, fy1 + 0.003, 0.55, 0.95, 2, 10);
  p.southQuad(0xe8582a, fy1 + 0.004, 0.6, 0.9, 2, 6);
  p.southQuad(0xf6c84c, fy1 + 0.005, 0.68, 0.82, 2, 4);
  for (const dy of [0, 0.16]) {
    const b = p.p(0.12, -1.0 + dy, 6);
    p.g.fillStyle(0x5a3a24);
    p.g.fillEllipse(b.x, b.y, 13, 8);
    p.g.fillStyle(0x7a5232);
    p.g.fillEllipse(b.x - 1.5, b.y - 1.5, 9, 5);
  }
  // Tool rack in front of the workroom.
  const [rx0, rx1, ry, rz] = [-1.25, -0.3, -0.3, 24];
  for (const x of [rx0, rx1]) p.box(x - 0.03, ry - 0.03, x + 0.03, ry + 0.03, 0, rz + 2, C.woodDark);
  p.line(C.woodDark, 2.5, [rx0, ry, rz], [rx1, ry, rz]);
  [-1.12, -0.95, -0.78, -0.62, -0.46].forEach((x, k) => hangingTool(p, x, ry + 0.01, rz, k % 4));
  // Anvil on a stump, a red-hot bar on it, and the smith.
  const [ax, ay] = [0.35, 0.2];
  p.shadow(ax - 0.18, ay - 0.12, ax + 0.18, ay + 0.12, 14, 0.25);
  cylinder(p, ax, ay, 0.17, 0, 8, C.wood);
  p.box(ax - 0.2, ay - 0.1, ax + 0.16, ay + 0.1, 8, 10, 0x55514c, 0x47433f, 0x34312e);
  p.box(ax - 0.12, ay - 0.06, ax + 0.1, ay + 0.06, 10, 12, 0x55514c, 0x47433f, 0x34312e);
  p.box(ax - 0.24, ay - 0.12, ax + 0.2, ay + 0.12, 12, 16, 0x6a6560, 0x4a4643, 0x34312e);
  p.poly(0x4a4643, [[ax - 0.24, ay - 0.08, 16], [ax - 0.24, ay + 0.08, 16], [ax - 0.42, ay, 15]]);
  p.line(0xf0782c, 2.5, [ax - 0.1, ay, 16.5], [ax + 0.14, ay, 16.5]);
  p.ball(0xf6c84c, ax + 0.1, ay, 17, 1.2);
  person(p, ax - 0.1, ay + 0.35, 0, 2);
  // Charcoal heap, baskets of ore and iron bars, a quenching trough.
  const ch = p.p(-0.85, 0.75, 0);
  dome(p, -0.85, 0.75, 0, 0.32, 10, 0x2e2a28);
  p.g.fillStyle(0x6a625c);
  for (const [dx, dy] of [[-4, -6], [3, -4], [-1, -8], [5, -7]]) p.g.fillCircle(ch.x + dx, ch.y + dy, 1);
  jar(p, -1.2, 0.35, 0, 3.2, 0x7a6a5a);
  p.box(0.85, 0.35, 1.3, 0.75, 0, 7, C.rock, shade(C.rock, 0.9), C.rockDark);
  p.rect(0x3a5a78, 0.89, 0.39, 1.26, 0.71, 7);
  p.line(C.waterLight, 1, [0.95, 0.5, 7], [1.15, 0.5, 7], 0.6);
  for (let k = 0; k < 4; k++) p.box(0.5 + k * 0.03, 0.85 + k * 0.08, 1.05, 0.9 + k * 0.08, 0, 2.5, 0x5a5652, 0x4a4643, 0x34312e);
  workFront(p);
}

/** A stack of sawn planks in layers with spacers between them, rising to about z = layers * 3.4. */
function plankStack(p: Pen, x0: number, y0: number, x1: number, y1: number, layers: number, wood: number) {
  p.shadow(x0, y0, x1, y1, layers * 3.4, 0.2);
  for (let l = 0; l < layers; l++) {
    const z = l * 3.4;
    const off = l % 2 ? 0.04 : 0;
    p.box(x0 + 0.06, y0 + 0.08, x0 + 0.12, y1 - 0.08, z, z + 0.8, C.woodDark);
    p.box(x1 - 0.12, y0 + 0.08, x1 - 0.06, y1 - 0.08, z, z + 0.8, C.woodDark);
    const n = 3;
    for (let k = 0; k < n; k++) {
      const ya = y0 + ((y1 - y0) * k) / n + 0.008;
      const yb = y0 + ((y1 - y0) * (k + 1)) / n - 0.008;
      p.box(x0 + off, ya, x1 - 0.04 + off, yb, z + 0.8, z + 3.4, shade(wood, 1 + ((k + l) % 3) * 0.05));
    }
  }
}

/** Logs lying along y with their cut ends facing south, piled in rows 3-2-1. */
function logPile(p: Pen, x0: number, y0: number, y1: number, r = 0.11) {
  const rows = [3, 2, 1];
  rows.forEach((n, row) => {
    for (let k = 0; k < n; k++) {
      const x = x0 + (row * r) + k * r * 2;
      const z = r * 22 + row * r * 34;
      p.box(x - r * 0.8, y0, x + r * 0.8, y1, z - r * 20, z + r * 16, 0x8a6440, 0x7a5636, 0x5e4228);
      const c = p.p(x, y1, z);
      p.g.fillStyle(0x6e4b2e);
      p.g.fillCircle(c.x, c.y, r * 30);
      p.g.fillStyle(0xd8b07a);
      p.g.fillCircle(c.x, c.y, r * 24);
      p.g.lineStyle(1, 0xa8804e, 0.9);
      p.g.strokeCircle(c.x, c.y, r * 13);
    }
  });
}

/**
 * Carpentry (2): a small mud workroom, a tall stack of pale planks and a smaller stack of red
 * cedar, a pyramid of logs, planks leaning on the wall, a workbench with a saw, a sawhorse and
 * wood shavings around the carpenter.
 */
function workCarpentry(p: Pen) {
  const pine = 0xecc88a;
  const cedar = 0xb8744a;
  workBack(p);
  workroom(p, -1.36, -1.36, -0.4, -0.55, 30);
  // Planks leaning on the workroom.
  for (const [x, c] of [[-1.25, pine], [-1.12, shade(pine, 0.9)], [-0.62, cedar]] as const)
    p.poly(p.south(c, 1, 0.8), [[x, -0.5, 0], [x + 0.09, -0.5, 0], [x + 0.13, -0.55, 24], [x + 0.04, -0.55, 24]]);
  plankStack(p, -0.2, -1.32, 1.3, -0.82, 9, pine);
  plankStack(p, 0.55, -0.62, 1.3, -0.15, 5, cedar);
  logPile(p, -1.2, -0.1, 0.32);
  // Workbench with a plank, a saw and an adze; a sawhorse with a beam.
  const [bx0, by0, bx1, by1, bz] = [-0.25, 0.3, 0.55, 0.55, 11];
  p.shadow(bx0, by0, bx1, by1, bz, 0.2);
  for (const [x, y] of [[bx0 + 0.04, by0 + 0.03], [bx1 - 0.08, by0 + 0.03], [bx0 + 0.04, by1 - 0.06], [bx1 - 0.08, by1 - 0.06]] as const)
    p.box(x, y, x + 0.04, y + 0.03, 0, bz, C.woodDark);
  p.box(bx0, by0, bx1, by1, bz, bz + 2.5, C.wood);
  p.box(bx0 + 0.1, by0 + 0.06, bx1 - 0.15, by0 + 0.2, bz + 2.5, bz + 4.5, pine);
  p.line(0x8c8780, 2.5, [bx0 + 0.3, by1 - 0.06, bz + 3], [bx1 - 0.05, by1 - 0.08, bz + 3]);
  p.line(C.woodDark, 3, [bx0 + 0.22, by1 - 0.06, bz + 3], [bx0 + 0.3, by1 - 0.06, bz + 3]);
  person(p, 0.1, 0.78, 0, 3);
  for (const [x, y] of [[0.85, 0.35], [0.85, 0.75]] as const) {
    p.line(C.woodDark, 2, [x - 0.08, y, 0], [x, y, 9]);
    p.line(C.woodDark, 2, [x + 0.08, y, 0], [x, y, 9]);
  }
  p.box(0.78, 0.25, 0.92, 0.85, 9, 13, cedar);
  const r = createRng(31);
  for (let k = 0; k < 22; k++) p.ball(shade(pine, 1.1 + r() * 0.2), -0.3 + r() * 1.3, 0.25 + r() * 0.85, 0, 1 + r() * 0.8, 0.9);
  workFront(p);
}

/** Cloth roll lying along x at height z, with a spiral end facing east (seen on screen right). */
function clothRoll(p: Pen, x0: number, x1: number, y: number, z: number, color: number, stripe: number) {
  const r = 0.07;
  p.box(x0, y - r, x1, y + r, z, z + 5, color, shade(color, 0.86), shade(color, 0.7));
  p.line(stripe, 1.5, [x0 + 0.08, y + r, z + 2.5], [x1 - 0.08, y + r, z + 2.5]);
  const c = p.p(x1, y, z + 2.5);
  p.g.fillStyle(shade(color, 0.62));
  p.g.fillCircle(c.x, c.y, 3.4);
  p.g.lineStyle(1, shade(color, 1.25), 0.9);
  p.g.strokeCircle(c.x, c.y, 2);
}

/**
 * Weaving (3): a mud workroom with fleeces drying on the roof, a striped awning over an upright
 * loom with clay loom weights and a half-woven striped cloth, a ground loom pegged in the yard,
 * a bench stacked with coloured cloth rolls and a basket of wool.
 */
function workWeaving(p: Pen) {
  workBack(p);
  const h = 30;
  workroom(p, -1.36, -1.36, 0.0, -0.6, h);
  for (const [x, y] of [[-1.15, -1.15], [-0.9, -1.0], [-0.6, -1.15], [-0.35, -0.95]] as const) {
    p.ball(0xd8cfbe, x, y, h + 2, 4.5);
    p.ball(0xf4efe4, x - 0.02, y - 0.02, h + 3, 3.4);
  }
  // Striped awning on poles, sloping down to the front.
  const [ax0, ax1, ay0, ay1, az] = [-1.32, -0.1, -0.55, 0.12, 22];
  for (const x of [ax0 + 0.03, ax1 - 0.03]) p.box(x - 0.025, ay1 - 0.03, x + 0.025, ay1 + 0.02, 0, az + 6, C.woodDark);
  const n = 6;
  for (let k = 0; k < n; k++) {
    const xa = ax0 + (k * (ax1 - ax0)) / n;
    const xb = xa + (ax1 - ax0) / n;
    p.poly(k % 2 ? C.cream : 0x4f6f9e, [[xa, ay0, az + 12], [xb, ay0, az + 12], [xb, ay1, az + 6], [xa, ay1, az + 6]]);
  }
  for (let k = 0; k < n; k++) {
    const xa = ax0 + (k * (ax1 - ax0)) / n;
    const xb = xa + (ax1 - ax0) / n;
    p.southQuad(shade(k % 2 ? C.cream : 0x4f6f9e, 0.85), ay1, xa, xb, az + 2.5, az + 6);
  }
  // Upright warp-weighted loom just under the front edge of the awning.
  const [lx0, lx1, ly] = [-1.12, -0.3, ay1 + 0.04];
  p.shadow(lx0, ly - 0.05, lx1, ly + 0.05, 26, 0.18);
  const bands = [0xa8473a, C.cream, 0x3e5279, C.cream, 0xc89848];
  bands.forEach((c, k) => standS(p, c, ly, lx0 + 0.04, lx1 - 0.04, 24 - (k + 1) * 2.4, 24 - k * 2.4));
  for (let x = lx0 + 0.07; x < lx1 - 0.05; x += 0.055) p.line(0xeee4cc, 1, [x, ly, 12], [x, ly, 5]);
  p.line(C.woodDark, 2, [lx0 + 0.04, ly, 12], [lx1 - 0.04, ly, 12]);
  for (let x = lx0 + 0.08; x < lx1 - 0.05; x += 0.11) p.ball(0x9a6a48, x, ly + 0.005, 4, 1.8);
  for (const x of [lx0, lx1]) p.line(C.woodDark, 3, [x, ly - 0.06, 0], [x, ly, 28]);
  p.line(C.woodDark, 3, [lx0 - 0.04, ly, 25], [lx1 + 0.04, ly, 25]);
  person(p, -0.62, ly + 0.28, 0, 4);
  // Bench of cloth rolls in many colours.
  const [bx0, bx1] = [0.25, 1.25];
  p.shadow(bx0, -1.3, bx1, -0.55, 14, 0.2);
  p.box(bx0, -1.3, bx1, -0.55, 0, 4, C.wood);
  const rolls: [number, number, number, number][] = [
    [-1.2, 4, 0xa8473a, C.gold], [-1.05, 4, 0x3e5279, C.cream], [-0.9, 4, 0xc89848, 0xa8473a], [-0.75, 4, 0x6f8a4a, C.cream], [-0.62, 4, C.cream, 0x3e5279],
    [-1.12, 9, 0x7a4f86, C.gold], [-0.97, 9, 0xc0503c, C.cream], [-0.82, 9, 0x4f6f9e, C.gold], [-0.68, 9, 0xe2b544, 0x7a4f86],
    [-1.05, 14, C.cream, 0xa8473a], [-0.9, 14, 0xa8473a, C.cream],
  ];
  for (const [y, z, c, s] of rolls) clothRoll(p, bx0 + 0.05, bx1 - 0.08, y, z, c, s);
  // Basket of wool and a ground loom pegged in the yard.
  p.disc(0x8a6a40, 1.05, -0.2, 0, 0.18);
  cylinder(p, 1.05, -0.2, 0.17, 0, 6, 0xa77a44);
  for (const [dx, dy] of [[-0.06, -0.04], [0.06, 0], [0, 0.06]]) p.ball(0xf4efe4, 1.05 + dx, -0.2 + dy, 8, 3.2);
  const [gx0, gx1, gy0, gy1] = [0.2, 1.15, 0.3, 0.95];
  for (const [x, y] of [[gx0, gy0], [gx1, gy0], [gx0, gy1], [gx1, gy1]] as const) p.box(x - 0.025, y - 0.025, x + 0.025, y + 0.025, 0, 3, C.woodDark);
  p.line(C.woodDark, 2, [gx0, gy0, 2], [gx1, gy0, 2]);
  p.line(C.woodDark, 2, [gx0, gy1, 2], [gx1, gy1, 2]);
  for (let x = gx0 + 0.05; x < gx1 - 0.02; x += 0.05) p.line(0xeee4cc, 1, [x, gy0, 2], [x, gy1, 2], 0.85);
  p.rect(0xa8473a, gx0 + 0.03, gy0 + 0.02, gx1 - 0.03, gy0 + 0.3, 2.2);
  p.rect(C.cream, gx0 + 0.03, gy0 + 0.12, gx1 - 0.03, gy0 + 0.17, 2.3);
  person(p, 0.65, 1.12, 0, 5, 0.8);
  workFront(p);
}

/** Long cloths drying from a line between two tall poles. */
function dryingLine(p: Pen, a: [number, number], b: [number, number], z: number, cloths: number[]) {
  p.line(C.woodDark, 2, [a[0], a[1], 0], [a[0], a[1], z + 2]);
  p.line(C.woodDark, 2, [b[0], b[1], 0], [b[0], b[1], z + 2]);
  p.line(C.rope, 1, [a[0], a[1], z], [b[0], b[1], z]);
  const at = (t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  cloths.forEach((color, k) => {
    const t0 = (k + 0.15) / cloths.length;
    const t1 = (k + 0.9) / cloths.length;
    const [ax, ay] = at(t0);
    const [bx, by] = at(t1);
    const drop = 22 - (k % 2) * 5;
    p.poly(p.south(color, 1, 0.8), [[ax, ay, z], [bx, by, z], [bx, by, z - drop], [ax, ay, z - drop + 2]]);
    p.poly(p.south(shade(color, 0.8), 1, 0.8), [[ax, ay, z - drop + 5], [bx, by, z - drop + 3], [bx, by, z - drop], [ax, ay, z - drop + 2]]);
  });
}

/** Round plastered vat of dye with a coloured surface. */
function vat(p: Pen, x: number, y: number, color: number) {
  const r = 0.21;
  p.disc(C.shadow, ...p.away(x, y, 0.08), 0, r, 0.2);
  p.disc(color, x + 0.1, y + 0.12, 0, r * 1.15, 0.25);
  cylinder(p, x, y, r, 0, 9, 0xd8ccb2);
  p.disc(color, x, y, 9, r * 0.78);
  p.disc(shade(color, 1.35), x - 0.05, y - 0.05, 9, r * 0.28, 0.8);
}

/**
 * Dyeing (4): a small mud workroom, two lines of long cloths drying on tall poles, two rows of
 * plastered vats of indigo blue, madder red and saffron yellow with spills around them, the dyer
 * stirring with a pole, jars of dyestuff and a pile of folded dyed cloth.
 */
function workDyeing(p: Pen) {
  const blue = 0x2f56a8;
  const red = 0xb82e2a;
  const yellow = 0xe8b424;
  workBack(p);
  workroom(p, -1.36, -1.36, -0.45, -0.6, 28);
  dryingLine(p, [-0.25, -1.25], [1.32, -1.25], 40, [blue, red, yellow, blue]);
  dryingLine(p, [0.3, -0.6], [1.32, -0.6], 36, [red, yellow, blue]);
  jars(p, -1.15, -0.35, 0, 0x8a6a4a);
  jar(p, -0.7, -0.4, 0, 3.4, C.terracotta);
  const vats: [number, number, number][] = [
    [-1.0, 0.2, blue], [-0.45, 0.2, red], [0.1, 0.2, yellow],
    [-0.75, 0.75, yellow], [-0.2, 0.75, blue], [0.35, 0.75, red],
  ];
  for (const [x, y, c] of vats) vat(p, x, y, c);
  person(p, 0.62, 0.42, 0, 0);
  p.line(C.woodDark, 2, [0.42, 0.68, 9], [0.62, 0.42, 26]);
  // Folded dyed cloth.
  [blue, yellow, red, blue].forEach((c, k) => p.box(0.85, 0.75, 1.25, 1.1, k * 2.4, k * 2.4 + 2.4, c));
  workFront(p);
}

/** A wooden frame on the plane y with a hide stretched and laced inside it. */
function hideFrame(p: Pen, x0: number, x1: number, y: number, z1: number, hide: number) {
  for (const x of [x0, x1]) p.line(C.woodDark, 3, [x, y, 0], [x, y, z1 + 3]);
  p.line(C.woodDark, 3, [x0, y, z1], [x1, y, z1]);
  p.line(C.woodDark, 3, [x0, y, 5], [x1, y, 5]);
  const w = x1 - x0;
  const [cx, cz, hz] = [(x0 + x1) / 2, (z1 + 5) / 2, (z1 - 5) / 2];
  const shape: [number, number][] = [
    [-0.46, 0.9], [-0.32, 0.7], [-0.12, 0.76], [0, 0.86], [0.12, 0.76], [0.32, 0.7], [0.46, 0.9], [0.4, 0.3], [0.34, -0.35],
    [0.46, -0.9], [0.22, -0.72], [0, -0.8], [-0.22, -0.72], [-0.46, -0.9], [-0.34, -0.35], [-0.4, 0.3],
  ];
  const pts = shape.map(([u, v]) => [cx + u * w, y + 0.002, cz + v * hz] as P3);
  p.poly(p.south(shade(hide, 0.7), 1, 0.8), pts);
  const inner = (k: number) => pts.map(([x, yy, z]) => [cx + (x - cx) * k, yy + 0.001, cz + ((z ?? 0) - cz) * k] as P3);
  p.poly(p.south(hide, 1, 0.8), inner(0.86));
  p.poly(p.south(shade(hide, 1.18), 1, 0.8), inner(0.45));
  for (const [u, v] of [shape[0], shape[6], shape[9], shape[13], shape[8], shape[14], shape[3], shape[11]]) {
    const [ex, ez] = Math.abs(v) > 0.8 ? [cx + u * w, v > 0 ? z1 : 5] : [u < 0 ? x0 : x1, cz + v * hz];
    p.line(C.rope, 1, [cx + u * w, y + 0.003, cz + v * hz], [ex, y + 0.003, ez]);
  }
}

/** Staved wooden tub with iron-dark hoops, filled with tanning liquor. */
function tub(p: Pen, x: number, y: number, r: number, h: number) {
  p.disc(C.shadow, ...p.away(x, y, 0.08), 0, r, 0.22);
  cylinder(p, x, y, r, 0, h, 0x9a6a40);
  for (const z of [2.5, h - 2.5]) {
    const c = p.p(x, y, z);
    p.g.lineStyle(1.5, 0x4a3426, 0.9);
    p.g.beginPath();
    p.g.arc(c.x, c.y, r * SQRT2 * HW, 0.15, Math.PI - 0.15, false);
    p.g.strokePath();
  }
  p.disc(0x5a3a22, x, y, h, r * 0.8);
}

/**
 * Tannery (5): a mud workroom, three wooden frames with hides stretched and laced on them, a white
 * lime pit with a soaking hide, staved tubs of tanning liquor, a scraping beam with a worker and
 * a pile of finished leather.
 */
function workTannery(p: Pen) {
  const hide = 0xa8643a;
  workBack(p, shade(C.sand[0], 0.84));
  workroom(p, -1.36, -1.36, -0.35, -0.6, 28);
  hideFrame(p, -0.15, 0.55, -0.9, 38, hide);
  hideFrame(p, 0.65, 1.32, -0.9, 38, shade(hide, 0.82));
  for (const [x, y, r] of [[-1.1, -0.2, 0.17], [-0.7, -0.25, 0.15], [-1.1, 0.25, 0.15]] as const) tub(p, x, y, r, 12);
  hideFrame(p, 0.3, 1.05, -0.05, 32, shade(hide, 1.12));
  // Lime pit with a soaking hide.
  const [lx0, ly0, lx1, ly1] = [0.25, 0.45, 1.0, 1.05];
  p.rect(shade(C.limestone, 0.7), lx0 - 0.05, ly0 - 0.05, lx1 + 0.05, ly1 + 0.05);
  p.rect(0xeae6dc, lx0, ly0, lx1, ly1);
  p.poly(0xc8c2b4, [[lx0, ly0, 0], [lx1, ly0, 0], [lx1 - 0.05, ly0 + 0.06, 0], [lx0 + 0.05, ly0 + 0.06, 0]]);
  p.poly(0x9a6a42, [[0.45, 0.65, 0.1], [0.75, 0.6, 0.1], [0.8, 0.85, 0.1], [0.5, 0.92, 0.1]], 0.8);
  // Scraping beam with a hide over it and the tanner.
  p.line(C.woodDark, 2, [-0.85, 0.85, 0], [-0.85, 0.85, 8]);
  p.line(0x8a6440, 5, [-1.25, 0.6, 0], [-0.55, 0.85, 12]);
  p.poly(hide, [[-0.9, 0.7, 11], [-0.6, 0.82, 14], [-0.55, 0.95, 4], [-0.85, 0.85, 3]]);
  person(p, -0.4, 1.0, 0, 3);
  [0x8a5a36, 0x6e4630, 0x9a6a42].forEach((c, k) => p.box(1.0 - k * 0.02, 0.0 + k * 0.03, 1.32, 0.35, k * 2, k * 2 + 2, c));
  workFront(p);
}

/** Workshop drawings, one per craft in the order of BUILDINGS.workshop.crafts. */
const CRAFT_ART: Record<Craft, (p: Pen) => void> = {
  pottery: workPottery,
  smithy: workSmithy,
  carpentry: workCarpentry,
  weaving: workWeaving,
  dyeing: workDyeing,
  tannery: workTannery,
};

/**
 * Altar (4 x 4): a court of fieldstones with a low rough wall, and the altar itself, a square mound
 * of unhewn stones with a ramp instead of steps, horns at the corners and the fire on top.
 */
function altar(p: Pen) {
  const s = 1.94;
  const warm = 0xdcc8a0;
  p.rect(shade(warm, 0.86), -s, -s, s, s);
  const r = createRng(77);
  for (let k = 0; k < 90; k++) {
    const x = -s + 0.1 + r() * (2 * s - 0.2);
    const y = -s + 0.1 + r() * (2 * s - 0.2);
    p.disc(shade(warm, 0.9 + r() * 0.2), x, y, 0, 0.06 + r() * 0.07, 0.9);
  }
  const wallH = 7;
  rubble(p, -s, -s, s, -s + 0.16, 0, wallH, warm, 1);
  rubble(p, -s, -s + 0.16, -s + 0.16, s, 0, wallH, warm, 2);
  const [a, top] = [1.0, PARTS.altarFire.z];
  const [ax0, ay0, ax1, ay1] = [-a, -a - 0.2, a, a - 0.2];
  p.shadow(ax0, ay0, ax1, ay1, top + 10);
  // Wood stack and ash heap behind the altar.
  logs(p, 1.6, -1.2, 0, 3);
  p.disc(0x8a8278, -1.35, -1.25, 0, 0.22);
  p.disc(0x6e665c, -1.35, -1.25, 2, 0.14);
  rubble(p, ax0, ay0, ax1, ay1, 0, top, warm, 3);
  // Hearth with embers on top, rough horns at the corners.
  p.disc(0x3a2c20, PARTS.altarFire.x, PARTS.altarFire.y, top, 0.4);
  p.disc(0x5a3a22, PARTS.altarFire.x, PARTS.altarFire.y, top, 0.28);
  for (let k = 0; k < 8; k++) p.ball(k % 2 ? 0xe8742c : 0xf6c84c, PARTS.altarFire.x - 0.22 + r() * 0.44, PARTS.altarFire.y - 0.22 + r() * 0.44, top, 1.6);
  for (const [x, y] of [[ax0 + 0.12, ay0 + 0.12], [ax1 - 0.12, ay0 + 0.12], [ax0 + 0.12, ay1 - 0.12], [ax1 - 0.12, ay1 - 0.12]] as const) {
    const c = p.p(x, y, top);
    p.g.fillStyle(shade(warm, 0.62));
    p.g.fillEllipse(c.x + 1, c.y - 4, 11, 10);
    p.g.fillStyle(shade(warm, 0.95));
    p.g.fillEllipse(c.x - 1, c.y - 6, 9, 8);
    p.g.fillStyle(shade(warm, 1.15));
    p.g.fillEllipse(c.x - 2.5, c.y - 8, 4, 3);
  }
  // Ramp up the south side (no steps), with rough stones along its edges.
  const [rx0, rx1, ry0, ry1] = [-0.36, 0.36, ay1, s - 0.12];
  p.poly(shade(warm, 0.6), [[rx1, ry0, 0], [rx1, ry1, 0], [rx1, ry0, top]]);
  p.poly(shade(warm, 1.02), [[rx0, ry0, top], [rx1, ry0, top], [rx1, ry1, 0], [rx0, ry1, 0]]);
  for (let t = 0.05; t < 0.98; t += 0.09) {
    const y = ry0 + (ry1 - ry0) * t;
    const z = top * (1 - t);
    for (let x = rx0 + 0.08 + r() * 0.06; x < rx1 - 0.05; x += 0.13 + r() * 0.06) p.disc(shade(warm, 0.84 + r() * 0.24), x, y, z + 0.5, 0.045, 0.9);
    p.ball(shade(warm, 0.75 + r() * 0.2), rx1 - 0.02, y, z + 1, 2.4);
    p.ball(shade(warm, 0.9 + r() * 0.2), rx0 + 0.02, y, z + 1, 2.2);
  }
  // Water jar and a basin for washing.
  cylinder(p, -1.3, 1.2, 0.2, 0, 6, C.stone);
  p.disc(C.waterDeep, -1.3, 1.2, 6, 0.14);
  jar(p, -1.0, 1.45, 0, 3.6);
  // Front and east walls of the court, open where the ramp meets it.
  rubble(p, s - 0.16, -s + 0.16, s, s, 0, wallH, warm, 4);
  rubble(p, -s + 0.16, s - 0.16, -0.7, s, 0, wallH, warm, 5);
  rubble(p, 0.7, s - 0.16, s - 0.16, s, 0, wallH, warm, 6);
}

/**
 * The temple (6 x 6), the finest building in the city: a raised limestone platform with stairs,
 * an enclosing wall with a gatehouse, columned porticoes along the back and west sides, a paved
 * court with a laver and a rough-stone altar, and a tall sanctuary with a porch and two columns.
 */
function temple(p: Pen) {
  const top = 14;
  const S = 2.92;
  const lime = C.limestone;
  const white = 0xfbf6ea;
  const limeBox = (x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, c = lime) =>
    p.box(x0, y0, x1, y1, z0, z1, c, shade(c, 0.88), shade(c, 0.64));
  p.shadow(-S, -S, S, 2.4, top, 0.2);
  p.shadow(-1.2, -2.2, 1.2, -0.1, top + 100, 0.16);
  // Platform with dressed blocks and a cornice.
  limeBox(-S, -S, S, 2.4, 0, top);
  masonry(p, -S, -S, S, 2.4, 0, top - 2, lime);
  p.box(-S - 0.03, -S - 0.03, S + 0.03, 2.43, top - 2, top, white, shade(white, 0.9), shade(white, 0.68));
  // Stairs up the front.
  for (let k = 3; k >= 0; k--) {
    const z = top - k * (top / 4);
    limeBox(-1.0, 2.4, 1.0, 2.4 + (k + 1) * 0.14, 0, z, shade(lime, 1.04));
  }
  // Court paving.
  for (let k = -2.6; k < 2.4; k += 0.4) p.line(shade(lime, 0.84), 1, [k, -2.7, top], [k, 2.2, top], 0.55);
  for (let k = -2.6; k < 2.2; k += 0.4) p.line(shade(lime, 0.84), 1, [-2.7, k, top], [2.7, k, top], 0.55);

  const wallH = top + 22;
  const wall = (x0: number, y0: number, x1: number, y1: number) => {
    limeBox(x0, y0, x1, y1, top, wallH, C.stone);
    masonry(p, x0, y0, x1, y1, top, wallH - 3, C.stone, 0.6);
    p.box(x0 - 0.02, y0 - 0.02, x1 + 0.02, y1 + 0.02, wallH - 3, wallH, white, shade(white, 0.9), shade(white, 0.68));
  };
  const tower = (x: number, y: number, h: number) => {
    limeBox(x - 0.2, y - 0.2, x + 0.2, y + 0.2, top, h);
    masonry(p, x - 0.2, y - 0.2, x + 0.2, y + 0.2, top, h - 4, lime, 0.6);
    p.box(x - 0.23, y - 0.23, x + 0.23, y + 0.23, h - 4, h, white, shade(white, 0.9), shade(white, 0.68));
    p.rect(C.gold, x - 0.12, y - 0.12, x + 0.12, y + 0.12, h);
  };
  const column = (x: number, y: number, h: number, r = 0.06) => {
    limeBox(x - r - 0.03, y - r - 0.03, x + r + 0.03, y + r + 0.03, top, top + 3);
    p.box(x - r, y - r, x + r, y + r, top + 3, top + h - 3, white, 0xf0e6d2, 0xc9bb9c);
    p.line(0xe2d6bc, 1, [x - r * 0.3, y + r, top + 3], [x - r * 0.3, y + r, top + h - 3], 0.8);
    limeBox(x - r - 0.04, y - r - 0.04, x + r + 0.04, y + r + 0.04, top + h - 3, top + h, white);
  };

  tower(-2.7, -2.7, wallH + 10);
  wall(-2.5, -2.88, 2.5, -2.66);
  wall(-2.88, -2.5, -2.66, 2.0);
  tower(2.7, -2.7, wallH + 10);
  // Back portico: a roof on a row of columns.
  const pz = 22;
  limeBox(-2.66, -2.66, 2.66, -2.52, top, top + pz - 3, shade(lime, 0.92));
  for (let x = -2.3; x <= 2.35; x += 0.46) column(x, -2.1, pz);
  limeBox(-2.66, -2.66, 2.66, -1.96, top + pz, top + pz + 3, white);
  // West portico.
  for (let y = -1.6; y <= 1.8; y += 0.46) column(-2.1, y, pz);
  limeBox(-2.66, -1.96, -1.96, 2.0, top + pz, top + pz + 3, white);

  // Sanctuary on a raised base: a long hall, a taller porch with a great doorway, gold cornices.
  const base = top + 6;
  limeBox(-1.3, -2.2, 1.3, 0.35, top, base);
  for (let k = 2; k >= 0; k--) limeBox(-0.55, 0.35, 0.55, 0.35 + (k + 1) * 0.1, top, base - k * 2);
  const hall = base + 76;
  limeBox(-0.85, -2.0, 0.85, -0.6, base, hall);
  masonry(p, -0.85, -2.0, 0.85, -0.6, base, hall - 4, lime, 0.45);
  p.box(-0.89, -2.04, 0.89, -0.56, hall - 4, hall, C.gold, shade(C.gold, 0.9), shade(C.gold, 0.68));
  p.rect(shade(lime, 0.94), -0.8, -1.95, 0.8, -0.65, hall);
  for (const y of [-1.75, -1.35, -0.95]) p.eastQuad(0x5c4a36, 0.851, y, y + 0.1, hall - 22, hall - 10);
  const porch = base + 96;
  limeBox(-1.2, -0.6, 1.2, -0.18, base, porch);
  masonry(p, -1.2, -0.6, 1.2, -0.18, base, porch - 6, lime, 0.45);
  p.box(-1.25, -0.65, 1.25, -0.13, porch - 6, porch, C.gold, shade(C.gold, 0.9), shade(C.gold, 0.68));
  p.rect(shade(C.gold, 1.15), -1.18, -0.58, 1.18, -0.2, porch);
  p.southQuad(shade(lime, 0.8), -0.179, -1.2, 1.2, porch - 20, porch - 18);
  p.southQuad(shade(C.gold, 0.85), -0.179, -0.38, 0.38, base, base + 56);
  p.southQuad(white, -0.178, -0.34, 0.34, base, base + 53);
  p.southQuad(0x4a3626, -0.177, -0.29, 0.29, base, base + 50);
  p.southQuad(0x6a4a2e, -0.176, -0.24, 0.24, base, base + 45);
  p.line(C.gold, 1, [0, -0.175, base], [0, -0.175, base + 45]);
  for (const x of [-0.85, 0.55]) p.southQuad(0x5c4a36, -0.179, x, x + 0.3, porch - 34, porch - 26);
  p.eastQuad(0x5c4a36, 1.201, -0.48, -0.32, porch - 30, porch - 14);
  // Two free-standing columns before the porch.
  for (const x of [-0.75, 0.75]) {
    const cz = 64;
    limeBox(x - 0.13, -0.02, x + 0.13, 0.24, base, base + 4);
    p.box(x - 0.09, 0.02, x + 0.09, 0.2, base + 4, base + cz, white, 0xf0e6d2, 0xc9bb9c);
    for (const dx of [-0.045, 0.0, 0.045]) p.line(0xe2d6bc, 1, [x + dx, 0.2, base + 6], [x + dx, 0.2, base + cz - 2], 0.9);
    p.box(x - 0.14, -0.03, x + 0.14, 0.25, base + cz, base + cz + 6, C.gold, shade(C.gold, 0.9), shade(C.gold, 0.68));
  }
  // Laver on its stand and a small rough-stone altar in the court.
  cylinder(p, 1.45, 0.9, 0.3, top, top + 9, 0xb8803e);
  p.disc(C.waterDeep, 1.45, 0.9, top + 9, 0.22);
  p.disc(C.waterLight, 1.4, 0.86, top + 9, 0.06, 0.8);
  rubble(p, -1.75, 0.6, -1.05, 1.3, top, top + 12, 0xd8ccb0, 9, 4);
  p.disc(0x3a2c20, -1.4, 0.95, top + 12, 0.18);
  p.ball(0xe8742c, -1.42, 0.95, top + 13, 1.8);
  // Front wall with the gatehouse, east wall and front towers.
  wall(-2.88, 2.0, -0.95, 2.22);
  wall(0.95, 2.0, 2.66, 2.22);
  limeBox(-0.95, 1.95, 0.95, 2.27, wallH + 2, wallH + 10);
  p.box(-0.99, 1.91, 0.99, 2.31, wallH + 10, wallH + 13, white, shade(white, 0.9), shade(white, 0.68));
  p.southQuad(C.gold, 2.271, -0.95, 0.95, wallH + 4, wallH + 6);
  tower(-0.95, 2.11, wallH + 18);
  tower(0.95, 2.11, wallH + 18);
  wall(2.66, -2.5, 2.88, 2.22);
  tower(-2.7, 2.11, wallH + 10);
  tower(2.7, 2.11, wallH + 10);
}

// ---------- effects and UI ----------

function flame(g: G) {
  g.fillStyle(0xe8742c);
  g.fillCircle(8, 15, 6.5);
  g.fillTriangle(1.8, 14, 14.2, 14, 8, 0);
  g.fillStyle(0xf6c84c);
  g.fillCircle(8, 16.5, 3.8);
  g.fillTriangle(4.4, 16, 11.6, 16, 8, 6);
  g.fillStyle(0xfff3c4);
  g.fillCircle(8, 18, 1.8);
}

/** Wooden post with a small clay oil lamp on an arm (the light itself is an additive glow at night). */
function lamp(g: G) {
  g.fillStyle(C.shadow, 0.25);
  g.fillEllipse(6, 32, 9, 3);
  g.fillStyle(C.woodDark);
  g.fillRect(4.5, 7, 3, 26);
  g.fillStyle(C.wood);
  g.fillRect(4.5, 7, 1.4, 26);
  g.fillRect(3, 7, 7, 2);
  g.fillStyle(C.terracotta);
  g.fillEllipse(8.5, 5.5, 6, 3.6);
  g.fillStyle(C.gold);
  g.fillCircle(10.5, 3.8, 1.3);
}

function balloon(g: G) {
  g.fillStyle(C.shadow, 0.2);
  g.fillCircle(14, 14, 11);
  g.fillStyle(0xfffaf0);
  g.fillCircle(13, 12, 11);
  g.fillTriangle(9, 20, 17, 20, 13, 27);
  g.lineStyle(1.5, C.border, 0.6);
  g.strokeCircle(13, 12, 11);
}

/** Red "not allowed" sign: a ring with a diagonal bar. */
function noSign(g: G, x: number, y: number, r: number) {
  g.lineStyle(2.2, C.need.road);
  g.strokeCircle(x, y, r);
  g.lineBetween(x - r * 0.7, y - r * 0.7, x + r * 0.7, y + r * 0.7);
}

/** Round face of a mood: green and smiling, gold and calm, or red and frowning. */
function face(g: G, x: number, y: number, r: number, mood: Mood) {
  g.fillStyle(C.mood[mood]);
  g.fillCircle(x, y, r);
  g.lineStyle(Math.max(1, r / 8), C.ink, 1);
  g.strokeCircle(x, y, r);
  g.fillStyle(C.ink);
  for (const sx of [-1, 1]) g.fillCircle(x + sx * r * 0.35, y - r * 0.2, r * 0.12);
  g.lineStyle(Math.max(1.2, r / 7), C.ink, 1);
  g.beginPath();
  if (mood === 'happy') g.arc(x, y + r * 0.05, r * 0.5, 0.2 * Math.PI, 0.8 * Math.PI);
  else if (mood === 'sad') g.arc(x, y + r * 0.7, r * 0.45, 1.2 * Math.PI, 1.8 * Math.PI);
  else {
    g.moveTo(x - r * 0.35, y + r * 0.38);
    g.lineTo(x + r * 0.35, y + r * 0.38);
  }
  g.strokePath();
}

function needIcon(g: G, k: BalloonKind) {
  if (k === 'sad') {
    face(g, 8, 11, 6.5, 'sad');
  } else if (k === 'road') {
    // A dirt road broken in the middle, crossed out.
    g.fillStyle(C.road);
    g.fillPoints([{ x: 0, y: 14 }, { x: 4, y: 16 }, { x: 7, y: 13.5 }, { x: 3, y: 11.5 }], true);
    g.fillPoints([{ x: 9, y: 8.5 }, { x: 13, y: 10.5 }, { x: 16, y: 8 }, { x: 12, y: 6 }], true);
    noSign(g, 8, 11, 6.5);
  } else if (k === 'noSource') {
    // A fish over a wavy line, crossed out (no river or trees in reach).
    g.fillStyle(C.water);
    g.fillRect(1, 16, 14, 2);
    g.fillStyle(shade(C.water, 0.6));
    g.fillEllipse(7, 10, 9, 5);
    g.fillTriangle(11, 10, 15, 7, 15, 13);
    noSign(g, 8, 11, 7);
  } else if (k === 'workers') {
    // A worker crossed out.
    g.fillStyle(C.skin[0]);
    g.fillCircle(8, 6, 2.6);
    g.fillStyle(C.clothes[1]);
    g.fillRoundedRect(4.5, 9, 7, 9, 2.5);
    noSign(g, 8, 11, 7);
  } else if (k === 'plaza') {
    // A paved square seen at an angle.
    const d = [{ x: 8, y: 10 }, { x: 15.5, y: 14 }, { x: 8, y: 18 }, { x: 0.5, y: 14 }];
    g.fillStyle(shade(C.need.plaza, 0.6));
    g.fillPoints([d[3], d[2], d[1], { x: 15.5, y: 16 }, { x: 8, y: 20 }, { x: 0.5, y: 16 }], true);
    g.fillStyle(shade(C.limestone, 0.92));
    g.fillPoints(d, true);
    g.lineStyle(1.2, shade(C.need.plaza, 0.8), 1);
    g.lineBetween(4.25, 12, 11.75, 16);
    g.lineBetween(11.75, 12, 4.25, 16);
    // A stone bench at the front left and a slanted ochre shade cloth on posts at the right.
    g.lineStyle(2.4, shade(C.stone, 0.62), 1);
    g.lineBetween(2.5, 15.2, 6.5, 17.2);
    g.lineStyle(1.6, C.stone, 1);
    g.lineBetween(2.5, 14.2, 6.5, 16.2);
    g.lineStyle(1.4, C.woodDark, 1);
    g.lineBetween(7, 6.5, 7, 13.5);
    g.lineBetween(14, 10, 14, 15.5);
    const cloth = C.shadeCloth;
    g.fillStyle(cloth);
    g.fillPoints([{ x: 9.5, y: 2.5 }, { x: 15.8, y: 5.8 }, { x: 14, y: 10 }, { x: 7, y: 6.5 }], true);
    g.fillStyle(shade(cloth, 0.66));
    g.fillPoints([{ x: 7, y: 6.5 }, { x: 14, y: 10 }, { x: 14, y: 11.6 }, { x: 7, y: 8.1 }], true);
  } else if (k === 'park') {
    // Two round trees over a patch of lawn.
    g.fillStyle(shade(C.need.park, 0.75));
    g.fillEllipse(8, 17, 16, 6);
    g.fillStyle(C.trunk);
    g.fillRect(4, 10, 2, 7);
    g.fillRect(10.5, 8, 2, 8);
    g.fillStyle(shade(C.need.park, 0.75));
    g.fillCircle(5, 9, 4.5);
    g.fillCircle(11.5, 6.5, 5);
    g.fillStyle(C.need.park);
    g.fillCircle(4.4, 8.4, 3.6);
    g.fillCircle(10.9, 5.9, 4);
    g.fillStyle(shade(C.need.park, 1.3));
    g.fillCircle(3.6, 7.4, 1.3);
    g.fillCircle(10, 4.8, 1.5);
  } else if (k === 'market') {
    g.fillStyle(C.cream);
    g.fillRoundedRect(1, 3, 14, 12, 2);
    g.fillStyle(C.need.market);
    [1.5, 6.5, 11.5].forEach((x) => g.fillRect(x, 3, 3, 12));
  } else {
    flame(g);
  }
}

function figure(g: G, x: number, bottom: number, cloth: number, skin: number, scarf: boolean, scale = 1) {
  const s = scale;
  g.fillStyle(cloth);
  g.fillRoundedRect(x - 4 * s, bottom - 12 * s, 8 * s, 11 * s, 3 * s);
  g.fillStyle(shade(cloth, 0.75));
  g.fillRect(x - 4 * s, bottom - 7 * s, 8 * s, 1.5 * s);
  g.fillStyle(skin);
  g.fillCircle(x, bottom - 15 * s, 3.6 * s);
  g.fillStyle(scarf ? shade(cloth, 1.35) : 0x4a3523);
  g.fillEllipse(x, bottom - 17 * s, 7 * s, 3.5 * s);
}

function family(g: G) {
  g.fillStyle(C.shadow, 0.25);
  g.fillEllipse(16, 21, 28, 4);
  figure(g, 6, 21, C.clothes[1], C.skin[1], false);
  figure(g, 15, 21, C.clothes[0], C.skin[0], true);
  figure(g, 23, 21, C.clothes[2], C.skin[2], true, 0.7);
  g.fillStyle(C.fabric);
  g.fillCircle(15, 3, 3.5);
  g.lineStyle(1, shade(C.fabric, 0.7));
  g.strokeCircle(15, 3, 3.5);
}

function icons(scene: Phaser.Scene) {
  const icon = (name: Parameters<typeof TEX.icon>[0], draw: (g: G) => void) => makeFlat(scene, TEX.icon(name), 40, 40, draw);
  // Seasons (in the week slot of the plaque): almond blossom, strong sun, falling leaf, snowflake.
  icon('spring', (g) => {
    g.lineStyle(3, C.woodDark, 1);
    g.lineBetween(8, 34, 22, 18);
    g.lineBetween(16, 26, 28, 28);
    for (const [x, y] of [[22, 14], [30, 26], [12, 22]]) {
      g.fillStyle(0xf7c6d6);
      for (let k = 0; k < 5; k++) g.fillCircle(x + Math.cos((k * 2 * Math.PI) / 5) * 4, y + Math.sin((k * 2 * Math.PI) / 5) * 4, 3.4);
      g.fillStyle(0xe0607e);
      g.fillCircle(x, y, 2);
    }
  });
  // Summer is the harvest: a golden sheaf of wheat (the sun is already the time of day).
  icon('summer', (g) => {
    for (const [dx, a] of [[-7, -0.35], [0, 0], [7, 0.35]] as const) {
      const tx = 20 + dx + Math.sin(a) * 6;
      g.lineStyle(2.5, 0xb88a2a, 1);
      g.lineBetween(20 + dx * 0.3, 36, tx, 14);
      g.fillStyle(0xe8b83a);
      for (let k = 0; k < 4; k++) g.fillEllipse(tx + (k % 2 ? 2.5 : -2.5), 6 + k * 3.5, 4.5, 6);
    }
    g.fillStyle(0xa8642a);
    g.fillRect(13, 26, 14, 4);
  });
  icon('autumn', (g) => {
    g.fillStyle(0xc8642a);
    g.fillPoints([{ x: 20, y: 4 }, { x: 31, y: 14 }, { x: 28, y: 28 }, { x: 20, y: 34 }, { x: 12, y: 28 }, { x: 9, y: 14 }], true);
    g.fillStyle(0xe8963a);
    g.fillPoints([{ x: 20, y: 8 }, { x: 27, y: 15 }, { x: 20, y: 28 }, { x: 13, y: 15 }], true);
    g.lineStyle(2, 0x7a3a16, 1);
    g.lineBetween(20, 8, 20, 38);
  });
  icon('winter', (g) => {
    g.lineStyle(3, 0x6f9ec8, 1);
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI) / 3 + Math.PI / 2;
      const [dx, dy] = [Math.cos(a) * 15, Math.sin(a) * 15];
      g.lineBetween(20 - dx, 20 - dy, 20 + dx, 20 + dy);
      for (const sgn of [1, -1]) {
        const [px, py] = [20 + (sgn * dx * 2) / 3, 20 + (sgn * dy * 2) / 3];
        const b = a + Math.PI / 4;
        g.lineBetween(px, py, px + Math.cos(b) * 5 * sgn, py + Math.sin(b) * 5 * sgn);
        g.lineBetween(px, py, px + Math.cos(a - Math.PI / 4) * 5 * sgn, py + Math.sin(a - Math.PI / 4) * 5 * sgn);
      }
    }
    g.fillStyle(0xdceefa);
    g.fillCircle(20, 20, 3);
  });
  // Drought: a fierce sun over cracked earth.
  icon('drought', (g) => {
    g.fillStyle(0xa8703a);
    g.fillRect(2, 31, 36, 7);
    g.lineStyle(1.5, 0x5e3a1c, 1);
    for (const [x0, x1] of [[6, 11], [16, 13], [24, 29], [33, 31]]) {
      g.lineBetween(x0, 30, x1, 34);
      g.lineBetween(x1, 34, x0 + 2, 38);
    }
    g.lineStyle(3.5, 0xd8481e, 1);
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI) / 6;
      const l = k % 2 ? 12.5 : 15;
      g.lineBetween(20 + Math.cos(a) * 9.5, 16 + Math.sin(a) * 9.5, 20 + Math.cos(a) * l, 16 + Math.sin(a) * l);
    }
    g.fillStyle(0xf08a24);
    g.fillCircle(20, 16, 9);
    g.fillStyle(0xffd24a);
    g.fillCircle(20, 16, 5.5);
    g.fillStyle(0xfff4c0, 0.9);
    g.fillCircle(18, 14, 2.2);
  });
  icon('view', (g) => {
    g.lineStyle(5, C.woodDark, 1);
    g.lineBetween(25, 25, 35, 35);
    g.fillStyle(0xd9eef7);
    g.fillCircle(17, 17, 11);
    g.lineStyle(4, C.ink, 1);
    g.strokeCircle(17, 17, 11);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(13, 13, 3);
  });
  icon('clear', (g) => {
    g.lineStyle(4, C.wood, 1);
    g.lineBetween(10, 34, 28, 10);
    g.fillStyle(C.rockLight);
    g.fillTriangle(22, 6, 36, 10, 30, 20);
    g.fillStyle(C.rockDark);
    g.fillTriangle(26, 12, 36, 10, 30, 20);
  });
  icon('road', (g) => {
    g.fillStyle(C.sand[0]);
    g.fillPoints([{ x: 20, y: 8 }, { x: 38, y: 20 }, { x: 20, y: 32 }, { x: 2, y: 20 }], true);
    g.fillStyle(C.road);
    g.fillPoints([{ x: 26, y: 12 }, { x: 32, y: 16 }, { x: 14, y: 28 }, { x: 8, y: 24 }], true);
    g.lineStyle(1, shade(C.road, 0.8));
    g.lineBetween(28, 14, 11, 26);
  });
  icon('silver', (g) => {
    g.fillStyle(0x8f949b);
    g.fillCircle(20, 21, 14);
    g.fillStyle(0xd3d7dc);
    g.fillCircle(20, 19, 14);
    g.lineStyle(2, 0x9aa0a8, 1);
    g.strokeCircle(20, 19, 9);
    g.fillStyle(0xffffff, 0.8);
    g.fillEllipse(15, 13, 6, 3);
  });
  icon('food', (g) => {
    g.fillStyle(shade(0xd8a35a, 0.75));
    g.fillEllipse(20, 24, 32, 18);
    g.fillStyle(0xd8a35a);
    g.fillEllipse(20, 21, 32, 18);
    g.lineStyle(2, shade(0xd8a35a, 0.7), 1);
    [12, 20, 28].forEach((x) => g.lineBetween(x - 2, 16, x + 2, 25));
  });
  icon('people', (g) => {
    figure(g, 26, 36, C.clothes[1], C.skin[0], false, 1.6);
    figure(g, 14, 36, C.clothes[0], C.skin[1], true, 1.6);
  });
  icon('work', (g) => {
    g.lineStyle(5, C.wood, 1);
    g.lineBetween(12, 34, 26, 14);
    g.fillStyle(C.rockDark);
    g.fillRoundedRect(17, 5, 20, 10, 2);
    g.fillStyle(C.rockLight);
    g.fillRect(17, 5, 20, 3);
  });
  icon('goal', (g) => {
    g.lineStyle(3, C.woodDark, 1);
    g.lineBetween(10, 6, 10, 36);
    g.fillStyle(C.red);
    g.fillTriangle(11, 7, 34, 13, 11, 20);
  });
  // Time of day, next to the week.
  icon('sun', (g) => {
    g.lineStyle(3, 0xe89a2c, 1);
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      g.lineBetween(20 + Math.cos(a) * 12, 20 + Math.sin(a) * 12, 20 + Math.cos(a) * 17, 20 + Math.sin(a) * 17);
    }
    g.fillStyle(0xf2c23c);
    g.fillCircle(20, 20, 9);
    g.fillStyle(0xfff0b0, 0.8);
    g.fillCircle(17, 17, 3);
  });
  icon('dusk', (g) => {
    g.fillStyle(0xe8742c);
    g.slice(20, 26, 11, Math.PI, 0, false);
    g.fillPath();
    g.lineStyle(3, 0xc0503c, 1);
    for (const a of [Math.PI * 1.15, Math.PI * 1.5, Math.PI * 1.85]) g.lineBetween(20 + Math.cos(a) * 14, 26 + Math.sin(a) * 14, 20 + Math.cos(a) * 18, 26 + Math.sin(a) * 18);
    g.lineStyle(3, C.ink, 1);
    g.lineBetween(4, 27, 36, 27);
  });
  for (const m of ['happy', 'neutral', 'sad'] as const) makeFlat(scene, TEX.mood(m), 40, 40, (g) => face(g, 20, 20, 16, m));
  icon('moon', (g) => {
    // Crescent on a small night-blue disc, so it reads on the light plaque.
    g.fillStyle(0x2f3a66);
    g.fillCircle(20, 20, 17);
    g.fillStyle(0xf6e6a8);
    g.fillCircle(18, 20, 10);
    g.fillStyle(0x2f3a66);
    g.fillCircle(23, 16, 9);
    g.fillStyle(0xfff6dc);
    g.fillCircle(29, 27, 1.5);
    g.fillCircle(27, 9, 1.2);
  });
  icon('options', (g) => {
    g.fillStyle(C.ink);
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      g.fillCircle(20 + Math.cos(a) * 12, 20 + Math.sin(a) * 12, 4);
    }
    g.fillCircle(20, 20, 12);
    g.fillStyle(C.cream);
    g.fillCircle(20, 20, 5);
  });
}

export function generateTextures(scene: Phaser.Scene): void {
  for (let v = 0; v < VARIANTS; v++) {
    for (const g of ['sand', 'grass', 'river'] as Ground[]) make(scene, TEX.ground(g, v), TILE, (p) => groundTile(p, g, v));
    for (const g of ['sand', 'grass'] as Ground[])
      make(scene, TEX.ground(g, v, true), TILE, (p) => {
        groundTile(p, g, v);
        groundDeco(p, g, v);
      });
    for (const look of [...SEASONS, 'drought'] as const)
      for (const deco of [false, true])
        for (const kind of ['grass', 'sand'] as const)
          make(scene, (kind === 'grass' ? TEX.grass : TEX.sand)(look, v, deco), TILE, (p) => {
            groundTile(p, kind, v, SEASON_TURF[look][kind]);
            if (deco) groundDeco(p, kind, v, SEASON_TURF[look][kind]);
          });
    for (const deco of [false, true]) make(scene, TEX.snowGround(v, deco), TILE, (p) => snowTile(p, v, deco));
    make(scene, TEX.mud(v), TILE, (p) => mudTile(p, v));
    make(scene, TEX.puddle(v), TILE, (p) => puddle(p, v));
    make(scene, TEX.feature('rock', v), SMALL, (p) => rock(p, v), 20);
    make(scene, TEX.feature('olive', v), SMALL, (p) => olive(p, v), 40);
    make(scene, TEX.feature('palm', v), SMALL, (p) => palm(p, v), 56);
    for (const state of ['bare', 'bloom', 'leaf'] as const) make(scene, TEX.tree('almond', v, state), SMALL, (p) => almond(p, v, state), 36);
    for (const state of ['bare', 'leaf', 'yellow'] as const) make(scene, TEX.tree('fig', v, state), SMALL, (p) => fig(p, v, state), 34);
  }
  for (let mask = 0; mask < 16; mask++) for (const wear of [0, 1, 2]) make(scene, TEX.road(mask, wear), TILE, (p) => road(p, mask, wear));
  // Every building is drawn at its real footprint: [draw, canvas height above ground, balloon height].
  const now = (...a: Parameters<typeof later>) => make(scene, ...a);
  for (const mirror of [false, true]) {
    HOUSE_ART.forEach(([draws, top, h], level) => {
      for (let v = 0; v < HOUSE_LEVELS[level].variants; v++)
        make(scene, TEX.building('house', level, false, v, mirror), footCanvas(2, 2, top), draws[v % draws.length], h, mirror);
    });
    CROPS.forEach((_, v) => make(scene, TEX.building('field', 0, false, v, mirror), footCanvas(2, 2, 30), (p) => field(p, v), 26, mirror));
    // Levels 2 and up are drawn the first time a building reaches them (see ensureTexture).
    for (let level = 1; level <= levelCount('workshop'); level++) {
      const put = level === 1 ? now : later;
      BUILDINGS.workshop.crafts!.forEach((c, v) => put(TEX.building('workshop', level, false, v, mirror), footCanvas(3, 3, 56), atLevel(CRAFT_ART[c], level), 50, mirror));
    }
    // Empty houses that kept their level, with nobody home (drawn on first use).
    for (let level = 2; level < HOUSE_ART.length; level++) {
      const [draws, top, h] = HOUSE_ART[level];
      for (let v = 0; v < HOUSE_LEVELS[0].variants; v++) later(TEX.emptyHouse(level, v, mirror), footCanvas(2, 2, top), emptied(draws[v % draws.length]), h, mirror);
    }
  }
  for (let level = 1; level <= levelCount('granary'); level++) {
    const put = level === 1 ? now : later;
    for (let k = 0; k < GRANARY_STOCKS; k++) put(TEX.building('granary', level, false, k), footCanvas(3, 3, 64), (p) => granary(p, k, level), 50);
  }
  const buildings: [BuildingKind, (p: Pen) => void, number, number][] = [
    ['plaza', plaza, 48, 44],
    ['fisher', fisher, 40, 32],
    ['gatherer', gatherer, 44, 34],
    ['park', park, 60, 40],
    ['altar', altar, 34, 44],
    ['temple', temple, 136, 128],
  ];
  buildings.forEach(([kind, draw, top, h]) => {
    const { w, h: d } = dimsOf(kind);
    make(scene, TEX.building(kind), footCanvas(w, d, top), draw, h);
  });
  for (let level = 1; level <= levelCount('market'); level++) {
    const put = level === 1 ? now : later;
    for (const rotated of [false, true]) {
      const { w, h } = dimsOf('market', rotated);
      put(TEX.building('market', level, rotated), footCanvas(w, h, 40), (p) => market(p, rotated, level), 36);
    }
  }

  CROPS.forEach((_, v) => (ORIGIN[TEX.crop(v)] = [0.5, 1]));
  ORIGIN[TEX.flame] = [0.5, 1];
  ORIGIN[TEX.lamp] = [0.5, 1];
  const raw = (key: string, w: number, h: number, draw: (g: G) => void) => {
    if (scene.textures.exists(key)) return;
    const g = new Phaser.GameObjects.Graphics(scene);
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };
  CROPS.forEach((c, v) => raw(TEX.crop(v), 22, 22, c.draw));
  raw(TEX.flame, 16, 22, flame);
  raw(TEX.lamp, 12, 34, lamp);
  raw(TEX.soft, 32, 32, (g) => {
    for (let k = 5; k >= 1; k--) {
      g.fillStyle(0xffffff, (6 - k) / 15);
      g.fillCircle(16, 16, (16 * k) / 5);
    }
  });
  raw(TEX.rain, 4, 24, (g) => {
    g.fillStyle(0xdfe8f4, 0.3);
    g.fillRect(0, 0, 4, 24);
    g.fillStyle(0xffffff, 0.8);
    g.fillRect(1, 5, 2, 19);
  });
  raw(TEX.splash, 16, 8, (g) => {
    g.lineStyle(1.5, 0xffffff, 0.8);
    g.strokeEllipse(8, 4, 14, 6);
  });
  ORIGIN[TEX.basket] = [0.5, 1];
  raw(TEX.basket, 14, 10, (g) => {
    g.fillStyle(0x7a5532);
    g.fillEllipse(7, 6, 13, 7);
    g.fillStyle(0xa8804e);
    g.fillEllipse(7, 5, 12, 5);
    g.fillStyle(0x3e4a2a);
    for (const [x, y] of [[4, 4], [7, 3], [10, 4], [6, 5], [9, 5]]) g.fillCircle(x, y, 1.6);
  });
  raw(TEX.pebble, 7, 6, (g) => {
    g.fillStyle(0xffffff);
    g.fillPoints([{ x: 1, y: 3 }, { x: 3, y: 0.5 }, { x: 6, y: 1.5 }, { x: 6.5, y: 4 }, { x: 4, y: 5.5 }, { x: 1.5, y: 5 }], true);
    g.fillStyle(0xbdbdbd);
    g.fillPoints([{ x: 4, y: 5.5 }, { x: 6.5, y: 4 }, { x: 6, y: 2.5 }, { x: 3.5, y: 3.5 }], true);
  });
  raw(TEX.petal, 6, 5, (g) => {
    g.fillStyle(0xffffff);
    g.fillEllipse(3, 2.5, 6, 4);
  });
  raw(TEX.ring, 64, 64, (g) => {
    g.lineStyle(6, 0xffffff, 0.35);
    g.strokeCircle(32, 32, 27);
    g.lineStyle(3, 0xffffff, 1);
    g.strokeCircle(32, 32, 27);
  });
  raw(TEX.balloon, 28, 28, balloon);
  const balloonKinds = { road: 0, plaza: 0, market: 0, park: 0, workers: 0, sad: 0, noSource: 0 } satisfies Record<BalloonKind, 0>;
  (Object.keys(balloonKinds) as BalloonKind[]).forEach((k) => raw(TEX.need(k), 16, 22, (g) => needIcon(g, k)));
  for (const { type } of WALKERS) {
    const [w, h] = residentSize(type);
    const crafts: (Craft | null)[] = [null, ...(type === 'artisan' ? BUILDINGS.workshop.crafts! : [])];
    for (let look = 0; look < WALKER_LOOKS; look++) {
      for (let frame = 0; frame < 2; frame++) {
        for (const c of crafts) raw(TEX.walker(type, look, frame, c), w, h, (g) => drawResident(g, type, look, frame, c));
      }
    }
  }
  for (const kind of HAULER_KINDS) {
    for (let look = 0; look < WALKER_LOOKS; look++)
      for (let frame = 0; frame < 2; frame++) raw(TEX.hauler(kind, look, frame), ...HAULER_SIZE, (g) => drawHauler(g, kind, look, frame));
  }
  raw(TEX.fly, 4, 4, (g) => {
    g.fillStyle(0xffffff);
    g.fillCircle(2, 2, 1.4);
  });
  raw(TEX.spark, 16, 16, (g) => {
    g.fillStyle(0xffffff);
    g.fillTriangle(8, 0, 9.6, 8, 6.4, 8);
    g.fillTriangle(8, 16, 9.6, 8, 6.4, 8);
    g.fillTriangle(0, 8, 8, 6.4, 8, 9.6);
    g.fillTriangle(16, 8, 8, 6.4, 8, 9.6);
    g.fillCircle(8, 8, 2.2);
  });
  raw(TEX.family, 30, 23, family);
  for (const kind of TRAVELER_KINDS) for (let frame = 0; frame < 2; frame++) raw(TEX.traveler(kind, frame), ...TRAVELER_SIZE[kind], (g) => drawTraveler(g, kind, frame));
  const fauna: [FaunaKind, number, (g: G, frame: number) => void][] = [
    ['goat', 2, F.goat],
    ['chicken', 2, F.chicken],
    ['donkey', 1, F.donkey],
    ['sheep', 2, F.sheep],
    ['dove', 1, F.dove],
    ['doveFly', 1, F.doveFly],
    ['boat', 1, F.boat],
    ['washer', 2, F.washer],
    ['cloth', 1, F.cloth],
  ];
  for (const [kind, frames, draw] of fauna) {
    for (let f = 0; f < frames; f++) {
      ORIGIN[TEX.fauna(kind, f)] = [0.5, 1];
      const [w, h] = FAUNA_SIZE[kind];
      raw(TEX.fauna(kind, f), w, h, (g) => draw(g, f));
    }
  }
  ORIGIN[TEX.fauna('cloth')] = [0.5, 0];
  for (let look = 0; look < FIELDHAND_LOOK_COUNT; look++) {
    for (let pose = 0; pose < FIELDHAND_POSES; pose++) raw(TEX.fieldhand(look, pose), ...FIELDHAND_SIZE, (g) => drawFieldhand(g, look, pose));
  }
  icons(scene);
}

/**
 * Crop tuft images over a field of a variant whose ground anchor is at (x, y), drawn at scale k
 * (back to front). A mirrored field has its rows the other way.
 */
export function cropImages(scene: Phaser.Scene, x = 0, y = 0, k = 1, variant = 0, mirrored = false): Phaser.GameObjects.Image[] {
  return PARTS.wheat.map((w) =>
    scene.add
      .image(x + (w.x - w.y) * HW * k * (mirrored ? -1 : 1), y + ((w.x + w.y) * HH - w.z + 2) * k, TEX.crop(variant))
      .setOrigin(0.5, 1)
      .setScale(k),
  );
}

/** Applies a texture and its ground anchor to an image. */
export function setTex(img: Phaser.GameObjects.Image, key: string): Phaser.GameObjects.Image {
  const [ox, oy] = ORIGIN[key] ?? [0.5, 0.5];
  return img.setTexture(key).setOrigin(ox, oy);
}
