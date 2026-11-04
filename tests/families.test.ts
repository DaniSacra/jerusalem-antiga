import { describe, expect, it } from 'vitest';
import {
  clearCell,
  computeEconomy,
  createGame,
  createRng,
  doorsOf,
  familyBlock,
  familyFactor,
  familySpeed,
  foodCapacity,
  foodLastsToHarvest,
  HOUSE_LEVELS,
  indexOf,
  place,
  plannedEating,
  RULES,
  stepWeek,
  type GameState,
} from '../src/core';
import { constRng, EAST, emptyGame, put, ROADSIDE, westOf } from './helpers';

const always = constRng(0);
const never = constRng(0.99);

/**
 * Gives the houses at ROADSIDE (y 27..35) water and the city a granary full of food, so nothing
 * but the rule under test blocks new families.
 */
function wellFed(s: GameState) {
  put(s, 'well', EAST, 30);
  put(s, 'granary', EAST, 36);
  s.food = foodCapacity(s);
}

/** A well east of the starting road, reaching the ROADSIDE houses at y 26..35. */
const water = (s: GameState) => put(s, 'well', EAST, 30);
/** A well west of the ring (x 19..20, y 25..26), reaching ROADSIDE houses up to y 30 and leaving x = 25 free. */
const waterWest = (s: GameState) => put(s, 'well', 19, 25);

