import { describe, expect, it } from 'vitest';
import { BUILDINGS, cellsInRadius, indexOf } from '../src/core';
import { EAST, emptyGame, put, ROADSIDE } from './helpers';

describe('coverage', () => {
  it('uses a square radius 4 from every cell of a connected 2x2 plaza', () => {
    const s = emptyGame();
    put(s, 'plaza', ROADSIDE, 30); // occupies 22..23 x 30..31
    const w = s.coverage.plaza;
    expect(w[indexOf(s, 18, 26)]).toBe(true);
    expect(w[indexOf(s, 27, 35)]).toBe(true);
    expect(w[indexOf(s, 17, 30)]).toBe(false);
    expect(w[indexOf(s, 22, 36)]).toBe(false);
  });

  it('the plaza and the park have the data of plan P2, and each covers only its own service', () => {
    expect(BUILDINGS.plaza).toMatchObject({ category: 'home', cost: 25, upkeep: 0.75, w: 2, h: 2, jobs: 0, radius: 4 });
    expect(BUILDINGS.park).toMatchObject({ category: 'home', cost: 60, upkeep: 2, w: 2, h: 2, jobs: 0, radius: 4 });
    expect('well' in BUILDINGS).toBe(false);
    expect('garden' in BUILDINGS).toBe(false);
    const s = emptyGame();
    put(s, 'park', ROADSIDE, 30); // 22..23 x 30..31, radius 4
    const r = BUILDINGS.park.radius!;
    expect(s.coverage.park[indexOf(s, ROADSIDE - r, 30 - r)]).toBe(true);
    expect(s.coverage.park[indexOf(s, ROADSIDE + 1 + r, 31 + r)]).toBe(true);
    expect(s.coverage.park[indexOf(s, ROADSIDE, 31 + r + 1)]).toBe(false);
    expect(s.coverage.plaza.some(Boolean)).toBe(false);
    expect(s.coverage.market.some(Boolean)).toBe(false);
  });

  it('gives no coverage from disconnected buildings', () => {
    const s = emptyGame();
    put(s, 'plaza', 1, 1);
    put(s, 'market', 5, 5);
    expect(s.coverage.plaza.some(Boolean)).toBe(false);
    expect(s.coverage.market.some(Boolean)).toBe(false);
  });

  it('covers the altar radius around the 4x4 altar (22..25) as sacred', () => {
    const s = emptyGame();
    const r = BUILDINGS.altar.radius!;
    expect(s.coverage.sacred[indexOf(s, 22 - r, 22 - r)]).toBe(true);
    expect(s.coverage.sacred[indexOf(s, 25 + r, 25 + r)]).toBe(true);
    expect(s.coverage.sacred[indexOf(s, 22 - r - 1, 24)]).toBe(false);
    expect(s.coverage.sacred[indexOf(s, 24, 25 + r + 1)]).toBe(false);
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
