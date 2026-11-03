import { BUILDINGS, HOUSE_LEVELS, RULES } from './data';
import { houseHappiness, moodOf, taxFactor, type Mood } from './happiness';
import type { BuildingKind, GameState } from './types';

export interface Economy {
  residents: number;
  workers: number;
  jobs: number;
  /** 0..1 */
  efficiency: number;
  foodDelta: number;
  /** Food made this month (fields, after efficiency) and eaten by the residents; foodDelta = made - eaten. */
  foodMade: number;
  foodEaten: number;
  /** Monthly silver balance: taxes + production - upkeep. */
  silverDelta: number;
  taxes: number;
  /** Silver made per workplace kind this month (after efficiency). */
  production: Partial<Record<BuildingKind, number>>;
  /** Upkeep per building kind (only kinds that cost something). */
  upkeep: Partial<Record<BuildingKind, number>>;
  /** Average happiness of the houses with a family (50 with none). */
  happiness: number;
  /** Houses with a family in each mood. */
  moods: Record<Mood, number>;
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
  let foodProd = 0;
  const silverProd: Partial<Record<BuildingKind, number>> = {};
  const upkeep: Partial<Record<BuildingKind, number>> = {};
  const charged = upkeepCharged(s);
  for (const b of s.buildings) {
    if (b.kind === 'house') {
      const lvl = HOUSE_LEVELS[b.level];
      residents += lvl.residents;
      eaten += lvl.residents * lvl.food;
      continue;
    }
    const def = BUILDINGS[b.kind];
    if (def.upkeep && charged) upkeep[b.kind] = (upkeep[b.kind] ?? 0) + def.upkeep;
    if (!b.connected) continue;
    jobs += def.jobs;
    foodProd += def.food ?? 0;
    if (def.silver) silverProd[b.kind] = (silverProd[b.kind] ?? 0) + def.silver;
  }
  const workers = Math.floor(residents * RULES.workerShare);
  const idle = idleShare(s, { workers, jobs });
  for (const b of s.buildings) {
    if (b.kind !== 'house' || b.level === 0) continue;
    const h = houseHappiness(s, b, idle).value;
    taxes += HOUSE_LEVELS[b.level].tax * taxFactor(h);
    joy += h;
    families++;
    moods[moodOf(h)]++;
  }
  const efficiency = jobs === 0 ? 1 : Math.min(1, workers / jobs);
  const production: Partial<Record<BuildingKind, number>> = {};
  for (const [k, v] of Object.entries(silverProd) as [BuildingKind, number][]) production[k] = round2(v * efficiency);
  const sum = (r: Partial<Record<BuildingKind, number>>) => Object.values(r).reduce((a, v) => a + v, 0);
  return {
    residents,
    workers,
    jobs,
    efficiency,
    foodDelta: round2(foodProd * efficiency - eaten),
    foodMade: round2(foodProd * efficiency),
    foodEaten: round2(eaten),
    silverDelta: round2(taxes + sum(production) - sum(upkeep)),
    taxes: round2(taxes),
    production,
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

/** Share (0..1) of the workers without a job, as used by house happiness. */
export function idleShare(s: GameState, e: Pick<Economy, 'workers' | 'jobs'> = computeEconomy(s)): number {
  return e.workers > 0 ? Math.max(0, e.workers - e.jobs) / e.workers : 0;
}

/** Workers left without a job (0 when there are enough jobs). */
export function unemployed(s: GameState): number {
  const { workers, jobs } = computeEconomy(s);
  return Math.max(0, workers - jobs);
}

/** People without work to warn about, or 0 while the workshop is locked or below the alert threshold. */
export function unemploymentAlert(s: GameState): number {
  if (!s.unlocked.includes('workshop')) return 0;
  const n = unemployed(s);
  return n >= RULES.unemploymentAlert ? n : 0;
}
