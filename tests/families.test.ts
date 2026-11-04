import { describe, expect, it } from 'vitest';
import {
  clearCell,
  doorsOf,
  familySpeed,
  freeHouses,
  indexOf,
  place,
  RULES,
  sendWalking,
  startCell,
  stepWeek,
  type GameState,
} from '../src/core';
import { constRng, EAST, emptyGame, person, put, ROADSIDE } from './helpers';

const never = constRng(0.99);

/** A family of the caravan (no house yet) sent from the entrance to a house. */
function caravanTo(s: GameState, x: number, y: number) {
  const a = person(s, { houseId: null, sex: 'm', age: 30, caravan: 1 });
  const b = person(s, { houseId: null, sex: 'f', age: 28, caravan: 1 });
  const house = s.grid[indexOf(s, x, y)] ?? put(s, 'house', x, y);
  expect(sendWalking(s, startCell(s), [house], [a.id, b.id])).toBe(house);
  return { a, b, house };
}

describe('walking to a house', () => {
  it('walks familyCellsPerWeek cells a week from the entrance and moves in: a plot becomes a tent', () => {
    const s = emptyGame();
    put(s, 'plaza', EAST, 30);
    const { a, b, house } = caravanTo(s, ROADSIDE, 27);
    const f = s.families[0];
    expect(f.members).toEqual([a.id, b.id]);
    expect(f.path[0]).toEqual(s.entrance);
    expect(f.path.at(-2)).toEqual({ x: 24, y: 28 }); // first road cell next to the 2x2 house
    expect(f.path.at(-1)).toEqual({ x: ROADSIDE, y: 27 });
    expect(familySpeed()).toBe(RULES.familyCellsPerWeek);
    const weeks = Math.ceil((f.path.length - 1) / familySpeed());
    for (let k = 1; k < weeks; k++) stepWeek(s, never);
    expect(house.level).toBe(0);
    expect(a.houseId).toBeNull(); // on the way: not living anywhere yet
    expect(stepWeek(s, never)).toContainEqual({ type: 'houseUp', x: ROADSIDE, y: 27, level: 1, delta: 2 });
    expect(s.families).toHaveLength(0);
    expect([a.houseId, b.houseId]).toEqual([house.id, house.id]);
    expect(house.level).toBe(1);
  });

  it('an empty house keeps its level: the newcomers move in at that level and it is cleared', () => {
    const s = emptyGame();
    put(s, 'plaza', EAST, 30);
    const house = put(s, 'house', ROADSIDE, 27);
    house.emptyLevel = 3;
    caravanTo(s, ROADSIDE, 27);
    for (let k = 0; k < 20 && s.families.length; k++) stepWeek(s, never);
    expect(house).toMatchObject({ level: 3, emptyLevel: 0 });
  });

  it('a caravan family whose house is demolished leaves the city (no house)', () => {
    const s = emptyGame();
    const { a, b } = caravanTo(s, ROADSIDE, 27);
    clearCell(s, ROADSIDE, 27);
    stepWeek(s, never);
    expect(s.families).toHaveLength(0);
    expect(s.people).toHaveLength(0);
    expect(s.departed.map((p) => [p.id, p.end?.cause])).toEqual([
      [a.id, 'noHouse'],
      [b.id, 'noHouse'],
    ]);
  });

  it('reroutes around a cut road', () => {
    const s = emptyGame();
    put(s, 'plaza', 19, 25);
    const { house } = caravanTo(s, ROADSIDE, 27);
    stepWeek(s, never);
    // Build a detour, then cut the straight road ahead of the family.
    for (let y = 27; y <= 38; y++) place(s, 'road', 25, y);
    clearCell(s, 24, 32);
    expect(house.connected).toBe(true);
    for (let k = 0; k < 12 && s.families.length; k++) stepWeek(s, never);
    expect(house.level).toBe(1);
  });

  it('starts at a road next to the altar if the entrance was cut off, never inside the altar', () => {
    const s = emptyGame();
    clearCell(s, 24, 47);
    put(s, 'house', ROADSIDE, 30);
    caravanTo(s, ROADSIDE, 30);
    const altar = s.buildings.find((b) => b.kind === 'altar')!;
    const start = s.families[0].path[0];
    expect(doorsOf(s, altar)).toContainEqual(start); // a ring cell, outside the altar
    expect(s.grid[indexOf(s, start.x, start.y)]).toBeNull();
  });
});

describe('empty houses', () => {
  it('lists the connected empty houses nobody walks to: highest kept level first, then the nearest, then the oldest', () => {
    const s = emptyGame();
    const near = put(s, 'house', ROADSIDE, 27);
    const far = put(s, 'house', ROADSIDE, 33);
    const kept = put(s, 'house', ROADSIDE, 39);
    kept.emptyLevel = 2;
    put(s, 'house', ROADSIDE, 29, 1); // lived in
    put(s, 'house', 10, 10); // no road
    expect(freeHouses(s, { x: ROADSIDE, y: 27 }).map((b) => b.id)).toEqual([kept.id, near.id, far.id]);
    expect(freeHouses(s, { x: ROADSIDE, y: 33 }).map((b) => b.id)).toEqual([kept.id, far.id, near.id]);
    caravanTo(s, ROADSIDE, 39);
    expect(freeHouses(s, { x: ROADSIDE, y: 27 }).map((b) => b.id)).toEqual([near.id, far.id]);
  });
});

describe('families leaving', () => {
  it('a tent abandoned in a famine takes everyone living there (famine), with the family name', () => {
    const s = emptyGame();
    const tent = put(s, 'house', ROADSIDE, 27, 1);
    s.food = 0;
    const events = stepWeek(s, constRng(0)); // famine and the leave roll hits
    expect(s.famine).toBe(true);
    const left = events.find((e) => e.type === 'familyLeft');
    expect(left).toMatchObject({ type: 'familyLeft', reason: 'famine', x: ROADSIDE, y: 27 });
    expect(left && left.type === 'familyLeft' && left.name).toBeTruthy();
    expect(tent).toMatchObject({ level: 0, emptyLevel: 0 });
    expect(s.people).toHaveLength(0);
    expect(s.departed.every((p) => p.end?.cause === 'famine')).toBe(true);
  });

  it('demolishing a house with people sends them away (demolished)', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 27, 2);
    expect(s.people).toHaveLength(4);
    expect(clearCell(s, ROADSIDE, 27).ok).toBe(true);
    expect(s.people).toHaveLength(0);
    expect(s.departed.map((p) => p.end)).toEqual(Array(4).fill({ week: s.week, cause: 'demolished' }));
  });
});
