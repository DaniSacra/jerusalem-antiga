import { describe, expect, it } from 'vitest';
import { costOf, unlockingGoal } from '../../src/core';
import { buildColumn } from '../../src/game/model/build';
import { T } from '../../src/game/strings';
import { COLUMN_ORDER } from '../../src/game/tools';
import { emptyGame, put } from '../helpers';

describe('building column as data', () => {
  it('every building in column order, with its price; "tecla N" only on PC', () => {
    const s = emptyGame();
    s.unlocked = [...COLUMN_ORDER];
    const pc = buildColumn(s, 'view', false);
    expect(pc.map((b) => b.kind)).toEqual(COLUMN_ORDER);
    const house = pc.find((b) => b.kind === 'house')!;
    expect(house.line.startsWith(T.nova.silverCost(costOf('house')))).toBe(true);
    expect(house.key).toBe(T.nova.keyHint('3'));
    expect(house.line).not.toMatch(/tecla/);
    expect(buildColumn(s, 'view', true).find((b) => b.kind === 'house')!.key).toBeNull();
  });

  it('locked buildings say which goal unlocks them and are never "short"', () => {
    const s = emptyGame();
    s.unlocked = s.unlocked.filter((k) => k !== 'temple');
    s.silver = 0;
    const t = buildColumn(s, 'view', false).find((b) => b.kind === 'temple')!;
    expect(t.locked).toBe(true);
    expect(t.short).toBe(false);
    expect(t.line).toMatch(/objetivo/i);
    expect(t.key).toBeNull();
  });

  it('short when silver or a material is missing; on for the tool in hand', () => {
    const s = emptyGame();
    s.unlocked = [...COLUMN_ORDER];
    s.silver = 0;
    const col = buildColumn(s, 'plaza', false);
    expect(col.find((b) => b.kind === 'plaza')!.short).toBe(true);
    expect(col.find((b) => b.kind === 'plaza')!.on).toBe(true);
    s.silver = 99999;
    s.wood = 0;
    expect(buildColumn(s, 'view', false).find((b) => b.kind === 'house')!.short).toBe(true);
  });

  it('"novo" for a building a goal unlocked until the first one is built; never locked or from the start', () => {
    const s = emptyGame();
    s.unlocked = [...COLUMN_ORDER];
    const col = buildColumn(s, 'view', false);
    for (const b of col) expect(b.fresh).toBe(unlockingGoal(b.kind) !== null);
    put(s, 'granary', 25, 30);
    expect(buildColumn(s, 'view', false).find((b) => b.kind === 'granary')!.fresh).toBe(false);
    s.unlocked = s.unlocked.filter((k) => k !== 'market');
    expect(buildColumn(s, 'view', false).find((b) => b.kind === 'market')!.fresh).toBe(false);
  });
});
