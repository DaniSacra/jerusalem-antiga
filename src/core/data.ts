import buildings from '../data/buildings.json';
import houses from '../data/houses.json';
import goals from '../data/goals.json';
import rules from '../data/rules.json';
import type { BuildingDef, BuildingKind, Dims, GoalDef, HouseLevelDef, Rules } from './types';

export const BUILDINGS = buildings as Record<BuildingKind, BuildingDef>;
export const HOUSE_LEVELS = houses as unknown as HouseLevelDef[];
export const GOALS = goals as unknown as GoalDef[];
export const RULES = rules as unknown as Rules;
export const MAX_HOUSE_LEVEL = HOUSE_LEVELS.length - 1;

/** Footprint of a building kind; rotated swaps width and height. */
export function dimsOf(kind: BuildingKind, rotated = false): Dims {
  const w = BUILDINGS[kind].w ?? 1;
  const h = BUILDINGS[kind].h ?? w;
  return rotated ? { w: h, h: w } : { w, h };
}

/** Only buildings with a non-square footprint can be rotated. */
export const canRotate = (kind: BuildingKind) => dimsOf(kind).w !== dimsOf(kind).h;
