import { describe, expect, it } from 'vitest';
import {
  alerts,
  campPlazaSpot,
  checkPlace,
  indexOf,
  needMet,
  place,
  clearCell,
  BUILDINGS,
  byRiver,
  checkGoal,
  computeEconomy,
  createGame,
  createRng,
  fieldHarvest,
  gatherFood,
  foodCapacity,
  foodForecast,
  foodLastsToHarvest,
  foodPerResident,
  goalProgress,
  goalTarget,
  harvestsIn,
  HOUSE_LEVELS,
  RULES,
  seasonOf,
  stepWeek,
  weeksToHarvest,
  yearOf,
  type GameEvent,
  type GoalDef,
} from '../src/core';
import { besideRiver, constRng, EAST, emptyGame, put, ROADSIDE, weeksOfFood, westOf } from './helpers';

const W = RULES.weeksPerSeason; // 13
const YEAR = 4 * W;
/** First week of each season of year 1 (the game starts in autumn). */
const WINTER = W;
const SPRING = 2 * W;
const SUMMER = 3 * W;
const AUTUMN2 = YEAR;
/** Food a field gives in a week out of winter, before the efficiency. */
const WEEKLY = BUILDINGS.field.harvest! / (3 * W);
const never = constRng(0.99);
const always = constRng(0);
/** Food one tent eats in week w. */
const tentEats = (w: number) => HOUSE_LEVELS[1].residents * foodPerResident(1, w);

describe('caravan', () => {
  it('founds the city with 2 to 4 tents by the altar and 10 to 20 weeks of food, capped by the stores', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 60; seed++) {
      const s = createGame(createRng(seed));
      const tents = s.buildings.filter((b) => b.kind === 'house');
      expect(tents.length).toBeGreaterThanOrEqual(RULES.caravan.families[0]);
      expect(tents.length).toBeLessThanOrEqual(RULES.caravan.families[1]);
      expect(s.start.families).toBe(tents.length);
      seen.add(tents.length);
      for (const t of tents) expect(t).toMatchObject({ level: 1, connected: true, built: 0 });
      const eaten = tents.length * HOUSE_LEVELS[1].residents * HOUSE_LEVELS[1].food;
      expect(s.food).toBeLessThanOrEqual(RULES.baseFoodStorage);
      expect(s.start.foodWeeks).toBe(Math.floor(s.food / eaten + 1e-9));
      expect(s.start.foodWeeks).toBeLessThanOrEqual(RULES.caravan.foodWeeks[1]);
      // Below 10 weeks only when the store limit cut it.
      if (s.start.foodWeeks < RULES.caravan.foodWeeks[0]) expect(s.food).toBe(RULES.baseFoodStorage);
    }
    expect([...seen].sort()).toEqual([2, 3, 4]);
  });

  it('is the same for the same seed', () => {
    const a = createGame(createRng(9));
    const b = createGame(createRng(9));
    expect(a.start).toEqual(b.start);
    expect(a.food).toBe(b.food);
  });

  it('starts in autumn with the new prices and silver', () => {
    const s = createGame(createRng(3));
    expect(seasonOf(s.week)).toBe('autumn');
    expect(RULES.startSilver).toBe(180);
    expect([BUILDINGS.house.cost, BUILDINGS.field.cost, BUILDINGS.plaza.cost, RULES.roadCost]).toEqual([40, 20, 25, 2]);
  });
});

describe('harvest', () => {
  it('a field works in spring, summer and autumn, and freezes in winter', () => {
    expect(harvestsIn(0)).toBe(true); // autumn
    expect(harvestsIn(W - 1)).toBe(true);
    expect(harvestsIn(WINTER)).toBe(false);
    expect(harvestsIn(SPRING - 1)).toBe(false);
    expect(harvestsIn(SPRING)).toBe(true);
    expect(harvestsIn(SUMMER)).toBe(true);
    expect(harvestsIn(AUTUMN2 + WINTER)).toBe(false);
  });

  it('a field gives food from the week it is built (out of winter)', () => {
    const s = emptyGame();
    const f = put(s, 'field', westOf('field'), 30);
    expect(fieldHarvest(s, f, 0)).toBeGreaterThan(0);
  });

  it('delivers the yearly harvest over the weeks out of winter, nothing in winter', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 27, 4); // enough workers
    const f = put(s, 'field', westOf('field'), 30);
    let total = 0;
    const perSeason: Record<string, number> = { autumn: 0, winter: 0, spring: 0, summer: 0 };
    for (let w = 0; w < YEAR; w++) {
      const h = fieldHarvest(s, f, w);
      perSeason[seasonOf(w)] += h;
      total += h;
    }
    expect(total).toBeCloseTo(BUILDINGS.field.harvest!);
    expect(perSeason.winter).toBe(0);
    expect(perSeason.spring).toBeCloseTo(perSeason.summer);
    expect(perSeason.autumn).toBeCloseTo(perSeason.spring);
  });

  it('fields feed nobody in winter, while the houses eat every week', () => {
    const s = emptyGame({ food: 30, week: WINTER });
    put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'field', westOf('field'), 30);
    stepWeek(s, never);
    expect(s.food).toBeCloseTo(30 - tentEats(WINTER));
    s.week = SPRING;
    const before = s.food;
    stepWeek(s, never);
    expect(s.food).toBeGreaterThan(before);
  });

  it('weeks to the harvest count to the next first week of spring', () => {
    expect(weeksToHarvest(0)).toBe(SPRING);
    expect(weeksToHarvest(SPRING - 1)).toBe(1);
    expect(weeksToHarvest(SPRING)).toBe(YEAR);
    expect(weeksToHarvest(SUMMER)).toBe(YEAR - W);
  });

  it('announces the first harvest week and reaches the first-harvest milestone', () => {
    const s = emptyGame({ week: SPRING });
    put(s, 'house', ROADSIDE, 27, 4);
    put(s, 'field', westOf('field'), 30).built = 0;
    put(s, 'granary', EAST, 30);
    const events = stepWeek(s, never);
    expect(events.find((e) => e.type === 'harvestStart')).toBeDefined();
    expect(s.milestones).toContain('firstHarvest');
    expect(stepWeek(s, never).find((e) => e.type === 'harvestStart')).toBeUndefined();
  });
});

