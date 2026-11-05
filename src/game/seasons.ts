import { createRng, RULES, SEASONS, START_SEASON, type Feature, type GameState, type Season } from '../core';
import VISUAL from '../data/visual.json';

/** Stable per-cell hash for picking visual variants. */
export const cellHash = (x: number, y: number) => {
  let h = Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return (h ^ (h >>> 15)) >>> 0;
};

const S = VISUAL.seasons;

export type Drift = 'petals' | 'dust' | null;
/** Leaves of the trees that change over the year (olives and palms keep theirs). */
export type TreeState = 'bare' | 'bloom' | 'leaf' | 'yellow';
export type CropStage = keyof typeof S.crops.stages;
/** What a tree cell shows: olive cells are drawn as olives, almonds or figs (looks only). */
export type TreeKind = Feature | 'almond' | 'fig';

const mixCh = (a: number, b: number, s: number, f: number) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * f);
const mulCh = (a: number, b: number, s: number) => Math.round((((a >> s) & 255) * ((b >> s) & 255)) / 255);

/** Channel-wise blend of two colours (called every frame: no closures). */
export const mixColor = (a: number, b: number, f: number) => (mixCh(a, b, 16, f) << 16) | (mixCh(a, b, 8, f) << 8) | mixCh(a, b, 0, f);

/** Channel-wise product of two colours (two tints over each other). */
export const mulColor = (a: number, b: number) => (mulCh(a, b, 16) << 16) | (mulCh(a, b, 8) << 8) | mulCh(a, b, 0);

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * The rare snowy winters (about 1 in 5), drawn per year from the map seed so a game is
 * reproducible. Looks only. Dry years are a core rule (`GameState.drought`), see DryYears.
 */
export interface YearLuck {
  snow: boolean;
}

export function yearLuck(seed: number, year: number): YearLuck {
  const r = createRng((seed ^ Math.imul(year + 1, 0x9e3779b1)) >>> 0);
  return { snow: r() < S.years.snowChance };
}

/**
 * The core's dry years, as the look needs them: this year is dry (`drought`, from the first week
 * of winter to the end of summer) and the year that just ended was dry (`lastDrought`, which
 * the drought look fades from in the first weeks of autumn).
 */
export type DryYears = Pick<GameState, 'drought' | 'lastDrought'>;

/** Olive cells shown as almond or fig trees (stable per cell, shares in visual.json). */
export function treeKind(f: Feature, x: number, y: number): TreeKind {
  if (f !== 'olive') return f;
  const u = ((cellHash(x, y) >>> 20) % 1000) / 1000;
  return u < S.treeShare.almond ? 'almond' : u < S.treeShare.almond + S.treeShare.fig ? 'fig' : 'olive';
}

/**
 * How the world looks at a moment of the year. Colours are multiplied over the world (`tint`), the
 * camera background (`sky`), the roads, the river and the olives and palms; the grass and sand
 * have their own textures per season, blending into the next season's over its last weeks
 * (`f`, 0..1, spread cell by cell). `snow` and `drought` (0..1) cover the ground in rare years.
 */
export interface SeasonLook {
  season: Season;
  next: Season;
  f: number;
  /** Weeks into the season (0..weeksPerSeason). */
  at: number;
  tint: number;
  sky: number;
  road: number;
  water: number;
  ripple: number;
  trees: number;
  /** Chance that a weather spell is wet, and the weights of light, medium and heavy rain. */
  rain: number;
  levels: number[];
  drift: Drift;
  /** Chimney smoke from the houses, cloud shadows and heat shimmer (0..1). */
  smoke: number;
  clouds: number;
  shimmer: number;
  almond: TreeState;
  fig: TreeState;
  crop: CropStage;
  /** People pick olives and figs by the trees. */
  harvest: boolean;
  /** Snow cover (0..1); wet spells fall as snow while it lasts. */
  snow: number;
  /** Drought (0..1): cracked earth, brown grass, a narrower river, thin crops away from the river. */
  drought: number;
  /** The year is dry (the core's rule), even before the ground shows it: the HUD may mark it. */
  dryYear: boolean;
  /** Changes only when the ground textures must change (grass blend, snow, drought). */
  groundKey: string;
}

type Keys<T> = [number, T][];

/** Value of the last key at or before `at`. */
function phase<T>(keys: Keys<T>, at: number): T {
  let v = keys[0][1];
  for (const [m, k] of keys) if (m <= at) v = k;
  return v;
}

/** Piecewise linear value between keys. */
function ramp(keys: Keys<number>, at: number): number {
  for (let k = 0; k < keys.length - 1; k++) {
    const [m0, v0] = keys[k];
    const [m1, v1] = keys[k + 1];
    if (at < m1) return at <= m0 ? v0 : v0 + ((v1 - v0) * (at - m0)) / (m1 - m0);
  }
  return keys[keys.length - 1][1];
}

const LOOKS = S.looks;
const col = (s: string) => Number(s);
const PH = S.phases as unknown as Record<'almond' | 'fig' | 'crop' | 'drift', Record<Season, Keys<string>>> & { harvest: Record<Season, Keys<number>> };
const DROUGHT_TINT = col(S.droughtLook.tint);

