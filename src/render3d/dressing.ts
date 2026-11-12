import { indexOf, type GameState } from '../core';
import LOOK from './look3d.json';
import { hash, type Placement } from './plan';

/**
 * The little things that make the countryside look lived in (look only, no Three.js): firewood and a
 * short fence by the houses, hay by the granary and the gatherers, a shed beside every field, fallen logs,
 * stumps and mossy stones in the grass near the town. All on free cells (no road, building, tree, rock or
 * river), never beside a road for the things that need room (the way to the door stays clear), stable per
 * map. Pure and tested (tests/render3d/dressing.test.ts); `cityPlan` adds them to the city.
 */
const D = LOOK.dressing;
const SIDES: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];

const free = (s: GameState, x: number, y: number) => {
  if (x < 0 || y < 0 || x >= s.cols || y >= s.rows) return false;
  const i = indexOf(s, x, y);
  return !s.roads[i] && !s.grid[i] && !s.feature[i] && s.ground[i] !== 'river';
};
const nextToRoad = (s: GameState, x: number, y: number) => SIDES.some(([dx, dy]) => x + dx >= 0 && y + dy >= 0 && x + dx < s.cols && y + dy < s.rows && s.roads[indexOf(s, x + dx, y + dy)]);

/** `taken`: cells already used (by the garden bushes); the dressing keeps off them. */
export function dressing(s: GameState, taken: ReadonlySet<number> = new Set()): Placement[] {
  const out: Placement[] = [];
  const used = new Set(taken);
  const put = (key: Placement['key'], cx: number, cy: number, k: number, scale = 1, spread = 0.5, rot?: number) => {
    out.push({ key, x: cx + 0.5 + (hash(cx, cy, k) - 0.5) * spread, z: cy + 0.5 + (hash(cx, cy, k + 1) - 0.5) * spread, rot: rot ?? hash(cx, cy, k + 2) * 6.28, scale, sy: 1, tint: 0.92 + hash(cx, cy, k + 3) * 0.14 });
    used.add(indexOf(s, cx, cy));
  };
  let fields = 0;
  // A free cell two steps out from a building, off the roads' edge (for a windmill when the ring is full).
  const wide = (b: { x: number; y: number; w: number; h: number; id: number }) => {
    const cells: { x: number; y: number; k: number }[] = [];
    for (let y = b.y - 2; y <= b.y + b.h + 1; y++)
      for (let x = b.x - 2; x <= b.x + b.w + 1; x++)
        if (free(s, x, y) && !used.has(indexOf(s, x, y)) && !nextToRoad(s, x, y)) cells.push({ x, y, k: hash(x, y, 101 + b.id) });
    return cells.sort((p, q) => p.k - q.k)[0];
  };
  for (const b of s.buildings) {
    const ring: { x: number; y: number; k: number }[] = [];
    for (let y = b.y - 1; y <= b.y + b.h; y++)
      for (let x = b.x - 1; x <= b.x + b.w; x++) {
        if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) continue;
        if (free(s, x, y) && !used.has(indexOf(s, x, y)) && !nextToRoad(s, x, y)) ring.push({ x, y, k: hash(x, y, 100 + b.id) });
      }
    // The cells beside roads too, for the things that belong to the street (a well, a fountain).
    const street: typeof ring = [];
    if (b.kind === 'plaza' || b.kind === 'park')
      for (let y = b.y - 1; y <= b.y + b.h; y++)
        for (let x = b.x - 1; x <= b.x + b.w; x++) {
          if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) continue;
          if (free(s, x, y) && !used.has(indexOf(s, x, y))) street.push({ x, y, k: hash(x, y, 100 + b.id) });
        }
    street.sort((p, q) => p.k - q.k);
    ring.sort((p, q) => p.k - q.k);
    const take = () => ring.shift();
    const roll = (k: number) => hash(b.x, b.y, 110 + k);
    if (b.kind === 'field') {
      // A shed beside every field, at the end of its rows.
      const c = take();
      if (c) put('shed', c.x, c.y, 120, 1, 0.2, Math.round(hash(b.x, b.y, 121) * 4) * (Math.PI / 2));
      // A windmill beside the first field and every few fields after it.
      const m = fields++ % D.windmillEvery === 0 ? (take() ?? wide(b)) : undefined;
      if (m) put('windmill', m.x, m.y, 180, D.windmillScale, 0.1, Math.round(hash(b.x, b.y, 181) * 4) * (Math.PI / 2));
    } else if (b.kind === 'house' && b.level >= 2) {
      const c = take();
      if (c && roll(1) < D.woodpileShare) put('woodpile', c.x, c.y, 130, 0.9 + roll(2) * 0.3, 0.3);
      const w = roll(7) < D.wellHouseShare ? take() : undefined;
      if (w) put('wellroof', w.x, w.y, 190, D.wellScale, 0.2);
      const f = take();
      if (f && roll(3) < D.fenceShare) {
        // A fence piece along one edge of the cell (the edge toward the house keeps the yard).
        const rot = roll(4) < 0.5 ? 0 : Math.PI / 2;
        out.push({ key: 'fence', x: f.x + 0.5 + (rot === 0 ? 0 : 0.4), z: f.y + 0.5 + (rot === 0 ? 0.4 : 0), rot, scale: 1, sy: 1, tint: 1 });
        used.add(indexOf(s, f.x, f.y));
      }
    } else if (b.kind === 'lumber') {
      const c = take();
      if (c) put('woodpile', c.x, c.y, 130, 1.2, 0.2);
      const l = take();
      if (l) put('log', l.x, l.y, 140, 1.1, 0.3);
    } else if (b.kind === 'plaza') {
      const c = street.shift();
      if (c) put('wellroof', c.x, c.y, 190, D.wellScale, 0.1);
    } else if (b.kind === 'park') {
      const c = street.shift();
      if (c) put('fountain', c.x, c.y, 195, D.fountainScale, 0.1);
    } else if (b.kind === 'granary' || b.kind === 'gatherer') {
      const c = take();
      if (c && roll(6) < D.hayShare) put('hay', c.x, c.y, 150, 1, 0.3);
      const k = take();
      if (k && roll(8) < D.cartShare) put('haycart', k.x, k.y, 200, D.cartScale, 0.15);
    }
  }
  // Fallen logs, stumps and mossy stones scattered in the grass near the town and along the roads.
  const near: boolean[] = new Array(s.cols * s.rows).fill(false);
  for (const b of s.buildings) for (let y = Math.max(0, b.y - D.reach); y < Math.min(s.rows, b.y + b.h + D.reach); y++) for (let x = Math.max(0, b.x - D.reach); x < Math.min(s.cols, b.x + b.w + D.reach); x++) near[indexOf(s, x, y)] = true;
  for (let y = 0; y < s.rows; y++)
    for (let x = 0; x < s.cols; x++) {
      const i = indexOf(s, x, y);
      if (!near[i] || !free(s, x, y) || used.has(i)) continue;
      const r = hash(x, y, 160);
      if (r < D.logShare) put('log', x, y, 161, 0.8 + hash(x, y, 164) * 0.5);
      else if (r < D.logShare + D.stumpShare) put('stump', x, y, 165, 0.8 + hash(x, y, 168) * 0.4);
      else if (r < D.logShare + D.stumpShare + D.stoneShare) put('rock', x, y, 169, 0.35 + hash(x, y, 172) * 0.35);
    }
  return out;
}
