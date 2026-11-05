import { describe, expect, it } from 'vitest';
import { advanceDay, DAY_SECONDS, dayAmplitude, dayKeyLight, dayPhase, dayTime, follow, nightness, shownTime, sunArc, sunDirection, windowShare } from '../../src/render3d/time/day';

const channels = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const close = (a: number, b: number, tol: number) => channels(a).every((v, i) => Math.abs(v - channels(b)[i]) <= tol);

describe('day cycle', () => {
  it('maps the week fraction to the time of day, wrapping', () => {
    expect(dayTime(0)).toBe(0);
    expect(dayTime(0.25)).toBe(0.25);
    expect(dayTime(1.25)).toBeCloseTo(0.25);
    expect(dayTime(-0.25)).toBeCloseTo(0.75);
  });

  it('goes dawn -> day -> dusk -> night -> dawn', () => {
    const phases = [0.01, 0.3, 0.6, 0.8, 0.99].map(dayPhase);
    expect(phases).toEqual(['dawn', 'day', 'dusk', 'night', 'dawn']);
  });

  it('keeps the key light continuous over the whole day, across midnight and the wrap', () => {
    for (let t = 0; t < 1; t += 0.001) {
      const a = dayKeyLight(t);
      const b = dayKeyLight(t + 0.001);
      expect(close(a.sun, b.sun, 12)).toBe(true);
      expect(close(a.top, b.top, 12)).toBe(true);
      expect(Math.abs(a.sunI - b.sunI)).toBeLessThan(0.2);
    }
    expect(dayKeyLight(0)).toEqual(dayKeyLight(1));
  });

  it('is darkest at night and fully lit at midday', () => {
    expect(nightness(0.27)).toBe(0);
    expect(nightness(0.8)).toBe(1);
    expect(nightness(0.6)).toBeGreaterThan(0);
    expect(nightness(0.6)).toBeLessThan(1);
  });

  it('moves the sun from east (morning) through south and high (noon) to west (evening)', () => {
    const morning = sunDirection(0.05, 60);
    const noon = sunDirection(sunArcTime(0.5), 60);
    const evening = sunDirection(0.55, 60);
    expect(morning.x).toBeGreaterThan(0.5);
    expect(evening.x).toBeLessThan(-0.5);
    expect(noon.y).toBeGreaterThan(morning.y);
    expect(noon.y).toBeGreaterThan(evening.y);
    expect(noon.z).toBeGreaterThan(0.2);
    expect(morning.up && noon.up && evening.up).toBe(true);
    expect(sunDirection(0.8, 60).up).toBe(false);
  });

  it('casts longer shadows (lower sun) in winter than in summer', () => {
    const t = sunArcTime(0.5);
    expect(sunDirection(t, 32).y).toBeLessThan(sunDirection(t, 72).y);
  });

  it('turns the light direction without jumps at dusk, midnight and dawn', () => {
    for (let t = 0; t < 1; t += 0.002) {
      const a = sunDirection(t, 50);
      const b = sunDirection(t + 0.002, 50);
      expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeLessThan(0.1);
    }
  });

  it('lights windows in the evening, keeps a few lit late, none by day', () => {
    expect(windowShare(0.3)).toBe(0);
    expect(windowShare(0.7)).toBe(1);
    expect(windowShare(0.95)).toBeGreaterThan(0);
    expect(windowShare(0.95)).toBeLessThan(0.5);
    expect(windowShare(0.1)).toBe(0);
  });

  it('damps the cycle when a day lasts only a second, full at 1x', () => {
    expect(dayAmplitude(3.2)).toBe(1);
    expect(dayAmplitude(0.8)).toBeCloseTo(0.3);
    expect(dayAmplitude(0.3)).toBeCloseTo(0.3);
    const demo = dayAmplitude(60 / 52);
    expect(demo).toBeGreaterThan(0.3);
    expect(demo).toBeLessThan(1);
  });

  it('pulls the shown time towards noon at low amplitude', () => {
    expect(shownTime(0.8, 1)).toBeCloseTo(0.8);
    expect(shownTime(0.27, 0.2)).toBeCloseTo(0.27);
    const midnight = shownTime(0.77, 0.3);
    expect(Math.abs(midnight - 0.27)).toBeLessThan(0.16);
  });

  it('follows a target smoothly, independent of the frame rate', () => {
    let a = 0;
    for (let k = 0; k < 60; k++) a = follow(a, 1, 1 / 60, 1);
    let b = 0;
    for (let k = 0; k < 30; k++) b = follow(b, 1, 1 / 30, 1);
    expect(a).toBeCloseTo(b, 6);
    expect(a).toBeCloseTo(1 - Math.exp(-1), 6);
  });
});

/** Time of day at a share of the sun's arc. */
function sunArcTime(share: number) {
  for (let t = 0; t < 1; t += 0.0005) if (sunArc(t) >= share) return t;
  return 0.3;
}

describe('the day clock (apart from the game week)', () => {
  it('a full day lasts DAY_SECONDS of real time, from the config', () => {
    expect(DAY_SECONDS).toBe(90);
    let t = 0;
    for (let k = 0; k < 90; k++) t = advanceDay(t, 1, true);
    expect(Math.min(t, 1 - t)).toBeCloseTo(0, 9);
    expect(advanceDay(0, 45, true)).toBeCloseTo(0.5);
  });

  it('stands still while paused and wraps past midnight', () => {
    expect(advanceDay(0.3, 10, false)).toBeCloseTo(0.3);
    expect(advanceDay(0.95, 9, true, 90)).toBeCloseTo(0.05);
  });

  it('a custom length (?day=) is honoured', () => {
    expect(advanceDay(0, 30, true, 120)).toBeCloseTo(0.25);
    expect(advanceDay(0.2, 30, true, 0)).toBeCloseTo(0.2); // no length: no movement
  });
});
