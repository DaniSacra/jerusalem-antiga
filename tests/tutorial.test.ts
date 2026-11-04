import { describe, expect, it } from 'vitest';
import {
  BUILDINGS,
  createGame,
  createRng,
  dimsOf,
  foodSpot,
  gatherFood,
  ghostRoad,
  houseHint,
  indexOf,
  isFreeLand,
  markTutorial,
  needMet,
  refreshCity,
  servedHouses,
  TUTORIAL_EXTRAS,
  TUTORIAL_STEPS,
  tutorialHoldsClock,
  tutorialProgress,
  tutorialStepDone,
  stepWeek,
  wateredHouseSpots,
  type Cell,
  type TutorialStepId,
} from '../src/core';
import TUTORIAL from '../src/data/tutorial.json';
import { constRng, EAST, emptyGame, put, road, ROADSIDE, westOf } from './helpers';

const step = (id: TutorialStepId) => [...TUTORIAL_STEPS, ...TUTORIAL_EXTRAS].find((s) => s.id === id)!;

describe('tutorial steps', () => {
  it('has the six survival steps, food first, then the balance and market extras, each with its tool', () => {
    expect(TUTORIAL_STEPS.map((s) => [s.id, s.tool, s.target])).toEqual([
      ['road', 'road', 1],
      ['gather', 'fisher', 1],
      ['field', 'field', 1],
      ['well', 'well', 1],
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

  it('holds the clock on the build steps and lets it run while a family is on its way', () => {
    for (const st of TUTORIAL_STEPS) expect(tutorialHoldsClock(st)).toBe(st.id !== 'family');
    expect(tutorialHoldsClock(step('upkeep'))).toBe(false);
    expect(tutorialHoldsClock(null)).toBe(false);
  });

  it('marks the connected roads and houses, and the suggested road, when a step starts', () => {
    const s = emptyGame();
    const roads = s.network.filter(Boolean).length;
    put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'house', ROADSIDE, 29);
    put(s, 'house', 1, 1); // not connected
    expect(markTutorial(s)).toEqual({ roads, houses: 2, ghost: ghostRoad(s) });
  });

  it('road: done once the suggested road is built, or as many new joined road cells elsewhere', () => {
    const s = emptyGame();
    const mark = markTutorial(s);
    const n = mark.ghost.length;
    expect(n).toBeGreaterThan(1);
    road(s, mark.ghost.slice(0, -1).map((c) => [c.x, c.y]));
    expect(tutorialStepDone(s, step('road'), mark)).toBe(false);
    road(s, mark.ghost.slice(-1).map((c) => [c.x, c.y]));
    expect(tutorialProgress(s, step('road'), mark)).toBe(1);

    const other = emptyGame();
    const m2 = markTutorial(other);
    road(other, Array.from({ length: n }, (_, k) => [2 + k, 2] as [number, number])); // not joined
    expect(tutorialStepDone(other, step('road'), m2)).toBe(false);
    road(other, Array.from({ length: n }, (_, k) => [20 - k, 23] as [number, number])); // west of the ring, away from the river
    expect(tutorialStepDone(other, step('road'), m2)).toBe(true);
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

describe('food spot and ghost road', () => {
  /** The cell is orthogonally next to the rectangle (outside it). */
  const touches = (rect: { x: number; y: number; w: number; h: number }, c: Cell) =>
    (c.x >= rect.x && c.x < rect.x + rect.w && (c.y === rect.y - 1 || c.y === rect.y + rect.h)) ||
    (c.y >= rect.y && c.y < rect.y + rect.h && (c.x === rect.x - 1 || c.x === rect.x + rect.w));

  it('on 200 maps points at a spot that brings >= minSpotFood a week (95%), and building it as shown connects it', () => {
    let good = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s = createGame(createRng(seed));
      const spot = foodSpot(s);
      if (!spot) continue;
      expect(spot.food).toBeGreaterThanOrEqual(TUTORIAL.minSpotFood);
      expect(ghostRoad(s)).toEqual(spot.road);
      expect(spot.road.every((c) => isFreeLand(s, c.x, c.y))).toBe(true);
      road(s, spot.road.map((c) => [c.x, c.y]));
      const b = put(s, spot.kind, spot.x, spot.y);
      refreshCity(s);
      expect(b.connected).toBe(true);
      expect(gatherFood(s, b)).toBeCloseTo(spot.food);
      good++;
    }
    expect(good).toBeGreaterThanOrEqual(190);
  });

  it('the road is a connected path from the network to the side of the building', () => {
    const s = createGame(createRng(7));
    const spot = foodSpot(s)!;
    const { w, h } = dimsOf(spot.kind);
    const rect = { x: spot.x, y: spot.y, w, h };
    if (spot.road.length) {
      const [a] = spot.road;
      expect([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => s.network[indexOf(s, a.x + dx, a.y + dy)])).toBe(true);
      for (let k = 1; k < spot.road.length; k++) expect(Math.abs(spot.road[k].x - spot.road[k - 1].x) + Math.abs(spot.road[k].y - spot.road[k - 1].y)).toBe(1);
      expect(touches(rect, spot.road.at(-1)!)).toBe(true);
    }
  });

  it('prefers the spot that brings the most, then the shortest road', () => {
    const s = emptyGame(); // only the river, east of the altar
    const fish = foodSpot(s)!;
    expect(fish.kind).toBe('fisher');
    expect(fish.food).toBe(BUILDINGS.fisher.gather!.max);
    // A grove right by the ring brings as much with a shorter road.
    for (let y = 10; y < 22; y++) for (let x = 12; x < 20; x++) if (isFreeLand(s, x, y)) s.feature[indexOf(s, x, y)] = 'olive';
    const grove = foodSpot(s)!;
    expect(grove.kind).toBe('gatherer');
    expect(grove.food).toBe(fish.food);
    expect(grove.road.length).toBeLessThan(fish.road.length);
  });

  it('is null when no spot brings enough food', () => {
    const s = emptyGame();
    s.ground = s.ground.map(() => 'sand');
    s.feature[indexOf(s, 10, 10)] = 'olive'; // one tree: 0.3 a week
    expect(foodSpot(s)).toBeNull();
    expect(ghostRoad(s)).toEqual([]);
  });

  it('a building in the way sends the road around it', () => {
    const s = emptyGame();
    const first = ghostRoad(s);
    const mid = first[Math.floor(first.length / 2)];
    put(s, 'well', mid.x, mid.y);
    refreshCity(s);
    const next = ghostRoad(s);
    expect(next.length).toBeGreaterThan(0);
    expect(next.every((c) => isFreeLand(s, c.x, c.y))).toBe(true);
  });
});

describe('house hint', () => {
  it('is null with no well, and otherwise a free spot with water, the nearest to the altar', () => {
    const s = emptyGame();
    expect(houseHint(s)).toBeNull();
    expect(wateredHouseSpots(s)).toEqual([]);
    put(s, 'well', EAST, 27);
    refreshCity(s);
    const spots = wateredHouseSpots(s);
    expect(spots.length).toBeGreaterThan(0);
    for (const o of spots) {
      const cells = [0, 1].flatMap((dx) => [0, 1].map((dy) => indexOf(s, o.x + dx, o.y + dy)));
      expect(cells.some((i) => s.coverage.well[i])).toBe(true);
    }
    const hint = houseHint(s)!;
    expect(spots).toContainEqual(hint);
    // A family on the hinted plot keeps the gate open: the tent has water.
    const tent = put(s, 'house', hint.x, hint.y, 1);
    refreshCity(s);
    expect(needMet(s, tent, 'well')).toBe(true);
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
