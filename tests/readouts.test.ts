import { describe, expect, it } from 'vitest';
import {
  foodLostIfRemoved,
  balanceAfter,
  BUILDINGS,
  calendar,
  fieldBonus,
  foodPerResident,
  HOUSE_LEVELS,
  checkPlace,
  cityLevel,
  computeEconomy,
  familyBlock,
  foodAfter,
  foodForecast,
  goalCount,
  goalFraction,
  GOALS,
  WEEKS_PER_YEAR,
  housesByLevel,
  housesServed,
  needMet,
  place,
  readCity,
  RULES,
  seasonOf,
  spotsServing,
  upgradeGain,
  indexOf,
} from '../src/core';
import { besideRiver, EAST, emptyGame, meetGoal, put, ROAD_X, ROADSIDE, westOf } from './helpers';

describe('city level and goal progress', () => {
  it('level is goals done + 1', () => {
    expect(cityLevel(emptyGame({ goalIndex: 0 }))).toBe(1);
    expect(cityLevel(emptyGame({ goalIndex: 2 }))).toBe(3);
  });

  it('progress is the share of the current goal, capped at 1', () => {
    const i = GOALS.findIndex((g) => g.type === 'houses');
    const goal = GOALS[i];
    const s = emptyGame({ goalIndex: i });
    put(s, 'house', ROADSIDE, 27, goal.level! - 1); // one level short: does not count
    expect(goalFraction(s)).toBe(0);
    put(s, 'house', ROADSIDE, 29, goal.level!);
    expect(goalFraction(s)).toBeCloseTo(1 / goal.target);
    for (let k = 0; k < goal.target + 1; k++) put(s, 'house', ROADSIDE, 31 + 2 * k, goal.level!);
    expect(goalFraction(s)).toBe(1); // more than the target: capped
  });

  it('a goal met before its fromYear never shows a full bar; from that year on it does', () => {
    const i = GOALS.findIndex((g) => g.fromYear);
    const goal = GOALS[i];
    const target = goal.target;
    goal.target = HOUSE_LEVELS[HOUSE_LEVELS.length - 1].residents * 2; // fits the test map; restored below
    try {
      const s = emptyGame({ goalIndex: i, week: 0 });
      meetGoal(s, goal);
      expect(goalFraction(s)).toBeGreaterThan(0.9);
      expect(goalFraction(s)).toBeLessThan(1);
      s.week = (goal.fromYear! - 1) * WEEKS_PER_YEAR;
      expect(goalFraction(s)).toBe(1);
    } finally {
      goal.target = target;
    }
  });

  it('progress of the food goal follows the shrinking target, and is 1 once the spring came', () => {
    const W = RULES.weeksPerSeason;
    const s = emptyGame({ goalIndex: 0, food: 6 });
    put(s, 'house', ROADSIDE, 27, 1);
    /** Whole weeks 6 food lasts one tent from `week` (the winter weeks eat more). */
    const lasts = (week: number) => {
      let food = 6;
      let k = 0;
      while ((food = Math.round((food - HOUSE_LEVELS[1].residents * foodPerResident(1, week + k)) * 100) / 100) > 0) k++;
      return k;
    };
    expect(lasts(0)).toBeLessThan(2 * W);
    expect(goalFraction(s)).toBeCloseTo(lasts(0) / (2 * W));
    s.week = W;
    expect(lasts(W)).toBeLessThan(lasts(0)); // winter eating
    expect(goalFraction(s)).toBeCloseTo(lasts(W) / W);
    s.week = 2 * W;
    expect(goalFraction(s)).toBe(1);
  });

  it('progress is 1 once every goal is done', () => {
    expect(goalCount()).toBe(GOALS.length);
    expect(goalFraction(emptyGame({ goalIndex: GOALS.length }))).toBe(1);
  });
});

describe('city readout', () => {
  it('bundles the economy, the food forecast and the family gate of the same state', () => {
    const s = emptyGame({ food: 6 });
    put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'house', ROADSIDE, 29);
    const r = readCity(s);
    expect(r.eco).toEqual(computeEconomy(s));
    expect(r.forecast).toEqual(foodForecast(s));
    expect(r.forecast).not.toBeNull();
    expect(r.block).toBe(familyBlock(s));
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
    expect(balanceAfter(s, 'plaza')).toBeCloseTo(now - BUILDINGS.plaza.upkeep!);
    expect(balanceAfter(s, 'temple')).toBeCloseTo(now - 10);
  });

  it('counts no upkeep before upkeep is charged', () => {
    const s = emptyGame({ goalIndex: 0 });
    expect(balanceAfter(s, 'plaza')).toBe(computeEconomy(s).silverDelta);
  });

  it('a workshop only costs its upkeep: it makes no silver', () => {
    const s = emptyGame();
    for (let y = 27; y <= 45; y += 2) put(s, 'house', ROADSIDE, y, 4); // plenty of workers
    const now = computeEconomy(s).silverDelta;
    expect(balanceAfter(s, 'workshop')).toBeCloseTo(now - BUILDINGS.workshop.upkeep!);
    expect(balanceAfter(s, 'field')).toBeCloseTo(now - BUILDINGS.field.upkeep!);
  });

  it('does not change the city', () => {
    const s = emptyGame();
    const n = s.buildings.length;
    balanceAfter(s, 'market');
    expect(s.buildings.length).toBe(n);
  });
});