describe('stores and granary', () => {
  it('keeps 50 without a granary and adds 150 per connected granary', () => {
    const s = emptyGame();
    expect(foodCapacity(s)).toBe(50);
    put(s, 'granary', EAST, 30);
    expect(foodCapacity(s)).toBe(200);
    put(s, 'granary', EAST, 34);
    expect(foodCapacity(s)).toBe(350);
    put(s, 'granary', 2, 2); // not connected
    expect(foodCapacity(s)).toBe(350);
    expect(BUILDINGS.granary).toMatchObject({ cost: 40, upkeep: 1, w: 3, h: 3, jobs: 1, storage: 150, category: 'supply' });
  });

  it('spoils the food above the stores, with one event per stretch and an alert', () => {
    const s = emptyGame({ food: RULES.baseFoodStorage - 1 });
    put(s, 'workshop', EAST, 30); // a place for the field workers
    put(s, 'house', ROADSIDE, 27, 4);
    put(s, 'field', westOf('field'), 30).built = 0;
    s.week = SPRING;
    const first = stepWeek(s, never);
    expect(first).toContainEqual({ type: 'spoilStart' });
    expect(s.food).toBe(RULES.baseFoodStorage);
    expect(s.spoiled).toBeGreaterThan(0);
    expect(alerts(s).map((a) => a.kind)).toContain('spoiling');
    expect(stepWeek(s, never)).not.toContainEqual({ type: 'spoilStart' });
  });
});

describe('forecast', () => {
  it('counts the whole weeks of food left and the season they end in', () => {
    const s = emptyGame({ food: 6 });
    put(s, 'house', ROADSIDE, 27, 1);
    const short = weeksOfFood(6, 0, tentEats);
    expect(foodForecast(s)).toEqual({ weeks: short, season: seasonOf(short) });
    expect(seasonOf(short)).toBe('autumn');
    s.food = 30;
    const long = weeksOfFood(30, 0, tentEats);
    expect(long).toBeGreaterThan(SPRING); // across the winter
    expect(foodForecast(s)).toEqual({ weeks: long, season: seasonOf(long) });
  });

  it('counts the field food, the frozen winter and the store limit', () => {
    const s = emptyGame({ food: 20 });
    put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'house', ROADSIDE, 29, 2);
    expect(foodLastsToHarvest(s)).toBe(false); // 20 food for the 26 weeks to the spring
    put(s, 'field', westOf('field'), 31);
    expect(foodLastsToHarvest(s)).toBe(true); // the autumn fills the stores for the winter
    expect(foodForecast(s)).toBeNull();
  });

  it('is null when nothing is eaten', () => {
    expect(foodForecast(emptyGame())).toBeNull();
  });
});

