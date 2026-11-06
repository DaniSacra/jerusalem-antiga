import { BUILDINGS, RULES, statOf } from './data';
import { borderCells, cellsInRadius, indexOf } from './grid';
import { seasonOf, WEEKS_PER_YEAR } from './seasons';
import type { Building, BuildingKind, Feature, GameState, GatherSource, Product, TreeFeature } from './types';
import { crewCounts, staffOf } from './work';

/**
 * Fields give food in spring, summer and autumn, from the week they are built; in winter they
 * freeze: no food and no workers.
 */
export const harvestsIn = (week: number) => seasonOf(week) !== 'winter';

/** Weeks of the year a field gives food (three seasons). */
const FIELD_WEEKS = WEEKS_PER_YEAR - RULES.weeksPerSeason;

/**
 * A building is at work this week: always, except a field in winter, which needs no workers
 * while frozen. Its workers are free for the fisher and the gatherer.
 */
export const isWorking = (b: Building, week: number) => !BUILDINGS[b.kind].harvest || harvestsIn(week);

/** A field touching the river is watered: a dry year does not hurt it. */
export const byRiver = (s: GameState, b: Building) => borderCells(s, b).some((c) => s.ground[indexOf(s, c.x, c.y)] === 'river');

/**
 * Extra share of food the fields give: the `fieldBonus` of every connected workshop at its level,
 * times the share of its jobs filled (an empty workshop adds nothing), at most `fieldBonusMax`.
 */
export function fieldBonus(s: GameState): number {
  const workshops = s.buildings.filter((b) => b.kind === 'workshop' && b.connected);
  if (!workshops.length) return 0;
  const crews = crewCounts(s);
  const sum = workshops.reduce((a, b) => a + statOf(b, 'fieldBonus') * staffOf(b, crews), 0);
  return Math.min(Math.round(sum * 100) / 100, BUILDINGS.workshop.fieldBonusMax ?? 0);
}

/**
 * Food a connected field gives in this week before the worker efficiency: its yearly harvest
 * spread over the weeks out of winter, cut in a dry year unless it touches the river, raised by
 * the workshops' `bonus` (see `fieldBonus`).
 */
export function fieldHarvest(s: GameState, b: Building, week: number, drought = s.drought, river?: boolean, bonus = fieldBonus(s)): number {
  const yearly = BUILDINGS[b.kind].harvest;
  if (!yearly || !b.connected || !harvestsIn(week)) return 0;
  const share = drought && !(river ?? byRiver(s, b)) ? RULES.drought.harvestFactor : 1;
  return (yearly / FIELD_WEEKS) * share * (1 + bonus);
}

/** Food the city can keep: a base amount plus every connected granary (by its level). */
export const foodCapacity = (s: GameState) => RULES.baseFoodStorage + s.buildings.reduce((sum, b) => sum + (b.connected ? statOf(b, 'storage') : 0), 0);

/** Weeks from this week until the next spring (when the fields thaw), at least 1 away: the food must last through the winter. */
export function weeksToHarvest(week: number): number {
  let d = 1;
  while (!(seasonOf(week + d) === 'spring' && (week + d) % RULES.weeksPerSeason === 0)) d++;
  return d;
}

/**
 * The next turn of the fields: out of winter, the weeks until the winter freezes them; in winter,
 * the weeks until the spring thaws them.
 */
export function nextFieldTurn(week: number): { season: 'winter' | 'spring'; weeks: number } {
  if (!harvestsIn(week)) return { season: 'spring', weeks: weeksToHarvest(week) };
  let d = 1;
  while (harvestsIn(week + d)) d++;
  return { season: 'winter', weeks: d };
}

/** River, tree or rock cells within a gathering building's radius. */
export function gatherCells(s: GameState, b: Building): number {
  const g = BUILDINGS[b.kind].gather;
  if (!g) return 0;
  return cellsInRadius(s, b.x, b.y, g.radius, b.w, b.h).filter((i) => isGatherSource(s, i, g.source)).length;
}

/** A tree a gatherer or lumber takes from (a stump is not one). */
export const isTree = (f: Feature | null): f is TreeFeature => f === 'olive' || f === 'palm';

/** A cell a fisher (river), gatherer or lumber (olive or palm tree) or quarry (rock) takes from. */
export function isGatherSource(s: GameState, i: number, source: GatherSource): boolean {
  if (source === 'river') return s.ground[i] === 'river';
  return source === 'rock' ? s.feature[i] === 'rock' : isTree(s.feature[i]);
}

/** What a gathering building brings: food unless its data says wood or stone. */
export const productOf = (kind: BuildingKind): Product | null => {
  const g = BUILDINGS[kind].gather;
  return g ? (g.product ?? 'food') : null;
};

/** Food a fisher or gatherer brings in a week before the worker efficiency (0 for other kinds). */
export const gatherFood = (s: GameState, b: Building, week = s.week): number =>
  productOf(b.kind) === 'food' ? gatherYield(s, b, week) : 0;

/**
 * What a gathering building (fisher, gatherer, lumber, quarry) brings every week of its product
 * (`productOf`) before the worker efficiency: min(max, cells × perCell), 0 when disconnected;
 * in winter only `winterFactor` of it.
 */
export function gatherYield(s: GameState, b: Building, week = s.week): number {
  const g = BUILDINGS[b.kind].gather;
  if (!g || !b.connected) return 0;
  const n = Math.min(g.max, gatherCells(s, b) * g.perCell);
  return seasonOf(week) === 'winter' ? n * (g.winterFactor ?? 1) : n;
}
