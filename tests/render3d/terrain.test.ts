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

  it('flatness fades from the city over three cells, as the nearest occupied cell says', () => {
    const s = emptyGame();
    const t = new Terrain(s, 11);
    const occ = (x: number, y: number) => s.roads[indexOf(s, x, y)] || s.grid[indexOf(s, x, y)];
    // Brute force: the best weight of any occupied cell within 3.
    const brute = (x: number, y: number) => {
      let best = 0;
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= s.cols || yy >= s.rows || !occ(xx, yy)) continue;
          best = Math.max(best, 1 - Math.max(0, Math.hypot(dx, dy) - 1) / 3);
        }
      return best;
    };
    const flat = (t as unknown as { flat: Float32Array }).flat;
    for (let y = 0; y < s.rows; y++) for (let x = 0; x < s.cols; x++) expect(flat[indexOf(s, x, y)]).toBeCloseTo(brute(x, y), 6);
  });

  it('a road on ground already flat leaves the mesh alone', () => {
    const s = emptyGame();
    const t = new Terrain(s, 11);
    const pos = t.mesh().geometry.attributes.position as import('three').BufferAttribute;
    // A cell next to an existing road: already fully flat.
    const i = s.roads.findIndex((r) => r);
    const x = (i % s.cols) + 1;
    const y = Math.floor(i / s.cols);
    expect((t as unknown as { flat: Float32Array }).flat[indexOf(s, x, y)]).toBe(1);
    const version = pos.version;
    s.roads[indexOf(s, x, y)] = true;
    t.reshape();
    expect(pos.version).toBe(version);
  });
});
