import { describe, expect, it } from 'vitest';
import { cellsInRadius, indexOf } from '../src/core';
import { emptyGame, place } from './helpers';

describe('coverage', () => {
  it('uses a square radius', () => {
    const s = emptyGame();
    place(s, 'well', 5, 5);
    const w = s.coverage.well;
    expect(w[indexOf(s, 8, 8)]).toBe(true);
    expect(w[indexOf(s, 2, 2)]).toBe(true);
    expect(w[indexOf(s, 9, 5)]).toBe(false);
    expect(w[indexOf(s, 5, 9)]).toBe(false);
    expect(s.coverage.market.some(Boolean)).toBe(false);
  });

  it('clips the radius to the map', () => {
    const s = emptyGame();
    expect(cellsInRadius(s, 0, 0, 3)).toHaveLength(16);
    expect(cellsInRadius(s, 10, 5, 1)).toHaveLength(9);
  });
});
