/**
 * Screen ↔ grid in the 3D view, as plain math (no Three.js): the ray from the camera through a
 * screen point meets the ground plane (the city is flat), or the box of a tall building first.
 * 1 cell = 1 unit; the grid column is `x` and the row is `z`.
 */

export interface V3 {
  x: number;
  y: number;
  z: number;
}

/** Where a ray (origin `o`, direction `d`) meets the plane y = `h`; null if it never goes down to it. */
export function rayToGround(o: V3, d: V3, h = 0): { x: number; z: number } | null {
  if (Math.abs(d.y) < 1e-9) return null;
  const t = (h - o.y) / d.y;
  if (t <= 0) return null;
  return { x: o.x + d.x * t, z: o.z + d.z * t };
}

/** The grid cell of a ground point (null off a `cols` x `rows` map). */
export function cellOfPoint(p: { x: number; z: number } | null, cols: number, rows: number): { x: number; y: number } | null {
  if (!p) return null;
  const x = Math.floor(p.x);
  const y = Math.floor(p.z);
  return x >= 0 && y >= 0 && x < cols && y < rows ? { x, y } : null;
}

/** A building's box: its footprint (grid x, y, w, h) and its height in units. */
export interface PickBox {
  x: number;
  y: number;
  w: number;
  h: number;
  top: number;
}

/** Distance along the ray to a box (slab test), or null when the ray misses it. */
export function rayBox(o: V3, d: V3, b: PickBox): number | null {
  let t0 = 0;
  let t1 = Infinity;
  const slabs: [number, number, number, number][] = [
    [o.x, d.x, b.x, b.x + b.w],
    [o.y, d.y, 0, b.top],
    [o.z, d.z, b.y, b.y + b.h],
  ];
  for (const [p, v, lo, hi] of slabs) {
    if (Math.abs(v) < 1e-9) {
      if (p < lo || p > hi) return null;
      continue;
    }
    let a = (lo - p) / v;
    let c = (hi - p) / v;
    if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, c);
    if (t0 > t1) return null;
  }
  return t0;
}

/** The nearest box the ray hits (a tap on the temple roof picks the temple, not the road behind it). */
export function pickBox<B extends PickBox>(o: V3, d: V3, boxes: readonly B[]): B | null {
  let best: B | null = null;
  let bestT = Infinity;
  for (const b of boxes) {
    const t = rayBox(o, d, b);
    if (t !== null && t < bestT) [best, bestT] = [b, t];
  }
  return best;
}
