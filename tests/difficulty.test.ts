import { describe, expect, it } from 'vitest';
import {
  BUILDINGS,
  clothesPerWeek,
  comingWinterGrowth,
  computeEconomy,
  createGame,
  createRng,
  crewCounts,
  DIFFICULTY,
  firewoodPerWeek,
  foodForecast,
  houseFirewood,
  upkeepOf,
  HOUSE_LEVELS,
  nextStage,
  peopleEating,
  RULES,
  setDifficulty,
  stageOf,
  TEMPLE_STAGES,
  theftTotal,
  upkeepPaid,
  WEEKS_PER_YEAR,
  winterGrowth,
  type Difficulty,
  type GameState,
} from '../src/core';
import { EAST, emptyGame, fill, put, ROADSIDE } from './helpers';

const W = RULES.weeksPerSeason;
/** The first winter week of year `y` (the game starts in autumn: winter is the year's 2nd season). */
const winterOf = (y: number) => (y - 1) * WEEKS_PER_YEAR + W;

/** A small city: 8 residents in stone houses, a lumber, food stored above the base. */
function city(d: Difficulty, week = 0): GameState {
  const s = emptyGame({ difficulty: d, week, food: RULES.baseFoodStorage + 200, clothes: 0 });
  for (let k = 0; k < 2; k++) fill(s, put(s, 'house', ROADSIDE, 27 + 2 * k, 3, false, 0), 4);
  return s;
}

describe('difficulty data (plano-dificuldade F)', () => {
  it('Tranquilo, Normal and Difícil, with Normal at 1 everywhere', () => {
    expect(DIFFICULTY.normal).toEqual({ startSilver: 180, food: 1, firewood: 1, clothes: 1, upkeep: 1, emptyUpkeep: 1, theft: 1, offering: 1, templeCost: 1, templeWork: 1, winterGrowth: 0, winterGrowthMax: 0 });
    expect(DIFFICULTY.easy).toMatchObject({ startSilver: 220, food: 0.9, upkeep: 0.8, emptyUpkeep: 0.5, theft: 0.5, winterGrowth: 0, winterGrowthMax: 0 });
    expect(DIFFICULTY.hard).toMatchObject({ startSilver: 160, food: 1.05, upkeep: 1.1, theft: 1.25, templeCost: 1.1, winterGrowth: 0.02, winterGrowthMax: 0.1 });
  });

  it('a new game is Normal unless told; setDifficulty at week 0 sets the starting silver too', () => {
    expect(createGame(createRng(3))).toMatchObject({ difficulty: 'normal', silver: 180 });
    const s = createGame(createRng(3), 'hard');
    expect(s).toMatchObject({ difficulty: 'hard', silver: 160 });
    setDifficulty(s, 'easy');
    expect(s).toMatchObject({ difficulty: 'easy', silver: 220 });
    s.week = 5;
    s.silver = 10;
    setDifficulty(s, 'hard');
    expect(s.silver).toBe(10); // a game under way keeps its silver
  });

  it('the same seed gives the same map at every difficulty', () => {
    const a = createGame(createRng(9), 'easy');
    const b = createGame(createRng(9), 'hard');
    expect(a.feature).toEqual(b.feature);
    expect(a.ground).toEqual(b.ground);
  });
});

describe('winters grow harder from Year 3', () => {
  it('Difícil only: none in Years 1-2 nor out of winter; a step a year from Year 3, up to the cap', () => {
    const n = { difficulty: 'hard' as const };
    expect(winterGrowth(n, winterOf(1))).toBe(0);
    expect(winterGrowth(n, winterOf(2))).toBe(0);
    expect(winterGrowth(n, winterOf(3))).toBe(0.02);
    expect(winterGrowth(n, winterOf(4))).toBe(0.04);
    expect(winterGrowth(n, winterOf(3) - 1)).toBe(0); // the autumn before
    expect(winterGrowth(n, winterOf(20))).toBe(DIFFICULTY.hard.winterGrowthMax);
    expect(winterGrowth({ difficulty: 'normal' }, winterOf(9))).toBe(0);
    expect(winterGrowth({ difficulty: 'easy' }, winterOf(9))).toBe(0);
  });

  it('the autumn sees the coming winter (the forecasts of firewood and clothes)', () => {
    expect(comingWinterGrowth({ difficulty: 'hard' }, winterOf(3) - 5)).toBe(0.02);
    expect(comingWinterGrowth({ difficulty: 'hard' }, winterOf(3) + 2)).toBe(0.02);
  });
});

