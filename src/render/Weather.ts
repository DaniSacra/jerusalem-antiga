import Phaser from 'phaser';
import type { Season } from '../core';
import VISUAL from '../data/visual.json';
import { GAME_H, GAME_W } from './layout';
import { mixColor, type Drift, type SeasonLook } from './Seasons';
import { TEX } from './textures';

const W = VISUAL.seasons.weather;
/** Emitters add particles every TICK ms; the amounts in visual.json are per tick at full strength. */
const TICK = 50;
export const RAIN_LEVELS = ['light', 'medium', 'heavy'] as const;
export type RainLevel = (typeof RAIN_LEVELS)[number];
const LEVEL = Object.fromEntries(
  RAIN_LEVELS.map((k) => {
    const l = W.levels[k];
    return [k, { ...l, tint: Number(l.tint), sky: Number(l.sky) }];
  }),
) as Record<RainLevel, Omit<(typeof W.levels)['light'], 'tint' | 'sky'> & { tint: number; sky: number }>;
const SNOW_TINT = Number(W.snowTint);
const DUST = VISUAL.seasons.droughtLook.dust;
/** Falling speed of a rain streak (px/s); the wind pushes it sideways by `wind` times that. */
const RAIN_SPEED = 1000;

export type Sky = 'clear' | 'rain' | 'snow';

const DRIFT: Record<Exclude<Drift, null>, { key: string; tint: number[]; alpha: number; scale: [number, number] }> = {
  petals: { key: TEX.petal, tint: [0xffffff, 0xf7c6d6, 0xf2a8c0, 0xe0503c], alpha: 0.9, scale: [0.9, 1.3] },
  dust: { key: TEX.soft, tint: [0xd8b888, 0xe6c89a], alpha: 0.22, scale: [1.6, 3.2] },
};

/**
 * Weather on its own overlay scene (between the map and the UI, so zoom never touches it): rain in
 * three strengths with a slant from the wind and splashes on the ground, snow in snowy winters, and
 * what the wind carries (almond and wild-flower petals, summer dust). Spells come and go with the
 * season's chance and fade in and out; the ground stays wet for a while after the rain (`wet`) and
 * puddles (`puddles`) fill and dry more slowly still. Read the public fields; they are updated in
 * place every frame (no allocation).
 */
export class Weather {
  private rain: Phaser.GameObjects.Particles.ParticleEmitter;
  private splash: Phaser.GameObjects.Particles.ParticleEmitter;
  private snow: Phaser.GameObjects.Particles.ParticleEmitter;
  private drifts = new Map<Exclude<Drift, null>, Phaser.GameObjects.Particles.ParticleEmitter>();
  sky: Sky = 'clear';
  level: RainLevel = 'medium';
  /** How strong the current weather is (0..1), easing toward 1 while it lasts and back to 0. */
  amount = 0;
  /** How wet the ground and roofs are (0..1) and how full the puddles on the roads are (0..1). */
  wet = 0;
  puddles = 0;
  /** Colours multiplied over the world and the sky (white when clear), and cloud shadows (0..1). */
  tint = 0xffffff;
  skyTint = 0xffffff;
  clouds = 0;
  /** Share of the usual walkers out in this weather. */
  walkers = 1;
  private spellLeft = 0;
  /** The weather the current spell asks for (the old one fades out first). */
  private target: Sky = 'clear';
  private targetLevel: RainLevel = 'medium';
  /** What the current spell was drawn for: a new season or a snow / drought change redraws it. */
  private drawnFor: { season: Season | null; snow: boolean; drought: boolean } = { season: null, snow: false, drought: false };
  /** Set by the tests: the weather (or the wetness) stays as forced. */
  private forced = false;
  private wetForced = false;
  private driftRate = 0;

