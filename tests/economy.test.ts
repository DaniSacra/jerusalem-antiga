import { describe, expect, it } from 'vitest';
import {
  BUILDINGS,
  computeEconomy,
  costliestUpkeep,
  fieldBonus,
  fieldHarvest,
  foodOf,
  gatherYield,
  HOUSE_LEVELS,
  idleShare,
  indexOf,
  RULES,
  seasonOf,
  stepWeek,
  unemployed,
  unemploymentAlert,
} from '../src/core';
import { atHarvest, besideRiver, EAST, emptyGame, person, put, ROADSIDE, westOf } from './helpers';

const W = RULES.weeksPerSeason;
/** Weeks of the year a field gives food (all but winter). */
const FIELD_WEEKS = 3 * W;
const T = HOUSE_LEVELS[1];
/** What an adult eats out of winter. */
const ADULT = RULES.people.food.adult;

describe('economy', () => {
  it('is 100% efficient without jobs', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 27, 1); // next to the altar: content even without a job, plain tax
    const e = computeEconomy(s);
    expect(e).toMatchObject({ residents: T.capacity, workers: T.capacity, jobs: 0, yearJobs: 0, efficiency: 1, silverDelta: T.tax });
    expect(e.foodDelta).toBeCloseTo(-T.capacity * ADULT);
  });

  it('scales production by efficiency, capped at 100%', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 27, 3, false, 5); // 5 adults: 5 workers
    put(s, 'field', westOf('field'), 29);
    put(s, 'field', westOf('field'), 32);
    put(s, 'field', westOf('field'), 35); // 6 jobs
    atHarvest(s);
    let e = computeEconomy(s);
    expect(e).toMatchObject({ workers: 5, jobs: 6 });
    expect(e.efficiency).toBeCloseTo(5 / 6);
    expect(e.foodDelta).toBeCloseTo(3 * (BUILDINGS.field.harvest! / FIELD_WEEKS) * (5 / 6) - 5 * ADULT);
    put(s, 'house', ROADSIDE, 38, 4);
    e = computeEconomy(s);
    expect(e.efficiency).toBe(1);
  });

  it('ignores jobs and food of disconnected buildings, but still charges their upkeep', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 27, 3);
    const tax = HOUSE_LEVELS[3].tax;
    put(s, 'field', 1, 1);
    put(s, 'workshop', 5, 1);
    put(s, 'market', 9, 1);
    const up = (k: 'field' | 'workshop' | 'market') => BUILDINGS[k].upkeep!;
    const e = computeEconomy(s);
    expect(e.jobs).toBe(0);
    expect(e.yearJobs).toBe(0);
    expect(e.foodDelta).toBeCloseTo(-HOUSE_LEVELS[3].capacity * ADULT);
    expect(e).toMatchObject({ taxes: tax, upkeep: { field: up('field'), workshop: up('workshop'), market: up('market') } });
    expect(e.silverDelta).toBeCloseTo(tax - up('field') - up('workshop') - up('market'));
    put(s, 'workshop', westOf('workshop'), 29); // connected: jobs, but no silver
    const f = computeEconomy(s);
    expect(f.jobs).toBe(BUILDINGS.workshop.jobs);
    expect(f.silverDelta).toBeCloseTo(tax - up('field') - 2 * up('workshop') - up('market'));
  });

  it('charges the upkeep of buildings.json from the week they are built; roads, houses and the altar are free', () => {
    const s = emptyGame();
    expect(computeEconomy(s).upkeep).toEqual({}); // altar and starting roads
    put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'plaza', ROADSIDE, 29);
    put(s, 'field', EAST, 27);
    put(s, 'market', westOf('market') - 2, 31);
    put(s, 'workshop', EAST, 30);
    put(s, 'temple', EAST, 34);
    const e = computeEconomy(s);
    expect(Object.fromEntries(Object.entries(BUILDINGS).filter(([, d]) => d.upkeep).map(([k, d]) => [k, d.upkeep]))).toEqual({
      field: 0.5,
      plaza: 0.5,
      fisher: 0.5,
      gatherer: 0.5,
      lumber: 0.5,
      quarry: 1,
      granary: 1,
      market: 2,
      workshop: 1,
      park: 1,
    });
    // The temple has no upkeep: built early, it never drains the city (plano-p2-correcoes 2.1).
    expect(BUILDINGS.temple.upkeep).toBe(0);
    expect(e.upkeep).toEqual({ plaza: 0.5, field: 0.5, market: 2, workshop: 1 });
    expect(costliestUpkeep(e)).toEqual({ kind: 'market', amount: 2 });
    expect(e.silverDelta).toBeCloseTo(e.taxes - 4); // the balance shown as +X/sem
  });

  it('each person eats by age band, the same in every house level out of winter', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 27, 1, false, 0);
    for (const age of [5, 30, 70]) person(s, { houseId: b.id, age });
    const eaten = () => -computeEconomy(s).foodDelta;
    expect(seasonOf(s.week)).not.toBe('winter');
    for (let level = 1; level < HOUSE_LEVELS.length; level++) {
      b.level = level;
      expect(eaten()).toBeCloseTo(0.25 + 0.2 + 0.15);
    }
  });

  it('counts temple jobs once connected', () => {
    const s = emptyGame();
    put(s, 'temple', EAST, 30);
    expect(computeEconomy(s).jobs).toBe(2);
  });
});

