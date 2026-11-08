import { computeEconomy, costliestUpkeep, type Economy } from './economy';
import { crewCounts, madeByCrew, unemploymentAlert, upkeepPaid } from './work';
import { BUILDINGS, RULES } from './data';
import { foodLastsToHarvest } from './forecast';
import { fieldBonus, foodCapacity, isWorking } from './harvest';
import { announcedCaravan } from './caravans';
import { freeHouse } from './families';
import { birthBlock } from './life';
import { waitingCouples } from './people';
import { seasonOf } from './seasons';
import { housesWaiting } from './houses';
import { firewoodShort, storageFull } from './firewood';
import { clothesShort } from './clothes';
import { MATERIALS, type BuildingKind, type GameState, type Material } from './types';

/** Standing warnings, most urgent first (the Avisos button and the statistics). */
export type Alert =
  /** `famine`: in debt and starving, the only way out is demolishing to afford a field. */
  | { kind: 'debt'; weeksLeft: number; famine: boolean }
  /** The food will not last until the next spring (in any season). */
  | { kind: 'foodShort' }
  /** The wood will not pay the winter's firewood (`missing`), or it is cold already. */
  | { kind: 'firewood'; missing: number; cold: boolean }
  /** The clothes will not dress everyone until the spring (`missing`), or the city is ragged already (plano-dificuldade E). */
  | { kind: 'clothes'; missing: number; ragged: boolean }
  /** A material store is full: its lumber or quarry stopped. */
  | { kind: 'storageFull'; material: Material }
  /** `count` houses are ready to climb but wait for this material. */
  | { kind: 'material'; material: Material; count: number; making: boolean }
  /** A caravan is announced: its families, weeks to go and empty houses missing for it and the waiting couples (0: room for all). */
  | { kind: 'caravan'; families: number; weeks: number; missing: number; couples: number }
  /** Engaged couples waiting for an empty house. */
  | { kind: 'couples'; count: number }
  /** The couple waiting longest leaves in `weeks` weeks without a house (their names). */
  | { kind: 'coupleLeaving'; man: string; woman: string; weeks: number }
  /** No child can be born: the food does not last until the spring with the reserve (or only the store cuts it). */
  | { kind: 'noBirths'; reason: 'food' | 'storage' }
  /** The stores are full and food is spoiling; `locked`: the granary is not unlocked yet. */
  | { kind: 'spoiling'; amount: number; capacity: number; locked: boolean }
  /** End of autumn with houses with people: keep firewood (tents suffer most). */
  /** `tents`: people live in tents (the cold can kill children and elders there). */
  | { kind: 'winterComing'; tents: boolean }
  /** The coming (or current) spring is dry. */
  | { kind: 'drought' }
  | { kind: 'deficit'; balance: number; costliest: BuildingKind; upkeep: number }
  /** `workshopsFull`: the workshops' field bonus is at its cap (another one only adds jobs). */
  | { kind: 'unemployed'; count: number; workshopsFull: boolean }
  /** The first connected workplace (at work this week) that makes something and has nobody: its kind. */
  | { kind: 'noCrew'; building: BuildingKind; count: number; upkeep: number };

/** Last weeks of autumn that warn about the winter. */
const lateAutumn = (week: number) => seasonOf(week) === 'autumn' && week % RULES.weeksPerSeason >= RULES.weeksPerSeason - RULES.winterWarningWeeks;

export function alerts(s: GameState, eco: Economy = computeEconomy(s)): Alert[] {
  const out: Alert[] = [];
  if (s.silver < 0) out.push({ kind: 'debt', weeksLeft: RULES.debtWeeksToLose - s.debtWeeks, famine: s.famine });
  const season = seasonOf(s.week);
  if (!foodLastsToHarvest(s, eco)) out.push({ kind: 'foodShort' });
  const missing = firewoodShort(s, eco);
  if (s.cold || missing > 0) out.push({ kind: 'firewood', missing, cold: s.cold });
  const bare = clothesShort(s, eco);
  if (s.ragged || bare > 0) out.push({ kind: 'clothes', missing: bare, ragged: s.ragged });
  const waiting = housesWaiting(s);
  for (const material of MATERIALS) if (waiting[material] > 0) out.push({ kind: 'material', material, count: waiting[material], making: eco[material] > 0 });
  const caravan = announcedCaravan(s);
  const couples = waitingCouples(s);
  if (caravan) {
    const free = s.buildings.filter((b) => freeHouse(s, b)).length;
    out.push({ kind: 'caravan', families: caravan.families, weeks: Math.max(0, caravan.week - s.week), missing: Math.max(0, caravan.families + couples.length - free), couples: couples.length });
  }
  if (couples.length) out.push({ kind: 'couples', count: couples.length });
  const first = couples[0];
  const left = first && first.since + RULES.people.coupleWaitWeeks - s.week;
  if (first && left <= RULES.people.coupleWarnWeeks) out.push({ kind: 'coupleLeaving', man: first.man.name, woman: first.woman.name, weeks: Math.max(0, left) });
  if (s.spoiled > 0) out.push({ kind: 'spoiling', amount: s.spoiled, capacity: foodCapacity(s), locked: !s.unlocked.includes('granary') });
  if (lateAutumn(s.week) && s.buildings.some((b) => b.kind === 'house' && b.level > 0))
    out.push({ kind: 'winterComing', tents: s.buildings.some((b) => b.kind === 'house' && b.level === 1) });
  if (s.drought && (season === 'winter' || season === 'spring')) out.push({ kind: 'drought' });
  const block = birthBlock(s, eco);
  const couple = s.people.some((p) => p.sex === 'f' && p.engaged === null && p.houseId !== null && s.people.some((o) => o.id === p.spouseId && o.houseId === p.houseId));
  if (couple && (block === 'food' || block === 'storage')) out.push({ kind: 'noBirths', reason: block });
  const top = costliestUpkeep(eco);
  if (eco.silverDelta < 0 && top) out.push({ kind: 'deficit', balance: eco.silverDelta, costliest: top.kind, upkeep: top.amount });
  const idle = unemploymentAlert(s);
  if (idle > 0) out.push({ kind: 'unemployed', count: idle, workshopsFull: fieldBonus(s) >= (BUILDINGS.workshop.fieldBonusMax ?? 0) });
  const crews = crewCounts(s);
  // Empty workplaces pay their upkeep in full (plano-dificuldade B): say how many and what they cost.
  const empty = s.buildings.filter((b) => b.connected && BUILDINGS[b.kind].jobs > 0 && madeByCrew(b.kind) && isWorking(b, s.week) && !crews.get(b.id));
  if (empty.length) out.push({ kind: 'noCrew', building: empty[0].kind, count: empty.length, upkeep: Math.round(empty.reduce((a, b) => a + upkeepPaid(b, crews), 0) * 100) / 100 });
  for (const material of MATERIALS) {
    if (storageFull(s, material) && s.buildings.some((b) => b.connected && BUILDINGS[b.kind].gather?.product === material)) out.push({ kind: 'storageFull', material });
  }
  return out;
}
