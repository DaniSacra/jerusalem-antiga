import { describe, expect, it } from 'vitest';
import { alerts, BUILDINGS, clothesPerWeek, clothesShort, coldDeathChance, computeEconomy, GOALS, RULES, stepWeek, wearClothes, type GameEvent, type GameState } from '../src/core';
import { constRng, EAST, emptyGame, fill, hire, person, put, ROADSIDE } from './helpers';

const C = RULES.clothes;
const W = RULES.weeksPerSeason;
/** First weeks of the second autumn and of the first winter (the game starts in autumn). */
const AUTUMN = 4 * W;
const WINTER = W;

/** A city of `n` residents in stone houses (4 a house) by the road. */
function city(n: number, o: Partial<GameState> = {}): GameState {
  const s = emptyGame(o);
  for (let k = 0, left = n; left > 0; k++, left -= 4) fill(s, put(s, 'house', ROADSIDE, 27 + 2 * k, 3, false, 0), Math.min(4, left));
  return s;
}

describe('tannery data (plano-dificuldade E)', () => {
  it('Curtume: 2 x 2, 50 silver + 10 wood, upkeep 1.5, 2 jobs, 0.4 livestock into 1 clothes a week', () => {
    expect(BUILDINGS.tannery).toMatchObject({ cost: 50, upkeep: 1.5, w: 2, h: 2, jobs: 2, materials: { wood: 10 }, tans: { livestock: 0.4, clothes: 1 } });
    expect(C).toEqual({ perPerson: 0.03, storage: 100 });
    expect(RULES.coldDeath.tentRagged).toEqual([0.02, 0]);
    expect(RULES.coldDeath.houseRagged).toEqual([0.005, 0]);
  });

  it('the Alicerce unlocks it, and the next goal asks for one', () => {
    const i = GOALS.findIndex((g) => g.type === 'templeStage' && g.stage === 2);
    expect(GOALS[i].unlock).toBe('tannery');
    expect(GOALS[i + 1]).toMatchObject({ type: 'build', kind: 'tannery', target: 1, reward: 60 });
  });
});

describe('the tannery turns livestock into clothes', () => {
  it('by its crew: full crew 1 clothes for 0.4 livestock, half crew half; nobody, nothing', () => {
    const s = city(0, { livestock: 50 });
    const t = put(s, 'tannery', EAST, 27);
    expect(computeEconomy(s)).toMatchObject({ clothes: 0, hides: 0 });
    hire(s, t, 1); // workers from outside the houses (helpers)
    expect(computeEconomy(s)).toMatchObject({ clothes: 0.5, hides: 0.2 });
    hire(s, t, 1);
    const e = computeEconomy(s);
    expect(e).toMatchObject({ clothes: 1, hides: 0.4 });
    expect(e.livestock).toBeCloseTo(-0.4); // the pens give it before the altar's offering
  });

  it('stops with empty pens, and works as far as the livestock there is', () => {
    const s = city(8, { livestock: 0 });
    hire(s, put(s, 'tannery', EAST, 27), 2);
    expect(computeEconomy(s)).toMatchObject({ clothes: 0, hides: 0 });
    s.livestock = 0.2;
    expect(computeEconomy(s)).toMatchObject({ clothes: 0.5, hides: 0.2 });
  });

  it('stops at the clothes store cap', () => {
    const s = city(8, { livestock: 50, clothes: C.storage - 0.5 });
    hire(s, put(s, 'tannery', EAST, 27), 2);
    expect(computeEconomy(s)).toMatchObject({ clothes: 0.5, hides: 0.2 });
    s.clothes = C.storage;
    expect(computeEconomy(s).clothes).toBe(0);
  });

  it('a week of the game moves the livestock into the clothes store', () => {
    const s = city(8, { livestock: 50, week: 1 });
    hire(s, put(s, 'tannery', EAST, 27), 2);
    stepWeek(s, constRng(0.99));
    expect(s.clothes).toBe(1);
    expect(s.livestock).toBeCloseTo(49.6);
  });
});

describe('clothes in winter', () => {
  it('each resident wears out perPerson a winter week, once the city dresses; never out of winter', () => {
    const s = city(25, { week: WINTER, clothes: 10, dressing: true });
    expect(clothesPerWeek(s, 25)).toBeCloseTo(25 * C.perPerson);
    const events: GameEvent[] = [];
    wearClothes(s, 25, events);
    expect(s.clothes).toBeCloseTo(10 - 25 * C.perPerson);
    expect(s.ragged).toBe(false);
    s.week = AUTUMN;
    wearClothes(s, 25, events);
    expect(s.clothes).toBeCloseTo(10 - 25 * C.perPerson);
    s.week = WINTER;
    s.dressing = false;
    wearClothes(s, 25, events);
    expect(s.clothes).toBeCloseTo(10 - 25 * C.perPerson);
    expect(events).toEqual([]);
  });

  it('short of clothes the city is ragged: the store goes to 0, the toast once per episode', () => {
    const s = city(25, { week: WINTER, clothes: 0.5, dressing: true });
    const events: GameEvent[] = [];
    wearClothes(s, 25, events);
    expect(s).toMatchObject({ ragged: true, clothes: 0 });
    wearClothes(s, 25, events);
    expect(events).toEqual([{ type: 'raggedStart' }]);
    s.clothes = 5;
    wearClothes(s, 25, events);
    expect(s.ragged).toBe(false);
  });

  it('the city dresses from the first autumn after the tannery is unlocked', () => {
    const s = city(8, { week: AUTUMN - 1 });
    stepWeek(s, constRng(0.99));
    expect(s.dressing).toBe(false);
    s.unlocked.push('tannery');
    s.week = AUTUMN - 1;
    stepWeek(s, constRng(0.99));
    expect(s.dressing).toBe(true);
  });

  it('ragged: children and elders may die of cold even with firewood (tent 2%, house 0.5%); adults not', () => {
    const s = city(0, { week: WINTER, ragged: true });
    const house = put(s, 'house', ROADSIDE, 27, 3, false, 0);
    const tent = put(s, 'house', ROADSIDE, 29, 1, false, 0);
    const child = person(s, { houseId: house.id, age: 2 });
    const adult = person(s, { houseId: house.id, age: 30 });
    const tentChild = person(s, { houseId: tent.id, age: 2 });
    expect(coldDeathChance(s, child)).toBe(0.005);
    expect(coldDeathChance(s, adult)).toBe(0);
    expect(coldDeathChance(s, tentChild)).toBe(0.02);
    s.ragged = false;
    expect(coldDeathChance(s, child)).toBe(0);
    // Without firewood the cold rules, clothes or not.
    s.cold = true;
    s.ragged = true;
    expect(coldDeathChance(s, child)).toBe(RULES.coldDeath.houseCold[0]);
    expect(coldDeathChance(s, tentChild)).toBe(RULES.coldDeath.tentCold[0]);
  });

  it('clothesShort: in autumn, the clothes missing for the whole winter; the alert says it', () => {
    const s = city(25, { week: AUTUMN, clothes: 3, dressing: true });
    const need = clothesPerWeek(s, 25) * W;
    expect(clothesShort(s, { clothes: 0, residents: 25 })).toBe(Math.ceil(need - 3));
    expect(clothesShort(s, { clothes: 1, residents: 25 })).toBe(0); // a tannery makes enough until the spring
    expect(alerts(s)).toContainEqual({ kind: 'clothes', missing: Math.ceil(need - 3), ragged: false });
    s.dressing = false;
    expect(clothesShort(s, { clothes: 0, residents: 25 })).toBe(0);
  });
});