describe('the multipliers on the points that exist', () => {
  it('food eaten: the appetite and the harder winter', () => {
    const n = city('normal', winterOf(1));
    const base = peopleEating(n).eaten;
    expect(peopleEating(city('hard', winterOf(1))).eaten).toBeCloseTo(base * 1.05);
    expect(peopleEating(city('easy', winterOf(1))).eaten).toBeCloseTo(base * 0.9);
    expect(peopleEating(city('normal', winterOf(3))).eaten).toBeCloseTo(base);
    expect(peopleEating(city('hard', winterOf(3))).eaten).toBeCloseTo(base * 1.05 * 1.02);
  });

  it('firewood and clothes in winter', () => {
    const fw = 8 / 4 * (HOUSE_LEVELS[3].firewood ?? 0);
    expect(firewoodPerWeek(city('normal', winterOf(1)))).toBeCloseTo(fw);
    expect(firewoodPerWeek(city('hard', winterOf(4)))).toBeCloseTo(fw * 1.1 * 1.04);
    expect(clothesPerWeek(city('easy', winterOf(1)), 25)).toBeCloseTo(25 * RULES.clothes.perPerson * 0.8);
  });

  it('upkeep, and an empty workplace\'s on Tranquilo half of it', () => {
    const at = (d: Difficulty) => {
      const s = city(d);
      const b = put(s, 'lumber', EAST, 27);
      for (const p of s.people) p.jobId = null;
      return upkeepPaid(s, b, crewCounts(s));
    };
    const up = BUILDINGS.lumber.upkeep!;
    expect(at('normal')).toBe(up);
    expect(at('hard')).toBeCloseTo(up * 1.1);
    expect(at('easy')).toBeCloseTo(up * 0.8 * 0.5);
  });

  it('theft', () => {
    const at = (d: Difficulty) => {
      const s = city(d);
      for (let k = 2; k < 5; k++) fill(s, put(s, 'house', ROADSIDE, 27 + 2 * k, 3, false, 0), 4);
      put(s, 'granary', EAST, 36);
      s.jobTargets.granary = 0;
      for (const p of s.people) p.jobId = null;
      return theftTotal(s);
    };
    expect(at('normal')).toBeGreaterThan(0);
    expect(at('hard')).toBeCloseTo(at('normal') * 1.25, 1);
    expect(at('easy')).toBeCloseTo(at('normal') * 0.5, 1);
  });

  it('the Temple stages: silver, materials, work and offering; Normal is the data as it is', () => {
    expect(stageOf({ difficulty: 'normal' }, 1)).toBe(TEMPLE_STAGES[1]);
    const h = stageOf({ difficulty: 'hard' }, 1)!;
    const st = TEMPLE_STAGES[1];
    expect(h.cost).toBe(Math.round(st.cost * 1.1));
    expect(h.work).toBe(Math.round(st.work * 1.1));
    expect(h.offering).toBeCloseTo(st.offering * 1.1);
    for (const [m, n] of Object.entries(st.materials)) expect(h.materials[m as 'wood']).toBe(Math.round(n! * 1.1));
    expect(stageOf({ difficulty: 'easy' }, 9)).toBeUndefined();
    const s = emptyGame({ difficulty: 'easy' });
    expect(nextStage(s)!.cost).toBe(Math.round(TEMPLE_STAGES[0].cost * 0.8));
  });

  it('the food forecast eats as the harder winter will (Difícil, Year 3)', () => {
    // The same city in the same week of the year, in Year 1 and in Year 3: only the winter growth differs.
    const left = (year: number) => {
      const s = city('hard', winterOf(year) - 2);
      s.food = 40;
      return foodForecast(s, undefined, WEEKS_PER_YEAR, { unlimited: true });
    };
    const y1 = left(1);
    const y3 = left(3);
    expect(y1 && y3).toBeTruthy();
    expect(y3!.weeks).toBeLessThanOrEqual(y1!.weeks);
    // The winter's eating of Year 3 is the Year 1 one times 1.02.
    const s = city('hard', winterOf(3));
    expect(peopleEating(s).eaten).toBeCloseTo(peopleEating(city('hard', winterOf(1))).eaten * 1.02);
  });

  it('upkeepOf and houseFirewood: the numbers the balloons show', () => {
    expect(upkeepOf({ difficulty: 'hard' }, 2)).toBe(2.2);
    expect(upkeepOf({ difficulty: 'easy' }, 2)).toBe(1.6);
    expect(houseFirewood({ difficulty: 'normal', week: winterOf(5) }, 0.3)).toBe(0.3);
    expect(houseFirewood({ difficulty: 'hard', week: winterOf(3) }, 1)).toBeCloseTo(1.1 * 1.02);
  });

  it('the economy pays the scaled upkeep', () => {
    const n = city('normal');
    put(n, 'lumber', EAST, 27);
    const h = city('hard');
    put(h, 'lumber', EAST, 27);
    expect(computeEconomy(h).upkeep.lumber).toBeCloseTo(computeEconomy(n).upkeep.lumber! * 1.1);
  });
});
