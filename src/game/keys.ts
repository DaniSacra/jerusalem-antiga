import type { BuildingCategory } from '../core';
import { CATEGORY_KEYS, TOOL_KEYS, type Tool } from './tools';
import type { Session } from './session';
import { saveSettings, settings } from './settings';

/** What a key does (PC): the same table for every view. */
export type KeyCommand =
  | { tool: Tool }
  | { category: BuildingCategory }
  | { do: 'speed' | 'rotate' | 'escape' | 'music' | 'jobs' | 'contemplate' }
  | { turn: 1 | -1 }
  | { pan: { dx: number; dy: number } };

const BY_DIGIT = new Map<string, KeyCommand>([
  ...(Object.entries(TOOL_KEYS) as [Tool, string][]).map(([tool, k]) => [k, { tool }] as [string, KeyCommand]),
  ...(Object.entries(CATEGORY_KEYS) as [BuildingCategory, string][]).map(([category, k]) => [k, { category }] as [string, KeyCommand]),
]);

/** Arrow keys and WASD move the camera this many screen px per press (held keys repeat). */
export const KEY_PAN = 60;

const PAN: Record<string, { dx: number; dy: number }> = {
  arrowleft: { dx: KEY_PAN, dy: 0 },
  a: { dx: KEY_PAN, dy: 0 },
  arrowright: { dx: -KEY_PAN, dy: 0 },
  d: { dx: -KEY_PAN, dy: 0 },
  arrowup: { dx: 0, dy: KEY_PAN },
  w: { dx: 0, dy: KEY_PAN },
  arrowdown: { dx: 0, dy: -KEY_PAN },
  s: { dx: 0, dy: -KEY_PAN },
};

/**
 * The command of a key (`KeyboardEvent.key`): 1 Mover, 2 Rua, 0 Demolir, 3–6 the categories,
 * Space the speed, R turns the building, Q/E turn the map, M the music on/off, P the Profissões panel,
 * C the contemplate mode (no interface, low slow orbit),
 * Esc closes or goes back to Mover.
 * `pan`: WASD and the arrows move the camera (the 3D view; the 2D keeps them off).
 */
export function keyCommand(key: string, pan = false): KeyCommand | null {
  const k = key.toLowerCase();
  const digit = BY_DIGIT.get(k);
  if (digit) return digit;
  if (k === ' ' || k === 'spacebar') return { do: 'speed' };
  if (k === 'r') return { do: 'rotate' };
  if (k === 'q') return { turn: -1 };
  if (k === 'e') return { turn: 1 };
  if (k === 'escape') return { do: 'escape' };
  if (k === 'm') return { do: 'music' };
  if (k === 'p') return { do: 'jobs' };
  if (k === 'c') return { do: 'contemplate' };
  if (pan && PAN[k]) return { pan: PAN[k] };
  return null;
}

/** What a view does for a key besides the session: close its top panel, turn and move its camera. */
export interface KeyView {
  /** Closes the open panel or balloon; false when nothing was open. */
  closeTop(): boolean;
  turnMap(dir: 1 | -1): void;
  panBy?(dx: number, dy: number): void;
  /** Opens or closes the Profissões panel. */
  toggleJobs?(): void;
  /** Enters or leaves the contemplate mode. */
  toggleContemplate?(): void;
}

/** Runs a key command. Esc closes the open panel or balloon first, then the tapped building, then goes back to Mover. */
export function runKey(c: KeyCommand, s: Session, v: KeyView) {
  if ('tool' in c) s.selectTool(c.tool);
  else if ('category' in c) s.pickCategory(c.category);
  else if ('turn' in c) v.turnMap(c.turn);
  else if ('pan' in c) v.panBy?.(c.pan.dx, c.pan.dy);
  else if (c.do === 'speed') s.cycleSpeed();
  else if (c.do === 'rotate') s.rotate();
  else if (c.do === 'jobs') v.toggleJobs?.();
  else if (c.do === 'contemplate') v.toggleContemplate?.();
  else if (c.do === 'music') {
    settings.music = !settings.music;
    saveSettings();
  }
  else if (!v.closeTop()) {
    if (s.tool === 'view' && s.selected) s.deselect();
    else s.selectTool('view');
  }
}
