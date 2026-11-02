import { BUILDINGS, HOUSE_LEVELS, RULES } from './data';
import type { BuildingKind, GameState } from './types';

export interface Economy {
  residents: number;
  workers: number;
  jobs: number;
  /** 0..1 */
  efficiency: number;
  foodDelta: number;
  /** Monthly silver balance: taxes + workshops - upkeep. */
  silverDelta: number;
  taxes: number;
  /** Silver made by workshops this month (after efficiency). */
  workshops: number;
  /** Upkeep per building kind (only kinds that cost something). */
  upkeep: Partial<Record<BuildingKind, number>>;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Disconnected workplaces neither produce nor offer jobs, but every building pays its upkeep.
 * Houses always count residents, food and taxes.
 */
export function computeEconomy(s: GameState): Economy {
  let residents = 0;
  let taxes = 0;
  let eaten = 0;
  let jobs = 0;
  let foodProd = 0;
  let silverProd = 0;
  const upkeep: Partial<Record<BuildingKind, number>> = {};
  for (const b of s.buildings) {
    if (b.kind === 'house') {
      const lvl = HOUSE_LEVELS[b.level];
      residents += lvl.residents;
      taxes += lvl.tax;
      eaten += lvl.residents * lvl.food;
      continue;
    }
    const def = BUILDINGS[b.kind];
    if (def.upkeep) upkeep[b.kind] = (upkeep[b.kind] ?? 0) + def.upkeep;
    if (!b.connected) continue;
    jobs += def.jobs;
    foodProd += def.food ?? 0;
    silverProd += def.silver ?? 0;
  }
  const workers = Math.floor(residents * RULES.workerShare);
  const efficiency = jobs === 0 ? 1 : Math.min(1, workers / jobs);
  const workshops = round2(silverProd * efficiency);
  const totalUpkeep = Object.values(upkeep).reduce((a, v) => a + v, 0);
  return {
    residents,
    workers,
    jobs,
    efficiency,
    foodDelta: round2(foodProd * efficiency - eaten),
    silverDelta: round2(taxes + workshops - totalUpkeep),
    taxes: round2(taxes),
    workshops,
    upkeep,
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
