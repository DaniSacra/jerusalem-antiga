import { describe, expect, it } from 'vitest';
import { balloonNeed, clearCell, houseInfo, stepMonth } from '../src/core';
import { constRng, EAST, emptyGame, put, ROADSIDE, westOf } from './helpers';

const never = constRng(0.99);
const run = (s: Parameters<typeof stepMonth>[0], months: number, rng = never) => {
  const events = [];
  for (let k = 0; k < months; k++) events.push(...stepMonth(s, rng));
  return events;
};

describe('house evolution', () => {
  it('levels up after 3 months meeting the next needs (road + well)', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 30, 1);
    put(s, 'well', ROADSIDE, 32);
    run(s, 2);
    expect(b.level).toBe(1);
    expect(run(s, 1)).toContainEqual({ type: 'houseUp', x: ROADSIDE, y: 30, level: 2, delta: 3 });
  });

  it('is served when any cell of its footprint is covered', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 36, 1); // rows 36..37
    put(s, 'well', ROADSIDE, 26); // radius 4 covers rows 22..31 only
    run(s, 3);
    expect(b.level).toBe(1);
    clearCell(s, ROADSIDE, 26);
    put(s, 'well', ROADSIDE, 28); // now covers rows 24..33: still short of row 36
    run(s, 3);
    expect(b.level).toBe(1);
    put(s, 'well', ROADSIDE, 31); // covers rows 27..36: only the house's top row
    run(s, 3);
    expect(b.level).toBe(2);
  });

  it('a tent without road becomes an empty plot after 3 months', () => {
    const s = emptyGame();
    const b = put(s, 'house', 1, 1, 1);
    run(s, 2);
    expect(b.level).toBe(1);
    expect(run(s, 1)).toContainEqual({ type: 'houseDown', x: 1, y: 1, level: 0, delta: -3, famine: false });
  });

  it('drops a level when the road is cut', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 40, 2);
    put(s, 'well', ROADSIDE, 38);
    clearCell(s, 24, 30);
    run(s, 3);
    expect(b.level).toBe(1);
  });

  it('becomes a big house within the radius of the altar', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 26, 3);
    put(s, 'well', ROADSIDE, 28);
    put(s, 'market', westOf('market'), 30);
    run(s, 3);
    expect(b.level).toBe(4);
  });

  it('becomes a big house within the radius of the temple, not outside both', () => {
    const s = emptyGame();
    const far = put(s, 'house', ROADSIDE, 40, 3); // 15 rows from the altar
    put(s, 'well', ROADSIDE, 38);
    put(s, 'market', westOf('market'), 34);
    run(s, 4);
    expect(far.level).toBe(3);
    put(s, 'temple', EAST, 36);
    run(s, 3);
    expect(far.level).toBe(4);
  });

  it('during famine houses do not evolve and those above tents may drop', () => {
    const s = emptyGame({ famine: true, food: 0 });
    put(s, 'well', ROADSIDE, 30);
    const tent = put(s, 'house', ROADSIDE, 32, 1);
    const mud = put(s, 'house', ROADSIDE, 34, 2);
    run(s, 4, constRng(0.5));
    expect(tent.level).toBe(1);
    expect(mud.level).toBe(2);
    expect(run(s, 1, constRng(0.1))).toContainEqual({ type: 'houseDown', x: ROADSIDE, y: 34, level: 1, delta: -3, famine: true });
    expect(tent.level).toBe(1);
  });
});

describe('house info and balloons', () => {
  it('lists next-level needs including the road', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 30, 2);
    put(s, 'well', ROADSIDE, 32);
    expect(houseInfo(s, b)).toEqual({
      level: 2,
      name: 'Casa de barro',
      residents: 6,
      tax: 2,
      next: {
        name: 'Casa de pedra',
        needs: [
          { kind: 'road', ok: true },
          { kind: 'well', ok: true },
          { kind: 'market', ok: false },
        ],
      },
    });
  });

  it('shows "no road" first for any building, then the first missing need if unlocked', () => {
    const s = emptyGame({ unlocked: ['road', 'house', 'field', 'well'] });
    expect(balloonNeed(s, put(s, 'field', 1, 1))).toBe('road');
    expect(balloonNeed(s, put(s, 'house', 5, 5, 0))).toBe('road');
    const b = put(s, 'house', ROADSIDE, 40, 1);
    expect(balloonNeed(s, b)).toBe('well');
    put(s, 'well', ROADSIDE, 42);
    b.level = 2;
    expect(balloonNeed(s, b)).toBeNull(); // market still locked
    s.unlocked.push('market');
    expect(balloonNeed(s, b)).toBe('market');
    put(s, 'market', westOf('market'), 36);
    b.level = 3;
    expect(balloonNeed(s, b)).toBe('sacred');
    b.level = 4;
    expect(balloonNeed(s, b)).toBeNull();
    b.level = 0;
    expect(balloonNeed(s, b)).toBeNull();
  });

  it('shows "no workers" on workplaces only while nobody can work', () => {
    const s = emptyGame();
    const field = put(s, 'field', westOf('field'), 30);
    const well = put(s, 'well', ROADSIDE, 33);
    const plot = put(s, 'house', ROADSIDE, 35);
    expect(balloonNeed(s, field)).toBe('workers');
    expect(balloonNeed(s, well)).toBeNull(); // no jobs
    expect(balloonNeed(s, plot)).toBeNull();
    expect(balloonNeed(s, put(s, 'workshop', 1, 1))).toBe('road'); // no road comes first
    plot.level = 1; // 3 residents -> 1 worker
    expect(balloonNeed(s, field)).toBeNull();
  });
});