/**
 * The look at `pos` weeks into the game. The drought follows the core: in a dry year's winter rain
 * falls at `winterRain` of its chance (and it never snows), from week `from` + 1 of spring the
 * earth cracks over `ramp` weeks (rain fading with it), all summer it is dry and it fades over the
 * first `fadeInAutumn` weeks of the next autumn.
 */
function buildLook(pos: number, luckOf: (year: number) => YearLuck, dry: DryYears): SeasonLook {
  const M = RULES.weeksPerSeason;
  const k = Math.floor(pos / M) + START_SEASON;
  const season = SEASONS[k % SEASONS.length];
  const next = SEASONS[(k + 1) % SEASONS.length];
  const at = pos - Math.floor(pos / M) * M;
  const luck = luckOf(Math.floor(pos / (M * SEASONS.length)));
  const a = LOOKS[season];
  const b = LOOKS[next];
  const into = at - (M - S.blendWeeks);
  const f = into <= 0 ? 0 : (1 - Math.cos(Math.min(1, into / S.blendWeeks) * Math.PI)) / 2;
  const mix = (x: string, y: string) => mixColor(col(x), col(y), f);
  const num = (x: number, y: number) => x + (y - x) * f;

  const dr = S.drought;
  const dryYear = season === 'autumn' ? false : dry.drought;
  const sn = S.snow;
  const snow = season === 'winter' && luck.snow && !dryYear ? clamp01((at - sn.from) / sn.ramp) * clamp01((sn.to - at) / sn.ramp) : 0;
  const drought =
    season === 'autumn'
      ? dry.lastDrought ? clamp01(1 - at / dr.fadeInAutumn) : 0
      : !dryYear ? 0 : season === 'summer' ? 1 : season === 'spring' ? clamp01((at - dr.from) / dr.ramp) : 0;
  const rain = ramp(a.rain as Keys<number>, at) * (dryYear && season === 'winter' ? dr.winterRain : 1) * (1 - drought);
  const drift = phase(PH.drift[season], at);
  const crop = phase(PH.crop[season], at) as CropStage;
  return {
    season,
    next,
    f,
    at,
    tint: mulColor(mix(a.tint, b.tint), mixColor(0xffffff, DROUGHT_TINT, drought)),
    sky: mix(a.sky, b.sky),
    road: mix(a.road, b.road),
    water: mix(a.water, b.water),
    ripple: mix(a.ripple, b.ripple),
    trees: mulColor(mix(a.trees, b.trees), mixColor(0xffffff, col(S.snowLook.trees), snow)),
    rain,
    levels: a.levels,
    drift: drought > 0.3 ? 'dust' : drift === 'none' ? null : (drift as Drift),
    smoke: Math.max(num(a.smoke, b.smoke), snow),
    clouds: num(a.clouds, b.clouds),
    shimmer: num(a.shimmer, b.shimmer) * (1 + 0.5 * drought),
    almond: phase(PH.almond[season], at) as TreeState,
    fig: phase(PH.fig[season], at) as TreeState,
    crop,
    harvest: phase(PH.harvest[season], at) > 0,
    snow,
    drought,
    dryYear,
    groundKey: `${season},${next},${f.toFixed(3)},${snow.toFixed(3)},${drought.toFixed(3)}`,
  };
}

/**
 * The season clock of a game: the look at a moment (week plus the fraction of the current one),
 * quantized to `stepsPerWeek`, so the same object comes back until it changes (no allocation per
 * frame, and callers can compare by identity).
 */
export class SeasonClock {
  private q = -1;
  /** Dry flags the look was built with (a change rebuilds it). */
  private dryKey = -1;
  private look!: SeasonLook;
  /** Dev hook: fixes the snowy winters and / or makes every year dry (null: the seed and the core). */
  private override: { snow?: boolean; drought?: boolean } | null = null;

  constructor(private seed: number) {}

  luck(year: number): YearLuck {
    const snow = this.override?.snow;
    return snow === undefined ? yearLuck(this.seed, year) : { snow };
  }

  /** Dev hook for the tests: forces a snowy winter and / or a dry year every year (null: back to the seed and the core). */
  force(o: { snow?: boolean; drought?: boolean } | null) {
    this.override = o;
    this.q = -1;
  }

  /** The look at a week plus the fraction of the current one; `dry` is the core's state (dry years). */
  at(week: number, weekFrac: number, dry: DryYears): SeasonLook {
    const q = Math.floor((week + weekFrac) * S.stepsPerWeek);
    const forced = this.override?.drought;
    const d: DryYears = forced === undefined ? dry : { drought: forced, lastDrought: forced };
    const dryKey = (d.drought ? 1 : 0) + (d.lastDrought ? 2 : 0);
    if (q !== this.q || dryKey !== this.dryKey) {
      this.q = q;
      this.dryKey = dryKey;
      this.look = buildLook(q / S.stepsPerWeek, (y) => this.luck(y), d);
    }
    return this.look;
  }
}
