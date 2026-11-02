import { computeCoverage } from './coverage';
import { RULES } from './data';
import { generateTerrain } from './map';
import type { GameState, Rng } from './types';

export function createGame(rng: Rng): GameState {
  const { cols, rows } = RULES.map;
  const s: GameState = {
    cols,
    rows,
    terrain: generateTerrain(rng),
    buildings: new Array(cols * rows).fill(null),
    coverage: { well: [], market: [], altar: [] },
    silver: RULES.startSilver,
    food: RULES.startFood,
    month: 0,
    famine: false,
    goalIndex: 0,
    unlocked: [...RULES.startUnlocked],
    won: false,
  };
  s.coverage = computeCoverage(s);
  return s;
}
