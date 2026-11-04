import { BUILDINGS, RULES } from './data';
import { borderCells, cellsInRadius, indexOf } from './grid';
import { seasonOf, WEEKS_PER_YEAR } from './seasons';
import type { Building, GameState } from './types';

/**
 * Fields give food in spring, summer and autumn, from the week they are built; in winter they
 * freeze: no food, no silver and no workers.
 */
export const harvestsIn = (week: number) => seasonOf(week) !== 'winter';

/** Weeks of the year a field gives food (three seasons). */
const FIELD_WEEKS = WEEKS_PER_YEAR - RULES.weeksPerSeason;

/**
 * A building is at work this week: always, except a field in winter, which needs no workers (and
 * makes no silver) while frozen. Its workers are free for the fisher and the gatherer.
 */
export const isWorking = (b: Building, week: number) => !BUILDINGS[b.kind].harvest || harvestsIn(week);

/** A field touching the river is watered: a dry year does not hurt it. */
export const byRiver = (s: GameState, b: Building) => borderCells(s, b).some((c) => s.ground[indexOf(s, c.x, c.y)] === 'river');

/**
 * Food a connected field gives in this week before the worker efficiency: its yearly harvest
 * spread over the weeks out of winter, cut in a dry year unless it touches the river.
 */
export function fieldHarvest(s: GameState, b: Building, week: number, drought = s.drought, river?: boolean): number {
  const yearly = BUILDINGS[b.kind].harvest;
  if (!yearly || !b.connected || !harvestsIn(week)) return 0;
  const share = drought && !(river ?? byRiver(s, b)) ? RULES.drought.harvestFactor : 1;
  return (yearly / FIELD_WEEKS) * share;
}

/** Food the city can keep: a base amount plus every connected granary. */
export const foodCapacity = (s: GameState) =>
  RULES.baseFoodStorage + s.buildings.reduce((sum, b) => sum + (b.connected ? (BUILDINGS[b.kind].storage ?? 0) : 0), 0);

/** Weeks from this week until the next spring (when the fields thaw), at least 1 away: the food must last through the winter. */
export function weeksToHarvest(week: number): number {
  let d = 1;
  while (!(seasonOf(week + d) === 'spring' && (week + d) % RULES.weeksPerSeason === 0)) d++;
  return d;
}

/** River or tree cells within a gathering building's radius. */
export function gatherCells(s: GameState, b: Building): number {
  const g = BUILDINGS[b.kind].gather;
  if (!g) return 0;
  return cellsInRadius(s, b.x, b.y, g.radius, b.w, b.h).filter((i) => isGatherSource(s, i, g.source)).length;
}

/** A cell a fisher (river) or gatherer (olive or palm tree) takes food from. */
export const isGatherSource = (s: GameState, i: number, source: 'river' | 'tree') =>
  source === 'river' ? s.ground[i] === 'river' : s.feature[i] === 'olive' || s.feature[i] === 'palm';

/** Food a fisher or gatherer brings every week before the worker efficiency (0 when disconnected). */
export function gatherFood(s: GameState, b: Building): number {
  const g = BUILDINGS[b.kind].gather;
  return g && b.connected ? Math.min(g.max, gatherCells(s, b) * g.perCell) : 0;
}
