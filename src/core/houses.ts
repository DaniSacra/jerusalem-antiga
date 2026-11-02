import { BUILDINGS, HOUSE_LEVELS } from './data';
import { computeEconomy } from './economy';
import { cellsOf, indexOf } from './grid';
import type { BalloonKind, Building, GameState, NeedKind } from './types';

/** Road: the building is connected. Services: any cell of its footprint is covered. */
export function needMet(s: GameState, b: Building, need: NeedKind): boolean {
  return need === 'road' ? b.connected : cellsOf(b).some((c) => s.coverage[need][indexOf(s, c.x, c.y)]);
}

export const missingNeeds = (s: GameState, b: Building, needs: readonly NeedKind[]) => needs.filter((n) => !needMet(s, b, n));

export const hasNeeds = (s: GameState, b: Building, needs: readonly NeedKind[]) => missingNeeds(s, b, needs).length === 0;

export interface HouseInfo {
  level: number;
  name: string;
  residents: number;
  tax: number;
  next: { name: string; needs: { kind: NeedKind; ok: boolean }[] } | null;
}

export function houseInfo(s: GameState, b: Building): HouseInfo | null {
  if (b.kind !== 'house') return null;
  const cur = HOUSE_LEVELS[b.level];
  const next = HOUSE_LEVELS[b.level + 1];
  return {
    level: b.level,
    name: cur.name,
    residents: cur.residents,
    tax: cur.tax,
    next: next ? { name: next.name, needs: next.needs.map((kind) => ({ kind, ok: needMet(s, b, kind) })) } : null,
  };
}

/** A need is shown only once its building can be built (the altar always exists). */
const needVisible = (s: GameState, need: NeedKind) => need === 'road' || need === 'sacred' || s.unlocked.includes(need);

/**
 * First problem of a building, shown as a balloon: no road first; then workplaces with no
 * workers at all; then, for houses of levels 1-3, the first missing need of the next level.
 */
export function balloonNeed(s: GameState, b: Building): BalloonKind | null {
  if (!b.connected) return 'road';
  if (BUILDINGS[b.kind].jobs > 0 && computeEconomy(s).efficiency === 0) return 'workers';
  if (b.kind !== 'house' || b.level < 1 || b.level >= HOUSE_LEVELS.length - 1) return null;
  const first = missingNeeds(s, b, HOUSE_LEVELS[b.level + 1].needs)[0];
  return first && needVisible(s, first) ? first : null;
}

/** Houses connected to the road network with at least the given level. */
export const countHousesAtLeast = (s: GameState, level: number) =>
  s.buildings.filter((b) => b.kind === 'house' && b.connected && b.level >= level).length;
