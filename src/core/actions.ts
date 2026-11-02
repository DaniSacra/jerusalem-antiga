import { updateCoverage } from './coverage';
import { BUILDINGS, RULES } from './data';
import { inBounds, indexOf } from './grid';
import type { ActionResult, BuildingKind, GameState } from './types';

const fail = (reason: 'locked' | 'invalid' | 'silver'): ActionResult => ({ ok: false, reason });
const OK: ActionResult = { ok: true };

export function checkBuild(s: GameState, kind: BuildingKind, x: number, y: number): ActionResult {
  if (!s.unlocked.includes(kind)) return fail('locked');
  if (!inBounds(s, x, y)) return fail('invalid');
  const i = indexOf(s, x, y);
  if (s.terrain[i] !== 'grass' || s.buildings[i]) return fail('invalid');
  if (s.silver < BUILDINGS[kind].cost) return fail('silver');
  return OK;
}

export function build(s: GameState, kind: BuildingKind, x: number, y: number): ActionResult {
  const r = checkBuild(s, kind, x, y);
  if (!r.ok) return r;
  s.silver -= BUILDINGS[kind].cost;
  s.buildings[indexOf(s, x, y)] = { kind, level: 0, upStreak: 0, downStreak: 0 };
  updateCoverage(s);
  return r;
}

export function checkClear(s: GameState, x: number, y: number): ActionResult {
  if (!inBounds(s, x, y)) return fail('invalid');
  const i = indexOf(s, x, y);
  if (s.buildings[i]) return OK;
  if (s.terrain[i] !== 'tree') return fail('invalid');
  return s.silver < RULES.treeClearCost ? fail('silver') : OK;
}

/** Removes a building (no refund) or cuts an olive tree (costs silver). */
export function clearCell(s: GameState, x: number, y: number): ActionResult {
  const r = checkClear(s, x, y);
  if (!r.ok) return r;
  const i = indexOf(s, x, y);
  if (s.buildings[i]) {
    s.buildings[i] = null;
    updateCoverage(s);
  } else {
    s.terrain[i] = 'grass';
    s.silver -= RULES.treeClearCost;
  }
  return r;
}
