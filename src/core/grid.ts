import type { GameState } from './types';

export const indexOf = (s: Pick<GameState, 'cols'>, x: number, y: number) => y * s.cols + x;

export const inBounds = (s: Pick<GameState, 'cols' | 'rows'>, x: number, y: number) =>
  x >= 0 && y >= 0 && x < s.cols && y < s.rows;

export const cellOf = (s: Pick<GameState, 'cols'>, i: number) => ({ x: i % s.cols, y: Math.floor(i / s.cols) });

/** Indices of cells within a square radius (Chebyshev distance) of (x, y), clipped to the map. */
export function cellsInRadius(s: Pick<GameState, 'cols' | 'rows'>, x: number, y: number, r: number): number[] {
  const out: number[] = [];
  for (let yy = Math.max(0, y - r); yy <= Math.min(s.rows - 1, y + r); yy++) {
    for (let xx = Math.max(0, x - r); xx <= Math.min(s.cols - 1, x + r); xx++) out.push(indexOf(s, xx, yy));
  }
  return out;
}
