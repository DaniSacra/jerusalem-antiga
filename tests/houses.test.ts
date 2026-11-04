import { describe, expect, it } from 'vitest';
import { balloonNeed, clearCell, HOUSE_LEVELS, houseHappiness, houseInfo, idleShare, RULES, stepWeek, weeksToNextLevel, type GameState } from '../src/core';
import { atHarvest, constRng, EAST, emptyGame, put, ROADSIDE, westOf } from './helpers';

const never = constRng(0.99);
const UP = RULES.weeksToUpgrade;
const DOWN = RULES.weeksToDowngrade;
const gain = (level: number) => HOUSE_LEVELS[level].residents - HOUSE_LEVELS[level - 1].residents;
/** Steps the weeks; unless `hungry`, the food is topped up before each week so no famine gets in the way. */
const run = (s: GameState, weeks: number, rng = never, hungry = false) => {
  const events = [];
  for (let k = 0; k < weeks; k++) {
    if (!hungry) s.food = 1000; // the store keeps what fits, plenty for a week
    events.push(...stepWeek(s, rng));
  }
  return events;
};

describe('house evolution', () => {
  it('levels up after weeksToUpgrade weeks meeting the next needs (road + well)', () => {
    expect(UP).toBeGreaterThan(DOWN); // climbing is slow, dropping is fast
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 30, 1);
    put(s, 'well', ROADSIDE, 32);
    run(s, UP - 1);
    expect(b.level).toBe(1);
    expect(b.upStreak).toBe(UP - 1);
    expect(run(s, 1)).toContainEqual({ type: 'houseUp', x: ROADSIDE, y: 30, level: 2, delta: gain(2) });
    expect(b.upStreak).toBe(0);
  });

  it('is served when any cell of its footprint is covered', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 36, 1); // rows 36..37
    put(s, 'well', ROADSIDE, 27); // radius 4 covers rows 23..32 only
    run(s, UP);
    expect(b.level).toBe(1);
    clearCell(s, ROADSIDE, 27);
    put(s, 'well', ROADSIDE, 28); // now covers rows 24..33: still short of row 36
    run(s, UP);
    expect(b.level).toBe(1);
    put(s, 'well', ROADSIDE, 31); // covers rows 27..36: only the house's top row
    run(s, UP);
    expect(b.level).toBe(2);
  });

  it('a tent without road becomes an empty plot after weeksToDowngrade weeks', () => {
    const s = emptyGame();
    const b = put(s, 'house', 1, 1, 1);
    run(s, DOWN - 1);
    expect(b.level).toBe(1);
    expect(run(s, 1)).toContainEqual({ type: 'houseDown', x: 1, y: 1, level: 0, delta: -gain(1), famine: false });
  });

  it('drops a level when the road is cut', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 40, 2);
    put(s, 'well', ROADSIDE, 38);
    clearCell(s, 24, 30);
    run(s, DOWN - 1);
    expect(b.level).toBe(2);
    run(s, 1);
    expect(b.level).toBe(1);
  });

  it('a need back before weeksToDowngrade weeks keeps the level and restarts the drop count', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 30, 2);
    put(s, 'well', ROADSIDE, 32);
    clearCell(s, ROADSIDE, 32);
    run(s, DOWN - 1);
    expect(b).toMatchObject({ level: 2, downStreak: DOWN - 1 });
    put(s, 'well', ROADSIDE, 32);
    run(s, 1);
    expect(b).toMatchObject({ level: 2, downStreak: 0 });
    clearCell(s, ROADSIDE, 32);
    run(s, DOWN - 1);
    expect(b.level).toBe(2); // counts again from zero
    run(s, 1);
    expect(b.level).toBe(1);
  });

  it('becomes a big house within the radius of the altar', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 27, 3);
    put(s, 'well', ROADSIDE, 29);
    put(s, 'market', westOf('market'), 31);
    run(s, UP);
    expect(b.level).toBe(4);
  });

  it('becomes a big house within the radius of the temple, not outside both', () => {
    const s = emptyGame();
    const far = put(s, 'house', ROADSIDE, 40, 3); // 15 rows from the altar
    put(s, 'well', ROADSIDE, 38);
    put(s, 'market', westOf('market'), 34);
    run(s, UP + 1);
    expect(far.level).toBe(3);
    put(s, 'temple', EAST, 36);
    run(s, UP);
    expect(far.level).toBe(4);
  });

  it('during famine houses do not evolve and those above tents may drop', () => {
    const s = emptyGame({ famine: true, food: 0 });
    put(s, 'well', ROADSIDE, 30);
    const tent = put(s, 'house', ROADSIDE, 32, 1);
    const mud = put(s, 'house', ROADSIDE, 34, 2);
    run(s, UP + 2, constRng(0.5), true); // 0.5: above every famine chance
    expect(s.famine).toBe(true);
    expect(tent.level).toBe(1);
    expect(mud.level).toBe(2);
    expect(run(s, 1, constRng(0.1), true)).toContainEqual({ type: 'houseDown', x: ROADSIDE, y: 34, level: 1, delta: -gain(2), famine: true });
  });

  it('famine pauses the climb: the weeks already counted stay', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 30, 1);
    put(s, 'well', ROADSIDE, 32);
    const before = 5;
    run(s, before);
    expect(b.upStreak).toBe(before);
    s.food = 0;
    run(s, 4, never, true); // four weeks of famine, nobody drops or leaves (rng 0.99)
    expect(s.famine).toBe(true);
    expect(b).toMatchObject({ level: 1, upStreak: before });
    run(s, UP - before - 1); // fed again: counts on from where it stopped
    expect(b).toMatchObject({ level: 1, upStreak: UP - 1 });
    run(s, 1);
    expect(b.level).toBe(2);
  });

  it('losing a need of the next level resets the climb', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 30, 1);
    put(s, 'well', ROADSIDE, 32);
    run(s, UP - 1);
    expect(b.upStreak).toBe(UP - 1);
    clearCell(s, ROADSIDE, 32);
    run(s, 1);
    expect(b).toMatchObject({ level: 1, upStreak: 0 });
    put(s, 'well', ROADSIDE, 32);
    run(s, UP - 1);
    expect(b.level).toBe(1); // a whole new count
    run(s, 1);
    expect(b.level).toBe(2);
  });

  it('losing a need of its own level resets the climb too', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 30, 2);
    put(s, 'well', ROADSIDE, 32);
    s.coverage.market.fill(true);
    b.upStreak = UP - 1;
    clearCell(s, ROADSIDE, 32); // no well: misses its own need
    run(s, 1);
    expect(b).toMatchObject({ level: 2, upStreak: 0, downStreak: 1 });
  });

  it('during famine a tent is abandoned with famineLeaveChance and its family walks away', () => {
    const chance = RULES.famineLeaveChance;
    const s = emptyGame({ famine: true, food: 0 });
    const tent = put(s, 'house', ROADSIDE, 32, 1);
    run(s, 3, constRng(chance), true); // not below the chance: stays (autumn)
    expect(tent.level).toBe(1);
    const events = run(s, 1, constRng(chance - 0.01), true);
    expect(tent.level).toBe(0);
    expect(events).toContainEqual({ type: 'houseDown', x: ROADSIDE, y: 32, level: 0, delta: -gain(1), famine: true });
    expect(events).toContainEqual({ type: 'familyLeft', x: ROADSIDE, y: 32 });
  });

  it('without famine tents are never abandoned', () => {
    const s = emptyGame({ food: 1000 });
    const tent = put(s, 'house', ROADSIDE, 32, 1);
    run(s, 6, constRng(0));
    expect(tent.level).toBeGreaterThanOrEqual(1);
  });
});

