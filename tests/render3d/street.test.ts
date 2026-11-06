import { describe, expect, it } from 'vitest';
import { indexOf, leaveHouse, refreshCity, type GameState } from '../../src/core';
import { betrothed, HOLD_SLOTS, holdLoad } from '../../src/render3d/crowd';
import LOOK from '../../src/render3d/look3d.json';
import { cityPlan } from '../../src/render3d/plan';
import { houseActs, idlePose, idleShown, leaveLead, leavePath, leavers, standable, streetPlan, type IdleSpot } from '../../src/render3d/street';
import { emptyGame, hire, person, put } from '../helpers';

const plan = (s: GameState, max?: number) => streetPlan(s, cityPlan(s).buildings, max);
/** The spots standing by the house on (x, y) (2x2) among `all` houses: the nearest centre is its. */
const by = (spots: IdleSpot[], x: number, y: number, all: { x: number; y: number }[]) => {
  const d = (o: IdleSpot, h: { x: number; y: number }) => Math.hypot(o.x - h.x - 1, o.z - h.y - 1);
  return spots.filter((o) => all.every((h) => d(o, { x, y }) <= d(o, h)) && d(o, { x, y }) < 1.8);
};

describe('the still life of the streets', () => {
  it('shows nobody in a town with no houses', () => {
    expect(plan(emptyGame())).toHaveLength(0);
  });

  it('plans more people at the door the higher the house', () => {
    for (const k of [0, 0.3, 0.7, 0.99]) {
      const n = [1, 2, 3, 4].map((l) => houseActs(l, k).reduce((sum, a) => sum + (a === 'talk' ? 2 : 1), 0));
      expect(n[0]).toBeLessThanOrEqual(1);
      expect(n.slice(1)).toEqual([1, 2, 3]);
    }
    expect(houseActs(0, 0.1)).toEqual([]);
    expect(houseActs(1, 0)).toEqual(['grind']);
  });

  it('puts the neighbours of each house before its door, residents of that house, each once', () => {
    const s = emptyGame();
    // East of the starting road (x = 24): the houses face it.
    const houses = [28, 30, 32, 34].map((y, k) => put(s, 'house', 25, y, k + 1));
    const spots = plan(s);
    const counts = houses.map((h) => by(spots, h.x, h.y, houses).length);
    expect(counts[0]).toBeLessThanOrEqual(1);
    expect(counts.slice(1)).toEqual([1, 2, 3]);
    for (const h of houses)
      for (const o of by(spots, h.x, h.y, houses)) {
        expect(standable(s, o.x, o.z, h)).toBe(true);
        expect(s.people.find((p) => p.id === o.id)?.houseId).toBe(h.id);
        // Toward the road (the front faces x = 24), not behind the house.
        if (h.level > 1) expect(o.x).toBeLessThan(h.x + 0.5);
      }
    const ids = spots.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('casts children to play and the old to stand at the door with a staff', () => {
    const s = emptyGame();
    for (let y = 28; y <= 44; y += 2) {
      const h = put(s, 'house', 25, y, y % 4 ? 3 : 4, false, 2);
      person(s, { houseId: h.id, age: 6 });
      person(s, { houseId: h.id, age: 70, sex: 'f' });
    }
    const spots = plan(s);
    const band = (o: IdleSpot) => o.band;
    expect(spots.some((o) => o.act === 'talk')).toBe(true);
    for (const o of spots) {
      if (band(o) === 'child') expect(o.act).toBe('play');
      if (o.act === 'play') expect(band(o)).toBe('child');
      if (band(o) === 'elder') expect([o.act, o.load]).toEqual(['stand', 'staff']);
    }
    expect(spots.some((o) => o.act === 'play') && spots.some((o) => band(o) === 'elder')).toBe(true);
  });

  it('never plans more than the cap and never splits two neighbours talking', () => {
    const s = emptyGame();
    for (let y = 28; y <= 44; y += 2) for (const x of [20, 25]) put(s, 'house', x, y, 4);
    refreshCity(s);
    expect(plan(s).length).toBeLessThanOrEqual(LOOK.street.max);
    for (const max of [3, 5, 8]) {
      const spots = plan(s, max);
      expect(spots.length).toBeLessThanOrEqual(max);
      const talk = spots.filter((o) => o.act === 'talk');
      for (const o of talk) expect(talk.filter((t) => t.show === o.show)).toHaveLength(2);
    }
  });

  it('shows fewer at a lower street share, whole groups first in the order of the plan', () => {
    const s = emptyGame();
    for (let y = 28; y <= 40; y += 2) put(s, 'house', 25, y, 4);
    const spots = plan(s);
    expect(idleShown(spots, 0)).toBe(0);
    expect(idleShown(spots, 1)).toBe(spots.length);
    let last = 0;
    for (const share of [0.2, 0.5, 0.8]) {
      const n = idleShown(spots, share);
      expect(n).toBeGreaterThanOrEqual(last);
      last = n;
      // A pair talking is out together or not at all.
      const out = spots.slice(0, n);
      for (const o of out.filter((o) => o.act === 'talk')) expect(out.filter((t) => t.show === o.show)).toHaveLength(2);
    }
  });

  it('gathers buyers around a staffed market, more at a higher level, none without its crew or road', () => {
    const s = emptyGame();
    const m = put(s, 'market', 25, 32);
    const buyers = () => plan(s).filter((o) => o.act === 'buy');
    expect(buyers()).toHaveLength(0);
    hire(s, m);
    expect(buyers()).toHaveLength(2);
    m.level = 3;
    expect(buyers()).toHaveLength(4);
    for (const o of buyers()) {
      expect(standable(s, o.x, o.z, m)).toBe(true);
      const b = s.grid[indexOf(s, Math.floor(o.x), Math.floor(o.z))];
      expect(b === null || b === m).toBe(true);
    }
    m.connected = false;
    expect(buyers()).toHaveLength(0);
  });

  it('sends two olive pickers to the trees near the houses, for the autumn only', () => {
    const s = emptyGame();
    s.feature[indexOf(s, 28, 29)] = 'olive';
    s.feature[indexOf(s, 5, 5)] = 'olive';
    expect(plan(s).filter((o) => o.autumn)).toHaveLength(0);
    put(s, 'house', 25, 28, 2, false, 6);
    const pickers = plan(s).filter((o) => o.autumn);
    expect(pickers.map((o) => o.act).sort()).toEqual(['beat', 'gather']);
    expect(pickers.map((o) => o.load).sort()).toEqual(['basket', 'pole']);
    for (const o of pickers) {
      // Under the tree near the houses (not the far one), facing it.
      expect(Math.hypot(o.x - 28.5, o.z - 29.5)).toBeLessThan(0.9);
      const toTree = Math.atan2(28.5 - o.x, 29.5 - o.z);
      expect(Math.abs(Math.atan2(Math.sin(o.yaw - toTree), Math.cos(o.yaw - toTree)))).toBeLessThan(0.4);
    }
  });

  it('moves each figure a little around its place, kneeling to grind and gather', () => {
    const base = { x: 10, z: 10, yaw: 0, sex: 'f', band: 'adult', k: 0.3, id: null, load: null, show: 0, autumn: false } as const;
    for (const act of ['talk', 'play', 'stand', 'grind', 'buy', 'beat', 'gather'] as const)
      for (const t of [0, 1.3, 7.7, 100]) {
        const p = idlePose({ ...base, act }, t);
        expect(Math.hypot(p.x - 10, p.z - 10)).toBeLessThan(0.2);
        expect(idlePose({ ...base, act }, t)).toEqual(p);
        if (act === 'grind' || act === 'gather') expect(p.y).toBeLessThan(0);
        else expect(p.y).toBeGreaterThanOrEqual(0);
      }
  });
});

describe('a family leaving the town', () => {
  it('walks the people who left the house this week from its door to the entrance', () => {
    const s = emptyGame();
    const tent = put(s, 'house', 25, 30, 1, false, 3);
    const ids = s.people.filter((p) => p.houseId === tent.id).map((p) => p.id);
    expect(leavers(s, tent.x, tent.y)).toHaveLength(0);
    leaveHouse(s, tent.id, 'famine');
    expect(leavers(s, tent.x, tent.y).map((p) => p.id).sort()).toEqual(ids.sort());
    // Weeks later nobody walks out any more.
    s.week += 3;
    expect(leavers(s, tent.x, tent.y)).toHaveLength(0);

    const path = leavePath(s, tent.x, tent.y);
    expect(path[0]).toEqual({ x: tent.x, y: tent.y });
    expect(path.some((c) => c.x === s.entrance.x && c.y === s.entrance.y)).toBe(true);
    // Along the roads, one cell at a time.
    for (const c of path.slice(1, -2)) expect(s.roads[indexOf(s, c.x, c.y)]).toBe(true);
    for (let i = 1; i < path.length; i++) expect(Math.abs(path[i].x - path[i - 1].x) + Math.abs(path[i].y - path[i - 1].y)).toBe(1);
  });

  it('crosses the land when no road leads out', () => {
    const s = emptyGame();
    const path = leavePath(s, 5, 5);
    expect(path[0]).toEqual({ x: 5, y: 5 });
    expect(path[path.length - 1]).toEqual(s.entrance);
  });

  it('ends the walk once the whole group is past the last cell', () => {
    expect(leaveLead(0, 1, 10, 1)).toBe(0);
    expect(leaveLead(5, 1, 10, 1)).toBe(5);
    expect(leaveLead(10.5, 1, 10, 1)).toBe(10.5);
    expect(leaveLead(11.5, 1, 10, 1)).toBeNull();
  });
});

describe('a betrothed couple walking to marry', () => {
  it('holds hands only on the way to the wedding', () => {
    const s = emptyGame();
    const a = person(s, { houseId: null, sex: 'm', age: 22 });
    const b = person(s, { houseId: null, sex: 'f', age: 20 });
    expect(betrothed(s, [a, b])).toBe(false);
    a.spouseId = b.id;
    b.spouseId = a.id;
    a.engaged = b.engaged = s.week;
    expect(betrothed(s, [a, b])).toBe(true);
    expect(betrothed(s, [a, b, person(s, { houseId: null, age: 3 })])).toBe(false);
    // Married already: they walk as a family.
    a.engaged = b.engaged = null;
    expect(betrothed(s, [a, b])).toBe(false);
  });

  it('walks side by side, each reaching the hand toward the other', () => {
    expect(HOLD_SLOTS.map((o) => o.back)).toEqual([0, 0]);
    expect(HOLD_SLOTS[0].side).toBe(-HOLD_SLOTS[1].side);
    expect(HOLD_SLOTS.map(holdLoad).sort()).toEqual(['hold-l', 'hold-r']);
  });
});
