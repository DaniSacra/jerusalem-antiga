import { describe, expect, it } from 'vitest';
import {
  assignJobs,
  balanceAfter,
  costliestUpkeep,
  crewCounts,
  statOf,
  upkeepPaid,
  BUILDINGS,
  clearCell,
  computeCoverage,
  computeEconomy,
  createGame,
  createRng,
  crewOf,
  foodCapacity,
  gatherFood,
  indexOf,
  jobOptions,
  jobsOf,
  RULES,
  refreshCity,
  setJob,
  stepWeek,
  unemployed,
  type GameState,
} from '../src/core';
import { besideRiver, constRng, EAST, emptyGame, fill, hire, LIFE_YEAR, person, put, ROADSIDE, westOf, restoreAltar } from './helpers';

const never = constRng(0.99);
const jobOf = (s: GameState, id: number) => s.people.find((p) => p.id === id)!.jobId ?? null;

describe('who takes a free job (plan B2)', () => {
  it('free adults fill the jobs by jobPriority (food first), not by the age of the building', () => {
    expect(RULES.jobPriority.slice(0, 3)).toEqual(['fisher', 'gatherer', 'field']);
    const s = emptyGame();
    const lumber = put(s, 'lumber', EAST, 30); // older, but later in the priority
    const fisher = put(s, 'fisher', besideRiver(s, 34), 34);
    const tent = put(s, 'house', ROADSIDE, 27, 1, false, 0);
    const [a] = fill(s, tent, 1);
    refreshCity(s);
    expect(jobOf(s, a.id)).toBe(fisher.id);
    expect(crewOf(s, lumber)).toEqual([]);
  });

  it('among the free adults, the one living nearest takes the job; a tie goes to the lowest id', () => {
    const s = emptyGame();
    const near = put(s, 'house', ROADSIDE, 27, 1, false, 0);
    const far = put(s, 'house', ROADSIDE, 37, 1, false, 0);
    const [f] = fill(s, far, 1);
    const [n1, n2] = fill(s, near, 2);
    put(s, 'lumber', EAST, 27); // 2 jobs, beside the near tent
    expect([jobOf(s, n1.id), jobOf(s, n2.id), jobOf(s, f.id)].map((j) => j !== null)).toEqual([true, true, false]);
    const t = emptyGame();
    const h = put(t, 'house', ROADSIDE, 27, 1, false, 0);
    const [x, y] = fill(t, h, 2);
    put(t, 'fisher', besideRiver(t, 30), 30); // 1 job, both live in the same tent
    expect([jobOf(t, x.id), jobOf(t, y.id)]).toEqual([t.buildings.find((b) => b.kind === 'fisher')!.id, null]);
  });

  it('the game never moves someone who has a job: a new fisher with nobody free stays empty', () => {
    const s = emptyGame();
    const lumber = put(s, 'lumber', EAST, 27);
    put(s, 'house', ROADSIDE, 27, 1, false, 2);
    expect(crewOf(s, lumber)).toHaveLength(2);
    const fisher = put(s, 'fisher', besideRiver(s, 32), 32);
    stepWeek(s, never);
    expect(crewOf(s, lumber)).toHaveLength(2);
    expect(crewOf(s, fisher)).toEqual([]);
    expect(computeEconomy(s).foodMade).toBe(0); // an empty fisher makes nothing
    expect(gatherFood(s, fisher)).toBeGreaterThan(0);
  });

  it('more crew than jobs (a job lost by a change): the newest by id go', () => {
    const s = emptyGame();
    const fisher = put(s, 'fisher', besideRiver(s, 30), 30);
    const tent = put(s, 'house', ROADSIDE, 27, 1, false, 0);
    const [a, b] = fill(s, tent, 2);
    a.jobId = fisher.id;
    b.jobId = fisher.id;
    assignJobs(s);
    expect([a.jobId, b.jobId]).toEqual([fisher.id, null]);
  });

  it('the same seed gives the same jobs', () => {
    const run = () => {
      const s = createGame(createRng(11));
      for (let k = 0; k < 30; k++) stepWeek(s, createRng(100 + k));
      return s.people.map((p) => [p.id, p.jobId ?? null]);
    };
    expect(run()).toEqual(run());
  });
});

