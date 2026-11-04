import { describe, expect, it } from 'vitest';
import { alerts, BUILDINGS, checkClear, clearCell, place, RULES, stepWeek, type GameEvent, type GameState } from '../src/core';
import { constRng, EAST, emptyGame, put, ROADSIDE } from './helpers';

const never = constRng(0.99);
const run = (s: GameState, weeks: number) => {
  const events: GameEvent[] = [];
  for (let k = 0; k < weeks; k++) events.push(...stepWeek(s, never));
  return events;
};

/** Weekly upkeep of the market. */
const U = BUILDINGS.market.upkeep!;

/** A city whose only building is a market: no taxes, U silver of upkeep per week. */
const draining = (silver: number) => {
  const s = emptyGame({ silver: 1000, food: 1000 });
  put(s, 'market', EAST, 27);
  s.silver = silver;
  return s;
};

describe('upkeep and debt', () => {
  it('charges upkeep every week and lets silver go negative', () => {
    const s = draining(U + 1);
    run(s, 1);
    expect(s.silver).toBe(1);
    run(s, 1);
    expect(s.silver).toBe(1 - U);
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

  it('starts counting the week silver ends negative, and resets at zero or more', () => {
    const s = draining(U - 1);
    expect(run(s, 1)).toContainEqual({ type: 'debtStart' }); // ends at -1
    expect(s.debtWeeks).toBe(1);
    run(s, 2);
    expect(s.debtWeeks).toBe(3);
    s.silver = U; // e.g. a goal reward
    expect(run(s, 1)).toContainEqual({ type: 'debtEnd' }); // ends at 0: not debt
    expect(s.debtWeeks).toBe(0);
    expect(run(s, 1)).toContainEqual({ type: 'debtStart' });
    expect(s.debtWeeks).toBe(1);
  });

  it(`loses exactly after ${RULES.debtWeeksToLose} consecutive weeks in debt`, () => {
    expect(RULES.debtWeeksToLose).toBe(24);
    const s = draining(-1);
    s.peakPopulation = 42;
    const before = run(s, RULES.debtWeeksToLose - 1);
    expect(before.some((e) => e.type === 'defeat')).toBe(false);
    expect(s.lost).toBe(false);
    expect(run(s, 1)).toContainEqual({ type: 'defeat', week: RULES.debtWeeksToLose, peak: 42 });
    expect(s.lost).toBe(true);
    const week = s.week;
    expect(run(s, 3)).toEqual([]); // nothing happens after the defeat
    expect(s.week).toBe(week);
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
    const s = draining(-1); // market: upkeep U, 3 jobs
    s.debtWeeks = 5;
    expect(alerts(s)).toEqual([
      { kind: 'debt', weeksLeft: RULES.debtWeeksToLose - 5, famine: false },
      { kind: 'deficit', balance: -U, costliest: 'market', upkeep: U },
    ]);
    s.unlocked.push('workshop', 'temple');
    put(s, 'temple', EAST, 34); // upkeep 10, 2 jobs
    for (let k = 0; k < 5; k++) put(s, 'house', ROADSIDE, 29 + 2 * k, 2); // 30 residents: tax 10, 15 workers
    // (30 residents and no food buildings: the food warning shows too, tested in survival.test.ts)
    expect(alerts(s).filter((a) => a.kind !== 'foodShort')).toEqual([
      { kind: 'debt', weeksLeft: RULES.debtWeeksToLose - 5, famine: false },
      { kind: 'deficit', balance: 10 - 10 - U, costliest: 'temple', upkeep: 10 }, // taxes - temple - market
      { kind: 'unemployed', count: 10 },
    ]);
    s.silver = 0;
    s.debtWeeks = 0;
    s.buildings = s.buildings.filter((b) => b.kind !== 'temple');
    expect(alerts(s).filter((a) => a.kind !== 'foodShort')).toEqual([{ kind: 'unemployed', count: 12 }]); // balance 10 - U > 0, 15 workers for 3 jobs
  });

  it('in debt and famine at once, the debt alert says so (demolish to afford a field)', () => {
    const s = draining(-1);
    s.famine = true;
    expect(alerts(s)[0]).toEqual({ kind: 'debt', weeksLeft: RULES.debtWeeksToLose, famine: true });
  });
});
