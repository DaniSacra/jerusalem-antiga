import { describe, expect, it } from 'vitest';
import { BUILDINGS, checkGoal, computeEconomy, costliestUpkeep, HOUSE_LEVELS, RULES, stepMonth, unemployed, unemploymentAlert, upkeepCharged, type GameEvent } from '../src/core';
import { EAST, emptyGame, put, ROADSIDE, westOf } from './helpers';

describe('economy', () => {
  it('is 100% efficient without jobs', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 27, 1); // next to the altar: content even without a job, plain tax
    const e = computeEconomy(s);
    expect(e).toMatchObject({ residents: 3, workers: 1, jobs: 0, efficiency: 1, silverDelta: 1 });
    expect(e.foodDelta).toBeCloseTo(-0.6);
  });

  it('scales production by efficiency, capped at 100%', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 27, 3); // 10 residents -> 4 workers (40%)
    put(s, 'field', westOf('field'), 29);
    put(s, 'field', westOf('field'), 32);
    put(s, 'field', westOf('field'), 35); // 6 jobs
    let e = computeEconomy(s);
    expect(e).toMatchObject({ workers: 4, jobs: 6 });
    expect(e.efficiency).toBeCloseTo(4 / 6);
    expect(e.foodDelta).toBeCloseTo(3 * 3 * (4 / 6) - 10 * 0.25); // a stone house eats 0.25 per resident
    expect(e.production.field).toBeCloseTo(3 * 1 * (4 / 6), 2);
    put(s, 'house', ROADSIDE, 38, 4);
    e = computeEconomy(s);
    expect(e.efficiency).toBe(1);
  });

  it('ignores jobs and production of disconnected buildings, but still charges their upkeep', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 27, 3); // 10 residents, 3.5 tax
    put(s, 'field', 1, 1);
    put(s, 'workshop', 5, 1);
    put(s, 'market', 9, 1);
    const up = (k: 'field' | 'workshop' | 'market') => BUILDINGS[k].upkeep!;
    const e = computeEconomy(s);
    expect(e.jobs).toBe(0);
    expect(e.foodDelta).toBeCloseTo(-2.5);
    expect(e.production).toEqual({});
    expect(e).toMatchObject({ taxes: 3.5, upkeep: { field: up('field'), workshop: up('workshop'), market: up('market') } });
    expect(e.silverDelta).toBeCloseTo(3.5 - up('field') - up('workshop') - up('market'));
    put(s, 'workshop', westOf('workshop'), 29);
    expect(computeEconomy(s).silverDelta).toBeCloseTo(3.5 + 5 - up('field') - 2 * up('workshop') - up('market'));
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
    expect(Object.fromEntries(Object.entries(BUILDINGS).filter(([, d]) => d.upkeep).map(([k, d]) => [k, d.upkeep]))).toEqual({
      well: 3,
      field: 1,
      market: 4,
      workshop: 2,
      garden: 1,
      temple: 10,
    });
    expect(e.upkeep).toEqual({ well: 3, field: 1, market: 4, workshop: 2, temple: 10 });
    expect(costliestUpkeep(e)).toEqual({ kind: 'temple', amount: 10 });
    expect(e.silverDelta).toBeCloseTo(e.taxes + (e.production.workshop ?? 0) + (e.production.field ?? 0) - 20); // the balance shown as +X/mês
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

