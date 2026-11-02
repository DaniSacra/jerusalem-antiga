import { BUILDINGS } from './data';
import { cellsInRadius } from './grid';
import { SERVICE_KINDS, type BuildingKind, type Coverage, type GameState, type ServiceKind } from './types';

/** Building kinds that provide each service. */
export const SERVICE_SOURCES: Record<ServiceKind, BuildingKind[]> = {
  well: ['well'],
  market: ['market'],
  sacred: ['altar', 'temple'],
  garden: ['garden'],
};

export const serviceOf = (kind: BuildingKind): ServiceKind | null =>
  SERVICE_KINDS.find((k) => SERVICE_SOURCES[k].includes(kind)) ?? null;

/** Cells covered by connected buildings of a service (radius measured from any footprint cell). */
export function serviceCoverage(s: GameState, service: ServiceKind): boolean[] {
  const covered = new Array<boolean>(s.cols * s.rows).fill(false);
  for (const b of s.buildings) {
    if (!b.connected || !SERVICE_SOURCES[service].includes(b.kind)) continue;
    for (const c of cellsInRadius(s, b.x, b.y, BUILDINGS[b.kind].radius ?? 0, b.w, b.h)) covered[c] = true;
  }
  return covered;
}

export function computeCoverage(s: GameState): Coverage {
  return Object.fromEntries(SERVICE_KINDS.map((k) => [k, serviceCoverage(s, k)])) as Coverage;
}
