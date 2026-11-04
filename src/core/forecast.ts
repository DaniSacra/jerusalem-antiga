import { BUILDINGS, HOUSE_LEVELS, RULES } from './data';
import { computeEconomy, foodPerResident, round2, type Economy } from './economy';
import { byRiver, fieldBonus, fieldHarvest, foodCapacity, gatherFood, harvestsIn, weeksToHarvest } from './harvest';
import { targetLevel } from './houses';
import { seasonCount, seasonOf, SEASONS, WEEKS_PER_YEAR } from './seasons';
import type { Building, GameState, Season } from './types';

const AUTUMN = SEASONS.indexOf('autumn');
/** Any week out of winter and any week in winter (only the season matters for eating). */
const SUMMER_WEEK = firstWeekOf('summer');
const WINTER_WEEK = firstWeekOf('winter');

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
  /** Tents that will have a family soon (families on the way, a new family). */
  extraTents?: number;
  /** Ignore the store limit (to tell whether only the store cuts the food). */
  unlimited?: boolean;
  /** The food must never drop below this many weeks of the planned eating (the family door). */
  reserveWeeks?: number;
}

/** The level a house with a family is planned at: its target level, but at most one level up. */
const plannedLevel = (s: GameState, b: Building) => Math.min(targetLevel(s, b), b.level + 1);

/**
 * Residents and food eaten per week, out of winter and in winter, once every house settles at its
 * planned level (its target, at most one level up) plus extra tents.
 */
export function plannedEating(s: GameState, extraTents = 0): { residents: number; eaten: number; winterEaten: number } {
  const out = { residents: 0, eaten: 0, winterEaten: 0 };
  const add = (level: number, count: number) => {
    const n = HOUSE_LEVELS[level].residents * count;
    out.residents += n;
    out.eaten += n * foodPerResident(level, SUMMER_WEEK);
    out.winterEaten += n * foodPerResident(level, WINTER_WEEK);
  };
  add(1, extraTents);
  for (const b of s.buildings) if (b.kind === 'house' && b.level > 0) add(plannedLevel(s, b), 1);
  return out;
}

/**
 * When the food runs out with the city as it is: weeks of food left (whole weeks before the
 * famine week) and the season of that week. Counts the steady food, the field harvests (this
 * year's drought until the next autumn, none after), the store limit and the winter eating.
 * Every house eats (and works) at its planned level (see `plannedEating`), so a new well already
 * shows the bigger houses it brings. With `reserveWeeks`, the food "runs out" when it drops below
 * that many weeks of eating. Null when the food lasts the whole horizon (a year by default).
 */
export function foodForecast(
  s: GameState,
  eco: Economy = computeEconomy(s),
  horizon = WEEKS_PER_YEAR,
  opts: ForecastOptions = {},
): FoodForecast {
  const steady = s.buildings.reduce((sum, b) => sum + gatherFood(s, b), 0);
  const bonus = fieldBonus(s);
  const fields = s.buildings.filter((b) => BUILDINGS[b.kind].harvest && b.connected).map((b) => ({ b, river: byRiver(s, b) }));
  // Fields take no workers in winter, so the efficiency changes over the year.
  const fieldJobs = (w: number) => (harvestsIn(w) ? fields.reduce((n, f) => n + BUILDINGS[f.b.kind].jobs, 0) : 0);
  const otherJobs = eco.jobs - fieldJobs(s.week);
  const planned = plannedEating(s, opts.extraTents);
  const workers = Math.floor(planned.residents * RULES.workerShare);
  const eatenAt = (w: number) => round2(seasonOf(w) === 'winter' ? planned.winterEaten : planned.eaten);
  // The reserve counts weeks of eating out of winter (the numbers were tuned with it).
  const floor = (opts.reserveWeeks ?? 0) * planned.eaten;
  const efficiencyAt = (w: number) => {
    const jobs = otherJobs + fieldJobs(w);
    return jobs === 0 ? 1 : Math.min(1, workers / jobs);
  };
  const cap = opts.unlimited ? Infinity : foodCapacity(s);
  const dryUntil = s.drought ? nextAutumn(s.week) : -1;
  let food = s.food;
  for (let k = 0; k < horizon; k++) {
    const w = s.week + k;
    const harvest = fields.reduce((sum, f) => sum + fieldHarvest(s, f.b, w, w < dryUntil, f.river, bonus), 0);
    const delta = round2((steady + harvest) * efficiencyAt(w) - eatenAt(w));
    food = round2(Math.min(cap, food + delta)); // rounded like the weekly step
    if (food <= floor && delta < 0) return { weeks: k, season: seasonOf(w) };
  }
  return null;
}

export type FoodForecast = { weeks: number; season: Season } | null;

/** A forecast (from `foodForecast`) reaches the next harvest. */
export const lastsToHarvest = (s: GameState, out: FoodForecast) => !out || out.weeks >= weeksToHarvest(s.week);

/** The food lasts until the next harvest begins. */
export const foodLastsToHarvest = (s: GameState, eco: Economy = computeEconomy(s), opts: ForecastOptions = {}) =>
  foodForecast(s, eco, weeksToHarvest(s.week), opts) === null;
