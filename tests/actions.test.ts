import { describe, expect, it } from 'vitest';
import { checkPlace, clearCell, indexOf, place, RULES, templeSpots } from '../src/core';
import { emptyGame, put, ROADSIDE } from './helpers';

describe('placing buildings', () => {
  it('charges the cost and occupies the cell', () => {
    const s = emptyGame({ silver: 100 });
    expect(place(s, 'well', ROADSIDE, 20)).toEqual({ ok: true });
    expect(s.silver).toBe(80);
    expect(s.grid[indexOf(s, ROADSIDE, 20)]).toMatchObject({ kind: 'well', connected: true });
  });

  it('rejects invalid cells, missing silver and locked buildings', () => {
    const s = emptyGame({ silver: 12 });
    s.feature[indexOf(s, 1, 1)] = 'rock';
    s.feature[indexOf(s, 2, 1)] = 'palm';
    put(s, 'house', 3, 1);
    expect(place(s, 'house', 1, 1).ok).toBe(false);
    expect(place(s, 'house', 2, 1)).toEqual({ ok: false, reason: 'invalid' });
    expect(place(s, 'house', 3, 1)).toEqual({ ok: false, reason: 'invalid' });
    expect(place(s, 'house', 16, 20)).toEqual({ ok: false, reason: 'invalid' }); // road
    expect(place(s, 'house', 31, 0)).toEqual({ ok: false, reason: 'invalid' }); // river
    expect(place(s, 'house', -1, 0)).toEqual({ ok: false, reason: 'invalid' });
    expect(place(s, 'field', 5, 5)).toEqual({ ok: false, reason: 'silver' });
    s.unlocked = ['house'];
    expect(place(s, 'field', 5, 5)).toEqual({ ok: false, reason: 'locked' });
    expect(s.silver).toBe(12);
  });
});

describe('temple placement', () => {
  it('occupies 3x3 cells and costs 800', () => {
    const s = emptyGame({ silver: 850 });
    expect(place(s, 'temple', 17, 20)).toEqual({ ok: true });
    expect(s.silver).toBe(50);
    const t = s.grid[indexOf(s, 17, 20)]!;
    expect(t).toMatchObject({ kind: 'temple', size: 3, connected: true });
    expect(s.grid[indexOf(s, 19, 22)]).toBe(t);
    expect(s.grid[indexOf(s, 20, 22)]).toBeNull();
  });

  it('is invalid if any of its cells is blocked', () => {
    const s = emptyGame();
    s.feature[indexOf(s, 19, 22)] = 'rock';
    expect(checkPlace(s, 'temple', 17, 20)).toEqual({ ok: false, reason: 'invalid' });
    expect(checkPlace(s, 'temple', 15, 20)).toEqual({ ok: false, reason: 'invalid' }); // over the road
    expect(checkPlace(s, 'temple', 29, 5)).toEqual({ ok: false, reason: 'invalid' }); // river / edge
  });

  it('must touch a connected road', () => {
    const s = emptyGame();
    expect(checkPlace(s, 'temple', 18, 20)).toEqual({ ok: false, reason: 'noRoad' });
    expect(checkPlace(s, 'temple', 13, 25)).toEqual({ ok: true }); // west side of the road
  });

  it('lists every spot where it fits, ignoring silver', () => {
    const s = emptyGame({ silver: 0 });
    const spots = templeSpots(s);
    expect(spots).toContainEqual({ x: 17, y: 20 });
    expect(spots).toContainEqual({ x: 13, y: 25 });
    expect(spots).not.toContainEqual({ x: 18, y: 20 });
    s.silver = 1e6;
    for (const o of spots) expect(checkPlace(s, 'temple', o.x, o.y)).toEqual({ ok: true });
  });

  it('has no spot when no free 3x3 touches a connected road', () => {
    const s = emptyGame();
    s.feature = s.feature.map(() => 'rock');
    expect(templeSpots(s)).toEqual([]);
  });
});

describe('clearing', () => {
  it('removes buildings and roads without refund and cuts trees for silver', () => {
    const s = emptyGame({ silver: 7 });
    put(s, 'well', ROADSIDE, 20);
    expect(clearCell(s, ROADSIDE, 20)).toEqual({ ok: true });
    expect(s.grid[indexOf(s, ROADSIDE, 20)]).toBeNull();
    expect(s.coverage.well.some(Boolean)).toBe(false);
    expect(clearCell(s, 16, 30)).toEqual({ ok: true });
    expect(s.roads[indexOf(s, 16, 30)]).toBe(false);
    expect(s.silver).toBe(7);

    for (const tree of ['palm', 'olive'] as const) s.feature[indexOf(s, tree === 'palm' ? 2 : 3, 2)] = tree;
    expect(clearCell(s, 2, 2)).toEqual({ ok: true });
    expect(s.feature[indexOf(s, 2, 2)]).toBeNull();
    expect(s.silver).toBe(7 - RULES.treeClearCost);
    expect(clearCell(s, 3, 2)).toEqual({ ok: false, reason: 'silver' });

    s.feature[indexOf(s, 5, 2)] = 'rock';
    expect(clearCell(s, 5, 2)).toEqual({ ok: false, reason: 'invalid' });
    expect(clearCell(s, 6, 2)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('protects the altar and the temple', () => {
    const s = emptyGame();
    put(s, 'temple', 17, 20);
    expect(clearCell(s, 16, 16)).toEqual({ ok: false, reason: 'protected' });
    expect(clearCell(s, 18, 21)).toEqual({ ok: false, reason: 'protected' });
    expect(s.buildings.map((b) => b.kind)).toEqual(['altar', 'temple']);
  });
});
