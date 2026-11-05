import { describe, expect, it } from 'vitest';
import { RULES } from '../../src/core';
import { cropLook, isHarvest, season3d, seasonAt, seasonBlend } from '../../src/render3d/time/season';

const M = RULES.weeksPerSeason;
const channels = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const dist = (a: number, b: number) => Math.max(...channels(a).map((v, i) => Math.abs(v - channels(b)[i])));
const plain = { snow: 0, drought: 0 };

describe('seasons in 3D', () => {
  it('starts in the game start season (autumn) and follows the core order', () => {
    expect(seasonAt(0).season).toBe(RULES.startSeason);
    expect(seasonAt(M).season).toBe('winter');
    expect(seasonAt(2 * M + 0.5).season).toBe('spring');
    expect(seasonAt(3 * M).season).toBe('summer');
  });

  it('blends half way exactly at a season change and not in mid season', () => {
    const atChange = seasonBlend(M - 1e-9);
    expect(atChange.a).toBe('autumn');
    expect(atChange.b).toBe('winter');
    expect(atChange.f).toBeCloseTo(0.5, 3);
    const after = seasonBlend(M + 1e-9);
    expect(after.a).toBe('autumn');
    expect(after.f).toBeCloseTo(0.5, 3);
    expect(seasonBlend(M / 2 + 2 * M).f).toBe(0);
  });

  it('never switches colours suddenly over two whole years', () => {
    const step = 1 / 16;
    let prev = season3d(0, plain);
    for (let p = step; p < 8 * M; p += step) {
      const cur = season3d(p, plain);
      for (const k of ['sun', 'sky', 'grass', 'sand', 'leaf', 'haze'] as const) expect(dist(prev[k], cur[k])).toBeLessThanOrEqual(6);
      expect(Math.abs(prev.elev - cur.elev)).toBeLessThan(1.5);
      prev = cur;
    }
  });

  it('gives golden low light in autumn, cold low light in winter, strong high light in summer', () => {
    const autumn = season3d(M / 2, plain);
    const winter = season3d(M + M / 2, plain);
    const summer = season3d(3 * M + M / 2, plain);
    const [ar, , ab] = channels(autumn.sun);
    const [wr, , wb] = channels(winter.sun);
    expect(ar).toBeGreaterThan(ab);
    expect(wb).toBeGreaterThan(wr);
    expect(summer.elev).toBeGreaterThan(autumn.elev);
    expect(summer.elev).toBeGreaterThan(winter.elev);
    expect(summer.sunI).toBeGreaterThan(winter.sunI);
    expect(summer.heat).toBeGreaterThan(0.5);
    expect(autumn.leaves).toBeGreaterThan(0.5);
    expect(season3d(2 * M + M / 2, plain).flowers).toBeGreaterThan(0.5);
  });

  it('browns the grass and stops the flowers in a drought, greys the sky under snow', () => {
    const spring = 2 * M + M / 2;
    const wet = season3d(spring, plain);
    const dry = season3d(spring, { snow: 0, drought: 1 });
    expect(channels(dry.grass)[1]).toBeLessThan(channels(wet.grass)[1]);
    expect(dry.flowers).toBe(0);
    expect(dry.dust).toBeGreaterThan(wet.dust);
    const snowy = season3d(M + 5, { snow: 1, drought: 0 });
    expect(snowy.snow).toBe(1);
    expect(dist(snowy.sky, season3d(M + 5, plain).sky)).toBeGreaterThan(0);
  });
});

describe('fields over the year', () => {
  it('are plowed at the start of autumn, grow through winter and are ripe in spring', () => {
    expect(cropLook(1).stage).toBe('plowed');
    expect(cropLook(1).height).toBeLessThan(0.1);
    const winter = cropLook(M + M / 2);
    const spring = cropLook(2 * M + 2);
    expect(winter.height).toBeGreaterThan(cropLook(1).height);
    expect(spring.height).toBeGreaterThan(winter.height);
    expect(isHarvest(spring.stage)).toBe(true);
  });

  it('grow smoothly (no jump in height between quarter weeks)', () => {
    for (let p = 0; p < 4 * M; p += 0.25) expect(Math.abs(cropLook(p).height - cropLook(p + 0.25).height)).toBeLessThan(0.12);
  });

  it('dry out in a drought', () => {
    const p = 3 * M + 3;
    expect(cropLook(p, 1).height).toBeLessThan(cropLook(p, 0).height);
    expect(dist(cropLook(p, 1).soil, cropLook(p, 0).soil)).toBeGreaterThan(10);
  });
});
