import { BUILDINGS, RULES } from './data';
import { computeEconomy, round2, type Economy } from './economy';
import { byRiver, fieldHarvest, foodCapacity, gatherFood, weeksToHarvest } from './harvest';
import { seasonCount, seasonOf, SEASONS, WEEKS_PER_YEAR } from './seasons';
import type { GameState, Season } from './types';

const AUTUMN = SEASONS.indexOf('autumn');

/** First week of the next autumn (a dry year lasts until then). */
function nextAutumn(week: number): number {
  let w = week + 1;
  while (!(seasonCount(w) % SEASONS.length === AUTUMN && w % RULES.weeksPerSeason === 0)) w++;
  return w;
}

/**
 * When the food runs out with the city as it is: weeks of food left (whole weeks before the
 * famine week) and the season of that week. Counts the steady food, the spring harvests (this
 * year's drought until the next autumn, none after) and the store limit. Null when the food
 * lasts the whole horizon (a year by default).
 */
export function foodForecast(s: GameState, eco: Economy = computeEconomy(s), horizon = WEEKS_PER_YEAR): { weeks: number; season: Season } | null {
  const steady = s.buildings.reduce((sum, b) => sum + gatherFood(s, b), 0);
  const fields = s.buildings.filter((b) => BUILDINGS[b.kind].harvest && b.connected).map((b) => ({ b, river: byRiver(s, b) }));
  const cap = foodCapacity(s);
  const dryUntil = s.drought ? nextAutumn(s.week) : -1;
  let food = s.food;
  for (let k = 0; k < horizon; k++) {
    const w = s.week + k;
    const harvest = fields.reduce((sum, f) => sum + fieldHarvest(s, f.b, w, w < dryUntil, f.river), 0);
    const delta = (steady + harvest) * eco.efficiency - eco.foodEaten;
    food = round2(Math.min(cap, food + delta)); // rounded like the weekly step
    if (food <= 0 && delta < 0) return { weeks: k, season: seasonOf(w) };
  }
  return null;
}

/** A forecast (from `foodForecast`) reaches the next harvest. */
export const lastsToHarvest = (s: GameState, out: ReturnType<typeof foodForecast>) => !out || out.weeks >= weeksToHarvest(s.week);

/** The food lasts until the next harvest begins. */
export const foodLastsToHarvest = (s: GameState, eco: Economy = computeEconomy(s)) => foodForecast(s, eco, weeksToHarvest(s.week)) === null;
