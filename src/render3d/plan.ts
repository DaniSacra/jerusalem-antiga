import { BUILDINGS, borderCells, foodCapacity, indexOf, RULES, type BuildableKind, type Building, type BuildingKind, type GameState } from '../core';
import { ROAD_KEYS, roadLevel, roadPieces, roadTraffic, sacredOf, type RoadKey } from './roads';
import VISUAL from '../data/visual.json';
import { treeKind } from '../game/seasons';
import { KIT_KEYS, kitOf, type KitKey, type KitPiece } from './kits';
import { SITE_KEYS, siteLook, type SiteKey, type SiteLook } from './works';

/**
 * What the 3D view draws for a GameState, as plain data (no Three.js): the model key, place, turn,
 * scale and tint of every building, tree, stump and road. Pure and tested; `world.ts` turns it into
 * instanced meshes.
 *
 * 1 cell = 1 unit; the grid column is `x` and the row is `z`. A model stands on y = 0, centred on its
 * footprint, its front facing +z.
 */

/** Kinds drawn with their own model (houses and fields are drawn by level and crop). */
type KindKey = Exclude<BuildingKind, 'house' | 'field'>;
/**
 * Additions of a service building that climbs levels (granary, market, workshop) at level 2 and 3:
 * one code model per kind and level, drawn over the building (an upper storey, a colonnade, goods).
 */
export type ExtraKey = `up-${KindKey}-${2 | 3}`;
/** A house model mirrored left to right (baked: an instanced mesh cannot flip its faces per copy). */
export type MirroredHouseKey = `house-${1 | 2 | 3 | 4}-m`;
export type ModelKey =
  | `house-${0 | 1 | 2 | 3 | 4}`
  | MirroredHouseKey
  /** A piece of a house kit (kits.ts): what each of the six looks of a level adds. */
  | KitKey
  | `field-${0 | 1 | 2 | 3}`
  | KindKey
  /** Olive cells are drawn as olives, almonds or figs (`treeKind`, game/seasons.ts). */
  | 'olive' | 'almond' | 'fig' | 'palm' | 'rock' | 'shrub' | 'stump' | 'sapling'
  /** The barred gate, sand drift and dry bush in front of an empty house. */
  | 'closed'
  /** The pieces of the roads, by how busy they are (`roads.ts`). */
  | RoadKey
  /** Ground detail (detail.ts): a tuft of grass, pebbles on the sand. */
  | 'tuft' | 'pebbles'
  /** A lit window pane of a .glb house at night (see WINDOWS_AT). */
  | 'pane'
  /** Sacks and jars in the granary yard as the food store fills (`stockLevel`). */
  | 'stock-1' | 'stock-2' | 'stock-3'
  /** Things in a lived-in house's yard, by its variant: jars and a potted plant, a washing line. */
  | 'yard-1' | 'yard-2'
  /** A workshop's craft in its front yard (1 smithy .. 5 tannery; the pottery is the model itself). */
  | `craft-${1 | 2 | 3 | 4 | 5}`
  /** The Temple by stage, the stage rising, the works, the restored altar, tools left (works.ts). */
  | SiteKey
  | ExtraKey;

/** Kinds with a level 2 and 3 (from buildings.json `levels`). */
export const LEVELLED: BuildingKind[] = (Object.keys(BUILDINGS) as BuildingKind[]).filter((k) => (BUILDINGS[k].levels?.length ?? 0) > 0);

/** Model footprint (cells along x, along z) of a kind, as placed upright (the market 2x4). */
export const kindFootprint = (k: BuildingKind): [number, number] => [BUILDINGS[k].w ?? 1, BUILDINGS[k].h ?? BUILDINGS[k].w ?? 1];

/** Additions of every levelled kind, at levels 2 and 3. */
export const EXTRA_KEYS: ExtraKey[] = LEVELLED.flatMap((k) => [2, 3].map((l) => `up-${k}-${l}` as ExtraKey));

/** The kind and level of an addition key (null for other keys). */
export function extraOf(key: ModelKey): { kind: KindKey; level: 2 | 3 } | null {
  const m = /^up-(\w+)-([23])$/.exec(key);
  return m ? { kind: m[1] as KindKey, level: Number(m[2]) as 2 | 3 } : null;
}

