import { describe, expect, it } from 'vitest';
import { calendar, createGame, createRng, RULES, seasonCount, seasonOf, seasonStarts, SEASONS, START_SEASON, stepWeek, type GameEvent } from '../src/core';
import { emptyGame } from './helpers';

const M = RULES.weeksPerSeason;

describe('seasons', () => {
  it('has 13 weeks per season and starts in autumn', () => {
    expect(M).toBe(13);
    expect(RULES.startSeason).toBe('autumn');
  });

  it('starts in autumn and goes autumn, winter, spring, summer, then autumn again', () => {
    expect(SEASONS).toEqual(['spring', 'summer', 'autumn', 'winter']);
    expect(seasonOf(0)).toBe('autumn');
    expect(seasonOf(M - 1)).toBe('autumn');
    expect(seasonOf(M)).toBe('winter');
    expect(seasonOf(2 * M)).toBe('spring');
    expect(seasonOf(3 * M)).toBe('summer');
    expect(seasonOf(4 * M - 1)).toBe('summer');
    expect(seasonOf(4 * M)).toBe('autumn');
  });

  it('marks the first week of each season, but not the start of the game', () => {
    expect(seasonStarts(0)).toBe(false);
    expect(seasonStarts(1)).toBe(false);
    expect(seasonStarts(M)).toBe(true);
    expect(seasonStarts(3 * M)).toBe(true);
  });

  it('emits one season event when a week opens a new season', () => {
    const s = emptyGame({ week: M - 2 });
    const rng = createRng(1);
    const seasons = (e: GameEvent[]) => e.filter((x) => x.type === 'season');
    expect(seasons(stepWeek(s, rng))).toEqual([]);
    expect(seasons(stepWeek(s, rng))).toEqual([{ type: 'season', season: 'winter' }]);
    expect(seasons(stepWeek(s, rng))).toEqual([]);
  });
});

describe('seasons over a full year', () => {
  it('emits winter, spring, summer and autumn in order, one every season, over 4 seasons', () => {
    const s = emptyGame({ week: 0 });
    const rng = createRng(42);
    const got: { week: number; season: string }[] = [];
    for (let k = 0; k < 4 * M; k++) {
      for (const e of stepWeek(s, rng)) if (e.type === 'season') got.push({ week: s.week, season: e.season });
    }
    expect(got).toEqual([
      { week: M, season: 'winter' },
      { week: 2 * M, season: 'spring' },
      { week: 3 * M, season: 'summer' },
      { week: 4 * M, season: 'autumn' },
    ]);
  });
});

describe('season count and the farming year', () => {
  it('counts seasons from the spring before the game, so the game starts at the autumn index', () => {
    expect(START_SEASON).toBe(SEASONS.indexOf('autumn'));
    expect(seasonCount(0)).toBe(START_SEASON);
    expect(seasonCount(M - 1)).toBe(START_SEASON);
    expect(seasonCount(M)).toBe(START_SEASON + 1);
    for (let w = 0; w < 3 * 4 * M; w += 5) expect(SEASONS[seasonCount(w) % 4]).toBe(seasonOf(w));
  });

  it('the year begins in autumn: summer closes year 1, the next week opens year 2', () => {
    expect(calendar(4 * M - 1)).toEqual({ season: 'summer', year: 1, week: M });
    expect(calendar(4 * M)).toEqual({ season: 'autumn', year: 2, week: 1 });
    expect(calendar(2 * M)).toEqual({ season: 'spring', year: 1, week: 1 });
  });

  it('a new game is in week 1 of the autumn of year 1', () => {
    const s = createGame(createRng(11));
    expect(s.week).toBe(0);
    expect(calendar(s.week)).toEqual({ season: 'autumn', year: 1, week: 1 });
  });
});