describe('field production (Campo é trabalho)', () => {
  it('a field has 2 jobs and makes 1 silver', () => {
    expect(BUILDINGS.field).toMatchObject({ jobs: 2, silver: 1, food: 3 });
  });

  it('makes its full silver at 100% efficiency and adds it to the balance', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 27, 3); // 10 residents -> 4 workers, 3.5 tax
    put(s, 'field', westOf('field'), 29); // 2 jobs
    const e = computeEconomy(s);
    expect(e).toMatchObject({ jobs: 2, efficiency: 1, production: { field: 1 } });
    expect(e.silverDelta).toBeCloseTo(3.5 + 1 - BUILDINGS.field.upkeep!);
  });

  it('makes no silver with zero workers, but the kind is listed at 0', () => {
    const s = emptyGame();
    put(s, 'field', westOf('field'), 29);
    const e = computeEconomy(s);
    expect(e).toMatchObject({ workers: 0, jobs: 2, efficiency: 0, production: { field: 0 } });
    expect(e.silverDelta).toBeCloseTo(-BUILDINGS.field.upkeep!);
  });

  it('a disconnected field gives no silver or jobs until it touches the network', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 27, 3);
    const far = put(s, 'field', 1, 1);
    expect(far.connected).toBe(false);
    let e = computeEconomy(s);
    expect(e.production.field).toBeUndefined();
    expect(e.jobs).toBe(0);
    put(s, 'field', westOf('field'), 29);
    e = computeEconomy(s);
    expect(e.jobs).toBe(2);
    expect(e.production.field).toBe(1); // only the connected one, both pay upkeep
    expect(e.upkeep.field).toBe(2 * BUILDINGS.field.upkeep!);
  });

  it('counts field and workshop production together, both scaled by the same efficiency', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 27, 3); // 4 workers, 3.5 tax
    put(s, 'field', westOf('field'), 29); // 2 jobs
    put(s, 'workshop', EAST, 27); // 3 jobs -> 5 jobs, efficiency 0.8
    const e = computeEconomy(s);
    expect(e.efficiency).toBeCloseTo(0.8);
    expect(e.production.field).toBeCloseTo(1 * 0.8);
    expect(e.production.workshop).toBeCloseTo(BUILDINGS.workshop.silver! * 0.8);
    expect(e.silverDelta).toBeCloseTo(3.5 + e.production.field! + e.production.workshop! - BUILDINGS.field.upkeep! - BUILDINGS.workshop.upkeep!);
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
    put(s, 'field', EAST, 27); // 2 jobs
    expect(unemployed(s)).toBe(5);
    put(s, 'workshop', EAST, 29); // + 3 = 5 jobs
    expect(unemployed(s)).toBe(2);
    put(s, 'field', EAST, 32); // 7 jobs for 7 workers
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
    put(s, 'field', EAST, 27); // 2 jobs: 4 without work, the alert goes away
    expect(unemploymentAlert(s)).toBe(0);
  });
});

describe('upkeep starts after goal 2', () => {
  it('charges no upkeep, no deficit and no debt before it', () => {
    const s = emptyGame({ goalIndex: RULES.upkeepStartsAfterGoal - 1, silver: 0 });
    put(s, 'well', ROADSIDE, 29);
    put(s, 'field', EAST, 27);
    expect(upkeepCharged(s)).toBe(false);
    const e = computeEconomy(s);
    expect(e.upkeep).toEqual({});
    expect(e.silverDelta).toBeGreaterThanOrEqual(0);
    stepMonth(s, () => 0.99);
    expect(s.silver).toBeGreaterThanOrEqual(0);
    expect(s.debtMonths).toBe(0);
  });

  it('charges it from the first month after the goal, and announces it once', () => {
    expect(RULES.upkeepStartsAfterGoal).toBe(2);
    const s = emptyGame({ goalIndex: 1, silver: 0 });
    put(s, 'well', ROADSIDE, 29);
    for (let y = 31; y <= 43; y += 2) put(s, 'house', ROADSIDE, y, 1); // 21 residents: goal 2 done
    const events: GameEvent[] = [];
    checkGoal(s, events);
    expect(events.filter((e) => e.type === 'upkeepStart')).toHaveLength(1);
    expect(computeEconomy(s).upkeep).toEqual({ well: BUILDINGS.well.upkeep });
    const later: GameEvent[] = [];
    s.goalIndex = 3;
    checkGoal(s, later); // other goals never announce it again
    expect(later.some((e) => e.type === 'upkeepStart')).toBe(false);
  });
});

