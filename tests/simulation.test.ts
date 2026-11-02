import { describe, expect, it } from 'vitest';
import { stepMonth } from '../src/core';
import { constRng, emptyGame, place } from './helpers';

const never = constRng(0.99);
const always = constRng(0);

describe('stepMonth: resources', () => {
  it('updates food, silver and the month', () => {
    const s = emptyGame({ silver: 0, food: 10 });
    place(s, 'house', 1, 1, 1);
    stepMonth(s, never);
    expect(s.food).toBeCloseTo(9.4);
    expect(s.silver).toBe(1);
    expect(s.month).toBe(1);
  });

  it('enters famine when food hits zero with a negative balance, once per episode', () => {
    const s = emptyGame({ food: 0.5 });
    place(s, 'house', 1, 1, 1);
    expect(stepMonth(s, never)).toContainEqual({ type: 'famineStart' });
    expect(s.food).toBe(0);
    expect(s.famine).toBe(true);
    expect(stepMonth(s, never)).not.toContainEqual({ type: 'famineStart' });

    place(s, 'field', 2, 1);
    expect(stepMonth(s, never)).toContainEqual({ type: 'famineEnd' });
    expect(s.famine).toBe(false);
  });
});

describe('stepMonth: houses', () => {
  it('turns empty plots into tents with 35% chance, not during famine', () => {
    const s = emptyGame();
    const b = place(s, 'house', 1, 1);
    stepMonth(s, constRng(0.36));
    expect(b.level).toBe(0);
    const events = stepMonth(s, constRng(0.34));
    expect(b.level).toBe(1);
    expect(events).toContainEqual({ type: 'houseUp', x: 1, y: 1, level: 1, delta: 3 });

    const f = emptyGame({ famine: true, food: 0 });
    const plot = place(f, 'house', 1, 1);
    place(f, 'house', 2, 1, 1);
    stepMonth(f, always);
    expect(plot.level).toBe(0);
  });

  it('levels up after 3 consecutive months meeting the next needs', () => {
    const s = emptyGame();
    const b = place(s, 'house', 1, 1, 1);
    place(s, 'well', 3, 3);
    stepMonth(s, never);
    stepMonth(s, never);
    expect(b.level).toBe(1);
    const events = stepMonth(s, never);
    expect(b.level).toBe(2);
    expect(events).toContainEqual({ type: 'houseUp', x: 1, y: 1, level: 2, delta: 3 });
  });

  it('drops a level after 3 consecutive months missing a current need', () => {
    const s = emptyGame();
    const b = place(s, 'house', 1, 1, 2);
    stepMonth(s, never);
    stepMonth(s, never);
    expect(b.level).toBe(2);
    const events = stepMonth(s, never);
    expect(b.level).toBe(1);
    expect(events).toContainEqual({ type: 'houseDown', x: 1, y: 1, level: 1, delta: -3, famine: false });
  });

  it('resets the streak when the need comes back', () => {
    const s = emptyGame();
    const b = place(s, 'house', 1, 1, 2);
    stepMonth(s, never);
    stepMonth(s, never);
    place(s, 'well', 1, 2);
    stepMonth(s, never);
    s.buildings[s.cols * 2 + 1] = null;
    stepMonth(s, never);
    stepMonth(s, never);
    expect(b.level).toBe(2);
  });

  it('during famine houses do not evolve and those above tents may drop', () => {
    const s = emptyGame({ famine: true, food: 0 });
    place(s, 'well', 3, 3);
    const tent = place(s, 'house', 1, 1, 1);
    const mud = place(s, 'house', 2, 1, 2);
    for (let i = 0; i < 4; i++) stepMonth(s, constRng(0.5));
    expect(tent.level).toBe(1);
    expect(mud.level).toBe(2);
    const events = stepMonth(s, constRng(0.1));
    expect(tent.level).toBe(1);
    expect(mud.level).toBe(1);
    expect(events).toContainEqual({ type: 'houseDown', x: 2, y: 1, level: 1, delta: -3, famine: true });
  });
});
