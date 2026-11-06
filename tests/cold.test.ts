import { describe, expect, it } from 'vitest';
import {
  alerts,
  coldDeathChance,
  coldDeaths,
  crewOf,
  createRng,
  RULES,
  stepWeek,
  vulnerable,
  type GameEvent,
  type GameState,
} from '../src/core';
import { constRng, EAST, emptyGame, fill, person, put, ROADSIDE } from './helpers';

const W = RULES.weeksPerSeason;
const C = RULES.coldDeath;
const WINTER = W;
const SPRING = 2 * W;

/** A winter city: a tent and a mud-brick house, each with an adult, a 2-year-old and an elder. */
function city(o: { wood: number; food?: number; week?: number }) {
  const s = emptyGame({ week: o.week ?? WINTER, food: o.food ?? 1000 });
  s.wood = o.wood;
  const tent = put(s, 'house', ROADSIDE, 27, 1, false, 0);
  const mud = put(s, 'house', ROADSIDE, 31, 2, false, 0);
  const at = (houseId: number) => ({ adult: fill(s, s.buildings.find((b) => b.id === houseId)!, 1)[0], child: person(s, { houseId, age: 2 }), elder: person(s, { houseId, age: 60 }) });
  const t = at(tent.id);
  const m = at(mud.id);
  s.cold = o.wood <= 0;
  return { s, tent, mud, t, m };
}

describe('cold deaths: the chances (plan B3)', () => {
  it('the vulnerable are children up to childAge and elders', () => {
    const { s, t } = city({ wood: 100 });
    const kid = person(s, { houseId: t.adult.houseId, age: C.childAge });
    const older = person(s, { houseId: t.adult.houseId, age: C.childAge + 1 });
    expect([t.child, kid, t.elder, older, t.adult].map((p) => vulnerable(s, p))).toEqual([true, true, true, false, false]);
  });

  it('a tent with firewood: only the vulnerable; a mud-brick house with firewood: nobody', () => {
    const { s, t, m } = city({ wood: 100 });
    expect([t.child, t.elder, t.adult].map((p) => coldDeathChance(s, p))).toEqual([C.tent[0], C.tent[0], C.tent[1]]);
    expect(C.tent[1]).toBe(0);
    expect([m.child, m.elder, m.adult].map((p) => coldDeathChance(s, p))).toEqual([0, 0, 0]);
  });

  it('without firewood: the table by house, tent worse than mud-brick', () => {
    const { s, t, m } = city({ wood: 0 });
    expect([t.child, t.adult].map((p) => coldDeathChance(s, p))).toEqual(C.tentCold);
    expect([m.child, m.adult].map((p) => coldDeathChance(s, p))).toEqual(C.houseCold);
    expect(C.tentCold[0]).toBeGreaterThan(C.houseCold[0]);
  });

  it('famine with it multiplies the chance by famineFactor', () => {
    const { s, t } = city({ wood: 0 });
    s.famine = true;
    expect(coldDeathChance(s, t.child)).toBeCloseTo(C.tentCold[0] * C.famineFactor);
    expect(coldDeathChance(s, t.adult)).toBeCloseTo(C.tentCold[1] * C.famineFactor);
  });

  it('out of winter nobody dies of cold, and nobody on the way', () => {
    const { s, t } = city({ wood: 0, week: SPRING });
    expect(coldDeathChance(s, t.child)).toBe(0);
    const w = city({ wood: 0 });
    const walker = person(w.s, { houseId: null, age: 2 });
    expect(coldDeathChance(w.s, walker)).toBe(0);
  });
});

