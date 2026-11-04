import { createGame, createRng, stepMonth, type GameState } from '../core';
import { Bot, BOTS } from '../../tools/sim/bots';

/**
 * A city made by the real simulation: a new seeded game played by a sim-tester bot for a number of
 * months. src/core is used as is; the 3D view only reads the resulting GameState.
 */
export function buildCity(seed: number, months: number, bot = 'eficiente'): GameState {
  const rng = createRng(seed);
  const s = createGame(rng);
  const player = new Bot(s, BOTS[bot] ?? BOTS.eficiente, createRng(seed * 7919 + 13));
  for (let m = 0; m < months && !s.lost; m++) {
    player.act(s);
    stepMonth(s, rng);
  }
  return s;
}
