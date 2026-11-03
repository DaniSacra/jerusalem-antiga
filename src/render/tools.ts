import { BUILDINGS, type Placeable } from '../core';

export type Tool = 'view' | Placeable | 'clear';

/** Keyboard order (1–9, then 0). */
export const TOOLS: Tool[] = ['view', 'road', 'house', 'field', 'well', 'market', 'workshop', 'garden', 'temple', 'clear'];
/** Left rail (under the speed: the view tools and the garden) and right rail (the main buildings). */
export const RAIL_TOOLS = ['view', 'road', 'garden', 'clear'] as const satisfies readonly Tool[];
export const BUILD_TOOLS = ['house', 'field', 'well', 'market', 'workshop', 'temple'] as const satisfies readonly Placeable[];
export type BuildTool = (typeof BUILD_TOOLS)[number] | 'garden';
export const DRAG_TOOLS: ReadonlySet<Tool> = new Set<Tool>(['road', 'house', 'field', 'clear']);

export const isPlaceTool = (t: Tool): t is Placeable => t !== 'view' && t !== 'clear';
export const toolName = (t: Tool) => ({ view: 'Mover', road: 'Rua', clear: 'Demolir' } as Record<string, string>)[t] ?? BUILDINGS[t as keyof typeof BUILDINGS].name;
