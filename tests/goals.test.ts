import { describe, expect, it } from 'vitest';
import { checkGoal, currentGoal, GOALS, stepMonth, unlockingGoal, type GameEvent } from '../src/core';
import { constRng, EAST, emptyGame, put, ROADSIDE } from './helpers';

describe('goals', () => {
  it('first goal: 6 houses connected to the road (tents or better)', () => {
    const s = emptyGame({ silver: 0, goalIndex: 0, unlocked: ['road', 'house', 'field', 'well'] });
    for (let y = 27; y <= 35; y += 2) put(s, 'house', ROADSIDE, y, 1);
    put(s, 'house', 1, 1, 1); // not connected: does not count
    put(s, 'house', ROADSIDE, 37); // empty plot: does not count
    const events: GameEvent[] = [];
    checkGoal(s, events);
    expect(events).toEqual([]);
    put(s, 'house', ROADSIDE, 39, 1);
    checkGoal(s, events);
    expect(events).toEqual([{ type: 'goal', index: 0, reward: 20, unlock: undefined }]);
    expect(s.silver).toBe(20);
    expect(currentGoal(s)?.text).toBe('Chegue a 20 moradores');
  });

  it('rewards silver and unlocks the market at 20 residents', () => {
    const s = emptyGame({ silver: 0, goalIndex: 1, unlocked: ['road', 'house', 'field', 'well'] });
    for (let y = 27; y <= 39; y += 2) put(s, 'house', ROADSIDE, y, 1); // 21 residents
    const events: GameEvent[] = [];
    checkGoal(s, events);
    expect(events).toEqual([{ type: 'goal', index: 1, reward: 30, unlock: 'market' }, { type: 'upkeepStart' }]);
    expect(s.unlocked).toContain('market');
  });

  it('has the configured targets, rewards and unlocks in order', () => {
    expect(GOALS.map((g) => [g.type, g.target, g.level ?? g.kind ?? null, g.reward, g.unlock ?? null])).toEqual([
      ['houses', 6, 1, 20, null],
      ['residents', 20, null, 30, 'market'],
      ['houses', 5, 2, 40, 'workshop'],
      ['build', 2, 'workshop', 40, 'garden'],
      ['residents', 80, null, 60, null],
      ['houses', 6, 3, 80, null],
      ['residents', 150, null, 120, null],
      ['houses', 4, 4, 150, 'temple'],
      ['build', 1, 'temple', 0, null],
    ]);
  });

  it('counts connected houses of the required level or better', () => {
    const s = emptyGame({ goalIndex: 7 });
    for (let y = 27; y <= 31; y += 2) put(s, 'house', ROADSIDE, y, 4);
    put(s, 'house', 1, 1, 4); // disconnected big house does not count
    const events: GameEvent[] = [];
    checkGoal(s, events);
    expect(events).toEqual([]);
    put(s, 'house', ROADSIDE, 33, 4);
    checkGoal(s, events);
    expect(events[0]).toEqual({ type: 'goal', index: 7, reward: 150, unlock: 'temple' });
  });

  it('declares victory when the temple is built, with months and residents', () => {
    const s = emptyGame({ goalIndex: 8, month: 41 });
    put(s, 'house', ROADSIDE, 27, 4);
    expect(stepMonth(s, constRng(0.99))).not.toContainEqual(expect.objectContaining({ type: 'victory' }));
    put(s, 'temple', EAST, 30);
    expect(stepMonth(s, constRng(0.99))).toContainEqual({ type: 'victory', month: 43, residents: 16 });
    expect(s.won).toBe(true);
    expect(currentGoal(s)).toBeUndefined();
  });

  it('knows which goal unlocks each placeable', () => {
    expect(unlockingGoal('market')).toBe(2);
    expect(unlockingGoal('workshop')).toBe(3);
    expect(unlockingGoal('temple')).toBe(8);
    expect(unlockingGoal('road')).toBeNull();
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
    expect(events).toEqual([{ type: 'goal', index: i, reward: 40, unlock: 'garden' }]);
    expect(s.silver).toBe(40);
  });
});
