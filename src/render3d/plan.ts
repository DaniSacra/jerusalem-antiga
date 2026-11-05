import { BUILDINGS, borderCells, indexOf, RULES, type Building, type BuildingKind, type GameState } from '../core';

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
export type ModelKey =
  | `house-${0 | 1 | 2 | 3 | 4}`
  | `field-${0 | 1 | 2 | 3}`
  | KindKey
  | 'olive' | 'palm' | 'rock' | 'shrub' | 'stump' | 'sapling' | 'road'
  /** The barred gate, sand drift and dry bush in front of an empty house. */
  | 'closed'
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

/** Footprint (cells) of each model key, used to fit .glb models and to build the additions. */
export function footprintOf(key: ModelKey): [number, number] {
  const extra = extraOf(key);
  if (extra) return kindFootprint(extra.kind);
  if (key.startsWith('house-') || key.startsWith('field-')) return kindFootprint(key.startsWith('house') ? 'house' : 'field');
  if (key in BUILDINGS) return kindFootprint(key as BuildingKind);
  return [1, 1];
}

/** Every key the code models must provide. */
export const MODEL_KEYS: ModelKey[] = [
  ...([0, 1, 2, 3, 4] as const).map((l) => `house-${l}` as const),
  ...([0, 1, 2, 3] as const).map((v) => `field-${v}` as const),
  ...(Object.keys(BUILDINGS) as BuildingKind[]).filter((k): k is KindKey => k !== 'house' && k !== 'field'),
  'olive', 'palm', 'rock', 'shrub', 'stump', 'sapling', 'road', 'closed',
  ...EXTRA_KEYS,
];

/**
 * Tint of an empty house that kept its level. It also marks it for the shaders: the house is drawn
 * faded and dusty (see `shaders.ts`) and its windows stay dark.
 */
export const VACANT_TINT = 0.7;
/** Where the barred gate of an empty house stands (model x, z; front +z), by the level kept: before its door. */
export const CLOSED_AT: Record<2 | 3 | 4, [number, number]> = { 2: [0.3, 0.86], 3: [0.05, 0.86], 4: [0, 0.9] };
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
}

/**
 * The look of a building: houses by level (an empty house that kept level 2..4 shows that level,
 * faded behind a barred gate; an empty plot otherwise), fields by crop, service buildings bigger and
 * richer at levels 2–3 (taller, with the additions of their kind).
 */
export function lookOf(b: Pick<Building, 'kind' | 'level' | 'emptyLevel' | 'variant' | 'w' | 'h'>): BuildingLook {
  if (b.kind === 'house') {
    const kept = b.level === 0 && b.emptyLevel >= 2 ? b.emptyLevel : 0;
    const level = Math.max(0, Math.min(4, b.level || kept)) as 0 | 1 | 2 | 3 | 4;
    return { key: `house-${level}`, extra: null, sy: 1, tint: kept ? VACANT_TINT : 1, houseLevel: level, vacant: b.level === 0, closed: kept > 0 };
  }
  const none = { extra: null, sy: 1, tint: 1, houseLevel: 0, vacant: false, closed: false };
  if (b.kind === 'field') return { ...none, key: `field-${(b.variant % 4) as 0 | 1 | 2 | 3}` };
  if (!LEVELLED.includes(b.kind)) return { ...none, key: b.kind as KindKey };
  const level = Math.max(1, Math.min(3, b.level));
  const extra = level >= 2 ? (`up-${b.kind}-${level as 2 | 3}` as ExtraKey) : null;
  return { ...none, key: b.kind as KindKey, extra, sy: SERVICE[level].sy, tint: SERVICE[level].tint };
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
  for (let y = 0; y < s.rows; y++)
    for (let x = 0; x < s.cols; x++) {
      const i = indexOf(s, x, y);
      if (s.grid[i]) continue;
      const cx = x + 0.5;
      const cz = y + 0.5;
      if (s.roads[i]) {
        props.push({ key: 'road', x: cx, z: cz, rot: 0, scale: 1, sy: 1, tint: 0.92 + hash(x, y) * 0.12 });
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
        props.push({ key: f, x: jx, z: jz, rot, scale: 0.85 + hash(x, y, 4) * 0.4, sy: 1, tint: 0.9 + hash(x, y, 5) * 0.2 });
      } else if (s.ground[i] === 'grass' && hash(x, y, 6) < 0.35) {
        const sx = cx + (hash(x, y, 7) - 0.5) * 0.7;
        const sz = cz + (hash(x, y, 8) - 0.5) * 0.7;
        props.push({ key: 'shrub', x: sx, z: sz, rot: 0, scale: 0.7 + hash(x, y, 9) * 0.8, sy: 1, tint: 0.85 + hash(x, y, 10) * 0.3 });
      }
    }
  for (const b of s.buildings) {
    if (s.grid[indexOf(s, b.x, b.y)] !== b) continue;
    const look = lookOf(b);
    const tint = look.tint * (0.95 + hash(b.x, b.y, 11) * 0.08);
    buildings.push({ b, look, key: look.key, x: b.x + b.w / 2, z: b.y + b.h / 2, rot: facing(s, b), scale: 1, sy: look.sy, tint });
  }
  return { buildings, props, roads };
}

/** People living in the city (not on the way with a caravan). */
export const residentsOf = (s: Pick<GameState, 'people'>) => s.people.reduce((n, p) => n + (p.houseId !== null ? 1 : 0), 0);

/** Walkers on the streets for a city of `residents` (a few even in a new town, capped for phones). */
export const walkerCount = (residents: number) => Math.min(140, 8 + Math.round(residents * 0.5));

