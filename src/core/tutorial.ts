import TUTORIAL from '../data/tutorial.json';
import { isFreeLand } from './actions';
import { BUILDINGS, dimsOf, RULES } from './data';
import { cellsInRadius, cellsOf, indexOf } from './grid';
import type { BuildableKind, Building, Cell, GameState, Placeable } from './types';

export type TutorialStepId = 'well' | 'road' | 'gather' | 'field' | 'house' | 'family' | 'upkeep' | 'market';
export interface TutorialStep {
  id: TutorialStepId;
  /** The tool allowed during the step (null: just watch, or tap). */
  tool: Placeable | null;
  /** A second tool the step also allows (the gatherer beside the fisher). */
  alt?: Placeable;
  target: number;
}

/** The six steps of the first game, then the two short ones (balance at goal 2, then the market). */
export const TUTORIAL_STEPS = TUTORIAL.steps as TutorialStep[];
export const TUTORIAL_EXTRAS = TUTORIAL.extras as TutorialStep[];

/** What the tutorial remembers when a step starts (to count new road cells and houses). */
export interface TutorialMark {
  roads: number;
  houses: number;
}

const networkRoads = (s: GameState) => s.network.filter(Boolean).length;
const connected = (s: GameState, kind: BuildableKind, minLevel = 0) =>
  s.buildings.filter((b) => b.kind === kind && b.connected && b.level >= minLevel).length;

export const markTutorial = (s: GameState): TutorialMark => ({ roads: networkRoads(s), houses: connected(s, 'house') });

/** Progress of a step toward its target; the step is done once it reaches it. */
export function tutorialProgress(s: GameState, step: TutorialStep, mark: TutorialMark): number {
  switch (step.id) {
    case 'road':
      return networkRoads(s) - mark.roads;
    case 'gather':
      return connected(s, 'fisher') + connected(s, 'gatherer');
    case 'house':
      return connected(s, 'house') - mark.houses;
    case 'family':
      return s.milestones.includes('firstFamily') ? 1 : 0;
    case 'field':
    case 'well':
    case 'market':
      return connected(s, step.id);
    case 'upkeep':
      return 0; // done by a tap on the screen
  }
}

export const tutorialStepDone = (s: GameState, step: TutorialStep, mark: TutorialMark) => tutorialProgress(s, step, mark) >= step.target;

/**
 * A suggested road of `ghostLength` cells leaving the altar's ring straight out (west, north, east
 * or south of the ring), toward the river or the nearest trees: of the lines whose cells are all
 * free, the one ending closest to a river or tree cell. Empty if none is free.
 */
export function ghostRoad(s: GameState): Cell[] {
  const { x: ax, y: ay } = RULES.map.altar;
  const { w, h } = dimsOf('altar');
  const mid = { x: ax + Math.floor(w / 2) - 1, y: ay + Math.floor(h / 2) - 1 };
  const n = TUTORIAL.ghostLength;
  const lines: Cell[][] = [
    Array.from({ length: n }, (_, k) => ({ x: ax - 2 - k, y: mid.y })),
    Array.from({ length: n }, (_, k) => ({ x: mid.x, y: ay - 2 - k })),
    Array.from({ length: n }, (_, k) => ({ x: ax + w + 1 + k, y: mid.y })),
    Array.from({ length: n }, (_, k) => ({ x: mid.x + 2, y: ay + h + 1 + k })),
  ];
  const free = lines.filter((line) => line.every((c) => isFreeLand(s, c.x, c.y)));
  const goals: Cell[] = [];
  for (let i = 0; i < s.ground.length; i++) {
    if (s.ground[i] === 'river' || s.feature[i] === 'olive' || s.feature[i] === 'palm') goals.push({ x: i % s.cols, y: Math.floor(i / s.cols) });
  }
  const reach = (line: Cell[]) => {
    const end = line[line.length - 1];
    return Math.min(Infinity, ...goals.map((g) => Math.max(Math.abs(g.x - end.x), Math.abs(g.y - end.y))));
  };
  return free.reduce<Cell[] | null>((best, line) => (!best || reach(line) < reach(best) ? line : best), null) ?? [];
}

/** Houses with a family that a service of this kind placed at (x, y) would reach. */
export function servedHouses(s: GameState, kind: BuildableKind, x: number, y: number, rotated = false): Building[] {
  const r = BUILDINGS[kind].radius;
  if (!r) return [];
  const { w, h } = dimsOf(kind, rotated);
  const area = new Set(cellsInRadius(s, x, y, r, w, h));
  return s.buildings.filter((b) => b.kind === 'house' && b.level >= 1 && cellsOf(b).some((c) => area.has(indexOf(s, c.x, c.y))));
}
