import { describe, expect, it } from 'vitest';
import { balloonNeed, needLocked, clearCell, HOUSE_LEVELS, indexOf, refreshCity, houseHappiness, houseInfo, idleShare, RULES, stepWeek, unlockingGoal, weeksToNextLevel, type GameState } from '../src/core';
import { atHarvest, constRng, EAST, emptyGame, put, road, ROADSIDE, UP_WEEKS, westOf } from './helpers';

const never = constRng(0.99);
const UP = UP_WEEKS;
const DOWN = RULES.weeksToDowngrade;
const gain = (level: number) => HOUSE_LEVELS[level].capacity - HOUSE_LEVELS[level - 1].capacity;
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
  it('levels up after weeksToUpgrade weeks meeting the next needs (road + plaza)', () => {
    expect(UP).toBeGreaterThan(DOWN); // climbing is slow, dropping is fast
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 30, 1);
    put(s, 'plaza', ROADSIDE, 32);
    run(s, UP - 1);
    expect(b.level).toBe(1);
    expect(b.upStreak).toBe(UP - 1);
    expect(run(s, 1)).toContainEqual({ type: 'houseUp', x: ROADSIDE, y: 30, level: 2, delta: gain(2) });
    expect(b.upStreak).toBe(0);
  });

  it('is served when any cell of its footprint is covered', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 36, 1); // rows 36..37
    put(s, 'plaza', ROADSIDE, 27); // radius 4 covers rows 23..32 only
    run(s, UP);
    expect(b.level).toBe(1);
    clearCell(s, ROADSIDE, 27);
    put(s, 'plaza', ROADSIDE, 28); // now covers rows 24..33: still short of row 36
    run(s, UP);
    expect(b.level).toBe(1);
    put(s, 'plaza', ROADSIDE, 31); // covers rows 27..36: only the house's top row
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
    put(s, 'plaza', ROADSIDE, 38);
    clearCell(s, 24, 30);
    run(s, DOWN - 1);
    expect(b.level).toBe(2);
    run(s, 1);
    expect(b.level).toBe(1);
  });

  it('a need back before weeksToDowngrade weeks keeps the level and restarts the drop count', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 30, 2);
    put(s, 'plaza', ROADSIDE, 32);
    clearCell(s, ROADSIDE, 32);
    run(s, DOWN - 1);
    expect(b).toMatchObject({ level: 2, downStreak: DOWN - 1 });
    put(s, 'plaza', ROADSIDE, 32);
    run(s, 1);
    expect(b).toMatchObject({ level: 2, downStreak: 0 });
    clearCell(s, ROADSIDE, 32);
    run(s, DOWN - 1);
    expect(b.level).toBe(2); // counts again from zero
    run(s, 1);
    expect(b.level).toBe(1);
  });

  it('a big house needs a park: the altar radius is not enough', () => {
    expect(HOUSE_LEVELS.map((l) => l.needs)).toEqual([[], ['road'], ['road', 'plaza'], ['road', 'plaza', 'market'], ['road', 'plaza', 'market', 'park']]);
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 27, 3); // by the altar
    put(s, 'plaza', ROADSIDE, 29);
    put(s, 'market', westOf('market'), 31);
    put(s, 'workshop', 1, 40); // not sad for want of jobs (disconnected: no jobs, no effect)
    expect(s.coverage.sacred[indexOf(s, ROADSIDE, 27)]).toBe(true);
    run(s, UP + 1);
    expect(b.level).toBe(3);
    expect(weeksToNextLevel(s, b)).toBeNull();
    put(s, 'park', EAST, 27);
    expect(weeksToNextLevel(s, b)).toBe(UP);
    run(s, UP);
    expect(b.level).toBe(4);
  });

  it('the temple radius does not make a big house either; a park far from both does', () => {
    const s = emptyGame();
    const far = put(s, 'house', ROADSIDE, 40, 3); // 15 rows from the altar
    put(s, 'plaza', ROADSIDE, 38);
    put(s, 'market', westOf('market'), 34);
    put(s, 'temple', EAST, 36);
    expect(s.coverage.sacred[indexOf(s, ROADSIDE, 40)]).toBe(true);
    run(s, UP + 1);
    expect(far.level).toBe(3);
    put(s, 'park', EAST, 42);
    run(s, UP);
    expect(far.level).toBe(4);
  });

  it('a big house that loses its park drops to a stone house', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 27, 4);
    put(s, 'plaza', ROADSIDE, 29);
    put(s, 'market', westOf('market'), 31);
    put(s, 'park', EAST, 27);
    run(s, DOWN);
    expect(b.level).toBe(4);
    clearCell(s, EAST, 27);
    run(s, DOWN);
    expect(b.level).toBe(3);
  });

  it('a mud-brick house needs only a plaza; a stone house a plaza and a market', () => {
    const s = emptyGame();
    const mud = put(s, 'house', ROADSIDE, 30, 1);
    s.coverage.market.fill(true);
    s.coverage.park.fill(true);
    s.coverage.sacred.fill(true);
    run(s, UP + 1);
    expect(mud.level).toBe(1); // market, park and altar without a plaza: still a tent
    const t = emptyGame();
    const tent = put(t, 'house', ROADSIDE, 30, 1);
    put(t, 'plaza', ROADSIDE, 32);
    run(t, UP);
    expect(tent.level).toBe(2); // the plaza alone is enough
    run(t, UP + 1);
    expect(tent.level).toBe(2); // no market: stays mud-brick
    put(t, 'market', westOf('market'), 34);
    run(t, tent.upWeeks); // drawn again at the new level
    expect(tent.level).toBe(3);
  });

  it('during famine houses do not evolve and those above tents may drop', () => {
    const s = emptyGame({ famine: true, food: 0 });
    put(s, 'plaza', ROADSIDE, 30);
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
    put(s, 'plaza', ROADSIDE, 32);
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
    put(s, 'plaza', ROADSIDE, 32);
    run(s, UP - 1);
    expect(b.upStreak).toBe(UP - 1);
    clearCell(s, ROADSIDE, 32);
    run(s, 1);
    expect(b).toMatchObject({ level: 1, upStreak: 0 });
    put(s, 'plaza', ROADSIDE, 32);
    run(s, UP - 1);
    expect(b.level).toBe(1); // a whole new count
    run(s, 1);
    expect(b.level).toBe(2);
  });

  it('losing a need of its own level resets the climb too', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 30, 2);
    put(s, 'plaza', ROADSIDE, 32);
    s.coverage.market.fill(true);
    b.upStreak = UP - 1;
    clearCell(s, ROADSIDE, 32); // no plaza: misses its own need
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
    expect(events).toContainEqual(expect.objectContaining({ type: 'familyLeft', x: ROADSIDE, y: 32, reason: 'famine' }));
  });

  it('a tent that loses its road drops to a plot and its family leaves (reason road)', () => {
    const s = emptyGame({ food: 1000 });
    const tent = put(s, 'house', ROADSIDE - 1, 30, 1);
    road(s, [[ROADSIDE + 1, 30]]);
    expect(tent.connected).toBe(true);
    s.roads[indexOf(s, ROADSIDE + 1, 30)] = false;
    refreshCity(s);
    const events = run(s, DOWN);
    expect(tent.level).toBe(0);
    expect(events).toContainEqual(expect.objectContaining({ type: 'familyLeft', x: ROADSIDE - 1, y: 30, reason: 'road' }));
    expect(events.filter((e) => e.type === 'familyLeft')).toHaveLength(1);
  });

  it('a stone house that loses its road only sends its family away when it reaches a plot', () => {
    const s = emptyGame({ food: 1000 });
    const house = put(s, 'house', ROADSIDE - 1, 30, 3);
    road(s, [[ROADSIDE + 1, 30]]);
    s.roads[indexOf(s, ROADSIDE + 1, 30)] = false;
    refreshCity(s);
    const drops = run(s, 2 * DOWN);
    expect(house.level).toBe(1);
    expect(drops.some((e) => e.type === 'familyLeft')).toBe(false);
    expect(run(s, DOWN)).toContainEqual(expect.objectContaining({ type: 'familyLeft', x: ROADSIDE - 1, y: 30, reason: 'road' }));
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
    expect(weeksToNextLevel(s, b)).toBeNull(); // no plaza
    put(s, 'plaza', ROADSIDE, 32);
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
    put(s, 'plaza', ROADSIDE, 32);
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
    for (const need of ['plaza', 'market', 'park'] as const) s.coverage[need].fill(true); // every service everywhere
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
    put(s, 'plaza', ROADSIDE, 32);
    b.upStreak = UP + 5; // whatever the count, the house climbs on its next week
    expect(weeksToNextLevel(s, b)).toBe(1);
  });
});

