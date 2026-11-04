import { describe, expect, it } from 'vitest';
import {
  checkGoal,
  computeEconomy,
  createRng,
  foodForecast,
  foodLastsToHarvest,
  lastsToHarvest,
  plannedEating,
  RULES,
  stepWeek,
  targetLevel,
  nextFieldTurn,
  seasonOf,
  weeksToHarvest,
  WEEKS_PER_YEAR,
} from '../src/core';
import { besideRiver, constRng, EAST, emptyGame, put, ROADSIDE, westOf } from './helpers';

const never = constRng(0.99);

describe('target level of a house', () => {
  it('is the level it settles at with the services it has now', () => {
    const s = emptyGame();
    const tent = put(s, 'house', ROADSIDE, 27, 1);
    const plot = put(s, 'house', ROADSIDE, 29);
    expect(targetLevel(s, tent)).toBe(1);
    expect(targetLevel(s, plot)).toBe(0);
    put(s, 'well', EAST, 27);
    expect(targetLevel(s, tent)).toBe(2); // climbs with a well
    const stone = put(s, 'house', ROADSIDE, 31, 3);
    expect(targetLevel(s, stone)).toBe(2); // no market: drops to mud-brick
    s.coverage.market.fill(true);
    s.coverage.sacred.fill(true);
    expect(targetLevel(s, tent)).toBe(4); // climbs every level it can
  });
});

describe('food forecast at the target level', () => {
  it('a new well changes the forecast at once, before the tents climb', () => {
    const s = emptyGame({ food: 20 });
    put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'house', ROADSIDE, 29, 1);
    expect(foodForecast(s)?.weeks).toBe(16); // 1.2 a week
    put(s, 'well', EAST, 27);
    expect(foodForecast(s)?.weeks).toBe(11); // two mud-brick houses: 1.8 a week
    expect(plannedEating(s).eaten).toBeCloseTo(1.8);
    expect(computeEconomy(s).foodEaten).toBeCloseTo(1.2); // the houses still eat as tents today
  });

  it('counts extra tents (families on the way)', () => {
    const s = emptyGame({ food: 20 });
    put(s, 'house', ROADSIDE, 27, 1);
    expect(plannedEating(s, 2)).toEqual({ residents: 9, eaten: expect.closeTo(1.8) });
    expect(foodForecast(s, computeEconomy(s), WEEKS_PER_YEAR, { extraTents: 2 })?.weeks).toBe(11);
  });

  it('goal 1 is not done in week 1 when the houses will climb and starve before the spring', () => {
    const s = emptyGame({ food: 40, goalIndex: 0 });
    put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'house', ROADSIDE, 29, 1);
    put(s, 'well', EAST, 27); // as tents 40 would last 33 weeks; as mud-brick houses only 22
    checkGoal(s, []);
    expect(s.goalIndex).toBe(0);
  });

  it('lastsToHarvest agrees with foodLastsToHarvest, also when nothing runs out', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const rng = createRng(seed);
      const s = emptyGame({ food: Math.floor(rng() * 80), week: Math.floor(rng() * WEEKS_PER_YEAR) });
      const tents = Math.floor(rng() * 5);
      for (let k = 0; k < tents; k++) put(s, 'house', ROADSIDE, 27 + 2 * k, 1);
      if (rng() < 0.5) put(s, 'field', westOf('field'), 37);
      if (rng() < 0.5) put(s, 'granary', EAST, 36);
      const out = foodForecast(s);
      expect(lastsToHarvest(s, out), `seed ${seed}`).toBe(foodLastsToHarvest(s));
    }
    expect(lastsToHarvest(emptyGame(), null)).toBe(true);
  });

  it('gives the same famine week as the weekly step', () => {
    let starved = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const rng = createRng(seed);
      const s = emptyGame({ food: Math.floor(rng() * 40), week: Math.floor(rng() * WEEKS_PER_YEAR) });
      const tents = 2 + Math.floor(rng() * 5); // no well: they stay tents
      for (let k = 0; k < tents; k++) put(s, 'house', ROADSIDE, 27 + 2 * k, 1);
      if (rng() < 0.4) put(s, 'fisher', besideRiver(s, 30), 30);
      if (rng() < 0.3) put(s, 'fisher', besideRiver(s, 34), 34);
      const fields = Math.floor(rng() * 2);
      for (let k = 0; k < fields; k++) put(s, 'field', EAST, 38 + 2 * k);
      if (rng() < 0.3) put(s, 'granary', westOf('granary'), 40);
      const out = foodForecast(s, computeEconomy(s), 30);
      let famineAt: number | null = null;
      for (let k = 0; k < 30 && famineAt === null; k++) {
        stepWeek(s, never); // no drought, no family, nobody leaves
        if (s.famine) famineAt = k;
      }
      expect(famineAt, `seed ${seed}`).toBe(out?.weeks ?? null);
      if (famineAt !== null) starved++;
    }
    expect(starved).toBeGreaterThan(10); // the cases cover both outcomes
    expect(starved).toBeLessThan(70);
    expect(RULES.familyChance).toBeLessThan(0.99);
    expect(weeksToHarvest(0)).toBeGreaterThan(0);
  });
});

describe('next turn of the fields', () => {
  it('out of winter counts down to the first winter week; in winter, to the spring', () => {
    for (let w = 0; w < 2 * WEEKS_PER_YEAR; w++) {
      const turn = nextFieldTurn(w);
      if (seasonOf(w) === 'winter') {
        expect(turn).toEqual({ season: 'spring', weeks: weeksToHarvest(w) });
        expect(seasonOf(w + turn.weeks)).toBe('spring');
      } else {
        expect(turn.season).toBe('winter');
        expect(seasonOf(w + turn.weeks)).toBe('winter');
        expect(seasonOf(w + turn.weeks - 1)).not.toBe('winter');
      }
    }
    expect(nextFieldTurn(0)).toEqual({ season: 'winter', weeks: RULES.weeksPerSeason }); // the game starts in autumn
  });
});
