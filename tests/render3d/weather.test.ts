import { describe, expect, it } from 'vitest';
import { WeatherClock, type WeekClimate } from '../../src/render3d/time/weather';
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

  it('rains about as often as the season clock says', () => {
    const w = new WeatherClock(3, climate(0.5));
    const wet = Array.from({ length: 400 }, (_, k) => w.spell(k).strength > 0).filter(Boolean).length;
    expect(wet / 400).toBeGreaterThan(0.4);
    expect(wet / 400).toBeLessThan(0.6);
    const dry = new WeatherClock(3, climate(0));
    expect(Array.from({ length: 100 }, (_, k) => dry.spell(k).strength).every((s) => s === 0)).toBe(true);
  });

  it('fades rain in and out (no sudden start) and wets the ground, which dries afterwards', () => {
    const w = new WeatherClock(5, climate(1));
    for (let p = 0; p < 20; p += 0.005) {
      expect(Math.abs(w.at(p).rain - w.at(p + 0.005).rain)).toBeLessThan(0.15);
      expect(Math.abs(w.at(p).wet - w.at(p + 0.005).wet)).toBeLessThan(0.1);
    }
    const sp = w.spell(2);
    expect(w.at(2 + (sp.start + sp.end) / 2).rain).toBeGreaterThan(0);
    expect(w.at(2 + sp.end).wet).toBeGreaterThan(0);
  });

  it('dries completely a few weeks after the last rain', () => {
    let wetWeeks = true;
    const w = new WeatherClock(9, (k) => ({ rain: k < 3 ? 1 : 0, levels: [0, 0, 1], snow: 0, season: 'summer' }));
    expect(w.at(2.99).wet).toBeGreaterThan(0);
    wetWeeks = w.at(6.5).wet > 0;
    expect(wetWeeks).toBe(false);
    expect(w.at(6.5).puddles).toBe(0);
  });

  it('falls as snow only on snowy ground', () => {
    const snowy = new WeatherClock(4, climate(1, 1));
    const plain = new WeatherClock(4, climate(1, 0));
    expect(snowy.spell(0).snow).toBe(true);
    expect(plain.spell(0).snow).toBe(false);
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
