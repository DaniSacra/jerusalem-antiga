import { computeCoverage } from './coverage';
import { refreshNetwork } from './network';
import type { GameState } from './types';
import { assignJobs } from './work';

/** Recomputes road connections, the jobs (`assignJobs`) and service coverage after any change to the city. */
export function refreshCity(s: GameState): void {
  refreshNetwork(s);
  assignJobs(s);
  s.coverage = computeCoverage(s);
}
