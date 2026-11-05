import { describe, expect, it } from 'vitest';
import { previewOf } from '../../src/game/model/preview';
import { T } from '../../src/render/strings';
import { emptyGame, put } from '../helpers';

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
});
