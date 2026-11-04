import { BUILDINGS, canRotate, dimsOf, GOALS, HOUSE_LEVELS, RULES } from './data';
import { clearCell, placeSpots } from './actions';
import { serviceOf } from './coverage';
import { computeEconomy, foodPerResident, round2, type Economy } from './economy';
import { familyBlock, type FamilyBlock } from './families';
import { foodForecast, type FoodForecast } from './forecast';
import { currentGoal, goalOpen, goalProgress, goalTarget, yearOf } from './goals';
import { borderCells, cellsInRadius, cellsOf, indexOf } from './grid';
import { fieldHarvest, foodCapacity, gatherYield, isGatherSource, productOf } from './harvest';
import { levelMaterials } from './materials';
import { seasonOf } from './seasons';
import type { BuildableKind, Building, Cell, GameState, Materials, Product, Season } from './types';

/** Values derived from the state for the interface. Read only: nothing here changes the game. */

/** What the screen reads about the city, computed once per refresh. */
export interface CityReadout {
  eco: Economy;
  /** `foodForecast` for a year. */
  forecast: FoodForecast;
  /** Why no new family comes (`familyBlock`). */
  block: FamilyBlock | null;
}

export function readCity(s: GameState): CityReadout {
  const eco = computeEconomy(s);
  return { eco, forecast: foodForecast(s, eco), block: familyBlock(s, eco) };
}

/** City level shown on the HUD: goals done + 1. */
export const cityLevel = (s: GameState) => s.goalIndex + 1;

/** Most a goal waiting for its `fromYear` can show: never full, since it cannot be done yet. */
const WAITING_MAX = 0.95;

/** Progress (0..1) of the current goal; 1 when every goal is done. */
export function goalFraction(s: GameState): number {
  const goal = currentGoal(s);
  if (!goal) return 1;
  const target = goalTarget(s, goal);
  const f = target <= 0 ? 1 : Math.min(1, goalProgress(s, goal) / target);
  return goalOpen(s, goal) ? f : Math.min(WAITING_MAX, f);
}

/** Number of goals in the game. */
export const goalCount = () => GOALS.length;

/** Season, year (from 1) and week of the season (from 1) of a week tick. */
export function calendar(week: number): { season: Season; year: number; week: number } {
  return { season: seasonOf(week), year: yearOf(week), week: (week % RULES.weeksPerSeason) + 1 };
}

/**
 * Weekly silver balance if one more connected building of this kind existed (its upkeep, jobs
 * and production; the new coverage is left out).
 */
export function balanceAfter(s: GameState, kind: BuildableKind): number {
  const ghost: Building = { id: -1, kind, x: 0, y: 0, w: 1, h: 1, level: 0, upStreak: 0, downStreak: 0, connected: true, variant: 0, mirrored: false, built: 0 };
  return computeEconomy({ ...s, buildings: [...s.buildings, ghost] }).silverDelta;
}

export interface FoodAfter {
  /** Weekly food balance with the new building (after the worker efficiency). */
  delta: number;
  /** What the new building itself brings a week of `product` (after the worker efficiency). */
  yields: number;
  /** Food for fields, fishers and gatherers; wood or stone for a lumber or quarry. */
  product: Product;
  /** Worker efficiency with the new building's jobs. */
  efficiency: number;
}

/**
 * Weekly food if one more building of this kind stood at `at`: its own food and the jobs it adds,
 * with the efficiency that follows (a workplace with too few workers makes every food building
 * bring less). At a spot it works only when it touches the connected roads; with no spot it is
 * taken as connected, and a fisher or gatherer brings nothing (its food depends on the spot).
 */
export function foodAfter(s: GameState, kind: BuildableKind, at?: Spot): FoodAfter {
  const { w, h } = dimsOf(kind, at?.rotated);
  // With no spot the ghost stands off the map: no river or trees around it.
  const { x, y } = at ?? { x: -s.cols, y: -s.rows };
  const connected = !at || borderCells(s, { x, y, w, h }).some((c) => s.network[indexOf(s, c.x, c.y)]);
  const ghost: Building = { id: -1, kind, x, y, w, h, level: 0, upStreak: 0, downStreak: 0, connected, variant: 0, mirrored: false, built: s.week };
  const eco = computeEconomy({ ...s, buildings: [...s.buildings, ghost] });
  const own = gatherYield(s, ghost) + fieldHarvest(s, ghost, s.week);
  return { delta: eco.foodDelta, yields: round2(own * eco.efficiency), product: productOf(kind) ?? 'food', efficiency: eco.efficiency };
}

