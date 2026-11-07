import { describe, expect, it } from 'vitest';
import { balloonNeed, happinessOn, computeEconomy, birthFactor, houseHappiness, houseInfo, HOUSE_LEVELS, idleShare, moodOf, RULES, taxFactor } from '../src/core';
import { GOALS, unlockingGoal } from '../src/core';
import { atHarvest, consecrate, EAST, emptyGame, put, ROADSIDE, westOf } from './helpers';

const H = RULES.happiness;
const kinds = (h: { parts: { kind: string }[] }) => h.parts.map((p) => p.kind);

describe('house happiness', () => {
  it('starts at the base and adds each covering service', () => {
    const s = emptyGame();
    const far = put(s, 'house', ROADSIDE, 40, 1); // beyond the altar's radius
    expect(houseHappiness(s, far, 0)).toEqual({ value: H.base, mood: 'neutral', parts: [] });

    const near = put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'plaza', ROADSIDE, 29);
    put(s, 'park', EAST, 27);
    put(s, 'market', EAST, 29);
    const h = houseHappiness(s, near, 0);
    expect(kinds(h)).toEqual(['sacred', 'park', 'plaza', 'market']);
    expect(h.value).toBe(H.base + H.sacred + H.park + H.plaza + H.market);
    expect(h.mood).toBe('happy');
  });

  it('each source alone adds its points: plaza +5, park +20, altar +10', () => {
    expect([H.plaza, H.park, H.sacred, H.market]).toEqual([5, 20, 10, 5]);
    const alone = (kind: 'plaza' | 'park' | null, y: number) => {
      const s = emptyGame();
      const b = put(s, 'house', ROADSIDE, y, 1);
      if (kind) put(s, kind, EAST, y);
      return houseHappiness(s, b, 0);
    };
    expect(alone('plaza', 40)).toMatchObject({ value: H.base + 5, parts: [{ kind: 'plaza', value: 5 }] });
    expect(alone('park', 40)).toMatchObject({ value: H.base + 20, parts: [{ kind: 'park', value: 20 }] });
    expect(alone(null, 27)).toMatchObject({ value: H.base + 10, parts: [{ kind: 'sacred', value: 10 }] }); // by the altar
    expect(alone(null, 40).value).toBe(H.base); // out of the altar's radius: nothing
  });

  it('the temple cheers like the altar, within its radius, only once consecrated', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 40, 1);
    expect(kinds(houseHappiness(s, b, 0))).toEqual([]);
    put(s, 'temple', EAST, 36);
    expect(kinds(houseHappiness(s, b, 0))).toEqual([]); // marked: no cheer yet
    consecrate(s);
    expect(houseHappiness(s, b, 0)).toMatchObject({ value: H.base + H.sacred, parts: [{ kind: 'sacred', value: H.sacred }] });
  });

  it('a park only cheers houses within its radius, and only when connected', () => {
    const s = emptyGame();
    const house = put(s, 'house', ROADSIDE, 40, 1);
    put(s, 'park', 1, 1); // disconnected and far
    expect(kinds(houseHappiness(s, house, 0))).toEqual([]);
    put(s, 'park', EAST, 40);
    expect(kinds(houseHappiness(s, house, 0))).toEqual(['park']);
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
  it('taxes and birth chance are plain while content and scale toward the extremes', () => {
    for (const f of [taxFactor, birthFactor]) {
      expect(f(H.sad)).toBe(1);
      expect(f(50)).toBe(1);
      expect(f(H.happy - 1)).toBe(1);
    }
    expect(taxFactor(100)).toBeCloseTo(H.taxMax);
    expect(taxFactor(0)).toBeCloseTo(H.taxMin);
    expect(birthFactor(100)).toBeCloseTo(H.birthMax);
    expect(birthFactor(0)).toBeCloseTo(H.birthMin);
    expect(taxFactor(H.happy)).toBe(1);
    expect(taxFactor((H.happy + 100) / 2)).toBeCloseTo((1 + H.taxMax) / 2);
  });

  it('a happy house pays more tax and a sad one less', () => {
    const tax = HOUSE_LEVELS[1].tax;
    const happy = emptyGame();
    put(happy, 'house', ROADSIDE, 27, 1);
    put(happy, 'park', EAST, 27);
    put(happy, 'workshop', EAST, 30); // jobs for everyone
    const h = computeEconomy(happy);
    expect(h.happiness).toBe(H.base + H.sacred + H.park);
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
    put(s, 'workshop', EAST, 30); // jobs for every worker of the two tents: nobody idle
    put(s, 'workshop', EAST, 33);
    expect(idleShare(s)).toBe(0);
    expect(computeEconomy(s).happiness).toBe(H.base + H.sacred / 2);
  });

  it('idle share counts workers without a job', () => {
    const s = emptyGame();
    expect(idleShare(s)).toBe(0);
    put(s, 'house', ROADSIDE, 27, 3, false, 5); // 5 workers
    expect(idleShare(s)).toBe(1);
    put(s, 'field', westOf('field'), 29); // 2 jobs at harvest
    atHarvest(s);
    expect(idleShare(s)).toBe(0.6);
  });

  it('counts the houses in each mood', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 27, 1); // sacred + park: happy
    put(s, 'park', EAST, 27);
    put(s, 'workshop', EAST, 30); // jobs for all
    put(s, 'workshop', EAST, 33);
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
    put(s, 'park', EAST, 27);
    put(s, 'workshop', EAST, 30);
    const info = houseInfo(s, b)!;
    expect(info.happiness).toEqual(houseHappiness(s, b, 0));
    expect(info.tax).toBeCloseTo(HOUSE_LEVELS[1].tax * taxFactor(info.happiness!.value));
    expect(houseInfo(s, put(s, 'house', ROADSIDE, 34))!.happiness).toBeNull();
  });

  it('a sad house shows a sad balloon once no next-level need is missing', () => {
    const s = emptyGame({ famine: true });
    const b = put(s, 'house', ROADSIDE, 40, 2);
    expect(balloonNeed(s, b)).toBe('plaza'); // the missing need comes first
    put(s, 'plaza', ROADSIDE, 42);
    expect(balloonNeed(s, b)).toBe('sad'); // the house has what a stone house needs: nothing else to point at
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

describe('happiness before the park', () => {
  it('is off until the park is unlocked: content, no reasons, plain tax and births', () => {
    const s = emptyGame({ famine: true });
    s.unlocked = s.unlocked.filter((k) => k !== 'park');
    expect(happinessOn(s)).toBe(false);
    const b = put(s, 'house', ROADSIDE, 40, 1); // famine and idle: would be sad
    expect(houseHappiness(s, b, 1)).toEqual({ value: H.base, mood: 'neutral', parts: [] });
    const e = computeEconomy(s);
    expect(e.taxes).toBe(HOUSE_LEVELS[1].tax);
    expect(birthFactor(e.happiness)).toBe(1);
    expect(balloonNeed(s, b)).not.toBe('sad');
    s.unlocked.push('park');
    expect(happinessOn(s)).toBe(true);
    expect(houseHappiness(s, b, 1).mood).toBe('sad');
  });

  it('turns on with the goal that unlocks the park (goal 10), not before', () => {
    const n = unlockingGoal('park')!;
    expect(n).toBe(10);
    expect(RULES.startUnlocked).not.toContain('park');
    const s = emptyGame();
    s.unlocked = [...RULES.startUnlocked];
    for (const g of GOALS.slice(0, n - 1)) if (g.unlock) s.unlocked.push(g.unlock);
    expect(happinessOn(s)).toBe(false);
    s.unlocked.push(GOALS[n - 1].unlock!);
    expect(happinessOn(s)).toBe(true);
  });
});

