import { describe, expect, it } from 'vitest';
import { cellOfPoint, pickBox, rayBox, rayToGround } from '../../src/render3d/picking';

const norm = (x: number, y: number, z: number) => {
  const l = Math.hypot(x, y, z);
  return { x: x / l, y: y / l, z: z / l };
};

describe('3D picking (screen ray → grid)', () => {
  it('a ray looking down meets the ground under it, from every side', () => {
    const target = { x: 10.5, z: 20.5 };
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4]) {
      const o = { x: target.x + Math.sin(yaw) * 20, y: 25, z: target.z + Math.cos(yaw) * 20 };
      const p = rayToGround(o, norm(target.x - o.x, -o.y, target.z - o.z))!;
      expect(p.x).toBeCloseTo(target.x);
      expect(p.z).toBeCloseTo(target.z);
      expect(cellOfPoint(p, 48, 48)).toEqual({ x: 10, y: 20 });
    }
  });

  it('a ray going up or flat never meets the ground; off the map there is no cell', () => {
    expect(rayToGround({ x: 0, y: 10, z: 0 }, { x: 0, y: 1, z: 0 })).toBeNull();
    expect(rayToGround({ x: 0, y: 10, z: 0 }, { x: 1, y: 0, z: 0 })).toBeNull();
    expect(cellOfPoint({ x: -0.5, z: 3 }, 48, 48)).toBeNull();
    expect(cellOfPoint({ x: 48.2, z: 3 }, 48, 48)).toBeNull();
  });

  it('hits a building box before the ground behind it, and the nearest of two', () => {
    const o = { x: 0, y: 10, z: 5.5 };
    const d = norm(1, -0.5, 0);
    const near = { x: 5, y: 5, w: 2, h: 2, top: 9, id: 'near' };
    const far = { x: 12, y: 5, w: 2, h: 2, top: 9, id: 'far' };
    expect(rayBox(o, d, near)).not.toBeNull();
    expect(pickBox(o, d, [far, near])?.id).toBe('near');
    expect(pickBox(o, norm(0, -1, 0), [near, far])).toBeNull();
  });
});
