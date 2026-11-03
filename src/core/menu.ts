import { BUILDINGS, RULES } from './data';
import type { BuildableKind, BuildingCategory } from './types';

/** Category order in the build menu. */
export const CATEGORIES: readonly BuildingCategory[] = ['home', 'supply', 'work', 'special'];

export type BuildMenu =
  | { mode: 'list'; items: BuildableKind[] }
  | { mode: 'categories'; groups: { category: BuildingCategory; items: BuildableKind[] }[] };

/**
 * The build menu for these buildings (in the given order): a flat list while they fit, else one
 * group per category (in `CATEGORIES` order, empty ones left out), each keeping the given order.
 */
export function buildMenu(kinds: readonly BuildableKind[], max = RULES.toolColumnMax): BuildMenu {
  if (kinds.length <= max) return { mode: 'list', items: [...kinds] };
  const groups = CATEGORIES.map((category) => ({ category, items: kinds.filter((k) => BUILDINGS[k].category === category) }));
  return { mode: 'categories', groups: groups.filter((g) => g.items.length > 0) };
}
