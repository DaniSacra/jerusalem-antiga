import { describe, expect, it } from 'vitest';
import { dimsOf, gatherSpots, gatherYield, indexOf, newBuilding, placeSpots, RULES } from '../src/core';
import { emptyGame } from './helpers';

const yieldAt = (s: ReturnType<typeof emptyGame>, c: { x: number; y: number }) =>
  gatherYield(s, { ...newBuilding(-1, 'lumber', { ...c, ...dimsOf('lumber') }, s.week), connected: true });

describe('gatherSpots (where a lumber or quarry brings the most)', () => {
  it('is empty when no spot gathers anything, and for kinds that gather nothing', () => {
    const s = emptyGame();
    s.feature.fill(null as never);
    expect(gatherSpots(s, 'lumber')).toEqual([]);
    expect(gatherSpots(s, 'quarry')).toEqual([]);
    expect(gatherSpots(s, 'market')).toEqual([]);
  });

  it('keeps the free spots that bring at least goodGatherShare of the best, the best among them', () => {
    const s = emptyGame();
    s.feature.fill(null as never);
    for (let y = 27; y <= 34; y++) for (const x of [28, 29]) s.feature[indexOf(s, x, y)] = 'olive';
    const all = placeSpots(s, 'lumber').map((c) => ({ ...c, n: yieldAt(s, c) }));
    const best = Math.max(...all.map((c) => c.n));
    const got = gatherSpots(s, 'lumber');
    expect(best).toBeGreaterThan(0);
    expect(got.length).toBeGreaterThan(0);
    expect(got.length).toBeLessThan(all.length);
    for (const c of got) expect(yieldAt(s, c)).toBeGreaterThanOrEqual(best * RULES.goodGatherShare);
    expect(got.some((c) => yieldAt(s, c) === best)).toBe(true);
    const left = all.filter((c) => !got.some((g) => g.x === c.x && g.y === c.y));
    for (const c of left) expect(c.n).toBeLessThan(best * RULES.goodGatherShare);
  });
});
