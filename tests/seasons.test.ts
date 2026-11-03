import { describe, expect, it } from 'vitest';
import { createRng, RULES, seasonOf, seasonStarts, SEASONS, stepMonth, type GameEvent } from '../src/core';
import { emptyGame } from './helpers';

const M = RULES.monthsPerSeason;

describe('seasons', () => {
  it('starts in spring and goes spring, summer, autumn, winter, then spring again', () => {
    expect(SEASONS).toEqual(['spring', 'summer', 'autumn', 'winter']);
    expect(seasonOf(0)).toBe('spring');
    expect(seasonOf(M - 1)).toBe('spring');
    expect(seasonOf(M)).toBe('summer');
    expect(seasonOf(2 * M)).toBe('autumn');
    expect(seasonOf(4 * M - 1)).toBe('winter');
    expect(seasonOf(4 * M)).toBe('spring');
  });

  it('marks the first month of each season, but not the start of the game', () => {
    expect(seasonStarts(0)).toBe(false);
    expect(seasonStarts(1)).toBe(false);
    expect(seasonStarts(M)).toBe(true);
    expect(seasonStarts(3 * M)).toBe(true);
  });

  it('emits one season event when a month opens a new season', () => {
    const s = emptyGame({ month: M - 2 });
    const rng = createRng(1);
    const seasons = (e: GameEvent[]) => e.filter((x) => x.type === 'season');
    expect(seasons(stepMonth(s, rng))).toEqual([]);
    expect(seasons(stepMonth(s, rng))).toEqual([{ type: 'season', season: 'summer' }]);
    expect(seasons(stepMonth(s, rng))).toEqual([]);
  });
});

describe('seasons over a full year', () => {
  it('emits summer, autumn, winter and spring in order, one every season, over 4 seasons', () => {
    const s = emptyGame({ month: 0 });
    const rng = createRng(42);
    const got: { month: number; season: string }[] = [];
    for (let k = 0; k < 4 * M; k++) {
      for (const e of stepMonth(s, rng)) if (e.type === 'season') got.push({ month: s.month, season: e.season });
    }
    expect(got).toEqual([
      { month: M, season: 'summer' },
      { month: 2 * M, season: 'autumn' },
      { month: 3 * M, season: 'winter' },
      { month: 4 * M, season: 'spring' },
    ]);
  });
});
