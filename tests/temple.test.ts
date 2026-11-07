import { describe, expect, it } from 'vitest';
import {
  buildersAtWork,
  checkStartStage,
  createRng,
  GOALS,
  goalProgress,
  HOUSE_LEVELS,
  indexOf,
  nextStage,
  refreshCity,
  RULES,
  seasonOf,
  seatsOf,
  stageIsGoal,
  stageSite,
  stageWeeksLeft,
  startStage,
  stepWeek,
  changeJobTarget,
  crewOf,
  TEMPLE_STAGES,
  templeDone,
  type GameEvent,
  type GameState,
} from '../src/core';
import { constRng, EAST, emptyGame, hire, put, ROAD_X, ROADSIDE } from './helpers';

const never = constRng(0.99);
const TOP = HOUSE_LEVELS.length - 1;
/** Goal index of a stage (from 1). */
const goalOf = (stage: number) => GOALS.findIndex((g) => g.type === 'templeStage' && g.stage === stage);
const stageDef = (stage: number) => TEMPLE_STAGES[stage - 1];

/**
 * A city whose current goal is `stage` (stages before it built), plenty of silver and materials;
 * from stage 2 on the Temple is marked east of the starting road (25..30 x 30..35).
 */
function atStage(stage: number, o: Partial<GameState> = {}) {
  const s = emptyGame({ goalIndex: goalOf(stage), ...o });
  s.temple = { done: stage - 1, active: false, progress: 0 };
  if (stage >= 2) put(s, 'temple', EAST, 30);
  return s;
}

/** Starts the current stage and gives it `n` builders from outside the houses. */
function underWay(stage: number, n = stageDef(stage).builders, o: Partial<GameState> = {}) {
  const s = atStage(stage, o);
  expect(startStage(s)).toEqual({ ok: true });
  const site = stageSite(s)!;
  if (n > 0) hire(s, site, n);
  return { s, site };
}

describe('temple stages data', () => {
  it('five stages: the altar first, then four on the Temple, each with builders and work', () => {
    expect(TEMPLE_STAGES.map((t) => t.site)).toEqual(['altar', 'temple', 'temple', 'temple', 'temple']);
    for (const t of TEMPLE_STAGES) {
      expect(t.builders).toBeGreaterThan(0);
      expect(t.work).toBeGreaterThan(0);
    }
    expect(RULES.jobPriority.slice(-2)).toEqual(['altar', 'temple']); // builders are filled last
  });

  it('nextStage and templeDone follow temple.done', () => {
    const s = emptyGame();
    expect(nextStage(s)).toBe(TEMPLE_STAGES[0]);
    expect(templeDone(s)).toBe(false);
    s.temple.done = TEMPLE_STAGES.length - 1;
    expect(nextStage(s)).toBe(TEMPLE_STAGES.at(-1));
    expect(templeDone(s)).toBe(false);
    s.temple.done = TEMPLE_STAGES.length;
    expect(nextStage(s)).toBeUndefined();
    expect(templeDone(s)).toBe(true);
    expect(stageSite(s)).toBeUndefined();
    expect(checkStartStage(s)).toEqual({ ok: false, reason: 'locked' });
  });

  it('stageSite: the altar for stage 1, the marked Temple after it (none before marking)', () => {
    const s = atStage(1);
    expect(stageSite(s)!.kind).toBe('altar');
    s.temple.done = 1;
    expect(stageSite(s)).toBeUndefined();
    put(s, 'temple', EAST, 30);
    expect(stageSite(s)!.kind).toBe('temple');
  });
});

