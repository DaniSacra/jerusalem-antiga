import { BUILDINGS, dimsOf, RULES } from './data';
import { borderCells, cellsOf, footprint, inBounds, indexOf } from './grid';
import { touchesNetwork } from './network';
import { refreshCity } from './refresh';
import { rollLook } from './looks';
import { createRng } from './rng';
import type { ActionResult, BuildableKind, Building, Cell, Dims, FailReason, GameState, Placeable, Rng } from './types';

const fail = (reason: FailReason): ActionResult => ({ ok: false, reason });
const OK: ActionResult = { ok: true };

export const costOf = (kind: Placeable) => (kind === 'road' ? RULES.roadCost : BUILDINGS[kind].cost);
/** Footprint of a placeable; only non-square buildings change when rotated. */
export const placeSize = (kind: Placeable, rotated = false): Dims => (kind === 'road' ? { w: 1, h: 1 } : dimsOf(kind, rotated));

/** Free land: inside the map, not river, no rock or tree, no building or road. */
export function isFreeLand(s: GameState, x: number, y: number): boolean {
  if (!inBounds(s, x, y)) return false;
  const i = indexOf(s, x, y);
  return s.ground[i] !== 'river' && !s.feature[i] && !s.grid[i] && !s.roads[i];
}

const isFreeRect = (s: GameState, x: number, y: number, { w, h }: Dims) => footprint(x, y, w, h).every((c) => isFreeLand(s, c.x, c.y));

/** Validates placing a road or building with its top-left cell at (x, y). */
export function checkPlace(s: GameState, kind: Placeable, x: number, y: number, rotated = false): ActionResult {
  if (!s.unlocked.includes(kind)) return fail('locked');
  const d = placeSize(kind, rotated);
  if (!isFreeRect(s, x, y, d)) return fail('invalid');
  if (kind === 'temple' && !touchesNetwork(s, { x, y, ...d })) return fail('noRoad');
  if (s.silver < 0) return fail('debt');
  if (s.silver < costOf(kind)) return fail('silver');
  return OK;
}

/** Top-left cells where a building fits on free land touching the connected road network (silver ignored). */
export function placeSpots(s: GameState, kind: BuildableKind, rotated = false): Cell[] {
  const d = placeSize(kind, rotated);
  const out: Cell[] = [];
  for (let y = 0; y + d.h <= s.rows; y++) {
    for (let x = 0; x + d.w <= s.cols; x++) {
      if (isFreeRect(s, x, y, d) && touchesNetwork(s, { x, y, ...d })) out.push({ x, y });
    }
  }
  return out;
}

/** Top-left cells where the temple fits. */
export const templeSpots = (s: GameState) => placeSpots(s, 'temple');

/**
 * Placing here is held back only by the road: the footprint is free, the silver is there, but it
 * would not touch the network (the temple cannot be built; the others would stand cut off).
 */
export function onlyNeedsRoad(s: GameState, kind: Placeable, x: number, y: number, rotated = false): boolean {
  if (kind === 'road' || !s.unlocked.includes(kind)) return false;
  const d = placeSize(kind, rotated);
  return isFreeRect(s, x, y, d) && !touchesNetwork(s, { x, y, ...d }) && s.silver >= costOf(kind);
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Road steps over free land from the connected network (0 on it), with the previous cell of each. */
export function roadDistances(s: GameState): { dist: Int32Array; prev: Int32Array } {
  const dist = new Int32Array(s.cols * s.rows).fill(-1);
  const prev = new Int32Array(s.cols * s.rows).fill(-1);
  const queue: number[] = [];
  s.network.forEach((on, i) => {
    if (on && s.roads[i]) {
      dist[i] = 0;
      queue.push(i);
    }
  });
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    const x = i % s.cols;
    const y = Math.floor(i / s.cols);
    for (const [dx, dy] of DIRS) {
      if (!isFreeLand(s, x + dx, y + dy)) continue;
      const j = indexOf(s, x + dx, y + dy);
      if (dist[j] >= 0) continue;
      dist[j] = dist[i] + 1;
      prev[j] = i;
      queue.push(j);
    }
  }
  return { dist, prev };
}

/** A place where the temple fits: `ready` touches the network; otherwise a short road links it. */
export interface TempleSpot extends Cell {
  ready: boolean;
}

/**
 * Top-left cells where the temple fits on free land, touching the network (`ready`) or at most
 * `templeSpotRoadGap` free cells away from it (a road that long links it). Nearest the altar first
 * (Manhattan distance between the centers).
 */