describe('winter and drought', () => {
  it('tents leave more easily in a winter famine', () => {
    expect(RULES.winterFamineLeaveChance).toBeGreaterThan(RULES.famineLeaveChance);
    const between = constRng((RULES.winterFamineLeaveChance + RULES.famineLeaveChance) / 2);
    const tent = (week: number) => {
      const s = emptyGame({ food: 0, famine: true, week });
      put(s, 'plaza', EAST, 27);
      return [s, put(s, 'house', ROADSIDE, 27, 1)] as const;
    };
    const [autumn, a] = tent(2);
    stepWeek(autumn, between);
    expect(a.level).toBe(1);
    const [winter, w] = tent(WINTER + 2);
    expect(stepWeek(winter, between)).toContainEqual({ type: 'familyLeft', x: ROADSIDE, y: 27, reason: 'famine' });
    expect(w.level).toBe(0);
  });

  it('a mud-brick house protects from the winter', () => {
    const s = emptyGame({ food: 0, famine: true, week: WINTER + 2 });
    put(s, 'plaza', EAST, 27);
    const b = put(s, 'house', ROADSIDE, 27, 2);
    expect(stepWeek(s, constRng(0.3)).find((e) => e.type === 'familyLeft')).toBeUndefined();
    expect(b.level).toBe(2);
  });

  it('a dry year cuts the harvest of fields away from the river', () => {
    const s = emptyGame({ week: SPRING });
    const dry = put(s, 'field', westOf('field'), 30);
    dry.built = 0;
    const full = fieldHarvest(s, dry, SPRING, false);
    expect(fieldHarvest(s, dry, SPRING, true)).toBeCloseTo(full * RULES.drought.harvestFactor);
    expect(RULES.drought.harvestFactor).toBe(0.25);
  });

  it('fields touching the river harvest in full in a dry year', () => {
    const s = emptyGame({ week: SPRING });
    const y = 30;
    const left = besideRiver(s, y);
    const f = put(s, 'field', left, y);
    f.built = 0;
    expect(byRiver(s, f)).toBe(true);
    expect(fieldHarvest(s, f, SPRING, true)).toBeCloseTo(fieldHarvest(s, f, SPRING, false));
  });

  const SAFE = RULES.drought.safeYears;
  /** The first winter a drought can be rolled (the one of the year after the safe years). */
  const FIRST_DRY_WINTER = WINTER + SAFE * YEAR;

  it('rolls the drought each winter (never in the safe years), announces it and ends it in autumn', () => {
    expect(RULES.drought).toMatchObject({ chance: 0.25, neverTwice: true });
    expect(SAFE).toBeGreaterThanOrEqual(1);
    const s = emptyGame({ week: WINTER - 1 });
    stepWeek(s, always);
    expect(s.drought).toBe(false); // first winter: year 1 is safe
    s.week = FIRST_DRY_WINTER - 1;
    const events = stepWeek(s, always);
    expect(s.drought).toBe(true);
    expect(events).toContainEqual({ type: 'drought' });
    expect(alerts(s).map((a) => a.kind)).toContain('drought');
    s.week = FIRST_DRY_WINTER + 3 * W - 1; // last week of the following summer
    stepWeek(s, never);
    expect(seasonOf(s.week)).toBe('autumn');
    expect(s.drought).toBe(false);
    expect(s.lastDrought).toBe(true);
  });

  it('never dries before the Year 3 (safeYears 2), even when every roll hits', () => {
    expect(SAFE).toBe(2);
    const s = emptyGame();
    while (s.week < FIRST_DRY_WINTER - 1) {
      stepWeek(s, always);
      expect(s.drought, `week ${s.week}`).toBe(false);
    }
    stepWeek(s, always);
    expect(s.drought).toBe(true);
    expect(yearOf(s.week)).toBe(SAFE + 1); // the winter of Year 3, for a dry spring of Year 3
    expect(seasonOf(s.week)).toBe('winter');
  });

  it('is never dry two years in a row, even when every roll hits', () => {
    const s = emptyGame();
    const dry: boolean[] = [];
    for (let year = 0; year < SAFE + 4; year++) {
      while (s.week < WINTER + year * YEAR) stepWeek(s, always);
      dry.push(s.drought);
    }
    const expected: boolean[] = [];
    for (let year = 0; year < SAFE + 4; year++) expected.push(year >= SAFE && !expected[year - 1]);
    expect(dry).toEqual(expected);
  });

  it('a missed roll keeps the year normal (chance 25%)', () => {
    const s = emptyGame({ week: FIRST_DRY_WINTER - 1 });
    const events = stepWeek(s, constRng(RULES.drought.chance));
    expect(s.drought).toBe(false);
    expect(events).not.toContainEqual({ type: 'drought' });
    const t = emptyGame({ week: FIRST_DRY_WINTER - 1 });
    stepWeek(t, constRng(RULES.drought.chance - 0.01));
    expect(t.drought).toBe(true);
  });

  it('the drought alert shows in winter and spring, not in summer', () => {
    const s = emptyGame({ drought: true, week: WINTER + YEAR });
    expect(alerts(s).map((a) => a.kind)).toContain('drought');
    s.week = SPRING + YEAR;
    expect(alerts(s).map((a) => a.kind)).toContain('drought');
    s.week = SUMMER + YEAR;
    expect(alerts(s).map((a) => a.kind)).not.toContain('drought');
  });

  it('a dry spring lowers the food a field brings in a week of the simulation', () => {
    const run = (drought: boolean) => {
      const s = emptyGame({ week: SPRING + YEAR, drought, food: 0 });
      put(s, 'house', ROADSIDE, 27, 4); // 16 residents: 6 workers for 2 jobs
      put(s, 'field', westOf('field'), 30).built = 0;
      return computeEconomy(s).harvest;
    };
    expect(run(false)).toBeCloseTo(WEEKLY);
    expect(run(true)).toBeCloseTo((WEEKLY) * RULES.drought.harvestFactor);
  });
});

