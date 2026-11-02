import { describe, expect, it } from 'vitest';
import { computeEconomy } from '../src/core';
import { emptyGame, put, ROADSIDE } from './helpers';

describe('economy', () => {
  it('is 100% efficient without jobs', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 20, 1);
    const e = computeEconomy(s);
    expect(e).toMatchObject({ residents: 3, workers: 1, jobs: 0, efficiency: 1, silverDelta: 1 });
    expect(e.foodDelta).toBeCloseTo(-0.6);
  });

  it('scales production by efficiency, capped at 100%', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 20, 2); // 6 residents -> 3 workers
    put(s, 'field', ROADSIDE, 21);
    put(s, 'field', ROADSIDE, 22); // 4 jobs
    let e = computeEconomy(s);
    expect(e.efficiency).toBe(0.75);
    expect(e.foodDelta).toBeCloseTo(2 * 3 * 0.75 - 6 * 0.2);
    put(s, 'house', ROADSIDE, 23, 4);
    e = computeEconomy(s);
    expect(e.efficiency).toBe(1);
  });

  it('ignores jobs and production of disconnected buildings', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 20, 3); // 10 residents, 3.5 tax
    put(s, 'field', 3, 3);
    put(s, 'workshop', 5, 5);
    put(s, 'market', 7, 7);
    const e = computeEconomy(s);
    expect(e.jobs).toBe(0);
    expect(e.foodDelta).toBeCloseTo(-2);
    expect(e.silverDelta).toBeCloseTo(3.5);
    put(s, 'workshop', ROADSIDE, 21);
    expect(computeEconomy(s).silverDelta).toBeCloseTo(3.5 + 5);
  });

  it('counts temple jobs once connected', () => {
    const s = emptyGame();
    put(s, 'temple', 17, 20);
    expect(computeEconomy(s).jobs).toBe(2);
  });
});