describe('starting a stage', () => {
  it('only when its goal is the current one', () => {
    const s = atStage(1, { goalIndex: goalOf(1) - 1 });
    expect(stageIsGoal(s)).toBe(false);
    expect(checkStartStage(s)).toEqual({ ok: false, reason: 'locked' });
    const silver = s.silver;
    expect(startStage(s)).toEqual({ ok: false, reason: 'locked' });
    expect(s.silver).toBe(silver);
    expect(s.temple.active).toBe(false);
    s.goalIndex = goalOf(1);
    expect(stageIsGoal(s)).toBe(true);
    expect(checkStartStage(s)).toEqual({ ok: true });
    // The goal of stage 2 is current but stage 1 is not built: not stage 2's turn.
    const t = atStage(2);
    t.temple.done = 0;
    expect(stageIsGoal(t)).toBe(false);
    expect(checkStartStage(t)).toEqual({ ok: false, reason: 'locked' });
  });

  it('pays the silver and materials of the stage at once and opens its builders\' jobs', () => {
    TEMPLE_STAGES.forEach((st, i) => {
      const s = atStage(i + 1);
      const before = { silver: s.silver, stone: s.stone, wood: s.wood };
      const site = stageSite(s)!;
      expect(seatsOf(site)).toBe(0);
      const events: GameEvent[] = [];
      expect(startStage(s, events), st.name).toEqual({ ok: true });
      expect(s.silver).toBe(before.silver - st.cost);
      expect(s.stone).toBe(before.stone - (st.materials.stone ?? 0));
      expect(s.wood).toBe(before.wood - (st.materials.wood ?? 0));
      expect(s.temple).toEqual({ done: i, active: true, progress: 0 });
      expect(site.builders).toBe(st.builders);
      expect(seatsOf(site)).toBe(st.builders);
      expect(events).toEqual([{ type: 'stageStart', stage: i + 1 }]);
      // Under way: it cannot be started (or paid) again.
      expect(startStage(s)).toEqual({ ok: false, reason: 'locked' });
      expect(s.silver).toBe(before.silver - st.cost);
    });
  });

  it('pays with exactly what it costs (edge), and is refused one silver short', () => {
    const st = stageDef(2);
    const s = atStage(2, { silver: st.cost, stone: st.materials.stone ?? 0, wood: st.materials.wood ?? 0 });
    expect(startStage(s)).toEqual({ ok: true });
    expect([s.silver, s.stone, s.wood]).toEqual([0, 0, 0]);
    const short = atStage(2, { silver: st.cost - 1 });
    expect(checkStartStage(short)).toEqual({ ok: false, reason: 'silver' });
  });

  it('is refused without the silver, in debt, without the materials, with nothing marked or off the road', () => {
    const st = stageDef(3);
    const cases: [string, (s: GameState) => void, string][] = [
      ['silver', (s) => (s.silver = st.cost - 1), 'silver'],
      ['debt', (s) => (s.silver = -1), 'debt'],
      ['stone', (s) => (s.stone = (st.materials.stone ?? 0) - 1), 'materials'],
      ['wood', (s) => (s.wood = (st.materials.wood ?? 0) - 1), 'materials'],
      ['no temple', (s) => (s.buildings = s.buildings.filter((b) => b.kind !== 'temple')), 'locked'],
      // The Temple touches only the starting road at x = ROAD_X, y = 30..35: cut it there.
      ['off the road', (s) => { for (let y = 29; y <= 36; y++) s.roads[indexOf(s, ROAD_X, y)] = false; }, 'noRoad'],
    ];
    for (const [name, spoil, reason] of cases) {
      const s = atStage(3);
      spoil(s);
      refreshCity(s);
      const before = { silver: s.silver, stone: s.stone, wood: s.wood };
      expect(checkStartStage(s), name).toEqual({ ok: false, reason });
      expect(startStage(s), name).toEqual({ ok: false, reason });
      expect({ silver: s.silver, stone: s.stone, wood: s.wood }, name).toEqual(before);
      expect(s.temple.active, name).toBe(false);
    }
  });

});

