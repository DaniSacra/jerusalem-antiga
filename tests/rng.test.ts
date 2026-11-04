import { describe, expect, it } from 'vitest';
import { between, createRng, shuffle } from '../src/core';

describe('rng', () => {
  it('gives the same numbers in [0, 1) for the same seed, other numbers for another seed', () => {
    const a = createRng(7);
    const b = createRng(7);
    const c = createRng(8);
    const xs = Array.from({ length: 50 }, () => a());
    expect(Array.from({ length: 50 }, () => b())).toEqual(xs);
    expect(Array.from({ length: 50 }, () => c())).not.toEqual(xs);
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('between gives whole numbers in [min, max], both ends included', () => {
    const rng = createRng(3);
    const seen = new Set<number>();
    for (let k = 0; k < 200; k++) seen.add(between(rng, [2, 4]));
    expect([...seen].sort()).toEqual([2, 3, 4]);
    expect(between(() => 0, [5, 9])).toBe(5);
    expect(between(() => 0.999999, [5, 9])).toBe(9);
  });

  it('shuffle reorders in place, keeps every item and is the same for the same seed', () => {
    const items = Array.from({ length: 10 }, (_, k) => k);
    const a = shuffle([...items], createRng(5));
    const b = shuffle([...items], createRng(5));
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual(items);
    expect(a).not.toEqual(items);
    const list = [1, 2, 3];
    expect(shuffle(list, createRng(1))).toBe(list);
    expect(shuffle([], createRng(1))).toEqual([]);
  });
});
