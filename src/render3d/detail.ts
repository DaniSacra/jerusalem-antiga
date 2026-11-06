import { indexOf, type GameState } from '../core';
import LOOK from './look3d.json';
import { hash } from './plan';
import { wearAt } from './wear';

/**
 * Small ground detail (plano beleza C4), as plain data (no Three.js): tufts of grass on the grass
 * cells and pebbles on some sand cells, on open ground only (not on roads, buildings, trees, rocks or
 * the river) and never on trodden ground (`wear`). Pure and tested; built again with the city and
 * drawn in one instanced layer that the stage hides from far away and at the minimum quality.
 */
const D = LOOK.detail;

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
  for (let y = 0; y < s.rows; y++)
    for (let x = 0; x < s.cols; x++) {
      const i = indexOf(s, x, y);
      if (s.roads[i] || s.grid[i] || s.feature[i] || s.ground[i] === 'river') continue;
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