describe('alerts', () => {
  it('warns about the winter at the end of autumn while there are tents', () => {
    const s = emptyGame({ week: W - RULES.winterWarningWeeks });
    put(s, 'plaza', EAST, 27);
    put(s, 'house', ROADSIDE, 27, 1);
    s.food = 40;
    expect(alerts(s).map((a) => a.kind)).toContain('winterComing');
    s.week = W - RULES.winterWarningWeeks - 1;
    expect(alerts(s).map((a) => a.kind)).not.toContain('winterComing');
  });

  it('warns in any season when the food will not last until the spring', () => {
    for (const week of [0, SUMMER, WINTER]) {
      const s = emptyGame({ week, food: 1 });
      put(s, 'house', ROADSIDE, 27, 1);
      expect(alerts(s).map((a) => a.kind)).toContain('foodShort');
      s.food = 40; // a tent eats 0.6 a week: 40 lasts a year
      expect(alerts(s).map((a) => a.kind)).not.toContain('foodShort');
    }
  });

  it('spoiling says the store size and the goal that unlocks the granary while it is locked', () => {
    const s = emptyGame({ spoiled: 3 });
    s.unlocked = s.unlocked.filter((k) => k !== 'granary');
    expect(alerts(s).find((a) => a.kind === 'spoiling')).toEqual({ kind: 'spoiling', amount: 3, capacity: RULES.baseFoodStorage, locked: true });
    s.unlocked.push('granary');
    expect(alerts(s).find((a) => a.kind === 'spoiling')).toMatchObject({ locked: false });
  });
});

describe('milestones', () => {
  const milestones = (events: GameEvent[]) => events.flatMap((e) => (e.type === 'milestone' ? [e.id] : []));

  it('a new family, the first mud-brick and stone houses: once each', () => {
    const s = emptyGame();
    put(s, 'plaza', EAST, 27); // a plaza for the tents to climb
    put(s, 'granary', EAST, 36); // and food for the winter
    s.food = foodCapacity(s);
    put(s, 'house', ROADSIDE, 27);
    put(s, 'house', ROADSIDE, 29);
    const got: string[] = [];
    for (let k = 0; k < 2 * RULES.familyIntervalWeeks + 8; k++) got.push(...milestones(stepWeek(s, always)));
    expect(s.buildings.filter((b) => b.kind === 'house' && b.level >= 1)).toHaveLength(2);
    expect(got.filter((m) => m === 'firstFamily')).toEqual(['firstFamily']);
    expect(s.milestones).toContain('firstFamily');
    expect(Object.keys(s.milestoneWeeks).sort()).toEqual([...s.milestones].sort());
    // Levels reached by houses that did not come from a family.
    const t = emptyGame({ food: RULES.baseFoodStorage }); // enough for the house all along
    put(t, 'plaza', EAST, 27);
    put(t, 'market', EAST, 30);
    const h = put(t, 'house', ROADSIDE, 27, 1);
    const seen: string[] = [];
    for (let k = 0; k < 2 * RULES.weeksToUpgrade; k++) seen.push(...milestones(stepWeek(t, never)));
    expect(t.famineThisYear).toBe(false);
    expect(h.level).toBe(3);
    // (the 26 weeks also cross the first winter, a milestone of its own)
    const houses = (ids: string[]) => ids.filter((m) => m !== 'firstWinter');
    expect(houses(seen)).toEqual(['firstMud', 'firstStone']);
    expect(houses(t.milestones)).toEqual(['firstMud', 'firstStone']);
  });

  it('keeps the week each milestone was reached, and never moves it', () => {
    const s = emptyGame();
    put(s, 'plaza', EAST, 27);
    put(s, 'house', ROADSIDE, 27);
    let at = -1;
    for (let k = 0; k < 10; k++) {
      const before = s.week;
      if (milestones(stepWeek(s, always)).includes('firstFamily')) at = before;
    }
    expect(at).toBeGreaterThanOrEqual(0);
    const w = s.milestoneWeeks.firstFamily!;
    expect(w === at || w === at + 1).toBe(true);
    for (let k = 0; k < 5; k++) stepWeek(s, always);
    expect(s.milestoneWeeks.firstFamily).toBe(w);
  });

  it('the caravan tents do not count as the first family', () => {
    const s = createGame(createRng(4));
    for (let k = 0; k < 3; k++) stepWeek(s, never);
    expect(s.milestones).not.toContain('firstFamily');
  });

  it('the first harvest and the first winter, only once', () => {
    const s = emptyGame({ week: SPRING - 1, food: 40 });
    put(s, 'house', ROADSIDE, 27, 4);
    put(s, 'field', westOf('field'), 30).built = 0;
    const got: string[] = [];
    for (let k = 0; k < 3; k++) got.push(...milestones(stepWeek(s, never)));
    expect(got).toContain('firstWinter');
    expect(got).toContain('firstHarvest');
    expect(got.filter((m) => m === 'firstHarvest')).toHaveLength(1);
  });

  it('a year without famine is reached when the autumn comes back without a famine week', () => {
    const s = emptyGame({ week: AUTUMN2 - 1 });
    expect(milestones(stepWeek(s, never))).toContain('yearWithoutFamine');
    const t = emptyGame({ week: AUTUMN2 - 1, famineThisYear: true });
    expect(milestones(stepWeek(t, never))).not.toContain('yearWithoutFamine');
    expect(t.famineThisYear).toBe(false); // a new year starts
  });
});

