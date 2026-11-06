import { describe, expect, it } from 'vitest';
import { readCity } from '../../src/core';
import { FIT_MAX, fitPills, pillsWidth, topBar, type Part } from '../../src/game/model/topbar';
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

describe('top bar fit (PC)', () => {
  const m = { pad: 27, icon: 22, iconGap: 6, partGap: 4, gap: 8, bar: 80 };
  /** About 8 px a letter, 10 for numbers. */
  const measure = (t: string, size?: string) => t.length * (size === 'num' ? 10 : 8);

  it('measures padding, icon, gaps and every part', () => {
    const pill = { key: 'people' as const, icon: 'people', alarm: false, parts: [{ text: 'ab' }, { text: '12', size: 'num' as const }, { bar: 0.5 }] };
    expect(pillsWidth([pill], measure, m)).toBe(27 + 22 + 6 + 2 * 4 + 16 + 20 + 80);
    expect(pillsWidth([pill, pill], measure, m)).toBe(2 * pillsWidth([pill], measure, m) + 8);
  });

  it('keeps every name when there is room, shortens step by step when there is not', () => {
    const s = emptyGame();
    s.unlocked.push('quarry');
    const city = readCity(s);
    const at = (fit: number) => topBar(s, city, false, fit).pills;
    const widths = [0, 1, 2, 3, 4, 5].map((f) => pillsWidth(at(f), measure, m));
    for (let f = 1; f < widths.length; f++) expect(widths[f]).toBeLessThanOrEqual(widths[f - 1]);
    expect(fitPills(at, 10000, measure, m)).toBe(0);
    expect(fitPills(at, widths[2], measure, m)).toBeLessThanOrEqual(2);
    expect(fitPills(at, widths[2], measure, m)).toBeGreaterThanOrEqual(1);
    expect(texts(at(fitPills(at, widths[2], measure, m)).find((p) => p.key === 'wood')!.parts)).not.toContain(T.nova.material.wood);
    expect(fitPills(at, 10, measure, m)).toBe(FIT_MAX);
  });
});
