import { computeEconomy, costliestUpkeep, unemploymentAlert, type Economy } from './economy';
import { RULES } from './data';
import { foodLastsToHarvest } from './forecast';
import { seasonOf } from './seasons';
import type { BuildingKind, GameState } from './types';

/** Standing warnings, most urgent first (the Avisos button and the statistics). */
export type Alert =
  /** `famine`: in debt and starving, the only way out is demolishing to afford a field. */
  | { kind: 'debt'; weeksLeft: number; famine: boolean }
  /** Summer, and the food will not last until the next harvest. */
  | { kind: 'foodShort' }
  /** The stores are full and food is spoiling. */
  | { kind: 'spoiling'; amount: number }
  /** End of autumn with families in tents: winter hurts them. */
  | { kind: 'winterComing' }
  /** The coming (or current) spring is dry. */
  | { kind: 'drought' }
  | { kind: 'deficit'; balance: number; costliest: BuildingKind; upkeep: number }
  | { kind: 'unemployed'; count: number };

/** Last weeks of autumn that warn about the winter. */
const lateAutumn = (week: number) => seasonOf(week) === 'autumn' && week % RULES.weeksPerSeason >= RULES.weeksPerSeason - RULES.winterWarningWeeks;

export function alerts(s: GameState, eco: Economy = computeEconomy(s)): Alert[] {
  const out: Alert[] = [];
  if (s.silver < 0) out.push({ kind: 'debt', weeksLeft: RULES.debtWeeksToLose - s.debtWeeks, famine: s.famine });
  const season = seasonOf(s.week);
  if (season === 'summer' && !foodLastsToHarvest(s, eco)) out.push({ kind: 'foodShort' });
  if (s.spoiled > 0) out.push({ kind: 'spoiling', amount: s.spoiled });
  if (lateAutumn(s.week) && s.buildings.some((b) => b.kind === 'house' && b.level === 1)) out.push({ kind: 'winterComing' });
  if (s.drought && (season === 'winter' || season === 'spring')) out.push({ kind: 'drought' });
  const top = costliestUpkeep(eco);
  if (eco.silverDelta < 0 && top) out.push({ kind: 'deficit', balance: eco.silverDelta, costliest: top.kind, upkeep: top.amount });
  const idle = unemploymentAlert(s, eco);
  if (idle > 0) out.push({ kind: 'unemployed', count: idle });
  return out;
}