describe('weeks to the next level', () => {
  it('counts down from weeksToUpgrade while the next needs are met', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 30, 1);
    expect(weeksToNextLevel(s, b)).toBeNull(); // no well
    put(s, 'well', ROADSIDE, 32);
    expect(weeksToNextLevel(s, b)).toBe(UP);
    for (let k = 1; k < UP; k++) {
      run(s, 1);
      expect(weeksToNextLevel(s, b), `week ${k}`).toBe(UP - k);
    }
    expect(weeksToNextLevel(s, b)).toBe(1);
    run(s, 1);
    expect(b.level).toBe(2);
    expect(weeksToNextLevel(s, b)).toBeNull(); // no market for a stone house
  });

  it('stands still during a famine', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 30, 1);
    put(s, 'well', ROADSIDE, 32);
    run(s, 3);
    s.food = 0;
    run(s, 2, never, true);
    expect(s.famine).toBe(true);
    expect(weeksToNextLevel(s, b)).toBe(UP - 3);
  });

  it('is null at the top, on a plot, for other buildings and when the house misses its own needs', () => {
    const s = emptyGame();
    const top = put(s, 'house', ROADSIDE, 27, HOUSE_LEVELS.length - 1);
    const plot = put(s, 'house', ROADSIDE, 29, 0);
    const field = put(s, 'field', EAST, 27);
    const stone = put(s, 'house', ROADSIDE, 31, 3);
    const cut = put(s, 'house', 1, 1, 2); // no road: misses its own need, and the next level's
    for (const need of ['well', 'market', 'sacred'] as const) s.coverage[need].fill(true); // every service everywhere
    expect(weeksToNextLevel(s, top)).toBeNull();
    expect(weeksToNextLevel(s, plot)).toBeNull();
    expect(weeksToNextLevel(s, field)).toBeNull();
    expect(weeksToNextLevel(s, stone)).toBe(UP);
    expect(cut.connected).toBe(false);
    expect(weeksToNextLevel(s, cut)).toBeNull();
  });

  it('never shows less than 1 week', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 30, 1);
    put(s, 'well', ROADSIDE, 32);
    b.upStreak = UP + 5; // whatever the count, the house climbs on its next week
    expect(weeksToNextLevel(s, b)).toBe(1);
  });
});

