import { computeEconomy, costliestUpkeep, unemploymentAlert } from './economy';
import { RULES } from './data';
import type { BuildingKind, GameState } from './types';

/** Standing warnings, most urgent first (shown under the top bar; later in the stats panel). */
export type Alert =
  | { kind: 'debt'; monthsLeft: number }
  | { kind: 'deficit'; balance: number; costliest: BuildingKind; upkeep: number }
  | { kind: 'unemployed'; count: number };

export function alerts(s: GameState): Alert[] {
  const out: Alert[] = [];
  if (s.silver < 0) out.push({ kind: 'debt', monthsLeft: RULES.debtMonthsToLose - s.debtMonths });
  const eco = computeEconomy(s);
  const top = costliestUpkeep(eco);
  if (eco.silverDelta < 0 && top) out.push({ kind: 'deficit', balance: eco.silverDelta, costliest: top.kind, upkeep: top.amount });
  const idle = unemploymentAlert(s);
  if (idle > 0) out.push({ kind: 'unemployed', count: idle });
  return out;
}
