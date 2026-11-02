import { HOUSE_LEVELS } from './data';
import type { GameState, ServiceKind } from './types';

export const missingNeeds = (s: GameState, i: number, needs: readonly ServiceKind[]) =>
  needs.filter((k) => !s.coverage[k][i]);

export const hasNeeds = (s: GameState, i: number, needs: readonly ServiceKind[]) =>
  missingNeeds(s, i, needs).length === 0;

export interface HouseInfo {
  level: number;
  name: string;
  residents: number;
  tax: number;
  next: { name: string; needs: { kind: ServiceKind; ok: boolean }[] } | null;
}

export function houseInfo(s: GameState, i: number): HouseInfo | null {
  const b = s.buildings[i];
  if (b?.kind !== 'house') return null;
  const cur = HOUSE_LEVELS[b.level];
  const next = HOUSE_LEVELS[b.level + 1];
  return {
    level: b.level,
    name: cur.name,
    residents: cur.residents,
    tax: cur.tax,
    next: next ? { name: next.name, needs: next.needs.map((kind) => ({ kind, ok: s.coverage[kind][i] })) } : null,
  };
}

/** Need shown in the balloon above a house (levels 1-3): first missing need of the next level, if unlocked. */
export function balloonNeed(s: GameState, i: number): ServiceKind | null {
  const b = s.buildings[i];
  if (b?.kind !== 'house' || b.level < 1 || b.level >= HOUSE_LEVELS.length - 1) return null;
  const first = missingNeeds(s, i, HOUSE_LEVELS[b.level + 1].needs)[0];
  return first && s.unlocked.includes(first) ? first : null;
}

export function countHousesAtLeast(s: GameState, level: number): number {
  return s.buildings.filter((b) => b?.kind === 'house' && b.level >= level).length;
}
