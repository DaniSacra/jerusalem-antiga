import { describe, expect, it } from 'vitest';
import { spellChance, WeatherClock, type WeekClimate } from '../../src/render3d/time/weather';
import LOOK from '../../src/render3d/look3d.json';
import { fieldHands, frameLight, streetShare } from '../../src/render3d/time/light';
import { season3d } from '../../src/render3d/time/season';

const climate = (rain: number, snow = 0): ((w: number) => WeekClimate) => () => ({ rain, levels: [0.4, 0.4, 0.2], snow, season: 'winter' });

describe('weather (deterministic, looks only)', () => {
  it('is the same for the same seed and differs between seeds', () => {
    const a = new WeatherClock(7, climate(0.5));
    const b = new WeatherClock(7, climate(0.5));
    const c = new WeatherClock(8, climate(0.5));
    const seq = (w: WeatherClock) => Array.from({ length: 40 }, (_, k) => w.spell(k).strength);
    expect(seq(a)).toEqual(seq(b));
    expect(seq(a)).not.toEqual(seq(c));
  });

  it('rains about the same share of the time as before (chance of a wet week × wetShare)', () => {
    for (const rain of [0.2, 0.55]) {
      const w = new WeatherClock(3, climate(rain));
      let wet = 0;
      const n = 4000;
      for (let k = 0; k < n; k++) if (w.at(10 + k * 0.25).rain > 0) wet++;
      const share = wet / n;
      expect(share).toBeGreaterThan(rain * LOOK.weather.wetShare * 0.75);
      expect(share).toBeLessThan(rain * LOOK.weather.wetShare * 1.3);
    }
    const dry = new WeatherClock(3, climate(0));
    expect(Array.from({ length: 100 }, (_, k) => dry.spell(k).strength).every((s) => s === 0)).toBe(true);
    expect(spellChance(0)).toBe(0);
  });

  it('rains in spells of several weeks, across the turn of the week, and never flickers', () => {
    const w = new WeatherClock(11, climate(0.55));
    // Every stretch of rain lasts at least the shortest spell (less the fades), never a few days.
    let run = 0;
    let crossed = 0;
    const runs: number[] = [];
    const dt = 0.02;
    for (let p = 0; p < 600; p += dt) {
      const raining = w.at(p).rain > 0.05;
      if (raining) {
        run += dt;
        if (Math.floor(p) !== Math.floor(p - dt) && run > dt) crossed++;
      } else if (run) {
        runs.push(run);
        run = 0;
      }
    }
    expect(runs.length).toBeGreaterThan(5);
    expect(Math.min(...runs)).toBeGreaterThan(LOOK.weather.spellWeeks[0] - 2 * LOOK.weather.fadeWeeks);
    expect(crossed).toBeGreaterThan(runs.length);
    // No sudden start or stop: the change over a frame at 3x (a sixtieth of a second, 3 / 3.2 s weeks) stays tiny.
    const frame = 3 / 60 / 3.2;
    for (let p = 0; p < 200; p += frame) expect(Math.abs(w.at(p).rain - w.at(p + frame).rain)).toBeLessThan(0.05);
  });

  it('fades rain in and out (no sudden start) and wets the ground, which dries afterwards', () => {
    const w = new WeatherClock(5, climate(1));
    for (let p = 0; p < 20; p += 0.005) {
      expect(Math.abs(w.at(p).rain - w.at(p + 0.005).rain)).toBeLessThan(0.15);
      expect(Math.abs(w.at(p).wet - w.at(p + 0.005).wet)).toBeLessThan(0.1);
    }
    const k = [...Array(20).keys()].find((n) => w.spell(n).strength > 0)!;
    const sp = w.spell(k);
    expect(w.at((sp.start + sp.end) / 2).rain).toBeGreaterThan(0);
    expect(w.at(sp.end).wet).toBeGreaterThan(0);
  });

  it('dries completely a few weeks after the last rain, and a spell stops before a week without rain', () => {
    const w = new WeatherClock(9, (k) => ({ rain: k < 3 ? 1 : 0, levels: [0, 0, 1], snow: 0, season: 'summer' }));
    const last = [0, 1, 2].map((k) => w.spell(k)).filter((s) => s.strength > 0);
    expect(last.length).toBeGreaterThan(0);
    for (const s of last) expect(s.end).toBeLessThanOrEqual(3);
    expect(w.at(3.5).rain).toBe(0);
    expect(w.at(12).wet).toBe(0);
    expect(w.at(12).puddles).toBe(0);
  });

  it('falls as snow only on snowy ground', () => {
    const snowy = new WeatherClock(4, climate(1, 1));
    const plain = new WeatherClock(4, climate(1, 0));
    const k = [...Array(40).keys()].find((n) => snowy.spell(n).strength > 0)!;
    expect(snowy.spell(k).snow).toBe(true);
    expect(plain.spell(k).snow).toBe(false);
  });
});

describe('light of a frame and the crowd', () => {
  const autumn = season3d(5, { snow: 0, drought: 0 });
  const calm = { rain: 0, snowing: false, overcast: 0, wet: 0, puddles: 0, wind: 0 };
  const storm = { ...calm, rain: 1, overcast: 1, wet: 1 };

  it('dims the sun and greys the sky in the rain', () => {
    const sun = frameLight(0.3, 0.3, 1, autumn, calm, 0);
    const rain = frameLight(0.3, 0.3, 1, autumn, storm, 0);
    expect(rain.sunIntensity).toBeLessThan(sun.sunIntensity * 0.5);
    expect(rain.clouds).toBe(1);
    expect(rain.shadow).toBeLessThan(sun.shadow);
    expect(rain.fogScale).toBeLessThan(sun.fogScale);
  });

  it('shows stars and lit windows at night only', () => {
    const day = frameLight(0.3, 0.3, 1, autumn, calm, 0);
    const night = frameLight(0.75, 0.75, 1, autumn, calm, 0);
    expect(day.stars).toBe(0);
    expect(night.stars).toBeGreaterThan(0.5);
    expect(day.windows).toBe(0);
    expect(night.windows).toBe(1);
    expect(night.night).toBe(1);
  });

  it('keeps nights lighter at high speed (amplitude)', () => {
    expect(frameLight(0.75, 0.75, 0.3, autumn, calm, 0).night).toBeCloseTo(0.3);
  });

  it('empties the streets at night and in the rain, fills the fields at the harvest', () => {
    expect(streetShare(0, 0)).toBe(1);
    expect(streetShare(1, 0)).toBeLessThan(0.5);
    expect(streetShare(0, 1)).toBeLessThan(0.5);
    expect(streetShare(1, 1)).toBeLessThan(streetShare(1, 0));
    expect(fieldHands(true, false, 0, 0)).toBeGreaterThan(fieldHands(false, false, 0, 0));
    expect(fieldHands(true, false, 1, 0)).toBeLessThan(0.5);
  });
});