  constructor(scene: Phaser.Scene) {
    const wind = () => -RAIN_SPEED * LEVEL[this.level].wind;
    this.rain = scene.add.particles(0, 0, TEX.rain, {
      // Streaks appear all over the screen (a little upwind of it) and live a short while, so a
      // shower covers the whole screen at once instead of filling it from the top.
      x: { min: -20, max: GAME_W + 120 },
      y: { min: -60, max: GAME_H - 20 },
      speedY: { min: RAIN_SPEED * 0.85, max: RAIN_SPEED * 1.1 },
      speedX: () => wind() * (0.9 + Math.random() * 0.2),
      rotate: () => Phaser.Math.RadToDeg(Math.atan(LEVEL[this.level].wind)),
      scaleY: () => (this.level === 'heavy' ? 1.3 : this.level === 'light' ? 0.8 : 1) * (0.8 + Math.random() * 0.4),
      lifespan: { min: 220, max: 420 },
      alpha: { start: 0.6, end: 0.15 },
      frequency: TICK,
      quantity: 0,
      emitting: false,
    });
    this.splash = scene.add.particles(0, 0, TEX.splash, {
      x: { min: 0, max: GAME_W },
      y: { min: GAME_H * 0.1, max: GAME_H },
      scale: { start: 0.3, end: 1.2 },
      alpha: { start: 0.6, end: 0 },
      lifespan: 300,
      frequency: TICK,
      quantity: 0,
      emitting: false,
    });
    this.snow = scene.add.particles(0, 0, TEX.soft, {
      // Flakes appear all over the screen (and fade), so a snowfall fills it at once.
      x: { min: -60, max: GAME_W + 60 },
      y: { min: -10, max: GAME_H },
      speedY: { min: 40, max: 85 },
      speedX: { min: -35, max: 15 },
      scale: { min: 0.14, max: 0.32 },
      alpha: { start: 0.95, end: 0 },
      lifespan: { min: 3000, max: 6000 },
      frequency: TICK,
      quantity: 0,
      emitting: false,
    });
    for (const [kind, d] of Object.entries(DRIFT) as [Exclude<Drift, null>, (typeof DRIFT)['petals']][]) {
      this.drifts.set(
        kind,
        scene.add.particles(0, 0, d.key, {
          x: -30,
          y: { min: -GAME_H * 0.2, max: GAME_H * 0.9 },
          speedX: { min: 45, max: 95 },
          speedY: { min: 8, max: 40 },
          rotate: { start: 0, end: kind === 'dust' ? 0 : 540 },
          scale: { min: d.scale[0], max: d.scale[1] },
          alpha: d.alpha,
          tint: d.tint,
          lifespan: ((GAME_W + 80) / 45) * 1000,
          frequency: 1000 / W.drifters,
          emitting: false,
        }),
      );
    }
  }

  /** Dev hook for the tests: fixes the weather (null goes back to the seasons) and fills the screen at once. */
  force(sky: Sky | null, amount = 1, level: RainLevel = 'medium') {
    this.forced = sky !== null;
    if (!sky) return;
    this.sky = this.target = sky;
    this.level = this.targetLevel = level;
    this.amount = amount;
    this.paint();
    this.emitAll(false);
    // Run the emitters ahead so the drops are already on screen, whatever the frame rate.
    for (const e of [this.rain, this.splash, this.snow]) if (e.emitting) e.fastForward(sky === 'snow' ? 3000 : 500, TICK);
  }

  /** Dev hook for the tests: fixes how wet the ground is and how full the puddles are (null: back to the weather). */
  forceWet(v: number | null) {
    this.wetForced = v !== null;
    if (v !== null) this.wet = this.puddles = v;
  }

  /** `dt`: game seconds (0 when paused); `degraded`: fewer particles on slow devices. */
  update(dt: number, look: SeasonLook, degraded: boolean) {
    if (!this.forced) this.spell(dt, look);
    if (!this.wetForced) this.soak(dt, look);
    this.paint();
    this.emitAll(degraded);
    const rate = W.drifters * (look.drift === 'dust' ? 1 + (DUST - 1) * look.drought : 1) * (degraded ? W.degradedShare : 1);
    for (const [kind, e] of this.drifts) {
      const on = kind === look.drift && this.sky === 'clear';
      if (e.emitting !== on) e.emitting = on;
      if (on && rate !== this.driftRate) e.frequency = 1000 / rate;
    }
    this.driftRate = rate;
  }

