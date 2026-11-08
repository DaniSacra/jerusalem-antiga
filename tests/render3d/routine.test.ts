import { describe, expect, it } from 'vitest';
import LOOK from '../../src/render3d/look3d.json';
import { actShare, routine } from '../../src/render3d/time/routine';

const D = LOOK.day;
/** The time of day at a share of the sun's arc (0 sunrise, 1 sunset). */
const at = (arc: number) => (((D.sunrise + arc * (D.sunset - D.sunrise)) % 1) + 1) % 1;
const R = LOOK.routine;

describe('a day in the city (D1)', () => {
  it('the roads are busiest going to work and coming home, calmer in between', () => {
    const morning = routine(at(R.toWork)).walkers;
    const home = routine(at(R.home)).walkers;
    const lull = routine(at((R.toWork + R.marketAt) / 2 - 0.02)).walkers;
    expect(morning).toBeCloseTo(1);
    expect(home).toBeCloseTo(1);
    expect(lull).toBeLessThan(0.9);
    expect(lull).toBeGreaterThanOrEqual(R.calm);
  });

  it('the market fills at noon and is thin early and late', () => {
    expect(routine(at(R.marketAt)).market).toBeCloseTo(1);
    expect(routine(at(0.02)).market).toBeCloseTo(R.marketLow);
    expect(routine(at(0.95)).market).toBeLessThan(0.5);
    expect(routine(at(R.marketAt)).walkers).toBeGreaterThan(0.9); // people walk to the market too
  });

  it('children play by day and are all in before the dark; nobody plays at night', () => {
    expect(routine(at(0.5)).play).toBe(1);
    expect(routine(at(0.9)).play).toBeGreaterThan(0);
    expect(routine(at(0.9)).play).toBeLessThan(1);
    expect(routine(at(1)).play).toBe(0);
    expect(routine(at(1.2)).play).toBe(0);
  });

  it('neighbours talk most at the end of the afternoon', () => {
    expect(routine(at(R.talkAt)).talk).toBeCloseTo(1);
    expect(routine(at(0.3)).talk).toBeCloseTo(R.talkLow);
  });

  it('the work runs from after sunrise to near sunset, none at night', () => {
    expect(routine(at(0.02)).work).toBe(0);
    expect(routine(at(0.5)).work).toBe(1);
    expect(routine(at(0.99)).work).toBe(0);
    expect(routine(at(1.3)).work).toBe(0);
  });

  it('every factor stays 0..1 over the whole day', () => {
    for (let t = 0; t < 1; t += 0.01) for (const v of Object.values(routine(t))) expect(v).toBeGreaterThanOrEqual(0), expect(v).toBeLessThanOrEqual(1);
  });

  it('actShare: buyers, children and talkers follow the hour; the others stand as the street says', () => {
    const r = routine(at(0.9));
    expect(actShare(r, 'buy')).toBe(r.market);
    expect(actShare(r, 'play')).toBe(r.play);
    expect(actShare(r, 'talk')).toBe(r.talk);
    expect(actShare(r, 'grind')).toBe(1);
  });
});
