import { describe, expect, it } from 'vitest';
import { costOf } from '../../src/core';
import { buildColumn } from '../../src/game/model/build';
import { T } from '../../src/game/strings';
import { COLUMN_ORDER } from '../../src/game/tools';
import { emptyGame } from '../helpers';

describe('building column as data', () => {
  it('every building in column order, with its price; the key only on PC', () => {
    const s = emptyGame();
    s.unlocked = [...COLUMN_ORDER];
    const pc = buildColumn(s, 'view', false);
    expect(pc.map((b) => b.kind)).toEqual(COLUMN_ORDER);
    const house = pc.find((b) => b.kind === 'house')!;
    expect(house.line.startsWith(T.nova.silverCost(costOf('house')))).toBe(true);
    expect(house.line).toMatch(/ · \S+$/);
    expect(buildColumn(s, 'view', true).find((b) => b.kind === 'house')!.line).not.toBe(house.line);
  });

  it('locked buildings say which goal unlocks them and are never "short"', () => {
    const s = emptyGame();
    s.unlocked = s.unlocked.filter((k) => k !== 'temple');
    s.silver = 0;
    const t = buildColumn(s, 'view', false).find((b) => b.kind === 'temple')!;
    expect(t.locked).toBe(true);
    expect(t.short).toBe(false);
    expect(t.line).toMatch(/objetivo/i);
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
});