describe('families', () => {
  it('a connected plot gets a family that walks from the entrance and turns it into a tent', () => {
    const s = emptyGame();
    water(s);
    const plot = put(s, 'house', ROADSIDE, 27);
    stepWeek(s, always); // sets out and walks its first week at once
    expect(s.families).toHaveLength(1);
    const f = s.families[0];
    expect(f.path[0]).toEqual(s.entrance);
    expect(f.path.at(-2)).toEqual({ x: 24, y: 28 }); // first road cell next to the 2x2 plot
    expect(f.path.at(-1)).toEqual({ x: ROADSIDE, y: 27 });
    expect(f.step).toBe(familySpeed());
    expect(plot.level).toBe(0);

    const weeks = Math.ceil((f.path.length - 1) / familySpeed());
    for (let k = 2; k < weeks; k++) stepWeek(s, never);
    expect(plot.level).toBe(0);
    expect(stepWeek(s, never)).toContainEqual({ type: 'houseUp', x: ROADSIDE, y: 27, level: 1, delta: HOUSE_LEVELS[1].residents });
    expect(s.families).toHaveLength(0);
  });

  it('walks familyCellsPerWeek cells a week', () => {
    expect(familySpeed()).toBe(RULES.familyCellsPerWeek);
  });

  it('sends at most one family every familyIntervalWeeks', () => {
    expect(RULES.familyIntervalWeeks).toBeGreaterThan(1);
    const s = emptyGame();
    wellFed(s);
    for (let y = 27; y <= 33; y += 2) put(s, 'house', ROADSIDE, y);
    const sent = () => s.families.length + s.buildings.filter((b) => b.kind === 'house' && b.level === 1).length;
    stepWeek(s, always);
    expect(s.families).toHaveLength(1); // one at most, even with 4 plots
    expect(familyBlock(s)).toBe('wait');
    for (let k = 1; k < RULES.familyIntervalWeeks; k++) {
      stepWeek(s, always);
      expect(sent(), `week ${s.week}`).toBe(1);
    }
    stepWeek(s, always);
    expect(sent()).toBe(2);
  });

  it('dispatches with the family chance scaled by happiness', () => {
    const s = emptyGame();
    for (const y of [29, 31, 33]) put(s, 'house', ROADSIDE, y, 1);
    wellFed(s);
    put(s, 'house', ROADSIDE, 27);
    const chance = RULES.familyChance * familyFactor(computeEconomy(s).happiness);
    stepWeek(s, constRng(chance + 0.01));
    expect(s.families).toHaveLength(0);
    stepWeek(s, constRng(chance - 0.01));
    expect(s.families).toHaveLength(1);
  });

  it('does not send families to disconnected plots or during famine', () => {
    const s = emptyGame();
    put(s, 'house', 1, 1);
    stepWeek(s, always);
    expect(s.families).toHaveLength(0);
    expect(familyBlock(s)).toBe('noPlot');

    const f = emptyGame({ famine: true, food: 0 });
    put(f, 'house', ROADSIDE, 30);
    put(f, 'house', ROADSIDE, 32, 1); // keeps the famine going
    expect(familyBlock(f)).toBe('famine');
    stepWeek(f, always);
    expect(f.families).toHaveLength(0);
  });

  it('waits until every house with a family has water', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 41, 1); // far from the well
    wellFed(s);
    put(s, 'house', ROADSIDE, 27);
    expect(familyBlock(s)).toBe('water');
    stepWeek(s, always);
    expect(s.families).toHaveLength(0);
    put(s, 'well', EAST, 41);
    expect(familyBlock(s)).toBeNull();
  });

  it('waits until the food lasts until the next harvest', () => {
    const s = emptyGame();
    for (const y of [33, 35]) put(s, 'house', ROADSIDE, y, 1);
    wellFed(s);
    put(s, 'house', ROADSIDE, 27);
    s.food = 5; // the harvest is 26 weeks away
    expect(familyBlock(s)).toBe('food');
    stepWeek(s, always);
    expect(s.families).toHaveLength(0);
    s.food = foodCapacity(s);
    expect(familyBlock(s)).toBeNull();
  });

  it('cancels the family if the plot is demolished or cut off, and reroutes around changes', () => {
    const s = emptyGame();
    water(s);
    put(s, 'house', ROADSIDE, 27);
    stepWeek(s, always);
    expect(s.families).toHaveLength(1);
    clearCell(s, ROADSIDE, 27);
    stepWeek(s, never);
    expect(s.families).toHaveLength(0);

    const r = emptyGame();
    waterWest(r);
    const plot = put(r, 'house', ROADSIDE, 27);
    stepWeek(r, always);
    expect(r.families).toHaveLength(1);
    // Build a detour, then cut the straight road ahead of the family.
    for (let y = 27; y <= 38; y++) place(r, 'road', 25, y);
    clearCell(r, 24, 32);
    expect(plot.connected).toBe(true);
    let arrived = false;
    for (let k = 0; k < 10 && !arrived; k++) arrived = stepWeek(r, never).some((e) => e.type === 'houseUp' && e.level === 1);
    expect(arrived).toBe(true);
    expect(plot.level).toBe(1);
  });

  it('starts at a road next to the altar if the entrance was cut off, never inside the altar', () => {
    const s = emptyGame();
    clearCell(s, 24, 47);
    water(s);
    put(s, 'house', ROADSIDE, 30);
    stepWeek(s, always);
    const altar = s.buildings.find((b) => b.kind === 'altar')!;
    const start = s.families[0].path[0];
    expect(doorsOf(s, altar)).toContainEqual(start); // a ring cell, outside the altar
    expect(s.grid[indexOf(s, start.x, start.y)]).toBeNull();
  });
});

