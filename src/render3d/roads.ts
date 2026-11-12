import { borderCells, indexOf, statOf, type GameState } from '../core';
import LOOK from './look3d.json';

/**
 * How each road looks, by the people who go along it (pure, no Three.js; only looks, never read by
 * the rules). Every building sends its people to the altar along the shortest road: a house its
 * residents, a workplace its jobs, another service a couple. A road few people use is a narrow trail
 * worn down the middle; a common way is a full earth road; a very busy one gets a stone kerb. The
 * streets around the altar and the temple are at least a road.
 */
export type RoadLevel = 0 | 1 | 2;

const R = LOOK.roads;
const SIDES: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];
/** Turn (about y) that points a model's +z toward (dx, dy). */
export const turnTo = (dx: number, dy: number) => Math.atan2(dx, dy);

/** People going along each cell (by cell index) on their way to the altar. */
export function roadTraffic(s: GameState): Float32Array {
  const n = s.cols * s.rows;
  const traffic = new Float32Array(n);
  const altar = s.buildings.find((b) => b.kind === 'altar');
  if (!altar) return traffic;
  // Breadth-first from the roads beside the altar over the network: each cell's next step home.
  const next = new Int32Array(n).fill(-2);
  const dist = new Int32Array(n).fill(-1);
  const queue: number[] = [];
  for (const c of borderCells(s, altar)) {
    const i = indexOf(s, c.x, c.y);
    if (s.network[i] && dist[i] < 0) {
      dist[i] = 0;
      next[i] = -1;
      queue.push(i);
    }
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    const x = i % s.cols;
    const y = (i - x) / s.cols;
    for (const [dx, dy] of SIDES) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= s.cols || ny >= s.rows) continue;
      const j = indexOf(s, nx, ny);
      if (!s.network[j] || dist[j] >= 0) continue;
      dist[j] = dist[i] + 1;
      next[j] = i;
      queue.push(j);
    }
  }
  const residents = new Map<number, number>();
  for (const p of s.people) if (p.houseId !== null) residents.set(p.houseId, (residents.get(p.houseId) ?? 0) + 1);
  for (const b of s.buildings) {
    if (b.kind === 'altar') continue;
    const weight = b.kind === 'house' ? (residents.get(b.id) ?? 0) : statOf(b, 'jobs') || R.serviceTraffic;
    if (!weight) continue;
    // From its nearest road on the network, step by step to the altar.
    let at = -1;
    for (const c of borderCells(s, b)) {
      const i = indexOf(s, c.x, c.y);
      if (dist[i] >= 0 && (at < 0 || dist[i] < dist[at])) at = i;
    }
    for (let i = at; i >= 0; i = next[i]) traffic[i] += weight;
  }
  return traffic;
}

/** The look of the road on (x, y) for that traffic: 0 trail, 1 road, 2 road with a stone kerb. */
export function roadLevel(s: GameState, traffic: Float32Array, x: number, y: number, sacred = sacredOf(s)): RoadLevel {
  const t = traffic[indexOf(s, x, y)];
  const level: RoadLevel = t >= R.kerb ? 2 : t >= R.road ? 1 : 0;
  if (level === 0 && sacred.some((b) => Math.max(b.x - x, x - (b.x + b.w - 1), b.y - y, y - (b.y + b.h - 1), 0) <= R.pavedNear)) return 1;
  return level;
}

/** The altar and the temple (their streets are at least a road). */
export const sacredOf = (s: GameState) => s.buildings.filter((b) => b.kind === 'altar' || b.kind === 'temple');

/**
 * The road models: a trail and its arms; a road, its dark edge, its wheel ruts (an arm toward a
 * road beside it) and a few stones on it; a busy road's flagstones and stone kerb; a loose road.
 */
export type RoadKey = 'trail' | 'trail-arm' | 'road' | 'road-edge' | 'ruts' | 'road-stones' | 'flags' | 'kerb' | 'loose' | 'loose-arm';
export const ROAD_KEYS: RoadKey[] = ['trail', 'trail-arm', 'road', 'road-edge', 'ruts', 'road-stones', 'flags', 'kerb', 'loose', 'loose-arm'];

