import { describe, expect, it } from 'vitest';
import {
  BUILDINGS,
  checkGoal,
  computeEconomy,
  createRng,
  fieldBonus,
  foodForecast,
  foodPerResident,
  HOUSE_LEVELS,
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
import { besideRiver, constRng, EAST, emptyGame, put, ROADSIDE, weeksOfFood, westOf } from './helpers';

const never = constRng(0.99);
const W = RULES.weeksPerSeason;
/** Food eaten in week w by `count` houses of a level. */
const eatAt = (level: number, count: number) => (w: number) => count * HOUSE_LEVELS[level].residents * foodPerResident(level, w);

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
    const asTents = weeksOfFood(20, 0, eatAt(1, 2));
    expect(foodForecast(s)?.weeks).toBe(asTents);
    put(s, 'well', EAST, 27);
    const asMud = weeksOfFood(20, 0, eatAt(2, 2));
    expect(asMud).toBeLessThan(asTents);
    expect(foodForecast(s)?.weeks).toBe(asMud); // two mud-brick houses
    expect(plannedEating(s).eaten).toBeCloseTo(eatAt(2, 2)(0));
    expect(computeEconomy(s).foodEaten).toBeCloseTo(eatAt(1, 2)(0)); // the houses still eat as tents today
  });

  it('counts extra tents (families on the way)', () => {
    const s = emptyGame({ food: 20 });
    put(s, 'house', ROADSIDE, 27, 1);
    expect(plannedEating(s, 2)).toEqual({
      residents: 3 * HOUSE_LEVELS[1].residents,
      eaten: expect.closeTo(eatAt(1, 3)(0)),
      winterEaten: expect.closeTo(eatAt(1, 3)(W)),
    });
    expect(foodForecast(s, computeEconomy(s), WEEKS_PER_YEAR, { extraTents: 2 })?.weeks).toBe(weeksOfFood(20, 0, eatAt(1, 3)));
  });

  it('plans each house at most one level above the current one', () => {
    const top = HOUSE_LEVELS.length - 1;
    for (let level = 1; level <= top; level++) {
      const s = emptyGame();
      const b = put(s, 'house', ROADSIDE, 27, level);
      for (const need of ['well', 'market', 'sacred'] as const) s.coverage[need].fill(true); // it could reach the top
      expect(targetLevel(s, b)).toBe(top);
      const planned = Math.min(level + 1, top);
      expect(plannedEating(s), `level ${level}`).toEqual({
        residents: HOUSE_LEVELS[planned].residents,
        eaten: expect.closeTo(eatAt(planned, 1)(0)),
        winterEaten: expect.closeTo(eatAt(planned, 1)(W)),
      });
    }
  });

  it('plans a house that misses its own needs at the level it drops to', () => {
    const s = emptyGame();
    const stone = put(s, 'house', ROADSIDE, 27, 3); // no well, no market: drops to a tent
    expect(targetLevel(s, stone)).toBe(1);
    expect(plannedEating(s).residents).toBe(HOUSE_LEVELS[1].residents);
  });
});

describe('winter in the forecast', () => {
  it('eats the winter amount in winter weeks: foodFactor for houses, tentFoodFactor for tents', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'house', ROADSIDE, 29, 3);
    s.coverage.well.fill(false);
    const p = plannedEating(s);
    // The stone house has no services: it is planned as a tent too.
    expect(p.residents).toBe(2 * HOUSE_LEVELS[1].residents);
    expect(p.winterEaten).toBeCloseTo(p.eaten * RULES.winter.tentFoodFactor);
    const m = emptyGame();
    put(m, 'well', EAST, 27);
    put(m, 'house', ROADSIDE, 27, 2); // mud-brick, with water: planned as mud-brick (no market)
    const q = plannedEating(m);
    expect(q.residents).toBe(HOUSE_LEVELS[2].residents);
    expect(q.winterEaten).toBeCloseTo(q.eaten * RULES.winter.foodFactor);
  });

  it('a stock that lasts through the autumn runs out sooner across the winter', () => {
    for (const start of [0, W - 3, W, W + 5]) {
      const s = emptyGame({ food: 30, week: start });
      put(s, 'house', ROADSIDE, 27, 1);
      put(s, 'house', ROADSIDE, 29, 1);
      const out = foodForecast(s);
      const expected = weeksOfFood(30, start, eatAt(1, 2));
      expect(out?.weeks, `from week ${start}`).toBe(expected);
      expect(out?.season).toBe(seasonOf(start + expected));
    }
    // In winter the same stock lasts fewer weeks than in autumn.
    const autumn = emptyGame({ food: 20, week: 0 });
    const winter = emptyGame({ food: 20, week: W });
    for (const s of [autumn, winter]) put(s, 'house', ROADSIDE, 27, 1);
    expect(foodForecast(winter)!.weeks).toBeLessThan(foodForecast(autumn)!.weeks);
  });

  it('with reserveWeeks the food runs out once it drops to that many weeks of eating', () => {
    const s = emptyGame({ food: 30 });
    put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'house', ROADSIDE, 29, 1);
    const eco = computeEconomy(s);
    const floor = 3 * plannedEating(s).eaten;
    const out = foodForecast(s, eco, WEEKS_PER_YEAR, { reserveWeeks: 3 });
    expect(out?.weeks).toBe(weeksOfFood(30, 0, eatAt(1, 2), floor));
    expect(out!.weeks).toBeLessThan(foodForecast(s, eco)!.weeks);
    expect(foodForecast(s, eco, WEEKS_PER_YEAR, { reserveWeeks: 0 })).toEqual(foodForecast(s, eco));
  });
});

describe('workshop bonus in the forecast', () => {
  it('the fields bring more food with workshops: a field short of the eating becomes enough', () => {
    const s = emptyGame({ food: 5, week: 2 * W }); // spring: the field is at work
    for (const y of [27, 29, 31]) put(s, 'house', ROADSIDE, y, 4);
    for (const y of [33, 35]) put(s, 'house', ROADSIDE, y, 1);
    put(s, 'field', westOf('field'), 38);
    const serve = () => {
      for (const need of ['well', 'market', 'sacred'] as const) s.coverage[need].fill(true);
    };
    serve();
    const base = BUILDINGS.field.harvest! / (3 * W);
    const eaten = plannedEating(s).eaten;
    // The data this test relies on: one field alone falls short, with the full bonus it is enough.
    expect(eaten).toBeGreaterThan(base);
    expect(eaten).toBeLessThan(base * (1 + BUILDINGS.workshop.fieldBonusMax!));
    const before = foodForecast(s, computeEconomy(s), W);
    expect(before).not.toBeNull();
    put(s, 'workshop', EAST, 27);
    put(s, 'workshop', EAST, 30);
    put(s, 'workshop', EAST, 33);
    serve();
    expect(fieldBonus(s)).toBeCloseTo(BUILDINGS.workshop.fieldBonusMax!);
    expect(computeEconomy(s).efficiency).toBe(1);
    expect(foodForecast(s, computeEconomy(s), W)).toBeNull();
  });
});

describe('food forecast and steps', () => {
  it('goal 1 is not done in week 1 when the houses will climb and starve before the spring', () => {
    const s = emptyGame({ food: 40, goalIndex: 0 });
    put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'house', ROADSIDE, 29, 1);
    put(s, 'well', EAST, 27); // 40 lasts the tents longer than the mud-brick houses they become
    expect(weeksOfFood(40, 0, eatAt(2, 2))).toBeLessThan(2 * W);
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
