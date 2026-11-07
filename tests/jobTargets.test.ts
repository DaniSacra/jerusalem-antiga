import { describe, expect, it } from 'vitest';
import {
  assignJobs,
  autoJobs,
  BUILDINGS,
  canWork,
  changeJobTarget,
  clearCell,
  createRng,
  crewOf,
  jobsBuilt,
  RULES,
  seatsOf,
  seatsOfKind,
  setJob,
  statOf,
  stepWeek,
  targetOf,
  upgradeBuilding,
  type Building,
  type BuildingKind,
  type GameState,
  type Person,
} from '../src/core';
import { besideRiver, constRng, EAST, emptyGame, fill, LIFE_YEAR, person, put, ROADSIDE, westOf } from './helpers';

const never = constRng(0.99);
const crewOfKind = (s: GameState, kind: BuildingKind) => s.buildings.filter((b) => b.kind === kind).reduce((a, b) => a + crewOf(s, b).length, 0);
const jobs = (s: GameState) => s.people.map((p) => [p.id, p.jobId ?? null]);

/**
 * The assignment of the game before the Profissões panel (no targets, no quitWeek), written out
 * again: automatic professions must give exactly this.
 */
function oldAssign(s: GameState): void {
  const byId = new Map(s.buildings.map((b) => [b.id, b]));
  const kept = new Map<number, number>();
  for (const p of [...s.people].sort((a, c) => a.id - c.id)) {
    if (p.jobId == null) continue;
    const b = byId.get(p.jobId);
    const n = kept.get(p.jobId) ?? 0;
    if (!canWork(s, p) || !b || n >= seatsOf(b)) p.jobId = null;
    else kept.set(p.jobId, n + 1);
  }
  const free = s.people.filter((p) => p.jobId == null && canWork(s, p));
  const houses = new Map(s.buildings.filter((b) => b.kind === 'house').map((b) => [b.id, b]));
  const dist = (p: Person, b: Building) => {
    const h = p.houseId === null ? undefined : houses.get(p.houseId);
    return h ? Math.abs(h.x - b.x) + Math.abs(h.y - b.y) : Infinity;
  };
  const rank = (k: BuildingKind) => (RULES.jobPriority.indexOf(k) < 0 ? RULES.jobPriority.length : RULES.jobPriority.indexOf(k));
  const places = s.buildings.filter((b) => seatsOf(b) > 0).sort((a, b) => rank(a.kind) - rank(b.kind) || a.id - b.id);
  for (const b of places) {
    for (let n = kept.get(b.id) ?? 0; n < seatsOf(b) && free.length; n++) {
      let best = 0;
      for (let k = 1; k < free.length; k++) {
        const d = dist(free[k], b) - dist(free[best], b);
        if (d < 0 || (d === 0 && free[k].id < free[best].id)) best = k;
      }
      free.splice(best, 1)[0].jobId = b.id;
    }
  }
}

/** A town of many crafts and more adults than jobs: houses on the west of the road, workplaces on the east. */
function town() {
  const s = emptyGame({ food: 100_000 });
  const lumber = put(s, 'lumber', EAST, 27);
  const lumber2 = put(s, 'lumber', EAST, 29);
  const workshop = put(s, 'workshop', EAST, 31);
  const market = put(s, 'market', EAST, 34);
  const fisher = put(s, 'fisher', besideRiver(s, 40), 40);
  const field = put(s, 'field', westOf('field'), 41);
  const houses = [27, 29, 31, 33, 35, 37].map((y) => put(s, 'house', ROADSIDE, y, 1, false, 4));
  return { s, lumber, lumber2, workshop, market, fisher, field, houses };
}

