import { BUILDINGS, type Placeable } from '../core';

export type Tool = 'view' | Placeable | 'clear';

/** Keyboard order (1–9). */
export const TOOLS: Tool[] = ['view', 'road', 'house', 'field', 'well', 'market', 'workshop', 'temple', 'clear'];
/** Left rail (under the speed) and right rail (the buildings). */
export const RAIL_TOOLS = ['view', 'road', 'clear'] as const satisfies readonly Tool[];
export const BUILD_TOOLS = ['house', 'field', 'well', 'market', 'workshop', 'temple'] as const satisfies readonly Placeable[];
export type BuildTool = (typeof BUILD_TOOLS)[number];
export const DRAG_TOOLS: ReadonlySet<Tool> = new Set<Tool>(['road', 'house', 'field', 'clear']);

export const isPlaceTool = (t: Tool): t is Placeable => t !== 'view' && t !== 'clear';
export const toolName = (t: Tool) => ({ view: 'Ver', road: 'Rua', clear: 'Limpar' } as Record<string, string>)[t] ?? BUILDINGS[t as keyof typeof BUILDINGS].name;
