import { describe, expect, it } from 'vitest';
import { clearCell, place, RULES, stepMonth } from '../src/core';
import { constRng, emptyGame, put, ROADSIDE } from './helpers';

const always = constRng(0);
const never = constRng(0.99);

describe('families', () => {
  it('a connected plot gets a family that walks from the entrance and turns it into a tent', () => {
    const s = emptyGame();
    const plot = put(s, 'house', ROADSIDE, 25);
    stepMonth(s, always);
    expect(s.families).toHaveLength(1);
    const f = s.families[0];
    expect(f.path[0]).toEqual(s.entrance);
    expect(f.path.at(-2)).toEqual({ x: 16, y: 25 });
    expect(f.path.at(-1)).toEqual({ x: ROADSIDE, y: 25 });
    expect(plot.level).toBe(0);

    const months = Math.ceil((f.path.length - 1) / RULES.familyCellsPerMonth);
    for (let k = 1; k < months; k++) stepMonth(s, never);
    expect(plot.level).toBe(0);
    expect(stepMonth(s, never)).toContainEqual({ type: 'houseUp', x: ROADSIDE, y: 25, level: 1, delta: 3 });
    expect(s.families).toHaveLength(0);
  });

  it('dispatches with 35% chance, one family per plot at a time', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 18);
    stepMonth(s, constRng(0.36));
    expect(s.families).toHaveLength(0);
    stepMonth(s, constRng(0.34));
    stepMonth(s, constRng(0.34));
    expect(s.families).toHaveLength(1);
  });

  it('does not send families to disconnected plots or during famine', () => {
    const s = emptyGame();
    put(s, 'house', 3, 3);
    stepMonth(s, always);
    expect(s.families).toHaveLength(0);

    const f = emptyGame({ famine: true, food: 0 });
    put(f, 'house', ROADSIDE, 20);
    put(f, 'house', ROADSIDE, 21, 1); // keeps the famine going
    stepMonth(f, always);
    expect(f.families).toHaveLength(0);
  });

  it('cancels the family if the plot is demolished or cut off, and reroutes around changes', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 18);
    stepMonth(s, always);
    clearCell(s, ROADSIDE, 18);
    stepMonth(s, never);
    expect(s.families).toHaveLength(0);

    const r = emptyGame();
    const plot = put(r, 'house', ROADSIDE, 18);
    stepMonth(r, always);
    // Build a detour, then cut the straight road ahead of the family.
    for (let y = 19; y <= 26; y++) place(r, 'road', 17, y);
    clearCell(r, 16, 22);
    expect(plot.connected).toBe(true);
    for (let k = 0; k < 8; k++) stepMonth(r, never);
    expect(plot.level).toBe(1);
  });

  it('starts at the altar if the entrance was cut off', () => {
    const s = emptyGame();
    clearCell(s, 16, 31);
    put(s, 'house', ROADSIDE, 18);
    stepMonth(s, always);
    expect(s.families[0].path[0]).toEqual(s.altar);
  });
});
