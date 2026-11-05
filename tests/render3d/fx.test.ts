import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core';
import { C } from '../../src/game/palette';
import {
  celebrateRecipe,
  countFor,
  dustRecipe,
  fallAlpha,
  fallAngle,
  fallSide,
  fellRecipe,
  FX_SECONDS,
  scaffoldBars,
  scaffoldRise,
  haloRecipe,
  hopHeight,
  hopStretch,
  ringAlpha,
  ringProgress,
  ringRadius,
  ringRadiusFor,
  sparkAlpha,
  sparkAt,
  sparkleRecipe,
  sparkSize,
  spoilRecipe,
  travel,
  type Spark,
} from '../../src/render3d/fxMath';

/** Every particle a recipe throws (copied: the recipes reuse one object). */
const collect = (run: (emit: (p: Readonly<Spark>) => void) => void) => {
  const out: Spark[] = [];
  run((p) => out.push({ ...p }));
  return out;
};
const pos = (p: Spark, t: number) => sparkAt(p, t, { x: 0, y: 0, z: 0 });

describe('world effects: rings', () => {
  it('a ring spreads fast then slows, from a small start to its full radius', () => {
    const r = 2;
    const steps = [0, 0.1, 0.3, 0.6, 1].map((u) => ringRadius(u, r));
    for (let k = 1; k < steps.length; k++) expect(steps[k]).toBeGreaterThan(steps[k - 1]);
    expect(steps[0]).toBeGreaterThan(0);
    expect(steps[0]).toBeLessThan(r * 0.3);
    expect(steps.at(-1)).toBeCloseTo(r);
    // Ease out: the first tenth of the time covers more than a tenth of the way.
    expect(steps[1] - steps[0]).toBeGreaterThan((r - steps[0]) * 0.2);
  });

  it('fades from whole to nothing, and shows nothing before its delay or after its end', () => {
    expect(ringAlpha(0)).toBe(1);
    expect(ringAlpha(0.5)).toBeGreaterThan(0);
    expect(ringAlpha(0.5)).toBeLessThan(1);
    expect(ringAlpha(-0.1)).toBe(0);
    expect(ringAlpha(1)).toBe(0);
    expect(ringProgress(0.1, 0.3)).toBeLessThan(0);
    expect(ringProgress(0.3 + FX_SECONDS.ring, 0.3)).toBeCloseTo(1);
  });

  it('a bigger footprint gets a wider ring that still clears its sides', () => {
    expect(ringRadiusFor({ w: 3, h: 3 })).toBeGreaterThan(ringRadiusFor({ w: 1, h: 1 }));
    for (const s of [1, 2, 3, 4]) expect(ringRadiusFor({ w: s, h: s })).toBeGreaterThan(s / 2);
  });
});

describe('world effects: hop and tree fall', () => {
  it('a hop goes up and comes back to rest, stretched only while in the air', () => {
    expect(hopHeight(0)).toBe(0);
    expect(hopHeight(1)).toBe(0);
    expect(hopHeight(0.5)).toBeGreaterThan(0.05);
    expect(hopStretch(0)).toBe(1);
    expect(hopStretch(1)).toBe(1);
    expect(hopStretch(0.5)).toBeGreaterThan(1);
  });

  it('a cut tree tips faster and faster to lying, then fades away', () => {
    expect(fallAngle(0)).toBe(0);
    const a = [0.1, 0.3, 0.5, 0.7].map(fallAngle);
    expect(a[1] - a[0]).toBeLessThan(a[3] - a[2]);
    expect(fallAngle(0.7)).toBeCloseTo((84 * Math.PI) / 180);
    expect(fallAngle(1)).toBeCloseTo(fallAngle(0.7));
    expect(fallAlpha(0.5)).toBe(1);
    expect(fallAlpha(1)).toBe(0);
    expect([1, -1]).toContain(fallSide(4, 9));
    expect(fallSide(4, 9)).toBe(fallSide(4, 9));
  });
});

