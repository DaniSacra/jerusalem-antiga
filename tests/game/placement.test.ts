import { describe, expect, it } from 'vitest';
import { indexOf } from '../../src/core';
import { granaryStock, milestoneSite, orthoSteps, originFor, sameCell, spoilSite, toolDims, whyInvalid } from '../../src/game/placement';
import { T } from '../../src/render/strings';
import { emptyGame, put, road } from '../helpers';

describe('placement (shared by every view)', () => {
  it('centers a footprint on the hovered cell, and is 1x1 for Mover and Demolir', () => {
    expect(toolDims('view')).toEqual({ w: 1, h: 1 });
    expect(toolDims('clear')).toEqual({ w: 1, h: 1 });
    expect(originFor('road', { x: 5, y: 5 })).toEqual({ x: 5, y: 5 });
    expect(originFor('house', { x: 5, y: 5 })).toEqual({ x: 5, y: 5 });
    expect(originFor('temple', { x: 10, y: 10 })).toEqual({ x: 8, y: 8 });
    const m = toolDims('market');
    const r = toolDims('market', true);
    expect([r.w, r.h]).toEqual([m.h, m.w]);
  });

  it('steps orthogonally from a to b, without a, ending on b', () => {
    expect(orthoSteps({ x: 0, y: 0 }, { x: 0, y: 0 })).toEqual([]);
    const steps = orthoSteps({ x: 0, y: 0 }, { x: 2, y: 1 });
    expect(steps.at(-1)).toEqual({ x: 2, y: 1 });
    expect(steps).toHaveLength(3);
    let prev = { x: 0, y: 0 };
    for (const c of steps) {
      expect(Math.abs(c.x - prev.x) + Math.abs(c.y - prev.y)).toBe(1);
      prev = c;
    }
  });

  it('compares cells, never equal to null', () => {
    expect(sameCell({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
    expect(sameCell({ x: 1, y: 2 }, { x: 2, y: 1 })).toBe(false);
    expect(sameCell(null, null)).toBe(false);
  });

  it('says the first thing in the way', () => {
    const s = emptyGame();
    expect(whyInvalid(s, 'house', { x: -1, y: 5 })).toBe(T.blocked.edge);
    expect(whyInvalid(s, 'house', { x: 22, y: 22 })).toBe(T.blocked.taken);
    s.feature[indexOf(s, 5, 5)] = 'rock';
    expect(whyInvalid(s, 'house', { x: 4, y: 4 })).toBe(T.blocked.rock);
    expect(whyInvalid(s, 'clear', { x: 5, y: 5 })).toBe(T.blocked.rockClear);
    expect(whyInvalid(s, 'clear', { x: 6, y: 6 })).toBe(T.blocked.nothing);
    s.feature[indexOf(s, 8, 8)] = 'olive';
    expect(whyInvalid(s, 'road', { x: 8, y: 8 })).toBe(T.blocked.tree);
    const river = s.ground.findIndex((g) => g === 'river');
    expect(whyInvalid(s, 'road', { x: river % s.cols, y: Math.floor(river / s.cols) })).toBe(T.blocked.river);
    expect(whyInvalid(s, 'road', { x: 2, y: 2 })).toBe(T.fail.invalid);
  });

  it('fills the granary drawing with the stores', () => {
    const s = emptyGame();
    put(s, 'granary', 25, 30);
    s.food = 0;
    expect(granaryStock(s)).toBe(0);
    s.food = 1e9;
    expect(granaryStock(s)).toBe(3);
  });

  it('celebrates a milestone on the house that rose, else the altar; spoils on a granary, else the altar', () => {
    const s = emptyGame();
    const altar = s.buildings.find((b) => b.kind === 'altar')!;
    const h = put(s, 'house', 22, 30, 2);
    expect(milestoneSite(s, 'firstMud', new Map([[2, { x: 22, y: 30 }]]))).toBe(h);
    expect(milestoneSite(s, 'firstMud', new Map())).toBe(altar);
    expect(spoilSite(s)).toBe(altar);
    road(s, [[25, 27]]);
    const g = put(s, 'granary', 25, 28);
    g.connected = true;
    expect(spoilSite(s)).toBe(g);
  });
});
