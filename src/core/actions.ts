import { BUILDINGS, RULES, sizeOf } from './data';
import { footprint, inBounds, indexOf } from './grid';
import { touchesNetwork } from './network';
import { refreshCity } from './refresh';
import type { ActionResult, Building, FailReason, GameState, Placeable } from './types';

const fail = (reason: FailReason): ActionResult => ({ ok: false, reason });
const OK: ActionResult = { ok: true };

export const costOf = (kind: Placeable) => (kind === 'road' ? RULES.roadCost : BUILDINGS[kind].cost);
export const placeSize = (kind: Placeable) => (kind === 'road' ? 1 : sizeOf(kind));

/** Free land: inside the map, not river, no rock or tree, no building or road. */
export function isFreeLand(s: GameState, x: number, y: number): boolean {
  if (!inBounds(s, x, y)) return false;
  const i = indexOf(s, x, y);
  return s.ground[i] !== 'river' && !s.feature[i] && !s.grid[i] && !s.roads[i];
}

/** Validates placing a road or building with its top-left cell at (x, y). */
export function checkPlace(s: GameState, kind: Placeable, x: number, y: number): ActionResult {
  if (!s.unlocked.includes(kind)) return fail('locked');
  const size = placeSize(kind);
  if (!footprint(x, y, size).every((c) => isFreeLand(s, c.x, c.y))) return fail('invalid');
  if (kind === 'temple' && !touchesNetwork(s, { x, y, size })) return fail('noRoad');
  if (s.silver < costOf(kind)) return fail('silver');
  return OK;
}

export function place(s: GameState, kind: Placeable, x: number, y: number): ActionResult {
  const r = checkPlace(s, kind, x, y);
  if (!r.ok) return r;
  s.silver -= costOf(kind);
  if (kind === 'road') {
    s.roads[indexOf(s, x, y)] = true;
  } else {
    const b: Building = { id: s.nextId++, kind, x, y, size: placeSize(kind), level: 0, upStreak: 0, downStreak: 0, connected: false };
    s.buildings.push(b);
    for (const c of footprint(x, y, b.size)) s.grid[indexOf(s, c.x, c.y)] = b;
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
    for (const c of footprint(b.x, b.y, b.size)) s.grid[indexOf(s, c.x, c.y)] = null;
  } else if (s.roads[i]) {
    s.roads[i] = false;
  } else {
    s.feature[i] = null;
    s.silver -= RULES.treeClearCost;
  }
  refreshCity(s);
  return r;
}
