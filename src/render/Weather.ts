import Phaser from 'phaser';
import VISUAL from '../data/visual.json';
import { GAME_H, GAME_W } from './layout';
import { mixColor, type Drift, type SeasonLook } from './Seasons';
import { TEX } from './textures';

const W = VISUAL.seasons.weather;
/** Emitters add particles every TICK ms; the amounts in visual.json are per tick at full strength. */
const TICK = 50;
const RAIN_TINT = Number(W.rainTint);
/** Snow brightens a little instead of darkening like rain. */
const SNOW_TINT = 0xe4e8f0;

export type Sky = 'clear' | 'rain' | 'snow';

const DRIFT: Record<Exclude<Drift, null>, { key: string; tint: number[]; alpha: number; scale: [number, number] }> = {
  petals: { key: TEX.petal, tint: [0xffffff, 0xf7c6d6, 0xf2a8c0], alpha: 0.9, scale: [0.9, 1.3] },
  leaves: { key: TEX.leaf, tint: [0xc8642a, 0xe0963a, 0xa8522a, 0xd8b04a], alpha: 0.95, scale: [0.9, 1.4] },
  dust: { key: TEX.soft, tint: [0xd8b888, 0xe6c89a], alpha: 0.22, scale: [1.6, 3.2] },
};

/**
 * Weather on its own overlay scene (between the map and the UI, so zoom never touches it): rain
 * with splashes, snow, and what the wind carries in each season (almond petals, autumn leaves,
 * summer dust). Spells of weather come and go with the season's chance and fade in and out.
 */
export class Weather {
  private rain: Phaser.GameObjects.Particles.ParticleEmitter;
  private splash: Phaser.GameObjects.Particles.ParticleEmitter;
  private snow: Phaser.GameObjects.Particles.ParticleEmitter;
  private drifts = new Map<Exclude<Drift, null>, Phaser.GameObjects.Particles.ParticleEmitter>();
  private sky: Sky = 'clear';
  /** How strong the current weather is (0..1), easing toward 1 while it lasts and back to 0. */
  private amount = 0;
  private spellLeft = 0;
  /** The weather the current spell asks for (the old one fades out first). */
  private target: Sky = 'clear';
  /** Set by the tests: the weather stays as forced. */
  private forced = false;

  constructor(scene: Phaser.Scene) {
    this.rain = scene.add.particles(0, 0, TEX.rain, {
      x: { min: -120, max: GAME_W + 120 },
      y: -20,
      speedY: { min: 820, max: 980 },
      speedX: { min: -210, max: -170 },
      rotate: 11,
      lifespan: { min: 380, max: (GAME_H / 850) * 1000 },
      alpha: { start: 0.6, end: 0.35 },
      frequency: TICK,
      quantity: 0,
      emitting: false,
    });
    this.splash = scene.add.particles(0, 0, TEX.splash, {
      x: { min: 0, max: GAME_W },
      y: { min: GAME_H * 0.15, max: GAME_H },
      scale: { start: 0.4, end: 1.3 },
      alpha: { start: 0.55, end: 0 },
      lifespan: 320,
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

  /** Current weather and how strong it is (0..1). */
  get state(): { sky: Sky; amount: number } {
    return { sky: this.sky, amount: this.amount };
  }

  /** Colour multiplied over the world for the weather (white when clear). */
  get tint(): number {
    return mixColor(0xffffff, this.sky === 'snow' ? SNOW_TINT : RAIN_TINT, this.amount);
  }

  /** Share of the usual walkers out in this weather. */
  get walkers(): number {
    return 1 - (1 - W.rainWalkers) * this.amount;
  }

  /** Dev hook for the tests: fixes the weather (null goes back to the seasons). */
  force(sky: Sky | null, amount = 1) {
    this.forced = sky !== null;
    if (sky) {
      this.sky = sky;
      this.amount = amount;
    }
  }

  /** `dt`: game seconds (0 when paused); `degraded`: fewer particles on slow devices. */
  update(dt: number, look: SeasonLook, degraded: boolean) {
    if (!this.forced) this.spell(dt, look);
    const k = degraded ? 0.5 : 1;
    const q = (n: number) => Math.round(n * this.amount * k);
    this.emit(this.rain, this.sky === 'rain' ? q(W.rainDrops) : 0);
    this.emit(this.splash, this.sky === 'rain' ? q(W.splashes) : 0);
    this.emit(this.snow, this.sky === 'snow' ? q(W.snowFlakes) : 0);
    for (const [kind, e] of this.drifts) {
      const on = kind === look.drift && this.sky === 'clear';
      if (e.emitting !== on) e.emitting = on;
    }
  }

  /** Weather spells: when one ends the season draws the next (rain, snow or clear sky). */
  private spell(dt: number, look: SeasonLook) {
    this.spellLeft -= dt;
    if (this.spellLeft <= 0) {
      const [a, b] = W.spellSeconds;
      this.spellLeft = a + Math.random() * (b - a);
      const wet = Math.random() < look.rain;
      this.target = wet ? (Math.random() < look.snow ? 'snow' : 'rain') : 'clear';
    }
    const want = this.target;
    if (want !== this.sky && this.amount <= 0) this.sky = want;
    const up = want === this.sky && want !== 'clear';
    this.amount = Phaser.Math.Clamp(this.amount + (up ? 1 : -1) * (dt / W.fadeSeconds), 0, 1);
  }

  private emit(e: Phaser.GameObjects.Particles.ParticleEmitter, n: number) {
    if (e.quantity !== n) e.setQuantity(n);
    const on = n > 0;
    if (e.emitting !== on) e.emitting = on;
  }
}
