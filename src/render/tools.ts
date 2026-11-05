import { BUILDINGS, CATEGORIES, type BuildableKind, type BuildingCategory, type Placeable } from '../core';

export type Tool = 'view' | Placeable | 'clear';

/** Game speeds, in the order the speed button (and Space) cycles through them. */
export const SPEEDS = [1, 3, 0] as const;
export type Speed = (typeof SPEEDS)[number];

/** The build column order (top to bottom), grouped by category in `CATEGORIES` order. */
export const COLUMN_ORDER: readonly BuildableKind[] = ['house', 'plaza', 'park', 'field', 'fisher', 'gatherer', 'granary', 'lumber', 'quarry', 'market', 'workshop', 'temple'];

/** PC keys: 1 Mover, 2 Rua, 0 Demolir; 3–6 the categories (the same key again: the next building of it). */
export const TOOL_KEYS: Partial<Record<Tool, string>> = { view: '1', road: '2', clear: '0' };
export const CATEGORY_KEYS: Record<BuildingCategory, string> = Object.fromEntries(CATEGORIES.map((c, k) => [c, String(k + 3)])) as Record<BuildingCategory, string>;

/** Key shown for a tool: its own, or its category's for a building. */
export const keyOf = (t: Tool): string => TOOL_KEYS[t] ?? CATEGORY_KEYS[BUILDINGS[t as BuildableKind].category!];

/** Buildings of a category, in column order. */
export const categoryKinds = (c: BuildingCategory) => COLUMN_ORDER.filter((k) => BUILDINGS[k].category === c);

/** Tools that act along a drag (one cell after another). Only Rua: the game is about survival, not painting the map; every other tool acts once, where it is released. */
export const DRAG_TOOLS: ReadonlySet<Tool> = new Set<Tool>(['road']);

export const isPlaceTool = (t: Tool): t is Placeable => t !== 'view' && t !== 'clear';
export const toolName = (t: Tool) => ({ view: 'Mover', road: 'Rua', clear: 'Demolir' } as Record<string, string>)[t] ?? BUILDINGS[t as keyof typeof BUILDINGS].name;
