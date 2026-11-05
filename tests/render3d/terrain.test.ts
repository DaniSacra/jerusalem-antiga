import { describe, expect, it } from 'vitest';
import { indexOf } from '../../src/core';
import { Terrain } from '../../src/render3d/terrain';
import { emptyGame } from '../helpers';

describe('3D ground under a live city', () => {
  it('a new road flattens the ground under it, in the mesh already built', () => {
    const s = emptyGame();
    const t = new Terrain(s, 11);
    const mesh = t.mesh();
    // A cell far from the starting town, on land.
    let at: { x: number; y: number } | null = null;
    for (let y = 2; y < s.rows - 2 && !at; y++)
      for (let x = 2; x < s.cols - 2 && !at; x++) if (s.ground[indexOf(s, x, y)] !== 'river' && Math.abs(t.height(x + 0.5, y + 0.5)) > 0.05) at = { x, y };
    expect(at).not.toBeNull();
    const { x, y } = at!;
    s.roads[indexOf(s, x, y)] = true;
    t.reshape();
    expect(t.height(x + 0.5, y + 0.5)).toBeCloseTo(0, 5);
    // The vertex at the cell's corner moved too.
    const pos = mesh.geometry.attributes.position;
    let found = false;
    for (let i = 0; i < pos.count; i++)
      if (pos.getX(i) === x && pos.getZ(i) === y) {
        expect(pos.getY(i)).toBeCloseTo(t.height(x, y), 5);
        found = true;
      }
    expect(found).toBe(true);
  });
});