describe('builders', () => {
  it('the site offers jobs only while its stage is under way; free adults take them, last', () => {
    const s = atStage(2);
    const h = put(s, 'house', ROADSIDE, 27, TOP);
    const adults = s.people.filter((p) => p.houseId === h.id).length;
    expect(adults).toBe(HOUSE_LEVELS[TOP].capacity);
    const t = stageSite(s)!;
    expect(buildersAtWork(s)).toBe(0); // not under way: no jobs
    startStage(s);
    expect(buildersAtWork(s)).toBe(Math.min(adults, stageDef(2).builders));
    expect(seatsOf(t)).toBe(stageDef(2).builders);
  });

  it('starting a stage asks for all its builders (a number target), and the target is cleared when it is done', () => {
    const s = atStage(2);
    s.jobTargets.temple = 1;
    startStage(s);
    expect(s.jobTargets.temple).toBe(stageDef(2).builders);
    const a = atStage(1);
    startStage(a);
    expect(a.jobTargets.altar).toBe(stageDef(1).builders);
    const { s: w } = underWay(1);
    w.temple.progress = stageDef(1).work - 0.5;
    stepWeek(w, constRng(0.99));
    expect(w.temple.done).toBe(1);
    expect(w.jobTargets.altar).toBeUndefined();
  });

  it('builders come before the automatic professions: a worker freed by − elsewhere goes to the works', () => {
    const { s, site } = underWay(2);
    const before = buildersAtWork(s);
    const other = s.buildings.find((b) => b.kind !== site.kind && crewOf(s, b).length > 0 && b.kind !== 'house')!;
    if (before < stageDef(2).builders && other) {
      changeJobTarget(s, other.kind, -1);
      expect(buildersAtWork(s)).toBe(before + 1);
    }
  });

  it('an off-road site offers no builders\' jobs', () => {
    const { s, site } = underWay(2);
    expect(buildersAtWork(s)).toBe(stageDef(2).builders);
    for (let y = 29; y <= 36; y++) s.roads[indexOf(s, ROAD_X, y)] = false;
    refreshCity(s);
    expect(site.connected).toBe(false);
    expect(seatsOf(site)).toBe(0);
    expect(buildersAtWork(s)).toBe(0);
  });
});

describe('progress', () => {
  it('adds one per builder at work each week', () => {
    for (const n of [1, 2, stageDef(2).builders]) {
      const { s } = underWay(2, n);
      expect(buildersAtWork(s)).toBe(n);
      stepWeek(s, never);
      expect(s.temple.progress).toBe(n);
      stepWeek(s, never);
      expect(s.temple.progress).toBe(2 * n);
    }
  });

  it('at the same pace in winter', () => {
    const W = RULES.weeksPerSeason;
    const { s } = underWay(3, 3, { week: W });
    expect(seasonOf(s.week)).toBe('winter');
    for (let k = 0; k < 4; k++) stepWeek(s, never);
    expect(seasonOf(s.week)).toBe('winter');
    expect(s.temple.progress).toBe(12);
  });

  it('stops with no builder and loses nothing; resumes where it was', () => {
    const { s, site } = underWay(2, 2);
    stepWeek(s, never);
    stepWeek(s, never);
    expect(s.temple.progress).toBe(4);
    s.jobTargets.temple = 0;
    refreshCity(s);
    expect(buildersAtWork(s)).toBe(0);
    expect(stageWeeksLeft(s)).toBeNull();
    for (let k = 0; k < 10; k++) stepWeek(s, never);
    expect(s.temple).toEqual({ done: 1, active: true, progress: 4 });
    expect(site.builders).toBe(stageDef(2).builders); // the jobs stay open
    delete s.jobTargets.temple;
    refreshCity(s);
    expect(buildersAtWork(s)).toBe(2);
    stepWeek(s, never);
    expect(s.temple.progress).toBe(6);
  });

  it('stageWeeksLeft rounds up the work left at today\'s builders', () => {
    const { s } = underWay(2, 3);
    s.temple.progress = stageDef(2).work - 7;
    expect(stageWeeksLeft(s)).toBe(3);
    expect(stageWeeksLeft(atStage(2))).toBeNull(); // not under way
  });
});

