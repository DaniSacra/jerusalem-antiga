import { computeEconomy, costliestUpkeep, unemploymentAlert, type Economy } from './economy';
import { BUILDINGS, RULES } from './data';
import { foodLastsToHarvest } from './forecast';
import { fieldBonus, foodCapacity } from './harvest';
import { seasonOf } from './seasons';
import { housesWaiting } from './houses';
import { MATERIALS, type BuildingKind, type GameState, type Material } from './types';

/** Standing warnings, most urgent first (the Avisos button and the statistics). */
export type Alert =
  /** `famine`: in debt and starving, the only way out is demolishing to afford a field. */
  | { kind: 'debt'; weeksLeft: number; famine: boolean }
  /** The food will not last until the next spring (in any season). */
  | { kind: 'foodShort' }
  /** `count` houses are ready to climb but wait for this material. */
  | { kind: 'material'; material: Material; count: number }
  /** The stores are full and food is spoiling; `locked`: the granary is not unlocked yet. */
  | { kind: 'spoiling'; amount: number; capacity: number; locked: boolean }
  /** End of autumn with families in tents: winter hurts them. */
  | { kind: 'winterComing' }
  /** The coming (or current) spring is dry. */
  | { kind: 'drought' }
  | { kind: 'deficit'; balance: number; costliest: BuildingKind; upkeep: number }
  /** `workshopsFull`: the workshops' field bonus is at its cap (another one only adds jobs). */
  | { kind: 'unemployed'; count: number; workshopsFull: boolean };

/** Last weeks of autumn that warn about the winter. */
const lateAutumn = (week: number) => seasonOf(week) === 'autumn' && week % RULES.weeksPerSeason >= RULES.weeksPerSeason - RULES.winterWarningWeeks;

export function alerts(s: GameState, eco: Economy = computeEconomy(s)): Alert[] {
  const out: Alert[] = [];
  if (s.silver < 0) out.push({ kind: 'debt', weeksLeft: RULES.debtWeeksToLose - s.debtWeeks, famine: s.famine });
  const season = seasonOf(s.week);
  if (!foodLastsToHarvest(s, eco)) out.push({ kind: 'foodShort' });
  const waiting = housesWaiting(s);
  for (const material of MATERIALS) if (waiting[material] > 0) out.push({ kind: 'material', material, count: waiting[material] });
  if (s.spoiled > 0) out.push({ kind: 'spoiling', amount: s.spoiled, capacity: foodCapacity(s), locked: !s.unlocked.includes('granary') });
  if (lateAutumn(s.week) && s.buildings.some((b) => b.kind === 'house' && b.level === 1)) out.push({ kind: 'winterComing' });
  if (s.drought && (season === 'winter' || season === 'spring')) out.push({ kind: 'drought' });
  const top = costliestUpkeep(eco);
  if (eco.silverDelta < 0 && top) out.push({ kind: 'deficit', balance: eco.silverDelta, costliest: top.kind, upkeep: top.amount });
  const idle = unemploymentAlert(s, eco);
  if (idle > 0) out.push({ kind: 'unemployed', count: idle, workshopsFull: fieldBonus(s) >= (BUILDINGS.workshop.fieldBonusMax ?? 0) });
  return out;
}
