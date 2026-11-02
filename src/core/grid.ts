import type { Building, Cell, GameState, Rect } from './types';

type Dims = Pick<GameState, 'cols' | 'rows'>;

export const indexOf = (s: Pick<GameState, 'cols'>, x: number, y: number) => y * s.cols + x;

export const inBounds = (s: Dims, x: number, y: number) => x >= 0 && y >= 0 && x < s.cols && y < s.rows;

export const cellOf = (s: Pick<GameState, 'cols'>, i: number): Cell => ({ x: i % s.cols, y: Math.floor(i / s.cols) });

/** Orthogonal neighbours (N, E, S, W), clipped to the map. */
export function neighbors(s: Dims, x: number, y: number): Cell[] {
  return [
    { x, y: y - 1 },
    { x: x + 1, y },
    { x, y: y + 1 },
    { x: x - 1, y },
  ].filter((c) => inBounds(s, c.x, c.y));
}

/** Cells of a w x h footprint with top-left (x, y). */
export function footprint(x: number, y: number, w: number, h = w): Cell[] {
  const out: Cell[] = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push({ x: x + dx, y: y + dy });
  return out;
}

export const cellsOf = (b: Building) => footprint(b.x, b.y, b.w, b.h);

/** Cells orthogonally adjacent to a building, outside its footprint. */
export function borderCells(s: Dims, b: Rect): Cell[] {
  const out: Cell[] = [];
  for (let k = 0; k < b.w; k++) out.push({ x: b.x + k, y: b.y - 1 }, { x: b.x + k, y: b.y + b.h });
  for (let k = 0; k < b.h; k++) out.push({ x: b.x - 1, y: b.y + k }, { x: b.x + b.w, y: b.y + k });
  return out.filter((c) => inBounds(s, c.x, c.y));
}

/**
 * Indices within a square radius (Chebyshev distance) of a rectangle, clipped to the map.
 * For a single cell, pass w = h = 1.
 */
export function cellsInRadius(s: Dims, x: number, y: number, r: number, w = 1, h = w): number[] {
  const out: number[] = [];
  for (let yy = Math.max(0, y - r); yy <= Math.min(s.rows - 1, y + h - 1 + r); yy++) {
    for (let xx = Math.max(0, x - r); xx <= Math.min(s.cols - 1, x + w - 1 + r); xx++) out.push(yy * s.cols + xx);
  }
  return out;
}
