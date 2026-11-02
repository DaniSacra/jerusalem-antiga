import { describe, expect, it } from 'vitest';
import { advanceClock, stepMonth } from '../src/core';
import { constRng, emptyGame, put, ROADSIDE, westOf } from './helpers';

const never = constRng(0.99);

describe('stepMonth: resources', () => {
  it('updates food, silver and the month', () => {
    const s = emptyGame({ silver: 0, food: 10 });
    put(s, 'house', ROADSIDE, 27, 1); // next to the altar: content, plain tax
    stepMonth(s, never);
    expect(s.food).toBeCloseTo(9.4);
    expect(s.silver).toBe(1);
    expect(s.month).toBe(1);
  });

  it('enters famine when food hits zero with a negative balance, once per episode', () => {
    const s = emptyGame({ food: 0.5 });
    put(s, 'house', ROADSIDE, 30, 1);
    expect(stepMonth(s, never)).toContainEqual({ type: 'famineStart' });
    expect(s.food).toBe(0);
    expect(s.famine).toBe(true);
    expect(stepMonth(s, never)).not.toContainEqual({ type: 'famineStart' });
    put(s, 'field', westOf('field'), 32);
    expect(stepMonth(s, never)).toContainEqual({ type: 'famineEnd' });
  });
});

describe('stepMonth: field silver', () => {
  it('adds the field silver, scaled by efficiency, to the monthly balance', () => {
    const s = emptyGame({ silver: 0, food: 10 });
    put(s, 'house', ROADSIDE, 30, 1); // 3 residents -> 1 worker, 1 tax
    put(s, 'field', westOf('field'), 32); // 2 jobs -> efficiency 0.5
    stepMonth(s, never);
    expect(s.silver).toBeCloseTo(1 + 1 * 0.5 - 1); // tax + field silver - field upkeep
  });
});

describe('clock', () => {
  it('advances one month every 1.2s at 1x, faster at 3x, never when paused', () => {
    let r = advanceClock(0, 1.0, 1);
    expect(r.steps).toBe(0);
    r = advanceClock(r.acc, 0.3, 1);
    expect(r.steps).toBe(1);
    expect(advanceClock(0, 1.25, 3).steps).toBe(3);
    expect(advanceClock(0, 10, 0)).toEqual({ acc: 0, steps: 0 });
    expect(advanceClock(0, 100, 3).steps).toBe(5);
  });
});