/** Houses with a family inside the radius of a service building; null for kinds with no service. */
export function housesServed(s: GameState, b: Building): number | null {
  if (!serviceOf(b.kind)) return null;
  if (!b.connected) return 0;
  const area = new Set(cellsInRadius(s, b.x, b.y, BUILDINGS[b.kind].radius ?? 0, b.w, b.h));
  return s.buildings.filter((h) => h.kind === 'house' && h.level > 0 && cellsOf(h).some((c) => area.has(indexOf(s, c.x, c.y)))).length;
}

/**
 * What a house gains on its next level (residents and base tax), what it eats more a week at
 * this week's rate (winter included) and the materials it pays to climb, or null at the top level.
 */
export function upgradeGain(level: number, week: number): { residents: number; tax: number; food: number; materials: Materials } | null {
  const cur = HOUSE_LEVELS[level];
  const next = HOUSE_LEVELS[level + 1];
  const eats = (l: number) => HOUSE_LEVELS[l].residents * foodPerResident(l, week);
  return next ? { residents: next.residents - cur.residents, tax: next.tax - cur.tax, food: round2(eats(level + 1) - eats(level)), materials: levelMaterials(level + 1) } : null;
}

/** The tree-gathering kind that shares the groves with this one (gatherer and lumber), or null. */
const RIVAL: Partial<Record<BuildableKind, BuildableKind>> = { gatherer: 'lumber', lumber: 'gatherer' };

/**
 * Trees a gatherer or lumber placed at (x, y) would share with the existing ones of the other
 * kind (in both radii): the preview's "shares the grove". 0 for other kinds.
 */
export function sharedTrees(s: GameState, x: number, y: number, kind: BuildableKind, rotated = false): number {
  const rival = RIVAL[kind];
  const g = BUILDINGS[kind].gather;
  if (!rival || !g) return 0;
  const { w, h } = dimsOf(kind, rotated);
  const theirs = new Set<number>();
  for (const b of s.buildings) if (b.kind === rival) for (const i of cellsInRadius(s, b.x, b.y, BUILDINGS[rival].gather!.radius, b.w, b.h)) theirs.add(i);
  return cellsInRadius(s, x, y, g.radius, w, h).filter((i) => theirs.has(i) && isGatherSource(s, i, 'tree')).length;
}

/** Weeks between two trees cut by a lumber bringing `perWeek` wood (rounded up), or null when it brings none. */
export function weeksPerCut(perWeek: number): number | null {
  const every = BUILDINGS.lumber.cutEvery ?? 0;
  return perWeek > 0 && every > 0 ? Math.ceil(every / perWeek - 1e-9) : null;
}

export interface Spot extends Cell {
  rotated: boolean;
}

/**
 * Where a building of this kind fits (free land touching the connected roads, silver ignored)
 * with its radius reaching the given building. Both orientations for non-square kinds.
 */
export function spotsServing(s: GameState, kind: BuildableKind, target: Building): Spot[] {
  const r = BUILDINGS[kind].radius ?? 0;
  const out: Spot[] = [];
  for (const rotated of canRotate(kind) ? [false, true] : [false]) {
    const { w, h } = dimsOf(kind, rotated);
    for (const c of placeSpots(s, kind, rotated)) {
      const reachX = c.x - r <= target.x + target.w - 1 && c.x + w - 1 + r >= target.x;
      const reachY = c.y - r <= target.y + target.h - 1 && c.y + h - 1 + r >= target.y;
      if (reachX && reachY) out.push({ ...c, rotated });
    }
  }
  return out;
}

/** Houses (plots included) at each level, index = level (0 plot .. top level). */
export function housesByLevel(s: GameState): number[] {
  const out = HOUSE_LEVELS.map(() => 0);
  for (const b of s.buildings) if (b.kind === 'house') out[b.level]++;
  return out;
}

/**
 * Food that would spoil at once if the building or road at (x, y) were removed: a granary, or a
 * road whose cut disconnects one, lowers what the city can keep (0 when nothing is lost).
 */
export function foodLostIfRemoved(s: GameState, x: number, y: number): number {
  const i = indexOf(s, x, y);
  const b = s.grid[i];
  if ((!b && !s.roads[i]) || s.food <= RULES.baseFoodStorage) return 0;
  if (!s.buildings.some((o) => o.connected && BUILDINGS[o.kind].storage)) return 0;
  // A copy whose buildings are new objects (refreshing it must not touch `connected` in `s`).
  const twin = new Map(s.buildings.map((o) => [o, { ...o }]));
  const copy: GameState = { ...s, roads: [...s.roads], grid: s.grid.map((o) => (o ? twin.get(o)! : o)), buildings: [...twin.values()] };
  if (!clearCell(copy, x, y).ok) return 0;
  return round2(Math.max(0, s.food - foodCapacity(copy)));
}
