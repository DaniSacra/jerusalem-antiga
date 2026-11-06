import { describe, expect, it } from 'vitest';
import { craftOf, createRng, doorsOf, edgeCells, mainRoadCells, pickWalkerType, walkerGoal, walkerStart, walkerTypesAvailable, WALKERS, type Building, type WalkerGoal } from '../src/core';
import { constRng, EAST, emptyGame, hire, put, ROADSIDE, westOf } from './helpers';

/** A workplace with its crew (walkers only go to one where someone works). */
const work = (s: Parameters<typeof put>[0], kind: Parameters<typeof put>[1], x: number, y: number) => {
  const b = put(s, kind, x, y);
  hire(s, b);
  return b;
};

const inDoors = (s: Parameters<typeof doorsOf>[0], b: Building, goal: WalkerGoal | null) => {
  const doors = doorsOf(s, b);
  return !!goal && goal.target === b && goal.cells.length > 0 && goal.cells.every((c) => doors.some((d) => d.x === c.x && d.y === c.y));
};

describe('walker types', () => {
  it('only offers types whose buildings exist and are connected', () => {
    const s = emptyGame();
    expect(walkerTypesAvailable(s).sort()).toEqual(['child', 'donkeyMan', 'elder', 'priest', 'shepherd']);
    work(s, 'workshop', 1, 1); // disconnected: no artisan yet
    expect(walkerTypesAvailable(s)).not.toContain('artisan');
    work(s, 'workshop', westOf('workshop'), 30);
    put(s, 'plaza', ROADSIDE, 27);
    expect(walkerTypesAvailable(s)).toEqual(expect.arrayContaining(['artisan', 'waterCarrier']));
    expect(walkerTypesAvailable(s)).not.toContain('farmer');
  });

  it('a workplace nobody works at sends no walkers of it (no ghost workers)', () => {
    const s = emptyGame();
    put(s, 'workshop', westOf('workshop'), 30);
    expect(walkerTypesAvailable(s)).not.toContain('artisan');
    hire(s, s.buildings.find((b) => b.kind === 'workshop')!);
    expect(walkerTypesAvailable(s)).toContain('artisan');
  });

  it('the porter needs both a field and a market', () => {
    const s = emptyGame();
    work(s, 'field', ROADSIDE, 27);
    expect(walkerTypesAvailable(s)).toContain('farmer');
    expect(walkerTypesAvailable(s)).not.toContain('porter');
    work(s, 'market', westOf('market'), 29);
    expect(walkerTypesAvailable(s)).toEqual(expect.arrayContaining(['porter', 'basketWoman']));
  });

  it('picks a type deterministically from the injected rng', () => {
    const s = emptyGame();
    const seq = (seed: number) => {
      const rng = createRng(seed);
      return Array.from({ length: 8 }, () => pickWalkerType(s, rng));
    };
    expect(seq(4)).toEqual(seq(4));
    expect(new Set(seq(4).concat(seq(5), seq(6)))).toEqual(new Set(walkerTypesAvailable(s)));
  });
});

