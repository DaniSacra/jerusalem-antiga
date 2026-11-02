import { describe, expect, it } from 'vitest';
import { cellsInRadius, indexOf } from '../src/core';
import { emptyGame, put, ROADSIDE } from './helpers';

describe('coverage', () => {
  it('uses a square radius from connected wells', () => {
    const s = emptyGame();
    put(s, 'well', ROADSIDE, 25);
    const w = s.coverage.well;
    expect(w[indexOf(s, 12, 22)]).toBe(true);
    expect(w[indexOf(s, 18, 28)]).toBe(true);
    expect(w[indexOf(s, 11, 25)]).toBe(false);
  });

  it('gives no coverage from disconnected buildings', () => {
    const s = emptyGame();
    put(s, 'well', 3, 3);
    put(s, 'market', 6, 6);
    expect(s.coverage.well.some(Boolean)).toBe(false);
    expect(s.coverage.market.some(Boolean)).toBe(false);
  });

  it('covers radius 3 around the altar as sacred', () => {
    const s = emptyGame();
    expect(s.coverage.sacred[indexOf(s, 13, 13)]).toBe(true);
    expect(s.coverage.sacred[indexOf(s, 19, 19)]).toBe(true);
    expect(s.coverage.sacred[indexOf(s, 12, 16)]).toBe(false);
    expect(s.coverage.sacred[indexOf(s, 16, 20)]).toBe(false);
  });

  it('measures the temple radius 9 from any of its 3x3 cells', () => {
    const s = emptyGame();
    put(s, 'temple', 17, 20); // occupies 17..19 x 20..22, touches the road at x = 16
    const sac = s.coverage.sacred;
    expect(sac[indexOf(s, 28, 31)]).toBe(true); // 9 right of x=19, 9 below y=22
    expect(sac[indexOf(s, 8, 11)]).toBe(true); // 9 left of x=17, 9 above y=20
    expect(sac[indexOf(s, 29, 22)]).toBe(false);
  });

  it('clips radius areas to the map', () => {
    const s = emptyGame();
    expect(cellsInRadius(s, 0, 0, 3)).toHaveLength(16);
    expect(cellsInRadius(s, 10, 10, 1, 3)).toHaveLength(25);
  });
});
