import { RULES } from '../core';

/** Isometric 2:1 tile size. */
export const TW = 64;
export const TH = 32;
export const HW = TW / 2;
export const HH = TH / 2;
export const COLS = RULES.map.cols;
export const ROWS = RULES.map.rows;

// ---------- view rotation ----------
// The map can be seen from 4 sides. The core grid never changes: grid points are turned into
// "view" points (the grid as seen on screen) before projecting, and back when picking.

let rotation = 0;

/** Quarter turns of the view (0..3). */
export const getRotation = () => rotation;
export const setRotation = (r: number) => {
  rotation = ((r % 4) + 4) % 4;
};

/** Turns a continuous grid point r quarter turns around the map center (the map is square). */
function turn(r: number, x: number, y: number) {
  if (r === 1) return { x: ROWS - y, y: x };
  if (r === 2) return { x: COLS - x, y: ROWS - y };
  if (r === 3) return { x: y, y: COLS - x };
  return { x, y };
}

export const toView = (gx: number, gy: number) => turn(rotation, gx, gy);
export const fromView = (vx: number, vy: number) => turn((4 - rotation) % 4, vx, vy);

/** A footprint as seen on screen: odd rotations swap width and height. */
export const viewDims = (w: number, h: number) => (rotation % 2 ? { w: h, h: w } : { w, h });

/** Road mask (1 = N, 2 = E, 4 = S, 8 = W in the grid) as seen on screen. */
export const viewMask = (mask: number) => ((mask << rotation) | (mask >> (4 - rotation))) & 15;

/** View coordinates to world pixels; z lifts upward. */
export const viewToWorld = (vx: number, vy: number, z = 0) => ({ x: (vx - vy) * HW, y: (vx + vy) * HH - z });

/** Grid coordinates (cell (x, y) spans [x, x+1] x [y, y+1]) to world pixels; z lifts upward. */
export const gridToWorld = (gx: number, gy: number, z = 0) => {
  const v = toView(gx, gy);
  return viewToWorld(v.x, v.y, z);
};

/** World pixels (on the ground) to a continuous grid point. */
export function worldToGrid(wx: number, wy: number) {
  return fromView((wx / HW + wy / HH) / 2, (wy / HH - wx / HW) / 2);
}

/** Ground point at the center of a footprint. */
export const footCenter = (x: number, y: number, w = 1, h = w) => gridToWorld(x + w / 2, y + h / 2);

export function worldToCell(wx: number, wy: number): { x: number; y: number } | null {
  const g = worldToGrid(wx, wy);
  const x = Math.floor(g.x);
  const y = Math.floor(g.y);
  return x >= 0 && y >= 0 && x < COLS && y < ROWS ? { x, y } : null;
}

/** Corners of a grid rectangle as world points (for ground polygons). */
export const rectCorners = (x: number, y: number, w: number, h: number) => [
  gridToWorld(x, y),
  gridToWorld(x + w, y),
  gridToWorld(x + w, y + h),
  gridToWorld(x, y + h),
];

export const WORLD = {
  left: -ROWS * HW,
  right: COLS * HW,
  top: -140,
  bottom: (COLS + ROWS) * HH + 40,
};

/** `tint` is the day/night colour multiplied over the world; `light` the night glows added on top of it. */
export const DEPTH = { ground: 0, road: 1, groundFx: 2, overlay: 5, world: 100, tint: 1490, light: 1495, fx: 1500, preview: 1600 };

/** Painter's order for objects standing at continuous grid position (gx, gy). */
export const depthAt = (gx: number, gy: number) => {
  const v = toView(gx, gy);
  return DEPTH.world + (v.x + v.y) * 10;
};

/** Stable per-cell hash for picking visual variants. */
export const cellHash = (x: number, y: number) => {
  let h = Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return (h ^ (h >>> 15)) >>> 0;
};
