import { describe, expect, it } from 'vitest';
import { altarDistance, altarRing, between, campPlazaSpot, campRoad, caravanSpots, checkPlace, createGame, dimsOf, createRng, findPath, generateTerrain, indexOf, isReserved, RULES, startRoad, type Feature, type Terrain } from '../src/core';

const { cols, rows, clearRadius, river, denseGrove, rockOutcrop } = RULES.map;
const SEEDS = Array.from({ length: 100 }, (_, k) => k + 1);
const SEEDS_200 = Array.from({ length: 200 }, (_, k) => k + 1);
const terrainOf = (seed: number) => generateTerrain(createRng(seed));
const xy = (i: number) => ({ x: i % cols, y: Math.floor(i / cols) });

/** Distance from the altar's border to the nearest river cell. */
const riverDistance = ({ ground }: Terrain) =>
  Math.min(...ground.flatMap((g, i) => (g === 'river' ? [altarDistance(xy(i).x, xy(i).y)] : [])));

const isTree = (f: Feature | null) => f === 'olive' || f === 'palm';
const isRock = (f: Feature | null) => f === 'rock';

/**
 * Separate guaranteed groups found on the map: squares of `radius` holding `min`+ matching features,
 * with the center `distance` cells from the altar's border, entirely west of the river and off
 * the reserved land. Picked greedily so the squares do not overlap.
 */
function groups(t: Terrain, match: (f: Feature | null) => boolean, { radius: r, distance: [dMin, dMax] }: { radius: number; distance: [number, number] }, min: number) {
  const at = (x: number, y: number) => indexOf({ cols }, x, y);
  const bank = Array.from({ length: rows }, (_, y) => t.ground.slice(y * cols, (y + 1) * cols).indexOf('river'));
  const westOfRiver = (x: number, y: number) => bank[y] < 0 || x < bank[y];
  const out: { x: number; y: number }[] = [];
  for (let y = r; y < rows - r; y++) {
    for (let x = r; x < cols - r; x++) {
      const d = altarDistance(x, y);
      if (d < dMin || d > dMax || out.some((o) => Math.max(Math.abs(o.x - x), Math.abs(o.y - y)) <= 2 * r)) continue;
      let n = 0;
      let clean = true;
      for (let yy = y - r; yy <= y + r; yy++) {
        for (let xx = x - r; xx <= x + r; xx++) {
          if (match(t.feature[at(xx, yy)])) n++;
          if (isReserved(xx, yy) || !westOfRiver(xx, yy)) clean = false;
        }
      }
      if (clean && n >= min) out.push({ x, y });
    }
  }
  return out;
}
const denseGroves = (t: Terrain) => groups(t, isTree, denseGrove, denseGrove.trees);
const outcrops = (t: Terrain) => groups(t, isRock, rockOutcrop, rockOutcrop.rocks);

const inRange = (n: number, [min, max]: [number, number]) => n >= min && n <= max;

