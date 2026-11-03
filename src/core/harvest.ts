import { BUILDINGS, RULES } from './data';
import { borderCells, cellsInRadius, indexOf } from './grid';
import { seasonCount, SEASONS } from './seasons';
import type { Building, GameState } from './types';

/** Seasons are counted from spring, so a season count that is a multiple of 4 is a spring. */
const SPRING = SEASONS.indexOf('spring');
const isSpring = (count: number) => count % SEASONS.length === SPRING;

/**
 * A field sown in an autumn harvests in the spring after it: it harvests in a spring if it was
 * built in or before the autumn that comes two seasons earlier.
 */
export const harvestsIn = (b: Pick<Building, 'built'>, week: number) => {
  const now = seasonCount(week);
  return isSpring(now) && seasonCount(b.built) <= now - 2;
};

/** First week of the first spring a field built in this week harvests in. */
export function firstHarvestWeek(built: number): number {
  let count = seasonCount(built) + 2;
  while (!isSpring(count)) count++;
  return (count - seasonCount(0)) * RULES.weeksPerSeason;
}

/** A field touching the river is watered: a dry year does not hurt it. */
export const byRiver = (s: GameState, b: Building) => borderCells(s, b).some((c) => s.ground[indexOf(s, c.x, c.y)] === 'river');

/**
 * Food a connected field gives in this week before the worker efficiency: its yearly harvest
 * spread over the spring weeks, cut in a dry year unless it touches the river.
 */
export function fieldHarvest(s: GameState, b: Building, week: number, drought = s.drought, river?: boolean): number {
  const yearly = BUILDINGS[b.kind].harvest;
  if (!yearly || !b.connected || !harvestsIn(b, week)) return 0;
  const share = drought && !(river ?? byRiver(s, b)) ? RULES.drought.harvestFactor : 1;
  return (yearly / RULES.weeksPerSeason) * share;
}

/** Food the city can keep: a base amount plus every connected granary. */
export const foodCapacity = (s: GameState) =>
  RULES.baseFoodStorage + s.buildings.reduce((sum, b) => sum + (b.connected ? (BUILDINGS[b.kind].storage ?? 0) : 0), 0);

/** Weeks from this week until the next harvest begins (the first week of the next spring, at least 1 away). */
export function weeksToHarvest(week: number): number {
  let d = 1;
  while (!(isSpring(seasonCount(week + d)) && (week + d) % RULES.weeksPerSeason === 0)) d++;
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