describe('house info and balloons', () => {
  it('lists next-level needs including the road', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 30, 2);
    put(s, 'plaza', ROADSIDE, 32);
    expect(houseInfo(s, b)).toEqual({
      level: 2,
      name: HOUSE_LEVELS[2].name,
      residents: HOUSE_LEVELS[2].capacity,
      capacity: HOUSE_LEVELS[2].capacity,
      tax: HOUSE_LEVELS[2].tax, // content: the plain tax
      happiness: houseHappiness(s, b, idleShare(s)),
      next: {
        name: HOUSE_LEVELS[3].name,
        needs: [
          { kind: 'road', ok: true },
          { kind: 'plaza', ok: true },
          { kind: 'market', ok: false },
        ],
      },
    });
  });

  it('shows "no road" first for any building, then the first missing need if unlocked', () => {
    const s = emptyGame({ unlocked: ['road', 'house', 'field', 'plaza'] });
    expect(balloonNeed(s, put(s, 'field', 1, 1))).toBe('road');
    expect(balloonNeed(s, put(s, 'house', 5, 5, 0))).toBe('road');
    put(s, 'workshop', EAST, 40); // jobs, so the house is not sad
    const b = put(s, 'house', ROADSIDE, 40, 1);
    expect(balloonNeed(s, b)).toBe('plaza');
    put(s, 'plaza', ROADSIDE, 42);
    b.level = 2;
    s.unlocked.push('market');
    expect(balloonNeed(s, b)).toBe('market');
    put(s, 'market', westOf('market'), 36);
    b.level = 3;
    s.unlocked.push('park');
    expect(balloonNeed(s, b)).toBe('park'); // the altar is near, but only a park makes a big house
    put(s, 'park', EAST, 43);
    expect(balloonNeed(s, b)).toBeNull();
    b.level = 4;
    expect(balloonNeed(s, b)).toBeNull();
    b.level = 0;
    expect(balloonNeed(s, b)).toBeNull();
  });

  it('house info lists a locked need too, and the goal that unlocks it', () => {
    const s = emptyGame({ unlocked: ['road', 'house', 'plaza'] });
    put(s, 'plaza', ROADSIDE, 32);
    const stone = put(s, 'house', ROADSIDE, 30, 3);
    expect(houseInfo(s, stone)!.next!.needs).toEqual([
      { kind: 'road', ok: true },
      { kind: 'plaza', ok: true },
      { kind: 'market', ok: false },
      { kind: 'park', ok: false },
    ]);
    expect(s.unlocked).not.toContain('park');
    expect(unlockingGoal('market')).toBe(4);
    expect(unlockingGoal('park')).toBe(7);
  });

  it('needLocked: only a service need whose building is still locked', () => {
    const s = emptyGame({ unlocked: ['road', 'house', 'plaza'] });
    expect(needLocked(s, 'market')).toBe(true);
    expect(needLocked(s, 'park')).toBe(true);
    expect(needLocked(s, 'plaza')).toBe(false);
    for (const k of ['road', 'workers', 'sad', 'noSource'] as const) expect(needLocked(s, k)).toBe(false);
    s.unlocked.push('market', 'park');
    expect(needLocked(s, 'market')).toBe(false);
    expect(needLocked(s, 'park')).toBe(false);
  });

  // Plan P2 2.6: the balloon shows a locked need, with a lock (see needLocked).
  it('the balloon shows the first missing need even while it is locked (plan P2 2.6)', () => {
    const s = emptyGame({ unlocked: ['road', 'house', 'plaza'] });
    put(s, 'workshop', EAST, 40); // jobs, so the house is not sad
    const b = put(s, 'house', ROADSIDE, 40, 2);
    put(s, 'plaza', ROADSIDE, 42);
    expect(balloonNeed(s, b)).toBe('market');
    put(s, 'market', westOf('market'), 36);
    b.level = 3;
    expect(balloonNeed(s, b)).toBe('park');
  });

  it('shows "no workers" on workplaces only while nobody can work', () => {
    const s = emptyGame();
    const field = put(s, 'field', westOf('field'), 30);
    const plaza = put(s, 'plaza', ROADSIDE, 33);
    const plot = put(s, 'house', ROADSIDE, 35);
    s.week = RULES.weeksPerSeason; // winter: a frozen field needs nobody
    expect(balloonNeed(s, field)).toBeNull();
    atHarvest(s);
    expect(balloonNeed(s, field)).toBe('workers');
    expect(balloonNeed(s, plaza)).toBeNull(); // no jobs
    expect(balloonNeed(s, plot)).toBeNull();
    expect(balloonNeed(s, put(s, 'workshop', 1, 1))).toBe('road'); // no road comes first
    put(s, 'house', ROADSIDE, 37, 1); // a tent brings workers
    expect(balloonNeed(s, field)).toBeNull();
  });
});
