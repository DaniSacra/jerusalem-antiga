import { createGame, createRng, stepWeek, type GameState, type Rng } from '../core';
import { PROFILES, SurvivalBot } from '../../tools/sim/survival';

/** A city of the real simulation, with the generator that keeps playing it. */
export interface City {
  state: GameState;
  rng: Rng;
  seed: number;
}

/**
 * A city made by the real simulation: a new seeded game played by a sim-tester bot for a number of
 * weeks. src/core is used as is; the 3D view only reads the resulting GameState.
 */
export function buildCity(seed: number, weeks: number, bot = 'eficiente'): City {
  const rng = createRng(seed);
  const state = createGame(rng);
  const player = new SurvivalBot(PROFILES[bot] ?? PROFILES.eficiente, createRng(seed * 7919 + 13));
  for (let w = 0; w < weeks && !state.lost; w++) {
    player.act(state);
    stepWeek(state, rng);
  }
  return { state, rng, seed };
}
