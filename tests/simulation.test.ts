import { describe, expect, it } from 'vitest';
import { advanceClock, BUILDINGS, HOUSE_LEVELS, RULES, stepWeek } from '../src/core';
import { atHarvest, constRng, emptyGame, put, ROADSIDE, westOf } from './helpers';

const never = constRng(0.99);

describe('stepWeek: resources', () => {
  it('updates food, silver and the week', () => {
    const s = emptyGame({ silver: 0, food: 10 });
    put(s, 'house', ROADSIDE, 27, 1); // next to the altar: content, plain tax
    stepWeek(s, never);
    const tent = HOUSE_LEVELS[1];
    expect(s.food).toBeCloseTo(10 - tent.residents * tent.food);
    expect(s.silver).toBe(tent.tax);
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

describe('stepWeek: fields', () => {
  it('a working field adds food and only costs its upkeep in silver', () => {
    const s = emptyGame({ silver: 0, food: 10 });
    put(s, 'house', ROADSIDE, 30, 1);
    put(s, 'field', westOf('field'), 32);
    atHarvest(s);
    const before = s.food;
    stepWeek(s, never);
    expect(s.silver).toBeCloseTo(HOUSE_LEVELS[1].tax - BUILDINGS.field.upkeep!); // tax - field upkeep, no field silver
    expect(s.food).toBeGreaterThan(before);
  });
});

describe('clock', () => {
  it('advances one week every weekSeconds at 1x, faster at 3x, never when paused', () => {
    const ws = RULES.weekSeconds;
    let r = advanceClock(0, ws - 0.1, 1);
    expect(r.steps).toBe(0);
    r = advanceClock(r.acc, 0.2, 1);
    expect(r.steps).toBe(1);
    expect(advanceClock(0, ws * 1.02, 3).steps).toBe(3);
    expect(advanceClock(0, 10, 0)).toEqual({ acc: 0, steps: 0 });
    expect(advanceClock(0, 100, 3).steps).toBe(5);
  });
});
