import { describe, expect, it } from 'vitest';
import { alerts, BUILDINGS, refreshCity, caravanSpares, checkClear, HOUSE_LEVELS, clearCell, place, RULES, stepWeek, type GameEvent, type GameState } from '../src/core';
import { constRng, EAST, emptyGame, put, ROADSIDE } from './helpers';

const never = constRng(0.99);
const run = (s: GameState, weeks: number) => {
  const events: GameEvent[] = [];
  for (let k = 0; k < weeks; k++) events.push(...stepWeek(s, never));
  return events;
};

/** Weekly upkeep of the market, empty (as in `draining`: it pays `emptyUpkeepFactor` of it). */
const U = BUILDINGS.market.upkeep! * RULES.emptyUpkeepFactor;
/** Weekly upkeep of a market with people working. */
const FULL = BUILDINGS.market.upkeep!;

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

  it(`no defeat while a later caravan is due within ${RULES.debtCaravanWeeks} weeks: the count stops one week short and the warning stays`, () => {
    const L = RULES.debtWeeksToLose;
    const s = draining(-1);
    const due = RULES.debtCaravanWeeks; // planned at week 0, it comes at the edge of the window
    s.caravans = [{ week: due, families: 1, warn: 4, status: 'planned', housed: 0, left: 0 }];
    expect(caravanSpares(s)).toBe(true);
    const before = run(s, due - 1);
    expect(before.some((e) => e.type === 'defeat')).toBe(false);
    expect(s.lost).toBe(false);
    expect(s.debtWeeks).toBe(L - 1);
    expect(alerts(s)).toContainEqual(expect.objectContaining({ kind: 'debt', weeksLeft: 1 }));
    expect(s.caravans[0].status).toBe('announced'); // announced spares too
    // It comes with no empty house: nobody stays, nothing spares the city any more.
    expect(run(s, 1)).toContainEqual(expect.objectContaining({ type: 'defeat' }));
    expect(s.lost).toBe(true);
  });

  it('a caravan further away than the window, skipped or arrived does not spare the city', () => {
    for (const status of ['planned', 'skipped', 'arrived'] as const) {
      const s = draining(-1);
      const week = status === 'planned' ? RULES.debtCaravanWeeks + RULES.debtWeeksToLose + 1 : 30;
      s.caravans = [{ week, families: 1, warn: 4, status, housed: 0, left: 0 }];
      expect(caravanSpares(s)).toBe(false);
      run(s, RULES.debtWeeksToLose);
      expect(s.lost, status).toBe(true);
    }
  });

  it('remembers the highest population', () => {
    const s = emptyGame({ food: 1000 });
    const b = put(s, 'house', ROADSIDE, 27, 3);
    run(s, 1);
    expect(s.peakPopulation).toBe(6);
    s.people.splice(0, 3); // three leave
    run(s, 1);
    expect(s.peakPopulation).toBe(6);
    void b;
  });
});

describe('alerts', () => {
  it('lists debt, then negative balance with the costliest kind, then unemployment', () => {
    const s = draining(-1); // market: upkeep U, 3 jobs
    s.debtWeeks = 5;
    expect(alerts(s)).toEqual([
      { kind: 'debt', weeksLeft: RULES.debtWeeksToLose - 5, famine: false },
      { kind: 'deficit', balance: -U, costliest: 'market', upkeep: U },
      { kind: 'noCrew', building: 'market', count: 1, upkeep: U }, // nobody lives here to work at it
    ]);
    s.unlocked.push('workshop');
    const second = put(s, 'market', EAST, 34); // upkeep U, 3 jobs
    for (let k = 0; k < 2; k++) put(s, 'house', ROADSIDE, 29 + 2 * k, 2, false, 9); // crowded: 18 adults
    const tax = 2 * HOUSE_LEVELS[2].tax;
    expect(tax).toBeLessThan(2 * FULL);
    // (18 residents and no food buildings: the food and births warnings show too, tested elsewhere)
    expect(alerts(s).filter((a) => a.kind !== 'foodShort' && a.kind !== 'noBirths')).toEqual([
      { kind: 'debt', weeksLeft: RULES.debtWeeksToLose - 5, famine: false },
      { kind: 'deficit', balance: tax - 2 * FULL, costliest: 'market', upkeep: 2 * FULL }, // taxes - two staffed markets
      { kind: 'unemployed', count: 12, workshopsFull: false },
    ]);
    s.silver = 0;
    s.debtWeeks = 0;
    s.buildings = s.buildings.filter((b) => b !== second);
    refreshCity(s); // its crew is out of work again
    expect(alerts(s).filter((a) => a.kind !== 'foodShort' && a.kind !== 'noBirths')).toEqual([{ kind: 'unemployed', count: 15, workshopsFull: false }]); // balance tax - FULL > 0, 18 workers for 3 jobs
  });

  it('the unemployment alert says when the workshops already give their whole field bonus', () => {
    const s = draining(0);
    s.unlocked.push('workshop');
    for (let k = 0; k < 6; k++) put(s, 'house', ROADSIDE, 29 + 2 * k, 4); // many workers
    const ws = BUILDINGS.workshop;
    const full = Math.ceil(ws.fieldBonusMax! / ws.fieldBonus!);
    for (let k = 0; k < full; k++) {
      const a = alerts(s).find((x) => x.kind === 'unemployed');
      expect(a).toMatchObject({ workshopsFull: false });
      put(s, 'workshop', EAST, 31 + 3 * k); // below the market
    }
    expect(alerts(s).find((x) => x.kind === 'unemployed')).toMatchObject({ workshopsFull: true });
  });

  it('in debt and famine at once, the debt alert says so (demolish to afford a field)', () => {
    const s = draining(-1);
    s.famine = true;
    expect(alerts(s)[0]).toEqual({ kind: 'debt', weeksLeft: RULES.debtWeeksToLose, famine: true });
  });
});
