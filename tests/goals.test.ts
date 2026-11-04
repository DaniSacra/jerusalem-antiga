import { describe, expect, it } from 'vitest';
import {
  checkGoal,
  computeEconomy,
  currentGoal,
  foodPerResident,
  goalOpen,
  goalProgress,
  goalTarget,
  GOALS,
  HOUSE_LEVELS,
  indexOf,
  RULES,
  stepWeek,
  unlockingGoal,
  WEEKS_PER_YEAR,
  yearOf,
  type GameEvent,
  type GameState,
  type GoalDef,
} from '../src/core';
import { besideRiver, constRng, EAST, emptyGame, put, ROADSIDE } from './helpers';

const W = RULES.weeksPerSeason;
const SPRING = 2 * W;
const TOP = HOUSE_LEVELS.length - 1;
const goalEvent = (index: number) => ({ type: 'goal', index, reward: GOALS[index].reward, unlock: GOALS[index].unlock });

/** `n` more big houses on free cells north-west of the altar (they count as residents even unconnected). */
function bigHouses(s: GameState, n: number) {
  for (let y = 0; y <= 18 && n > 0; y += 2) {
    for (let x = 0; x <= 18 && n > 0; x += 2) {
      if (s.grid[indexOf(s, x, y)]) continue;
      put(s, 'house', x, y, TOP);
      n--;
    }
  }
  if (n > 0) throw new Error('no room');
}