describe('food after building', () => {
  /** One tent and a fisher by the river that its workers keep busy. */
  const town = () => {
    const s = emptyGame({ week: 0 }); // autumn: fields give food
    put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'fisher', besideRiver(s, 30), 30);
    return s;
  };

  const workers = Math.floor(HOUSE_LEVELS[1].residents * RULES.workerShare);

  it('a workplace that takes the workers lowers the food: every food building brings less', () => {
    const s = town();
    const now = computeEconomy(s);
    expect(now.efficiency).toBe(1);
    const after = foodAfter(s, 'market');
    const jobs = BUILDINGS.fisher.jobs + BUILDINGS.market.jobs;
    expect(workers).toBeLessThan(jobs);
    expect(after.efficiency).toBeCloseTo(workers / jobs);
    expect(after.delta).toBeLessThan(now.foodDelta);
    expect(after.yields).toBe(0);
  });

  it('a field brings its harvest times the efficiency with its own jobs', () => {
    const s = town();
    const at = { x: westOf('field'), y: 30, rotated: false };
    const after = foodAfter(s, 'field', at);
    const eff = workers / (BUILDINGS.fisher.jobs + BUILDINGS.field.jobs);
    expect(eff).toBeLessThan(1);
    expect(after.efficiency).toBeCloseTo(eff);
    expect(after.yields).toBeCloseTo((BUILDINGS.field.harvest! / 39) * eff, 1);
    // The fisher brings less too: the city gains less than the field's full harvest.
    expect(after.delta - computeEconomy(s).foodDelta).toBeLessThan(BUILDINGS.field.harvest! / 39);
  });

  it('a workshop raises the food of the fields (in delta, not in its own yield)', () => {
    const s = emptyGame({ week: 0 });
    put(s, 'house', ROADSIDE, 31, 4); // workers for everything below
    put(s, 'house', ROADSIDE, 33, 4);
    put(s, 'field', westOf('field'), 28);
    const now = computeEconomy(s);
    const after = foodAfter(s, 'workshop');
    expect(after.efficiency).toBe(1);
    expect(after.yields).toBe(0);
    expect(after.delta).toBeCloseTo(now.foodDelta + now.harvest * BUILDINGS.workshop.fieldBonus!);
    // Off the roads it adds nothing.
    expect(foodAfter(s, 'workshop', { x: 2, y: 2, rotated: false }).delta).toBeCloseTo(now.foodDelta);
    // Once the bonus is at its cap, one more workshop adds nothing to the food.
    for (const y of [27, 30, 33]) put(s, 'workshop', EAST, y);
    expect(fieldBonus(s)).toBeCloseTo(BUILDINGS.workshop.fieldBonusMax!);
    expect(foodAfter(s, 'workshop').efficiency).toBe(1);
    expect(foodAfter(s, 'workshop').delta).toBeCloseTo(computeEconomy(s).foodDelta);
  });

  it('a spot off the roads works for nothing: no food, no jobs', () => {
    const s = town();
    const after = foodAfter(s, 'field', { x: 2, y: 2, rotated: false });
    expect(after.yields).toBe(0);
    expect(after.delta).toBe(computeEconomy(s).foodDelta);
  });

  it('a field in the winter brings nothing and takes no workers', () => {
    const s = town();
    while (seasonOf(s.week) !== 'winter') s.week++;
    expect(foodAfter(s, 'field', { x: westOf('field'), y: 30, rotated: false }).yields).toBe(0);
  });
});

describe('houses served', () => {
  it('counts houses with a family inside the radius of a service', () => {
    const s = emptyGame();
    const plaza = put(s, 'plaza', EAST, 27);
    put(s, 'house', ROADSIDE, 27, 1); // inside
    put(s, 'house', ROADSIDE, 29); // empty plot: not counted
    put(s, 'house', ROADSIDE, 41, 1); // too far (radius 4)
    expect(housesServed(s, plaza)).toBe(1);
  });

  it('is 0 for a disconnected service and null for kinds without one', () => {
    const s = emptyGame();
    const plaza = put(s, 'plaza', 2, 2);
    put(s, 'house', 4, 2, 1);
    expect(housesServed(s, plaza)).toBe(0);
    expect(housesServed(s, put(s, 'workshop', EAST, 30))).toBeNull();
  });
});

