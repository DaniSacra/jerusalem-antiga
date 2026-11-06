import { describe, expect, it } from 'vitest';
import {
  assignJobs,
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
import { besideRiver, constRng, EAST, emptyGame, fill, LIFE_YEAR, person, put, ROADSIDE, westOf } from './helpers';

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

  it('"Sem trabalho" frees the job; the person does not go back the same week, and next week only to a free job', () => {
    const { s, lumber, a } = city();
    expect(setJob(s, a.id, null)).toBe(true);
    expect(a.jobId).toBeNull();
    refreshCity(s);
    expect(a.jobId).toBeNull(); // not the same week
    expect(unemployed(s)).toBe(1);
    stepWeek(s, never);
    expect([lumber.id, s.buildings.find((b) => b.kind === 'fisher')!.id]).toContain(a.jobId); // a free job, next week
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
