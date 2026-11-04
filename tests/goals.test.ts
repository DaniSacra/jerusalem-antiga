import { describe, expect, it } from 'vitest';
import { BUILDINGS, checkGoal, currentGoal, goalProgress, goalTarget, GOALS, RULES, stepWeek, unlockingGoal, type GameEvent } from '../src/core';
import { besideRiver, constRng, EAST, emptyGame, put, ROADSIDE, westOf } from './helpers';

const W = RULES.weeksPerSeason;
const SPRING = 2 * W;
const index = (type: string, extra: (g: (typeof GOALS)[number]) => boolean = () => true) => GOALS.findIndex((g) => g.type === type && extra(g));

describe('goals', () => {
  it('has the configured targets, rewards and unlocks in order', () => {
    expect(GOALS.map((g) => [g.type, g.target, g.level ?? g.kind ?? null, g.reward, g.unlock ?? null])).toEqual([
      ['foodUntilSpring', 1, null, 20, null],
      ['water', 4, null, 30, null],
      ['harvest', 12, null, 30, 'granary'],
      ['build', 1, 'granary', 40, null],
      ['houses', 6, 2, 40, 'market'],
      ['residents', 50, null, 50, 'workshop'],
      ['build', 2, 'workshop', 50, 'garden'],
      ['houses', 6, 3, 80, null],
      ['residents', 150, null, 120, null],
      ['houses', 4, 4, 150, 'temple'],
      ['build', 1, 'temple', 0, null],
    ]);
    expect(GOALS.at(-1)!.victory).toBe(true);
    expect(GOALS.filter((g) => g.victory)).toHaveLength(1);
  });

  it('knows which goal unlocks each placeable', () => {
    expect(unlockingGoal('granary')).toBe(3);
    expect(unlockingGoal('market')).toBe(5);
    expect(unlockingGoal('workshop')).toBe(6);
    expect(unlockingGoal('garden')).toBe(7);
    expect(unlockingGoal('temple')).toBe(10);
    for (const k of RULES.startUnlocked) expect(unlockingGoal(k)).toBeNull();
  });

  it('goal 1: food that lasts until the first spring, rewards 20 and asks for water next', () => {
    const s = emptyGame({ silver: 0, goalIndex: 0, food: 10 });
    put(s, 'house', ROADSIDE, 27, 1); // 0.6 a week: 10 lasts 16 weeks, the spring is 26 away
    const events: GameEvent[] = [];
    checkGoal(s, events);
    expect(events).toEqual([]);
    expect(goalProgress(s, GOALS[0])).toBe(16);
    expect(goalTarget(s, GOALS[0])).toBe(SPRING);
    s.food = 16; // 26.67 weeks
    checkGoal(s, events);
    expect(events).toEqual([{ type: 'goal', index: 0, reward: 20, unlock: undefined }]);
    expect(s.silver).toBe(20);
    expect(currentGoal(s)?.text).toBe('Água para todas as casas');
  });

  it('goal 1 also counts the fisher food', () => {
    const s = emptyGame({ goalIndex: 0, food: 10 });
    put(s, 'house', ROADSIDE, 27, 2); // 6 residents, 1.2 a week, 2 workers
    const before = goalProgress(s, GOALS[0]);
    const f = put(s, 'fisher', besideRiver(s, 30), 30);
    expect(f.connected).toBe(true);
    expect(goalProgress(s, GOALS[0])).toBeGreaterThan(before);
  });

  it('goal 2: water for every house (plots too, at least 4), then upkeep starts', () => {
    const s = emptyGame({ silver: 0, goalIndex: 1 });
    put(s, 'well', EAST, 27);
    put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'house', ROADSIDE, 29, 1);
    put(s, 'house', ROADSIDE, 31); // a plot
    const events: GameEvent[] = [];
    checkGoal(s, events);
    expect(events).toEqual([]); // 3 houses with water, the target is at least 4
    expect(goalTarget(s, GOALS[1])).toBe(4);
    put(s, 'house', ROADSIDE, 41); // far from the well
    expect(goalTarget(s, GOALS[1])).toBe(4);
    checkGoal(s, events);
    expect(events).toEqual([]);
    put(s, 'house', ROADSIDE, 43);
    expect(goalTarget(s, GOALS[1])).toBe(5); // every house
    put(s, 'well', EAST, 41);
    checkGoal(s, events);
    expect(events).toEqual([{ type: 'goal', index: 1, reward: 30, unlock: undefined }]);
    expect(s.silver).toBe(30);
  });

  it('goal 3: counts the food harvested since the start and unlocks the granary', () => {
    const s = emptyGame({ silver: 0, goalIndex: 0, harvested: 12, unlocked: ['road', 'house', 'field', 'well'] });
    s.goalIndex = 2;
    const events: GameEvent[] = [];
    checkGoal(s, events);
    expect(events).toEqual([{ type: 'goal', index: 2, reward: 30, unlock: 'granary' }, { type: 'upkeepStart' }]);
    expect(s.unlocked).toContain('granary');
  });

  it('goal 3 is done by a real spring harvest in stepWeek', () => {
    const s = emptyGame({ goalIndex: 2, week: SPRING, food: 0 });
    put(s, 'house', ROADSIDE, 27, 4); // enough workers
    put(s, 'field', westOf('field'), 30).built = 0;
    const events = stepWeek(s, constRng(0.99));
    expect(s.harvested).toBeCloseTo(BUILDINGS.field.harvest! / (3 * RULES.weeksPerSeason)); // one week of one field
    expect(events).toContainEqual({ type: 'goal', index: 2, reward: 30, unlock: 'granary' });
  });

  it('goal 4: one connected granary', () => {
    const s = emptyGame({ silver: 0, goalIndex: 3 });
    const events: GameEvent[] = [];
    put(s, 'granary', 2, 2); // not connected
    checkGoal(s, events);
    expect(events).toEqual([]);
    put(s, 'granary', EAST, 30);
    checkGoal(s, events);
    expect(events).toEqual([{ type: 'goal', index: 3, reward: 40, unlock: undefined }]);
  });

  it('counts connected houses of the required level or better', () => {
    const i = index('houses', (g) => g.level === 4);
    const s = emptyGame({ goalIndex: i });
    for (let y = 27; y <= 31; y += 2) put(s, 'house', ROADSIDE, y, 4);
    put(s, 'house', 1, 1, 4); // disconnected big house does not count
    const events: GameEvent[] = [];
    checkGoal(s, events);
    expect(events).toEqual([]);
    put(s, 'house', ROADSIDE, 33, 4);
    checkGoal(s, events);
    expect(events[0]).toEqual({ type: 'goal', index: i, reward: 150, unlock: 'temple' });
  });

  it('6 mud-brick houses (or better) unlock the market', () => {
    const i = index('houses', (g) => g.level === 2);
    const s = emptyGame({ goalIndex: i, silver: 0 });
    for (let y = 27; y <= 35; y += 2) put(s, 'house', ROADSIDE, y, 2);
    put(s, 'house', ROADSIDE, 37, 1); // a tent does not count
    const events: GameEvent[] = [];
    checkGoal(s, events);
    expect(events).toEqual([]);
    put(s, 'house', ROADSIDE, 39, 3);
    checkGoal(s, events);
    expect(events).toEqual([{ type: 'goal', index: i, reward: 40, unlock: 'market' }]);
  });

  it('50 residents unlock the workshop', () => {
    const i = index('residents', (g) => g.target === 50);
    const s = emptyGame({ goalIndex: i, silver: 0 });
    for (let y = 27; y <= 33; y += 2) put(s, 'house', ROADSIDE, y, 3); // 40
    put(s, 'house', ROADSIDE, 35, 3); // 50
    const events: GameEvent[] = [];
    checkGoal(s, events);
    expect(events).toEqual([{ type: 'goal', index: i, reward: 50, unlock: 'workshop' }]);
  });

  it('right after the workshop unlocks, asks for 2 connected workshops', () => {
    const i = GOALS.findIndex((g) => g.unlock === 'workshop') + 1;
    const s = emptyGame({ goalIndex: i, silver: 0 });
    const events: GameEvent[] = [];
    put(s, 'workshop', ROADSIDE - 1, 27);
    put(s, 'workshop', 1, 1); // not connected: does not count
    checkGoal(s, events);
    expect(events).toEqual([]);
    put(s, 'workshop', ROADSIDE - 1, 30);
    checkGoal(s, events);
    expect(events).toEqual([{ type: 'goal', index: i, reward: 50, unlock: 'garden' }]);
    expect(s.silver).toBe(50);
  });

  it('declares victory when the temple is built, with weeks and residents', () => {
    const s = emptyGame({ goalIndex: GOALS.length - 1, week: 41 });
    put(s, 'house', ROADSIDE, 27, 4);
    expect(stepWeek(s, constRng(0.99))).not.toContainEqual(expect.objectContaining({ type: 'victory' }));
    put(s, 'temple', EAST, 30);
    expect(stepWeek(s, constRng(0.99))).toContainEqual({ type: 'victory', week: 43, residents: 16 });
    expect(s.won).toBe(true);
    expect(currentGoal(s)).toBeUndefined();
  });

  it('completes one goal per check, even when the next one is already met', () => {
    const s = emptyGame({ goalIndex: 2, harvested: 50 });
    put(s, 'granary', EAST, 30);
    const events: GameEvent[] = [];
    checkGoal(s, events);
    expect(s.goalIndex).toBe(3);
    checkGoal(s, events);
    expect(s.goalIndex).toBe(4);
  });
});
