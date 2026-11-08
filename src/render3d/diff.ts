import type { GameState } from '../core';
import { haulJobs } from './haul';
import { residentsOf, stockLevel } from './plan';
import { roadLevel, roadTraffic, sacredOf } from './roads';
import { siteKey } from './works';
import { herdKey } from './ambient';

/**
 * What changed in the drawn city since the last look, as cheap keys (pure, no Three.js). The live
 * 3D world rebuilds only the layers whose key changed: buildings, the ground props (roads, trees,
 * stumps), or one of the three kinds of people walking (the walkers, the families on their way, the
 * workers out). People are carried over a rebuild: who stays keeps its place and way (life.ts,
 * figures.ts). Ground and river never change.
 */
export interface CityKeys {
  /** Every building's id, kind, level, kept level, variant, size and connection, how full the granaries look, the Temple's works and the pastures' flocks. */
  buildings: string;
  /** Roads (with their look by traffic, dashed off the network), trees, rocks and stumps (with the saplings growing on them, by regrowth step). */
  props: string;
  /** The walkers of the streets: the road network and the number of residents (in fives). */
  walkers: string;
  /** The families and caravans on their way home (each one's id: they walk by the core's step). */
  families: string;
  /** The workers out (haul.ts): carriers, fishers, gatherers and builders, by job and building. */
  haulers: string;
}

/** Every layer, in the order they are drawn again. */
export const LAYERS = ['buildings', 'props', 'walkers', 'families', 'haulers'] as const;
export type CityLayer = (typeof LAYERS)[number];
/** The layers of people (drawn again once the city is quiet, see `Stage.rebuild`). */
export const PEOPLE: readonly CityLayer[] = ['walkers', 'families', 'haulers'];

export function cityKeys(s: GameState): CityKeys {
  const buildings = s.buildings.map((b) => `${b.id}:${b.kind}:${b.level}:${b.emptyLevel}:${b.variant}${b.mirrored ? 'm' : ''}:${b.x},${b.y},${b.w},${b.h}:${b.connected ? 1 : 0}`).join('|') + `|stock:${stockLevel(s)}|works:${siteKey(s)}|herd:${herdKey(s)}`;
  let props = '';
  // A road is its look (0 trail, 1 road, 2 kerbed; 'x' off the network: dashed), else the feature's name or '-'.
  const traffic = roadTraffic(s);
  const sacred = sacredOf(s);
  for (let i = 0; i < s.roads.length; i++) props += s.roads[i] ? (!s.network[i] ? 'x' : roadLevel(s, traffic, i % s.cols, Math.floor(i / s.cols), sacred)) : (s.feature[i] ?? '-');
  // Saplings grow on stumps over time: a step of the regrowth changes the key a few times, not every week.
  props += '|' + s.stumps.map((t) => `${t.i}:${Math.floor((s.week - t.week) / 13)}`).join(',');
  let net = 0;
  for (let i = 0; i < s.network.length; i++) if (s.network[i]) net = (net * 31 + i) | 0;
  const haul = haulJobs(s).map((j) => `${j.job[0]}${j.home}`).join(',');
  return { buildings, props, walkers: `${net}:${Math.round(residentsOf(s) / 5)}`, families: s.families.map((f) => f.id).join(','), haulers: haul };
}

/** The layers that differ between two looks at the city. */
export function changedLayers(a: CityKeys | null, b: CityKeys): CityLayer[] {
  if (!a) return [...LAYERS];
  return LAYERS.filter((k) => a[k] !== b[k]);
}