describe('history', () => {
  it('keeps one record per week, at most historyWeeks', () => {
    const s = emptyGame();
    for (let k = 0; k < RULES.historyWeeks + 5; k++) stepWeek(s, never);
    expect(s.history).toHaveLength(RULES.historyWeeks);
    const last = s.history.at(-1)!;
    expect(last).toEqual({ silver: s.silver, food: s.food, residents: computeEconomy(s).residents, happiness: computeEconomy(s).happiness, capacity: foodCapacity(s) });
    expect(s.history[0]).not.toBe(last);
  });
});

describe('survival goals', () => {
  const goal = (type: GoalDef['type'], target = 1): GoalDef => ({ type, target, reward: 0, text: '' });

  it('food until spring: weeks the food lasts, out of the weeks left until the first spring', () => {
    const s = emptyGame({ food: 5, goalIndex: 0 });
    put(s, 'house', ROADSIDE, 27, 1);
    const g = goal('foodUntilSpring');
    expect(goalTarget(s, g)).toBe(SPRING);
    expect(goalProgress(s, g)).toBe(weeksOfFood(5, 0, tentEats));
    s.food = 40;
    put(s, 'granary', EAST, 30);
    s.food = 100;
    expect(goalProgress(s, g)).toBe(SPRING);
    s.week = WINTER;
    expect(goalTarget(s, g)).toBe(SPRING - WINTER); // the target shrinks as the spring comes
    expect(goalProgress(s, g)).toBe(SPRING - WINTER);
  });

  it('food until spring is done by the forecast, or in the spring once the city is not starving', () => {
    const s = emptyGame({ food: 40, goalIndex: 0 });
    put(s, 'house', ROADSIDE, 27, 1); // 40 lasts a tent past the spring
    const events: GameEvent[] = [];
    checkGoal(s, events);
    expect(s.goalIndex).toBe(1);
    const t = emptyGame({ food: 1, goalIndex: 0, week: SPRING - 1 });
    put(t, 'house', ROADSIDE, 27, 1);
    put(t, 'house', ROADSIDE, 29, 1);
    put(t, 'house', ROADSIDE, 31, 1); // famine this week
    checkGoal(t, []);
    expect(t.goalIndex).toBe(0);
    t.week = SPRING;
    t.famine = true;
    expect(goalTarget(t, goal('foodUntilSpring'))).toBe(1); // never 0/0
    expect(goalProgress(t, goal('foodUntilSpring'))).toBe(0);
    checkGoal(t, []);
    expect(t.goalIndex).toBe(0); // waits while the city starves
    t.famine = false;
    checkGoal(t, []);
    expect(t.goalIndex).toBe(1);
  });

});

describe('harvest (simulation edges)', () => {
  it('a field placed in winter gives nothing until the spring', () => {
    const s = emptyGame({ week: WINTER });
    put(s, 'house', ROADSIDE, 27, 4); // enough workers
    put(s, 'field', westOf('field'), 30);
    expect(computeEconomy(s).harvest).toBe(0);
    s.week = SPRING;
    expect(computeEconomy(s).harvest).toBeCloseTo(WEEKLY);
  });

  it('a field placed in the last week of autumn gives food at once', () => {
    const s = emptyGame({ week: W - 1 });
    put(s, 'house', ROADSIDE, 27, 4);
    put(s, 'field', westOf('field'), 30);
    expect(computeEconomy(s).harvest).toBeCloseTo(WEEKLY);
  });

  it('a disconnected field harvests nothing', () => {
    const s = emptyGame({ week: SPRING });
    put(s, 'house', ROADSIDE, 27, 4);
    const f = put(s, 'field', 2, 2);
    f.built = 0;
    expect(f.connected).toBe(false);
    expect(fieldHarvest(s, f, SPRING)).toBe(0);
    expect(computeEconomy(s).harvest).toBe(0);
  });

  it('the harvest is scaled by the worker efficiency', () => {
    const s = emptyGame({ week: SPRING });
    put(s, 'house', ROADSIDE, 27, 1); // a tent's workers for two fields' jobs
    put(s, 'field', westOf('field'), 30).built = 0;
    put(s, 'field', westOf('field'), 33).built = 0;
    const e = computeEconomy(s);
    const eff = e.workers / (2 * BUILDINGS.field.jobs);
    expect(eff).toBeLessThan(1);
    expect(e.efficiency).toBeCloseTo(eff);
    expect(e.harvest).toBeCloseTo(2 * WEEKLY * eff);
  });

  it('announces the spring harvest in its first week and adds up every week, summer too', () => {
    const s = emptyGame({ week: SPRING, food: 0 });
    put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'house', ROADSIDE, 29, 1); // 2 tents without a plaza stay tents: workers for the 2 jobs
    put(s, 'field', westOf('field'), 31).built = 0;
    const weekly = computeEconomy(s).harvest;
    expect(stepWeek(s, never)).toContainEqual({ type: 'harvestStart', amount: Math.round(weekly * W * 100) / 100 });
    for (let k = 1; k < W; k++) expect(stepWeek(s, never).some((e) => e.type === 'harvestStart')).toBe(false);
    expect(s.milestones).toContain('firstHarvest');
    expect(seasonOf(s.week)).toBe('summer');
    expect(computeEconomy(s).harvest).toBeCloseTo(weekly); // the summer gives food too
    expect(stepWeek(s, never).some((e) => e.type === 'harvestStart')).toBe(false); // announced once a year
  });
});

