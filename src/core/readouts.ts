import { BUILDINGS, canRotate, dimsOf, GOALS, HOUSE_LEVELS, newBuilding, RULES, statOf } from './data';
import { clearCell, placeSpots } from './actions';
import { serviceOf } from './coverage';
import { computeEconomy, round2, type Economy } from './economy';
import { birthBlock, type BirthBlock } from './life';
import { roomIn } from './families';
import { ageOf, household, isBirthday, isWalking } from './people';
import { foodForecast, type FoodForecast } from './forecast';
import { currentGoal, goalOpen, goalProgress, goalTarget, yearOf } from './goals';
import { borderCells, cellsInRadius, cellsOf, indexOf } from './grid';
import { fieldHarvest, foodCapacity, gatherYield, isGatherSource, productOf } from './harvest';
import { levelMaterials } from './materials';
import { seasonOf } from './seasons';
import type { BuildableKind, Building, Cell, GameState, Materials, Product, Season } from './types';
import { canWork, crewCounts, seatsOf, staffOf } from './work';

/** Values derived from the state for the interface. Read only: nothing here changes the game. */

/**
 * Silver saved toward the temple, from the goal that unlocks it until it stands (null otherwise):
 * the "Junte 800 para o Templo" line. The silver is never shown below 0 (a city in debt).
 */
export function templeSavings(s: GameState): { silver: number; cost: number } | null {
  if (!s.unlocked.includes('temple') || s.buildings.some((b) => b.kind === 'temple')) return null;
  return { silver: Math.max(0, Math.floor(s.silver)), cost: BUILDINGS.temple.cost };
}

/** What the screen reads about the city, computed once per refresh. */
export interface CityReadout {
  eco: Economy;
  /** `foodForecast` for a year. */
  forecast: FoodForecast;
  /** Why no child can be born (`birthBlock`). */
  births: BirthBlock | null;
}

export function readCity(s: GameState): CityReadout {
  const eco = computeEconomy(s);
  return { eco, forecast: foodForecast(s, eco), births: birthBlock(s, eco) };
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
 * and production; the new coverage is left out). Only the adults without a job take its jobs: with
 * nobody free a workplace pays half (`upkeepPaid`).
 */
export function balanceAfter(s: GameState, kind: BuildableKind): number {
  const ghost = { ...newBuilding(-1, kind, { x: 0, y: 0, w: 1, h: 1 }, 0), connected: true };
  return computeEconomy({ ...s, buildings: [...s.buildings, ghost], people: crewFor(s, ghost) }).silverDelta;
}

/** The people with a new building's jobs taken by the adults without a job (the first by id: who exactly changes nothing). */
function crewFor(s: GameState, ghost: Building): GameState['people'] {
  let left = seatsOf(ghost);
  return s.people.map((p) => (left > 0 && p.jobId == null && canWork(s, p) && left-- ? { ...p, jobId: ghost.id } : p));
}

export interface FoodAfter {
  /** Weekly food balance with the new building (by the crew it would get). */
  delta: number;
  /** What the new building itself brings a week of `product` (by the crew it would get). */
  yields: number;
  /** Food for fields, fishers and gatherers; wood or stone for a lumber or quarry. */
  product: Product;
  /** Share of its jobs the adults without work would fill (1 with no jobs). */
  staff: number;
}

/**
 * Weekly food if one more building of this kind stood at `at`: its own food, made by the crew it
 * would get (only adults without a job take it: nobody is moved). At a spot it works only when it
 * touches the connected roads; with no spot it is taken as connected, and a fisher or gatherer
 * brings nothing (its food depends on the spot).
 */
export function foodAfter(s: GameState, kind: BuildableKind, at?: Spot): FoodAfter {
  const { w, h } = dimsOf(kind, at?.rotated);
  // With no spot the ghost stands off the map: no river or trees around it.
  const { x, y } = at ?? { x: -s.cols, y: -s.rows };
  const connected = !at || borderCells(s, { x, y, w, h }).some((c) => s.network[indexOf(s, c.x, c.y)]);
  const ghost = { ...newBuilding(-1, kind, { x, y, w, h }, s.week), connected };
  const people = crewFor(s, ghost);
  const eco = computeEconomy({ ...s, buildings: [...s.buildings, ghost], people });
  const staff = staffOf(ghost, crewCounts({ ...s, people }));
  const own = round2((gatherYield(s, ghost) + fieldHarvest(s, ghost, s.week)) * staff);
  return { delta: eco.foodDelta, yields: own, product: productOf(kind) ?? 'food', staff };
}

