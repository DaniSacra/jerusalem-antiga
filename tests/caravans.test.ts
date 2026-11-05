import { describe, expect, it } from 'vitest';
import {
  ageBand,
  ageOf,
  ENGAGED_TEMPLATE,
  moveFamilies,
  pickTemplate,
  createGame,
  createRng,
  foodCapacity,
  household,
  plainEating,
  RULES,
  stepCaravans,
  type GameEvent,
  type GameState,
} from '../src/core';
import { constRng, EAST, emptyGame, put, ROADSIDE } from './helpers';

const C = RULES.caravans;
const SEEDS = Array.from({ length: 60 }, (_, k) => k + 1);

describe('the founding caravan', () => {
  it('3 to 5 families, one per tent of at most 3 people, all of the caravan 0', () => {
    const seen = new Set<number>();
    for (const seed of SEEDS) {
      const s = createGame(createRng(seed));
      const tents = s.buildings.filter((b) => b.kind === 'house');
      expect(tents.length).toBe(s.start.families);
      expect(tents.length).toBeGreaterThanOrEqual(C.start.families[0]);
      expect(tents.length).toBeLessThanOrEqual(C.start.families[1]);
      seen.add(tents.length);
      for (const t of tents) {
        expect(t.level).toBe(1);
        const people = household(s, t.id);
        expect(people.length).toBeGreaterThanOrEqual(2);
        expect(people.length).toBeLessThanOrEqual(RULES.people.templates.reduce((m, x) => Math.max(m, x.members.length), 0));
        expect(people.length).toBeLessThanOrEqual(3);
        // One family name per tent; the husband and wife are married.
        const [man, woman] = people;
        expect([man.sex, woman.sex, man.spouseId, woman.spouseId, man.engaged]).toEqual(['m', 'f', woman.id, man.id, null]);
      }
      expect(s.people.every((p) => p.caravan === 0 && p.houseId !== null)).toBe(true);
    }
    expect([...seen].sort()).toEqual([3, 4, 5]);
  });

  it('the first two families bring a son and a daughter of 18 or 19, engaged (start.couple)', () => {
    for (const seed of SEEDS) {
      const s = createGame(createRng(seed));
      const [a, b] = s.start.couple.map((id) => s.people.find((p) => p.id === id)!);
      expect([a.sex, b.sex]).toEqual(['m', 'f']);
      expect([a.spouseId, b.spouseId]).toEqual([b.id, a.id]);
      expect([a.engaged, b.engaged]).toEqual([0, 0]);
      expect(a.houseId).not.toBe(b.houseId);
      for (const p of [a, b]) {
        expect(ageOf(p, 0)).toBeGreaterThanOrEqual(RULES.people.couple.age[0]);
        expect(ageOf(p, 0)).toBeLessThanOrEqual(RULES.people.couple.age[1]);
        expect(p.fatherId).not.toBeNull();
      }
    }
  });

  it('the other children alternate son and daughter between the families', () => {
    for (const seed of SEEDS) {
      const s = createGame(createRng(seed));
      s.buildings
        .filter((b) => b.kind === 'house')
        .forEach((t, k) => {
          const home = household(s, t.id);
          // The child: a father in the tent and no spouse there (the husband of a grandparent's family has his wife).
          const child = home.find((p) => home.some((o) => o.id === p.fatherId) && !home.some((o) => o.id === p.spouseId));
          if (child) expect(child.sex).toBe(k % 2 === 0 ? 'm' : 'f');
        });
    }
  });

  it('brings 14 to 22 weeks of their eating, never more than the store without a granary; the sentence says the real weeks', () => {
    for (const seed of SEEDS) {
      const s = createGame(createRng(seed));
      const eaten = plainEating(s.people, 0);
      expect(s.food).toBeLessThanOrEqual(RULES.baseFoodStorage);
      expect(s.food).toBeLessThanOrEqual(C.start.foodWeeks[1] * eaten + 1e-9);
      expect(s.start.foodWeeks).toBe(Math.floor(s.food / eaten + 1e-9));
      expect(s.start.foodWeeks).toBeGreaterThanOrEqual(Math.min(C.start.foodWeeks[0], Math.floor(RULES.baseFoodStorage / eaten)));
    }
  });

  it('never brings a young engaged pair: only the couple of start.couple is engaged', () => {
    for (const seed of SEEDS) {
      const s = createGame(createRng(seed));
      expect(s.people.filter((p) => p.engaged !== null).map((p) => p.id).sort()).toEqual([...s.start.couple].sort());
    }
    for (let r = 0; r < 1; r += 0.01) expect(pickTemplate(() => r, false)).not.toBe(ENGAGED_TEMPLATE);
  });

  it('is the same for the same seed', () => {
    expect(JSON.stringify(createGame(createRng(7)))).toBe(JSON.stringify(createGame(createRng(7))));
  });
});

