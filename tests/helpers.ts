import { createGame, createRng, indexOf, place, refreshCity, type BuildableKind, type GameState, type Rng } from '../src/core';

/**
 * A fresh game with sand everywhere (except the river), no rocks or trees, plenty of silver and
 * everything unlocked. The altar is at (16,16) and the starting road runs south along x = 16.
 */
export function emptyGame(overrides: Partial<GameState> = {}): GameState {
  const s = createGame(createRng(1));
  s.ground = s.ground.map((g) => (g === 'river' ? 'river' : 'sand'));
  s.feature = s.feature.map(() => null);
  s.silver = 100_000;
  s.unlocked = ['road', 'house', 'field', 'well', 'market', 'workshop', 'temple'];
  Object.assign(s, overrides);
  refreshCity(s);
  return s;
}

/** Places a building (top-left at x, y) without charging silver, optionally at a given house level. */
export function put(s: GameState, kind: BuildableKind, x: number, y: number, level = 0) {
  const silver = s.silver;
  const unlocked = s.unlocked;
  s.silver = 1e9;
  s.unlocked = [kind];
  const r = place(s, kind, x, y);
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
/** Cells right next to the starting road (x = 15 is west of it). */
export const ROADSIDE = 15;
