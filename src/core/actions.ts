import { BUILDINGS, dimsOf, RULES } from './data';
import { cellsOf, footprint, inBounds, indexOf } from './grid';
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

/** Builds a road or building. `rng` draws the look of houses (seeded from the id if not given). */
export function place(s: GameState, kind: Placeable, x: number, y: number, rotated = false, rng?: Rng): ActionResult {
  const r = checkPlace(s, kind, x, y, rotated);
  if (!r.ok) return r;
  s.silver -= costOf(kind);
  if (kind === 'road') {
    s.roads[indexOf(s, x, y)] = true;
  } else {
    const id = s.nextId++;
    const b: Building = { id, kind, x, y, ...placeSize(kind, rotated), level: 0, upStreak: 0, downStreak: 0, connected: false, variant: 0, mirrored: false };
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
