import { describe, expect, it } from 'vitest';
import { indexOf } from '../../src/core';
import { moistMap } from '../../src/render3d/fields';
import { emptyGame } from '../helpers';
import LOOK from '../../src/render3d/look3d.json';

describe('moist land by the river', () => {
  it('is 1 by the water, 0 far from it, and fades in between', () => {
    const s = emptyGame();
    const m = moistMap(s);
    const river = s.ground.findIndex((g) => g === 'river');
    expect(river).toBeGreaterThanOrEqual(0);
    expect(m[river]).toBe(1);
    // Distance of each cell to the river (8 neighbours), by brute force.
    const rivers: [number, number][] = [];
    for (let y = 0; y < s.rows; y++) for (let x = 0; x < s.cols; x++) if (s.ground[indexOf(s, x, y)] === 'river') rivers.push([x, y]);
    let near = 0;
    let far = 0;
    for (let y = 0; y < s.rows; y += 3)
      for (let x = 0; x < s.cols; x += 3) {
        const d = Math.min(...rivers.map(([rx, ry]) => Math.max(Math.abs(rx - x), Math.abs(ry - y))));
        const v = m[indexOf(s, x, y)];
        if (d <= LOOK.fields.moistNear) {
          expect(v).toBe(1);
          near++;
        } else if (d >= LOOK.fields.moistFar) {
          expect(v).toBe(0);
          far++;
        } else expect(v).toBeGreaterThan(0), expect(v).toBeLessThan(1);
      }
    expect(near).toBeGreaterThan(0);
    expect(far).toBeGreaterThan(0);
  });

  it('is all dry on a map with no river', () => {
    const s = emptyGame();
    s.ground = s.ground.map(() => 'sand');
    expect(moistMap(s).every((v) => v === 0)).toBe(true);
  });
});
