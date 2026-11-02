import { BUILDINGS } from './data';
import { cellOf, cellsInRadius } from './grid';
import { SERVICE_KINDS, type Coverage, type GameState, type ServiceKind } from './types';

export function serviceCoverage(s: GameState, kind: ServiceKind): boolean[] {
  const covered = new Array<boolean>(s.cols * s.rows).fill(false);
  const r = BUILDINGS[kind].radius ?? 0;
  s.buildings.forEach((b, i) => {
    if (b?.kind !== kind) return;
    const { x, y } = cellOf(s, i);
    for (const c of cellsInRadius(s, x, y, r)) covered[c] = true;
  });
  return covered;
}

export function computeCoverage(s: GameState): Coverage {
  return Object.fromEntries(SERVICE_KINDS.map((k) => [k, serviceCoverage(s, k)])) as Coverage;
}

export function updateCoverage(s: GameState): void {
  s.coverage = computeCoverage(s);
}
