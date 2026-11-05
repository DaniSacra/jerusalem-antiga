import { describe, expect, it } from 'vitest';
import { grownUpThisWeek, householdsOf, houseBirths, RULES, wed } from '../src/core';
import { emptyGame, person, put, ROADSIDE } from './helpers';

const P = RULES.people;
const FERTILE = P.fertileAges[0] + 2;

/** A tent (capacity 3) with a married couple of these ages living in it, and `extra` children. */
function coupleHouse(wifeAge = FERTILE, extra = 0) {
  const s = emptyGame();
  const h = put(s, 'house', ROADSIDE, 27, 1, false, 0);
  const man = person(s, { houseId: h.id, sex: 'm', age: wifeAge + 2 });
  const woman = person(s, { houseId: h.id, sex: 'f', age: wifeAge });
  wed(man, woman);
  for (let k = 0; k < extra; k++) person(s, { houseId: h.id, age: 2, fatherId: man.id, motherId: woman.id });
  return { s, h, man, woman };
}

describe('houseBirths (the births line of the house balloon)', () => {
  it('is ok for a married couple with room and nothing blocking', () => {
    const { s, h } = coupleHouse();
    expect(houseBirths(s, h, null)).toBe('ok');
  });

  it('is null with no married couple living together in the fertile ages', () => {
    const old = coupleHouse(P.fertileAges[1] + 1);
    expect(houseBirths(old.s, old.h, null)).toBeNull();
    const engaged = coupleHouse();
    engaged.woman.engaged = engaged.man.engaged = 0;
    expect(houseBirths(engaged.s, engaged.h, null)).toBeNull();
    const apart = coupleHouse();
    apart.man.houseId = null;
    expect(houseBirths(apart.s, apart.h, null)).toBeNull();
  });

  it('says the house is full before the food, but famine comes first', () => {
    const { s, h } = coupleHouse(FERTILE, 1); // 3 of 3 in a tent
    expect(houseBirths(s, h, null)).toBe('full');
    expect(houseBirths(s, h, 'food')).toBe('full');
    expect(houseBirths(s, h, 'famine')).toBe('famine');
  });

  it('passes the city block on (food, storage) when the house has room', () => {
    const { s, h } = coupleHouse();
    expect(houseBirths(s, h, 'food')).toBe('food');
    expect(houseBirths(s, h, 'storage')).toBe('storage');
  });

  it('is null for an empty house and any other building', () => {
    const s = emptyGame();
    const plot = put(s, 'house', ROADSIDE, 27);
    const field = put(s, 'field', ROADSIDE - 3, 31);
    expect(houseBirths(s, plot, null)).toBeNull();
    expect(houseBirths(s, field, null)).toBeNull();
  });
});

describe('householdsOf (families in the statistics)', () => {
  it('lists houses with people, fullest first, named by the eldest', () => {
    const s = emptyGame();
    const a = put(s, 'house', ROADSIDE, 27, 1, false, 0);
    const b = put(s, 'house', ROADSIDE, 29, 2, false, 0);
    put(s, 'house', ROADSIDE, 31); // empty plot: not listed
    const young = person(s, { houseId: a.id, age: 20 });
    young.clan = 4;
    const elder = person(s, { houseId: a.id, age: 60 });
    elder.clan = 7;
    for (let k = 0; k < 3; k++) person(s, { houseId: b.id, age: 30 }).clan = 2;
    expect(householdsOf(s).map((h) => [h.house.id, h.clan, h.people])).toEqual([
      [b.id, 2, 3],
      [a.id, 7, 2],
    ]);
  });
});

describe('grownUpThisWeek', () => {
  it('finds a person born in the city on the birthday that makes them an adult', () => {
    const s = emptyGame({ week: 500 });
    const h = put(s, 'house', ROADSIDE, 27, 1, false, 0);
    const caravan = person(s, { houseId: h.id, age: P.adultAge });
    expect(grownUpThisWeek(s)).toBeNull(); // came with a caravan
    caravan.caravan = null;
    expect(grownUpThisWeek(s)).toBe(caravan);
    caravan.birthWeek -= 1; // not the birthday week
    expect(grownUpThisWeek(s)).toBeNull();
  });
});
