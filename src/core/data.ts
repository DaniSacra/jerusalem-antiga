import buildings from '../data/buildings.json';
import houses from '../data/houses.json';
import goals from '../data/goals.json';
import rules from '../data/rules.json';
import type { BuildingDef, BuildingKind, GoalDef, HouseLevelDef, Rules } from './types';

export const BUILDINGS = buildings as Record<BuildingKind, BuildingDef>;
export const HOUSE_LEVELS = houses as unknown as HouseLevelDef[];
export const GOALS = goals as unknown as GoalDef[];
export const RULES = rules as unknown as Rules;
export const MAX_HOUSE_LEVEL = HOUSE_LEVELS.length - 1;