/**
 * Smoke sources carry a 0..1 key: the altar and the workshops 0 (they always smoke), each house a
 * stable key from HOUSE_SMOKE_FROM up (it smokes when its key is under the share of the moment).
 */
export const HOUSE_SMOKE_FROM = 0.05;
/** The smoke key of the house on (x, y). */
export const houseSmokeKey = (x: number, y: number) => HOUSE_SMOKE_FROM + hash(x, y, 12) * (1 - HOUSE_SMOKE_FROM);

/**
 * Share of the chimneys smoking now: the season's (`season`: every house in winter, few in summer),
 * more at night (cooking, warmth). In a winter without firewood (`s.cold`) no house smokes and the
 * tent fires are out (a warning that reads on the map); the altar and the kilns keep theirs.
 */
export function smokeShare(season: number, night: number, cold: boolean): number {
  if (cold) return HOUSE_SMOKE_FROM;
  return Math.max(0.01, season, night * 0.35);
}

/** Footprint (cells) of each model key, used to fit .glb models and to build the additions. */
export function footprintOf(key: ModelKey): [number, number] {
  const extra = extraOf(key);
  if (extra) return kindFootprint(extra.kind);
  if (key.startsWith('craft-')) return kindFootprint('workshop');
  if (key === 'altar-new' || key === 'altar-ruin' || key === 'works-1') return kindFootprint('altar');
  if (/^(temple|rise|works)-/.test(key)) return kindFootprint('temple');
  if (key.startsWith('house-') || key.startsWith('field-')) return kindFootprint(key.startsWith('house') ? 'house' : 'field');
  if (key in BUILDINGS) return kindFootprint(key as BuildingKind);
  return [1, 1];
}

/** The mirrored house keys and the key each mirrors. */
export const MIRRORED_KEYS: MirroredHouseKey[] = ([1, 2, 3, 4] as const).map((l) => `house-${l}-m` as const);
export const mirrorOf = (key: MirroredHouseKey) => key.slice(0, -2) as `house-${1 | 2 | 3 | 4}`;

/** Every key the code models must provide. */
export const MODEL_KEYS: ModelKey[] = [
  ...([0, 1, 2, 3, 4] as const).map((l) => `house-${l}` as const),
  ...MIRRORED_KEYS,
  ...KIT_KEYS,
  ...([0, 1, 2, 3] as const).map((v) => `field-${v}` as const),
  ...(Object.keys(BUILDINGS) as BuildingKind[]).filter((k): k is KindKey => k !== 'house' && k !== 'field'),
  'olive', 'almond', 'fig', 'palm', 'rock', 'shrub', 'stump', 'sapling', 'closed',
  ...ROAD_KEYS, 'tuft', 'pebbles', 'pane', 'stock-1', 'stock-2', 'stock-3', 'yard-1', 'yard-2',
  'craft-1', 'craft-2', 'craft-3', 'craft-4', 'craft-5',
  ...SITE_KEYS,
  ...EXTRA_KEYS,
];

/**
 * Tint of an empty house that kept its level. It also marks it for the shaders: the house is drawn
 * faded and dusty (see `shaders.ts`) and its windows stay dark.
 */
export const VACANT_TINT = 0.7;
/** Where the barred gate of an empty house stands (model x, z; front +z), by the level kept: before its door. */
export const CLOSED_AT: Record<2 | 3 | 4, [number, number]> = { 2: [0.3, 0.86], 3: [0.05, 0.86], 4: [0, 0.9] };
/**
 * Where the lit window panes of the .glb houses stand (the mud house's door too) (model x, y, z and a turn about y from the
 * front; front +z): over the windows the Meshy stone house and big house have, a hair before the wall.
 * The code houses light the dark of their own windows instead (see `shaders.ts`).
 */
export const WINDOWS_AT: Partial<Record<number, [number, number, number, number][]>> = {
  // The mud house: its door, lit from inside.
  2: [[0.3, 0.3, 0.88, 0]],
  3: [[0, 0.98, 0.58, 0], [0, 0.42, 0.6, 0]],
  4: [[0.38, 1.82, 0.27, 0], [-0.4, 0.64, 0.3, 0]],
};