describe('goals', () => {
  it('has the configured targets, rewards, unlocks and years in order', () => {
    expect(GOALS.map((g) => [g.type, g.target, g.level ?? g.kind ?? null, g.reward, g.unlock ?? null, g.fromYear ?? null])).toEqual([
      ['foodUntilSpring', 1, null, 30, 'granary', null],
      ['houses', 3, 2, 40, null, null],
      ['residents', 60, null, 50, 'market', null],
      ['houses', 3, 3, 60, 'workshop', null],
      ['residents', 150, null, 80, 'garden', null],
      ['houses', 2, 4, 100, null, null],
      ['residents', 250, null, 120, null, null],
      ['houses', 6, 4, 150, null, null],
      ['residents', 500, null, 200, 'temple', 8],
      ['build', 1, 'temple', 0, null, null],
    ]);
    expect(GOALS.at(-1)!.victory).toBe(true);
    expect(GOALS.filter((g) => g.victory)).toHaveLength(1);
  });

  it('the goals file uses no harvest or water goal any more', () => {
    expect(GOALS.some((g) => (g.type as string) === 'harvest')).toBe(false);
    expect(GOALS.some((g) => g.type === 'water')).toBe(false);
  });

  it('knows which goal unlocks each placeable', () => {
    expect(unlockingGoal('granary')).toBe(1);
    expect(unlockingGoal('market')).toBe(3);
    expect(unlockingGoal('workshop')).toBe(4);
    expect(unlockingGoal('garden')).toBe(5);
    expect(unlockingGoal('temple')).toBe(9);
    for (const k of RULES.startUnlocked) expect(unlockingGoal(k)).toBeNull();
    GOALS.forEach((g, i) => {
      if (g.unlock) expect(unlockingGoal(g.unlock)).toBe(i + 1);
    });
  });

  it('goal 1: food that lasts until the first spring, rewards and unlocks the granary', () => {
    const s = emptyGame({ silver: 0, goalIndex: 0, food: 10, unlocked: [...RULES.startUnlocked] });
    put(s, 'house', ROADSIDE, 27, 1);
    const eat = (w: number) => HOUSE_LEVELS[1].residents * foodPerResident(1, w);
    let left = 10;
    let weeks = 0;
    while ((left = Math.round((left - eat(weeks)) * 100) / 100) > 0) weeks++;
    expect(weeks).toBeLessThan(SPRING);
    const events: GameEvent[] = [];
    checkGoal(s, events);
    expect(events).toEqual([]);
    expect(goalProgress(s, GOALS[0])).toBe(weeks);
    expect(goalTarget(s, GOALS[0])).toBe(SPRING);
    let need = 0;
    for (let w = 0; w < SPRING; w++) need += eat(w); // the winter weeks eat more
    s.food = Math.ceil(need) + 1;
    checkGoal(s, events);
    expect(events).toEqual([goalEvent(0)]);
    expect(GOALS[0].unlock).toBe('granary');
    expect(s.unlocked).toContain('granary');
    expect(s.silver).toBe(GOALS[0].reward);
    expect(currentGoal(s)).toBe(GOALS[1]);
  });

  it('goal 1 is not met by an empty city (everyone left)', () => {
    const s = emptyGame({ goalIndex: 0, food: 40, unlocked: [...RULES.startUnlocked] });
    expect(goalProgress(s, GOALS[0])).toBe(0);
    const events: GameEvent[] = [];
    checkGoal(s, events);
    expect(events).toEqual([]);
  });

  it('goal 1 also counts the fisher food', () => {
    const s = emptyGame({ goalIndex: 0, food: 10 });
    put(s, 'house', ROADSIDE, 27, 2);
    const before = goalProgress(s, GOALS[0]);
    const f = put(s, 'fisher', besideRiver(s, 30), 30);
    expect(f.connected).toBe(true);
    expect(goalProgress(s, GOALS[0])).toBeGreaterThan(before);
  });

  it('every "houses" goal counts connected houses of its level or better', () => {
    GOALS.forEach((goal, i) => {
      if (goal.type !== 'houses') return;
      const level = goal.level!;
      const s = emptyGame({ goalIndex: i, silver: 0 });
      for (let k = 0; k < goal.target - 1; k++) put(s, 'house', ROADSIDE, 27 + 2 * k, level);
      put(s, 'house', ROADSIDE, 27 + 2 * (goal.target - 1), level - 1); // one level short
      put(s, 'house', 1, 1, TOP); // a disconnected house does not count
      const events: GameEvent[] = [];
      checkGoal(s, events);
      expect(events, `goal ${i + 1}`).toEqual([]);
      expect(goalProgress(s, goal)).toBe(goal.target - 1);
      put(s, 'house', EAST, 27, Math.min(TOP, level + 1)); // a better house counts too
      checkGoal(s, events);
      expect(events[0], `goal ${i + 1}`).toEqual(goalEvent(i));
      expect(s.silver).toBe(goal.reward);
      if (goal.unlock) expect(s.unlocked).toContain(goal.unlock);
    });
  });

  it('every "residents" goal needs its target of residents (from its year on)', () => {
    GOALS.forEach((goal, i) => {
      if (goal.type !== 'residents') return;
      const week = ((goal.fromYear ?? 1) - 1) * WEEKS_PER_YEAR;
      const s = emptyGame({ goalIndex: i, silver: 0, week, unlocked: ['road', 'house'] });
      const n = Math.ceil(goal.target / HOUSE_LEVELS[TOP].residents);
      bigHouses(s, n - 1);
      expect(computeEconomy(s).residents).toBeLessThan(goal.target);
      const events: GameEvent[] = [];
      checkGoal(s, events);
      expect(events, `goal ${i + 1}`).toEqual([]);
      bigHouses(s, 1);
      expect(computeEconomy(s).residents).toBeGreaterThanOrEqual(goal.target);
      checkGoal(s, events);
      expect(events[0], `goal ${i + 1}`).toEqual(goalEvent(i));
      if (goal.unlock) expect(s.unlocked).toContain(goal.unlock);
    });
  });

  it('declares victory when the temple is built, with weeks and residents', () => {
    const s = emptyGame({ goalIndex: GOALS.length - 1, week: 41 });
    put(s, 'house', ROADSIDE, 27, TOP);
    expect(stepWeek(s, constRng(0.99))).not.toContainEqual(expect.objectContaining({ type: 'victory' }));
    put(s, 'temple', EAST, 30);
    expect(stepWeek(s, constRng(0.99))).toContainEqual({ type: 'victory', week: 43, residents: HOUSE_LEVELS[TOP].residents });
    expect(s.won).toBe(true);
    expect(currentGoal(s)).toBeUndefined();
  });

  it('completes one goal per check, even when the next one is already met', () => {
    // Three big houses meet "3 mud-brick houses", "60 residents" and "3 stone houses" at once.
    const s = emptyGame({ goalIndex: 1 });
    for (const y of [27, 29, 31]) put(s, 'house', ROADSIDE, y, TOP);
    const events: GameEvent[] = [];
    checkGoal(s, events);
    expect(s.goalIndex).toBe(2);
    checkGoal(s, events);
    expect(s.goalIndex).toBe(3);
    checkGoal(s, events);
    expect(s.goalIndex).toBe(4);
    expect(events.filter((e) => e.type === 'goal').map((e) => e.type === 'goal' && e.index)).toEqual([1, 2, 3]);
  });
});

