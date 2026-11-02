import { RULES } from '../core';

/** Isometric 2:1 tile size. */
export const TW = 64;
export const TH = 32;
export const HW = TW / 2;
export const HH = TH / 2;
export const COLS = RULES.map.cols;
export const ROWS = RULES.map.rows;

/** Grid coordinates (cell (x, y) spans [x, x+1] x [y, y+1]) to world pixels; z lifts upward. */
export const gridToWorld = (gx: number, gy: number, z = 0) => ({ x: (gx - gy) * HW, y: (gx + gy) * HH - z });

/** Ground point at the center of a footprint. */
export const footCenter = (x: number, y: number, size = 1) => gridToWorld(x + size / 2, y + size / 2);

export function worldToCell(wx: number, wy: number): { x: number; y: number } | null {
  const x = Math.floor((wx / HW + wy / HH) / 2);
  const y = Math.floor((wy / HH - wx / HW) / 2);
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

export const DEPTH = { ground: 0, road: 1, groundFx: 2, overlay: 5, world: 100, fx: 1500, preview: 1600 };

/** Painter's order for objects standing at continuous grid position (gx, gy). */
export const depthAt = (gx: number, gy: number) => DEPTH.world + (gx + gy) * 10;

/** Stable per-cell hash for picking visual variants. */
export const cellHash = (x: number, y: number) => (((x + 1) * 73856093) ^ ((y + 1) * 19349663)) >>> 0;
