import { BUILDINGS, HOUSE_LEVELS, RULES } from './data';
import { computeEconomy, round2, type Economy } from './economy';
import { byRiver, fieldHarvest, foodCapacity, gatherFood, harvestsIn, weeksToHarvest } from './harvest';
import { targetLevel } from './houses';
import { seasonCount, seasonOf, SEASONS, WEEKS_PER_YEAR } from './seasons';
import type { GameState, Season } from './types';

const AUTUMN = SEASONS.indexOf('autumn');

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
}

/** Residents and food eaten per week once every house settles at its target level (plus extra tents). */
export function plannedEating(s: GameState, extraTents = 0): { residents: number; eaten: number } {
  const tent = HOUSE_LEVELS[1];
  let residents = extraTents * tent.residents;
  let eaten = residents * tent.food;
  for (const b of s.buildings) {
    if (b.kind !== 'house' || b.level === 0) continue;
    const lvl = HOUSE_LEVELS[targetLevel(s, b)];
    residents += lvl.residents;
    eaten += lvl.residents * lvl.food;
  }
  return { residents, eaten };
}

/**
 * When the food runs out with the city as it is: weeks of food left (whole weeks before the
 * famine week) and the season of that week. Counts the steady food, the spring harvests (this
 * year's drought until the next autumn, none after) and the store limit. Every house eats (and
 * works) at its target level, so a new well already shows the bigger houses it brings. Null
 * when the food lasts the whole horizon (a year by default).
 */
export function foodForecast(
  s: GameState,
  eco: Economy = computeEconomy(s),
  horizon = WEEKS_PER_YEAR,
  opts: ForecastOptions = {},
): FoodForecast {
  const steady = s.buildings.reduce((sum, b) => sum + gatherFood(s, b), 0);
  const fields = s.buildings.filter((b) => BUILDINGS[b.kind].harvest && b.connected).map((b) => ({ b, river: byRiver(s, b) }));
  // Fields take no workers in winter, so the efficiency changes over the year.
  const fieldJobs = (w: number) => (harvestsIn(w) ? fields.reduce((n, f) => n + BUILDINGS[f.b.kind].jobs, 0) : 0);
  const otherJobs = eco.jobs - fieldJobs(s.week);
  const planned = plannedEating(s, opts.extraTents);
  const workers = Math.floor(planned.residents * RULES.workerShare);
  const eaten = round2(planned.eaten);
  const efficiencyAt = (w: number) => {
    const jobs = otherJobs + fieldJobs(w);
    return jobs === 0 ? 1 : Math.min(1, workers / jobs);
  };
  const cap = opts.unlimited ? Infinity : foodCapacity(s);
  const dryUntil = s.drought ? nextAutumn(s.week) : -1;
  let food = s.food;
  for (let k = 0; k < horizon; k++) {
    const w = s.week + k;
    const harvest = fields.reduce((sum, f) => sum + fieldHarvest(s, f.b, w, w < dryUntil, f.river), 0);
    const delta = round2((steady + harvest) * efficiencyAt(w) - eaten);
    food = round2(Math.min(cap, food + delta)); // rounded like the weekly step
    if (food <= 0 && delta < 0) return { weeks: k, season: seasonOf(w) };
  }
  return null;
}

export type FoodForecast = { weeks: number; season: Season } | null;

/** A forecast (from `foodForecast`) reaches the next harvest. */
export const lastsToHarvest = (s: GameState, out: FoodForecast) => !out || out.weeks >= weeksToHarvest(s.week);

/** The food lasts until the next harvest begins. */
export const foodLastsToHarvest = (s: GameState, eco: Economy = computeEconomy(s), opts: ForecastOptions = {}) =>
  foodForecast(s, eco, weeksToHarvest(s.week), opts) === null;