describe('stores (edges)', () => {
  it('food exactly at the limit does not spoil', () => {
    const s = emptyGame({ food: RULES.baseFoodStorage });
    expect(stepWeek(s, never)).not.toContainEqual({ type: 'spoilStart' });
    expect(s.food).toBe(RULES.baseFoodStorage);
    expect(s.spoiled).toBe(0);
  });

  it('losing the granary spoils what no longer fits, and the spoiling ends when the food fits again', () => {
    const s = emptyGame({ food: 40 });
    put(s, 'granary', EAST, 30);
    s.food = 100;
    clearCell(s, EAST, 30);
    expect(foodCapacity(s)).toBe(RULES.baseFoodStorage);
    expect(stepWeek(s, never)).toContainEqual({ type: 'spoilStart' });
    expect(s.food).toBe(RULES.baseFoodStorage);
    expect(s.spoiled).toBe(100 - RULES.baseFoodStorage);
    put(s, 'house', ROADSIDE, 27, 1);
    stepWeek(s, never);
    expect(s.spoiled).toBe(0);
    expect(alerts(s).map((a) => a.kind)).not.toContain('spoiling');
  });

  it('a disconnected granary keeps nothing', () => {
    const s = emptyGame();
    const g = put(s, 'granary', 2, 2);
    expect(g.connected).toBe(false);
    expect(foodCapacity(s)).toBe(RULES.baseFoodStorage);
  });
});

describe('forecast (edges)', () => {
  /** Two big houses and one field, in the first week of the spring of year 2. */
  const town = (drought: boolean) => {
    const s = emptyGame({ week: SPRING + YEAR, food: 40, drought });
    put(s, 'house', ROADSIDE, 27, 4);
    put(s, 'house', ROADSIDE, 29, 4);
    put(s, 'field', westOf('field'), 31).built = 0;
    for (const k of Object.keys(s.coverage) as (keyof typeof s.coverage)[]) s.coverage[k].fill(true); // they stay big
    return s;
  };

  /** Test oracle for the town: the field at full efficiency, both houses big, the store limit. */
  const lasts = (drought: boolean) => {
    const s = town(drought);
    const cap = foodCapacity(s);
    let food = s.food;
    for (let k = 0; ; k++) {
      const w = s.week + k;
      const dry = drought && seasonOf(w) !== 'autumn' && w < s.week + 2 * W; // the dry spring and summer
      const made = harvestsIn(w) ? WEEKLY * (dry ? RULES.drought.harvestFactor : 1) : 0;
      const delta = Math.round((made - 2 * HOUSE_LEVELS[4].residents * foodPerResident(4, w)) * 100) / 100;
      food = Math.min(cap, Math.round((food + delta) * 100) / 100);
      if (food <= 0 && delta < 0) return { weeks: k, season: seasonOf(w) };
    }
  };

  it('counts the dry harvest once the drought is announced', () => {
    const wet = lasts(false);
    const dry = lasts(true);
    expect(wet.season).toBe('winter'); // the field fills the stores, the winter empties them
    expect(dry.weeks).toBeLessThan(wet.weeks); // the dry field falls short of the eating at once
    expect(foodForecast(town(false))).toEqual(wet);
    expect(foodForecast(town(true))).toEqual(dry);
  });

  it('in spring, "until the harvest" means the spring of the next year', () => {
    const s = town(false);
    expect(weeksToHarvest(s.week)).toBe(YEAR);
    expect(foodLastsToHarvest(s)).toBe(false);
  });

  it('accepts a shorter horizon and the economy already computed', () => {
    const s = emptyGame({ food: 6 });
    put(s, 'house', ROADSIDE, 27, 1);
    const k = weeksOfFood(6, 0, tentEats);
    expect(foodForecast(s, computeEconomy(s), k)).toBeNull(); // famine in week k: beyond the horizon
    expect(foodForecast(s, computeEconomy(s), k + 1)).toEqual({ weeks: k, season: seasonOf(k) });
  });

  it('a food stock that runs out at the last week before the harvest still does not last', () => {
    const eat = tentEats(SPRING - 2); // a winter week
    const s = emptyGame({ week: SPRING - 2, food: Math.round(2 * eat * 100) / 100 });
    put(s, 'house', ROADSIDE, 27, 1); // 0 in the second week
    expect(weeksToHarvest(s.week)).toBe(2);
    expect(foodLastsToHarvest(s)).toBe(false);
    s.food = Math.round((2 * eat + 0.01) * 100) / 100;
    expect(foodLastsToHarvest(s)).toBe(true);
  });
});

