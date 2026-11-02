import { describe, expect, it } from 'vitest';
import { clearCell, findPath, indexOf, place, roadMask } from '../src/core';
import { emptyGame, put, road, ROADSIDE } from './helpers';

describe('road network', () => {
  it('connects roads to the altar through orthogonal neighbours only', () => {
    const s = emptyGame();
    road(s, [[17, 16], [18, 16], [19, 15], [20, 15]]);
    expect(s.network[indexOf(s, 18, 16)]).toBe(true);
    expect(s.network[indexOf(s, 19, 15)]).toBe(false); // diagonal
    road(s, [[19, 16]]);
    expect(s.network[indexOf(s, 20, 15)]).toBe(true);
  });

  it('disconnects the far side when a road is demolished', () => {
    const s = emptyGame();
    const house = put(s, 'house', ROADSIDE, 25);
    expect(house.connected).toBe(true);
    expect(clearCell(s, 16, 20)).toEqual({ ok: true });
    expect(s.network[indexOf(s, 16, 25)]).toBe(false);
    expect(house.connected).toBe(false);
    expect(place(s, 'road', 16, 20)).toEqual({ ok: true });
    expect(house.connected).toBe(true);
  });

  it('charges 2 silver per road cell and rejects occupied or invalid cells', () => {
    const s = emptyGame({ silver: 5 });
    expect(place(s, 'road', 17, 16)).toEqual({ ok: true });
    expect(s.silver).toBe(3);
    expect(place(s, 'road', 17, 16)).toEqual({ ok: false, reason: 'invalid' });
    expect(place(s, 'road', 16, 16)).toEqual({ ok: false, reason: 'invalid' });
    expect(place(s, 'road', 31, 5)).toEqual({ ok: false, reason: 'invalid' }); // river
    expect(place(s, 'road', 18, 16)).toEqual({ ok: true });
    expect(place(s, 'road', 19, 16)).toEqual({ ok: false, reason: 'silver' });
  });

  it('finds shortest paths over the network', () => {
    const s = emptyGame();
    const path = findPath(s, { x: 16, y: 31 }, [{ x: 16, y: 20 }]);
    expect(path).toHaveLength(12);
    expect(path![0]).toEqual({ x: 16, y: 31 });
    expect(findPath(s, { x: 16, y: 31 }, [{ x: 3, y: 3 }])).toBeNull();
  });

  it('computes junction masks for drawing (altar counts as road)', () => {
    const s = emptyGame();
    expect(roadMask(s, 16, 17)).toBe(1 | 4); // straight N-S
    road(s, [[17, 20], [15, 20]]);
    expect(roadMask(s, 16, 20)).toBe(1 | 2 | 4 | 8); // crossing
    expect(roadMask(s, 16, 31)).toBe(1);
  });
});

describe('road requirement', () => {
  it('marks every building kind as connected only when touching the network', () => {
    const s = emptyGame();
    for (const kind of ['house', 'field', 'well', 'market', 'workshop'] as const) {
      expect(put(s, kind, ROADSIDE, 18 + ['house', 'field', 'well', 'market', 'workshop'].indexOf(kind)).connected).toBe(true);
      expect(put(s, kind, 3, 3 + 2 * ['house', 'field', 'well', 'market', 'workshop'].indexOf(kind)).connected).toBe(false);
    }
  });

  it('still allows building away from roads', () => {
    const s = emptyGame();
    expect(place(s, 'house', 2, 2)).toEqual({ ok: true });
  });
});
