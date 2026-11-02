import { describe, expect, it } from 'vitest';
import { balloonNeed, computeEconomy, familyFactor, houseHappiness, houseInfo, HOUSE_LEVELS, idleShare, moodOf, RULES, stepMonth, taxFactor } from '../src/core';
import { constRng, EAST, emptyGame, put, ROADSIDE, westOf } from './helpers';

const H = RULES.happiness;
const kinds = (h: { parts: { kind: string }[] }) => h.parts.map((p) => p.kind);

describe('house happiness', () => {
  it('starts at the base and adds each covering service', () => {
    const s = emptyGame();
    const far = put(s, 'house', ROADSIDE, 40, 1); // beyond the altar's radius
    expect(houseHappiness(s, far, 0)).toEqual({ value: H.base, mood: 'neutral', parts: [] });

    const near = put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'well', ROADSIDE, 29);
    put(s, 'garden', EAST, 27);
    put(s, 'market', EAST, 29);
    const h = houseHappiness(s, near, 0);
    expect(kinds(h)).toEqual(['sacred', 'garden', 'well', 'market']);
    expect(h.value).toBe(H.base + H.sacred + H.garden + H.well + H.market);
    expect(h.mood).toBe('happy');
  });

  it('a garden only cheers houses within its radius, and only when connected', () => {
    const s = emptyGame();
    const house = put(s, 'house', ROADSIDE, 40, 1);
    put(s, 'garden', 1, 1); // disconnected and far
    expect(kinds(houseHappiness(s, house, 0))).toEqual([]);
    put(s, 'garden', EAST, 40);
    expect(kinds(houseHappiness(s, house, 0))).toEqual(['garden']);
  });

  it('loses points for famine and for idle workers, capped and clamped to 0..100', () => {
    const s = emptyGame({ famine: true });
    const b = put(s, 'house', ROADSIDE, 40, 1);
    const h = houseHappiness(s, b, 0.25);
    expect(h.parts).toEqual([
      { kind: 'famine', value: H.famine },
      { kind: 'idle', value: -0.25 * H.idleScale },
    ]);
    expect(h.value).toBe(H.base + H.famine - 0.25 * H.idleScale);
    expect(h.mood).toBe('sad');
    expect(houseHappiness(s, b, 1).parts[1].value).toBe(-H.idleMax);
    expect(houseHappiness(s, b, 1).value).toBeGreaterThanOrEqual(0);
  });

  it('has three moods split at the configured thresholds', () => {
    expect([moodOf(H.happy), moodOf(H.happy - 1), moodOf(H.sad), moodOf(H.sad - 1)]).toEqual(['happy', 'neutral', 'neutral', 'sad']);
  });
});