describe('house info and balloons', () => {
  it('lists next-level needs including the road', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 30, 2);
    put(s, 'well', ROADSIDE, 32);
    expect(houseInfo(s, b)).toEqual({
      level: 2,
      name: HOUSE_LEVELS[2].name,
      residents: HOUSE_LEVELS[2].residents,
      tax: HOUSE_LEVELS[2].tax, // content: the plain tax
      happiness: houseHappiness(s, b, idleShare(s)),
      next: {
        name: HOUSE_LEVELS[3].name,
        needs: [
          { kind: 'road', ok: true },
          { kind: 'well', ok: true },
          { kind: 'market', ok: false },
        ],
      },
    });
  });

  it('shows "no road" first for any building, then the first missing need if unlocked', () => {
    const s = emptyGame({ unlocked: ['road', 'house', 'field', 'well'] });
    expect(balloonNeed(s, put(s, 'field', 1, 1))).toBe('road');
    expect(balloonNeed(s, put(s, 'house', 5, 5, 0))).toBe('road');
    put(s, 'workshop', EAST, 40); // jobs, so the house is not sad
    const b = put(s, 'house', ROADSIDE, 40, 1);
    expect(balloonNeed(s, b)).toBe('well');
    put(s, 'well', ROADSIDE, 42);
    b.level = 2;
    expect(balloonNeed(s, b)).toBeNull(); // market still locked
    s.unlocked.push('market');
    expect(balloonNeed(s, b)).toBe('market');
    put(s, 'market', westOf('market'), 36);
    b.level = 3;
    expect(balloonNeed(s, b)).toBe('sacred');
    b.level = 4;
    expect(balloonNeed(s, b)).toBeNull();
    b.level = 0;
    expect(balloonNeed(s, b)).toBeNull();
  });

  it('shows "no workers" on workplaces only while nobody can work', () => {
    const s = emptyGame();
    const field = put(s, 'field', westOf('field'), 30);
    const well = put(s, 'well', ROADSIDE, 33);
    const plot = put(s, 'house', ROADSIDE, 35);
    s.week = RULES.weeksPerSeason; // winter: a frozen field needs nobody
    expect(balloonNeed(s, field)).toBeNull();
    atHarvest(s);
    expect(balloonNeed(s, field)).toBe('workers');
    expect(balloonNeed(s, well)).toBeNull(); // no jobs
    expect(balloonNeed(s, plot)).toBeNull();
    expect(balloonNeed(s, put(s, 'workshop', 1, 1))).toBe('road'); // no road comes first
    plot.level = 1; // a tent brings workers
    expect(balloonNeed(s, field)).toBeNull();
  });
});
