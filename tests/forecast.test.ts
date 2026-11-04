import { describe, expect, it } from 'vitest';
import {
  BUILDINGS,
  computeEconomy,
  createRng,
  fieldBonus,
  foodForecast,
  foodOf,
  HOUSE_LEVELS,
  foodLastsToHarvest,
  lastsToHarvest,
  RULES,
  stepWeek,
  targetLevel,
  nextFieldTurn,
  seasonOf,
  weeksToHarvest,
  WEEKS_PER_YEAR,
} from '../src/core';
import { besideRiver, constRng, EAST, emptyGame, person, put, ROADSIDE, weeksOfFood, westOf } from './helpers';

const never = constRng(0.99);
const W = RULES.weeksPerSeason;
/** Food eaten in week w by `count` full houses of a level (adults). */
const eatAt = (level: number, count: number) => (w: number) => count * HOUSE_LEVELS[level].capacity * foodOf('adult', level, w);

describe('target level of a house', () => {
  it('is the level it settles at with the services it has now', () => {
    const s = emptyGame();
    const tent = put(s, 'house', ROADSIDE, 27, 1);
    const plot = put(s, 'house', ROADSIDE, 29);
    expect(targetLevel(s, tent)).toBe(1);
    expect(targetLevel(s, plot)).toBe(0);
    put(s, 'plaza', EAST, 27);
    expect(targetLevel(s, tent)).toBe(2); // climbs with a plaza
    const stone = put(s, 'house', ROADSIDE, 31, 3);
    expect(targetLevel(s, stone)).toBe(2); // no market: drops to mud-brick
    s.coverage.market.fill(true);
    s.coverage.sacred.fill(true);
    expect(targetLevel(s, tent)).toBe(3); // the altar's radius is not a need: stops at stone
    s.coverage.park.fill(true);
    expect(targetLevel(s, tent)).toBe(4); // climbs every level it can
  });
});

describe('food forecast with the people of the city', () => {
  it('counts what the people living here eat now: a new plaza changes nothing until the houses climb', () => {
    const s = emptyGame({ food: 20 });
    put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'house', ROADSIDE, 29, 1);
    const asTents = weeksOfFood(20, 0, eatAt(1, 2));
    expect(foodForecast(s)?.weeks).toBe(asTents);
    put(s, 'plaza', EAST, 27);
    expect(foodForecast(s)?.weeks).toBe(asTents); // a house that climbs brings nobody by itself
  });

  it('people on the way neither count nor eat', () => {
    const s = emptyGame({ food: 20 });
    put(s, 'house', ROADSIDE, 27, 1);
    const before = foodForecast(s);
    person(s, { houseId: null, age: 30 });
    person(s, { houseId: null, age: 5 });
    expect(foodForecast(s)).toEqual(before);
  });

  it('children eat more and elders less than adults', () => {
    const s = emptyGame({ food: 20 });
    const h = put(s, 'house', ROADSIDE, 27, 2, false, 0);
    for (let k = 0; k < 4; k++) person(s, { houseId: h.id, age: 5 });
    const kids = foodForecast(s)!.weeks;
    s.people = [];
    for (let k = 0; k < 4; k++) person(s, { houseId: h.id, age: 60 });
    expect(foodForecast(s)!.weeks).toBeGreaterThan(kids);
  });
});

describe('winter in the forecast', () => {
  it('eats the winter amount in winter weeks: foodFactor for houses, tentFoodFactor for tents', () => {
    const s = emptyGame({ food: 30, week: W });
    put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'house', ROADSIDE, 29, 2);
    const eat = (w: number) => eatAt(1, 1)(w) + eatAt(2, 1)(w);
    expect(eat(W)).toBeCloseTo(3 * 0.2 * RULES.winter.tentFoodFactor + 4 * 0.2 * RULES.winter.foodFactor);
    expect(foodForecast(s)?.weeks).toBe(weeksOfFood(30, W, eat));
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
    const floor = 3 * eatAt(1, 2)(0);
    const out = foodForecast(s, eco, WEEKS_PER_YEAR, { reserveWeeks: 3 });
    expect(out?.weeks).toBe(weeksOfFood(30, 0, eatAt(1, 2), floor));
    expect(out!.weeks).toBeLessThan(foodForecast(s, eco)!.weeks);
    expect(foodForecast(s, eco, WEEKS_PER_YEAR, { reserveWeeks: 0 })).toEqual(foodForecast(s, eco));
  });
});

describe('workshop bonus in the forecast', () => {
  it('the fields bring more food with workshops: a field short of the eating becomes enough', () => {
    const s = emptyGame({ food: 5, week: 2 * W }); // spring: the field is at work
    for (const y of [27, 29, 31]) put(s, 'house', ROADSIDE, y, 4, false, 20); // crowded: 66 people in all
    for (const y of [33, 35]) put(s, 'house', ROADSIDE, y, 1);
    put(s, 'field', westOf('field'), 38);
    const serve = () => {
      for (const need of ['plaza', 'market', 'park'] as const) s.coverage[need].fill(true);
    };
    serve();
    const base = BUILDINGS.field.harvest! / (3 * W);
    const eaten = computeEconomy(s).foodEaten;
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
      const tents = 2 + Math.floor(rng() * 5); // no plaza: they stay tents
      for (let k = 0; k < tents; k++) put(s, 'house', ROADSIDE, 27 + 2 * k, 1);
      if (rng() < 0.4) put(s, 'fisher', besideRiver(s, 30), 30);
      if (rng() < 0.3) put(s, 'fisher', besideRiver(s, 34), 34);
      const fields = Math.floor(rng() * 2);
      for (let k = 0; k < fields; k++) put(s, 'field', EAST, 38 + 2 * k);
      if (rng() < 0.3) put(s, 'granary', westOf('granary'), 40);
      const out = foodForecast(s, computeEconomy(s), 30);
      let famineAt: number | null = null;
      for (let k = 0; k < 30 && famineAt === null; k++) {
        stepWeek(s, never); // no drought, no birth, nobody leaves
        if (s.famine) famineAt = k;
      }
      expect(famineAt, `seed ${seed}`).toBe(out?.weeks ?? null);
      if (famineAt !== null) starved++;
    }
    expect(starved).toBeGreaterThan(10); // the cases cover both outcomes
    expect(starved).toBeLessThan(70);
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
