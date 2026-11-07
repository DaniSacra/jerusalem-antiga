import { indexOf, type GameState } from '../core';
import LOOK from './look3d.json';
import { hash } from './plan';
import { wearAt } from './wear';

/**
 * Small ground detail (plano beleza C4), as plain data (no Three.js): tufts of grass on the grass
 * cells and pebbles on some sand cells, on open ground only (not on roads, buildings, trees, rocks or
 * the river) and never on trodden ground (`wear`); by the river near the town (plano beleza C6),
 * clumps of reeds at the water's edge and a few bigger stones (the tuft and pebble models, larger: no
 * new draw calls). Pure and tested; built again with the city and drawn in one instanced layer that
 * the stage hides from far away and at the minimum quality.
 */
const D = LOOK.detail;
const SIDES: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];

export interface DetailPiece {
  key: 'tuft' | 'pebbles';
  x: number;
  z: number;
  rot: number;
  scale: number;
}

export function groundDetail(s: GameState, wear: Float32Array): DetailPiece[] {
  const out: DetailPiece[] = [];
  const open = (x: number, z: number) => wearAt(s, wear, x, z) < D.wornOut;
  const altar = s.buildings.find((b) => b.kind === 'altar');
  const ax = altar ? altar.x + altar.w / 2 : s.cols / 2;
  const az = altar ? altar.y + altar.h / 2 : s.rows / 2;
  const river = (x: number, y: number) => x >= 0 && y >= 0 && x < s.cols && y < s.rows && s.ground[indexOf(s, x, y)] === 'river';
  for (let y = 0; y < s.rows; y++)
    for (let x = 0; x < s.cols; x++) {
      const i = indexOf(s, x, y);
      if (s.roads[i] || s.grid[i] || s.feature[i] || s.ground[i] === 'river') continue;
      // The bank near the town: reeds along each side that meets the water, now and then a stone.
      if (Math.hypot(x + 0.5 - ax, y + 0.5 - az) <= D.bankReach)
        for (const [dx, dy] of SIDES) {
          if (!river(x + dx, y + dy)) continue;
          const k = dx * 7 + dy * 3;
          const along = 0.15 + hash(x, y, 91 + k) * 0.7;
          const px = x + 0.5 + dx * 0.48 + (dy !== 0 ? along - 0.5 : 0);
          const pz = y + 0.5 + dy * 0.48 + (dx !== 0 ? along - 0.5 : 0);
          if (hash(x, y, 92 + k) < D.reedShare) out.push({ key: 'tuft', x: px, z: pz, rot: hash(x, y, 93 + k) * 6.28, scale: D.reedScale * (0.8 + hash(x, y, 94 + k) * 0.5) });
          else if (hash(x, y, 95 + k) < D.stoneShare) out.push({ key: 'pebbles', x: px - dx * 0.15, z: pz - dy * 0.15, rot: hash(x, y, 96 + k) * 6.28, scale: D.stoneScale });
        }
      if (s.ground[i] === 'grass') {
        if (hash(x, y, 80) >= D.tuftShare) continue;
        const n = 1 + Math.floor(hash(x, y, 81) * D.tuftsMax);
        for (let k = 0; k < n; k++) {
          const px = x + 0.12 + hash(x + k, y, 82) * 0.76;
          const pz = y + 0.12 + hash(x, y + k, 83) * 0.76;
          if (open(px, pz)) out.push({ key: 'tuft', x: px, z: pz, rot: hash(x + k, y + k, 84) * 6.28, scale: 0.75 + hash(x, y, 85 + k) * 0.6 });
        }
      } else if (hash(x, y, 86) < D.pebbleShare) {
        const px = x + 0.2 + hash(x, y, 87) * 0.6;
        const pz = y + 0.2 + hash(x, y, 88) * 0.6;
        if (open(px, pz)) out.push({ key: 'pebbles', x: px, z: pz, rot: hash(x, y, 89) * 6.28, scale: 0.8 + hash(x, y, 90) * 0.6 });
      }
    }
  return out;
}
