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
  type TutorialStepId,
} from '../src/core';
import { EAST, emptyGame, put, road, ROADSIDE, westOf } from './helpers';

const step = (id: TutorialStepId) => [...TUTORIAL_STEPS, ...TUTORIAL_EXTRAS].find((s) => s.id === id)!;

describe('tutorial steps', () => {
  it('has the six first-game steps, then the balance and market extras, each with its tool', () => {
    expect(TUTORIAL_STEPS.map((s) => [s.id, s.tool, s.target])).toEqual([
      ['road', 'road', 4],
      ['houses', 'house', 3],
      ['family', null, 1],
      ['field', 'field', 1],
      ['well', 'well', 1],
      ['grow', null, 1],
    ]);
    expect(TUTORIAL_EXTRAS.map((s) => [s.id, s.tool])).toEqual([
      ['upkeep', null],
      ['market', 'market'],
    ]);
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

  it('houses: done with 3 connected houses, plots included', () => {
    const s = emptyGame();
    const mark = markTutorial(s);
    put(s, 'house', 1, 1); // not connected
    put(s, 'house', ROADSIDE, 27);
    put(s, 'house', ROADSIDE, 29);
    expect(tutorialStepDone(s, step('houses'), mark)).toBe(false);
    put(s, 'house', ROADSIDE, 31);
    expect(tutorialStepDone(s, step('houses'), mark)).toBe(true);
  });

  it('family, field, well, grow and market: done by the matching city state', () => {
    const s = emptyGame();
    const mark = markTutorial(s);
    const done = (id: TutorialStepId) => tutorialStepDone(s, step(id), mark);
    const house = put(s, 'house', ROADSIDE, 27);
    expect(done('family')).toBe(false);
    house.level = 1;
    expect(done('family')).toBe(true);
    put(s, 'field', 1, 1); // not connected
    expect(done('field')).toBe(false);
    put(s, 'field', westOf('field'), 30);
    expect(done('field')).toBe(true);
    expect(done('well')).toBe(false);
    put(s, 'well', EAST, 27);
    expect(done('well')).toBe(true);
    expect(done('grow')).toBe(false);
    house.level = 2;
    expect(done('grow')).toBe(true);
    expect(done('market')).toBe(false);
    put(s, 'market', EAST, 30);
    expect(done('market')).toBe(true);
    expect(done('upkeep')).toBe(false); // only a tap ends it
  });
});

describe('ghost road', () => {
  it('leaves the ring in a straight free line of 6 cells on 100 maps', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const s = createGame(createRng(seed));
      const g = ghostRoad(s);
      expect(g).toHaveLength(6);
      expect(g.every((c) => isFreeLand(s, c.x, c.y))).toBe(true);
      // The first cell touches the ring, so building it joins the network.
      const [a] = g;
      expect([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => s.network[indexOf(s, a.x + dx, a.y + dy)])).toBe(true);
      const straight = g.every((c) => c.x === a.x) || g.every((c) => c.y === a.y);
      expect(straight).toBe(true);
    }
  });

  it('tries another side when the first one is taken', () => {
    const s = emptyGame();
    const first = ghostRoad(s);
    put(s, 'house', first[2].x, first[2].y - 1);
    refreshCity(s);
    const next = ghostRoad(s);
    expect(next).toHaveLength(6);
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

describe('ghost road (fallbacks)', () => {
  it('tries west, then north, then east, and is empty when all are blocked', () => {
    const s = emptyGame();
    const block = (line: { x: number; y: number }[]) => (s.feature[indexOf(s, line[line.length - 1].x, line[line.length - 1].y)] = 'rock');
    const west = ghostRoad(s);
    expect(west.every((c) => c.y === west[0].y && c.x < 22)).toBe(true);
    block(west);
    const north = ghostRoad(s);
    expect(north).toHaveLength(6);
    expect(north.every((c) => c.x === north[0].x && c.y < 22)).toBe(true);
    block(north);
    const east = ghostRoad(s);
    expect(east).toHaveLength(6);
    expect(east.every((c) => c.y === east[0].y && c.x > 25)).toBe(true);
    block(east);
    expect(ghostRoad(s)).toEqual([]);
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
