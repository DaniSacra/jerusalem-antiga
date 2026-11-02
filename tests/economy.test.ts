import { describe, expect, it } from 'vitest';
import { computeEconomy } from '../src/core';
import { emptyGame, place } from './helpers';

describe('economy', () => {
  it('is 100% efficient without jobs', () => {
    const s = emptyGame();
    place(s, 'house', 1, 1, 1);
    const e = computeEconomy(s);
    expect(e).toMatchObject({ residents: 3, workers: 1, jobs: 0, efficiency: 1, silverDelta: 1 });
    expect(e.foodDelta).toBeCloseTo(-0.6);
  });

  it('scales production by efficiency, capped at 100%', () => {
    const s = emptyGame();
    place(s, 'house', 1, 1, 2); // 6 residents -> 3 workers
    place(s, 'field', 2, 1);
    place(s, 'field', 3, 1); // 4 jobs
    let e = computeEconomy(s);
    expect(e.efficiency).toBe(0.75);
    expect(e.foodDelta).toBeCloseTo(2 * 3 * 0.75 - 6 * 0.2);

    place(s, 'house', 1, 2, 4); // +16 residents
    e = computeEconomy(s);
    expect(e.efficiency).toBe(1);
    expect(e.foodDelta).toBeCloseTo(6 - 22 * 0.2);
  });

  it('adds taxes and workshop silver', () => {
    const s = emptyGame();
    place(s, 'house', 1, 1, 3); // 10 residents, 3.5 tax -> 5 workers
    place(s, 'workshop', 2, 1); // 3 jobs
    expect(computeEconomy(s).silverDelta).toBeCloseTo(3.5 + 5);
  });
});
