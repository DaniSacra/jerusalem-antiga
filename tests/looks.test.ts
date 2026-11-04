import { describe, expect, it } from 'vitest';
import { BUILDINGS, clearCell, craftOf, createRng, HOUSE_LEVELS, place, rollLook, RULES, stepWeek } from '../src/core';
import { constRng, EAST, emptyGame, put, ROADSIDE } from './helpers';

describe('house looks', () => {
  it('draws variant and mirroring from the injected rng, deterministically', () => {
    const looks = (seed: number) => {
      const s = emptyGame();
      const rng = createRng(seed);
      return [1, 4, 7, 10].map((x) => {
        place(s, 'house', x, 1, false, rng);
        const b = s.buildings.at(-1)!;
        return [b.variant, b.mirrored];
      });
    };
    expect(looks(7)).toEqual(looks(7));
    expect(looks(7)).not.toEqual(looks(8));
  });

  it('keeps variants within the drawn range of each level', () => {
    const s = emptyGame();
    const b = put(s, 'house', 1, 1);
    const rng = createRng(3);
    for (let level = 0; level < HOUSE_LEVELS.length; level++) {
      b.level = level;
      for (let k = 0; k < 50; k++) {
        rollLook(s, b, rng);
        expect(b.variant).toBeGreaterThanOrEqual(0);
        expect(b.variant).toBeLessThan(HOUSE_LEVELS[level].variants);
        expect(typeof b.mirrored).toBe('boolean');
      }
    }
    expect(HOUSE_LEVELS.map((l) => l.variants)).toEqual([2, 6, 6, 6, 6]);
  });

  it('only houses get a look', () => {
    const s = emptyGame();
    place(s, 'well', 1, 1, false, constRng(0.99));
    expect(s.buildings.at(-1)).toMatchObject({ variant: 0, mirrored: false });
    place(s, 'house', 4, 1, false, constRng(0.99));
    expect(s.buildings.at(-1)).toMatchObject({ variant: 1, mirrored: false });
  });

  it('avoids the variants of same-level neighbours sharing an edge, when it can', () => {
    const s = emptyGame();
    const b = put(s, 'house', 10, 10, 1);
    const around = [put(s, 'house', 8, 9, 1), put(s, 'house', 8, 11, 1), put(s, 'house', 12, 9, 1), put(s, 'house', 12, 11, 1), put(s, 'house', 10, 8, 1), put(s, 'house', 10, 12, 1)];
    around.slice(0, 4).forEach((o, k) => (o.variant = k));
    around[4].level = around[5].level = 2; // other levels do not count
    for (const r of [0, 0.3, 0.6, 0.99]) {
      rollLook(s, b, constRng(r));
      expect([4, 5]).toContain(b.variant);
    }
    around.forEach((o, k) => {
      o.level = 1;
      o.variant = k;
    });
    rollLook(s, b, constRng(0.99)); // every variant taken: any is allowed
    expect(b.variant).toBe(5);
    put(s, 'house', 1, 1, 1).variant = 0; // far away, does not count
    rollLook(s, b, constRng(0));
    expect(b.variant).toBe(0);
  });

  it('draws a new look at every level change, including when a family arrives', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 30, 1);
    put(s, 'well', ROADSIDE, 32);
    b.variant = 0;
    b.mirrored = true;
    for (let k = 0; k < RULES.weeksToUpgrade; k++) stepWeek(s, constRng(0.99));
    expect(b).toMatchObject({ level: 2, variant: 5, mirrored: false });

    const t = emptyGame();
    put(t, 'well', EAST, 27); // families only come with water
    const plot = put(t, 'house', ROADSIDE, 27);
    plot.variant = 1;
    for (let k = 0; k < 8 && plot.level === 0; k++) stepWeek(t, constRng(0)); // the family walks ~20 cells, 6 per week
    expect(plot).toMatchObject({ level: 1, variant: 0, mirrored: true });
  });
});

describe('field looks', () => {
  it('draws one of the field crops, avoiding the crop of an adjacent field', () => {
    const s = emptyGame();
    const a = put(s, 'field', 1, 1);
    a.variant = 0;
    const count = BUILDINGS.field.variants!;
    expect(count).toBeGreaterThanOrEqual(4);
    for (let k = 0; k < 20; k++) {
      place(s, 'field', 3, 1, false, createRng(k));
      const b = s.buildings.at(-1)!;
      expect(b.variant).toBeGreaterThan(0);
      expect(b.variant).toBeLessThan(count);
      clearCell(s, 3, 1);
    }
  });

  it('leaves single-look buildings at variant 0', () => {
    const s = emptyGame();
    place(s, 'well', 1, 1, false, constRng(0.99));
    expect(s.buildings.at(-1)!.variant).toBe(0);
  });
});

describe('workshop crafts', () => {
  const CRAFTS = ['pottery', 'smithy', 'carpentry', 'weaving', 'dyeing', 'tannery'];

  it('stores one of the 6 crafts as the variant, drawn deterministically from the seed', () => {
    expect(BUILDINGS.workshop.crafts).toEqual(CRAFTS);
    const crafts = (seed: number) => {
      const s = emptyGame();
      const rng = createRng(seed);
      return [1, 5, 9, 13, 17].map((x) => {
        place(s, 'workshop', x, 1, false, rng);
        return craftOf(s.buildings.at(-1)!);
      });
    };
    expect(crafts(4)).toEqual(crafts(4));
    expect(crafts(4)).not.toEqual(crafts(5));
    for (const c of crafts(4)) expect(CRAFTS).toContain(c);
  });

  it('does not repeat the craft of an adjacent workshop', () => {
    const s = emptyGame();
    const a = put(s, 'workshop', 1, 1);
    a.variant = 3;
    for (let k = 0; k < 30; k++) {
      place(s, 'workshop', 4, 1, false, createRng(k));
      expect(craftOf(s.buildings.at(-1)!)).not.toBe('weaving');
      clearCell(s, 4, 1);
    }
  });

  it('has no craft for other kinds', () => {
    const s = emptyGame();
    expect(craftOf(put(s, 'field', 1, 1))).toBeNull();
    expect(craftOf(put(s, 'house', 4, 1))).toBeNull();
  });
});
