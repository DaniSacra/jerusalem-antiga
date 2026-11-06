import TUTORIAL from '../data/tutorial.json';
import { isFreeLand, placeSpots, roadDistances } from './actions';
import { BUILDINGS, dimsOf, RULES } from './data';
import { borderCells, cellsInRadius, cellsOf, footprint, inBounds, indexOf } from './grid';
import { isGatherSource } from './harvest';
import type { BuildableKind, Building, Cell, GameState, Placeable } from './types';

export type TutorialStepId = 'road' | 'gather' | 'field' | 'house' | 'wedding' | 'lumber' | 'market';
export interface TutorialStep {
  id: TutorialStepId;
  /** The tool the step points at (null: just watch, or tap). Every tool stays usable. */
  tool: Placeable | null;
  /** A second tool the step also points at (the gatherer beside the fisher). */
  alt?: Placeable;
  target: number;
}

/**
 * The six steps of the first game (food first: road, fisher or gatherer, field; then plaza, house,
 * wedding), the short lumber step right after them, then the short market one.
 */
export const TUTORIAL_STEPS = TUTORIAL.steps as TutorialStep[];
export const TUTORIAL_EXTRAS = TUTORIAL.extras as TutorialStep[];

/** What the tutorial remembers when a step starts (to count new road cells and houses). */
export interface TutorialMark {
  roads: number;
  houses: number;
  /** The suggested road when the step started. */
  ghost: Cell[];
  /** Week the step started (the wedding step ends by itself after `weddingStepMaxWeeks`). */
  week: number;
}

const networkRoads = (s: GameState) => s.network.filter(Boolean).length;
const connected = (s: GameState, kind: BuildableKind, minLevel = 0) =>
  s.buildings.filter((b) => b.kind === kind && b.connected && b.level >= minLevel).length;

export const markTutorial = (s: GameState): TutorialMark => ({ roads: networkRoads(s), houses: connected(s, 'house'), ghost: ghostRoad(s), week: s.week });

/** Progress of a step toward its target; the step is done once it reaches it. */
export function tutorialProgress(s: GameState, step: TutorialStep, mark: TutorialMark): number {
  switch (step.id) {
    case 'road': {
      // Done once the suggested road is built, or as many new road cells elsewhere.
      const built = mark.ghost.every((c) => s.roads[indexOf(s, c.x, c.y)]);
      return built || networkRoads(s) - mark.roads >= mark.ghost.length ? 1 : 0;
    }
    case 'gather':
      return connected(s, 'fisher') + connected(s, 'gatherer');
    case 'house':
      return connected(s, 'house') - mark.houses;
    case 'wedding':
      // The first couple moves into its house, or enough weeks waiting.
      return s.milestones.includes('firstWedding') || s.week - mark.week >= TUTORIAL.weddingStepMaxWeeks ? 1 : 0;
    case 'field':
    case 'lumber':
    case 'market':
      return connected(s, step.id);
  }
}

/** The clock stands still on a build step (the player reads and builds without hurry); it runs on a step that waits on the city. */
export const tutorialHoldsClock = (step: TutorialStep | null) => !!step?.tool;

export const tutorialStepDone = (s: GameState, step: TutorialStep, mark: TutorialMark) => tutorialProgress(s, step, mark) >= step.target;

/** Where the tutorial sends the player for food (fisher or gatherer) or wood (lumber), and the road to it. */
export interface FoodSpot {
  kind: 'fisher' | 'gatherer' | 'lumber';
  /** Top-left cell of the building. */
  x: number;
  y: number;
  /** What it brings a week once connected (before the worker efficiency): food, or wood for a lumber. */
  food: number;
  /** Road cells to build, from the network to the cell beside the building (empty when it already touches it). */
  road: Cell[];
}

/**
 * The best food spot for the start: of the fisher and gatherer spots on free land that bring at
 * least `minSpotFood` a week, the one that brings the most, and of those the one with the shortest
 * new road. Null when no spot brings enough or none can be reached.
 */
export const foodSpot = (s: GameState): FoodSpot | null => gatherSpot(s, ['fisher', 'gatherer']);

/** The lumber step's spot: the same search as `foodSpot`, for a lumber among the trees. */
export const lumberSpot = (s: GameState): FoodSpot | null => gatherSpot(s, ['lumber']);

function gatherSpot(s: GameState, kinds: readonly FoodSpot['kind'][]): FoodSpot | null {
  const { dist, prev } = roadDistances(s);
  let best: (FoodSpot & { end: number }) | null = null;
  for (const kind of kinds) {
    const g = BUILDINGS[kind].gather!;
    const { w, h } = dimsOf(kind);
    for (let y = 0; y + h <= s.rows; y++) {
      for (let x = 0; x + w <= s.cols; x++) {
        const rect = { x, y, w, h };
        if (!footprint(x, y, w, h).every((c) => isFreeLand(s, c.x, c.y))) continue;
        const food = Math.min(g.max, cellsInRadius(s, x, y, g.radius, w, h).filter((i) => isGatherSource(s, i, g.source)).length * g.perCell);
        if (food < TUTORIAL.minSpotFood) continue;
        let end = -1;
        for (const c of borderCells(s, rect)) {
          if (!inBounds(s, c.x, c.y)) continue;
          const i = indexOf(s, c.x, c.y);
          if (dist[i] >= 0 && (end < 0 || dist[i] < dist[end])) end = i;
        }
        if (end < 0) continue;
        if (best && (food < best.food || (food === best.food && dist[end] >= dist[best.end]))) continue;
        best = { kind, x, y, food, road: [], end };
      }
    }
  }
  if (!best) return null;
  const road: Cell[] = [];
  for (let i = best.end; dist[i] > 0; i = prev[i]) road.unshift({ x: i % s.cols, y: Math.floor(i / s.cols) });
  const { end: _end, ...spot } = best;
  return { ...spot, road };
}

/** The suggested road of the tutorial: the road to `foodSpot` (empty when there is none to build). */
export const ghostRoad = (s: GameState): Cell[] => foodSpot(s)?.road ?? [];

/**
 * Where the tutorial arrow suggests the house: the free plot touching the network nearest the
 * altar (a tent needs only its road; the green spots of the house step are all of `placeSpots`).
 * Null when there is none.
 */
export const houseHint = (s: GameState): Cell | null => nearestAltar(placeSpots(s, 'house'));

/** Where the tutorial camera goes on the field step: the free field spot touching the network nearest the altar. */
export const fieldHint = (s: GameState): Cell | null => nearestAltar(placeSpots(s, 'field'));

/** Of these cells, the one nearest the altar (Manhattan distance; the first on ties). */
function nearestAltar(cells: Cell[]): Cell | null {
  const a = RULES.map.altar;
  const d = (c: Cell) => Math.abs(c.x - a.x) + Math.abs(c.y - a.y);
  return cells.reduce<Cell | null>((best, c) => (!best || d(c) < d(best) ? c : best), null);
}

/** Houses with a family that a service of this kind placed at (x, y) would reach. */
export function servedHouses(s: GameState, kind: BuildableKind, x: number, y: number, rotated = false): Building[] {
  const r = BUILDINGS[kind].radius;
  if (!r) return [];
  const { w, h } = dimsOf(kind, rotated);
  const area = new Set(cellsInRadius(s, x, y, r, w, h));
  return s.buildings.filter((b) => b.kind === 'house' && b.level >= 1 && cellsOf(b).some((c) => area.has(indexOf(s, c.x, c.y))));
}
