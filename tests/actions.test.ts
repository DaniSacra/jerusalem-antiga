import { describe, expect, it } from 'vitest';
import { build, clearCell, createGame, createRng, indexOf, RULES } from '../src/core';
import { emptyGame, place } from './helpers';

describe('actions', () => {
  it('starts with the configured resources and tools', () => {
    const s = createGame(createRng(7));
    expect(s.silver).toBe(150);
    expect(s.food).toBe(30);
    expect(s.unlocked).toEqual(['house', 'field', 'well']);
  });

  it('builds on grass and charges the cost', () => {
    const s = emptyGame({ silver: 100 });
    expect(build(s, 'well', 3, 3)).toEqual({ ok: true });
    expect(s.silver).toBe(80);
    expect(s.buildings[indexOf(s, 3, 3)]).toMatchObject({ kind: 'well', level: 0 });
    expect(s.coverage.well[indexOf(s, 6, 6)]).toBe(true);
  });

  it('rejects invalid cells, missing silver and locked buildings', () => {
    const s = emptyGame({ silver: 12 });
    s.terrain[indexOf(s, 1, 1)] = 'rock';
    s.terrain[indexOf(s, 2, 1)] = 'tree';
    place(s, 'house', 3, 1);
    expect(build(s, 'house', 1, 1)).toEqual({ ok: false, reason: 'invalid' });
    expect(build(s, 'house', 2, 1)).toEqual({ ok: false, reason: 'invalid' });
    expect(build(s, 'house', 3, 1)).toEqual({ ok: false, reason: 'invalid' });
    expect(build(s, 'house', 19, 0)).toEqual({ ok: false, reason: 'invalid' });
    expect(build(s, 'house', -1, 0)).toEqual({ ok: false, reason: 'invalid' });
    expect(build(s, 'field', 5, 5)).toEqual({ ok: false, reason: 'silver' });
    s.unlocked = ['house'];
    expect(build(s, 'field', 5, 5)).toEqual({ ok: false, reason: 'locked' });
    expect(s.silver).toBe(12);
  });

  it('clears buildings without refund and cuts trees for silver', () => {
    const s = emptyGame({ silver: 7 });
    place(s, 'well', 4, 4);
    expect(clearCell(s, 4, 4)).toEqual({ ok: true });
    expect(s.buildings[indexOf(s, 4, 4)]).toBeNull();
    expect(s.coverage.well.some(Boolean)).toBe(false);
    expect(s.silver).toBe(7);

    s.terrain[indexOf(s, 2, 2)] = 'tree';
    expect(clearCell(s, 2, 2)).toEqual({ ok: true });
    expect(s.terrain[indexOf(s, 2, 2)]).toBe('grass');
    expect(s.silver).toBe(7 - RULES.treeClearCost);

    s.terrain[indexOf(s, 3, 2)] = 'tree';
    expect(clearCell(s, 3, 2)).toEqual({ ok: false, reason: 'silver' });
    s.terrain[indexOf(s, 5, 2)] = 'rock';
    expect(clearCell(s, 5, 2)).toEqual({ ok: false, reason: 'invalid' });
    expect(clearCell(s, 6, 2)).toEqual({ ok: false, reason: 'invalid' });
  });
});
