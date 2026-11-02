import { RULES } from '../core';

export const GAME_W = 1280;
export const GAME_H = 720;
export const CELL = 48;
export const COLS = RULES.map.cols;
export const ROWS = RULES.map.rows;

export const TOP_H = 56;
export const MAP_W = COLS * CELL;
export const MAP_H = ROWS * CELL;
export const MAP_X = (GAME_W - MAP_W) / 2;
export const MAP_Y = TOP_H + 4;
export const INFO_Y = MAP_Y + MAP_H + 2;
export const INFO_H = 32;
export const TOOL_Y = INFO_Y + INFO_H;
export const TOOL_H = GAME_H - TOOL_Y;

export const cellLeft = (x: number) => MAP_X + x * CELL;
export const cellTop = (y: number) => MAP_Y + y * CELL;
export const cellCenterX = (x: number) => cellLeft(x) + CELL / 2;
export const cellBottom = (y: number) => cellTop(y) + CELL;

export function pointToCell(px: number, py: number): { x: number; y: number } | null {
  const x = Math.floor((px - MAP_X) / CELL);
  const y = Math.floor((py - MAP_Y) / CELL);
  return x >= 0 && y >= 0 && x < COLS && y < ROWS ? { x, y } : null;
}

/** Stable per-cell hash for picking visual variants. */
export const cellHash = (x: number, y: number) => (((x + 1) * 73856093) ^ ((y + 1) * 19349663)) >>> 0;

export const DEPTH = { ground: 0, groundFx: 10, world: 100, fx: 3000, overlay: 3500, ui: 5000, toast: 6000, modal: 7000 };
export const worldDepth = (bottomY: number) => DEPTH.world + bottomY;
