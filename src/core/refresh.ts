import { computeCoverage } from './coverage';
import { refreshNetwork } from './network';
import type { GameState } from './types';

/** Recomputes road connections and service coverage after any change to the map. */
export function refreshCity(s: GameState): void {
  refreshNetwork(s);
  s.coverage = computeCoverage(s);
}