describe('profession targets: automatic is the game before the panel (plan 1.1.8)', () => {
  it('a seeded city with every job scrambled gets the same assignment as the old rule, again and again', () => {
    const { s } = town();
    expect(s.jobTargets).toEqual({});
    const rng = createRng(42);
    for (let round = 0; round < 25; round++) {
      // scramble: free some, put some on a random building (also full or wrong ones)
      for (const p of s.people) {
        const r = rng();
        if (r < 0.3) p.jobId = null;
        else if (r < 0.5) p.jobId = s.buildings[Math.floor(rng() * s.buildings.length)].id;
      }
      const a = structuredClone(s);
      const b = structuredClone(s);
      oldAssign(a);
      assignJobs(b);
      expect(jobs(b)).toEqual(jobs(a));
      assignJobs(s);
    }
  });

  it('a seeded game run week by week matches the old rule each week', () => {
    const { s } = town();
    for (let w = 0; w < 30; w++) {
      stepWeek(s, createRng(500 + w));
      const old = structuredClone(s);
      for (const p of old.people) if (p.id % 3 === w % 3) p.jobId = null;
      const now = structuredClone(old);
      oldAssign(old);
      assignJobs(now);
      expect(jobs(now)).toEqual(jobs(old));
    }
  });

  it('targetOf: automatic is every connected job; a number is capped by them', () => {
    const { s } = town();
    expect(targetOf(s, 'lumber')).toBe(4);
    expect(seatsOfKind(s, 'lumber')).toBe(4);
    expect(jobsBuilt(s, 'lumber')).toBe(4);
    s.jobTargets.lumber = 99;
    expect(targetOf(s, 'lumber')).toBe(4); // a target above the jobs is cut
    s.jobTargets.lumber = 1;
    expect(targetOf(s, 'lumber')).toBe(1);
    expect(targetOf(s, 'quarry')).toBe(0); // nothing built
  });

  it('a target above the jobs fills every job and no more', () => {
    const { s } = town();
    s.jobTargets.lumber = 10;
    assignJobs(s);
    expect(crewOfKind(s, 'lumber')).toBe(4);
  });
});

