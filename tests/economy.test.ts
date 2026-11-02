import { describe, expect, it } from 'vitest';
import { computeEconomy, costliestUpkeep, HOUSE_LEVELS, RULES, unemployed, unemploymentAlert } from '../src/core';
import { EAST, emptyGame, put, ROADSIDE, westOf } from './helpers';

describe('economy', () => {
  it('is 100% efficient without jobs', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 30, 1);
    const e = computeEconomy(s);
    expect(e).toMatchObject({ residents: 3, workers: 1, jobs: 0, efficiency: 1, silverDelta: 1 });
    expect(e.foodDelta).toBeCloseTo(-0.6);
  });

  it('scales production by efficiency, capped at 100%', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 27, 3); // 10 residents -> 4 workers (40%)
    put(s, 'field', westOf('field'), 29);
    put(s, 'field', westOf('field'), 32); // 6 jobs
    let e = computeEconomy(s);
    expect(e).toMatchObject({ workers: 4, jobs: 6 });
    expect(e.efficiency).toBeCloseTo(4 / 6);
    expect(e.foodDelta).toBeCloseTo(2 * 3 * (4 / 6) - 10 * 0.25); // a stone house eats 0.25 per resident
    put(s, 'house', ROADSIDE, 35, 4);
    e = computeEconomy(s);
    expect(e.efficiency).toBe(1);
  });

  it('ignores jobs and production of disconnected buildings, but still charges their upkeep', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 27, 3); // 10 residents, 3.5 tax
    put(s, 'field', 1, 1); // upkeep 1
    put(s, 'workshop', 5, 1); // upkeep 2
    put(s, 'market', 9, 1); // upkeep 3
    const e = computeEconomy(s);
    expect(e.jobs).toBe(0);
    expect(e.foodDelta).toBeCloseTo(-2.5);
    expect(e).toMatchObject({ taxes: 3.5, workshops: 0, upkeep: { field: 1, workshop: 2, market: 3 } });
    expect(e.silverDelta).toBeCloseTo(3.5 - 6);
    put(s, 'workshop', westOf('workshop'), 29);
    expect(computeEconomy(s).silverDelta).toBeCloseTo(3.5 + 5 - 8);
  });

  it('charges the upkeep of buildings.json; roads, houses and the altar are free', () => {
    const s = emptyGame();
    expect(computeEconomy(s).upkeep).toEqual({}); // altar and starting roads
    put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'well', ROADSIDE, 29);
    put(s, 'field', EAST, 27);
    put(s, 'market', westOf('market') - 2, 31);
    put(s, 'workshop', EAST, 30);
    put(s, 'temple', EAST, 34);
    const e = computeEconomy(s);
    expect(e.upkeep).toEqual({ well: 1, field: 1, market: 3, workshop: 2, temple: 10 });
    expect(costliestUpkeep(e)).toEqual({ kind: 'temple', amount: 10 });
    expect(e.silverDelta).toBeCloseTo(e.taxes + e.workshops - 17); // the balance shown as +X/mês
  });

  it('eats food per resident according to the house level', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 27, 1);
    const eaten = () => -computeEconomy(s).foodDelta;
    expect(HOUSE_LEVELS.map((l) => l.food)).toEqual([0, 0.2, 0.2, 0.25, 0.3]);
    expect(eaten()).toBeCloseTo(3 * 0.2);
    b.level = 2;
    expect(eaten()).toBeCloseTo(6 * 0.2);
    b.level = 3;
    expect(eaten()).toBeCloseTo(10 * 0.25);
    b.level = 4;
    expect(eaten()).toBeCloseTo(16 * 0.3);
  });

  it('counts temple jobs once connected', () => {
    const s = emptyGame();
    put(s, 'temple', EAST, 30);
    expect(computeEconomy(s).jobs).toBe(2);
  });
});

describe('unemployment', () => {
  // Three level-2 houses: 18 residents -> floor(18 * 0.4) = 7 workers.
  const houses = (s: ReturnType<typeof emptyGame>, n: number) => {
    for (let k = 0; k < n; k++) put(s, 'house', ROADSIDE, 27 + 2 * k, 2);
  };

  it('counts workers without a job, never below 0', () => {
    const s = emptyGame();
    houses(s, 3);
    expect(unemployed(s)).toBe(7);
    put(s, 'field', EAST, 27); // 3 jobs
    expect(unemployed(s)).toBe(4);
    put(s, 'field', EAST, 29);
    put(s, 'field', EAST, 31); // 9 jobs for 7 workers
    expect(unemployed(s)).toBe(0);
  });

  it('alerts only once the workshop is unlocked and from the threshold up', () => {
    const s = emptyGame({ unlocked: ['road', 'house', 'field', 'well', 'market'] });
    expect(RULES.unemploymentAlert).toBe(6);
    put(s, 'house', ROADSIDE, 27, 3); // 10 residents
    const tent = put(s, 'house', ROADSIDE, 29, 1); // + 3 = 13 residents -> 5 workers, no jobs
    s.unlocked.push('workshop');
    expect(unemploymentAlert(s)).toBe(0); // 5: below the threshold
    tent.level = 2; // 16 residents -> 6 workers
    expect(unemploymentAlert(s)).toBe(6);
    s.unlocked = s.unlocked.filter((k) => k !== 'workshop');
    expect(unemploymentAlert(s)).toBe(0); // workshop still locked
    s.unlocked.push('workshop');
    put(s, 'field', EAST, 27); // 3 jobs: 3 without work, the alert goes away
    expect(unemploymentAlert(s)).toBe(0);
  });
});
