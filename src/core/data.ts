import buildings from '../data/buildings.json';
import houses from '../data/houses.json';
import goals from '../data/goals.json';
import rules from '../data/rules.json';
import walkers from '../data/walkers.json';
import names from '../data/names.json';
import type { Building, BuildingDef, BuildingKind, BuildingLevelDef, Dims, GoalDef, HouseLevelDef, LevelStat, Rect, Rules, WalkerDef } from './types';

export const BUILDINGS = buildings as Record<BuildingKind, BuildingDef>;
export const HOUSE_LEVELS = houses as unknown as HouseLevelDef[];
export const GOALS = goals as unknown as GoalDef[];
export const RULES = rules as unknown as Rules;
export const WALKERS = walkers as unknown as WalkerDef[];
export const MAX_HOUSE_LEVEL = HOUSE_LEVELS.length - 1;
/** Given names by sex and family names (clans) of the people. */
export const NAMES = names as { male: string[]; female: string[]; clans: string[] };

/**
 * A stat of a building at its level: the value of its level in `levels` when it sets one, else
 * the definition's (level 1). Houses and buildings without levels always read the definition.
 */
export function statOf(b: Pick<Building, 'kind' | 'level'>, key: LevelStat): number {
  const def = BUILDINGS[b.kind];
  const lv = b.kind === 'house' ? undefined : (def.levels?.[b.level - 2] as Partial<Record<LevelStat, number>> | undefined);
  return lv?.[key] ?? def[key] ?? 0;
}

/** The next level of a service building (its cost and stats), or null at the top or with no levels. */
export const nextLevelOf = (b: Pick<Building, 'kind' | 'level'>): BuildingLevelDef | null =>
  (b.kind !== 'house' && BUILDINGS[b.kind].levels?.[b.level - 1]) || null;

/** A new building with no family, look or road yet (houses start as empty plots, the rest at level 1). */
export function newBuilding(id: number, kind: BuildingKind, rect: Rect, built: number): Building {
  return { id, kind, ...rect, level: kind === 'house' ? 0 : 1, upWeeks: RULES.weeksToUpgrade[0], emptyLevel: 0, upStreak: 0, downStreak: 0, connected: false, variant: 0, mirrored: false, built };
}

/** Footprint of a building kind; rotated swaps width and height. */
export function dimsOf(kind: BuildingKind, rotated = false): Dims {
  const w = BUILDINGS[kind].w ?? 1;
  const h = BUILDINGS[kind].h ?? w;
  return rotated ? { w: h, h: w } : { w, h };
}

/** Only buildings with a non-square footprint can be rotated. */
export const canRotate = (kind: BuildingKind) => dimsOf(kind).w !== dimsOf(kind).h;