describe('profession targets: − and + (plan 1.1.4)', () => {
  /** A lumber (2 jobs) beside a near tent, a far tent, nobody else working. */
  const camp = () => {
    const s = emptyGame();
    const lumber = put(s, 'lumber', EAST, 27);
    const near = put(s, 'house', ROADSIDE, 27, 1, false, 0);
    const mid = put(s, 'house', ROADSIDE, 33, 1, false, 0);
    const far = put(s, 'house', ROADSIDE, 39, 1, false, 0);
    const [f] = fill(s, far, 1);
    const [m] = fill(s, mid, 1);
    const [n] = fill(s, near, 1);
    assignJobs(s);
    return { s, lumber, near, mid, far, f, m, n };
  };

  it('− frees the worker living farthest at once and the target becomes a number', () => {
    const { s, lumber, f, m, n } = camp();
    // the two nearest work, the farthest is free
    expect([n.jobId, m.jobId, f.jobId ?? null]).toEqual([lumber.id, lumber.id, null]);
    expect(changeJobTarget(s, 'lumber', -1)).toBe(true);
    expect(s.jobTargets.lumber).toBe(1);
    expect([n.jobId, m.jobId ?? null]).toEqual([lumber.id, null]); // the farther of the two goes
    expect(f.jobId ?? null).toBeNull(); // nobody takes the freed job
    stepWeek(s, never);
    expect(crewOf(s, lumber).map((p) => p.id)).toEqual([n.id]);
  });

  it('− on a tie of distance frees the higher id', () => {
    const s = emptyGame();
    const lumber = put(s, 'lumber', EAST, 27);
    const [a, b] = fill(s, put(s, 'house', ROADSIDE, 27, 1, false, 0), 2);
    assignJobs(s);
    expect(crewOf(s, lumber).map((p) => p.id)).toEqual([a.id, b.id]);
    changeJobTarget(s, 'lumber', -1);
    expect(crewOf(s, lumber).map((p) => p.id)).toEqual([a.id]);
  });

  it('− goes down to 0 and no further; − on an automatic kind with nobody fixes it at 0', () => {
    const { s, lumber } = camp();
    expect(changeJobTarget(s, 'lumber', -1)).toBe(true);
    expect(changeJobTarget(s, 'lumber', -1)).toBe(true);
    expect(s.jobTargets.lumber).toBe(0);
    expect(crewOf(s, lumber)).toEqual([]);
    expect(changeJobTarget(s, 'lumber', -1)).toBe(false);
    expect(s.jobTargets.lumber).toBe(0);
    const t = emptyGame();
    put(t, 'lumber', EAST, 27);
    expect(changeJobTarget(t, 'lumber', -1)).toBe(true); // automatic -> 0
    expect(t.jobTargets.lumber).toBe(0);
    expect(changeJobTarget(t, 'lumber', -1)).toBe(false);
  });

  it('+ pulls the nearest free adult at once; + on an automatic kind changes nothing', () => {
    const { s, lumber, f, m, n } = camp();
    expect(changeJobTarget(s, 'lumber', 1)).toBe(false); // automatic already wants every job
    s.jobTargets.lumber = 0;
    assignJobs(s);
    expect(crewOf(s, lumber)).toEqual([]);
    expect(changeJobTarget(s, 'lumber', 1)).toBe(true);
    expect(s.jobTargets.lumber).toBe(1);
    expect(crewOf(s, lumber).map((p) => p.id)).toEqual([n.id]);
    expect(changeJobTarget(s, 'lumber', 1)).toBe(true);
    expect(crewOf(s, lumber).map((p) => p.id).sort()).toEqual([m.id, n.id].sort());
    expect(f.jobId ?? null).toBeNull();
  });

  it('+ stops at the jobs built (a target above the jobs is capped)', () => {
    const { s } = camp();
    s.jobTargets.lumber = 1;
    expect(changeJobTarget(s, 'lumber', 1)).toBe(true);
    expect(changeJobTarget(s, 'lumber', 1)).toBe(false);
    expect(s.jobTargets.lumber).toBe(2);
  });

  it('+ with nobody free keeps the target, and the next free adult fills it', () => {
    const s = emptyGame();
    const lumber = put(s, 'lumber', EAST, 27);
    s.jobTargets.lumber = 0;
    expect(changeJobTarget(s, 'lumber', 1)).toBe(true);
    expect(crewOf(s, lumber)).toEqual([]);
    fill(s, put(s, 'house', ROADSIDE, 27, 1, false, 0), 1);
    assignJobs(s);
    expect(crewOf(s, lumber)).toHaveLength(1);
  });

  it('a target keeps others away from the kind but never moves workers of other kinds into it', () => {
    const { s } = town();
    s.jobTargets.lumber = 0;
    assignJobs(s);
    expect(crewOfKind(s, 'lumber')).toBe(0);
    const before = jobs(s);
    s.jobTargets.lumber = 4;
    assignJobs(s);
    // only free adults were pulled: everyone who had a job still has the same one
    const after = new Map(jobs(s) as [number, number | null][]);
    for (const [id, job] of before as [number, number | null][]) if (job !== null) expect(after.get(id)).toBe(job);
  });
});