describe('walker destinations', () => {
  it('the water carrier goes to a plaza or a market, and to each one with only it', () => {
    expect(WALKERS.find((w) => w.type === 'waterCarrier')!.to).toEqual(['plaza', 'market']);
    const onlyMarket = emptyGame();
    expect(walkerTypesAvailable(onlyMarket)).not.toContain('waterCarrier');
    const market = work(onlyMarket, 'market', westOf('market'), 31);
    expect(walkerTypesAvailable(onlyMarket)).toContain('waterCarrier');
    expect(inDoors(onlyMarket, market, walkerGoal(onlyMarket, 'waterCarrier', createRng(1)))).toBe(true);
    const onlyPlaza = emptyGame();
    const plaza = put(onlyPlaza, 'plaza', ROADSIDE, 27);
    expect(inDoors(onlyPlaza, plaza, walkerGoal(onlyPlaza, 'waterCarrier', createRng(1)))).toBe(true);
    // With both, the seeded rng sends her to each of them.
    const both = emptyGame();
    const p = put(both, 'plaza', ROADSIDE, 27);
    const m = work(both, 'market', westOf('market'), 31);
    const rng = createRng(7);
    const targets = new Set(Array.from({ length: 20 }, () => walkerGoal(both, 'waterCarrier', rng)?.target));
    expect(targets).toEqual(new Set([p, m]));
  });

  it('sends each type to its building', () => {
    const s = emptyGame();
    const plaza = put(s, 'plaza', ROADSIDE, 27);
    const field = work(s, 'field', ROADSIDE, 29);
    const market = work(s, 'market', westOf('market'), 31);
    const workshop = work(s, 'workshop', westOf('workshop'), 35);
    const altar = s.buildings.find((b) => b.kind === 'altar')!;
    const rng = createRng(1);
    const carrier = walkerGoal(s, 'waterCarrier', rng);
    expect(inDoors(s, plaza, carrier) || inDoors(s, market, carrier)).toBe(true);
    expect(inDoors(s, field, walkerGoal(s, 'farmer', rng))).toBe(true);
    expect(inDoors(s, market, walkerGoal(s, 'basketWoman', rng))).toBe(true);
    expect(inDoors(s, market, walkerGoal(s, 'porter', rng))).toBe(true);
    expect(inDoors(s, field, walkerGoal(s, 'porter', rng, true))).toBe(true); // and back to the field
    const back = walkerGoal(s, 'waterCarrier', rng, true); // no "from": same kind of goal
    expect(inDoors(s, plaza, back) || inDoors(s, market, back)).toBe(true);
    expect(inDoors(s, workshop, walkerGoal(s, 'artisan', rng))).toBe(true);
    expect(inDoors(s, altar, walkerGoal(s, 'elder', rng))).toBe(true);
  });

  it('priests go to the altar or the temple', () => {
    const s = emptyGame();
    const altar = s.buildings.find((b) => b.kind === 'altar')!;
    const temple = work(s, 'temple', EAST, 30);
    const seen = new Set<string>();
    const rng = createRng(2);
    for (let k = 0; k < 20; k++) {
      const g = walkerGoal(s, 'priest', rng);
      seen.add(inDoors(s, altar, g) ? 'altar' : inDoors(s, temple, g) ? 'temple' : 'other');
    }
    expect([...seen].sort()).toEqual(['altar', 'temple']);
  });

  it('the donkey man walks main roads and the shepherd the edge of the city', () => {
    const s = emptyGame();
    const main = mainRoadCells(s);
    expect(main.every((c) => c.x === 24)).toBe(true);
    const g = walkerGoal(s, 'donkeyMan', constRng(0.5))!;
    expect(g.cells).toHaveLength(1);
    expect(g.target).toBeNull();
    expect(main).toContainEqual(g.cells[0]);
    expect(edgeCells(s).map((c) => c.y).sort()).toEqual([43, 44, 45, 46, 47]);
    expect(walkerGoal(s, 'shepherd', constRng(0.99))!.cells[0].y).toBeGreaterThanOrEqual(43);
  });

  it('children go anywhere, and missing destinations fall back to a random building', () => {
    const s = emptyGame();
    const house = put(s, 'house', ROADSIDE, 30, 1);
    const altar = s.buildings.find((b) => b.kind === 'altar')!;
    const g = walkerGoal(s, 'child', createRng(1));
    expect(inDoors(s, house, g) || inDoors(s, altar, g)).toBe(true);
    const f = walkerGoal(s, 'artisan', createRng(1)); // no workshop
    expect(inDoors(s, house, f) || inDoors(s, altar, f)).toBe(true);
  });

  it('starts at home, or at a field for the porter', () => {
    const s = emptyGame();
    expect(walkerStart(s, 'child', createRng(1))).toBeNull(); // nobody lives here yet
    const home = put(s, 'house', ROADSIDE, 30, 1);
    put(s, 'house', ROADSIDE, 32); // empty plot: not a home
    const field = work(s, 'field', ROADSIDE, 36);
    const start = walkerStart(s, 'child', createRng(1))!;
    expect(doorsOf(s, home)).toContainEqual(start);
    expect(doorsOf(s, field)).toContainEqual(walkerStart(s, 'porter', createRng(1)));
  });

  it("the artisan's goal names the workshop, so he can carry its craft", () => {
    const s = emptyGame();
    const shop = work(s, 'workshop', westOf('workshop'), 30);
    shop.variant = 4;
    const g = walkerGoal(s, 'artisan', createRng(3))!;
    expect(g.target).toBe(shop);
    expect(craftOf(g.target!)).toBe('dyeing');
  });
});
