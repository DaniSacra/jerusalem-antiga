import { BUILDINGS, RULES } from './data';
import { winterGrowth } from './difficulty';
import { peopleEating, round2, type Economy } from './economy';
import { byRiver, fieldBonus, fieldHarvest, foodCapacity, gatherFood, weeksToHarvest } from './harvest';
import { seasonCount, seasonOf, SEASONS, WEEKS_PER_YEAR } from './seasons';
import type { GameState, Season } from './types';
import { crewCounts, staffOf } from './work';

const AUTUMN = SEASONS.indexOf('autumn');
/** Any week out of winter and any week in winter (only the season matters for eating). */
const SUMMER_WEEK = firstWeekOf('summer');
const WINTER_WEEK = firstWeekOf('winter'); // of Year 1: no harder winter in it (eatenAt adds it)

function firstWeekOf(season: Season): number {
  let w = 0;
  while (seasonOf(w) !== season) w++;
  return w;
}

/** First week of the next autumn (a dry year lasts until then). */
function nextAutumn(week: number): number {
  let w = week + 1;
  while (!(seasonCount(w) % SEASONS.length === AUTUMN && w % RULES.weeksPerSeason === 0)) w++;
  return w;
}

export interface ForecastOptions {
  /** Ignore the store limit (to tell whether only the store cuts the food). */
  unlimited?: boolean;
  /** The food must never drop below this many weeks of eating (the births' reserve). */
  reserveWeeks?: number;
}

/**
 * When the food runs out with the city as it is: weeks of food left (whole weeks before the
 * famine week) and the season of that week. Counts the gathered food (less in winter), the field
 * harvests (this year's drought until the next autumn, none after), the store limit and what the
 * people living in the city eat now (more in winter; nobody is born, ages, moves or changes
 * job in the forecast: each workplace makes by its crew of today). With `reserveWeeks`, the food "runs out" when it drops below that many weeks of
 * eating. Null when the food lasts the whole horizon (a year by default).
 */
export function foodForecast(
  s: GameState,
  _eco?: Economy, // unused since the crews (plan B2): kept so callers need not change
  horizon = WEEKS_PER_YEAR,
  opts: ForecastOptions = {},
): FoodForecast {
  const crews = crewCounts(s);
  const steady = (w: number) => s.buildings.reduce((sum, b) => sum + gatherFood(s, b, w) * staffOf(b, crews), 0);
  const steadySummer = steady(SUMMER_WEEK);
  const steadyWinter = steady(WINTER_WEEK);
  const steadyAt = (w: number) => (seasonOf(w) === 'winter' ? steadyWinter : steadySummer);
  const bonus = fieldBonus(s);
  const fields = s.buildings.filter((b) => BUILDINGS[b.kind].harvest && b.connected).map((b) => ({ b, river: byRiver(s, b), staff: staffOf(b, crews) }));
  const summer = peopleEating(s, SUMMER_WEEK);
  const winter = peopleEating(s, WINTER_WEEK);
  // Winters grow harder from Year 3 on Difícil (difficulty.ts): the forecast eats as the week will.
  const eatenAt = (w: number) => round2(seasonOf(w) === 'winter' ? winter.eaten * (1 + winterGrowth(s, w)) : summer.eaten);
  // The reserve counts weeks of eating out of winter.
  const floor = (opts.reserveWeeks ?? 0) * summer.eaten;
  const cap = opts.unlimited ? Infinity : foodCapacity(s);
  const dryUntil = s.drought ? nextAutumn(s.week) : -1;
  let food = s.food;
  for (let k = 0; k < horizon; k++) {
    const w = s.week + k;
    const harvest = fields.reduce((sum, f) => sum + fieldHarvest(s, f.b, w, w < dryUntil, f.river, bonus) * f.staff, 0);
    const delta = round2(steadyAt(w) + harvest - eatenAt(w));
    food = round2(Math.min(cap, food + delta)); // rounded like the weekly step
    if (food <= floor && delta < 0) return { weeks: k, season: seasonOf(w) };
  }
  return null;
}

export type FoodForecast = { weeks: number; season: Season } | null;

/** A forecast (from `foodForecast`) reaches the next harvest. */
export const lastsToHarvest = (s: GameState, out: FoodForecast) => !out || out.weeks >= weeksToHarvest(s.week);

/** The food lasts until the next harvest begins. */
export const foodLastsToHarvest = (s: GameState, eco?: Economy, opts: ForecastOptions = {}) =>
  foodForecast(s, eco, weeksToHarvest(s.week), opts) === null;
