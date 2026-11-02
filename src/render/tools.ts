import { BUILDINGS, type BuildingKind } from '../core';
import { T } from './strings';

export type Tool = 'view' | BuildingKind | 'clear';

export const TOOLS: Tool[] = ['view', 'house', 'field', 'well', 'market', 'workshop', 'altar', 'clear'];
export const DRAG_TOOLS: ReadonlySet<Tool> = new Set<Tool>(['house', 'field', 'clear']);

export const isBuildTool = (t: Tool): t is BuildingKind => t !== 'view' && t !== 'clear';
export const toolName = (t: Tool) => (t === 'view' ? T.view : t === 'clear' ? T.clear : BUILDINGS[t].name);
