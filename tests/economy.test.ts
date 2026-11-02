import { describe, expect, it } from 'vitest';
import { computeEconomy } from '../src/core';
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
    put(s, 'house', ROADSIDE, 26, 3); // 10 residents -> 4 workers (40%)
    put(s, 'field', westOf('field'), 28);
    put(s, 'field', westOf('field'), 31); // 6 jobs
    let e = computeEconomy(s);
    expect(e).toMatchObject({ workers: 4, jobs: 6 });
    expect(e.efficiency).toBeCloseTo(4 / 6);
    expect(e.foodDelta).toBeCloseTo(2 * 3 * (4 / 6) - 10 * 0.2);
    put(s, 'house', ROADSIDE, 34, 4);
    e = computeEconomy(s);
    expect(e.efficiency).toBe(1);
  });

  it('ignores jobs and production of disconnected buildings', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 26, 3); // 10 residents, 3.5 tax
    put(s, 'field', 1, 1);
    put(s, 'workshop', 5, 1);
    put(s, 'market', 9, 1);
    const e = computeEconomy(s);
    expect(e.jobs).toBe(0);
    expect(e.foodDelta).toBeCloseTo(-2);
    expect(e.silverDelta).toBeCloseTo(3.5);
    put(s, 'workshop', westOf('workshop'), 28);
    expect(computeEconomy(s).silverDelta).toBeCloseTo(3.5 + 5);
  });

  it('counts temple jobs once connected', () => {
    const s = emptyGame();
    put(s, 'temple', EAST, 30);
    expect(computeEconomy(s).jobs).toBe(2);
  });
});