describe('finishing a stage', () => {
  it('is built at its work (not one week before): goal met with its reward, stageDone, jobs closed', () => {
    const st = stageDef(2);
    const { s, site } = underWay(2, 4);
    s.temple.progress = st.work - 4 - 1;
    expect(stepWeek(s, never).some((e) => e.type === 'stageDone')).toBe(false);
    expect(s.temple.progress).toBe(st.work - 1); // one short: not built yet
    const silver = s.silver;
    const events = stepWeek(s, never);
    expect(events).toContainEqual({ type: 'stageDone', stage: 2, x: site.x, y: site.y });
    expect(events).toContainEqual({ type: 'goal', index: goalOf(2), reward: GOALS[goalOf(2)].reward, unlock: undefined });
    expect(s.silver).toBe(silver + GOALS[goalOf(2)].reward);
    expect(s.temple).toEqual({ done: 2, active: false, progress: 0 });
    expect(site.builders).toBeUndefined();
    expect(seatsOf(site)).toBe(0);
    expect(s.people.some((p) => p.jobId === site.id)).toBe(false);
    expect(goalProgress(s, GOALS[goalOf(2)])).toBe(1);
    expect(s.goalIndex).toBe(goalOf(2) + 1);
  });

  it('the altar restored meets goal "Restaure o altar" and frees the altar\'s builders', () => {
    const { s, site } = underWay(1, 2);
    expect(site.kind).toBe('altar');
    s.temple.progress = stageDef(1).work - 2;
    const events = stepWeek(s, never);
    expect(events).toContainEqual({ type: 'stageDone', stage: 1, x: site.x, y: site.y });
    expect(events).toContainEqual(expect.objectContaining({ type: 'goal', index: goalOf(1) }));
    expect(seatsOf(site)).toBe(0);
  });

  it('a milestone reached before still counts at once after the stage', () => {
    const { s } = underWay(2, 4);
    const next = GOALS[goalOf(2) + 1];
    expect(next.type).toBe('milestone');
    s.milestones.push(next.milestone!);
    s.temple.progress = stageDef(2).work - 4;
    expect(stepWeek(s, never)).toContainEqual(expect.objectContaining({ type: 'goal', index: goalOf(2) }));
    expect(stepWeek(s, never)).toContainEqual(expect.objectContaining({ type: 'goal', index: goalOf(2) + 1 }));
  });
});

describe('Consagração', () => {
  it('is the victory, and only then the Temple covers and cheers (with no jobs)', () => {
    const last = TEMPLE_STAGES.length;
    const { s, site } = underWay(last, stageDef(last).builders);
    const near = indexOf(s, EAST + 8, 32);
    expect(s.coverage.sacred[near]).toBe(false);
    let events: GameEvent[] = [];
    for (let k = 0; k < 100 && !s.won; k++) {
      events = stepWeek(s, never);
      if (!s.won) expect(s.coverage.sacred[near]).toBe(false);
    }
    expect(s.won).toBe(true);
    expect(events).toContainEqual(expect.objectContaining({ type: 'stageDone', stage: last }));
    expect(events).toContainEqual(expect.objectContaining({ type: 'victory' }));
    expect(templeDone(s)).toBe(true);
    expect(s.coverage.sacred[near]).toBe(true);
    expect(seatsOf(site)).toBe(0);
  });

  it('every stage, played through from the altar, ends in the victory', () => {
    const s = atStage(1);
    const done: number[] = [];
    for (let stage = 1; stage <= TEMPLE_STAGES.length; stage++) {
      s.goalIndex = goalOf(stage);
      if (stage === 2) put(s, 'temple', EAST, 30);
      expect(startStage(s), `stage ${stage}`).toEqual({ ok: true });
      hire(s, stageSite(s)!);
      for (let k = 0; k < 200 && s.temple.done < stage; k++) {
        for (const e of stepWeek(s, never)) if (e.type === 'stageDone') done.push(e.stage);
      }
      s.people = s.people.filter((p) => p.jobId !== null || p.houseId !== -1);
    }
    expect(done).toEqual([1, 2, 3, 4, 5]);
    expect(s.won).toBe(true);
  });
});

describe('determinism', () => {
  it('the same seed builds the same stage the same way', () => {
    const run = (seed: number) => {
      const s = atStage(2);
      for (const y of [27, 29, 31]) put(s, 'house', ROADSIDE, y, TOP);
      startStage(s);
      const rng = createRng(seed);
      const log: unknown[] = [];
      for (let k = 0; k < 60; k++) log.push(stepWeek(s, rng).filter((e) => e.type === 'stageDone' || e.type === 'goal'), s.temple.progress);
      return JSON.stringify([log, s.temple, s.people.map((p) => p.jobId)]);
    };
    expect(run(11)).toBe(run(11));
    expect(run(42)).toBe(run(42));
  });
});
