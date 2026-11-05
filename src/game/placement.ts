import {
  dimsOf,
  fieldHarvest,
  foodCapacity,
  inBounds,
  indexOf,
  isTree,
  placeSize,
  type Building,
  type Cell,
  type Dims,
  type GameState,
  type MilestoneId,
} from '../core';
import VISUAL from '../data/visual.json';
import { T } from './strings';
import { isPlaceTool, type Tool } from './tools';

/** Where on the map things go, the same for every view (pure: no Phaser, Three or DOM). */

export const sameCell = (a: Cell | null, b: Cell | null) => !!a && !!b && a.x === b.x && a.y === b.y;

/** Footprint of a tool (1x1 for Mover and Demolir). */
export const toolDims = (kind: Tool, rotated = false): Dims => (isPlaceTool(kind) ? placeSize(kind, rotated) : { w: 1, h: 1 });

/** Origin (top-left) of a footprint centered on the hovered cell. */
export function originFor(kind: Tool, cell: Cell, rotated = false): Cell {
  const { w, h } = toolDims(kind, rotated);
  return { x: cell.x - Math.floor((w - 1) / 2), y: cell.y - Math.floor((h - 1) / 2) };
}

/** Cells from a to b (excluding a), stepping orthogonally so dragged roads stay connected. */
export function orthoSteps(a: Cell, b: Cell): Cell[] {
  const out: Cell[] = [];
  let { x, y } = a;
  while (x !== b.x || y !== b.y) {
    if (Math.abs(b.x - x) >= Math.abs(b.y - y)) x += Math.sign(b.x - x);
    else y += Math.sign(b.y - y);
    out.push({ x, y });
  }
  return out;
}

/** Why a tool cannot be used at origin `o`: the first thing in the way (more precise than "invalid"). */
export function whyInvalid(s: GameState, tool: Tool, o: Cell, rotated = false): string {
  const B = T.blocked;
  if (tool === 'clear') {
    if (!inBounds(s, o.x, o.y)) return B.edge;
    return s.feature[indexOf(s, o.x, o.y)] === 'rock' ? B.rockClear : B.nothing;
  }
  const { w, h } = isPlaceTool(tool) && tool !== 'road' ? dimsOf(tool, rotated) : { w: 1, h: 1 };
  const reasons: string[] = [];
  for (let y = o.y; y < o.y + h; y++)
    for (let x = o.x; x < o.x + w; x++) {
      if (!inBounds(s, x, y)) return B.edge;
      const i = indexOf(s, x, y);
      if (s.grid[i] || s.roads[i]) reasons.push(B.taken);
      else if (s.ground[i] === 'river') reasons.push(B.river);
      else if (s.feature[i] === 'rock') reasons.push(B.rock);
      else if (isTree(s.feature[i])) reasons.push(B.tree);
    }
  return reasons[0] ?? T.fail.invalid;
}

const STOCK_STEPS = VISUAL.moments.granaryStock;

/** How full the granaries look: 0 (empty) to the number of thresholds (full). */
export function granaryStock(s: GameState): number {
  const f = s.food / Math.max(1, foodCapacity(s));
  const k = STOCK_STEPS.findIndex((t) => f < t);
  return k < 0 ? STOCK_STEPS.length : k;
}

/**
 * Where a milestone is celebrated: the house that just rose (from this week's `houseUp` events, by
 * level), the first field that harvests, else the altar (first winter, first year without hunger).
 */
export function milestoneSite(s: GameState, id: MilestoneId, ups: ReadonlyMap<number, Cell>): Building {
  const altar = s.buildings.find((b) => b.kind === 'altar')!;
  const level = id === 'firstWedding' ? 1 : id === 'firstMud' ? 2 : id === 'firstStone' ? 3 : 0;
  const cell = level ? ups.get(level) : undefined;
  const house = cell && s.grid[indexOf(s, cell.x, cell.y)];
  if (house) return house;
  // The simulation has already moved to the next week when the event arrives.
  if (id === 'firstHarvest') return s.buildings.find((b) => b.kind === 'field' && fieldHarvest(s, b, s.week - 1) > 0) ?? altar;
  return altar;
}

/** Where spoiling food shows: the first connected granary, else the altar (the open stores). */
export const spoilSite = (s: GameState): Building =>
  s.buildings.find((b) => b.kind === 'granary' && b.connected) ?? s.buildings.find((b) => b.kind === 'altar')!;
