import { RULES, statOf } from './data';
import { cellsInRadius } from './grid';
import { altarRadius, templeDone } from './temple';
import { SERVICE_KINDS, type BuildingKind, type Coverage, type GameState, type ServiceKind } from './types';

/** Building kinds that provide each service. */
export const SERVICE_SOURCES: Record<ServiceKind, BuildingKind[]> = {
  plaza: ['plaza'],
  market: ['market'],
  sacred: ['altar', 'temple'],
  park: ['park'],
};

export const serviceOf = (kind: BuildingKind): ServiceKind | null =>
  SERVICE_KINDS.find((k) => SERVICE_SOURCES[k].includes(kind)) ?? null;

/**
 * Cells covered by connected buildings of a service (radius measured from any footprint cell). A
 * `staffedServices` building (the market) covers nothing while nobody works there, nor the Temple
 * before its consecration, nor the altar while in ruins or without its offering (`altarRadius`).
 */
export function serviceCoverage(s: GameState, service: ServiceKind): boolean[] {
  const covered = new Array<boolean>(s.cols * s.rows).fill(false);
  for (const b of s.buildings) {
    if (!b.connected || !SERVICE_SOURCES[service].includes(b.kind)) continue;
    if (RULES.staffedServices.includes(b.kind) && !s.people.some((p) => p.jobId === b.id)) continue;
    // The Temple covers only once consecrated; the altar only restored and with its offering this week.
    if (b.kind === 'temple' && !templeDone(s)) continue;
    const radius = b.kind === 'altar' ? altarRadius(s) : statOf(b, 'radius');
    if (!radius) continue;
    for (const c of cellsInRadius(s, b.x, b.y, radius, b.w, b.h)) covered[c] = true;
  }
  return covered;
}

export function computeCoverage(s: GameState): Coverage {
  return Object.fromEntries(SERVICE_KINDS.map((k) => [k, serviceCoverage(s, k)])) as Coverage;
}
