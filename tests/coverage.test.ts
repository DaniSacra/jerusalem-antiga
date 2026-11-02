import { describe, expect, it } from 'vitest';
import { cellsInRadius, indexOf } from '../src/core';
import { EAST, emptyGame, put, ROADSIDE } from './helpers';

describe('coverage', () => {
  it('uses a square radius 4 from every cell of a connected 2x2 well', () => {
    const s = emptyGame();
    put(s, 'well', ROADSIDE, 30); // occupies 22..23 x 30..31
    const w = s.coverage.well;
    expect(w[indexOf(s, 18, 26)]).toBe(true);
    expect(w[indexOf(s, 27, 35)]).toBe(true);
    expect(w[indexOf(s, 17, 30)]).toBe(false);
    expect(w[indexOf(s, 22, 36)]).toBe(false);
  });

  it('gives no coverage from disconnected buildings', () => {
    const s = emptyGame();
    put(s, 'well', 1, 1);
    put(s, 'market', 5, 5);
    expect(s.coverage.well.some(Boolean)).toBe(false);
    expect(s.coverage.market.some(Boolean)).toBe(false);
  });

  it('covers radius 3 around the 4x4 altar as sacred', () => {
    const s = emptyGame();
    expect(s.coverage.sacred[indexOf(s, 19, 19)]).toBe(true);
    expect(s.coverage.sacred[indexOf(s, 28, 28)]).toBe(true);
    expect(s.coverage.sacred[indexOf(s, 18, 24)]).toBe(false);
    expect(s.coverage.sacred[indexOf(s, 24, 29)]).toBe(false);
  });

  it('measures the temple radius 12 from any of its 6x6 cells', () => {
    const s = emptyGame();
    put(s, 'temple', EAST, 30); // occupies 25..30 x 30..35, touches the road at x = 24
    const sac = s.coverage.sacred;
    expect(sac[indexOf(s, 42, 47)]).toBe(true); // 12 right of x=30, 12 below y=35
    expect(sac[indexOf(s, 13, 18)]).toBe(true); // 12 left of x=25, 12 above y=30
    expect(sac[indexOf(s, 43, 32)]).toBe(false);
  });

  it('clips radius areas to the map and handles non-square footprints', () => {
    const s = emptyGame();
    expect(cellsInRadius(s, 0, 0, 3)).toHaveLength(16);
    expect(cellsInRadius(s, 10, 10, 1, 3)).toHaveLength(25);
    expect(cellsInRadius(s, 10, 10, 1, 2, 4)).toHaveLength(4 * 6);
  });
});
