import { BUILDINGS, HOUSE_LEVELS, RULES } from './data';
import { computeEconomy, idleShare, type Economy } from './economy';
import { houseHappiness, taxFactor, type Happiness } from './happiness';
import { cellsOf, indexOf } from './grid';
import { gatherCells, isWorking } from './harvest';
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
  /** Tax with the happiness factor applied. */
  tax: number;
  /** Only for houses with a family. */
  happiness: Happiness | null;
  next: { name: string; needs: { kind: NeedKind; ok: boolean }[] } | null;
}

export function houseInfo(s: GameState, b: Building): HouseInfo | null {
  if (b.kind !== 'house') return null;
  const cur = HOUSE_LEVELS[b.level];
  const next = HOUSE_LEVELS[b.level + 1];
  const happiness = b.level > 0 ? houseHappiness(s, b, idleShare(s)) : null;
  return {
    level: b.level,
    name: cur.name,
    residents: cur.residents,
    tax: happiness ? cur.tax * taxFactor(happiness.value) : cur.tax,
    happiness,
    next: next ? { name: next.name, needs: next.needs.map((kind) => ({ kind, ok: needMet(s, b, kind) })) } : null,
  };
}

/**
 * The level a house with a family settles at with the services it has now: it climbs while the
 * next level's needs are met and drops (never below a tent) while its own are missing.
 */
export function targetLevel(s: GameState, b: Building): number {
  if (b.kind !== 'house' || b.level === 0) return 0;
  let level = b.level;
  while (level > 1 && !hasNeeds(s, b, HOUSE_LEVELS[level].needs)) level--;
  while (level < HOUSE_LEVELS.length - 1 && hasNeeds(s, b, HOUSE_LEVELS[level + 1].needs)) level++;
  return level;
}

/**
 * Weeks until a house with a family climbs to the next level if nothing changes (paused by a
 * famine), or null when it is at the top or misses one of the next level's needs.
 */
export function weeksToNextLevel(s: GameState, b: Building): number | null {
  const next = HOUSE_LEVELS[b.level + 1];
  if (b.kind !== 'house' || b.level === 0 || !next || !hasNeeds(s, b, HOUSE_LEVELS[b.level].needs) || !hasNeeds(s, b, next.needs)) return null;
  return Math.max(1, RULES.weeksToUpgrade - b.upStreak);
}

/**
 * First problem of a building, shown as a balloon: no road first; then workplaces with no
 * workers at all; then a fisher or gatherer with no river or trees in reach; then, for houses of levels 1-3, the first missing need of the next level (the
 * most useful hint early on); then sad houses.
 */
export function balloonNeed(s: GameState, b: Building, e: Economy = computeEconomy(s)): BalloonKind | null {
  if (!b.connected) return 'road';
  if (BUILDINGS[b.kind].jobs > 0 && e.efficiency === 0 && isWorking(b, s.week)) return 'workers';
  if (BUILDINGS[b.kind].gather && gatherCells(s, b) === 0) return 'noSource';
  if (b.kind !== 'house' || b.level < 1) return null;
  const first = b.level < HOUSE_LEVELS.length - 1 ? missingNeeds(s, b, HOUSE_LEVELS[b.level + 1].needs)[0] : undefined;
  if (first) return first; // a locked need shows too (with a lock): the player learns what comes next
  return houseHappiness(s, b, idleShare(s, e)).mood === 'sad' ? 'sad' : null;
}

/** Houses connected to the road network with at least the given level. */
export const countHousesAtLeast = (s: GameState, level: number) =>
  s.buildings.filter((b) => b.kind === 'house' && b.connected && b.level >= level).length;

/** A service need whose building the city cannot build yet (the balloon shows it with a lock). */
export const needLocked = (s: GameState, need: BalloonKind): boolean =>
  need !== 'road' && (SERVICE_NEEDS as readonly BalloonKind[]).includes(need) && !s.unlocked.includes(need as Exclude<NeedKind, 'road'>);

const SERVICE_NEEDS: readonly Exclude<NeedKind, 'road'>[] = ['plaza', 'market', 'park'];
