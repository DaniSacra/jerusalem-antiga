import { clearCell, indexOf, isFreeLand, place, placeSpots, refreshCity, type BuildableKind, type GameState, type Rng } from '../core';

const KINDS: [BuildableKind, number][] = [
  ['house', 0.55], ['field', 0.14], ['plaza', 0.07], ['workshop', 0.06], ['market', 0.05], ['park', 0.05], ['granary', 0.04], ['gatherer', 0.04],
];

const pickKind = (rng: Rng): BuildableKind => {
  let r = rng();
  for (const [k, w] of KINDS) if ((r -= w) < 0) return k;
  return 'house';
};

/**
 * Test cities of a given size for the performance measures (the bots stop growing around 60–90
 * buildings on this map): builds on with the core's own `place` (silver and unlocks lent for the
 * moment and given back), laying roads out from the network when there is no room, and gives the
 * new houses a lived-in level. Not a game rule: the 3D proof's `?b=150` only.
 */
export function growCity(s: GameState, target: number, rng: Rng) {
  const silver = s.silver;
  const unlocked = s.unlocked;
  s.silver = 1e9;
  s.unlocked = [...new Set([...unlocked, 'road' as const, ...KINDS.map(([k]) => k)])];
  const a = s.altar;
  const dist = (x: number, y: number) => Math.max(Math.abs(x - a.x - 2), Math.abs(y - a.y - 2));
  // Room to build: a grid of streets (every third row, a cross street every seventh column) on
  // the open land around the city, growing outwards until the target fits.
  for (let r = 8; r <= 26 && placeSpots(s, 'house').length < (target - s.buildings.length) * 2.5; r += 3) streetGrid(s, a.x + 2, a.y + 2, r);
  for (let tries = 0; s.buildings.length < target && tries < 1500; tries++) {
    const kind = pickKind(rng);
    const spots = placeSpots(s, kind).sort((p, q) => dist(p.x, p.y) - dist(q.x, q.y));
    if (spots.length && rng() < 0.85) {
      const c = spots[Math.floor(rng() * Math.min(10, spots.length))];
      if (place(s, kind, c.x, c.y, false, rng).ok && kind === 'house') s.buildings[s.buildings.length - 1].level = 1 + Math.floor(rng() * 4);
      continue;
    }
    extendRoad(s, rng);
  }
  refreshCity(s);
  s.silver = silver;
  s.unlocked = unlocked;
}

function streetGrid(s: GameState, cx: number, cy: number, r: number) {
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 1 || y < 1 || x >= s.cols - 1 || y >= s.rows - 1) continue;
      if ((y - cy) % 3 !== 0 && (x - cx) % 7 !== 0) continue;
      const j = indexOf(s, x, y);
      if (s.roads[j] || s.grid[j] || s.ground[j] === 'river') continue;
      if (s.feature[j]) clearCell(s, x, y);
      if (isFreeLand(s, x, y)) place(s, 'road', x, y);
    }
}

/** A straight road of a few cells out of a random road cell, clearing trees and rocks in its way. */
function extendRoad(s: GameState, rng: Rng) {
  const roads: number[] = [];
  s.network.forEach((n, i) => n && s.roads[i] && roads.push(i));
  if (!roads.length) return;
  const i = roads[Math.floor(rng() * roads.length)];
  let x = i % s.cols;
  let y = Math.floor(i / s.cols);
  const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(rng() * 4)];
  const len = 3 + Math.floor(rng() * 5);
  for (let k = 0; k < len; k++) {
    x += dx;
    y += dy;
    if (x < 1 || y < 1 || x >= s.cols - 1 || y >= s.rows - 1) return;
    const j = indexOf(s, x, y);
    if (s.roads[j]) continue;
    if (s.feature[j]) clearCell(s, x, y);
    if (!isFreeLand(s, x, y) || !place(s, 'road', x, y).ok) return;
  }
}
