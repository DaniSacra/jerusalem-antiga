import { describe, expect, it } from 'vitest';
import { costOf, indexOf, refreshCity } from '../../src/core';
import { buildColumn } from '../../src/game/model/build';
import { balloonOf } from '../../src/game/model/inspect';
import { T } from '../../src/render/strings';
import { COLUMN_ORDER } from '../../src/render/tools';
import { emptyGame, put } from '../helpers';

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

describe('balloon as data', () => {
  it('none on plain land or without a selection', () => {
    const s = emptyGame();
    expect(balloonOf(s, null)).toBeNull();
    expect(balloonOf(s, { x: 1, y: 1 })).toBeNull();
  });

  it('a building: name, road, Demolir; a road: Demolir only', () => {
    const s = emptyGame();
    const b = put(s, 'house', 22, 30, 1);
    refreshCity(s);
    const bal = balloonOf(s, { x: 22, y: 30 })!;
    expect(bal.title).toBe('Casa');
    expect(bal.rect).toEqual({ x: b.x, y: b.y, w: b.w, h: b.h });
    expect(bal.lines[0].tone).toBe(b.connected ? 'good' : 'bad');
    expect(bal.demolish).toBe(true);
    s.roads[indexOf(s, 3, 3)] = true;
    const road = balloonOf(s, { x: 3, y: 3 })!;
    expect(road.title).toBe(T.need.road);
    expect(road.upgrade).toBeNull();
    expect(road.demolish).toBe(true);
  });

  it('the altar has no road line and cannot be demolished', () => {
    const s = emptyGame();
    const a = s.buildings.find((x) => x.kind === 'altar')!;
    const bal = balloonOf(s, { x: a.x, y: a.y })!;
    expect(bal.demolish).toBe(false);
    expect(bal.lines.some((l) => l.text.includes(T.nova.inspect.connected))).toBe(false);
  });

  it('a levelled service offers Melhorar with its cost; the key changes with the level', () => {
    const s = emptyGame();
    const g = put(s, 'granary', 26, 30, 1);
    refreshCity(s);
    const one = balloonOf(s, { x: g.x, y: g.y })!;
    expect(one.upgrade).not.toBeNull();
    expect(one.lines.some((l) => l.tone === 'gold')).toBe(true);
    g.level = 2;
    expect(balloonOf(s, { x: g.x, y: g.y })!.key).not.toBe(one.key);
  });
});