describe('cold deaths: what happens', () => {
  it('a draw under the chance kills; the person departs with cause coldDeath, a coldDeath event, winterLoss', () => {
    const { s, t, m } = city({ wood: 100 });
    const events: GameEvent[] = [];
    coldDeaths(s, constRng(C.tent[0] - 0.001), events);
    const dead = s.departed.filter((p) => p.end?.cause === 'coldDeath').map((p) => p.id);
    expect(dead.sort()).toEqual([t.child.id, t.elder.id].sort());
    expect(s.people).toContain(m.child);
    expect(s.winterLoss).toBe(true);
    expect(events).toContainEqual(expect.objectContaining({ type: 'coldDeath', id: t.child.id, age: 2 }));
    expect(s.yearStats.coldDeaths).toBe(2);
    expect(s.yearStats.deaths).toBe(2);
  });

  it('a draw at the chance keeps everyone, and a chance of 0 draws nothing', () => {
    const { s } = city({ wood: 100 });
    let calls = 0;
    coldDeaths(s, () => (calls++, C.tent[0]), []);
    expect(s.departed).toEqual([]);
    expect(calls).toBe(2); // the tent's child and elder; the adult and the mud-brick house draw nothing
  });

  it('the last one in a house leaves it empty; a spouse is widowed and the job is free', () => {
    const s = emptyGame({ week: WINTER, food: 1000 });
    s.wood = 0;
    s.cold = true;
    const tent = put(s, 'house', ROADSIDE, 27, 1, false, 0);
    fill(s, tent, 2);
    const lumber = put(s, 'lumber', EAST, 27);
    expect(crewOf(s, lumber)).toHaveLength(2);
    coldDeaths(s, constRng(0), []);
    expect(s.people.filter((p) => p.houseId === tent.id)).toEqual([]);
    expect(tent.level).toBe(0);
    stepWeek(s, constRng(0.99));
    expect(crewOf(s, lumber)).toEqual([]);
    const w = emptyGame({ week: WINTER, food: 1000 });
    w.wood = 100;
    const t2 = put(w, 'house', ROADSIDE, 27, 1, false, 0);
    const [man, wife] = fill(w, t2, 2);
    const old = Object.assign(man, { birthWeek: w.week - 60 * RULES.people.weeksPerLifeYear - 1 });
    coldDeaths(w, constRng(0), []);
    expect(w.people).not.toContain(old);
    expect(wife.spouseId).toBe(old.id); // a widow
    expect(t2.level).toBe(1);
  });

  it('the first spring tells the winter toll (winterToll), only when someone died', () => {
    const run = (deaths: boolean) => {
      const { s } = city({ wood: 1000, week: SPRING - 1 });
      if (deaths) coldDeaths(s, constRng(0), []);
      return stepWeek(s, constRng(0.99)).filter((e) => e.type === 'winterToll');
    };
    expect(run(true)).toEqual([{ type: 'winterToll', n: 2 }]);
    expect(run(false)).toEqual([]);
  });

  it('the autumn warning names the tents while people live in one', () => {
    const late = WINTER - 1;
    const { s, tent } = city({ wood: 1000, week: late });
    expect(alerts(s)).toContainEqual({ kind: 'winterComing', tents: true });
    for (const p of s.people.filter((p) => p.houseId === tent.id)) p.houseId = null;
    tent.level = 0;
    expect(alerts(s)).toContainEqual({ kind: 'winterComing', tents: false });
  });

  it('the same seed gives the same cold deaths', () => {
    const run = (seed: number): number[] => {
      const s: GameState = emptyGame({ week: WINTER, food: 1000 });
      s.wood = 0;
      for (let k = 0; k < 4; k++) {
        const b = put(s, 'house', ROADSIDE, 27 + 2 * k, 1, false, 0);
        for (let n = 0; n < 3; n++) person(s, { houseId: b.id, age: 2 });
      }
      for (let k = 0; k < W - 1; k++) stepWeek(s, createRng(seed + k));
      return s.departed.filter((p) => p.end?.cause === 'coldDeath').map((p) => p.id);
    };
    expect(run(300).length).toBeGreaterThan(0);
    expect(run(300)).toEqual(run(300));
  });
});