describe('winter (edges)', () => {
  it('a mud-brick house dropping in a winter famine is a winter loss; a new winter clears it', () => {
    const s = emptyGame({ food: 0, famine: true, week: WINTER + 2 });
    put(s, 'plaza', EAST, 27);
    const b = put(s, 'house', ROADSIDE, 27, 2);
    stepWeek(s, constRng(RULES.famineDropChance - 0.01));
    expect(b.level).toBe(1);
    expect(s.winterLoss).toBe(true);
    const t = emptyGame({ week: WINTER - 1, winterLoss: true });
    stepWeek(t, never);
    expect(t.winterLoss).toBe(false);
  });

  it('a tent leaving in a winter famine is a winter loss, and the first winter is not won', () => {
    const s = emptyGame({ food: 0, famine: true, week: SPRING - 1 });
    put(s, 'plaza', EAST, 27);
    put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'house', ROADSIDE, 29, 2); // stays (the roll is above the drop chance)
    const events = stepWeek(s, constRng(RULES.winterFamineLeaveChance - 0.01));
    expect(events).toContainEqual({ type: 'familyLeft', x: ROADSIDE, y: 27, reason: 'famine' });
    expect(s.winterLoss).toBe(true);
    expect(events).not.toContainEqual({ type: 'milestone', id: 'firstWinter' });
  });

  it('a winter famine alone (no house falls) also keeps the first winter from being won', () => {
    const s = emptyGame({ food: 0, week: SPRING - 2 });
    put(s, 'house', ROADSIDE, 27, 1);
    stepWeek(s, never); // the tent starves but stays (never leaves with this roll)
    expect(s.famine).toBe(true);
    expect(s.winterLoss).toBe(true);
    s.food = 100;
    expect(stepWeek(s, never)).not.toContainEqual({ type: 'milestone', id: 'firstWinter' });
  });

  it('a famine outside winter is not a winter loss', () => {
    const s = emptyGame({ food: 0, famine: true, week: SUMMER + 2 });
    put(s, 'plaza', EAST, 27);
    put(s, 'house', ROADSIDE, 27, 1);
    expect(stepWeek(s, constRng(RULES.famineLeaveChance - 0.01))).toContainEqual({ type: 'familyLeft', x: ROADSIDE, y: 27, reason: 'famine' });
    expect(s.winterLoss).toBe(false);
  });

  it('the first winter needs residents at the start of spring', () => {
    const s = emptyGame({ week: SPRING - 1 });
    expect(stepWeek(s, never)).not.toContainEqual({ type: 'milestone', id: 'firstWinter' });
  });
});

describe('milestones (once)', () => {
  it('a year without famine is not repeated in the next years', () => {
    const s = emptyGame({ week: AUTUMN2 - 1 });
    expect(stepWeek(s, never)).toContainEqual({ type: 'milestone', id: 'yearWithoutFamine' });
    s.week = AUTUMN2 + YEAR - 1;
    expect(stepWeek(s, never)).not.toContainEqual({ type: 'milestone', id: 'yearWithoutFamine' });
    expect(s.milestones.filter((m) => m === 'yearWithoutFamine')).toHaveLength(1);
  });

  it('a famine week marks the year', () => {
    const s = emptyGame({ food: 0 });
    put(s, 'house', ROADSIDE, 27, 1);
    stepWeek(s, never);
    expect(s.famine).toBe(true);
    expect(s.famineThisYear).toBe(true);
  });
});

