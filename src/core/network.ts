import { cellOf, borderCells, indexOf, inBounds, neighbors } from './grid';
import type { Building, Cell, GameState } from './types';

/** Road cells reachable from the altar through orthogonal neighbours (altar cell included). */
export function computeNetwork(s: GameState): boolean[] {
  const net = new Array<boolean>(s.cols * s.rows).fill(false);
  const start = indexOf(s, s.altar.x, s.altar.y);
  net[start] = true;
  const queue = [start];
  while (queue.length) {
    const { x, y } = cellOf(s, queue.shift()!);
    for (const n of neighbors(s, x, y)) {
      const i = indexOf(s, n.x, n.y);
      if (!net[i] && s.roads[i]) {
        net[i] = true;
        queue.push(i);
      }
    }
  }
  return net;
}

export const touchesNetwork = (s: GameState, b: Pick<Building, 'x' | 'y' | 'size'>) =>
  borderCells(s, b).some((c) => s.network[indexOf(s, c.x, c.y)]);

export function refreshNetwork(s: GameState): void {
  s.network = computeNetwork(s);
  for (const b of s.buildings) b.connected = b.kind === 'altar' || touchesNetwork(s, b);
}

/** Network cells next to a building, where walkers can stop. */
export const doorsOf = (s: GameState, b: Building): Cell[] => borderCells(s, b).filter((c) => s.network[indexOf(s, c.x, c.y)]);

/** Shortest path over the network (breadth-first) from a network cell to any goal cell. */
export function findPath(s: GameState, from: Cell, goals: Cell[]): Cell[] | null {
  const start = indexOf(s, from.x, from.y);
  if (!inBounds(s, from.x, from.y) || !s.network[start]) return null;
  const goalSet = new Set(goals.map((c) => indexOf(s, c.x, c.y)));
  const prev = new Map<number, number>([[start, -1]]);
  const queue = [start];
  while (queue.length) {
    const i = queue.shift()!;
    if (goalSet.has(i)) {
      const path: Cell[] = [];
      for (let k = i; k !== -1; k = prev.get(k)!) path.unshift(cellOf(s, k));
      return path;
    }
    const { x, y } = cellOf(s, i);
    for (const n of neighbors(s, x, y)) {
      const j = indexOf(s, n.x, n.y);
      if (s.network[j] && !prev.has(j)) {
        prev.set(j, i);
        queue.push(j);
      }
    }
  }
  return null;
}

/** Bitmask of road-like neighbours (road or altar): 1 = N (y-1), 2 = E (x+1), 4 = S (y+1), 8 = W (x-1). */
export function roadMask(s: GameState, x: number, y: number): number {
  const isRoadLike = (cx: number, cy: number) =>
    inBounds(s, cx, cy) && (s.roads[indexOf(s, cx, cy)] || (cx === s.altar.x && cy === s.altar.y));
  return (isRoadLike(x, y - 1) ? 1 : 0) | (isRoadLike(x + 1, y) ? 2 : 0) | (isRoadLike(x, y + 1) ? 4 : 0) | (isRoadLike(x - 1, y) ? 8 : 0);
}
