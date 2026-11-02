import { describe, expect, it } from 'vitest';
import { alerts, checkClear, clearCell, place, RULES, stepMonth, type GameEvent, type GameState } from '../src/core';
import { constRng, EAST, emptyGame, put, ROADSIDE } from './helpers';

const never = constRng(0.99);
const run = (s: GameState, months: number) => {
  const events: GameEvent[] = [];
  for (let k = 0; k < months; k++) events.push(...stepMonth(s, never));
  return events;
};

/** A city whose only building is a market: no taxes, 3 silver of upkeep per month. */
const draining = (silver: number) => {
  const s = emptyGame({ silver: 1000, food: 1000 });
  put(s, 'market', EAST, 27);
  s.silver = silver;
  return s;
};

describe('upkeep and debt', () => {
  it('charges upkeep every month and lets silver go negative', () => {
    const s = draining(5);
    run(s, 1);
    expect(s.silver).toBe(2);
    run(s, 1);
    expect(s.silver).toBe(-1);
  });

  it('blocks building and cutting trees while in debt, but demolishing still works', () => {
    const s = draining(-1);
    expect(place(s, 'road', ROADSIDE, 40)).toEqual({ ok: false, reason: 'debt' });
    expect(place(s, 'house', ROADSIDE, 40)).toEqual({ ok: false, reason: 'debt' });
    s.feature[s.cols * 2 + 2] = 'palm';
    expect(checkClear(s, 2, 2)).toEqual({ ok: false, reason: 'debt' });
    expect(clearCell(s, EAST, 27)).toEqual({ ok: true });
    s.silver = 0; // zero is not debt
    expect(place(s, 'road', ROADSIDE, 40)).toEqual({ ok: false, reason: 'silver' });
  });

  it('starts counting the month silver ends negative, and resets at zero or more', () => {
    const s = draining(2);
    expect(run(s, 1)).toContainEqual({ type: 'debtStart' }); // 2 - 3 = -1
    expect(s.debtMonths).toBe(1);
    run(s, 2);
    expect(s.debtMonths).toBe(3);
    s.silver = 3; // e.g. a goal reward
    expect(run(s, 1)).toContainEqual({ type: 'debtEnd' }); // 3 - 3 = 0: not debt
    expect(s.debtMonths).toBe(0);
    expect(run(s, 1)).toContainEqual({ type: 'debtStart' });
    expect(s.debtMonths).toBe(1);
  });

  it(`loses exactly after ${RULES.debtMonthsToLose} consecutive months in debt`, () => {
    expect(RULES.debtMonthsToLose).toBe(24);
    const s = draining(-1);
    s.peakPopulation = 42;
    const before = run(s, RULES.debtMonthsToLose - 1);
    expect(before.some((e) => e.type === 'defeat')).toBe(false);
    expect(s.lost).toBe(false);
    expect(run(s, 1)).toContainEqual({ type: 'defeat', month: RULES.debtMonthsToLose, peak: 42 });
    expect(s.lost).toBe(true);
    const month = s.month;
    expect(run(s, 3)).toEqual([]); // nothing happens after the defeat
    expect(s.month).toBe(month);
  });

  it('remembers the highest population', () => {
    const s = emptyGame({ food: 1000 });
    const b = put(s, 'house', ROADSIDE, 27, 3);
    run(s, 1);
    expect(s.peakPopulation).toBe(10);
    b.level = 1;
    run(s, 1);
    expect(s.peakPopulation).toBe(10);
  });
});

describe('alerts', () => {
  it('lists debt, then negative balance with the costliest kind, then unemployment', () => {
    const s = draining(-1); // market: upkeep 3, 3 jobs
    s.debtMonths = 5;
    expect(alerts(s)).toEqual([
      { kind: 'debt', monthsLeft: RULES.debtMonthsToLose - 5 },
      { kind: 'deficit', balance: -3, costliest: 'market', upkeep: 3 },
    ]);
    s.unlocked.push('workshop', 'temple');
    put(s, 'temple', EAST, 34); // upkeep 10, 2 jobs
    for (let k = 0; k < 5; k++) put(s, 'house', ROADSIDE, 29 + 2 * k, 2); // 30 residents: tax 10, 12 workers
    expect(alerts(s)).toEqual([
      { kind: 'debt', monthsLeft: RULES.debtMonthsToLose - 5 },
      { kind: 'deficit', balance: -3, costliest: 'temple', upkeep: 10 },
      { kind: 'unemployed', count: 7 },
    ]);
    s.silver = 0;
    s.debtMonths = 0;
    s.buildings = s.buildings.filter((b) => b.kind !== 'temple');
    expect(alerts(s)).toEqual([{ kind: 'unemployed', count: 9 }]); // balance +7, 12 workers for 3 jobs
  });
});
