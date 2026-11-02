import { BUILDINGS, WALKERS } from './data';
import { cellOf } from './grid';
import { doorsOf, roadMask } from './network';
import type { Building, BuildingKind, Cell, GameState, Rng, WalkerDef, WalkerType } from './types';

/** Where a walker heads: the road cells to reach and the building they belong to, if any. */
export interface WalkerGoal {
  cells: Cell[];
  target: Building | null;
}

const pick = <T>(items: T[], rng: Rng): T | undefined => items[Math.floor(rng() * items.length)];

const connectedOf = (s: GameState, kinds: BuildingKind[]) =>
  s.buildings.filter((b) => b.connected && kinds.includes(b.kind) && doorsOf(s, b).length > 0);

const defOf = (type: WalkerType): WalkerDef => WALKERS.find((w) => w.type === type)!;

/** A type is available when, for each kind it needs, a connected building exists ("to" needs just one of its kinds). */
export function walkerTypesAvailable(s: GameState): WalkerType[] {
  return WALKERS.filter((def) => {
    if (def.from && connectedOf(s, [def.from]).length === 0) return false;
    return !Array.isArray(def.to) || connectedOf(s, def.to).length > 0;
  }).map((d) => d.type);
}

export const pickWalkerType = (s: GameState, rng: Rng): WalkerType | undefined => pick(walkerTypesAvailable(s), rng);

/** Connected road cells people walk on. */
const walkableCells = (s: GameState): Cell[] =>
  s.roads.flatMap((r, i) => (r && s.network[i] ? [cellOf(s, i)] : []));

/** Main roads: junctions (3 or 4 arms) and the starting road down to the entrance. */
export function mainRoadCells(s: GameState): Cell[] {
  const mask = (c: Cell) => roadMask(s, c.x, c.y);
  const arms = (m: number) => [1, 2, 4, 8].filter((bit) => m & bit).length;
  return walkableCells(s).filter((c) => c.x === s.entrance.x || arms(mask(c)) >= 3);
}

/** The few connected road cells farthest from the altar: the edge of the city. */
export function edgeCells(s: GameState, count = 5): Cell[] {
  const a = s.altar;
  const dist = (c: Cell) => Math.max(Math.abs(c.x - a.x), Math.abs(c.y - a.y));
  return walkableCells(s)
    .sort((p, q) => dist(q) - dist(p))
    .slice(0, count);
}

/** Door cells of a random connected building of the given kinds. */
function doorsOfAny(s: GameState, kinds: BuildingKind[], rng: Rng): WalkerGoal | null {
  const b = pick(connectedOf(s, kinds), rng);
  return b ? { cells: doorsOf(s, b), target: b } : null;
}

const ANY: BuildingKind[] = Object.keys(BUILDINGS) as BuildingKind[];

const cellGoal = (cells: Cell[] | null): WalkerGoal | null => (cells ? { cells, target: null } : null);

/**
 * Goal for a walker of this type: road cells (any of them ends the walk) and the building they
 * lead to (null for main roads and the city edge). Types with a "from" building go back there on
 * return legs (`back`). Falls back to a random connected building when the usual destination does
 * not exist.
 */
export function walkerGoal(s: GameState, type: WalkerType, rng: Rng, back = false): WalkerGoal | null {
  const { to, from } = defOf(type);
  let goal: WalkerGoal | null = null;
  if (back && from) goal = doorsOfAny(s, [from], rng);
  else if (Array.isArray(to)) goal = doorsOfAny(s, to, rng);
  else if (to === 'mainRoad') goal = cellGoal(pickCell(mainRoadCells(s), rng));
  else if (to === 'edge') goal = cellGoal(pickCell(edgeCells(s), rng));
  return goal?.cells.length ? goal : doorsOfAny(s, ANY, rng);
}

const pickCell = (cells: Cell[], rng: Rng) => {
  const c = pick(cells, rng);
  return c ? [c] : null;
};

/** Where a new walker of this type appears: at a building of its "from" kind, else at a home. */
export function walkerStart(s: GameState, type: WalkerType, rng: Rng): Cell | null {
  const from = defOf(type).from;
  const places = from ? connectedOf(s, [from]) : connectedOf(s, ['house']).filter((b) => b.level > 0);
  const place = pick(places, rng);
  return place ? (pick(doorsOf(s, place), rng) ?? null) : null;
}

export const walkerDef = defOf;