/** The window panes of a house drawn with this look: none for an empty house (nobody lights them). */
export function panesOf(look: Pick<BuildingLook, 'houseLevel' | 'vacant'>): [number, number, number, number][] {
  return look.vacant ? [] : (WINDOWS_AT[look.houseLevel] ?? []);
}
/** The workshop kiln (model x, z; the code and the Meshy model have it there): smoke, night fire and the level-3 chimney. */
export const KILN: [number, number] = [0.8, -0.1];
/** Per level of a service building (index = level): height and brightness (richer stone at the top). */
const SERVICE = [
  { sy: 1, tint: 1 },
  { sy: 1, tint: 1 },
  { sy: 1.08, tint: 1.04 },
  { sy: 1.15, tint: 1.08 },
];

/** How one building looks: its model, the additions of its level, height scale and tint. */
export interface BuildingLook {
  key: ModelKey;
  /** Additions of a service building at level 2–3 (drawn with the same turn and height scale). */
  extra: ExtraKey | null;
  /** Vertical scale (taller at higher service levels). */
  sy: number;
  /** Brightness multiplier (1 = as modelled). */
  tint: number;
  /** House level drawn (houses: the level, or the kept level while empty; others 0). */
  houseLevel: number;
  /** Nobody lives there: no smoke, no fire, no lit windows. */
  vacant: boolean;
  /** An empty house that kept its level: faded, with a barred gate before the door. */
  closed: boolean;
  /** A lived-in house's yard things (by variant), on the front right of the model (YARD_AT). */
  yard: 'yard-1' | 'yard-2' | null;
  /**
   * -1: the house is drawn mirrored left to right (its model, kit, yard, door, windows and fire);
   * every point of the model is placed with x times this.
   */
  mirror: 1 | -1;
  /** The pieces its look adds to the house model (kits.ts). */
  kit: KitPiece[];
  /** A workshop's craft in its yard (the pottery has none: the model is a pottery). */
  craft: `craft-${1 | 2 | 3 | 4 | 5}` | null;
}

/**
 * The look of a building: houses by level (an empty house that kept level 2..4 shows that level,
 * faded behind a barred gate; an empty plot otherwise), fields by crop, service buildings bigger and
 * richer at levels 2–3 (taller, with the additions of their kind).
 */
export function lookOf(b: Pick<Building, 'kind' | 'level' | 'emptyLevel' | 'variant' | 'w' | 'h'> & { mirrored?: boolean }): BuildingLook {
  if (b.kind === 'house') {
    const kept = b.level === 0 && b.emptyLevel >= 2 ? b.emptyLevel : 0;
    const level = Math.max(0, Math.min(4, b.level || kept)) as 0 | 1 | 2 | 3 | 4;
    const mirror = level >= 1 && b.mirrored ? -1 : 1;
    const key = mirror < 0 ? (`house-${level as 1 | 2 | 3 | 4}-m` as const) : (`house-${level}` as const);
    const kit = kitOf(level, b.variant, b.level === 0);
    return { key, extra: null, sy: 1, tint: kept ? VACANT_TINT : 1, houseLevel: level, vacant: b.level === 0, closed: kept > 0, yard: yardOf(b), mirror, kit, craft: null };
  }
  const craft = b.kind === 'workshop' && b.variant >= 1 && b.variant <= 5 ? (`craft-${b.variant as 1 | 2 | 3 | 4 | 5}` as const) : null;
  const none = { extra: null, sy: 1, tint: 1, houseLevel: 0, vacant: false, closed: false, yard: null, mirror: 1 as const, kit: [], craft };
  if (b.kind === 'field') return { ...none, key: `field-${(b.variant % 4) as 0 | 1 | 2 | 3}` };
  if (!LEVELLED.includes(b.kind)) return { ...none, key: b.kind as KindKey };
  const level = Math.max(1, Math.min(3, b.level));
  const extra = level >= 2 ? (`up-${b.kind}-${level as 2 | 3}` as ExtraKey) : null;
  return { ...none, key: b.kind as KindKey, extra, sy: SERVICE[level].sy, tint: SERVICE[level].tint };
}

