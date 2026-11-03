import { describe, expect, it } from 'vitest';
import { advanceClock, RULES, stepWeek } from '../src/core';
import { constRng, emptyGame, put, ROADSIDE, westOf } from './helpers';

const never = constRng(0.99);

describe('stepWeek: resources', () => {
  it('updates food, silver and the week', () => {
    const s = emptyGame({ silver: 0, food: 10 });
    put(s, 'house', ROADSIDE, 27, 1); // next to the altar: content, plain tax
    stepWeek(s, never);
    expect(s.food).toBeCloseTo(9.4);
    expect(s.silver).toBe(1);
    expect(s.week).toBe(1);
  });

  it('enters famine when food hits zero with a negative balance, once per episode', () => {
    const s = emptyGame({ food: 0.5 });
    put(s, 'house', ROADSIDE, 30, 1);
    expect(stepWeek(s, never)).toContainEqual({ type: 'famineStart' });
    expect(s.food).toBe(0);
    expect(s.famine).toBe(true);
    expect(stepWeek(s, never)).not.toContainEqual({ type: 'famineStart' });
    put(s, 'field', westOf('field'), 32);
    s.week = 2 * RULES.weeksPerSeason; // the field built in autumn harvests in spring
    expect(stepWeek(s, never)).toContainEqual({ type: 'famineEnd' });
  });
});

describe('stepWeek: field silver', () => {
  it('adds the field silver, scaled by efficiency, to the weekly balance', () => {
    const s = emptyGame({ silver: 0, food: 10 });
    put(s, 'house', ROADSIDE, 30, 1); // 3 residents -> 1 worker, 1 tax
    put(s, 'field', westOf('field'), 32); // 2 jobs -> efficiency 0.5
    stepWeek(s, never);
    expect(s.silver).toBeCloseTo(1 + 1 * 0.5 - 1); // tax + field silver - field upkeep
  });
});

describe('clock', () => {
  it('advances one week every 2.5s at 1x, faster at 3x, never when paused', () => {
    expect(RULES.weekSeconds).toBe(2.5);
    let r = advanceClock(0, 2.4, 1);
    expect(r.steps).toBe(0);
    r = advanceClock(r.acc, 0.2, 1);
    expect(r.steps).toBe(1);
    expect(advanceClock(0, 2.55, 3).steps).toBe(3);
    expect(advanceClock(0, 10, 0)).toEqual({ acc: 0, steps: 0 });
    expect(advanceClock(0, 100, 3).steps).toBe(5);
  });
});
