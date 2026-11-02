import { describe, expect, it } from 'vitest';
import { clearCell, createGame, createRng, doorsOf, familySpeed, indexOf, place, RULES, stepMonth } from '../src/core';
import { constRng, EAST, emptyGame, put, ROADSIDE } from './helpers';

const always = constRng(0);
const never = constRng(0.99);

describe('families', () => {
  it('a connected plot gets a family that walks from the entrance and turns it into a tent', () => {
    const s = emptyGame();
    const plot = put(s, 'house', ROADSIDE, 27);
    stepMonth(s, always); // sets out and walks its first month at once
    expect(s.families).toHaveLength(1);
    const f = s.families[0];
    expect(f.path[0]).toEqual(s.entrance);
    expect(f.path.at(-2)).toEqual({ x: 24, y: 28 }); // first road cell next to the 2x2 plot
    expect(f.path.at(-1)).toEqual({ x: ROADSIDE, y: 27 });
    expect(f.fast).toBe(true); // one of the guaranteed first families
    expect(f.step).toBe(familySpeed(f));
    expect(plot.level).toBe(0);

    const months = Math.ceil((f.path.length - 1) / familySpeed(f));
    for (let k = 2; k < months; k++) stepMonth(s, never);
    expect(plot.level).toBe(0);
    expect(stepMonth(s, never)).toContainEqual({ type: 'houseUp', x: ROADSIDE, y: 27, level: 1, delta: 3 });
    expect(s.families).toHaveLength(0);
  });

  it('only the guaranteed families walk faster', () => {
    const s = emptyGame();
    for (const y of [27, 29, 31]) put(s, 'house', ROADSIDE, y, 1); // 3 families settled
    put(s, 'house', ROADSIDE, 40);
    stepMonth(s, always);
    const f = s.families[0];
    expect(f.fast).toBeUndefined();
    expect(familySpeed(f)).toBe(RULES.familyCellsPerMonth);
    expect(familySpeed({ ...f, fast: true })).toBe(RULES.familyCellsPerMonth * RULES.earlyFamilySpeedMultiplier);
    const before = f.step;
    stepMonth(s, never);
    expect(f.step - before).toBe(RULES.familyCellsPerMonth);
  });

  it('the first tent is settled within 2 months on a fresh map', () => {
    const s = createGame(createRng(7));
    s.unlocked = [...s.unlocked];
    const r = place(s, 'house', ROADSIDE, 27);
    expect(r.ok).toBe(true);
    stepMonth(s, never);
    stepMonth(s, never);
    expect(s.buildings.some((b) => b.kind === 'house' && b.level === 1)).toBe(true);
  });

  it('the first 3 families come for sure', () => {
    const s = emptyGame();
    for (let y = 27; y <= 33; y += 2) put(s, 'house', ROADSIDE, y);
    // Tents plus families on the way (some may already have arrived).
    const coming = () => s.families.length + s.buildings.filter((b) => b.kind === 'house' && b.level >= 1).length;
    stepMonth(s, never);
    expect(coming()).toBe(3);
    stepMonth(s, never);
    expect(coming()).toBe(3); // the 4th plot is back to 35%

    const t = emptyGame();
    for (const y of [27, 29]) put(t, 'house', ROADSIDE, y, 1); // 2 tents already settled
    for (const y of [31, 33]) put(t, 'house', ROADSIDE, y);
    stepMonth(t, never);
    expect(t.families).toHaveLength(1);
  });

  it('after the first 3, dispatches with 35% chance, one family per plot at a time', () => {
    const s = emptyGame();
    for (const y of [34, 36, 38]) put(s, 'house', ROADSIDE, y, 1);
    put(s, 'workshop', EAST, 34); // jobs for all: the city is content, so the plain 35% applies
    put(s, 'house', ROADSIDE, 27);
    stepMonth(s, constRng(0.36));
    expect(s.families).toHaveLength(0);
    stepMonth(s, constRng(0.34));
    stepMonth(s, constRng(0.34));
    expect(s.families).toHaveLength(1);
  });

  it('does not send families to disconnected plots or during famine', () => {
    const s = emptyGame();
    put(s, 'house', 1, 1);
    stepMonth(s, always);
    expect(s.families).toHaveLength(0);

    const f = emptyGame({ famine: true, food: 0 });
    put(f, 'house', ROADSIDE, 30);
    put(f, 'house', ROADSIDE, 32, 1); // keeps the famine going
    stepMonth(f, always);
    expect(f.families).toHaveLength(0);
  });

  it('cancels the family if the plot is demolished or cut off, and reroutes around changes', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 27);
    stepMonth(s, always);
    clearCell(s, ROADSIDE, 27);
    stepMonth(s, never);
    expect(s.families).toHaveLength(0);

    const r = emptyGame();
    const plot = put(r, 'house', ROADSIDE, 27);
    stepMonth(r, always);
    // Build a detour, then cut the straight road ahead of the family.
    for (let y = 27; y <= 38; y++) place(r, 'road', 25, y);
    clearCell(r, 24, 32);
    expect(plot.connected).toBe(true);
    for (let k = 0; k < 10; k++) stepMonth(r, never);
    expect(plot.level).toBe(1);
  });

  it('starts at a road next to the altar if the entrance was cut off, never inside the altar', () => {
    const s = emptyGame();
    clearCell(s, 24, 47);
    put(s, 'house', ROADSIDE, 30);
    stepMonth(s, always);
    const altar = s.buildings.find((b) => b.kind === 'altar')!;
    const start = s.families[0].path[0];
    expect(doorsOf(s, altar)).toContainEqual(start); // a ring cell, outside the altar
    expect(s.grid[indexOf(s, start.x, start.y)]).toBeNull();
  });
});
