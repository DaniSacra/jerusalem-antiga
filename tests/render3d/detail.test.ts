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
    // (Reeds by the river are tufts drawn big: see the test below.)
    const tufts = d.filter((p) => p.key === 'tuft' && p.scale < LOOK.detail.reedScale * 0.7);
    expect(tufts.length).toBeGreaterThan(50);
    for (const p of tufts.filter((p) => p.x < 10 && p.z < 10)) expect(s.ground[indexOf(s, Math.floor(p.x), Math.floor(p.z))]).toBe('grass');
    for (const p of tufts) expect(s.ground[indexOf(s, Math.floor(p.x), Math.floor(p.z))]).not.toBe('river');
    // Wild flowers grow on the lawn only, in patches (a share of the cells, not all of them).
    const flowers = d.filter((p) => p.key === 'flowers' || p.key === 'flowers-b');
    expect(flowers.length).toBeGreaterThan(0);
    expect(flowers.length).toBeLessThan(100 * LOOK.detail.flowerShare * 2.5);
    for (const p of flowers) expect(s.ground[indexOf(s, Math.floor(p.x), Math.floor(p.z))]).toBe('grass');
    for (const p of d.filter((p) => p.key === 'pebbles')) expect(s.ground[indexOf(s, Math.floor(p.x), Math.floor(p.z))]).not.toBe('river');
    for (const p of d) {
      const i = indexOf(s, Math.floor(p.x), Math.floor(p.z));
      expect(s.roads[i] || s.grid[i] || s.feature[i] || s.ground[i] === 'river').toBeFalsy();
    }
  });

  it('puts a few tufts on the dry meadow too, fewer than on the lawn', () => {
    const s = emptyGame();
    s.ground = s.ground.map((g) => (g === 'river' ? g : 'sand'));
    const meadow = groundDetail(s, wearMap(s)).filter((p) => p.key === 'tuft' && p.scale < LOOK.detail.reedScale * 0.7);
    expect(meadow.length).toBeGreaterThan(50);
    s.ground = s.ground.map((g) => (g === 'river' ? g : 'grass'));
    const lawn = groundDetail(s, wearMap(s)).filter((p) => p.key === 'tuft' && p.scale < LOOK.detail.reedScale * 0.7);
    expect(meadow.length).toBeLessThan(lawn.length);
  });

  it('grows tall grass at the edge of the road, on the side that meets it', () => {
    const s = emptyGame();
    s.ground = s.ground.map((g) => (g === 'river' ? g : 'grass'));
    s.feature = s.feature.map(() => null);
    for (let x = 4; x < 20; x++) s.roads[indexOf(s, x, 4)] = true;
    const tall = groundDetail(s, wearMap(s)).filter((p) => p.key === 'tuft' && p.scale >= LOOK.detail.edgeScale[0] && p.scale < LOOK.detail.reedScale * 0.7 && Math.abs(p.z - 4.5) < 1.1 && p.x > 5 && p.x < 19);
    expect(tall.length).toBeGreaterThan(8);
    for (const p of tall) expect(Math.floor(p.z) === 3 || Math.floor(p.z) === 5).toBe(true);
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

  it('puts reeds and stones at the edge of the water near the town, none far from it', () => {
    const s = emptyGame();
    const d = groundDetail(s, wearMap(s));
    const reeds = d.filter((p) => p.key === 'tuft' && p.scale >= LOOK.detail.reedScale * 0.7);
    expect(reeds.length).toBeGreaterThan(10);
    const altar = s.buildings.find((b) => b.kind === 'altar')!;
    const river = (x: number, y: number) => s.ground[indexOf(s, x, y)] === 'river';
    for (const p of reeds) {
      const x = Math.floor(p.x);
      const y = Math.floor(p.z);
      expect(river(x, y)).toBe(false);
      expect(river(x + 1, y) || river(x - 1, y) || river(x, y + 1) || river(x, y - 1)).toBe(true);
      expect(Math.hypot(p.x - altar.x - altar.w / 2, p.z - altar.y - altar.h / 2)).toBeLessThanOrEqual(LOOK.detail.bankReach + 1);
    }
  });
});