describe('losing a job', () => {
  const workplace = () => {
    const s = emptyGame({ food: 1000 });
    const lumber = put(s, 'lumber', EAST, 27);
    const tent = put(s, 'house', ROADSIDE, 27, 1, false, 0);
    const [p] = fill(s, tent, 1);
    refreshCity(s);
    expect(p.jobId).toBe(lumber.id);
    return { s, lumber, tent, p };
  };

  it('at 50 (an elder rests)', () => {
    const { s, p } = workplace();
    p.birthWeek = s.week + 1 - RULES.people.elderAge * LIFE_YEAR; // turns 50 next week
    stepWeek(s, never);
    expect(p.jobId ?? null).toBeNull();
  });

  it('when the person dies or leaves the city', () => {
    const { s, lumber, p } = workplace();
    s.people = s.people.filter((o) => o !== p);
    refreshCity(s);
    expect(crewOf(s, lumber)).toEqual([]);
    const w = workplace();
    w.p.houseId = null; // on the way out
    refreshCity(w.s);
    expect(w.p.jobId ?? null).toBeNull();
  });

  it('when the workplace is demolished or cut off the road; the job is free at once', () => {
    const { s, p } = workplace();
    expect(clearCell(s, EAST, 27).ok).toBe(true);
    expect(p.jobId ?? null).toBeNull();
    const w = emptyGame();
    const far = put(w, 'lumber', EAST, 40);
    const tent = put(w, 'house', ROADSIDE, 27, 1, false, 1);
    const [q] = w.people.filter((o) => o.houseId === tent.id);
    expect(q.jobId).toBe(far.id);
    w.roads[indexOf(w, 24, 39)] = false; // the starting road cut above the lumber
    refreshCity(w);
    expect(far.connected).toBe(false);
    expect(q.jobId ?? null).toBeNull();
  });
});

describe('setJob: the player moves people', () => {
  /** A tent of 2 at the lumber, and a free fisher job. */
  const city = () => {
    const s = emptyGame();
    const lumber = put(s, 'lumber', EAST, 27);
    const tent = put(s, 'house', ROADSIDE, 27, 1, false, 2);
    const fisher = put(s, 'fisher', besideRiver(s, 32), 32);
    const [a, b] = s.people.filter((p) => p.houseId === tent.id);
    return { s, lumber, fisher, tent, a, b };
  };

  it('moves an adult to a connected workplace with a free job, free and at once', () => {
    const { s, fisher, lumber, a } = city();
    const silver = s.silver;
    expect(jobOptions(s, a.id).map((o) => o.buildingId)).toEqual([fisher.id]);
    expect(setJob(s, a.id, fisher.id)).toBe(true);
    expect(a.jobId).toBe(fisher.id);
    expect(crewOf(s, lumber)).toHaveLength(1);
    expect(s.silver).toBe(silver);
    expect(jobOptions(s, a.id).map((o) => o.buildingId)).toEqual([lumber.id]); // its old job is free now
  });

  it('refuses a full or disconnected workplace, a child and an elder; nothing changes', () => {
    const { s, lumber, fisher, tent, a } = city();
    setJob(s, a.id, fisher.id);
    const other = put(s, 'house', ROADSIDE, 31, 1, false, 1);
    const [c] = s.people.filter((p) => p.houseId === other.id);
    expect(setJob(s, c.id, fisher.id)).toBe(false); // full
    const loose = put(s, 'lumber', 2, 2); // no road
    expect(setJob(s, c.id, loose.id)).toBe(false);
    const child = person(s, { houseId: tent.id, age: 5 });
    const elder = person(s, { houseId: tent.id, age: 60 });
    expect(setJob(s, child.id, lumber.id)).toBe(false);
    expect(setJob(s, elder.id, lumber.id)).toBe(false);
    expect(jobOptions(s, child.id)).toEqual([]);
    expect([child.jobId ?? null, elder.jobId ?? null]).toEqual([null, null]);
  });

  it('"Sem trabalho" frees the job and lowers the profession\'s target: the game does not hand it back', () => {
    const { s, lumber, fisher, a } = city();
    const crew = crewOf(s, lumber).length;
    expect(setJob(s, a.id, null)).toBe(true);
    expect(s.jobTargets.lumber).toBe(crew - 1);
    expect(a.jobId).toBe(fisher.id); // free again, the free job of an automatic profession takes them
    stepWeek(s, never);
    expect(crewOf(s, lumber)).toHaveLength(crew - 1);
  });
});

