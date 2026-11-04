import { BUILDINGS, HOUSE_LEVELS, RULES } from './data';
import { fieldBonus, fieldHarvest, gatherFood, isWorking } from './harvest';
import { houseHappiness, moodOf, taxFactor, type Mood } from './happiness';
import { seasonOf } from './seasons';
import type { BuildingKind, GameState } from './types';

export interface Economy {
  residents: number;
  workers: number;
  /** Jobs of the connected workplaces at work this week (frozen fields have none). */
  jobs: number;
  /** Jobs of every connected workplace, frozen fields included: the jobs of the whole year. */
  yearJobs: number;
  /** 0..1 */
  efficiency: number;
  foodDelta: number;
  /** Food the fields harvest this week (after efficiency; 0 outside spring). */
  harvest: number;
  /** Food made this week (fields, after efficiency) and eaten by the residents; foodDelta = made - eaten. */
  foodMade: number;
  foodEaten: number;
  /** Weekly silver balance: taxes - upkeep. */
  silverDelta: number;
  taxes: number;
  /** Upkeep per building kind (only kinds that cost something). */
  upkeep: Partial<Record<BuildingKind, number>>;
  /** Average happiness of the houses with a family (50 with none). */
  happiness: number;
  /** Houses with a family in each mood. */
  moods: Record<Mood, number>;
}

/** Food one resident of a house level eats in a week: more in winter, and most in a tent. */
export function foodPerResident(level: number, week: number): number {
  const food = HOUSE_LEVELS[level].food;
  if (seasonOf(week) !== 'winter') return food;
  return food * (level === 1 ? RULES.winter.tentFoodFactor : RULES.winter.foodFactor);
}

/** Upkeep is only charged after the first goals, so a new city cannot sink before it has people. */
export const upkeepCharged = (s: GameState) => s.goalIndex >= RULES.upkeepStartsAfterGoal;

export const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Disconnected workplaces neither produce nor offer jobs, but every building pays its upkeep
 * (once upkeep is charged, see `upkeepCharged`).
 * Houses always count residents, food and taxes; each house's tax is scaled by its happiness.
 */
export function computeEconomy(s: GameState): Economy {
  let residents = 0;
  let taxes = 0;
  let eaten = 0;
  let joy = 0;
  let families = 0;
  const moods: Record<Mood, number> = { happy: 0, neutral: 0, sad: 0 };
  let jobs = 0;
  let yearJobs = 0;
  let foodProd = 0;
  let harvest = 0;
  const upkeep: Partial<Record<BuildingKind, number>> = {};
  const charged = upkeepCharged(s);
  const bonus = fieldBonus(s);
  for (const b of s.buildings) {
    if (b.kind === 'house') {
      const n = HOUSE_LEVELS[b.level].residents;
      residents += n;
      eaten += n * foodPerResident(b.level, s.week);
      continue;
    }
    const def = BUILDINGS[b.kind];
    if (def.upkeep && charged) upkeep[b.kind] = (upkeep[b.kind] ?? 0) + def.upkeep;
    if (!b.connected) continue;
    yearJobs += def.jobs;
    if (!isWorking(b, s.week)) continue;
    jobs += def.jobs;
    const h = fieldHarvest(s, b, s.week, s.drought, undefined, bonus);
    harvest += h;
    foodProd += gatherFood(s, b) + h;
  }
  const workers = Math.floor(residents * RULES.workerShare);
  const idle = idleShare(s, { workers, yearJobs });
  for (const b of s.buildings) {
    if (b.kind !== 'house' || b.level === 0) continue;
    const h = houseHappiness(s, b, idle).value;
    taxes += HOUSE_LEVELS[b.level].tax * taxFactor(h);
    joy += h;
    families++;
    moods[moodOf(h)]++;
  }
  const efficiency = jobs === 0 ? 1 : Math.min(1, workers / jobs);
  const sum = (r: Partial<Record<BuildingKind, number>>) => Object.values(r).reduce((a, v) => a + v, 0);
  return {
    residents,
    workers,
    jobs,
    yearJobs,
    efficiency,
    foodDelta: round2(foodProd * efficiency - eaten),
    harvest: round2(harvest * efficiency),
    foodMade: round2(foodProd * efficiency),
    foodEaten: round2(eaten),
    silverDelta: round2(taxes - sum(upkeep)),
    taxes: round2(taxes),
    upkeep,
    happiness: families ? Math.round(joy / families) : 50,
    moods,
  };
}

/** The building kind with the highest total upkeep, or null if nothing costs upkeep. */
export function costliestUpkeep(eco: Economy): { kind: BuildingKind; amount: number } | null {
  let best: { kind: BuildingKind; amount: number } | null = null;
  for (const [kind, amount] of Object.entries(eco.upkeep) as [BuildingKind, number][]) {
    if (!best || amount > best.amount) best = { kind, amount };
  }
  return best;
}

/**
 * Share (0..1) of the workers without a job, as used by house happiness. It counts the jobs of
 * the whole year: in winter the farmer rests, he is not out of work.
 */
export function idleShare(s: GameState, e: Pick<Economy, 'workers' | 'yearJobs'> = computeEconomy(s)): number {
  return e.workers > 0 ? Math.max(0, e.workers - e.yearJobs) / e.workers : 0;
}

/** Workers left without a job of the year (0 when there are enough; frozen fields count). */
export function unemployed(s: GameState, e: Economy = computeEconomy(s)): number {
  return Math.max(0, e.workers - e.yearJobs);
}

/** People without work to warn about, or 0 while the workshop is locked or below the alert threshold. */
export function unemploymentAlert(s: GameState, e: Economy = computeEconomy(s)): number {
  if (!s.unlocked.includes('workshop')) return 0;
  const n = unemployed(s, e);
  return n >= RULES.unemploymentAlert ? n : 0;
}
