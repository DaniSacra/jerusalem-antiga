import { describe, expect, it } from 'vitest';
import { HOUSE_LEVELS } from '../../src/core';
import { KIT_KEYS, KIT_VARIANTS, kitOf, ROOF } from '../../src/render3d/kits';
import { lookOf, MODEL_KEYS, YARD_AT, yardOf } from '../../src/render3d/plan';

const LEVELS = [1, 2, 3, 4] as const;
const signature = (level: number, variant: number) =>
  JSON.stringify([kitOf(level, variant, false).map((p) => p.key).sort(), yardOf({ kind: 'house', level, variant })]);

describe('house kits', () => {
  it('has a kit for every look the core draws, and every piece is a model', () => {
    for (const l of LEVELS) expect(HOUSE_LEVELS[l].variants).toBe(KIT_VARIANTS);
    for (const k of KIT_KEYS) expect(MODEL_KEYS).toContain(k);
    expect(kitOf(0, 1, false)).toEqual([]);
  });

  it('makes the six looks of each level different from each other (pieces and yard)', () => {
    for (const l of LEVELS) expect(new Set([0, 1, 2, 3, 4, 5].map((v) => signature(l, v))).size).toBe(6);
  });

  it('gives each level more than one kind of piece (not one piece moved about)', () => {
    for (const l of LEVELS) {
      const keys = new Set([0, 1, 2, 3, 4, 5].flatMap((v) => kitOf(l, v, false).map((p) => p.key)));
      expect(keys.size).toBeGreaterThanOrEqual(4);
    }
  });

  it('keeps the pieces on the house plot, on the ground or on a roof', () => {
    const roofs: number[] = [0, 0.01, ...Object.values(ROOF), ROOF.mud + 0.05];
    for (const l of LEVELS)
      for (let v = 0; v < KIT_VARIANTS; v++)
        for (const p of kitOf(l, v, false)) {
          expect(Math.abs(p.x)).toBeLessThanOrEqual(0.9);
          expect(Math.abs(p.z)).toBeLessThanOrEqual(0.95);
          expect(roofs).toContain(p.y);
          expect(p.s).toBeGreaterThan(0.5);
        }
  });

  it('leaves the yard corner free when the look has yard things', () => {
    for (const l of LEVELS)
      for (let v = 0; v < KIT_VARIANTS; v++) {
        if (!yardOf({ kind: 'house', level: l, variant: v })) continue;
        for (const p of kitOf(l, v, false).filter((p) => p.y === 0)) expect(Math.hypot(p.x - YARD_AT[0], p.z - YARD_AT[1])).toBeGreaterThan(0.3);
      }
  });

  it('keeps the built pieces of an empty house and drops its daily life', () => {
    // Mud house variant 3: an upper room, an oven and a rug over the parapet.
    expect(kitOf(2, 3, false).map((p) => p.key)).toEqual(['kit-room-mud', 'kit-oven', 'kit-rug']);
    expect(kitOf(2, 3, true).map((p) => p.key)).toEqual(['kit-room-mud', 'kit-oven']);
    expect(lookOf({ kind: 'house', level: 0, emptyLevel: 2, variant: 1, w: 2, h: 2 }).kit.map((p) => p.key)).toEqual(['kit-oven', 'kit-room-mud']);
    // Lived-in: the look carries the kit of its level and variant.
    expect(lookOf({ kind: 'house', level: 4, emptyLevel: 0, variant: 5, w: 2, h: 2 }).kit).toEqual(kitOf(4, 5, false));
    expect(lookOf({ kind: 'market', level: 1, emptyLevel: 0, variant: 0, w: 2, h: 4 }).kit).toEqual([]);
  });

  it('wraps any variant number onto the six looks', () => {
    expect(kitOf(3, 7, false)).toEqual(kitOf(3, 1, false));
  });
});