describe('family gate (edges)', () => {
  it('an empty plot without water does not close the gate; a tent without water does', () => {
    const s = emptyGame();
    wellFed(s); // water at y 26..35
    put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'house', ROADSIDE, 29);
    expect(familyBlock(s)).toBeNull();
    const far = put(s, 'house', ROADSIDE, 41); // a plot out of reach
    expect(familyBlock(s)).toBeNull();
    far.level = 1;
    expect(familyBlock(s)).toBe('water');
  });

  it('a disconnected house without water does not close it', () => {
    const s = emptyGame();
    wellFed(s);
    put(s, 'house', ROADSIDE, 27);
    const far = put(s, 'house', 2, 2, 1);
    expect(far.connected).toBe(false);
    expect(familyBlock(s)).toBeNull();
  });

  it('gives the most important reason first: famine, water, food, wait, then no plot', () => {
    const s = emptyGame({ famine: true, food: 0, lastFamilyWeek: 0 });
    put(s, 'house', ROADSIDE, 41, 1); // no water, eats with no food
    expect(familyBlock(s)).toBe('famine');
    s.famine = false;
    expect(familyBlock(s)).toBe('water');
    put(s, 'well', EAST, 41);
    expect(familyBlock(s)).toBe('food');
    put(s, 'granary', EAST, 36);
    s.food = foodCapacity(s);
    expect(familyBlock(s)).toBe('wait');
    s.week = RULES.familyIntervalWeeks;
    expect(familyBlock(s)).toBe('noPlot'); // the only house is a tent
    put(s, 'house', ROADSIDE, 43);
    expect(familyBlock(s)).toBeNull();
  });

  it('waits exactly familyIntervalWeeks after the last family set out', () => {
    const s = emptyGame({ week: 10, lastFamilyWeek: 10 - RULES.familyIntervalWeeks + 1 });
    water(s);
    put(s, 'house', ROADSIDE, 27);
    expect(familyBlock(s)).toBe('wait'); // week 10
    stepWeek(s, always); // families set out in the new week, 11
    expect(s.families).toHaveLength(1);
    expect(s.lastFamilyWeek).toBe(11);
  });

  it('a plot with a family on the way is not open for another one', () => {
    const s = emptyGame();
    wellFed(s);
    put(s, 'house', ROADSIDE, 27);
    stepWeek(s, always);
    expect(s.families).toHaveLength(1);
    s.lastFamilyWeek = -Infinity;
    expect(familyBlock(s)).toBe('noPlot');
  });

  it('the family speed takes no argument and is the same every week', () => {
    expect(familySpeed.length).toBe(0);
    expect(familySpeed()).toBe(RULES.familyCellsPerWeek);
  });
});

describe('caravan and families', () => {
  it('the caravan tents need water before any new family comes', () => {
    for (const seed of [1, 2, 3]) {
      const s = createGame(createRng(seed));
      put(s, 'house', ROADSIDE, 30);
      expect(familyBlock(s)).toBe('water');
    }
  });
});

describe('honest family gate', () => {
  it('counts the houses at the level they will reach: a well with 2 tents lets no family starve the city', () => {
    // 2 tents with a well will be mud-brick houses: 80 food lasts them to the spring (week 26),
    // but not with one more tent and the reserve, so no family sets out.
    const s = emptyGame({ food: 80, goalIndex: 0 });
    water(s);
    put(s, 'granary', EAST, 36); // room for the 80
    put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'house', ROADSIDE, 29, 1);
    for (const y of [31, 33]) put(s, 'house', ROADSIDE, y);
    put(s, 'house', EAST, 33);
    expect(foodLastsToHarvest(s)).toBe(true);
    expect(familyBlock(s)).toBe('food');
    for (let w = 0; w < 26; w++) {
      stepWeek(s, always);
      expect(s.famine, `week ${s.week}`).toBe(false); // a family may come late in the winter, when it fits
    }
  });

  it('counts each family on the way as a tent', () => {
    const s = emptyGame({ food: 22 });
    put(s, 'house', ROADSIDE, 27);
    put(s, 'house', ROADSIDE, 29);
    // One tent on the way and the new one: 22 does not last them to the spring (26 weeks).
    expect(familyBlock(s)).toBeNull(); // nobody here yet: an empty city never waits for food
    stepWeek(s, always);
    expect(s.families).toHaveLength(1);
    s.lastFamilyWeek = -Infinity;
    expect(familyBlock(s)).toBe('food');
  });

  it('says "storage" when the food would last but the store cannot hold it', () => {
    // 4 mud-brick houses and a new tent: the winter needs more than the store of 50, although
    // the autumn field makes plenty.
    const s = emptyGame({ food: RULES.baseFoodStorage });
    water(s);
    for (const y of [27, 29, 31, 33]) put(s, 'house', ROADSIDE, y, 2);
    put(s, 'field', westOf('field'), 37);
    expect(familyBlock(s)).toBe('storage');
    put(s, 'granary', EAST, 36);
    expect(familyBlock(s)).not.toBe('storage');
    expect(familyBlock(s)).not.toBe('food');
  });

  it('the gate the step uses is the one the screen reads after the step', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rng = createRng(seed);
      const s = emptyGame({ food: Math.floor(rng() * 60), week: 1 + Math.floor(rng() * 11), lastFamilyWeek: -Infinity });
      water(s);
      const tents = Math.floor(rng() * 4);
      for (let k = 0; k < 4; k++) put(s, 'house', ROADSIDE, 27 + 2 * k, k < tents ? 1 : 0);
      const quiet = structuredClone(s);
      stepWeek(quiet, never); // no family can set out with this rng
      const before = s.families.length;
      stepWeek(s, always);
      expect(s.families.length > before, `seed ${seed}`).toBe(familyBlock(quiet) === null);
    }
  });
});

