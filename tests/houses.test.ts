import { describe, expect, it } from 'vitest';
import { balloonNeed, clearCell, houseInfo, stepMonth } from '../src/core';
import { constRng, emptyGame, put, ROADSIDE } from './helpers';

const never = constRng(0.99);
const run = (s: Parameters<typeof stepMonth>[0], months: number, rng = never) => {
  const events = [];
  for (let k = 0; k < months; k++) events.push(...stepMonth(s, rng));
  return events;
};

describe('house evolution', () => {
  it('levels up after 3 months meeting the next needs (road + well)', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 25, 1);
    put(s, 'well', ROADSIDE, 26);
    run(s, 2);
    expect(b.level).toBe(1);
    expect(run(s, 1)).toContainEqual({ type: 'houseUp', x: ROADSIDE, y: 25, level: 2, delta: 3 });
  });

  it('a tent without road becomes an empty plot after 3 months', () => {
    const s = emptyGame();
    const b = put(s, 'house', 3, 3, 1);
    run(s, 2);
    expect(b.level).toBe(1);
    expect(run(s, 1)).toContainEqual({ type: 'houseDown', x: 3, y: 3, level: 0, delta: -3, famine: false });
  });

  it('drops a level when the road is cut', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 25, 2);
    put(s, 'well', ROADSIDE, 24);
    clearCell(s, 16, 20);
    run(s, 3);
    expect(b.level).toBe(1);
  });

  it('becomes a big house within the radius of the altar', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 18, 3);
    put(s, 'well', ROADSIDE, 19);
    put(s, 'market', ROADSIDE, 20);
    run(s, 3);
    expect(b.level).toBe(4);
  });

  it('becomes a big house within the radius of the temple, not outside both', () => {
    const s = emptyGame();
    const far = put(s, 'house', ROADSIDE, 29, 3); // 13 rows from the altar
    put(s, 'well', ROADSIDE, 28);
    put(s, 'market', ROADSIDE, 27);
    run(s, 4);
    expect(far.level).toBe(3);
    put(s, 'temple', 17, 24);
    run(s, 3);
    expect(far.level).toBe(4);
  });

  it('during famine houses do not evolve and those above tents may drop', () => {
    const s = emptyGame({ famine: true, food: 0 });
    put(s, 'well', ROADSIDE, 24);
    const tent = put(s, 'house', ROADSIDE, 25, 1);
    const mud = put(s, 'house', ROADSIDE, 26, 2);
    run(s, 4, constRng(0.5));
    expect(tent.level).toBe(1);
    expect(mud.level).toBe(2);
    expect(run(s, 1, constRng(0.1))).toContainEqual({ type: 'houseDown', x: ROADSIDE, y: 26, level: 1, delta: -3, famine: true });
    expect(tent.level).toBe(1);
  });
});

describe('house info and balloons', () => {
  it('lists next-level needs including the road', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 25, 2);
    put(s, 'well', ROADSIDE, 26);
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
    expect(balloonNeed(s, put(s, 'field', 3, 3))).toBe('road');
    expect(balloonNeed(s, put(s, 'house', 5, 5, 0))).toBe('road');
    const b = put(s, 'house', ROADSIDE, 25, 1);
    expect(balloonNeed(s, b)).toBe('well');
    put(s, 'well', ROADSIDE, 26);
    b.level = 2;
    expect(balloonNeed(s, b)).toBeNull(); // market still locked
    s.unlocked.push('market');
    expect(balloonNeed(s, b)).toBe('market');
    put(s, 'market', ROADSIDE, 27);
    b.level = 3;
    expect(balloonNeed(s, b)).toBe('sacred');
    b.level = 4;
    expect(balloonNeed(s, b)).toBeNull();
    b.level = 0;
    expect(balloonNeed(s, b)).toBeNull();
  });
});
