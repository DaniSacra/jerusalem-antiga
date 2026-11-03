import { describe, expect, it } from 'vitest';
import {
  balanceAfter,
  calendar,
  checkPlace,
  cityLevel,
  computeEconomy,
  goalCount,
  goalFraction,
  GOALS,
  housesByLevel,
  housesServed,
  needMet,
  place,
  RULES,
  spotsServing,
  upgradeGain,
} from '../src/core';
import { EAST, emptyGame, put, ROADSIDE } from './helpers';

describe('city level and goal progress', () => {
  it('level is goals done + 1', () => {
    expect(cityLevel(emptyGame({ goalIndex: 0 }))).toBe(1);
    expect(cityLevel(emptyGame({ goalIndex: 2 }))).toBe(3);
  });

  it('progress is the share of the current goal, capped at 1', () => {
    const s = emptyGame({ goalIndex: 1 }); // water for every house, at least 4
    put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'house', ROADSIDE, 29, 1);
    expect(goalFraction(s)).toBe(0);
    put(s, 'well', EAST, 27);
    expect(goalFraction(s)).toBeCloseTo(2 / 4);
    put(s, 'well', EAST, 33);
    for (let y = 31; y <= 35; y += 2) put(s, 'house', ROADSIDE, y);
    expect(goalFraction(s)).toBe(1); // 5 of 5
    expect(goalFraction(emptyGame({ goalIndex: 2, harvested: 40 }))).toBe(1); // 40 of 12
  });

  it('progress of the food goal follows the shrinking target, and is 1 once the spring came', () => {
    const s = emptyGame({ goalIndex: 0, food: 6 });
    put(s, 'house', ROADSIDE, 27, 1); // lasts 9 weeks, the spring is 26 away
    expect(goalFraction(s)).toBeCloseTo(9 / 26);
    s.week = 13;
    expect(goalFraction(s)).toBeCloseTo(9 / 13);
    s.week = 26;
    expect(goalFraction(s)).toBe(1);
  });

  it('progress is 1 once every goal is done', () => {
    expect(goalCount()).toBe(GOALS.length);
    expect(goalFraction(emptyGame({ goalIndex: GOALS.length }))).toBe(1);
  });
});

describe('calendar', () => {
  const perSeason = RULES.weeksPerSeason;

  it('starts in autumn of year 1, week 1', () => {
    expect(calendar(0)).toEqual({ season: 'autumn', year: 1, week: 1 });
  });

  it('counts the week inside the season and the year after four seasons', () => {
    expect(calendar(perSeason - 1)).toEqual({ season: 'autumn', year: 1, week: perSeason });
    expect(calendar(perSeason)).toEqual({ season: 'winter', year: 1, week: 1 });
    expect(calendar(4 * perSeason + 4)).toEqual({ season: 'autumn', year: 2, week: 5 });
  });
});

describe('balance after building', () => {
  it('takes out the upkeep of the new building', () => {
    const s = emptyGame();
    const now = computeEconomy(s).silverDelta;
    expect(balanceAfter(s, 'well')).toBeCloseTo(now - 3);
    expect(balanceAfter(s, 'temple')).toBeCloseTo(now - 10);
  });

  it('counts no upkeep before upkeep is charged', () => {
    const s = emptyGame({ goalIndex: 0 });
    expect(balanceAfter(s, 'well')).toBe(computeEconomy(s).silverDelta);
  });

  it('adds the production a new workplace makes with the workers there are', () => {
    const s = emptyGame();
    for (let y = 27; y <= 45; y += 2) put(s, 'house', ROADSIDE, y, 4); // 160 residents, 64 workers
    const now = computeEconomy(s).silverDelta;
    expect(balanceAfter(s, 'workshop')).toBeCloseTo(now + 5 - 2);
  });

  it('does not change the city', () => {
    const s = emptyGame();
    const n = s.buildings.length;
    balanceAfter(s, 'market');
    expect(s.buildings.length).toBe(n);
  });
});

describe('houses served', () => {
  it('counts houses with a family inside the radius of a service', () => {
    const s = emptyGame();
    const well = put(s, 'well', EAST, 27);
    put(s, 'house', ROADSIDE, 27, 1); // inside
    put(s, 'house', ROADSIDE, 29); // empty plot: not counted
    put(s, 'house', ROADSIDE, 41, 1); // too far (radius 4)
    expect(housesServed(s, well)).toBe(1);
  });

  it('is 0 for a disconnected service and null for kinds without one', () => {
    const s = emptyGame();
    const well = put(s, 'well', 2, 2);
    put(s, 'house', 4, 2, 1);
    expect(housesServed(s, well)).toBe(0);
    expect(housesServed(s, put(s, 'workshop', EAST, 30))).toBeNull();
  });
});

describe('house upgrade gain', () => {
  it('gives the residents and tax gained on the next level', () => {
    expect(upgradeGain(1)).toEqual({ residents: 3, tax: 1 });
    expect(upgradeGain(3)).toEqual({ residents: 6, tax: 2.5 });
  });

  it('is null at the top level', () => {
    expect(upgradeGain(4)).toBeNull();
  });
});

describe('spots serving a building', () => {
  it('every spot is a valid place whose radius reaches the house', () => {
    const s = emptyGame();
    const house = put(s, 'house', ROADSIDE, 40, 1);
    const spots = spotsServing(s, 'well', house);
    expect(spots.length).toBeGreaterThan(0);
    for (const c of spots) expect(checkPlace(s, 'well', c.x, c.y, c.rotated).ok).toBe(true);
    const c = spots[0];
    place(s, 'well', c.x, c.y, c.rotated);
    expect(needMet(s, house, 'well')).toBe(true);
  });

  it('leaves out places too far from the house', () => {
    const s = emptyGame();
    const house = put(s, 'house', ROADSIDE, 40, 1);
    for (const c of spotsServing(s, 'well', house)) {
      expect(Math.abs(c.y - house.y)).toBeLessThanOrEqual(4 + 2);
    }
    expect(spotsServing(s, 'well', house).some((c) => c.y < 30)).toBe(false);
  });

  it('tries both orientations of a non-square building', () => {
    const s = emptyGame();
    const house = put(s, 'house', ROADSIDE, 40, 1);
    const spots = spotsServing(s, 'market', house);
    expect(spots.some((c) => c.rotated)).toBe(true);
    expect(spots.some((c) => !c.rotated)).toBe(true);
    for (const c of spots) expect(checkPlace(s, 'market', c.x, c.y, c.rotated).ok).toBe(true);
  });
});

describe('houses by level', () => {
  it('counts every house per level, empty plots included', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 27);
    put(s, 'house', ROADSIDE, 29, 1);
    put(s, 'house', ROADSIDE, 31, 1);
    put(s, 'house', ROADSIDE, 33, 4);
    put(s, 'well', EAST, 27); // not a house
    expect(housesByLevel(s)).toEqual([1, 2, 0, 0, 1]);
  });
});

describe('food made and eaten', () => {
  it('splits the food balance into production and consumption', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 27, 2); // 6 residents eating 0.2 each
    put(s, 'field', EAST, 27);
    s.week = 2 * RULES.weeksPerSeason; // first spring: the field built in autumn harvests
    const e = computeEconomy(s);
    expect(e.foodEaten).toBeCloseTo(1.2);
    expect(e.foodMade).toBeCloseTo(e.foodDelta + e.foodEaten);
    expect(e.foodMade).toBeGreaterThan(0);
  });
});
