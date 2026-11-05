import { createRng, type Season } from '../../core';
import LOOK from '../look3d.json';
import { clamp01, lerp, smooth } from './color';
import { seasonAt } from './season';

const W = LOOK.weather;

/** What the season clock says about a week: chance of a wet spell, weights of light/medium/heavy rain, snow cover. */
export interface WeekClimate {
  rain: number;
  levels: number[];
  snow: number;
  season: Season;
}

/** The weather of one week, drawn once from the seed. */
export interface Spell {
  /** Rain strength 0..1 (0: a dry week). */
  strength: number;
  /** Start and end of the wet spell, as fractions of the week. */
  start: number;
  end: number;
  /** Falls as snow (only while the ground is snowy). */
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

/**
 * Weather of a game, deterministic from the map seed: each week draws whether a wet spell comes
 * (with the season clock's chance of rain, so dry years and summers stay dry), how strong it is and
 * when it falls, and whether it is a windy week. Looks only: nothing here touches the game state.
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
    const wet = r() < c.rain;
    const lv = r();
    const level = lv < c.levels[0] ? 0 : lv < c.levels[0] + c.levels[1] ? 1 : 2;
    const len = lerp(W.spellWeeks[0], W.spellWeeks[1], r());
    const start = r() * (1 - len);
    const windy = r() < W.windChance[c.season];
    const windK = r();
    sp = { strength: wet ? W.strength[level] : 0, start, end: start + len, snow: wet && c.snow > 0.2, wind: windy ? 0.5 + 0.5 * windK : 0 };
    if (this.cache.size > 64) this.cache.clear();
    this.cache.set(week, sp);
    return sp;
  }

  /** The weather at `pos` (weeks + fraction). */
  at(pos: number): WeatherNow {
    const week = Math.floor(pos);
    const u = pos - week;
    const sp = this.spell(week);
    const fade = W.fadeWeeks;
    const inSpell = sp.strength > 0 ? clamp01(Math.min(u - sp.start, sp.end - u) / fade) : 0;
    const rain = sp.strength * smooth(inSpell);
    const lead = sp.strength > 0 ? smooth(clamp01(Math.min(u - (sp.start - W.overcastLead), sp.end + W.overcastLead - u) / W.overcastLead)) * (0.4 + 0.6 * sp.strength) : 0;
    // Wetness: the strongest of the spells of the last few weeks, each rising while it rains and drying after.
    let wet = 0;
    for (let k = 0; k <= 3; k++) {
      const s = this.spell(week - k);
      if (!s.strength) continue;
      const t = pos - (week - k);
      if (t < s.start) continue;
      // Drying time of the season the rain fell in (fixed per spell, so wetness never jumps).
      const dry = W.dryWeeks[seasonAt(week - k).season];
      const soaked = s.strength * clamp01((Math.min(t, s.end) - s.start) / W.wetRise);
      wet = Math.max(wet, t <= s.end ? soaked : soaked * clamp01(1 - (t - s.end) / dry));
    }
    // Wind: blows up and dies down over the windy week.
    const wind = sp.wind * Math.sin(Math.PI * u) ** 2 + rain * 0.25;
    return { rain, snowing: sp.snow, overcast: lead, wet, puddles: clamp01((wet - 0.3) / 0.7), wind: clamp01(wind) };
  }
}
