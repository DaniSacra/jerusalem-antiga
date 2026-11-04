import { BUILDINGS, HOUSE_LEVELS } from './data';
import { round2 } from './economy';
import { MATERIALS, type GameState, type Material, type Materials, type Placeable } from './types';

/** Wood and stone a road or building costs on top of its silver (roads cost none). */
export const materialsOf = (kind: Placeable): Materials => (kind === 'road' ? {} : (BUILDINGS[kind].materials ?? {}));

/** Wood and stone a house pays when it climbs to this level (none for a plot or tent). */
export const levelMaterials = (level: number): Materials => HOUSE_LEVELS[level]?.materials ?? {};

/** The first material (wood, then stone) the city has less of than this cost asks, or null. */
export const lackingMaterial = (s: GameState, cost: Materials): Material | null => MATERIALS.find((m) => s[m] < (cost[m] ?? 0)) ?? null;

/** The material the city lacks to build this (for the button, preview and toast), or null. */
export const missingMaterial = (s: GameState, kind: Placeable): Material | null => lackingMaterial(s, materialsOf(kind));

/** Takes a cost out of the city's stock (the caller checked it is there). */
export function payMaterials(s: GameState, cost: Materials): void {
  for (const m of MATERIALS) if (cost[m]) s[m] = round2(s[m] - cost[m]);
}