describe('caravan (layout)', () => {
  it('pitches the tents in a 2 x 2 camp on both sides of the camp road, the row by the ring first, for free', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = createGame(createRng(seed));
      expect(s.silver).toBe(RULES.startSilver);
      expect(s.families).toEqual([]);
      const tents = s.buildings.filter((b) => b.kind === 'house');
      const spots = [{ x: 21, y: 19 }, { x: 24, y: 19 }, { x: 21, y: 17 }, { x: 24, y: 17 }].slice(0, tents.length);
      expect(tents.map((t) => ({ x: t.x, y: t.y }))).toEqual(spots);
      for (const t of tents) {
        expect(s.grid[t.y * s.cols + t.x]).toBe(t);
        expect(t.connected).toBe(true);
      }
      for (let y = 17; y <= 20; y++) expect(s.network[indexOf(s, 23, y)]).toBe(true); // the camp road
    }
  });

  it('in 500 maps one free, connected plaza spot by the camp reaches every caravan tent', () => {
    const spot = campPlazaSpot();
    for (let seed = 1; seed <= 500; seed++) {
      const s = createGame(createRng(seed));
      s.unlocked = [...s.unlocked, 'plaza'];
      expect(checkPlace(s, 'plaza', spot.x, spot.y).ok, `seed ${seed}`).toBe(true);
      place(s, 'plaza', spot.x, spot.y);
      const plaza = s.grid[indexOf(s, spot.x, spot.y)]!;
      expect(plaza.connected).toBe(true);
      for (const t of s.buildings.filter((b) => b.kind === 'house')) expect(needMet(s, t, 'plaza'), `seed ${seed}`).toBe(true);
    }
  });

  it('the opening food lasts the weeks it announces, and never more than the stores', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = createGame(createRng(seed));
      const eaten = computeEconomy(s).foodEaten;
      expect(s.food).toBeLessThanOrEqual(foodCapacity(s));
      expect(s.food / eaten).toBeGreaterThanOrEqual(s.start.foodWeeks - 1e-9);
      expect(s.food / eaten).toBeLessThan(s.start.foodWeeks + 1);
    }
  });
});

describe('alerts (order)', () => {
  it('in summer: debt, food short, spoiling, then the deficit', () => {
    const s = emptyGame({ week: SUMMER, silver: -5, food: 10, spoiled: 3 });
    put(s, 'market', EAST, 27); // upkeep above the tent's tax
    put(s, 'house', ROADSIDE, 27, 1);
    expect(alerts(s).map((a) => a.kind)).toEqual(['debt', 'foodShort', 'spoiling', 'deficit']);
  });

  it('at the end of autumn: spoiling before the winter warning; no warning without tents', () => {
    const s = emptyGame({ week: W - 1, spoiled: 2, food: 40 });
    const tent = put(s, 'house', ROADSIDE, 27, 1);
    expect(alerts(s).map((a) => a.kind)).toEqual(['spoiling', 'winterComing']);
    tent.level = 2;
    expect(alerts(s).map((a) => a.kind)).toEqual(['spoiling']);
  });

  it('the winter warning is only in autumn, not at the end of other seasons', () => {
    const s = emptyGame({ week: SPRING + W - 1, food: 40 });
    put(s, 'house', ROADSIDE, 27, 1);
    expect(alerts(s).map((a) => a.kind)).not.toContain('winterComing');
  });
});

describe('fields take no workers in winter', () => {
  /** Two tents, three fields built in the first autumn and a fisher by the river. */
  const opening = () => {
    const s = emptyGame({ food: 20, week: WINTER });
    put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'house', ROADSIDE, 29, 1);
    for (const y of [31, 34, 37]) put(s, 'field', westOf('field'), y);
    const fisher = put(s, 'fisher', besideRiver(s, 30), 30);
    return { s, fisher };
  };

  it('in winter a field has no jobs and makes no food, but still pays upkeep', () => {
    const { s, fisher } = opening();
    const e = computeEconomy(s);
    expect(e.jobs).toBe(BUILDINGS.fisher.jobs); // only the fisher
    expect(e.efficiency).toBe(1);
    expect(e.harvest).toBe(0);
    expect(e.yearJobs).toBe(3 * BUILDINGS.field.jobs + BUILDINGS.fisher.jobs); // still jobs of the year
    expect(e.foodMade).toBeGreaterThan(0);
    expect(e.foodMade).toBeCloseTo(gatherFood(s, fisher)); // the fisher at full strength
    s.goalIndex = RULES.upkeepStartsAfterGoal;
    expect(computeEconomy(s).upkeep.field).toBe(3 * BUILDINGS.field.upkeep!);
    expect(fisher.connected).toBe(true);
  });

  it('out of winter the field takes its workers, and the fisher shares them', () => {
    const { s } = opening();
    s.week = SPRING;
    const e = computeEconomy(s);
    expect(e.jobs).toBe(3 * BUILDINGS.field.jobs + BUILDINGS.fisher.jobs);
    expect(e.efficiency).toBeCloseTo(e.workers / e.jobs);
    expect(e.harvest).toBeGreaterThan(0);
  });


  it('the forecast counts the fields taking their workers in the spring', () => {
    const { s } = opening();
    s.week = SPRING - 1; // the last week of winter: the next one is the harvest
    s.food = 0.5;
    const e = computeEconomy(s); // the fisher alone, at full strength
    expect(e.efficiency).toBe(1);
    // In the spring the fields take the workers too: the fisher drops to workers / 7 jobs.
    const spring = structuredClone(s);
    spring.week = SPRING;
    const jobs = 3 * BUILDINGS.field.jobs + BUILDINGS.fisher.jobs;
    expect(e.workers).toBeLessThan(jobs);
    expect(computeEconomy(spring).efficiency).toBeCloseTo(e.workers / jobs);
    expect(foodForecast(s, e)).toBeNull(); // the harvest comes in time and feeds the city
  });
});