/** The model shown as a building's thumbnail in the interface (thumbs.ts): a lived-in mud house, a field of wheat. */
export const thumbKey = (k: BuildableKind): ModelKey => (k === 'house' ? 'house-2' : k === 'field' ? 'field-0' : (k as KindKey));

/**
 * The yard of the six looks per house level (with the kits, kits.ts): nothing, jars with a potted
 * plant, or a washing line (variant % 3), on the front right of the model (left when mirrored; a
 * tent keeps its fire on the other front corner).
 */
export function yardOf(b: Pick<Building, 'kind' | 'level' | 'variant'>): BuildingLook['yard'] {
  if (b.kind !== 'house' || b.level < 1) return null;
  const k = b.variant % 3;
  return k === 0 ? null : k === 1 ? 'yard-1' : 'yard-2';
}

/** Where a house's yard things stand (model x, z; front +z). */
export const YARD_AT: [number, number] = [0.68, 0.74];

/**
 * How full the city's food store looks in a granary yard: 0 (nearly empty), 1, 2, or 3 (from 80%).
 * Only looks (limits in visual.json > moments.granaryStock); the store is `s.food` against `foodCapacity`.
 */
export function stockLevel(s: GameState): 0 | 1 | 2 | 3 {
  const cap = foodCapacity(s);
  const share = cap > 0 ? s.food / cap : 0;
  const steps = VISUAL.moments.granaryStock;
  return share >= steps[2] ? 3 : share >= steps[1] ? 2 : share >= steps[0] ? 1 : 0;
}

/** Turn (radians about y) so the front (+z) faces a road next to the building; fixed for the big and long ones. */
export function facing(s: GameState, b: Building): number {
  if (b.kind === 'altar' || b.kind === 'temple') return 0;
  // Long buildings placed across (the market 4x2) turn their long side along x.
  if (b.w > b.h) return Math.PI / 2;
  const sides: [number, (c: { x: number; y: number }) => boolean][] = [
    [0, (c) => c.y === b.y + b.h],
    [Math.PI / 2, (c) => c.x === b.x + b.w],
    [-Math.PI / 2, (c) => c.x === b.x - 1],
    [Math.PI, (c) => c.y === b.y - 1],
  ];
  const road = borderCells(s, b).filter((c) => s.roads[indexOf(s, c.x, c.y)]);
  for (const [rot, on] of sides) {
    if (b.w !== b.h && Math.abs(rot) === Math.PI / 2) continue;
    if (road.some(on)) return rot;
  }
  return 0;
}

/**
 * Camera turn (yaw, radians about y) of the 3D view that matches the 2D view turned `rotation`
 * quarter turns (`iso.getRotation()`): the camera stands on the side of the map the 2D looks from,
 * so a road going down-left on the 2D screen also goes down-left in 3D (rotation 0: from +x +z).
 */
export const yawOfRotation = (rotation: number) => Math.PI / 4 + ((((rotation % 4) + 4) % 4) * Math.PI) / 2;

/** Stable 0..1 hash of a cell (jitter, tints, which roads get puddles). */
export const hash = (x: number, y: number, k = 0) => {
  const h = Math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453;
  return h - Math.floor(h);
};

/** One copy of a model on the ground. `y` is added by the world (ground height). */
export interface Placement {
  key: ModelKey;
  x: number;
  z: number;
  rot: number;
  scale: number;
  /** Vertical scale on top of `scale`. */
  sy: number;
  tint: number;
}

/** A building and how it is drawn. */
export interface BuildingPlacement extends Placement {
  b: Building;
  look: BuildingLook;
  /** A granary's yard as the food store fills (null: nearly empty or not a connected granary). */
  stock: 'stock-1' | 'stock-2' | 'stock-3' | null;
  /** The altar and the Temple: their stages built and the works under way (works.ts). */
  site: SiteLook | null;
}

export interface CityPlan {
  buildings: BuildingPlacement[];
  /** Trees, stumps, saplings, rocks, shrubs and roads. */
  props: Placement[];
  /** Road cells (bare roads, not under a building), for puddles. */
  roads: { x: number; y: number }[];
}