describe('map generation', () => {
  it('is 48 x 48 and the same seed draws the same terrain', () => {
    expect([cols, rows]).toEqual([48, 48]);
    expect(terrainOf(7)).toEqual(terrainOf(7));
    expect(terrainOf(7)).not.toEqual(terrainOf(8));
  });

  it.each(SEEDS)('places exactly the drawn rock, olive and palm counts, within their ranges (seed %i)', (seed) => {
    const { ground, feature } = terrainOf(seed);
    expect(ground).toHaveLength(cols * rows);
    expect(ground.includes('sand') && ground.includes('grass')).toBe(true);
    // The totals are drawn right after the 6 shape phases and the river distance, and all get placed.
    const rng = createRng(seed);
    for (let k = 0; k < 7; k++) rng();
    const [rocks, olives, palms] = [between(rng, RULES.map.rocks), between(rng, RULES.map.olives), between(rng, RULES.map.palms)];
    expect(feature.filter((f) => f === 'rock').length).toBe(rocks);
    expect(feature.filter((f) => f === 'olive').length).toBe(olives);
    expect(feature.filter((f) => f === 'palm').length).toBe(palms);
    expect(inRange(rocks, RULES.map.rocks) && inRange(olives, RULES.map.olives) && inRange(palms, RULES.map.palms)).toBe(true);
  });

  it('the counts and the river distance really vary between seeds', () => {
    const rocks = new Set(SEEDS.map((seed) => terrainOf(seed).feature.filter((f) => f === 'rock').length));
    const distances = new Set(SEEDS.map((seed) => riverDistance(terrainOf(seed))));
    expect(rocks.size).toBeGreaterThan(10);
    expect(distances.size).toBeGreaterThan(6);
    expect(distances.has(river.distance[0]) && distances.has(river.distance[1])).toBe(true);
  });

  it.each(SEEDS)('has one continuous river, 3 to 4 cells wide on every row, at 8 to 18 cells from the altar (seed %i)', (seed) => {
    const t = terrainOf(seed);
    let prev: number[] | null = null;
    for (let y = 0; y < rows; y++) {
      const xs = Array.from({ length: cols }, (_, x) => x).filter((x) => t.ground[indexOf({ cols }, x, y)] === 'river');
      expect(xs.length).toBeGreaterThanOrEqual(river.minWidth);
      expect(xs.length).toBeLessThanOrEqual(river.maxWidth);
      expect(xs[xs.length - 1] - xs[0] + 1).toBe(xs.length); // one band per row
      expect(xs[0]).toBeGreaterThan(RULES.map.altar.x); // east of the altar
      // Continuous: each row's band shares a column with the previous one, shifting at most one cell.
      if (prev) {
        expect(xs.some((x) => prev!.includes(x))).toBe(true);
        expect(Math.abs(xs[0] - prev[0])).toBeLessThanOrEqual(1);
      }
      prev = xs;
    }
    expect(inRange(riverDistance(t), river.distance)).toBe(true);
  });

  it('the river bends', () => {
    const t = terrainOf(3);
    const west = Array.from({ length: rows }, (_, y) => t.ground.slice(y * cols, (y + 1) * cols).indexOf('river'));
    expect(Math.max(...west) - Math.min(...west)).toBeGreaterThanOrEqual(3);
  });

  it.each(SEEDS_200)('has 2 dense groves (24+ trees in 7 x 7) and a rock outcrop (12+ rocks in 5 x 5) west of the river, off the reserved land (seed %i)', (seed) => {
    const t = terrainOf(seed);
    expect([denseGrove.min, denseGrove.trees, denseGrove.distance, rockOutcrop.min, rockOutcrop.rocks, rockOutcrop.distance]).toEqual([2, 24, [10, 20], 1, 12, [10, 18]]);
    expect(denseGroves(t).length).toBeGreaterThanOrEqual(denseGrove.min);
    expect(outcrops(t).length).toBeGreaterThanOrEqual(rockOutcrop.min);
  });

  it('places trees in groves with clearings, not spread evenly', () => {
    // Most trees have another tree within one cell; an even spread of ~160 trees over the map would not.
    for (const seed of [1, 2, 3, 42, 999]) {
      const { feature } = terrainOf(seed);
      const trees = feature.flatMap((f, i) => (f === 'olive' || f === 'palm' ? [xy(i)] : []));
      const tree = (x: number, y: number) => x >= 0 && y >= 0 && x < cols && y < rows && ['olive', 'palm'].includes(feature[indexOf({ cols }, x, y)] ?? '');
      const grouped = trees.filter(({ x, y }) => [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => (dx || dy) && tree(x + dx, y + dy))));
      expect(grouped.length / trees.length).toBeGreaterThan(0.75);
    }
  });

  it.each(SEEDS_200)('keeps rocks and trees off the reserved land, the starting roads, the caravan camp and the river (seed %i)', (seed) => {
    const { ground, feature } = terrainOf(seed);
    const house = dimsOf('house');
    const camp = [...caravanSpots(), campPlazaSpot()].flatMap((c) => [0, 1].flatMap((dy) => [0, 1].map((dx) => ({ x: c.x + dx * (house.w - 1), y: c.y + dy * (house.h - 1) }))));
    for (const c of [...startRoad(), ...campRoad(), ...camp]) {
      expect(isReserved(c.x, c.y)).toBe(true);
      expect(feature[indexOf({ cols }, c.x, c.y)]).toBeNull();
    }
    feature.forEach((f, i) => {
      if (!f) return;
      const { x, y } = xy(i);
      expect(isReserved(x, y)).toBe(false);
      expect(ground[i]).not.toBe('river');
    });
  });

  it('reserves 9 cells around the 4x4 altar and a strip along the starting road to the entrance', () => {
    expect(isReserved(13, 13)).toBe(true);
    expect(isReserved(34, 34)).toBe(true);
    expect(isReserved(12, 24)).toBe(false);
    expect(isReserved(30, 35)).toBe(false);
    for (let y = 26; y < rows; y++) for (let x = 22; x <= 26; x++) expect(isReserved(x, y)).toBe(true);
    expect(isReserved(21, 47)).toBe(false);
    expect(isReserved(27, 40)).toBe(false);
  });

  it.each(SEEDS_200)('starts with free roads, the caravan inside the clear radius and the temple fitting near the altar (seed %i)', (seed) => {
    const s = createGame(createRng(seed));
    for (const c of startRoad()) {
      const i = indexOf(s, c.x, c.y);
      expect(s.feature[i]).toBeNull();
      expect(s.ground[i]).not.toBe('river');
    }
    for (const b of s.buildings) {
      if (b.kind !== 'house') continue;
      expect(altarDistance(b.x, b.y) <= clearRadius && altarDistance(b.x + b.w - 1, b.y + b.h - 1) <= clearRadius).toBe(true);
    }
    // At least 3 spots for the 6 x 6 temple on the road, within 12 cells of the altar, without cutting trees.
    s.unlocked = [...s.unlocked, 'temple'];
    s.silver = 1e6;
    const { w } = dimsOf('temple');
    let spots = 0;
    for (let y = 0; y + w <= rows; y++) {
      for (let x = 0; x + w <= cols; x++) {
        if (altarDistance(x, y) > 12 || altarDistance(x + w - 1, y + w - 1) > 12) continue;
        if (checkPlace(s, 'temple', x, y).ok) spots++;
      }
    }
    expect(spots).toBeGreaterThanOrEqual(3);
  });

  it('the opening changes with the seed: the river or the grove is close on some maps and far on others', () => {
    const near = SEEDS.map((seed) => {
      const t = terrainOf(seed);
      return { river: riverDistance(t), grove: Math.min(...denseGroves(t).map((g) => altarDistance(g.x, g.y))) };
    });
    expect(near.some((n) => n.river <= 10)).toBe(true);
    expect(near.some((n) => n.river >= 16)).toBe(true);
    expect(near.some((n) => n.grove <= 14)).toBe(true);
    expect(near.some((n) => n.grove >= 17)).toBe(true);
  });

  it('starts with a 4x4 altar at the center, the caravan tents and a road to the south edge (the entrance)', () => {
    const s = createGame(createRng(5));
    expect(s.silver).toBe(RULES.startSilver);
    expect(s.unlocked).toEqual(RULES.startUnlocked);
    expect(s.buildings.filter((b) => b.kind === 'altar')).toEqual([expect.objectContaining({ kind: 'altar', x: 22, y: 22, w: 4, h: 4, connected: true })]);
    const tents = s.buildings.filter((b) => b.kind !== 'altar');
    expect(tents.length).toBe(s.start.families);
    for (const b of tents) expect(b).toEqual(expect.objectContaining({ kind: 'house', level: 1 }));
    expect(s.grid[indexOf(s, 25, 25)]?.kind).toBe('altar');
    expect(s.entrance).toEqual({ x: 24, y: 47 });
    for (let y = 26; y < 48; y++) expect(s.network[indexOf(s, 24, y)]).toBe(true);
    expect(s.network[indexOf(s, 22, 22)]).toBe(true); // altar cells start the network
  });

  it.each([1, 5, 42])('starts with a free, connected road ring around the altar (seed %i)', (seed) => {
    const s = createGame(createRng(seed));
    const ring = altarRing();
    expect(ring).toHaveLength(20); // the 6 x 6 perimeter of x, y = 21..26
    for (let y = 21; y <= 26; y++) {
      for (let x = 21; x <= 26; x++) {
        const i = indexOf(s, x, y);
        const onRing = x === 21 || x === 26 || y === 21 || y === 26;
        expect(ring.some((c) => c.x === x && c.y === y)).toBe(onRing);
        if (!onRing) continue;
        expect(s.roads[i] && s.network[i]).toBe(true);
        expect(s.feature[i]).toBeNull();
        expect(isReserved(x, y)).toBe(true);
      }
    }
    // Every ring cell is walkable from the entrance, and the south road still reaches it.
    for (const c of ring) expect(findPath(s, s.entrance, [c])).not.toBeNull();
    expect(findPath(s, s.entrance, [{ x: 24, y: 26 }])).toHaveLength(22);
    expect(s.silver).toBe(RULES.startSilver); // the starting roads are free
  });
});
