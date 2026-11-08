import { createRng, type Season } from '../../core';
import LOOK from '../look3d.json';
import { clamp01, lerp, smooth } from './color';
import { seasonAt } from './season';

const W = LOOK.weather;

/** What the season clock says about a week: chance of a wet week, weights of light/medium/heavy rain, snow cover. */
export interface WeekClimate {
  /** Chance of a wet week: the share of the time it rains is `rain × wetShare`. */
  rain: number;
  levels: number[];
  snow: number;
  season: Season;
}

/** The weather drawn once from the seed for one week: the wet spell that sets in that week (if any) and the week's wind. */
export interface Spell {
  /** Rain strength 0..1 (0: no spell sets in this week). */
  strength: number;
  /** Start and end of the wet spell, in weeks of the game (it may last several weeks past this one). */
  start: number;
  end: number;
  /** Falls as snow (the ground was snowy when it set in). */
  snow: boolean;
  /** Wind strength 0..1 over the week (0: calm). */
  wind: number;
}

/** Weather at a moment. */
export interface WeatherNow {
  /** Rain or snow falling now (0..1). */
  rain: number;
  snowing: boolean;
  /** Extra cloud cover from the weather (0..1), rising a little before the rain. */
  overcast: number;
  /** Ground wetness (0..1): rises in the rain, dries over days after it. */
  wet: number;
  /** Puddles on the roads (0..1), only once the ground is well soaked. */
  puddles: number;
  wind: number;
}

const hashWeek = (seed: number, week: number) => (Math.imul(seed ^ 0x5bd1e995, 31) + Math.imul(week + 1, 0x9e3779b1)) >>> 0;

/** Mean length of a wet spell (weeks). */
const MEAN_WEEKS = (W.spellWeeks[0] + W.spellWeeks[1]) / 2;
/** Weeks back a spell can still be raining (`rain`) or drying (`wet`) at a moment. */
const RAIN_BACK = Math.ceil(W.spellWeeks[1] + W.overcastLead);
const WET_BACK = Math.ceil(W.spellWeeks[1] + Math.max(...Object.values(W.dryWeeks)));

/**
 * The chance that a wet spell sets in during a week, so that about `rain × wetShare` of the time is
 * wet with spells of `spellWeeks` (spells that overlap count once: 1 − e^(−p·L) of the time).
 */
export function spellChance(rain: number): number {
  const share = Math.min(0.95, rain * W.wetShare);
  return share > 0 ? -Math.log(1 - share) / MEAN_WEEKS : 0;
}

/**
 * Weather of a game, deterministic from the map seed: each week draws whether a wet spell sets in
 * (with the season clock's chance of rain, so dry years and summers stay dry), how strong it is, how
 * long it lasts (`spellWeeks`: several weeks, across the turn of the week) and when in the week it
 * starts, and whether it is a windy week. Rain fades in and out over `fadeWeeks`. Looks only:
 * nothing here touches the game state.
 */
export class WeatherClock {
  private cache = new Map<number, Spell>();

  constructor(private seed: number, private climate: (week: number) => WeekClimate) {}

  /** Forgets the drawn weeks (after the season clock's overrides change). */
  reset() {
    this.cache.clear();
  }

  spell(week: number): Spell {
    let sp = this.cache.get(week);
    if (sp) return sp;
    const r = createRng(hashWeek(this.seed, week));
    const c = this.climate(week);
    const wet = r() < spellChance(c.rain);
    const lv = r();
    const level = lv < c.levels[0] ? 0 : lv < c.levels[0] + c.levels[1] ? 1 : 2;
    const len = lerp(W.spellWeeks[0], W.spellWeeks[1], r());
    const start = week + r();
    // A spell stops before a week that never rains (summer, a dry spring's end): dry seasons stay dry.
    let end = start + len;
    if (wet) for (let k = 1; week + k < end; k++) if (this.climate(week + k).rain <= 0) end = Math.min(end, week + k);
    const windy = r() < W.windChance[c.season];
    const windK = r();
    sp = { strength: wet ? W.strength[level] : 0, start, end, snow: wet && c.snow > 0.2, wind: windy ? 0.5 + 0.5 * windK : 0 };
    if (this.cache.size > 128) this.cache.clear();
    this.cache.set(week, sp);
    return sp;
  }

  /** The weather at `pos` (weeks + fraction). */
  at(pos: number): WeatherNow {
    const week = Math.floor(pos);
    const u = pos - week;
    const fade = W.fadeWeeks;
    const lead = W.overcastLead;
    // Rain and clouds: the strongest of the spells over this moment (each fading in and out).
    let rain = 0;
    let overcast = 0;
    let snowing = false;
    for (let k = 0; k <= RAIN_BACK; k++) {
      const s = this.spell(week - k);
      if (!s.strength) continue;
      const r = s.strength * smooth(clamp01(Math.min(pos - s.start, s.end - pos) / fade));
      if (r > rain) [rain, snowing] = [r, s.snow];
      overcast = Math.max(overcast, smooth(clamp01(Math.min(pos - (s.start - lead), s.end + lead - pos) / lead)) * (0.4 + 0.6 * s.strength));
    }
    // Wetness: the strongest of the spells of the last weeks, each rising while it rains and drying after.
    let wet = 0;
    for (let k = 0; k <= WET_BACK; k++) {
      const s = this.spell(week - k);
      if (!s.strength || pos < s.start) continue;
      // Drying time of the season the rain stopped in (fixed per spell, so wetness never jumps).
      const dry = W.dryWeeks[seasonAt(Math.floor(s.end)).season];
      const soaked = s.strength * clamp01((Math.min(pos, s.end) - s.start) / W.wetRise);
      wet = Math.max(wet, pos <= s.end ? soaked : soaked * clamp01(1 - (pos - s.end) / dry));
    }
    // Wind: blows up and dies down over the windy week.
    const wind = this.spell(week).wind * Math.sin(Math.PI * u) ** 2 + rain * 0.25;
    return { rain, snowing, overcast, wet, puddles: clamp01((wet - 0.3) / 0.7), wind: clamp01(wind) };
  }
}