describe('winter eating', () => {
  const winterWeeks = [W, W + 1, 2 * W - 1]; // the first winter, start to end
  const otherWeeks = [0, W - 1, 2 * W, 3 * W, 4 * W - 1, 4 * W];

  it('every resident eats foodFactor more in winter, a tent dweller tentFoodFactor instead', () => {
    for (const w of winterWeeks) expect(seasonOf(w)).toBe('winter');
    for (const w of otherWeeks) expect(seasonOf(w)).not.toBe('winter');
    for (let level = 1; level < HOUSE_LEVELS.length; level++) {
      const factor = level === 1 ? RULES.winter.tentFoodFactor : RULES.winter.foodFactor;
      for (const w of winterWeeks) expect(foodOf('adult', level, w)).toBeCloseTo(ADULT * factor);
      for (const w of otherWeeks) expect(foodOf('adult', level, w)).toBe(ADULT);
    }
    expect(RULES.winter.tentFoodFactor).toBeGreaterThan(RULES.winter.foodFactor);
    expect(RULES.winter.foodFactor).toBeGreaterThan(1);
  });

  it('the weekly balance and stepWeek use the winter eating', () => {
    const s = emptyGame({ food: 50 });
    put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'house', ROADSIDE, 29, 3);
    const eats = (w: number) => T.capacity * foodOf('adult', 1, w) + HOUSE_LEVELS[3].capacity * foodOf('adult', 3, w);
    s.week = W - 1; // last autumn week
    expect(-computeEconomy(s).foodDelta).toBeCloseTo(eats(W - 1));
    s.week = W;
    expect(-computeEconomy(s).foodDelta).toBeCloseTo(eats(W));
    expect(eats(W)).toBeCloseTo(T.capacity * ADULT * RULES.winter.tentFoodFactor + HOUSE_LEVELS[3].capacity * ADULT * RULES.winter.foodFactor);
    stepWeek(s, () => 0.99);
    expect(s.food).toBeCloseTo(50 - eats(W));
  });
});