describe('later caravans', () => {
  it('are rolled at the start: weeks in their windows, families, warning weeks; the third comes in about half of the games', () => {
    let third = 0;
    for (const seed of SEEDS) {
      const s = createGame(createRng(seed));
      expect(s.caravans).toHaveLength(C.later.length);
      s.caravans.forEach((c, k) => {
        const def = C.later[k];
        expect(c.week).toBeGreaterThanOrEqual(def.weeks[0]);
        expect(c.week).toBeLessThanOrEqual(def.weeks[1]);
        expect(c.families).toBeGreaterThanOrEqual(def.families[0]);
        expect(c.families).toBeLessThanOrEqual(def.families[1]);
        expect(c.warn).toBeGreaterThanOrEqual(C.warnWeeks[0]);
        expect(c.warn).toBeLessThanOrEqual(C.warnWeeks[1]);
        if (def.chance >= 1) expect(c.status).toBe('planned');
        expect(c.engaged ?? 0).toBe(Math.min(def.engaged ?? 0, c.families));
      });
      if (s.caravans[2].status === 'planned') third++;
    }
    expect(C.later[2].chance).toBe(0.5);
    expect(third).toBeGreaterThan(SEEDS.length * 0.3);
    expect(third).toBeLessThan(SEEDS.length * 0.7);
  });

  /** A city with free houses and a caravan of `families` due at week 20, announced 6 weeks before. */
  function due(families: number, houses: number): GameState {
    const s = emptyGame();
    for (let k = 0; k < houses; k++) put(s, 'house', ROADSIDE, 27 + 2 * k);
    s.caravans = [{ week: 20, families, warn: 6, status: 'planned', housed: 0, left: 0 }];
    return s;
  }

  const step = (s: GameState, week: number, rng = constRng(0.3)) => {
    s.week = week;
    const events: GameEvent[] = [];
    stepCaravans(s, rng, events);
    return events;
  };

  it('is announced warn weeks before it comes', () => {
    const s = due(3, 2);
    expect(step(s, 13)).toEqual([]);
    expect(step(s, 14)).toEqual([{ type: 'caravanAnnounced', families: 3, week: 20 }]);
    expect(s.caravans[0].status).toBe('announced');
    expect(step(s, 15)).toEqual([]);
  });

  it('each family takes an empty house and walks in from the entrance; families without one go on', () => {
    const s = due(3, 2);
    step(s, 14);
    const events = step(s, 20);
    expect(events).toContainEqual({ type: 'caravanArrived', housed: 2, left: 1, x: s.entrance.x, y: s.entrance.y });
    expect(events).toContainEqual({ type: 'milestone', id: 'firstCaravan' });
    expect(s.caravans[0]).toMatchObject({ status: 'arrived', housed: 2, left: 1 });
    expect(s.families).toHaveLength(2);
    for (const f of s.families) expect(f.path[0]).toEqual(s.entrance);
    // Those who stay are on the way (no house yet, caravan 1); those who went on are not recorded.
    expect(s.people.every((p) => p.houseId === null && p.caravan === 1)).toBe(true);
    expect(s.people.length).toBe(s.families.reduce((n, f) => n + f.members.length, 0));
    expect(s.departed).toEqual([]);
  });

  it('takes the empty house with the highest kept level first', () => {
    const s = due(1, 2);
    const kept = s.buildings.filter((b) => b.kind === 'house')[1];
    kept.emptyLevel = 3;
    step(s, 14);
    step(s, 20);
    expect(s.families[0].houseId).toBe(kept.id);
  });

  it('brings 4 to 8 weeks of the eating of those who stay, cut by the store', () => {
    const s = due(2, 2);
    put(s, 'granary', EAST, 36);
    s.food = 0;
    step(s, 14);
    step(s, 20, constRng(0)); // the lowest weeks
    const eaten = plainEating(s.people, 20);
    expect(s.food).toBeCloseTo(C.foodWeeks[0] * eaten, 1);

    const full = due(2, 2);
    full.food = RULES.baseFoodStorage - 1;
    step(full, 14);
    step(full, 20);
    expect(full.food).toBe(foodCapacity(full));
  });

  it('with no empty house every family goes on: no milestone', () => {
    const s = due(2, 0);
    step(s, 14);
    const events = step(s, 20);
    expect(events).toContainEqual({ type: 'caravanArrived', housed: 0, left: 2, x: s.entrance.x, y: s.entrance.y });
    expect(s.milestones).not.toContain('firstCaravan');
    expect(s.people).toEqual([]);
  });

  it('the families come from the templates: a married couple, with a child or the husband\'s parent', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const s = due(1, 1);
      step(s, 14);
      step(s, 20, createRng(seed));
      const [man, woman, third] = s.people;
      expect([man.sex, woman.sex, man.spouseId, woman.spouseId]).toEqual(['m', 'f', woman.id, man.id]);
      if (third) expect(third.fatherId === man.id || man.fatherId === third.id || man.motherId === third.id).toBe(true);
      if (third && man.fatherId !== third.id && man.motherId !== third.id) expect(ageBand(third, s.week)).not.toBe('elder');
    }
  });

  it('the first caravan surely brings two young engaged pairs', () => {
    expect(C.later[0].engaged).toBe(2);
    for (const seed of SEEDS) expect(createGame(createRng(seed)).caravans[0].engaged).toBe(2);
  });

  it('an engaged pair: two youths of two family names, engaged; they take one house and marry there (a wedding of the year)', () => {
    const [lo, hi] = RULES.people.templates[ENGAGED_TEMPLATE].members[0].age;
    for (const seed of SEEDS.slice(0, 10)) {
      const s = due(1, 2);
      s.caravans[0].engaged = 1;
      step(s, 14);
      step(s, 20, createRng(seed));
      const [man, woman] = s.people;
      expect(s.people).toHaveLength(2);
      expect([man.sex, woman.sex, man.spouseId, woman.spouseId, man.engaged, woman.engaged]).toEqual(['m', 'f', woman.id, man.id, 20, 20]);
      expect(man.clan).not.toBe(woman.clan);
      for (const p of [man, woman]) {
        expect(ageOf(p, 20)).toBeGreaterThanOrEqual(lo);
        expect(ageOf(p, 20)).toBeLessThanOrEqual(hi);
        expect(p.fatherId).toBeNull();
      }
      expect(s.families).toHaveLength(1); // one house for the two
      const house = s.families[0].houseId;
      const events: GameEvent[] = [];
      for (let k = 0; k < 20 && s.families.length; k++) moveFamilies(s, events, createRng(seed));
      expect(s.families).toEqual([]);
      expect([man.houseId, woman.houseId, man.engaged, woman.engaged]).toEqual([house, house, null, null]);
      expect(s.yearStats.weddings).toBe(1);
      expect(events).toContainEqual(expect.objectContaining({ type: 'wedding', a: man.id, b: woman.id }));
      expect(events).toContainEqual({ type: 'milestone', id: 'firstWedding' });
    }
  });

  it('only the first `engaged` families are surely engaged pairs; without a house the pair goes on too', () => {
    const s = due(2, 0);
    s.caravans[0].engaged = 1;
    step(s, 14);
    expect(step(s, 20)).toContainEqual({ type: 'caravanArrived', housed: 0, left: 2, x: s.entrance.x, y: s.entrance.y });
    expect(s.people).toEqual([]);
    expect(s.yearStats.weddings).toBe(0);
  });

  it('newcomers restart the debt count of a city in debt (one week, the warning stays)', () => {
    const s = due(1, 1);
    s.debtWeeks = 20;
    step(s, 14);
    step(s, 20);
    expect(s.debtWeeks).toBe(1);
    const none = due(1, 0); // nobody stays: the count goes on
    none.debtWeeks = 20;
    step(none, 14);
    step(none, 20);
    expect(none.debtWeeks).toBe(20);
  });
});
