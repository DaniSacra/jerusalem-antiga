import { dimsOf, RULES } from './data';
import { between } from './rng';
import type { Cell, Feature, Ground, Rect, Rng } from './types';

/** Features the map is drawn with (stumps only come from cutting). */
type MapFeature = Exclude<Feature, 'stump'>;

const { cols, rows, altar, clearRadius, rocks, olives, palms, grassShare, river, denseGrove, rockOutcrop } = RULES.map;

const ALTAR = dimsOf('altar');
/** Column of the starting road: below the middle of the altar's south side. */
export const ROAD_X = altar.x + Math.floor(ALTAR.w / 2);
const ROAD_Y0 = altar.y + ALTAR.h;
/** Cells kept clear on each side of the starting road, so it and the entrance stay easy to see and build along. */
const ROAD_CLEAR = 2;

/** One-cell road ring around the altar (its footprint grown by one on every side). */
export function altarRing(): Cell[] {
  const [x0, y0, x1, y1] = [altar.x - 1, altar.y - 1, altar.x + ALTAR.w, altar.y + ALTAR.h];
  const cells: Cell[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x === x0 || x === x1 || y === y0 || y === y1) cells.push({ x, y });
  return cells;
}

/** Column of the short road north of the ring that the caravan tents stand along. */
const CAMP_X = altar.x + 1;
const HOUSE = dimsOf('house');
/** Rows of the caravan tents north of the ring: the first row touches it, the others go up. */
const CAMP_ROWS = [1, 2, 3].map((k) => altar.y - 1 - k * HOUSE.h);

/** The road stub north of the ring, between the two columns of caravan tents. */
export const campRoad = (): Cell[] => Array.from({ length: CAMP_ROWS.length * HOUSE.h }, (_, k) => ({ x: CAMP_X, y: altar.y - 2 - k }));

/**
 * Tent spots for the caravan (up to 6): two columns on both sides of the camp road, the row by
 * the ring first, west before east.
 */
export const caravanSpots = (): Cell[] =>
  CAMP_ROWS.flatMap((y) => [
    { x: CAMP_X - HOUSE.w, y },
    { x: CAMP_X + 1, y },
  ]);

/** A free 2 x 2 spot by the ring, east of the camp, where one plaza reaches every caravan tent. */
export const campPlazaSpot = (): Cell => ({ x: CAMP_X + 1 + HOUSE.w, y: CAMP_ROWS[0] });

/** Starting roads: the ring around the altar, the camp road and a straight road south to the map edge. */
export const startRoad = (): Cell[] => [
  ...altarRing(),
  ...campRoad(),
  ...Array.from({ length: rows - ROAD_Y0 - 1 }, (_, k) => ({ x: ROAD_X, y: ROAD_Y0 + 1 + k })),
];
export const entranceCell = (): Cell => ({ x: ROAD_X, y: rows - 1 });

/**
 * The Temple in ruins, there from the start (plan "ruínas" 1.1): 6 x 6 east of the altar, touching
 * its road ring, so it is connected from the first week and inside the cleared ground.
 */
export function templeRuin(): Rect {
  const d = dimsOf('temple');
  return { x: altar.x + ALTAR.w + 1, y: altar.y - 1, ...d };
}

/** Chebyshev distance from a cell to the altar footprint (0 inside it). */
export const altarDistance = (x: number, y: number) =>
  Math.max(altar.x - x, x - (altar.x + ALTAR.w - 1), altar.y - y, y - (altar.y + ALTAR.h - 1), 0);

/**
 * Cells kept free of rocks and trees: around the altar (the caravan's tents are in there too) and
 * a strip along the starting road down to the entrance.
 */
export function isReserved(x: number, y: number): boolean {
  return altarDistance(x, y) <= clearRadius || (Math.abs(x - ROAD_X) <= ROAD_CLEAR && y >= ROAD_Y0);
}

export interface Terrain {
  ground: Ground[];
  feature: (Feature | null)[];
}

const TAU = Math.PI * 2;

/**
 * West bank column and width of the river on every row: a band of minWidth..maxWidth cells that
 * bends smoothly (one column per row at most, so it is always continuous) and whose nearest cell
 * is exactly `distance` cells from the altar's border.
 */
function riverRows(distance: number, p: number[]): { x0: number[]; w: number[] } {
  const w = Array.from({ length: rows }, (_, y) => (Math.sin(y * 0.3 + p[2]) + 0.6 * Math.sin(y * 0.11 + p[0]) > 0.3 ? river.maxWidth : river.minWidth));
  const wave = (y: number) => 2.4 * Math.sin(y * 0.15 + p[0]) + 1.3 * Math.sin(y * 0.33 + p[1]);
  const shape = (base: number) => {
    const x0: number[] = [];
    for (let y = 0; y < rows; y++) {
      let x = Math.round(base + wave(y));
      if (y > 0) x = Math.max(x0[y - 1] - 1, Math.min(x0[y - 1] + 1, x));
      x0.push(Math.min(x, cols - w[y]));
    }
    return x0;
  };
  // Shifting the band east one column moves its nearest cell at most one cell away: the first
  // shift that reaches `distance` reaches it exactly.
  let x0 = shape(altar.x);
  for (let base = altar.x; base < cols * 2; base++) {
    x0 = shape(base);
    if (Math.min(...x0.map((x, y) => altarDistance(x, y))) >= distance) break;
  }
  return { x0, w };
}

/** A small integer offset, mostly near 0 (sum of three uniforms), scaled by `spread`. */
const jitter = (rng: Rng, spread: number) => Math.round((rng() + rng() + rng() - 1.5) * spread);