/** Houses with a family inside the radius of a service building; null for kinds with no service. */
export function housesServed(s: GameState, b: Building): number | null {
  if (!serviceOf(b.kind)) return null;
  if (!b.connected) return 0;
  const area = new Set(cellsInRadius(s, b.x, b.y, statOf(b, 'radius'), b.w, b.h));
  return s.buildings.filter((h) => h.kind === 'house' && h.level > 0 && cellsOf(h).some((c) => area.has(indexOf(s, c.x, c.y)))).length;
}

/**
 * What a house gains on its next level (room for more people and base tax) and the materials it
 * pays to climb, or null at the top level.
 */
export function upgradeGain(level: number): { capacity: number; tax: number; materials: Materials } | null {
  const cur = HOUSE_LEVELS[level];
  const next = HOUSE_LEVELS[level + 1];
  return next ? { capacity: next.capacity - cur.capacity, tax: round2(next.tax - cur.tax), materials: levelMaterials(level + 1) } : null;
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
 * Free spots next to the network where a lumber or quarry brings the most (at least
 * `goodGatherShare` of the best, never 0): the "Onde pôr um lenhador / uma pedreira" of a house
 * waiting for material (every spot touches the network, so the ghost counts as connected). Empty
 * for kinds that gather nothing.
 */
export function gatherSpots(s: GameState, kind: BuildableKind): Cell[] {
  const rect = dimsOf(kind);
  const spots = placeSpots(s, kind).map((c) => ({ ...c, n: gatherYield(s, { ...newBuilding(-1, kind, { ...c, ...rect }, s.week), connected: true }) }));
  const best = Math.max(0, ...spots.map((c) => c.n));
  return best > 0 ? spots.filter((c) => c.n >= best * RULES.goodGatherShare).map(({ x, y }) => ({ x, y })) : [];
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
  // No people: demolishing a house in the copy must not send anyone away in `s`.
  const copy: GameState = { ...s, people: [], families: [], roads: [...s.roads], grid: s.grid.map((o) => (o ? twin.get(o)! : o)), buildings: [...twin.values()] };
  if (!clearCell(copy, x, y).ok) return 0;
  return round2(Math.max(0, s.food - foodCapacity(copy)));
}

/** Why the couple of a house can or cannot have a child now (the house balloon's line). */
export type HouseBirths = 'ok' | 'full' | BirthBlock;

/**
 * Whether a married couple living in this house can have a child now: null when there is none (no
 * married couple living together with the wife in the fertile ages). Famine first, then a full
 * house, then the city's food (`birthBlock`). The gap between two children is left out ("ok").
 */
export function houseBirths(s: GameState, b: Building, block: BirthBlock | null = birthBlock(s)): HouseBirths | null {
  if (b.kind !== 'house' || b.level === 0) return null;
  const [min, max] = RULES.people.fertileAges;
  const couple = s.people.some((p) => {
    if (p.sex !== 'f' || p.houseId !== b.id || p.engaged !== null || isWalking(s, p.id)) return false;
    const age = ageOf(p, s.week);
    return age >= min && age <= max && s.people.some((o) => o.id === p.spouseId && o.houseId === b.id && !isWalking(s, o.id));
  });
  if (!couple) return null;
  if (block === 'famine') return 'famine';
  if (roomIn(s, b) <= 0) return 'full';
  return block ?? 'ok';
}

/** A house with people and its family name (the clan of the eldest, as when a family leaves). */
export interface Household {
  house: Building;
  clan: number;
  people: number;
}

/** Houses with people living in them, the fullest first (ties: the oldest house). */
export function householdsOf(s: GameState): Household[] {
  const out: Household[] = [];
  for (const b of s.buildings) {
    if (b.kind !== 'house' || b.level === 0) continue;
    const all = household(s, b.id);
    if (!all.length) continue;
    const eldest = all.reduce((a, p) => (p.birthWeek < a.birthWeek ? p : a));
    out.push({ house: b, clan: eldest.clan, people: all.length });
  }
  return out.sort((a, b) => b.people - a.people || a.house.id - b.house.id);
}

/** The person born in the city who came of age this week (the "virou adulta" milestone), if any. */
export const grownUpThisWeek = (s: GameState) =>
  s.people.find((p) => p.caravan === null && isBirthday(p, s.week) && ageOf(p, s.week) === RULES.people.adultAge) ?? null;
