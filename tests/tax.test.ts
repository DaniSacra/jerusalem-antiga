import { describe, expect, it } from 'vitest';
import { changeTax, computeEconomy, HOUSE_LEVELS, houseHappiness, houseInfo, idleShare, RULES, taxFactor, taxJoy, taxRateFactor } from '../src/core';
import { emptyGame, put, ROADSIDE } from './helpers';

const X = RULES.tax;

describe('the tax rate (package G)', () => {
  it('numbers: 20% by default, 0 to 30% in steps of 10, 8 Alegria a step', () => {
    expect(X).toEqual({ default: 20, min: 0, max: 30, step: 10, joyPerStep: 8 });
    expect(emptyGame().taxRate).toBe(20);
  });

  it('− / + move a step within 0..30%; false at the ends', () => {
    const s = emptyGame();
    expect(changeTax(s, 1)).toBe(true);
    expect(s.taxRate).toBe(30);
    expect(changeTax(s, 1)).toBe(false);
    for (let k = 0; k < 3; k++) changeTax(s, -1);
    expect(s.taxRate).toBe(0);
    expect(changeTax(s, -1)).toBe(false);
  });

  it('under the default every house is gladder, over it sadder; none at the default', () => {
    expect([0, 10, 20, 30].map((taxRate) => taxJoy({ taxRate }))).toEqual([16, 8, 0, -8]);
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 40, 2, false, 4);
    const at = (rate: number) => {
      s.taxRate = rate;
      return houseHappiness(s, b, idleShare(s));
    };
    expect(at(20).parts.some((p) => p.kind === 'tax')).toBe(false);
    expect(at(10).value - at(20).value).toBe(8);
    expect(at(30).parts).toContainEqual({ kind: 'tax', value: -8 });
  });

  it('each house pays its tax x rate / 20 (and its mood factor); the house balloon says the same', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 40, 2, false, 4);
    for (const rate of [0, 10, 20, 30]) {
      s.taxRate = rate;
      const want = HOUSE_LEVELS[2].tax * taxFactor(houseHappiness(s, b, idleShare(s)).value) * (rate / 20);
      expect(taxRateFactor(s)).toBe(rate / 20);
      expect(computeEconomy(s).taxes).toBeCloseTo(want, 1); // the economy rounds to cents
      expect(houseInfo(s, b)!.tax).toBeCloseTo(want, 5);
    }
    s.taxRate = 0;
    expect(computeEconomy(s).taxes).toBe(0);
  });
});
