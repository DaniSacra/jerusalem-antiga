import { describe, expect, it } from 'vitest';
import { clearCell, findPath, indexOf, place, roadMask } from '../src/core';
import { emptyGame, put, road, ROADSIDE, westOf } from './helpers';

describe('road network', () => {
  it('connects roads to any side of the altar through orthogonal neighbours only', () => {
    const s = emptyGame();
    s.roads = s.roads.map(() => false); // without the starting roads
    road(s, [[26, 23], [27, 23], [28, 22], [29, 22]]);
    expect(s.network[indexOf(s, 26, 23)]).toBe(true); // touches the altar
    expect(s.network[indexOf(s, 27, 23)]).toBe(true);
    expect(s.network[indexOf(s, 28, 22)]).toBe(false); // diagonal
    road(s, [[28, 23]]);
    expect(s.network[indexOf(s, 29, 22)]).toBe(true);
  });

  it('disconnects the far side when a road is demolished', () => {
    const s = emptyGame();
    const house = put(s, 'house', ROADSIDE, 36);
    expect(house.connected).toBe(true);
    expect(clearCell(s, 24, 30)).toEqual({ ok: true });
    expect(s.network[indexOf(s, 24, 36)]).toBe(false);
    expect(house.connected).toBe(false);
    expect(place(s, 'road', 24, 30)).toEqual({ ok: true });
    expect(house.connected).toBe(true);
  });

  it('charges 2 silver per road cell and rejects occupied or invalid cells', () => {
    const s = emptyGame({ silver: 5 });
    expect(place(s, 'road', 27, 23)).toEqual({ ok: true });
    expect(s.silver).toBe(3);
    expect(place(s, 'road', 27, 23)).toEqual({ ok: false, reason: 'invalid' });
    expect(place(s, 'road', 26, 23)).toEqual({ ok: false, reason: 'invalid' }); // starting ring
    expect(place(s, 'road', 23, 23)).toEqual({ ok: false, reason: 'invalid' }); // altar
    expect(place(s, 'road', 47, 5)).toEqual({ ok: false, reason: 'invalid' }); // river
    expect(place(s, 'road', 28, 23)).toEqual({ ok: true });
    expect(place(s, 'road', 29, 23)).toEqual({ ok: false, reason: 'silver' });
  });

  it('finds shortest paths over connected roads, never through the altar', () => {
    const s = emptyGame();
    const path = findPath(s, { x: 24, y: 47 }, [{ x: 24, y: 30 }]);
    expect(path).toHaveLength(18);
    expect(path![0]).toEqual({ x: 24, y: 47 });
    expect(findPath(s, { x: 24, y: 47 }, [{ x: 3, y: 3 }])).toBeNull();
    clearCell(s, 26, 22);
    clearCell(s, 26, 24); // (26, 23) is left connected through the altar, but not walkable from the entrance
    expect(s.network[indexOf(s, 26, 23)]).toBe(true);
    expect(findPath(s, { x: 24, y: 47 }, [{ x: 26, y: 23 }])).toBeNull();
  });

  it('computes junction masks for drawing (the altar does not count as road)', () => {
    const s = emptyGame();
    expect(roadMask(s, 24, 26)).toBe(2 | 4 | 8); // the ring meets the south road: T, no arm into the altar
    expect(roadMask(s, 23, 21)).toBe(2 | 8); // ring side: straight, the altar to the south
    expect(roadMask(s, 21, 21)).toBe(2 | 4); // ring corners
    expect(roadMask(s, 26, 21)).toBe(4 | 8);
    expect(roadMask(s, 21, 26)).toBe(1 | 2);
    expect(roadMask(s, 26, 26)).toBe(1 | 8);
    road(s, [[25, 30], [23, 30]]);
    expect(roadMask(s, 24, 30)).toBe(1 | 2 | 4 | 8); // crossing
    expect(roadMask(s, 24, 47)).toBe(1);
  });
});

describe('road requirement', () => {
  it('marks every building kind as connected only when touching the network', () => {
    const s = emptyGame();
    const kinds = ['house', 'field', 'plaza', 'market', 'workshop'] as const;
    let y = 27;
    kinds.forEach((kind, k) => {
      const b = put(s, kind, westOf(kind), y);
      expect(b.connected).toBe(true);
      y += b.h;
      expect(put(s, kind, 1, 1 + 5 * k).connected).toBe(false);
    });
  });

  it('connects a building that touches the altar itself', () => {
    const s = emptyGame();
    s.roads = s.roads.map(() => false); // without the starting roads
    expect(put(s, 'plaza', 26, 22).connected).toBe(true);
  });

  it('still allows building away from roads', () => {
    const s = emptyGame();
    expect(place(s, 'house', 2, 2)).toEqual({ ok: true });
  });
});
