import { BUILDINGS, HOUSE_LEVELS, RULES } from './data';
import type { GameState } from './types';

export interface Economy {
  residents: number;
  workers: number;
  jobs: number;
  /** 0..1 */
  efficiency: number;
  foodDelta: number;
  silverDelta: number;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeEconomy(s: GameState): Economy {
  let residents = 0;
  let taxes = 0;
  let jobs = 0;
  let foodProd = 0;
  let silverProd = 0;
  for (const b of s.buildings) {
    if (!b) continue;
    const def = BUILDINGS[b.kind];
    jobs += def.jobs;
    foodProd += def.food ?? 0;
    silverProd += def.silver ?? 0;
    if (b.kind === 'house') {
      residents += HOUSE_LEVELS[b.level].residents;
      taxes += HOUSE_LEVELS[b.level].tax;
    }
  }
  const workers = Math.floor(residents * RULES.workerShare);
  const efficiency = jobs === 0 ? 1 : Math.min(1, workers / jobs);
  return {
    residents,
    workers,
    jobs,
    efficiency,
    foodDelta: round2(foodProd * efficiency - residents * RULES.foodPerResident),
    silverDelta: round2(taxes + silverProd * efficiency),
  };
}