describe('world effects: particles', () => {
  it('drag slows a particle down without ever turning it back', () => {
    expect(travel(2, 0, 1)).toBe(2);
    expect(travel(2, 2, 1)).toBeLessThan(2);
    expect(travel(2, 2, 10)).toBeCloseTo(1, 2);
    expect(travel(2, 2, 10)).toBeGreaterThan(travel(2, 2, 1));
  });

  it('appears, holds and is gone at the end of its life; grows toward its last size', () => {
    const [p] = collect((e) => dustRecipe({ x: 10, y: 10, w: 1, h: 1 }, 0, createRng(1), e));
    expect(sparkAlpha(p, -0.01)).toBe(0);
    expect(sparkAlpha(p, p.life * 0.2)).toBeGreaterThan(0);
    expect(sparkAlpha(p, p.life)).toBe(0);
    expect(sparkSize(p, p.life)).toBeCloseTo(p.size1);
    expect(sparkSize(p, 0)).toBeCloseTo(p.size0);
  });

  it('demolition dust covers the footprint, more for a bigger one (capped), and pebbles land on the ground', () => {
    const small = collect((e) => dustRecipe({ x: 10, y: 10, w: 1, h: 1 }, 0.5, createRng(2), e));
    const big = collect((e) => dustRecipe({ x: 10, y: 10, w: 3, h: 3 }, 0.5, createRng(2), e));
    const huge = collect((e) => dustRecipe({ x: 0, y: 0, w: 40, h: 40 }, 0.5, createRng(2), e));
    expect(big.length).toBeGreaterThan(small.length);
    expect(huge.length).toBe(countFor([8, 6, 28], 99) + countFor([4, 4, 18], 99));
    const puffs = big.filter((p) => p.soft);
    const pebbles = big.filter((p) => !p.soft);
    expect(puffs.length).toBeGreaterThan(0);
    expect(pebbles.length).toBeGreaterThan(0);
    for (const p of puffs) {
      expect([C.dust, C.rockLight]).toContain(p.color);
      expect(Math.abs(p.x - 11.5)).toBeLessThan(1.5);
      expect(Math.abs(p.z - 11.5)).toBeLessThan(1.5);
    }
    for (const p of pebbles) {
      expect([C.rock, C.rockLight, C.rockDark, C.mud]).toContain(p.color);
      // Up first, then back down, never under the ground.
      expect(pos(p, 0.1).y).toBeGreaterThan(p.y);
      expect(pos(p, 3).y).toBeCloseTo(p.floor);
    }
  });

  it('the temple burst and the milestone sparkles are glowing gold, the sparkles rise over time', () => {
    const r = { x: 20, y: 20, w: 3, h: 3 };
    const burst = collect((e) => celebrateRecipe(r, 0, createRng(3), e));
    expect(burst.length).toBe(40);
    expect(burst.every((p) => p.additive)).toBe(true);
    const sec = 2.8;
    const sparks = collect((e) => sparkleRecipe(r, 0, createRng(3), e, [C.milestone], sec));
    expect(sparks.every((p) => p.additive && p.vy > 0)).toBe(true);
    expect(Math.max(...sparks.map((p) => p.delay))).toBeLessThanOrEqual(sec);
    expect(Math.max(...sparks.map((p) => p.delay))).toBeGreaterThan(sec * 0.8);
    const halo = collect((e) => haloRecipe(r, 0, e, 4));
    expect(halo).toHaveLength(1);
    expect(halo[0].life).toBe(4);
    expect(sparkAlpha(halo[0], 2)).toBeCloseTo(halo[0].alpha);
  });

  it('spoiling food: a green puff that rises, and dark flies that buzz round one spot for the whole moment', () => {
    const out = collect((e) => spoilRecipe({ x: 5, y: 5, w: 3, h: 3 }, 0, createRng(4), e));
    const puffs = out.filter((p) => p.color === C.spoil);
    const flies = out.filter((p) => p.color === C.fly);
    expect(puffs.length).toBeGreaterThan(3);
    expect(flies.length).toBe(7);
    for (const p of puffs) expect(pos(p, 1).y).toBeGreaterThan(p.y);
    for (const f of flies) {
      expect(f.delay + f.life).toBeCloseTo(FX_SECONDS.spoil);
      const a = pos(f, 0.2);
      const b = pos(f, 0.25);
      expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(0);
      expect(Math.hypot(a.x - f.x, a.z - f.z)).toBeLessThan(0.5);
    }
  });

  it('a felled tree throws its leaves where its crown lands, when the fall ends', () => {
    const side = fallSide(7, 3);
    const out = collect((e) => fellRecipe(7, 3, 0, createRng(5), e, [C.olive]));
    const leaves = out.filter((p) => p.color === C.olive);
    expect(leaves.length).toBeGreaterThan(5);
    for (const p of out) expect(p.delay).toBeCloseTo(FX_SECONDS.fall * 0.7);
    const mean = leaves.reduce((s, p) => s + p.x, 0) / leaves.length;
    expect(Math.sign(mean - 7.5)).toBe(side);
  });

  it('the same seed throws the same particles', () => {
    const a = collect((e) => dustRecipe({ x: 1, y: 1, w: 2, h: 2 }, 0, createRng(9), e));
    const b = collect((e) => dustRecipe({ x: 1, y: 1, w: 2, h: 2 }, 0, createRng(9), e));
    expect(a).toEqual(b);
  });
});

describe('the scaffold of a new building', () => {
  it('poles at the corners and along the sides, two rails round it, as high as asked', () => {
    const bars = scaffoldBars({ x: 4, y: 6, w: 2, h: 2 }, 1.2);
    const poles = bars.filter((b) => b.sy === 1.2);
    // 3 per side on a 2x2 footprint: 8 distinct poles round it.
    expect(poles).toHaveLength(8);
    for (const p of poles) {
      expect(p.y).toBeCloseTo(0.6);
      expect(p.x < 4 || p.x > 6 || p.z < 6 || p.z > 8).toBe(true);
    }
    expect(bars.filter((b) => b.sy !== 1.2)).toHaveLength(8);
    expect(Math.max(...bars.map((b) => b.y))).toBeCloseTo(1.2 * 0.85);
  });

  it('goes up quickly, stands, and comes down at the end', () => {
    expect(scaffoldRise(0)).toBe(0);
    expect(scaffoldRise(0.075)).toBeCloseTo(0.5);
    expect(scaffoldRise(0.5)).toBe(1);
    expect(scaffoldRise(0.9)).toBeCloseTo(0.5);
    expect(scaffoldRise(1)).toBe(0);
    expect(FX_SECONDS.scaffold).toBe(1.5);
    expect(FX_SECONDS.scaffoldUpgrade).toBe(0.6);
  });
});
