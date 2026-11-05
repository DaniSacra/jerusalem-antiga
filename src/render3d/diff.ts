import type { GameState } from '../core';
import { haulJobs } from './haul';
import { residentsOf } from './plan';

/**
 * What changed in the drawn city since the last look, as cheap keys (pure, no Three.js). The live
 * 3D world rebuilds only the layers whose key changed: buildings, the ground props (roads, trees,
 * stumps) or the people walking. Ground and river never change.
 */
export interface CityKeys {
  /** Every building's id, kind, level, kept level, variant, size and connection. */
  buildings: string;
  /** Roads, trees, rocks and stumps (with the saplings growing on them, by regrowth step). */
  props: string;
  /** Who walks: the road network, the number of residents and the food workers out (haul.ts). */
  people: string;
}

export function cityKeys(s: GameState): CityKeys {
  const buildings = s.buildings.map((b) => `${b.id}:${b.kind}:${b.level}:${b.emptyLevel}:${b.variant}:${b.x},${b.y},${b.w},${b.h}:${b.connected ? 1 : 0}`).join('|');
  let props = '';
  // 'R' a road, else the feature's name or '-' (a set of words where none starts another: no separator needed).
  for (let i = 0; i < s.roads.length; i++) props += s.roads[i] ? 'R' : (s.feature[i] ?? '-');
  // Saplings grow on stumps over time: a step of the regrowth changes the key a few times, not every week.
  props += '|' + s.stumps.map((t) => `${t.i}:${Math.floor((s.week - t.week) / 13)}`).join(',');
  let net = 0;
  for (let i = 0; i < s.network.length; i++) if (s.network[i]) net = (net * 31 + i) | 0;
  const haul = haulJobs(s).map((j) => `${j.job[0]}${j.home}`).join(',');
  const people = `${net}:${Math.round(residentsOf(s) / 5)}:${s.families.length}:${haul}`;
  return { buildings, props, people };
}

/** The layers that differ between two looks at the city. */
export function changedLayers(a: CityKeys | null, b: CityKeys): (keyof CityKeys)[] {
  if (!a) return ['buildings', 'props', 'people'];
  return (['buildings', 'props', 'people'] as const).filter((k) => a[k] !== b[k]);
}
