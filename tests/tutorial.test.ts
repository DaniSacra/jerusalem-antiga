import { describe, expect, it } from 'vitest';
import {
  BUILDINGS,
  createGame,
  createRng,
  ghostRoad,
  indexOf,
  isFreeLand,
  markTutorial,
  refreshCity,
  servedHouses,
  TUTORIAL_EXTRAS,
  TUTORIAL_STEPS,
  tutorialProgress,
  tutorialStepDone,
  stepWeek,
  type Cell,
  type GameState,
  type TutorialStepId,
} from '../src/core';
import { constRng, EAST, emptyGame, put, road, ROADSIDE, westOf } from './helpers';

const step = (id: TutorialStepId) => [...TUTORIAL_STEPS, ...TUTORIAL_EXTRAS].find((s) => s.id === id)!;

describe('tutorial steps', () => {
  it('has the six survival steps, then the balance and market extras, each with its tool', () => {
    expect(TUTORIAL_STEPS.map((s) => [s.id, s.tool, s.target])).toEqual([
      ['well', 'well', 1],
      ['road', 'road', 4],
      ['gather', 'fisher', 1],
      ['field', 'field', 1],
      ['house', 'house', 1],
      ['family', null, 1],
    ]);
    expect(step('gather').alt).toBe('gatherer');
    expect(TUTORIAL_STEPS.filter((s) => s.alt)).toHaveLength(1);
    expect(TUTORIAL_EXTRAS.map((s) => [s.id, s.tool])).toEqual([
      ['upkeep', null],
      ['market', 'market'],
    ]);
  });

  it('marks the connected roads and houses when a step starts', () => {
    const s = emptyGame();
    const roads = s.network.filter(Boolean).length;
    put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'house', ROADSIDE, 29);
    put(s, 'house', 1, 1); // not connected
    expect(markTutorial(s)).toEqual({ roads, houses: 2 });
  });

  it('road: done with 4 new road cells joined to the altar (loose ones do not count)', () => {
    const s = emptyGame();
    const mark = markTutorial(s);
    road(s, [[2, 2], [3, 2], [4, 2], [5, 2]]); // not joined
    expect(tutorialProgress(s, step('road'), mark)).toBe(0);
    road(s, [[20, 23], [19, 23], [18, 23]]);
    expect(tutorialStepDone(s, step('road'), mark)).toBe(false);
    road(s, [[17, 23]]);
    expect(tutorialStepDone(s, step('road'), mark)).toBe(true);
  });

  it('house: done with one new connected house (a plot is enough), not with the caravan tents', () => {
    const s = createGame(createRng(5));
    expect(s.buildings.some((b) => b.kind === 'house' && b.connected)).toBe(true);
    const mark = markTutorial(s);
    expect(tutorialStepDone(s, step('house'), mark)).toBe(false); // the caravan is already there
    put(s, 'house', 1, 1); // not connected
    expect(tutorialStepDone(s, step('house'), mark)).toBe(false);
    put(s, 'house', ROADSIDE, 30);
    expect(tutorialProgress(s, step('house'), mark)).toBe(1);
    expect(tutorialStepDone(s, step('house'), mark)).toBe(true);
  });

  it('gather: done with one connected fisher or gatherer', () => {
    const fish = emptyGame();
    const mark = markTutorial(fish);
    put(fish, 'fisher', 1, 1); // not connected
    expect(tutorialStepDone(fish, step('gather'), mark)).toBe(false);
    put(fish, 'fisher', westOf('fisher'), 30);
    expect(tutorialStepDone(fish, step('gather'), mark)).toBe(true);
    const tree = emptyGame();
    put(tree, 'gatherer', EAST, 30);
    expect(tutorialStepDone(tree, step('gather'), markTutorial(tree))).toBe(true);
  });

  it('family: done by the first new family (the milestone), not by a tent', () => {
    const s = emptyGame();
    const mark = markTutorial(s);
    put(s, 'house', ROADSIDE, 27, 1);
    expect(tutorialStepDone(s, step('family'), mark)).toBe(false);
    s.milestones.push('firstFamily');
    expect(tutorialStepDone(s, step('family'), mark)).toBe(true);
  });

  it('family: done once a family really arrives in the simulation', () => {
    const s = emptyGame();
    const mark = markTutorial(s);
    put(s, 'well', EAST, 27);
    put(s, 'house', ROADSIDE, 27);
    for (let k = 0; k < 8 && !tutorialStepDone(s, step('family'), mark); k++) stepWeek(s, constRng(0));
    expect(tutorialStepDone(s, step('family'), mark)).toBe(true);
  });

  it('field, well and market: done by one connected building of the kind', () => {
    const s = emptyGame();
    const mark = markTutorial(s);
    const done = (id: TutorialStepId) => tutorialStepDone(s, step(id), mark);
    put(s, 'field', 1, 1); // not connected
    expect(done('field')).toBe(false);
    put(s, 'field', westOf('field'), 30);
    expect(done('field')).toBe(true);
    expect(done('well')).toBe(false);
    put(s, 'well', EAST, 27);
    expect(done('well')).toBe(true);
    expect(done('market')).toBe(false);
    put(s, 'market', EAST, 30);
    expect(done('market')).toBe(true);
    expect(done('upkeep')).toBe(false); // only a tap ends it
  });
});