describe('an empty city never gets stuck', () => {
  it('with no residents and nobody on the way, water and food do not close the gate', () => {
    // The playtester's case: no tents, little silver, no food and a plot without water.
    for (let seed = 1; seed <= 30; seed++) {
      const s = emptyGame({ food: 0, silver: 20, goalIndex: 0 });
      const plot = put(s, 'house', ROADSIDE, 27);
      expect(familyBlock(s)).toBeNull();
      const rng = createRng(seed);
      for (let w = 0; w < 40 && plot.level === 0; w++) stepWeek(s, rng);
      expect(plot.level, `seed ${seed}`).toBe(1); // a family arrives, whatever the season
    }
  });

  it('still waits the interval between families', () => {
    const s = emptyGame({ food: 0, week: 5, lastFamilyWeek: 4 });
    put(s, 'house', ROADSIDE, 27);
    expect(familyBlock(s)).toBe('wait');
  });
});

describe('food reserve at the door', () => {
  /**
   * Two tents with water (planned as mud-brick houses), a granary, two plots, and the smallest food
   * (to 0.1) with which the forecast (one new tent, the given reserve) lasts until the spring.
   */
  function setup() {
    const s = emptyGame({ lastFamilyWeek: -Infinity });
    wellFed(s);
    put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'house', ROADSIDE, 29, 1);
    put(s, 'house', ROADSIDE, 31);
    const minFood = (reserveWeeks: number) => {
      for (let f = 0; f <= foodCapacity(s); f = Math.round((f + 0.1) * 10) / 10) {
        s.food = f;
        if (foodLastsToHarvest(s, computeEconomy(s), { extraTents: 1, reserveWeeks })) return f;
      }
      throw new Error('never lasts');
    };
    return { s, minFood };
  }

  it('needs familyFoodReserveWeeks weeks of the planned eating on top of the food that just lasts', () => {
    expect(RULES.familyFoodReserveWeeks).toBeGreaterThan(0);
    const { s, minFood } = setup();
    const bare = minFood(0);
    const reserved = minFood(RULES.familyFoodReserveWeeks);
    const reserve = RULES.familyFoodReserveWeeks * plannedEating(s, 1).eaten;
    expect(reserved - bare).toBeGreaterThan(reserve - 0.2);
    expect(reserved - bare).toBeLessThan(reserve + 0.2);
  });

  it('is closed when the food would drop below the reserve, open from the reserve up', () => {
    const { s, minFood } = setup();
    const bare = minFood(0);
    const reserved = minFood(RULES.familyFoodReserveWeeks);
    s.food = bare; // lasts to the spring, but eats into the reserve
    expect(familyBlock(s)).toBe('food');
    s.food = Math.round((reserved - 0.1) * 10) / 10;
    expect(familyBlock(s)).toBe('food');
    s.food = reserved;
    expect(familyBlock(s)).toBeNull();
    stepWeek(s, constRng(0));
    expect(s.families).toHaveLength(1);
  });
});
