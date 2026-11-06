import { describe, expect, it } from 'vitest';
import {
  checkGoal,
  computeEconomy,
  createGame,
  createRng,
  foodCapacity,
  currentGoal,
  foodOf,
  goalOpen,
  goalProgress,
  goalTarget,
  GOALS,
  HOUSE_LEVELS,
  indexOf,
  RULES,
  stepWeek,
  TEMPLE_GOAL,
  templeWaitsForGoal,
  unlockingGoal,
  WEEKS_PER_YEAR,
  yearOf,
  type GameEvent,
  type GameState,
} from '../src/core';
import { besideRiver, constRng, EAST, emptyGame, person, put, ROAD_X, ROADSIDE } from './helpers';

const W = RULES.weeksPerSeason;
const SPRING = 2 * W;
const TOP = HOUSE_LEVELS.length - 1;
/** Index of the food-until-spring goal (goal 1). */
const FOOD = GOALS.findIndex((g) => g.type === 'foodUntilSpring');
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
  it('has the configured targets, rewards, unlocks and milestones in order', () => {
    expect(GOALS.map((g) => [g.type, g.target, g.level ?? g.kind ?? g.milestone ?? null, g.reward, g.unlock ?? null])).toEqual([
      ['foodUntilSpring', 1, null, 30, 'granary'],
      ['milestone', 1, 'firstWedding', 20, null],
      ['milestone', 1, 'firstBirth', 40, null],
      ['milestone', 1, 'firstSpring', 30, 'quarry'],
      ['houses', 5, 2, 40, 'plaza'],
      ['milestone', 1, 'firstCaravan', 50, 'workshop'],
      ['build', 1, 'workshop', 40, 'market'],
      ['residents', 30, null, 50, null],
      ['houses', 6, 3, 60, 'park'],
      ['milestone', 1, 'firstGrownUp', 80, null],
      ['residents', 45, null, 80, null],
      ['houses', 4, 4, 80, null],
      ['milestone', 1, 'thirdGeneration', 100, null],
      ['residents', 65, null, 100, null],
      ['residents', 85, null, 120, null],
      ['residents', 100, null, 120, 'temple'],
      ['residents', 130, null, 175, null],
      ['residents', 160, null, 200, null],
      ['build', 1, 'temple', 0, null],
    ]);
    expect(GOALS.at(-1)!.victory).toBe(true);
    expect(GOALS.filter((g) => g.victory)).toHaveLength(1);
    expect(GOALS.some((g) => g.fromYear)).toBe(false); // no goal waits for a year any more
  });

  it('the goals file uses no harvest or water goal any more', () => {
    expect(GOALS.some((g) => (g.type as string) === 'harvest')).toBe(false);
    expect(GOALS.some((g) => (g.type as string) === 'water')).toBe(false);
  });

  it('knows which goal unlocks each placeable', () => {
    expect(unlockingGoal('granary')).toBe(1);
    expect(unlockingGoal('quarry')).toBe(4);
    expect(unlockingGoal('plaza')).toBe(5);
    expect(unlockingGoal('workshop')).toBe(6);
    expect(unlockingGoal('market')).toBe(7);
    expect(unlockingGoal('park')).toBe(9);
    expect(unlockingGoal('temple')).toBe(16); // built before the 160 residents; the victory still asks for them
    for (const k of RULES.startUnlocked) expect(unlockingGoal(k)).toBeNull();
    GOALS.forEach((g, i) => {
      if (g.unlock) expect(unlockingGoal(g.unlock)).toBe(i + 1);
    });
  });

  it('the plaza waits for goal 5 (5 mud-brick houses); goal 9 (6 stone houses) unlocks the park', () => {
    expect(RULES.startUnlocked).not.toContain('plaza');
    expect(RULES.startUnlocked).not.toContain('park');
    const fresh = createGame(createRng(1));
    expect(fresh.unlocked).not.toContain('plaza');
    expect(fresh.unlocked).not.toContain('park');
    expect(GOALS[4]).toMatchObject({ type: 'houses', target: 5, level: 2, unlock: 'plaza' });
    const goal = GOALS[8];
    expect(goal).toMatchObject({ type: 'houses', target: 6, level: 3, unlock: 'park' });
    const s = emptyGame({ goalIndex: 8, silver: 0, unlocked: [...RULES.startUnlocked] });
    for (let k = 0; k < goal.target; k++) put(s, 'house', ROADSIDE, 27 + 2 * k, 3);
    const events: GameEvent[] = [];
    checkGoal(s, events);
    expect(events[0]).toEqual({ type: 'goal', index: 8, reward: goal.reward, unlock: 'park' });
    expect(s.unlocked).toContain('park');
  });

  it('goal 1: food that lasts until the first spring, rewards and unlocks the granary', () => {
    const s = emptyGame({ silver: 0, goalIndex: FOOD, food: 10, unlocked: [...RULES.startUnlocked] });
    put(s, 'house', ROADSIDE, 27, 1);
    const eat = (w: number) => HOUSE_LEVELS[1].capacity * foodOf('adult', 1, w);
    let left = 10;
    let weeks = 0;
    while ((left = Math.round((left - eat(weeks)) * 100) / 100) > 0) weeks++;
    expect(weeks).toBeLessThan(SPRING);
    const events: GameEvent[] = [];
    checkGoal(s, events);
    expect(events).toEqual([]);
    expect(goalProgress(s, GOALS[FOOD])).toBe(weeks);
    expect(goalTarget(s, GOALS[FOOD])).toBe(SPRING);
    let need = 0;
    for (let w = 0; w < SPRING; w++) need += eat(w); // the winter weeks eat more
    s.food = Math.ceil(need) + 1;
    checkGoal(s, events);
    expect(events).toEqual([goalEvent(FOOD)]);
    expect(GOALS[FOOD].unlock).toBe('granary');
    expect(s.unlocked).toContain('granary');
    expect(s.silver).toBe(GOALS[FOOD].reward);
    expect(currentGoal(s)).toBe(GOALS[FOOD + 1]);
  });

  it('goal 1 is not met by an empty city (everyone left)', () => {
    const s = emptyGame({ goalIndex: FOOD, food: 40, unlocked: [...RULES.startUnlocked] });
    expect(goalProgress(s, GOALS[FOOD])).toBe(0);
    const events: GameEvent[] = [];
    checkGoal(s, events);
    expect(events).toEqual([]);
  });

  it('goal 1 is not met with nobody living in the city, even with a family on the way', () => {
    const s = emptyGame({ goalIndex: FOOD, food: 40, week: W + 1, unlocked: [...RULES.startUnlocked] }); // winter
    const plot = put(s, 'house', ROADSIDE, 27);
    const man = person(s, { houseId: null, sex: 'm', age: 30, caravan: 1 });
    const woman = person(s, { houseId: null, sex: 'f', age: 30, caravan: 1 });
    s.families.push({ id: 999, houseId: plot.id, members: [man.id, woman.id], path: [{ x: ROAD_X, y: 27 }, { x: ROADSIDE, y: 27 }], step: 0 });
    expect(computeEconomy(s).residents).toBe(0);
    expect(goalProgress(s, GOALS[FOOD])).toBe(0);
    const events: GameEvent[] = [];
    checkGoal(s, events);
    expect(events).toEqual([]);
    // The family arrives this week, and 40 food lasts its tent past the spring: the goal is met.
    const week = stepWeek(s, constRng(0.99));
    expect(plot.level).toBe(1);
    expect(week).toContainEqual(goalEvent(FOOD));
  });

  it('goal 2 also counts the fisher food', () => {
    const s = emptyGame({ goalIndex: FOOD, food: 10 });
    put(s, 'house', ROADSIDE, 27, 2);
    const before = goalProgress(s, GOALS[FOOD]);
    const f = put(s, 'fisher', besideRiver(s, 30), 30);
    expect(f.connected).toBe(true);
    expect(goalProgress(s, GOALS[FOOD])).toBeGreaterThan(before);
  });

  it('every "milestone" goal is done once its milestone is reached, also when it was reached before', () => {
    GOALS.forEach((goal, i) => {
      if (goal.type !== 'milestone') return;
      const s = emptyGame({ goalIndex: i, silver: 0 });
      expect(goalProgress(s, goal)).toBe(0);
      const events: GameEvent[] = [];
      checkGoal(s, events);
      expect(events, `goal ${i + 1}`).toEqual([]);
      s.milestones.push(goal.milestone!);
      expect(goalProgress(s, goal)).toBe(1);
      checkGoal(s, events);
      expect(events, `goal ${i + 1}`).toEqual([goalEvent(i)]);
      expect(s.silver).toBe(goal.reward);
      if (goal.unlock) expect(s.unlocked).toContain(goal.unlock);
    });
    // A milestone reached long before its goal comes (a wedding while goal 1 is open) is done at once.
    const s = emptyGame({ goalIndex: FOOD, food: 1000 });
    put(s, 'granary', EAST, 36);
    s.food = foodCapacity(s);
    put(s, 'house', ROADSIDE, 27, 1);
    s.milestones.push('firstWedding');
    const events: GameEvent[] = [];
    checkGoal(s, events); // goal 1: food until spring
    checkGoal(s, events); // goal 2: first wedding, already reached
    expect(events.map((e) => e.type === 'goal' && e.index)).toEqual([0, 1]);
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

  it('every "residents" goal needs its target of people living in the city', () => {
    GOALS.forEach((goal, i) => {
      if (goal.type !== 'residents') return;
      const s = emptyGame({ goalIndex: i, silver: 0, unlocked: ['road', 'house'] });
      const n = Math.ceil(goal.target / HOUSE_LEVELS[TOP].capacity);
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
    expect(stepWeek(s, constRng(0.99))).toContainEqual({ type: 'victory', week: 43, residents: HOUSE_LEVELS[TOP].capacity });
    expect(s.won).toBe(true);
    expect(currentGoal(s)).toBeUndefined();
  });

  it('completes one goal per check, even when the next one is already met', () => {
    // Six big houses meet "30 residents" and "6 stone houses" at once.
    const s = emptyGame({ goalIndex: 7 });
    for (const y of [27, 29, 31, 33, 35, 37]) put(s, 'house', ROADSIDE, y, TOP);
    const events: GameEvent[] = [];
    checkGoal(s, events);
    expect(s.goalIndex).toBe(8);
    checkGoal(s, events);
    expect(s.goalIndex).toBe(9);
    checkGoal(s, events); // no child born in the city has grown up
    expect(s.goalIndex).toBe(9);
    expect(events.filter((e) => e.type === 'goal').map((e) => e.type === 'goal' && e.index)).toEqual([7, 8]);
  });
});

describe('years and the temple goal', () => {
  it('yearOf counts years from 1, one every WEEKS_PER_YEAR weeks', () => {
    expect(yearOf(0)).toBe(1);
    expect(yearOf(WEEKS_PER_YEAR - 1)).toBe(1);
    expect(yearOf(WEEKS_PER_YEAR)).toBe(2);
    expect(yearOf(7 * WEEKS_PER_YEAR)).toBe(8);
  });

  it('a goal with fromYear waits for that year; goals without it are open from the first week', () => {
    const s = emptyGame({ week: 0 });
    for (const g of GOALS) expect(goalOpen(s, g)).toBe(true);
    const later = { ...GOALS[4], fromYear: 3 };
    s.week = 2 * WEEKS_PER_YEAR - 1;
    expect(goalOpen(s, later)).toBe(false);
    s.week++;
    expect(goalOpen(s, later)).toBe(true);
  });

  it('the temple goal is the one right before the victory (160 residents)', () => {
    const i = GOALS.length - 2;
    expect(TEMPLE_GOAL).toEqual({ number: i + 1, goal: GOALS[i] });
    expect(GOALS[i]).toMatchObject({ type: 'residents', target: 160 });
  });

  it('a temple built before the last goal wins the week it is met (and says what it waits for)', () => {
    const i = GOALS.length - 2;
    const goal = GOALS[i];
    const s = emptyGame({ goalIndex: i, silver: 0, food: 100, unlocked: ['road', 'house', 'temple'] });
    expect(templeWaitsForGoal(s)).toBe(false); // no temple yet
    put(s, 'temple', EAST, 30);
    expect(templeWaitsForGoal(s)).toBe(true);
    const never = constRng(0.99);
    expect(stepWeek(s, never).some((e) => e.type === 'goal' || e.type === 'victory')).toBe(false);
    bigHouses(s, Math.ceil(goal.target / HOUSE_LEVELS[TOP].capacity));
    const events = stepWeek(s, never);
    expect(events).toContainEqual(goalEvent(i));
    expect(events).toContainEqual(expect.objectContaining({ type: 'victory', week: 2 })); // the second week
    expect(s.won).toBe(true);
    expect(templeWaitsForGoal(s)).toBe(false);
  });

  it('the temple does not wait once only the victory goal is left', () => {
    const s = emptyGame({ goalIndex: GOALS.length - 1 });
    put(s, 'temple', EAST, 30);
    expect(templeWaitsForGoal(s)).toBe(false);
  });
});