/** Clumps of each feature: features per clump and how far they spread from its center. */
const CLUMPS: Record<MapFeature, { size: [number, number]; spread: number }> = {
  rock: { size: [4, 9], spread: 1.6 },
  olive: { size: [7, 14], spread: 2.4 },
  palm: { size: [6, 12], spread: 2.2 },
};
/** A guaranteed group: `n` trees (olives and palms) or rocks packed in a square of `radius` around a center `distance` cells from the altar's border. */
interface Group {
  trees: boolean;
  n: number;
  radius: number;
  distance: [number, number];
}

/** New clumps start at least this far (Chebyshev) from any feature, leaving clearings between them. */
const CLUMP_GAP = 4;

/**
 * Terrain for a new map, all drawn from `rng` in a fixed order: the ground noise, the river (its
 * distance from the altar and its bends), the counts of rocks and trees, the guaranteed groups (dense groves, rock outcrop), then
 * clumps of rocks, olives and palms with clearings between them.
 */
export function generateTerrain(rng: Rng): Terrain {
  const p = [rng(), rng(), rng(), rng(), rng(), rng()].map((v) => v * TAU);
  const distance = between(rng, river.distance);
  const left: Record<MapFeature, number> = { rock: between(rng, rocks), olive: between(rng, olives), palm: between(rng, palms) };

  const noise = (x: number, y: number) => Math.sin(x * 0.35 + p[0]) + Math.sin(y * 0.3 + p[1]) + Math.sin((x + y) * 0.21 + p[2]);
  const threshold = 3 - 6 * grassShare;
  const bank = riverRows(distance, p.slice(3));
  const ground: Ground[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const water = x >= bank.x0[y] && x < bank.x0[y] + bank.w[y];
      ground.push(water ? 'river' : noise(x, y) > threshold ? 'grass' : 'sand');
    }
  }

  const feature: (Feature | null)[] = new Array(cols * rows).fill(null);
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < cols && y < rows;
  const open = (x: number, y: number) => inMap(x, y) && !isReserved(x, y) && ground[y * cols + x] !== 'river' && !feature[y * cols + x];
  const put = (x: number, y: number, f: MapFeature) => {
    feature[y * cols + x] = f;
    left[f]--;
  };

  // Guaranteed groups: dense groves of trees and a rock outcrop, each a square fully on free land
  // west of the river (the city's side), with a one-cell clearing around it.
  const groups: Group[] = [
    ...Array.from({ length: denseGrove.min }, (): Group => ({ trees: true, n: denseGrove.trees + between(rng, denseGrove.extra), radius: denseGrove.radius, distance: denseGrove.distance })),
    ...Array.from({ length: rockOutcrop.min }, (): Group => ({ trees: false, n: rockOutcrop.rocks + between(rng, rockOutcrop.extra), radius: rockOutcrop.radius, distance: rockOutcrop.distance })),
  ];
  const clearAround = (x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inMap(x + dx, y + dy) && feature[(y + dy) * cols + x + dx]) return false;
    return true;
  };
  for (const { trees, n, radius: r, distance: [dMin, dMax] } of groups) {
    const centers: Cell[] = [];
    for (let y = r; y < rows - r; y++) {
      for (let x = r; x < cols - r; x++) {
        const d = altarDistance(x, y);
        if (d < dMin || d > dMax || !clearAround(x, y, r + 1)) continue;
        let ok = true;
        for (let dy = -r; dy <= r && ok; dy++) for (let dx = -r; dx <= r && ok; dx++) ok = open(x + dx, y + dy) && x + dx < bank.x0[y + dy];
        if (ok) centers.push({ x, y });
      }
    }
    if (!centers.length) continue;
    const c = centers[Math.floor(rng() * centers.length)];
    const cells: { x: number; y: number; k: number }[] = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) cells.push({ x: c.x + dx, y: c.y + dy, k: Math.hypot(dx, dy) + rng() * 1.5 });
    cells.sort((a, b) => a.k - b.k);
    for (const cell of cells.slice(0, n)) put(cell.x, cell.y, !trees ? 'rock' : rng() < left.olive / (left.olive + left.palm) ? 'olive' : 'palm');
  }

  // Clumps: each starts on open land away from other features (or anywhere open once none is).
  const near = (x: number, y: number) => {
    for (let dy = -CLUMP_GAP; dy <= CLUMP_GAP; dy++) for (let dx = -CLUMP_GAP; dx <= CLUMP_GAP; dx++) if (inMap(x + dx, y + dy) && feature[(y + dy) * cols + x + dx]) return true;
    return false;
  };
  for (const f of ['rock', 'olive', 'palm'] as MapFeature[]) {
    while (left[f] > 0) {
      const free: number[] = [];
      const apart: number[] = [];
      for (let i = 0; i < cols * rows; i++) {
        const [x, y] = [i % cols, Math.floor(i / cols)];
        if (!open(x, y)) continue;
        free.push(i);
        if (!near(x, y)) apart.push(i);
      }
      const pool = apart.length ? apart : free;
      if (!pool.length) break;
      const i = pool[Math.floor(rng() * pool.length)];
      const [cx, cy] = [i % cols, Math.floor(i / cols)];
      const { size, spread } = CLUMPS[f];
      put(cx, cy, f);
      let n = Math.min(left[f], between(rng, size) - 1);
      for (let tries = 0; n > 0 && tries < 40; tries++) {
        const [x, y] = [cx + jitter(rng, spread), cy + jitter(rng, spread)];
        if (!open(x, y)) continue;
        put(x, y, f);
        n--;
      }
    }
  }
  return { ground, feature };
}
