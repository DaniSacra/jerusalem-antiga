import { describe, expect, it } from 'vitest';
import { checkGoal, currentGoal, GOALS, stepMonth, unlockingGoal, type GameEvent } from '../src/core';
import { constRng, emptyGame, put, ROADSIDE } from './helpers';

describe('goals', () => {
  it('rewards silver and unlocks the market at 15 residents', () => {
    const s = emptyGame({ silver: 0, unlocked: ['road', 'house', 'field', 'well'] });
    for (let y = 18; y < 23; y++) put(s, 'house', ROADSIDE, y, 1);
    const events: GameEvent[] = [];
    checkGoal(s, events);
    expect(events).toEqual([{ type: 'goal', index: 0, reward: 30, unlock: 'market' }]);
    expect(s.silver).toBe(30);
    expect(s.unlocked).toContain('market');
    expect(currentGoal(s)?.text).toBe('Tenha 3 casas de barro');
  });

  it('has the configured rewards and unlocks in order', () => {
    expect(GOALS.map((g) => [g.reward, g.unlock ?? null])).toEqual([
      [30, 'market'],
      [40, 'workshop'],
      [50, null],
      [60, null],
      [100, 'temple'],
      [0, null],
    ]);
  });

  it('counts houses of the required level or better', () => {
    const s = emptyGame({ goalIndex: 4 });
    put(s, 'house', ROADSIDE, 18, 4);
    const events: GameEvent[] = [];
    checkGoal(s, events);
    expect(events).toEqual([]);
    put(s, 'house', ROADSIDE, 19, 4);
    checkGoal(s, events);
    expect(events[0]).toEqual({ type: 'goal', index: 4, reward: 100, unlock: 'temple' });
  });

  it('declares victory when the temple is built, with months and residents', () => {
    const s = emptyGame({ goalIndex: 5, month: 41 });
    put(s, 'house', ROADSIDE, 18, 4);
    expect(stepMonth(s, constRng(0.99))).not.toContainEqual(expect.objectContaining({ type: 'victory' }));
    put(s, 'temple', 17, 20);
    expect(stepMonth(s, constRng(0.99))).toContainEqual({ type: 'victory', month: 43, residents: 16 });
    expect(s.won).toBe(true);
    expect(currentGoal(s)).toBeUndefined();
  });

  it('knows which goal unlocks each placeable', () => {
    expect(unlockingGoal('market')).toBe(1);
    expect(unlockingGoal('workshop')).toBe(2);
    expect(unlockingGoal('temple')).toBe(5);
    expect(unlockingGoal('road')).toBeNull();
  });
});