describe('fields make food, not silver', () => {
  it('a field has 2 jobs and a yearly harvest; no building makes silver now', () => {
    expect(BUILDINGS.field).toMatchObject({ jobs: 2, harvest: 468 });
    expect('food' in BUILDINGS.field).toBe(false); // fields feed the city through the harvest
    for (const def of Object.values(BUILDINGS)) expect('silver' in def).toBe(false);
  });

  it('at 100% efficiency the field adds food and only costs its upkeep in silver', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 27, 3); // 6 workers
    put(s, 'field', westOf('field'), 29); // 2 jobs
    atHarvest(s);
    const e = computeEconomy(s);
    expect(e).toMatchObject({ jobs: 2, efficiency: 1 });
    expect(e.harvest).toBeCloseTo(BUILDINGS.field.harvest! / FIELD_WEEKS);
    expect(e.silverDelta).toBeCloseTo(e.taxes - BUILDINGS.field.upkeep!);
  });

  it('with zero workers the field gives no food', () => {
    const s = emptyGame();
    put(s, 'field', westOf('field'), 29);
    atHarvest(s);
    const e = computeEconomy(s);
    expect(e).toMatchObject({ workers: 0, jobs: 2, efficiency: 0, harvest: 0, foodMade: 0 });
    expect(e.silverDelta).toBeCloseTo(-BUILDINGS.field.upkeep!);
  });

  it('a disconnected field gives no food or jobs until it touches the network', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 27, 3);
    const far = put(s, 'field', 1, 1);
    expect(far.connected).toBe(false);
    atHarvest(s);
    let e = computeEconomy(s);
    expect(e).toMatchObject({ jobs: 0, yearJobs: 0, harvest: 0 });
    put(s, 'field', westOf('field'), 29);
    e = computeEconomy(s);
    expect(e).toMatchObject({ jobs: 2, yearJobs: 2 });
    expect(e.harvest).toBeCloseTo(BUILDINGS.field.harvest! / FIELD_WEEKS); // only the connected one
    expect(e.upkeep.field).toBe(2 * BUILDINGS.field.upkeep!); // both pay upkeep
  });
});

describe('weekly silver', () => {
  it('is only taxes minus upkeep: workers at a workshop add no silver', () => {
    const s = emptyGame();
    put(s, 'workshop', EAST, 27);
    put(s, 'house', ROADSIDE, 31, 4); // workers for its jobs
    const e = computeEconomy(s);
    expect(e.efficiency).toBe(1);
    expect('production' in e).toBe(false);
    expect(e.silverDelta).toBeCloseTo(e.taxes - BUILDINGS.workshop.upkeep!);
  });
});

describe('workshop field bonus', () => {
  const ws = BUILDINGS.workshop;
  /** Two big houses (enough workers for everything below), a field and room for 4 workshops. */
  const city = () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 31, 4);
    put(s, 'house', ROADSIDE, 33, 4);
    const field = put(s, 'field', westOf('field'), 28);
    atHarvest(s);
    return { s, field };
  };
  const spots = [27, 30, 33, 36];

  it('each connected workshop adds fieldBonus to the fields, capped at fieldBonusMax (the 4th only gives jobs)', () => {
    expect('silver' in ws).toBe(false);
    expect(ws.fieldBonus).toBeGreaterThan(0);
    expect(ws.fieldBonusMax).toBeGreaterThanOrEqual(ws.fieldBonus!);
    const { s, field } = city();
    const base = BUILDINGS.field.harvest! / FIELD_WEEKS;
    expect(fieldBonus(s)).toBe(0);
    expect(fieldHarvest(s, field, s.week)).toBeCloseTo(base);
    const seen: number[] = [];
    spots.forEach((y, k) => {
      put(s, 'workshop', EAST, y);
      const bonus = Math.min((k + 1) * ws.fieldBonus!, ws.fieldBonusMax!);
      seen.push(fieldBonus(s));
      expect(fieldBonus(s)).toBeCloseTo(bonus);
      expect(fieldHarvest(s, field, s.week)).toBeCloseTo(base * (1 + bonus));
      const e = computeEconomy(s);
      expect(e.efficiency).toBe(1);
      expect(e.harvest).toBeCloseTo(base * (1 + bonus));
      expect(e.yearJobs).toBe(BUILDINGS.field.jobs + (k + 1) * ws.jobs);
    });
    // With the current data: +10%, +20%, +30%, and a 4th workshop stays at +30%.
    expect(seen.map((v) => Math.round(v * 100))).toEqual([10, 20, 30, 30]);
  });

  it('a disconnected workshop gives no bonus', () => {
    const { s, field } = city();
    put(s, 'workshop', 5, 1);
    expect(s.buildings.at(-1)!.connected).toBe(false);
    expect(fieldBonus(s)).toBe(0);
    expect(fieldHarvest(s, field, s.week)).toBeCloseTo(BUILDINGS.field.harvest! / FIELD_WEEKS);
  });

  it('the bonus is for fields only: the fisher and the gatherer catch the same', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 31, 4, false, 10); // workers for everything
    const fisher = put(s, 'fisher', besideRiver(s, 40), 40);
    const gatherer = put(s, 'gatherer', westOf('gatherer'), 27);
    s.feature[indexOf(s, 20, 30)] = 'olive';
    const caught = gatherYield(s, fisher);
    const picked = gatherYield(s, gatherer);
    expect(caught).toBeGreaterThan(0);
    expect(picked).toBeGreaterThan(0);
    const before = computeEconomy(s).foodMade;
    put(s, 'workshop', EAST, 27);
    put(s, 'workshop', EAST, 30);
    expect(fieldBonus(s)).toBeGreaterThan(0);
    expect(gatherYield(s, fisher)).toBe(caught);
    expect(gatherYield(s, gatherer)).toBe(picked);
    const after = computeEconomy(s);
    expect(after.efficiency).toBe(1);
    expect(after.foodMade).toBeCloseTo(before);
  });

  it('frozen fields give nothing in winter, bonus or not', () => {
    const { s, field } = city();
    put(s, 'workshop', EAST, 27);
    s.week = W; // first winter
    expect(fieldHarvest(s, field, s.week)).toBe(0);
    expect(computeEconomy(s).harvest).toBe(0);
  });
});