describe('happiness effects', () => {
  it('taxes and family chance are plain while content and scale toward the extremes', () => {
    for (const f of [taxFactor, familyFactor]) {
      expect(f(H.sad)).toBe(1);
      expect(f(50)).toBe(1);
      expect(f(H.happy - 1)).toBe(1);
    }
    expect(taxFactor(100)).toBeCloseTo(H.taxMax);
    expect(taxFactor(0)).toBeCloseTo(H.taxMin);
    expect(familyFactor(100)).toBeCloseTo(H.familyMax);
    expect(familyFactor(0)).toBeCloseTo(H.familyMin);
    expect(taxFactor(H.happy)).toBe(1);
    expect(taxFactor((H.happy + 100) / 2)).toBeCloseTo((1 + H.taxMax) / 2);
  });

  it('a happy house pays more tax and a sad one less', () => {
    const tax = HOUSE_LEVELS[1].tax;
    const happy = emptyGame();
    put(happy, 'house', ROADSIDE, 27, 1);
    put(happy, 'garden', EAST, 27);
    put(happy, 'workshop', EAST, 30); // jobs for everyone
    const h = computeEconomy(happy);
    expect(h.happiness).toBe(H.base + H.sacred + H.garden);
    expect(h.taxes).toBeCloseTo(tax * taxFactor(h.happiness));
    expect(h.taxes).toBeGreaterThan(tax);

    const sad = emptyGame({ famine: true });
    put(sad, 'house', ROADSIDE, 40, 1);
    const e = computeEconomy(sad);
    expect(e.happiness).toBe(H.base + H.famine - H.idleMax);
    expect(e.taxes).toBeCloseTo(tax * taxFactor(e.happiness));
    expect(e.taxes).toBeLessThan(tax);
  });

  it('the city happiness is the average of houses with a family (50 with none)', () => {
    const s = emptyGame();
    expect(computeEconomy(s).happiness).toBe(50);
    put(s, 'house', ROADSIDE, 34); // empty plot: ignored
    put(s, 'house', ROADSIDE, 27, 1); // sacred
    put(s, 'house', ROADSIDE, 40, 1); // nothing
    put(s, 'workshop', EAST, 30);
    expect(computeEconomy(s).happiness).toBe(H.base + H.sacred / 2);
  });

  it('idle share counts workers without a job', () => {
    const s = emptyGame();
    expect(idleShare(s)).toBe(0);
    put(s, 'house', ROADSIDE, 27, 3); // 4 workers
    expect(idleShare(s)).toBe(1);
    put(s, 'field', westOf('field'), 29); // 2 jobs
    expect(idleShare(s)).toBe(0.5);
  });

  it('a happy city draws families faster, a sad one slower', () => {
    const chance = RULES.familyChance;
    const town = (happy: boolean) => {
      const s = emptyGame();
      for (const y of [27, 29, 31]) put(s, 'house', ROADSIDE, y, 1);
      put(s, 'workshop', EAST, 27);
      if (happy) for (const y of [29, 32]) put(s, 'garden', EAST, y + 1);
      put(s, 'house', ROADSIDE, 40);
      return s;
    };
    const happy = town(true);
    const f = familyFactor(computeEconomy(happy).happiness);
    expect(f).toBeGreaterThan(1);
    stepMonth(happy, constRng(chance * f - 0.01));
    expect(happy.families).toHaveLength(1);

    const plain = town(false);
    stepMonth(plain, constRng(chance + 0.01));
    expect(plain.families).toHaveLength(0);
  });

  it('counts the houses in each mood', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 27, 1); // sacred + garden: happy
    put(s, 'garden', EAST, 27);
    put(s, 'workshop', EAST, 30); // jobs for all
    put(s, 'house', ROADSIDE, 40, 1); // nothing: content
    put(s, 'house', ROADSIDE, 34); // empty plot: not counted
    expect(computeEconomy(s).moods).toEqual({ happy: 1, neutral: 1, sad: 0 });
    s.famine = true;
    expect(computeEconomy(s).moods).toEqual({ happy: 0, neutral: 1, sad: 1 });
  });
});

describe('happiness on screen (core data)', () => {
  it('house info shows the happiness and the tax it really pays', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'garden', EAST, 27);
    put(s, 'workshop', EAST, 30);
    const info = houseInfo(s, b)!;
    expect(info.happiness).toEqual(houseHappiness(s, b, 0));
    expect(info.tax).toBeCloseTo(HOUSE_LEVELS[1].tax * taxFactor(info.happiness!.value));
    expect(houseInfo(s, put(s, 'house', ROADSIDE, 34))!.happiness).toBeNull();
  });

  it('a sad house shows a sad balloon once no next-level need is missing', () => {
    const s = emptyGame({ famine: true });
    const b = put(s, 'house', ROADSIDE, 40, 1);
    expect(balloonNeed(s, b)).toBe('well'); // the missing need comes first
    put(s, 'well', ROADSIDE, 42);
    expect(balloonNeed(s, b)).toBe('sad'); // market still locked: nothing else to point at
    s.famine = false;
    put(s, 'workshop', EAST, 40);
    put(s, 'workshop', EAST, 43); // enough jobs for a big house too
    expect(balloonNeed(s, b)).toBeNull();
    b.level = 4;
    expect(balloonNeed(s, b)).toBeNull();
    s.famine = true;
    expect(balloonNeed(s, b)).toBe('sad'); // also at the top level
  });
});
