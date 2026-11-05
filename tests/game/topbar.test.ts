import { describe, expect, it } from 'vitest';
import { readCity } from '../../src/core';
import { topBar, type Part } from '../../src/game/model/topbar';
import { T } from '../../src/game/strings';
import { emptyGame } from '../helpers';

const texts = (parts: Part[]) => parts.filter((p): p is { text: string } => 'text' in p).map((p) => p.text);

describe('top bar as data', () => {
  it('silver, food, wood and people; stone only once the quarry is open', () => {
    const s = emptyGame();
    s.unlocked = s.unlocked.filter((k) => k !== 'quarry');
    s.stone = 0;
    const bar = topBar(s, readCity(s), true);
    expect(bar.pills.map((p) => p.key)).toEqual(['silver', 'food', 'wood', 'people']);
    s.unlocked.push('quarry');
    expect(topBar(s, readCity(s), true).pills.map((p) => p.key)).toContain('stone');
  });

  it('debt turns the silver red and blinks; famine the food', () => {
    const s = emptyGame();
    s.silver = -5;
    s.famine = true;
    const bar = topBar(s, readCity(s), false);
    const silver = bar.pills.find((p) => p.key === 'silver')!;
    expect(silver.alarm).toBe(true);
    expect(silver.parts.some((p) => 'tone' in p && p.tone === 'bad')).toBe(true);
    expect(texts(bar.pills.find((p) => p.key === 'food')!.parts)).toContain(T.nova.famine);
  });

  it('the PC shows names that the phone and the tighter fits drop', () => {
    const s = emptyGame();
    const pc = topBar(s, readCity(s), false, 0).pills[0];
    const phone = topBar(s, readCity(s), true).pills[0];
    expect(texts(pc.parts)).toContain(T.nova.silver);
    expect(texts(phone.parts)).not.toContain(T.nova.silver);
    expect(texts(topBar(s, readCity(s), false, 2).pills[0].parts)).not.toContain(T.nova.silver);
  });

  it('the goal pill shows the current goal and its bar on PC', () => {
    const s = emptyGame();
    const goal = topBar(s, readCity(s), false).goal;
    expect(goal.some((p) => 'bar' in p)).toBe(true);
    expect(topBar(s, readCity(s), true).goal.some((p) => 'bar' in p)).toBe(false);
  });
});