/** Share of the regrowth after which a sapling shows on a stump. */
export const SAPLING_FROM = 0.3;

/** How far a stump has grown back (0 just cut .. 1 a tree again), from `s.stumps`. */
export function regrowth(s: Pick<GameState, 'stumps' | 'week'>, i: number): number {
  const st = s.stumps.find((t) => t.i === i);
  if (!st) return 0;
  return Math.min(1, Math.max(0, (s.week - st.week) / RULES.treeRegrowWeeks));
}

/** Everything drawn on the map of `s`: buildings, trees (cut ones as stumps), rocks, shrubs and roads. */
export function cityPlan(s: GameState): CityPlan {
  const buildings: BuildingPlacement[] = [];
  const props: Placement[] = [];
  const roads: { x: number; y: number }[] = [];
  const sacred = sacredOf(s);
  const traffic = roadTraffic(s);
  const stock = stockLevel(s);
  for (let y = 0; y < s.rows; y++)
    for (let x = 0; x < s.cols; x++) {
      const i = indexOf(s, x, y);
      if (s.grid[i]) continue;
      const cx = x + 0.5;
      const cz = y + 0.5;
      if (s.roads[i]) {
        const tint = 0.92 + hash(x, y) * 0.12;
        for (const r of roadPieces(s, x, y, roadLevel(s, traffic, x, y, sacred))) props.push({ key: r.key, x: r.x, z: r.z, rot: r.rot, scale: 1, sy: 1, tint });
        roads.push({ x, y });
        continue;
      }
      const f = s.feature[i];
      const jx = cx + (hash(x, y, 1) - 0.5) * 0.4;
      const jz = cz + (hash(x, y, 2) - 0.5) * 0.4;
      const rot = hash(x, y, 3) * 6.28;
      if (f === 'stump') {
        props.push({ key: 'stump', x: jx, z: jz, rot, scale: 0.9 + hash(x, y, 4) * 0.3, sy: 1, tint: 1 });
        const g = regrowth(s, i);
        if (g >= SAPLING_FROM) props.push({ key: 'sapling', x: jx + 0.12, z: jz + 0.08, rot, scale: 0.35 + 0.65 * g, sy: 1, tint: 1 });
      } else if (f) {
        props.push({ key: treeKind(f, x, y), x: jx, z: jz, rot, scale: 0.85 + hash(x, y, 4) * 0.4, sy: 1, tint: 0.9 + hash(x, y, 5) * 0.2 });
      } else if (s.ground[i] === 'grass' && hash(x, y, 6) < 0.35) {
        const sx = cx + (hash(x, y, 7) - 0.5) * 0.7;
        const sz = cz + (hash(x, y, 8) - 0.5) * 0.7;
        props.push({ key: 'shrub', x: sx, z: sz, rot: 0, scale: 0.7 + hash(x, y, 9) * 0.8, sy: 1, tint: 0.85 + hash(x, y, 10) * 0.3 });
      }
    }
  for (const b of s.buildings) {
    if (s.grid[indexOf(s, b.x, b.y)] !== b) continue;
    const site = siteLook(s, b);
    const look = site ? { ...lookOf(b), key: site.key, sy: site.sy } : lookOf(b);
    const tint = look.tint * (0.95 + hash(b.x, b.y, 11) * 0.08);
    const full = b.kind === 'granary' && b.connected && stock ? (`stock-${stock}` as const) : null;
    buildings.push({ b, look, key: look.key, x: b.x + b.w / 2, z: b.y + b.h / 2, rot: facing(s, b), scale: 1, sy: look.sy, tint, stock: full, site });
  }
  return { buildings, props, roads };
}

/** People living in the city (not on the way with a caravan). */
export const residentsOf = (s: Pick<GameState, 'people'>) => s.people.reduce((n, p) => n + (p.houseId !== null ? 1 : 0), 0);

/** Walkers on the streets for a city of `residents` (a few even in a new town, capped for phones). */
export const walkerCount = (residents: number) => Math.min(140, 8 + Math.round(residents * 0.5));

