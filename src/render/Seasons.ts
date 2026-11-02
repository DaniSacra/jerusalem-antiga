import { RULES, SEASONS, type Season } from '../core';
import VISUAL from '../data/visual.json';

export type Drift = 'petals' | 'dust' | 'leaves' | null;

/**
 * How a season looks: its grass (blending into the next one's by `f`, 0..1), colours multiplied
 * over the world, the trees and the sand, and its weather.
 */
export interface SeasonLook {
  season: Season;
  next: Season;
  f: number;
  tint: number;
  trees: number;
  sand: number;
  /** Chance that a weather spell brings rain or snow, and the share of it that is snow. */
  rain: number;
  snow: number;
  drift: Drift;
}

const LOOKS = Object.fromEntries(
  SEASONS.map((k) => {
    const l = VISUAL.seasons.looks[k];
    return [k, { season: k, next: k, f: 0, tint: Number(l.tint), trees: Number(l.trees), sand: Number(l.sand), rain: l.rain, snow: l.snow, drift: l.drift as Drift }];
  }),
) as Record<Season, SeasonLook>;

/** Channel-wise blend of two colours. */
export const mixColor = (a: number, b: number, f: number) => {
  const ch = (s: number) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * f);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/** Channel-wise product of two colours (two tints over each other). */
export const mulColor = (a: number, b: number) => {
  const ch = (s: number) => Math.round((((a >> s) & 255) * ((b >> s) & 255)) / 255);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/**
 * The look at a moment of the game (month plus the fraction of the current one): the season's own
 * colours, blending into the next season over its last `blendMonths` months.
 */
export function seasonLook(month: number, monthFrac: number): SeasonLook {
  const M = RULES.monthsPerSeason;
  const pos = month + monthFrac;
  const k = Math.floor(pos / M) % SEASONS.length;
  const a = LOOKS[SEASONS[k]];
  const b = LOOKS[SEASONS[(k + 1) % SEASONS.length]];
  const blend = VISUAL.seasons.blendMonths;
  const into = (pos % M) - (M - blend);
  if (into <= 0) return a;
  const f = (1 - Math.cos(Math.min(1, into / blend) * Math.PI)) / 2;
  return {
    ...(f < 0.5 ? a : b),
    season: a.season,
    next: b.season,
    f,
    tint: mixColor(a.tint, b.tint, f),
    trees: mixColor(a.trees, b.trees, f),
    sand: mixColor(a.sand, b.sand, f),
  };
}
