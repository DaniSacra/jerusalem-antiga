import { RULES, createGame, createRng, dimsOf, indexOf, place, refreshCity, ROAD_X, type BuildableKind, type GameState, type Rng } from '../src/core';

/**
 * A fresh game with sand everywhere (except the river), no rocks or trees, plenty of silver and
 * everything unlocked. The 4x4 altar covers x, y = 22..25, a road ring surrounds it (x, y = 21..26)
 * and the starting road runs south along x = 24, from the ring (y = 26) to the entrance at (24, 47).
 * Buildings beside the starting road go at y >= 27 so they stay off the ring.
 */
export function emptyGame(overrides: Partial<GameState> = {}): GameState {
  const s = createGame(createRng(1));
  // No caravan: only the altar, and a fixed food stock (tests of the caravan use createGame).
  s.buildings = s.buildings.filter((b) => b.kind === 'altar');
  s.grid = s.grid.map((b) => (b?.kind === 'altar' ? b : null));
  s.food = 30;
  s.ground = s.ground.map((g) => (g === 'river' ? 'river' : 'sand'));
  s.feature = s.feature.map(() => null);
  s.silver = 100_000;
  s.unlocked = ['road', 'house', 'field', 'well', 'market', 'workshop', 'garden', 'temple'];
  s.goalIndex = RULES.upkeepStartsAfterGoal; // upkeep is charged (tests of the first goals set goalIndex)
  Object.assign(s, overrides);
  refreshCity(s);
  return s;
}

/** Places a building (top-left at x, y) without charging silver, optionally at a given house level. */
export function put(s: GameState, kind: BuildableKind, x: number, y: number, level = 0, rotated = false) {
  const silver = s.silver;
  const unlocked = s.unlocked;
  s.silver = 1e9;
  s.unlocked = [kind];
  const r = place(s, kind, x, y, rotated);
  s.silver = silver;
  s.unlocked = unlocked;
  if (!r.ok) throw new Error(`cannot place ${kind} at ${x},${y}: ${r.reason}`);
  const b = s.grid[indexOf(s, x, y)]!;
  b.level = level;
  return b;
}

/** Lays road cells without charging silver. */
export function road(s: GameState, cells: [number, number][]) {
  for (const [x, y] of cells) s.roads[indexOf(s, x, y)] = true;
  refreshCity(s);
}

export const constRng = (v: number): Rng => () => v;
/** The starting road column (x = 24) and its first cell below the altar (y = 26, on the ring). */
export { ROAD_X };
export const ROAD_TOP = 26;
/** Left column of a 2x2 house touching the starting road on its west side (x = 22..23). */
export const ROADSIDE = ROAD_X - 2;
/** Left column of a building of this kind touching the starting road on its west side. */
export const westOf = (kind: BuildableKind) => ROAD_X - dimsOf(kind).w;
/** Left column of any building touching the starting road on its east side. */
export const EAST = ROAD_X + 1;

/**
 * Left column of a 2x2 building at rows y..y+1 that touches the river on its east side (the river
 * runs east of the altar), with a road on row y from the starting road to it.
 */
export function besideRiver(s: GameState, y: number): number {
  const riverAt = (row: number) => {
    let x = ROAD_X + 2;
    while (s.ground[indexOf(s, x, row)] !== 'river') x++;
    return x;
  };
  const left = Math.min(riverAt(y), riverAt(y + 1)) - 2;
  road(s, Array.from({ length: left - ROAD_X - 1 }, (_, k) => [ROAD_X + 1 + k, y] as [number, number]));
  return left;
}
