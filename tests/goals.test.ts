import { describe, expect, it } from 'vitest';
import { balloonNeed, checkGoal, currentGoal, houseInfo, indexOf, stepMonth, unlockingGoal, type GameEvent } from '../src/core';
import { constRng, emptyGame, place } from './helpers';

describe('goals', () => {
  it('rewards silver and unlocks the market at 15 residents', () => {
    const s = emptyGame({ silver: 0, unlocked: ['house', 'field', 'well'] });
    for (let x = 0; x < 5; x++) place(s, 'house', x, 0, 1);
    const events: GameEvent[] = [];
    checkGoal(s, events);
    expect(events).toEqual([{ type: 'goal', index: 0, reward: 30, unlock: 'market' }]);
    expect(s.silver).toBe(30);
    expect(s.unlocked).toContain('market');
    expect(currentGoal(s)?.text).toBe('Tenha 3 casas de barro');
  });

  it('counts houses of the required level or better', () => {
    const s = emptyGame({ goalIndex: 1 });
    place(s, 'house', 0, 0, 2);
    place(s, 'house', 1, 0, 3);
    const events: GameEvent[] = [];
    checkGoal(s, events);
    expect(events).toEqual([]);
    place(s, 'house', 2, 0, 4);
    checkGoal(s, events);
    expect(events[0]).toMatchObject({ type: 'goal', index: 1, unlock: 'workshop' });
  });

  it('declares victory at 200 residents with the month count', () => {
    const s = emptyGame({ goalIndex: 5, month: 41 });
    for (let x = 0; x < 13; x++) place(s, 'house', x, 0, 4);
    const events = stepMonth(s, constRng(0.99));
    expect(events).toContainEqual({ type: 'victory', month: 42 });
    expect(s.won).toBe(true);
    expect(currentGoal(s)).toBeUndefined();
  });

  it('knows which goal unlocks each building', () => {
    expect(unlockingGoal('market')).toBe(1);
    expect(unlockingGoal('workshop')).toBe(2);
    expect(unlockingGoal('altar')).toBe(4);
    expect(unlockingGoal('house')).toBeNull();
  });
});

describe('house info and balloons', () => {
  it('lists next-level needs with their status', () => {
    const s = emptyGame();
    place(s, 'house', 1, 1, 2);
    place(s, 'well', 2, 2);
    expect(houseInfo(s, indexOf(s, 1, 1))).toEqual({
      level: 2,
      name: 'Casa de barro',
      residents: 6,
      tax: 2,
      next: { name: 'Casa de pedra', needs: [{ kind: 'well', ok: true }, { kind: 'market', ok: false }] },
    });
  });

  it('shows the first missing need only when unlocked, for levels 1-3', () => {
    const s = emptyGame({ unlocked: ['house', 'field', 'well'] });
    const i = indexOf(s, 1, 1);
    const b = place(s, 'house', 1, 1, 1);
    expect(balloonNeed(s, i)).toBe('well');
    place(s, 'well', 2, 2);
    b.level = 2;
    expect(balloonNeed(s, i)).toBeNull(); // market still locked
    s.unlocked.push('market');
    expect(balloonNeed(s, i)).toBe('market');
    b.level = 0;
    expect(balloonNeed(s, i)).toBeNull();
    b.level = 4;
    expect(balloonNeed(s, i)).toBeNull();
  });
});
