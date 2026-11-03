import { describe, expect, it } from 'vitest';
import { clearCell, computeEconomy, createGame, createRng, doorsOf, familyBlock, familyFactor, familySpeed, foodCapacity, indexOf, place, RULES, stepWeek, type GameState } from '../src/core';
import { constRng, EAST, emptyGame, put, ROADSIDE } from './helpers';

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
    expect(stepWeek(s, never)).toContainEqual({ type: 'houseUp', x: ROADSIDE, y: 27, level: 1, delta: 3 });
    expect(s.families).toHaveLength(0);
  });

  it('walks familyCellsPerWeek cells a week', () => {
    expect(familySpeed()).toBe(RULES.familyCellsPerWeek);
  });

  it('sends at most one family every familyIntervalWeeks', () => {
    expect(RULES.familyIntervalWeeks).toBe(2);
    const s = emptyGame();
    water(s);
    for (let y = 27; y <= 33; y += 2) put(s, 'house', ROADSIDE, y);
    stepWeek(s, always);
    expect(s.families).toHaveLength(1); // one per week at most, even with 4 plots
    expect(familyBlock(s)).toBe('wait');
    stepWeek(s, always);
    expect(s.families.length + s.buildings.filter((b) => b.kind === 'house' && b.level === 1).length).toBe(1);
    stepWeek(s, always);
    expect(s.families.length + s.buildings.filter((b) => b.kind === 'house' && b.level === 1).length).toBe(2);
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
    s.food = 5; // 1.2 eaten a week, the harvest is 26 weeks away
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
  it('an empty plot without water closes the gate too', () => {
    const s = emptyGame();
    water(s); // y 26..35
    put(s, 'house', ROADSIDE, 27);
    expect(familyBlock(s)).toBeNull();
    put(s, 'house', ROADSIDE, 41); // a plot out of reach
    expect(familyBlock(s)).toBe('water');
  });

  it('a disconnected house without water does not close it', () => {
    const s = emptyGame();
    water(s);
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
    s.food = 40;
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
    expect(familyBlock(s)).toBe('wait');
    stepWeek(s, always);
    expect(s.families).toHaveLength(0);
    expect(familyBlock(s)).toBeNull(); // week 11
    stepWeek(s, always);
    expect(s.families).toHaveLength(1);
    expect(s.lastFamilyWeek).toBe(11);
  });

  it('a plot with a family on the way is not open for another one', () => {
    const s = emptyGame();
    water(s);
    put(s, 'house', ROADSIDE, 27);
    stepWeek(s, always);
    expect(s.families).toHaveLength(1);
    s.lastFamilyWeek = -Infinity;
    expect(familyBlock(s)).toBe('noPlot');
  });

  it('the family speed takes no argument and is the same every week', () => {
    expect(familySpeed.length).toBe(0);
    expect(familySpeed()).toBe(6);
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
