import { describe, expect, it } from 'vitest';
import { indexOf } from '../../src/core';
import { dressing } from '../../src/render3d/dressing';
import { MODEL_KEYS } from '../../src/render3d/plan';
import { emptyGame, put } from '../helpers';

const town = () => {
  const s = emptyGame();
  s.feature = s.feature.map(() => null);
  s.ground = s.ground.map((g) => (g === 'river' ? g : 'grass'));
  for (let x = 14; x <= 36; x++) s.roads[indexOf(s, x, 30)] = true;
  for (const x of [15, 18, 21, 27, 30]) for (const y of [32, 36, 40]) put(s, 'house', x, y, 3);
  put(s, 'field', 15, 44);
  put(s, 'field', 18, 44);
  put(s, 'lumber', 33, 33);
  put(s, 'granary', 33, 38);
  return s;
};

describe('the dressing of the countryside', () => {
  it('has a model for every piece', () => {
    for (const k of ['log', 'woodpile', 'fence', 'hay', 'shed'] as const) expect(MODEL_KEYS).toContain(k);
  });

  it('puts firewood, fences, a shed per field, logs and stones around the town', () => {
    const d = dressing(town());
    const n = (k: string) => d.filter((p) => p.key === k).length;
    expect(n('woodpile')).toBeGreaterThan(3);
    expect(n('fence')).toBeGreaterThan(2);
    expect(n('shed')).toBe(2);
    expect(n('log') + n('stump') + n('rock')).toBeGreaterThan(3);
  });

  it('keeps off roads, buildings, trees and the river, and clear of the cells it is told are taken', () => {
    const s = town();
    s.feature[indexOf(s, 20, 20)] = 'olive';
    const taken = new Set([indexOf(s, 16, 34)]);
    for (const p of dressing(s, taken)) {
      const i = indexOf(s, Math.floor(p.x), Math.floor(p.z));
      if (p.key !== 'fence') expect(s.roads[i] || s.grid[i] || s.feature[i] || s.ground[i] === 'river').toBeFalsy();
      expect(taken.has(i) && p.key !== 'fence').toBe(false);
    }
  });

  it('is stable', () => {
    const s = town();
    expect(dressing(s)).toEqual(dressing(s));
  });
});