  private paint() {
    const a = this.amount;
    const l = LEVEL[this.level];
    const rain = this.sky === 'rain';
    this.tint = mixColor(0xffffff, rain ? l.tint : this.sky === 'snow' ? SNOW_TINT : 0xffffff, a);
    this.skyTint = mixColor(0xffffff, rain ? l.sky : this.sky === 'snow' ? SNOW_TINT : 0xffffff, a);
    this.clouds = (rain ? l.clouds : this.sky === 'snow' ? 0.6 : 0) * a;
    this.walkers = this.sky === 'clear' ? 1 : 1 - (1 - W.rainWalkers) * a;
  }

  private emitAll(degraded: boolean) {
    const share = degraded ? W.degradedShare : 1;
    const q = (n: number) => Math.round(n * this.amount * share);
    const l = LEVEL[this.level];
    this.rain.maxAliveParticles = Math.round(W.maxDrops * share);
    this.emit(this.rain, this.sky === 'rain' ? q(l.drops) : 0);
    this.emit(this.splash, this.sky === 'rain' ? q(l.splashes) : 0);
    this.emit(this.snow, this.sky === 'snow' ? q(W.snowFlakes) : 0);
  }

  /** Rain soaks the ground fast; it dries slowly after (faster in summer), the puddles slower still. */
  private soak(dt: number, look: SeasonLook) {
    if (this.sky === 'rain') this.wet = Math.min(1, this.wet + dt * this.amount * LEVEL[this.level].wet);
    else if (this.sky === 'clear') this.wet = Math.max(0, this.wet - (dt / W.drySeconds) * (look.season === 'summer' ? W.summerDry : 1));
    const want = this.wet > W.puddleFrom ? (this.wet - W.puddleFrom) / (1 - W.puddleFrom) : 0;
    const step = dt * (want > this.puddles ? W.puddleRise : W.puddleFall);
    this.puddles = want > this.puddles ? Math.min(want, this.puddles + step) : Math.max(want, this.puddles - step);
  }

  /**
   * Weather spells: when one ends the season draws the next (rain or clear sky; snow instead of rain
   * while the ground is under snow). A new season, or snow or drought starting or ending, ends the
   * spell at once, so the weather never carries over into a season where it does not belong.
   */
  private spell(dt: number, look: SeasonLook) {
    const d = this.drawnFor;
    const snowy = look.snow > 0;
    const dry = look.drought > 0;
    if (d.season !== look.season || d.snow !== snowy || d.drought !== dry) {
      d.season = look.season;
      d.snow = snowy;
      d.drought = dry;
      this.spellLeft = 0;
    }
    this.spellLeft -= dt;
    if (this.spellLeft <= 0) {
      const [a, b] = W.spellSeconds;
      this.spellLeft = a + Math.random() * (b - a);
      const wet = !dry && Math.random() < look.rain;
      this.target = wet ? (snowy ? 'snow' : 'rain') : 'clear';
      this.targetLevel = this.pickLevel(look.levels);
    }
    // The season's chance of rain can fall to 0 within it (the end of spring): stop then.
    if (this.target !== 'clear' && look.rain <= 0) this.target = 'clear';
    const want = this.target;
    if ((want !== this.sky || this.targetLevel !== this.level) && this.amount <= 0) {
      this.sky = want;
      this.level = this.targetLevel;
    }
    const up = want === this.sky && want !== 'clear' && this.targetLevel === this.level;
    this.amount = Phaser.Math.Clamp(this.amount + (up ? 1 : -1) * (dt / W.fadeSeconds), 0, 1);
  }

  private pickLevel(weights: number[]): RainLevel {
    let r = Math.random() * weights.reduce((s, w) => s + w, 0);
    for (let k = 0; k < RAIN_LEVELS.length; k++) if ((r -= weights[k]) < 0) return RAIN_LEVELS[k];
    return 'light';
  }

  private emit(e: Phaser.GameObjects.Particles.ParticleEmitter, n: number) {
    if (e.quantity !== n) e.setQuantity(n);
    const on = n > 0;
    if (e.emitting !== on) e.emitting = on;
  }
}