/** Stable 0..1 of a cell (which roads get stones, how the flagstones turn). */
const cellHash = (x: number, y: number, k: number) => {
  const h = Math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453;
  return h - Math.floor(h);
};

/** One piece of a road on the ground: its model, cell centre and turn. */
export interface RoadPiece {
  key: RoadKey | 'verge';
  x: number;
  z: number;
  rot: number;
}

/**
 * The pieces that draw the road on (x, y): a road off the network is dashed; a trail is a worn patch
 * in the middle with an arm toward each road beside it (it joins them); a road fills the cell, with
 * a dark edge on every side with no road beside it (it reads from far away), wheel ruts toward each
 * road beside it and, on some cells, a few stones; a busy road is paved with flagstones (turned by
 * the cell) and has a stone kerb on every side with no road beside it.
 */
export function roadPieces(s: GameState, x: number, y: number, level: RoadLevel): RoadPiece[] {
  const cx = x + 0.5;
  const cz = y + 0.5;
  const road = (dx: number, dy: number) => {
    const nx = x + dx;
    const ny = y + dy;
    return nx >= 0 && ny >= 0 && nx < s.cols && ny < s.rows && s.roads[indexOf(s, nx, ny)];
  };
  // Off the network (no way to the altar): faded and dashed, a dash in the middle and half a dash
  // toward each road beside it (two halves meet on the border), as the 2D drew a loose road.
  if (!s.network[indexOf(s, x, y)]) return [{ key: 'loose', x: cx, z: cz, rot: 0 }, ...SIDES.filter(([dx, dy]) => road(dx, dy)).map(([dx, dy]) => ({ key: 'loose-arm' as const, x: cx, z: cz, rot: turnTo(dx, dy) }))];
  if (level === 0) return [{ key: 'trail', x: cx, z: cz, rot: 0 }, ...SIDES.filter(([dx, dy]) => road(dx, dy)).map(([dx, dy]) => ({ key: 'trail-arm' as const, x: cx, z: cz, rot: turnTo(dx, dy) }))];
  const piece = (key: RoadKey, rot = 0): RoadPiece => ({ key, x: cx, z: cz, rot });
  const open = SIDES.filter(([dx, dy]) => !road(dx, dy));
  if (level === 2) return [piece('flags', Math.floor(cellHash(x, y, 40) * 4) * (Math.PI / 2)), ...open.map(([dx, dy]) => piece('kerb', turnTo(dx, dy)))];
  const out = [piece('road'), ...open.map(([dx, dy]) => piece('road-edge', turnTo(dx, dy))), ...SIDES.filter(([dx, dy]) => road(dx, dy)).map(([dx, dy]) => piece('ruts', turnTo(dx, dy)))];
  if (cellHash(x, y, 41) < R.stoneShare) out.push(piece('road-stones', cellHash(x, y, 42) * 6.28));
  return out;
}

/**
 * Lumps of lawn over the edge of a road cell (look only): on every side with no road beside it and no
 * building, a couple of flat tufts straddle the edge, so the road's silhouette is ragged and the grass
 * seems to creep in (the model is `verge`; none on a stone road, whose kerb stays clean, nor off the network).
 */
export function vergePieces(s: GameState, x: number, y: number, level: RoadLevel): RoadPiece[] {
  if (level === 2 || !s.network[indexOf(s, x, y)]) return [];
  const out: RoadPiece[] = [];
  for (const [dx, dy] of SIDES) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= s.cols || ny >= s.rows) continue;
    const j = indexOf(s, nx, ny);
    if (s.roads[j] || s.grid[j]) continue;
    for (let k = 0; k < 2; k++) {
      if (cellHash(x, y, 50 + k * 3 + dx + 2 * dy) >= R.vergeShare) continue;
      const along = 0.1 + cellHash(x, y, 60 + k + dx * 5 + dy * 9) * 0.8;
      const out0 = 0.5 + (cellHash(x, y, 70 + k) - 0.5) * 0.14;
      out.push({ key: 'verge', x: x + 0.5 + dx * out0 + (dy !== 0 ? along - 0.5 : 0), z: y + 0.5 + dy * out0 + (dx !== 0 ? along - 0.5 : 0), rot: cellHash(x, y, 80 + k) * 6.28 });
    }
  }
  return out;
}
