import { describe, expect, it } from 'vitest';
import { harvestsIn, indexOf, RULES, refreshCity } from '../../src/core';
import { outputOf, previewOf } from '../../src/game/model/preview';
import { T } from '../../src/render/strings';
import { EAST, emptyGame, put } from '../helpers';

describe('tool preview as data (every view)', () => {
  it('none with Mover or without a hovered cell', () => {
    const s = emptyGame();
    expect(previewOf(s, 'view', { x: 3, y: 3 })).toBeNull();
    expect(previewOf(s, 'road', null)).toBeNull();
  });

  it('white beside the road, yellow when only the road is missing, red when blocked', () => {
    const s = emptyGame();
    expect(previewOf(s, 'house', { x: 22, y: 30 })!.fit).toBe('ok');
    const far = previewOf(s, 'house', { x: 5, y: 5 })!;
    expect(far.fit).toBe('road');
    expect(far.lines).toContain(T.needsRoad);
    expect(previewOf(s, 'house', { x: 23, y: 23 })!.fit).toBe('bad');
  });

  it('says when silver is short (red would look like a bad spot)', () => {
    const s = emptyGame();
    s.silver = 0;
    const p = previewOf(s, 'plaza', { x: 22, y: 30 })!;
    expect(p.fit).toBe('bad');
    expect(p.lines.at(-1)).toMatch(/prata/i);
  });

  it('a service shows its reach clipped to the map and the houses it serves', () => {
    const s = emptyGame();
    put(s, 'house', 22, 30, 1);
    const p = previewOf(s, 'plaza', { x: 26, y: 30 })!;
    expect(p.service).toBe('plaza');
    expect(p.reach!.x).toBeGreaterThanOrEqual(0);
    expect(p.served.length).toBe(1);
    expect(p.lines[0]).toBe(T.serves(1));
    const edge = previewOf(s, 'plaza', { x: 0, y: 0 })!;
    expect(edge.reach!.x).toBe(0);
    expect(edge.reach!.y).toBe(0);
  });

  it('Demolir previews one cell, red where there is nothing to remove', () => {
    const s = emptyGame();
    const p = previewOf(s, 'clear', { x: 3, y: 3 })!;
    expect(p.kind).toBeNull();
    expect(p.rect).toEqual({ x: 3, y: 3, w: 1, h: 1 });
    expect(p.fit).toBe('bad');
  });

  describe('what the tool gives or takes (the pill over the preview)', () => {
    const at = (x: number, y: number, w = 1, h = 1) => ({ x, y, w, h });

    it('Demolir on a tree costs silver; on empty ground or a house says nothing', () => {
      const s = emptyGame();
      s.feature[indexOf(s, 5, 5)] = 'olive';
      expect(outputOf(s, 'clear', at(5, 5))).toEqual({ lines: [T.nova.cutTree], bad: false });
      s.feature[indexOf(s, 6, 6)] = null;
      expect(outputOf(s, 'clear', at(6, 6)).lines).toEqual([]);
      put(s, 'house', 22, 30);
      expect(outputOf(s, 'clear', at(22, 30)).lines).toEqual([]);
    });

    it('Demolir on a full granary warns, in red, of the food it spoils', () => {
      const s = emptyGame();
      put(s, 'granary', EAST, 36);
      refreshCity(s);
      s.food = RULES.baseFoodStorage + 200;
      const o = outputOf(s, 'clear', at(EAST, 36));
      expect(o.bad).toBe(true);
      expect(o.lines[0]).toMatch(/^Perde \d/);
    });

    it('a gatherer off the road brings nothing, in red; on the road it says what it yields', () => {
      const s = emptyGame();
      const far = outputOf(s, 'gatherer', at(3, 3));
      expect(far).toEqual({ lines: [T.nova.offRoad], bad: true });
      const p = previewOf(s, 'gatherer', { x: 22, y: 30 })!;
      expect(p.lines[0]).toMatch(/^Rende /);
    });

    it('a field in winter says when it comes back, not what it yields', () => {
      const s = emptyGame();
      s.week = [...Array(52).keys()].find((w) => !harvestsIn(w))!;
      expect(outputOf(s, 'field', at(22, 30, 2, 2)).lines[0]).toMatch(/inverno/);
    });

    it('nothing for Mover, the road or a building that gathers nothing', () => {
      const s = emptyGame();
      for (const t of ['view', 'road', 'plaza'] as const) expect(outputOf(s, t, at(22, 30)).lines).toEqual([]);
    });
  });
});