describe('house upgrade gain', () => {
  it('gives the residents, tax and food gained on the next level, at the week\'s rate (winter factors)', () => {
    const winter = RULES.weeksPerSeason; // first winter week
    expect(seasonOf(winter)).toBe('winter');
    for (let level = 0; level < HOUSE_LEVELS.length - 1; level++) {
      const cur = HOUSE_LEVELS[level];
      const next = HOUSE_LEVELS[level + 1];
      for (const week of [0, winter]) {
        expect(upgradeGain(level, week)).toEqual({
          residents: next.residents - cur.residents,
          tax: next.tax - cur.tax,
          food: expect.closeTo(next.residents * foodPerResident(level + 1, week) - cur.residents * foodPerResident(level, week)),
          materials: next.materials ?? {},
        });
      }
      expect(upgradeGain(level, winter)!.food).not.toBe(upgradeGain(level, 0)!.food); // the winter factors apply
    }
  });

  it('is null at the top level', () => {
    expect(upgradeGain(HOUSE_LEVELS.length - 1, 0)).toBeNull();
  });
});

describe('spots serving a building', () => {
  it('every spot is a valid place whose radius reaches the house', () => {
    const s = emptyGame();
    const house = put(s, 'house', ROADSIDE, 40, 1);
    const spots = spotsServing(s, 'plaza', house);
    expect(spots.length).toBeGreaterThan(0);
    for (const c of spots) expect(checkPlace(s, 'plaza', c.x, c.y, c.rotated).ok).toBe(true);
    const c = spots[0];
    place(s, 'plaza', c.x, c.y, c.rotated);
    expect(needMet(s, house, 'plaza')).toBe(true);
  });

  it('leaves out places too far from the house', () => {
    const s = emptyGame();
    const house = put(s, 'house', ROADSIDE, 40, 1);
    for (const c of spotsServing(s, 'plaza', house)) {
      expect(Math.abs(c.y - house.y)).toBeLessThanOrEqual(4 + 2);
    }
    expect(spotsServing(s, 'plaza', house).some((c) => c.y < 30)).toBe(false);
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
    put(s, 'plaza', EAST, 27); // not a house
    expect(housesByLevel(s)).toEqual([1, 2, 0, 0, 1]);
  });
});

describe('food made and eaten', () => {
  it('splits the food balance into production and consumption', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 27, 2);
    put(s, 'field', EAST, 27);
    s.week = 2 * RULES.weeksPerSeason; // first spring: the field built in autumn harvests
    const e = computeEconomy(s);
    expect(e.foodEaten).toBeCloseTo(HOUSE_LEVELS[2].residents * HOUSE_LEVELS[2].food);
    expect(e.foodMade).toBeCloseTo(e.foodDelta + e.foodEaten);
    expect(e.foodMade).toBeGreaterThan(0);
  });
});

describe('food lost if removed (Demolir preview)', () => {
  const G = BUILDINGS.granary.storage!;
  const full = () => {
    const s = emptyGame();
    put(s, 'granary', EAST, 30);
    put(s, 'house', ROADSIDE, 30, 1);
    s.food = RULES.baseFoodStorage + G; // the store is full
    return s;
  };

  it('a granary loses the food above what the city keeps without it', () => {
    const s = full();
    expect(foodLostIfRemoved(s, EAST, 30)).toBe(G);
    s.food = RULES.baseFoodStorage + 1;
    expect(foodLostIfRemoved(s, EAST + 1, 31)).toBe(1); // any cell of the granary
    s.food = RULES.baseFoodStorage;
    expect(foodLostIfRemoved(s, EAST, 30)).toBe(0); // it all fits in the base store
  });

  it('a road whose cut disconnects the granary loses food too; other roads do not', () => {
    const s = full();
    expect(foodLostIfRemoved(s, ROAD_X, 28)).toBe(G); // between the ring and the granary
    expect(foodLostIfRemoved(s, ROAD_X, 40)).toBe(0); // below it
  });

  it('nothing is lost for a house, an empty cell or the protected altar, and the city is untouched', () => {
    const s = full();
    const before = JSON.stringify({ b: s.buildings, r: s.roads, n: s.network, f: s.food, $: s.silver });
    expect(foodLostIfRemoved(s, ROADSIDE, 30)).toBe(0);
    expect(foodLostIfRemoved(s, 1, 1)).toBe(0);
    const altar = s.buildings.find((b) => b.kind === 'altar')!;
    expect(foodLostIfRemoved(s, altar.x, altar.y)).toBe(0);
    foodLostIfRemoved(s, EAST, 30);
    foodLostIfRemoved(s, ROAD_X, 28);
    expect(JSON.stringify({ b: s.buildings, r: s.roads, n: s.network, f: s.food, $: s.silver })).toBe(before);
    expect(s.grid[indexOf(s, EAST, 30)]?.kind).toBe('granary');
  });

  it('works while in debt (demolishing is allowed in debt)', () => {
    const s = full();
    s.silver = -50;
    expect(foodLostIfRemoved(s, EAST, 30)).toBe(G);
  });
});