describe('profession targets follow the buildings (plan 1.1.6)', () => {
  it('building a workplace of a kind with a number adds its jobs to the target; automatic stays automatic', () => {
    const s = emptyGame();
    fill(s, put(s, 'house', ROADSIDE, 27, 1, false, 0), 3);
    put(s, 'lumber', EAST, 27);
    s.jobTargets.lumber = 1;
    assignJobs(s);
    const second = put(s, 'lumber', EAST, 29);
    expect(s.jobTargets.lumber).toBe(1 + BUILDINGS.lumber.jobs);
    expect(crewOfKind(s, 'lumber')).toBe(3); // the new jobs fill at once
    expect(crewOf(s, second).length).toBeGreaterThan(0);
    put(s, 'workshop', EAST, 31);
    expect(s.jobTargets.workshop).toBeUndefined();
  });

  it('demolishing cuts the target to the jobs left; a lower target stays', () => {
    const s = emptyGame();
    put(s, 'lumber', EAST, 27);
    put(s, 'lumber', EAST, 29);
    s.jobTargets.lumber = 3;
    expect(clearCell(s, EAST, 29).ok).toBe(true);
    expect(s.jobTargets.lumber).toBe(2);
    s.jobTargets.lumber = 1;
    put(s, 'lumber', EAST, 29); // 1 + 2
    expect(s.jobTargets.lumber).toBe(3);
    clearCell(s, EAST, 27);
    expect(s.jobTargets.lumber).toBe(2);
    clearCell(s, EAST, 29);
    expect(s.jobTargets.lumber).toBe(0);
    put(s, 'workshop', EAST, 31);
    clearCell(s, EAST, 31);
    expect(s.jobTargets.workshop).toBeUndefined(); // automatic stays automatic
  });

  it('an upgrade adds the extra jobs of the new level to a number target (none when the level adds none)', () => {
    const s = emptyGame();
    const w = put(s, 'workshop', EAST, 31);
    s.jobTargets.workshop = 1;
    const level = BUILDINGS.workshop.levels![0] as unknown as Record<string, unknown>;
    const had = 'jobs' in level;
    try {
      expect(upgradeBuilding(s, EAST, 31).ok).toBe(true);
      expect(s.jobTargets.workshop).toBe(1 + statOf(w, 'jobs') - BUILDINGS.workshop.jobs);
      // a level with more jobs (none in the data today): the extra jobs join the target
      const t = emptyGame();
      const v = put(t, 'workshop', EAST, 31);
      t.jobTargets.workshop = 1;
      level.jobs = BUILDINGS.workshop.jobs + 2;
      expect(upgradeBuilding(t, EAST, 31).ok).toBe(true);
      expect(statOf(v, 'jobs')).toBe(BUILDINGS.workshop.jobs + 2);
      expect(t.jobTargets.workshop).toBe(3);
      const u = emptyGame();
      put(u, 'workshop', EAST, 31);
      expect(upgradeBuilding(u, EAST, 31).ok).toBe(true);
      expect(u.jobTargets.workshop).toBeUndefined();
    } finally {
      if (!had) delete level.jobs;
    }
  });
});