describe('services and crews', () => {
  it('a market covers only while someone works there; an empty granary still stores', () => {
    const s = emptyGame();
    const m = put(s, 'market', westOf('market'), 31);
    expect(computeCoverage(s).market.some(Boolean)).toBe(false);
    put(s, 'house', ROADSIDE, 27, 1, false, 1);
    expect(crewOf(s, m)).toHaveLength(1);
    expect(s.coverage.market.some(Boolean)).toBe(true);
    const t = emptyGame();
    const base = foodCapacity(t);
    const g = put(t, 'granary', EAST, 30);
    expect(crewOf(t, g)).toEqual([]);
    expect(foodCapacity(t)).toBe(base + BUILDINGS.granary.storage!);
  });

  it('unemployed = adults living here without a job; children, elders and people on the way do not count', () => {
    const s = emptyGame();
    const tent = put(s, 'house', ROADSIDE, 27, 1, false, 3);
    person(s, { houseId: tent.id, age: 5 });
    person(s, { houseId: tent.id, age: 60 });
    person(s, { houseId: null, age: 30 });
    expect(unemployed(s)).toBe(3);
    put(s, 'lumber', EAST, 27);
    expect(unemployed(s)).toBe(1);
    const jobs = jobsOf(s);
    expect([...jobs.values()].filter(Boolean)).toHaveLength(2);
  });
});

describe('an empty workplace pays half its upkeep (B2 measured)', () => {
  const half = (k: 'lumber' | 'market' | 'field') => BUILDINGS[k].upkeep! * RULES.emptyUpkeepFactor;

  it('a lumber empty pays half, with 1 of 2 the full upkeep; a market at level 2 the same; off the road too', () => {
    const s = emptyGame();
    const lumber = put(s, 'lumber', EAST, 27);
    expect(upkeepPaid(lumber, crewCounts(s))).toBe(half('lumber'));
    hire(s, lumber, 1);
    expect(upkeepPaid(lumber, crewCounts(s))).toBe(BUILDINGS.lumber.upkeep);
    const m = put(s, 'market', westOf('market'), 31);
    m.level = 2;
    const full = statOf(m, 'upkeep');
    expect(upkeepPaid(m, crewCounts(s))).toBe(full * RULES.emptyUpkeepFactor);
    hire(s, m, 1);
    expect(upkeepPaid(m, crewCounts(s))).toBe(full);
    const loose = put(s, 'lumber', 2, 2);
    expect(loose.connected).toBe(false);
    expect(upkeepPaid(loose, crewCounts(s))).toBe(half('lumber'));
  });

  it('a granary, the plaza and the park pay in full though nobody works there; a field resting in winter with its crew too', () => {
    const s = emptyGame({ week: RULES.weeksPerSeason }); // winter
    for (const [k, x, y] of [['granary', EAST, 27], ['plaza', ROADSIDE, 27], ['park', ROADSIDE, 30]] as const) {
      const b = put(s, k, x, y);
      expect(upkeepPaid(b, crewCounts(s))).toBe(BUILDINGS[k].upkeep);
    }
    const field = put(s, 'field', westOf('field'), 34);
    hire(s, field);
    expect(upkeepPaid(field, crewCounts(s))).toBe(BUILDINGS.field.upkeep);
  });

  it('the economy pays what upkeepPaid says: upkeep by kind, the balance and the costliest', () => {
    const s = emptyGame();
    put(s, 'lumber', EAST, 27);
    put(s, 'market', westOf('market'), 31);
    const e = computeEconomy(s);
    expect(e.upkeep).toEqual({ lumber: half('lumber'), market: half('market') });
    expect(e.silverDelta).toBeCloseTo(-half('lumber') - half('market'));
    expect(costliestUpkeep(e)).toEqual({ kind: 'market', amount: half('market') });
  });

  it('balanceAfter: with free adults a new lumber counts in full; with nobody free, half', () => {
    const s = emptyGame();
    restoreAltar(s); // the tent is content by the altar: plain tax whatever the jobs
    const tent = put(s, 'house', ROADSIDE, 27, 1, false, 0);
    fill(s, tent, 2);
    refreshCity(s);
    const now = computeEconomy(s).silverDelta;
    expect(balanceAfter(s, 'lumber')).toBeCloseTo(now - BUILDINGS.lumber.upkeep!);
    put(s, 'field', EAST, 30); // takes both
    const then = computeEconomy(s).silverDelta;
    expect(balanceAfter(s, 'lumber')).toBeCloseTo(then - half('lumber'));
  });
});
