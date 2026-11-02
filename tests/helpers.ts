import { createGame, createRng, indexOf, updateCoverage, type BuildingKind, type GameState, type Rng } from '../src/core';

/** A fresh game with every non-valley cell as grass, plenty of silver and all buildings unlocked. */
export function emptyGame(overrides: Partial<GameState> = {}): GameState {
  const s = createGame(createRng(1));
  s.terrain = s.terrain.map((t) => (t === 'valley' ? 'valley' : 'grass'));
  s.silver = 10_000;
  s.unlocked = ['house', 'field', 'well', 'market', 'workshop', 'altar'];
  Object.assign(s, overrides);
  return s;
}

export function place(s: GameState, kind: BuildingKind, x: number, y: number, level = 0) {
  s.buildings[indexOf(s, x, y)] = { kind, level, upStreak: 0, downStreak: 0 };
  updateCoverage(s);
  return s.buildings[indexOf(s, x, y)]!;
}

export const constRng = (v: number): Rng => () => v;
