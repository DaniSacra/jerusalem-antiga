import { describe, expect, it } from 'vitest';
import { indexOf } from '../../src/core';
import { groundDetail } from '../../src/render3d/detail';
import { wearAt, wearMap } from '../../src/render3d/wear';
import { emptyGame, put } from '../helpers';
import LOOK from '../../src/render3d/look3d.json';

describe('ground detail', () => {
  it('puts tufts on grass and pebbles on sand, only on open ground', () => {
    const s = emptyGame();
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) s.ground[indexOf(s, x, y)] = 'grass';
    s.feature[indexOf(s, 3, 3)] = 'olive';
    const wear = wearMap(s);
    const d = groundDetail(s, wear);
    const tufts = d.filter((p) => p.key === 'tuft');
    expect(tufts.length).toBeGreaterThan(50);
    for (const p of tufts) expect(s.ground[indexOf(s, Math.floor(p.x), Math.floor(p.z))]).toBe('grass');
    for (const p of d.filter((p) => p.key === 'pebbles')) expect(s.ground[indexOf(s, Math.floor(p.x), Math.floor(p.z))]).toBe('sand');
    for (const p of d) {
      const i = indexOf(s, Math.floor(p.x), Math.floor(p.z));
      expect(s.roads[i] || s.grid[i] || s.feature[i] || s.ground[i] === 'river').toBeFalsy();
    }
  });

  it('keeps trodden ground bare (before the doors, along the roads)', () => {
    const s = emptyGame();
    s.ground = s.ground.map((g) => (g === 'river' ? g : 'grass'));
    put(s, 'house', 25, 27, 2);
    const wear = wearMap(s);
    for (const p of groundDetail(s, wear)) expect(wearAt(s, wear, p.x, p.z)).toBeLessThan(LOOK.detail.wornOut);
  });

  it('is the same for the same map (stable)', () => {
    const s = emptyGame();
    const wear = wearMap(s);
    expect(groundDetail(s, wear)).toEqual(groundDetail(s, wear));
  });
});
