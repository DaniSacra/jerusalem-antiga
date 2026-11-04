import { RULES, SEASONS, START_SEASON, type Season } from '../../core';
import VISUAL from '../../data/visual.json';
import type { SeasonLook } from '../../render/Seasons';
import LOOK from '../look3d.json';
import { hex, lerp, mixColor, smooth } from './color';

const M = RULES.weeksPerSeason;
const S3 = LOOK.seasons;
type Palette = (typeof S3)['spring'];

/** Season of a continuous game position (weeks + fraction) and the weeks into it. */
export function seasonAt(pos: number): { season: Season; index: number; at: number } {
  const n = Math.floor(pos / M);
  const index = (((n + START_SEASON) % SEASONS.length) + SEASONS.length) % SEASONS.length;
  return { season: SEASONS[index], index, at: pos - n * M };
}

/**
 * Blend between two seasons at `pos`: the look changes over `blendWeeks` on each side of a season
 * change (smoothstep), so there is never a sudden switch. Returns the two seasons and the weight of
 * the second (0..1); exactly 0.5 at the change.
 */
export function seasonBlend(pos: number, blend = S3.blendWeeks): { a: Season; b: Season; f: number } {
  const { index, at } = seasonAt(pos);
  const prev = SEASONS[(index + 3) % 4];
  const cur = SEASONS[index];
  const next = SEASONS[(index + 1) % 4];
  if (at > M - blend) return { a: cur, b: next, f: smooth((at - (M - blend)) / (2 * blend)) };
  if (at < blend) return { a: prev, b: cur, f: smooth((at + blend) / (2 * blend)) };
  return { a: cur, b: cur, f: 0 };
}

/** The look of the land, sky and plants at a moment of the year, continuous over time. */
export interface Season3D {
  sun: number;
  sunI: number;
  /** Highest sun elevation of the day (degrees). */
  elev: number;
  sky: number;
  haze: number;
  fog: number;
  grass: number;
  grassDark: number;
  sand: number;
  sandDark: number;
  leaf: number;
  leafDark: number;
  /** Small flowers on the grass (0..1), falling leaves, dust in the air, heat shimmer. */
  flowers: number;
  leaves: number;
  dust: number;
  heat: number;
  /** Snow cover and drought from the game's season clock (0..1). */
  snow: number;
  drought: number;
}

const pal = (s: Season): Palette => S3[s];

const DR = LOOK.drought;

/** The 3D look at `pos` (weeks + fraction), on top of the 2D season clock's look (snow, drought). */
export function season3d(pos: number, look: Pick<SeasonLook, 'snow' | 'drought'>): Season3D {
  const { a, b, f } = seasonBlend(pos);
  const A = pal(a);
  const B = pal(b);
  const c = (k: keyof Palette) => mixColor(hex(A[k] as string), hex(B[k] as string), f);
  const n = (k: keyof Palette) => lerp(A[k] as number, B[k] as number, f);
  const d = look.drought;
  const snow = look.snow;
  return {
    sun: mixColor(c('sun'), hex(DR.sun), d * 0.5),
    sunI: n('sunI') * (1 + 0.08 * d),
    elev: n('elev'),
    sky: mixColor(c('sky'), hex(LOOK.snow.sky), snow * 0.6),
    haze: mixColor(c('haze'), hex(LOOK.snow.sky), snow * 0.5),
    fog: n('fog'),
    grass: mixColor(c('grass'), hex(DR.grass), d),
    grassDark: mixColor(c('grassDark'), hex(DR.grassDark), d),
    sand: mixColor(c('sand'), hex(DR.sand), d),
    sandDark: mixColor(c('sandDark'), hex(DR.sandDark), d),
    leaf: c('leaf'),
    leafDark: c('leafDark'),
    flowers: n('flowers') * (1 - d) * (1 - snow),
    leaves: n('leaves'),
    dust: Math.max(n('dust'), d * 0.8),
    heat: n('heat') * (1 + 0.5 * d),
    snow,
    drought: d,
  };
}

// ------------------------------------------------------------------ crops

type Stage = keyof typeof VISUAL.seasons.crops.stages;
const STAGES = VISUAL.seasons.crops.stages;
const CROP = LOOK.crops;

/**
 * The crop calendar of the 2D game (visual.json phases) as a list of (week of the year from the
 * start of spring, stage), with the 3D addition of plowed fields in the first weeks of autumn.
 */
const CALENDAR: { w: number; stage: Stage }[] = (() => {
  const keys: { w: number; stage: Stage }[] = [];
  const phases = VISUAL.seasons.phases.crop as Record<Season, [number, string][]>;
  SEASONS.forEach((s, i) => {
    if (s === 'autumn') keys.push({ w: i * M, stage: 'plowed' });
    for (const [wk, stage] of phases[s]) {
      const w = i * M + (s === 'autumn' && wk === 0 ? CROP.plowedWeeks : wk);
      keys.push({ w, stage: stage as Stage });
    }
  });
  return keys.sort((p, q) => p.w - q.w);
})();

/** How the fields look: crop height (0..1, from the 2D stage scales), crop and soil colour, the stage. */
export interface CropLook {
  height: number;
  color: number;
  soil: number;
  stage: Stage;
}

/**
 * Fields at `pos`, growing smoothly from one stage of the calendar to the next: plowed in early
 * autumn, sprouting and growing through winter, ripe and gold in spring, straw in summer. In a
 * drought the crops away from the river dry out.
 */
export function cropLook(pos: number, drought = 0): CropLook {
  const { index, at } = seasonAt(pos);
  const w = index * M + at;
  const year = SEASONS.length * M;
  let k = CALENDAR.length - 1;
  for (let i = 0; i < CALENDAR.length; i++) if (CALENDAR[i].w <= w) k = i;
  const a = CALENDAR[k];
  const b = CALENDAR[(k + 1) % CALENDAR.length];
  const span = ((b.w - a.w + year) % year) || year;
  const into = ((w - a.w + year) % year) / span;
  // Ease into the next stage over the second half of the span only, so each stage is seen.
  const f = smooth((into - 0.5) * 2);
  const colorOf = (s: Stage) => hex(CROP.colors[s]);
  const height = lerp(STAGES[a.stage].scale, STAGES[b.stage].scale, f);
  let color = mixColor(colorOf(a.stage), colorOf(b.stage), f);
  color = mixColor(color, colorOf('dry'), drought * 0.8);
  const plowedness = a.stage === 'plowed' ? 1 - f : b.stage === 'plowed' ? f : 0;
  const soil = mixColor(mixColor(hex(CROP.soil), hex(CROP.soilPlowed), plowedness), hex(CROP.soilDry), drought);
  return { height: height * (1 - drought * 0.4), color, soil, stage: f < 0.5 ? a.stage : b.stage };
}

export const isHarvest = (stage: Stage) => stage === 'ripe' || stage === 'gold';
export const isPlowing = (stage: Stage) => stage === 'plowed' || stage === 'sprout';

