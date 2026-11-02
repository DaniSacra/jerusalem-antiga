import { BUILDINGS, type Placeable } from '../core';

export type Tool = 'view' | Placeable | 'clear';

export const TOOLS: Tool[] = ['view', 'road', 'house', 'field', 'well', 'market', 'workshop', 'temple', 'clear'];
export const DRAG_TOOLS: ReadonlySet<Tool> = new Set<Tool>(['road', 'house', 'field', 'clear']);

export const isPlaceTool = (t: Tool): t is Placeable => t !== 'view' && t !== 'clear';
export const toolName = (t: Tool) => ({ view: 'Ver', road: 'Rua', clear: 'Limpar' } as Record<string, string>)[t] ?? BUILDINGS[t as keyof typeof BUILDINGS].name;
