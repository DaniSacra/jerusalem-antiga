import { HOUSE_LEVELS, RULES, storageOf } from './data';
import { round2, type Economy } from './economy';
import { comingWinterGrowth, difficultyOf } from './difficulty';
import { seasonOf } from './seasons';
import type { GameEvent, GameState, Material } from './types';

/**
 * Firewood (P4): in every winter week each house with people burns `firewood` of its level from
 * the wood stock, after the week's production. When the wood does not pay the burn, the city burns
 * what it has, the stock goes to 0 and it is cold (`s.cold`): houses suffer as in a famine.
 */

/** Wood the houses with people burn in a winter week (this winter's, or the coming one's: difficulty.ts). */
export function firewoodPerWeek(s: GameState): number {
  let n = 0;
  for (const b of s.buildings) if (b.kind === 'house' && b.level > 0) n += HOUSE_LEVELS[b.level].firewood ?? 0;
  return houseFirewood(s, n);
}

/** Firewood of the data (a house level's, or a sum) as this game burns it: the difficulty and the harder winters. */
export function houseFirewood(s: Pick<GameState, 'difficulty' | 'week'>, n: number): number {
  return round2(n * difficultyOf(s).firewood * (1 + comingWinterGrowth(s, s.week)));
}

/** Burns the week's firewood (winter only) and updates the cold, with its events. */
export function burnFirewood(s: GameState, events: GameEvent[]): void {
  const was = s.cold;
  const burn = seasonOf(s.week) === 'winter' ? firewoodPerWeek(s) : 0;
  s.cold = burn > s.wood;
  s.wood = round2(Math.max(0, s.wood - burn));
  if (s.cold && !was) events.push({ type: 'coldStart' });
  if (!s.cold && was) events.push({ type: 'coldEnd' });
}

/** Winter weeks left from this week on (0 in spring and summer; a whole winter in autumn). */
export function winterWeeksLeft(week: number): number {
  const season = seasonOf(week);
  const left = RULES.weeksPerSeason - (week % RULES.weeksPerSeason);
  return season === 'winter' ? left : season === 'autumn' ? RULES.weeksPerSeason : 0;
}

/** Weeks from this one to the next spring (production until then counts). */
export function weeksToSpring(week: number): number {
  const season = seasonOf(week);
  const left = RULES.weeksPerSeason - (week % RULES.weeksPerSeason);
  return season === 'winter' ? left : season === 'autumn' ? left + RULES.weeksPerSeason : 0;
}

/**
 * In autumn and winter: the wood missing to burn until the spring (stock plus the production until
 * then against the burn of the winter weeks left), rounded up; 0 when it lasts or out of season.
 */
export function firewoodShort(s: GameState, eco: Pick<Economy, 'wood'>): number {
  const need = firewoodPerWeek(s) * winterWeeksLeft(s.week);
  if (need <= 0) return 0;
  const have = s.wood + eco.wood * weeksToSpring(s.week);
  return have >= need ? 0 : Math.ceil(round2(need - have));
}

/**
 * In autumn and winter, paying `wood` now would leave the city short of firewood until the spring
 * (`firewoodShort` after paying): a house keeps the wood and climbs later. Never in spring or summer.
 */
export function keepsFirewood(s: GameState, wood: number, woodPerWeek: number): boolean {
  const season = seasonOf(s.week);
  if (season !== 'autumn' && season !== 'winter') return false;
  return firewoodShort({ ...s, wood: s.wood - wood }, { wood: woodPerWeek }) > 0;
}

/** A material stock at its cap: its maker stops. */
export const storageFull = (s: GameState, m: Material): boolean => s[m] >= storageOf(m);