describe('ghost road', () => {
  const n = 8;
  const isTarget = (s: GameState, i: number) => s.ground[i] === 'river' || s.feature[i] === 'olive' || s.feature[i] === 'palm';
  /** Chebyshev distance from a cell to the nearest river or tree cell. */
  const reach = (s: GameState, c: Cell) => {
    let best = Infinity;
    for (let i = 0; i < s.ground.length; i++) {
      if (isTarget(s, i)) best = Math.min(best, Math.max(Math.abs((i % s.cols) - c.x), Math.abs(Math.floor(i / s.cols) - c.y)));
    }
    return best;
  };
  /** The four candidate lines, as described in tutorial.ts: west, north, east and south of the ring. */
  const lines = (): Cell[][] => [
    Array.from({ length: n }, (_, k) => ({ x: 20 - k, y: 23 })),
    Array.from({ length: n }, (_, k) => ({ x: 23, y: 20 - k })),
    Array.from({ length: n }, (_, k) => ({ x: 27 + k, y: 23 })),
    Array.from({ length: n }, (_, k) => ({ x: 25, y: 27 + k })),
  ];

  it('leaves the ring in a straight free line of ghostLength cells, toward the nearest river or tree, on 60 maps', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const s = createGame(createRng(seed));
      const g = ghostRoad(s);
      expect(g).toHaveLength(n);
      expect(g.every((c) => isFreeLand(s, c.x, c.y))).toBe(true);
      // The first cell touches the ring, so building it joins the network.
      const [a] = g;
      expect([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => s.network[indexOf(s, a.x + dx, a.y + dy)])).toBe(true);
      const straight = g.every((c) => c.x === a.x) || g.every((c) => c.y === a.y);
      expect(straight).toBe(true);
      // No other free line ends closer to the river or a tree.
      const free = lines().filter((l) => l.every((c) => isFreeLand(s, c.x, c.y)));
      expect(free).toContainEqual(g);
      for (const l of free) expect(reach(s, g.at(-1)!)).toBeLessThanOrEqual(reach(s, l.at(-1)!));
    }
  });

  it('heads for the trees when they are closer than the river', () => {
    const s = emptyGame();
    expect(ghostRoad(s)[0]).toEqual({ x: 27, y: 23 }); // only the river: east
    s.feature[indexOf(s, 20 - n, 23)] = 'olive'; // right past the end of the west line
    const g = ghostRoad(s);
    expect(g[0]).toEqual({ x: 20, y: 23 });
    expect(g.at(-1)).toEqual({ x: 20 - n + 1, y: 23 });
  });

  it('tries another side when the best one is taken, and is empty when all four are blocked', () => {
    const s = emptyGame();
    const seen = new Set<string>();
    for (let k = 0; k < 4; k++) {
      const g = ghostRoad(s);
      expect(g).toHaveLength(n);
      seen.add(`${g[0].x},${g[0].y}`);
      s.feature[indexOf(s, g[3].x, g[3].y)] = 'rock'; // a rock in the middle of it
    }
    expect([...seen].sort()).toEqual(['20,23', '23,20', '25,27', '27,23']);
    expect(ghostRoad(s)).toEqual([]);
  });

  it('a building on the line also sends it elsewhere', () => {
    const s = emptyGame();
    const first = ghostRoad(s);
    put(s, 'house', first[2].x, first[2].y - 1);
    refreshCity(s);
    const next = ghostRoad(s);
    expect(next).toHaveLength(n);
    expect(next[0]).not.toEqual(first[0]);
  });
});

describe('served houses', () => {
  it('lists the houses with a family a service placed there would reach', () => {
    const s = emptyGame();
    const near = put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'house', ROADSIDE, 29); // empty plot: not counted
    put(s, 'house', ROADSIDE, 42, 1); // too far for a well at y 27
    expect(servedHouses(s, 'well', EAST, 27)).toEqual([near]);
    expect(servedHouses(s, 'house', EAST, 27)).toEqual([]); // no radius
    expect(servedHouses(s, 'market', EAST, 36, true).map((b) => b.y)).toEqual([42]);
  });
});

describe('served houses (radius edge)', () => {
  // A 2x2 well at (EAST, 27) with radius 4 reaches rows 23..32.
  it('counts a house with one cell at the edge of the radius, not one just beyond', () => {
    const r = BUILDINGS.well.radius!;
    const edge = emptyGame();
    const touching = put(edge, 'house', ROADSIDE, 28 + r, 2); // rows 32..33: row 32 is inside
    expect(servedHouses(edge, 'well', EAST, 27)).toEqual([touching]);
    const far = emptyGame();
    put(far, 'house', ROADSIDE, 29 + r, 1); // rows 33..34: outside
    expect(servedHouses(far, 'well', EAST, 27)).toEqual([]);
  });
});