describe('goals that wait for their year (fromYear)', () => {
  const i = GOALS.findIndex((g) => g.fromYear);
  const goal = GOALS[i];
  const opens = (goal.fromYear! - 1) * WEEKS_PER_YEAR; // first week of that year

  it('yearOf counts years from 1, one every WEEKS_PER_YEAR weeks', () => {
    expect(yearOf(0)).toBe(1);
    expect(yearOf(WEEKS_PER_YEAR - 1)).toBe(1);
    expect(yearOf(WEEKS_PER_YEAR)).toBe(2);
    expect(yearOf(7 * WEEKS_PER_YEAR)).toBe(8);
  });

  it('goal 9 (the temple) waits for the Year 8, even with the residents long reached', () => {
    expect(goal.unlock).toBe('temple');
    expect(goal.fromYear).toBe(8);
    const s = emptyGame({ goalIndex: i, silver: 0, unlocked: ['road', 'house'], week: 0 });
    bigHouses(s, Math.ceil(goal.target / HOUSE_LEVELS[TOP].residents));
    expect(goalProgress(s, goal)).toBeGreaterThanOrEqual(goalTarget(s, goal));
    const events: GameEvent[] = [];
    for (const week of [0, WEEKS_PER_YEAR, opens - 1]) {
      s.week = week;
      expect(goalOpen(s, goal), `week ${week}`).toBe(false);
      checkGoal(s, events);
    }
    expect(events).toEqual([]);
    expect(s.unlocked).not.toContain('temple');
    s.week = opens;
    expect(goalOpen(s, goal)).toBe(true);
    checkGoal(s, events);
    expect(events).toEqual([goalEvent(i)]);
    expect(s.unlocked).toContain('temple');
  });

  it('in stepWeek the goal is done the week the Year 8 begins', () => {
    const s = emptyGame({ goalIndex: i, silver: 0, unlocked: ['road', 'house'], week: opens - 2, food: 1000 });
    bigHouses(s, Math.ceil(goal.target / HOUSE_LEVELS[TOP].residents));
    const never = constRng(0.99);
    expect(stepWeek(s, never).some((e) => e.type === 'goal')).toBe(false); // to the last week of Year 7
    expect(stepWeek(s, never)).toContainEqual(goalEvent(i)); // to the first week of Year 8
    expect(yearOf(s.week)).toBe(goal.fromYear);
  });

  it('goals without fromYear are open from the first week', () => {
    const s = emptyGame({ week: 0 });
    for (const g of GOALS) if (!g.fromYear) expect(goalOpen(s, g)).toBe(true);
  });
});

describe('water goal (kept in the code until the water package)', () => {
  const water: GoalDef = { type: 'water', target: 4, reward: 30, text: '' };

  it('counts houses with a family and water, out of every such house (at least the target)', () => {
    const s = emptyGame();
    put(s, 'well', EAST, 27);
    for (const y of [27, 29, 31]) put(s, 'house', ROADSIDE, y, 1);
    put(s, 'house', ROADSIDE, 33); // a plot does not count
    expect(goalProgress(s, water)).toBe(3);
    expect(goalTarget(s, water)).toBe(4);
    put(s, 'house', ROADSIDE, 41, 1); // far from the well
    put(s, 'house', ROADSIDE, 43, 1);
    expect(goalTarget(s, water)).toBe(5);
    expect(goalProgress(s, water)).toBe(3);
    put(s, 'well', EAST, 41);
    expect(goalProgress(s, water)).toBe(5);
  });
});