export function templeSpotsNear(s: GameState): TempleSpot[] {
  const d = dimsOf('temple');
  const { dist } = roadDistances(s);
  const out: (TempleSpot & { far: number })[] = [];
  const a = { x: s.altar.x + dimsOf('altar').w / 2, y: s.altar.y + dimsOf('altar').h / 2 };
  for (let y = 0; y + d.h <= s.rows; y++) {
    for (let x = 0; x + d.w <= s.cols; x++) {
      if (!isFreeRect(s, x, y, d)) continue;
      const rect = { x, y, ...d };
      const ready = touchesNetwork(s, rect);
      const near = (c: Cell) => {
        const k = dist[indexOf(s, c.x, c.y)];
        return k > 0 && k <= RULES.templeSpotRoadGap;
      };
      if (!ready && !borderCells(s, rect).some(near)) continue;
      out.push({ x, y, ready, far: Math.abs(x + d.w / 2 - a.x) + Math.abs(y + d.h / 2 - a.y) });
    }
  }
  return out.sort((p, q) => p.far - q.far).map(({ far: _far, ...spot }) => spot);
}

/**
 * When no temple spot is near the network: the free place for it that needs the shortest new road,
 * with that road (from the network to the cell beside the place). Ties go to the place nearest the
 * altar. Null when the temple fits nowhere a road can reach.
 */
export function templeRoadSpot(s: GameState): (TempleSpot & { road: Cell[] }) | null {
  const d = dimsOf('temple');
  const { dist, prev } = roadDistances(s);
  const a = { x: s.altar.x + dimsOf('altar').w / 2, y: s.altar.y + dimsOf('altar').h / 2 };
  let best: { x: number; y: number; end: number; far: number } | null = null;
  for (let y = 0; y + d.h <= s.rows; y++) {
    for (let x = 0; x + d.w <= s.cols; x++) {
      if (!isFreeRect(s, x, y, d)) continue;
      let end = -1;
      for (const c of borderCells(s, { x, y, ...d })) {
        if (!inBounds(s, c.x, c.y)) continue;
        const i = indexOf(s, c.x, c.y);
        if (dist[i] >= 0 && (end < 0 || dist[i] < dist[end])) end = i;
      }
      if (end < 0) continue;
      const far = Math.abs(x + d.w / 2 - a.x) + Math.abs(y + d.h / 2 - a.y);
      if (best && (dist[end] > dist[best.end] || (dist[end] === dist[best.end] && far >= best.far))) continue;
      best = { x, y, end, far };
    }
  }
  if (!best) return null;
  const road: Cell[] = [];
  for (let i = best.end; dist[i] > 0; i = prev[i]) road.unshift({ x: i % s.cols, y: Math.floor(i / s.cols) });
  return { x: best.x, y: best.y, ready: road.length === 0, road };
}

/** Builds a road or building. `rng` draws the look of houses (seeded from the id if not given). */
export function place(s: GameState, kind: Placeable, x: number, y: number, rotated = false, rng?: Rng): ActionResult {
  const r = checkPlace(s, kind, x, y, rotated);
  if (!r.ok) return r;
  s.silver -= costOf(kind);
  if (kind === 'road') {
    s.roads[indexOf(s, x, y)] = true;
  } else {
    const id = s.nextId++;
    const b: Building = { id, kind, x, y, ...placeSize(kind, rotated), level: 0, upStreak: 0, downStreak: 0, connected: false, variant: 0, mirrored: false, built: s.week };
    s.buildings.push(b);
    for (const c of cellsOf(b)) s.grid[indexOf(s, c.x, c.y)] = b;
    rollLook(s, b, rng ?? createRng(id));
  }
  refreshCity(s);
  return r;
}

export function checkClear(s: GameState, x: number, y: number): ActionResult {
  if (!inBounds(s, x, y)) return fail('invalid');
  const i = indexOf(s, x, y);
  const b = s.grid[i];
  if (b) return BUILDINGS[b.kind].protected ? fail('protected') : OK;
  if (s.roads[i]) return OK;
  if (s.feature[i] !== 'palm' && s.feature[i] !== 'olive') return fail('invalid');
  if (s.silver < 0) return fail('debt');
  return s.silver < RULES.treeClearCost ? fail('silver') : OK;
}

/** Removes a building or road (no refund) or cuts a tree (costs silver). */
export function clearCell(s: GameState, x: number, y: number): ActionResult {
  const r = checkClear(s, x, y);
  if (!r.ok) return r;
  const i = indexOf(s, x, y);
  const b = s.grid[i];
  if (b) {
    s.buildings = s.buildings.filter((o) => o !== b);
    for (const c of cellsOf(b)) s.grid[indexOf(s, c.x, c.y)] = null;
  } else if (s.roads[i]) {
    s.roads[i] = false;
  } else {
    s.feature[i] = null;
    s.silver -= RULES.treeClearCost;
  }
  refreshCity(s);
  return r;
}