describe('profession targets and the player moving people (plan 1.1.7)', () => {
  /** Two lumbers' worth of jobs and a workshop; 4 adults, all at work. */
  const city = () => {
    const s = emptyGame();
    const lumber = put(s, 'lumber', EAST, 27);
    const workshop = put(s, 'workshop', EAST, 31);
    const tent = put(s, 'house', ROADSIDE, 27, 1, false, 0);
    const people = fill(s, tent, 4);
    assignJobs(s);
    return { s, lumber, workshop, people };
  };

  it('"Mudar" from a number to a number lowers one and raises the other', () => {
    const { s, lumber, workshop } = city();
    s.jobTargets.lumber = 2;
    s.jobTargets.workshop = 2;
    assignJobs(s);
    const [a] = crewOf(s, lumber);
    expect(setJob(s, a.id, workshop.id)).toBe(true);
    expect(s.jobTargets).toEqual({ lumber: 1, workshop: 3 });
    expect(crewOfKind(s, 'lumber')).toBe(1);
    expect(crewOfKind(s, 'workshop')).toBe(3);
    stepWeek(s, never);
    expect(a.jobId).toBe(workshop.id); // the game does not undo the move
    expect(crewOfKind(s, 'lumber')).toBe(1);
  });

  it('"Mudar" into a profession short of its target fills it without raising the target', () => {
    const { s, lumber, workshop } = city();
    s.jobTargets.lumber = 1;
    s.jobTargets.workshop = 3;
    assignJobs(s);
    s.jobTargets.lumber = 2; // "falta 1": nobody free took the job
    expect(crewOfKind(s, 'lumber')).toBe(1);
    const [w] = crewOf(s, workshop);
    expect(setJob(s, w.id, lumber.id)).toBe(true);
    expect(s.jobTargets.lumber).toBe(2);
    expect(s.jobTargets.workshop).toBe(2);
    expect(crewOfKind(s, 'lumber')).toBe(2);
  });

  it('"Mudar" from an automatic kind leaves it automatic: its job goes to someone free', () => {
    const { s, lumber, workshop, people } = city();
    s.jobTargets.workshop = crewOf(s, workshop).length; // 2 of 3 jobs
    const extra = fill(s, put(s, 'house', ROADSIDE, 37, 1, false, 0), 1)[0];
    assignJobs(s);
    expect(extra.jobId ?? null).toBeNull(); // the lumber is full, the workshop at its target
    const [a] = crewOf(s, lumber);
    expect(people).toContain(a);
    expect(setJob(s, a.id, workshop.id)).toBe(true);
    expect(s.jobTargets.lumber).toBeUndefined();
    expect(crewOf(s, lumber).map((p) => p.id)).toContain(extra.id);
  });

  it('"Sem trabalho" from an automatic kind sets it to a number one below its crew', () => {
    const { s, lumber } = city();
    const crew = crewOf(s, lumber);
    expect(crew).toHaveLength(2);
    expect(setJob(s, crew[0].id, null)).toBe(true);
    expect(s.jobTargets.lumber).toBe(1);
    expect(crewOf(s, lumber).map((p) => p.id)).toEqual([crew[1].id]);
    stepWeek(s, never);
    expect(crewOf(s, lumber)).toHaveLength(1);
  });

  it('Automático clears every target and refills the jobs', () => {
    const { s, lumber, workshop } = city();
    changeJobTarget(s, 'lumber', -1); // the freed worker takes the free job of the automatic workshop
    expect([crewOfKind(s, 'lumber'), crewOfKind(s, 'workshop')]).toEqual([1, 3]);
    changeJobTarget(s, 'workshop', -1);
    changeJobTarget(s, 'workshop', -1);
    expect([crewOfKind(s, 'lumber'), crewOfKind(s, 'workshop')]).toEqual([1, 1]);
    autoJobs(s);
    expect(s.jobTargets).toEqual({});
    expect(crewOf(s, lumber)).toHaveLength(2);
    expect(crewOf(s, workshop)).toHaveLength(2);
  });
});

describe('profession targets over time', () => {
  it('a youth turning adult fills an open target', () => {
    const s = emptyGame({ food: 1000 });
    const lumber = put(s, 'lumber', EAST, 27);
    const tent = put(s, 'house', ROADSIDE, 27, 1, false, 0);
    const [adult] = fill(s, tent, 1);
    s.jobTargets.lumber = 2; // one job open, nobody free
    assignJobs(s);
    expect(crewOf(s, lumber).map((p) => p.id)).toEqual([adult.id]);
    const youth = person(s, { houseId: tent.id, age: 13 });
    youth.birthWeek = s.week + 1 - RULES.people.adultAge * LIFE_YEAR; // adult next week
    assignJobs(s);
    expect(youth.jobId ?? null).toBeNull();
    stepWeek(s, never);
    expect(youth.jobId).toBe(lumber.id);
  });

  it('a target of 0 keeps a new adult out of that kind', () => {
    const s = emptyGame({ food: 1000 });
    const lumber = put(s, 'lumber', EAST, 27);
    s.jobTargets.lumber = 0;
    fill(s, put(s, 'house', ROADSIDE, 27, 1, false, 0), 2);
    stepWeek(s, never);
    expect(crewOf(s, lumber)).toEqual([]);
  });

  it('the same seed with the same targets gives the same jobs', () => {
    const run = () => {
      const { s } = town();
      s.jobTargets.lumber = 1;
      s.jobTargets.market = 2;
      for (let w = 0; w < 40; w++) {
        stepWeek(s, createRng(900 + w));
        if (w === 10) changeJobTarget(s, 'workshop', -1);
        if (w === 20) changeJobTarget(s, 'lumber', 1);
      }
      return { jobs: jobs(s), targets: s.jobTargets };
    };
    const a = run();
    expect(a).toEqual(run());
    expect(a.targets).toEqual({ lumber: 2, market: 2, workshop: 2 });
  });
});