describe('unemployment', () => {
  // Three level-2 houses with 3 adults each: 9 workers.
  const houses = (s: ReturnType<typeof emptyGame>, n: number) => {
    for (let k = 0; k < n; k++) put(s, 'house', ROADSIDE, 27 + 2 * k, 2, false, 3);
  };

  it('counts workers without a job, never below 0', () => {
    const s = emptyGame();
    houses(s, 3);
    atHarvest(s); // the fields below (built in the first autumn) are at work
    expect(unemployed(s)).toBe(9);
    put(s, 'field', EAST, 27).built = 0; // 2 jobs
    expect(unemployed(s)).toBe(7);
    put(s, 'workshop', EAST, 29); // + 3 = 5 jobs
    expect(unemployed(s)).toBe(4);
    put(s, 'field', EAST, 32).built = 0; // 7 jobs
    expect(unemployed(s)).toBe(2);
    put(s, 'workshop', EAST, 34); // 10 jobs for 9 workers
    expect(unemployed(s)).toBe(0);
  });

  it('alerts from the threshold up, from the start (no workshop needed); a frozen field keeps its farmers', () => {
    const s = emptyGame({ unlocked: ['road', 'house', 'field', 'fisher'] });
    expect(RULES.unemploymentAlert).toBe(3);
    const tent = put(s, 'house', ROADSIDE, 27, 1, false, 2); // 2 adults, no jobs
    person(s, { houseId: tent.id, age: 5 }); // a child does not work
    expect(unemploymentAlert(s)).toBe(0); // below the threshold
    put(s, 'house', ROADSIDE, 29, 1);
    expect(unemploymentAlert(s)).toBe(2 + T.capacity);
    s.week = W; // winter: a frozen field still takes its farmers, who rest there
    put(s, 'field', EAST, 27);
    expect(computeEconomy(s).jobs).toBe(0);
    expect(unemployed(s)).toBe(2 + T.capacity - BUILDINGS.field.jobs);
    expect(unemploymentAlert(s)).toBe(2 + T.capacity - BUILDINGS.field.jobs);
  });

  it('is the same in autumn and in winter with fields: the farmer rests, he is not out of work', () => {
    const s = emptyGame();
    houses(s, 3); // 9 workers
    put(s, 'field', EAST, 27);
    put(s, 'field', EAST, 30); // 4 jobs of the year
    const look = (week: number) => {
      s.week = week;
      const e = computeEconomy(s);
      return { yearJobs: e.yearJobs, unemployed: unemployed(s), idle: idleShare(s), happiness: e.happiness, moods: e.moods, taxes: e.taxes };
    };
    const fall = look(W - 1);
    const winter = look(W);
    expect(seasonOf(W - 1)).toBe('autumn');
    expect(seasonOf(W)).toBe('winter');
    expect(computeEconomy(s).jobs).toBe(0); // the frozen fields take no workers this week
    s.week = W - 1;
    expect(computeEconomy(s).jobs).toBe(4);
    expect(fall).toEqual(winter);
    expect(winter).toMatchObject({ yearJobs: 4, unemployed: 5, idle: 5 / 9 });
  });
});
