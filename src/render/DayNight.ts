import Phaser from 'phaser';
import VISUAL from '../data/visual.json';
import { GAME_H, GAME_W } from './layout';
import { FinishPipeline } from './FinishPipeline';
import { DEPTH } from './iso';
import { mixColor, mulColor } from './Seasons';
import { settings } from './settings';

export type DayPhase = 'dawn' | 'morning' | 'afternoon' | 'sunset' | 'night';

interface Key {
  t: number;
  phase: DayPhase;
  tint: number;
  sky: number;
  night: number;
}

const DN = VISUAL.dayNight;
const KEYS: Key[] = DN.keys.map((k) => ({ t: k.t, phase: k.phase as DayPhase, tint: Number(k.tint), sky: Number(k.sky), night: k.night }));
/** Time of day used when the cycle is off (late morning, full light). */
const NOON = 0.27;
/** The tint and star layers cover the screen even at the minimum zoom (0.5). */
const COVER = 3;
const STARS = 140;

/** Light at a time of day t (0..1): colour multiplied over the world, sky colour and how dark it is (0..1). */
export interface DayLight {
  t: number;
  phase: DayPhase;
  tint: number;
  sky: number;
  night: number;
  /** Share of the usual walkers out on the streets (half at night, more in the late afternoon). */
  walkers: number;
}

const mix = mixColor;

export function sampleDay(t: number): DayLight {
  let k = 0;
  while (k < KEYS.length - 2 && KEYS[k + 1].t <= t) k++;
  const a = KEYS[k];
  const b = KEYS[k + 1];
  const f = Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t || 1)));
  const night = a.night + (b.night - a.night) * f;
  const w = DN.walkers;
  const evening = t >= w.eveningFrom && t <= w.eveningTo ? w.evening : 1;
  return { t, phase: a.phase, tint: mix(a.tint, b.tint, f), sky: mix(a.sky, b.sky, f), night, walkers: evening * (1 - (1 - w.night) * night) };
}


/**
 * Day and night over the map: a multiplied colour over the world (balloons, previews and the UI stay
 * untouched), the sky colour behind the diorama, faint stars at night, and the image finish (vignette
 * and miniature blur on the top and bottom edges). Turns the blur off by itself on slow devices.
 */
export class DayNight {
  /** Time of day 0..1 (follows game time: stops when paused). */
  private t = DN.startAt;
  private light: DayLight;
  private shade: Phaser.GameObjects.Rectangle;
  private stars: Phaser.GameObjects.Graphics;
  /** Vignette and miniature blur (WebGL only). */
  private finish: FinishPipeline | null = null;
  /** Set once the frame rate stayed low: fewer particles and no miniature blur until a restart. */
  degraded = false;
  /** Off in the visual tests (software rendering is slow), so screenshots keep the finish. */
  fpsGuard = true;
  private sample = { time: 0, frames: 0 };
  /** Season and weather colours of the world and the sky, multiplied with the light of the time of day. */
  private extra = 0xffffff;
  private extraSky = 0xffffff;

  constructor(private scene: Phaser.Scene) {
    const cam = scene.cameras.main;
    this.shade = scene.add
      .rectangle(GAME_W / 2, GAME_H / 2, GAME_W * COVER, GAME_H * COVER, 0xffffff)
      .setScrollFactor(0)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setDepth(DEPTH.tint);
    this.stars = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.ground - 1);
    for (let k = 0; k < STARS; k++) {
      const x = (Math.random() - 0.5) * GAME_W * COVER + GAME_W / 2;
      const y = (Math.random() - 0.5) * GAME_H * COVER + GAME_H / 2;
      this.stars.fillStyle(0xfff6dc, 0.4 + Math.random() * 0.6);
      this.stars.fillCircle(x, y, Math.random() < 0.15 ? 1.6 : 0.9);
    }
    if (scene.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      const pipes = scene.renderer.pipelines;
      if (!pipes.postPipelineClasses.has(FinishPipeline.KEY)) pipes.addPostPipeline(FinishPipeline.KEY, FinishPipeline);
      cam.setPostPipeline(FinishPipeline.KEY);
      this.finish = cam.getPostPipeline(FinishPipeline.KEY) as FinishPipeline;
      this.finish.vignette = VISUAL.finish.vignetteStrength;
      this.finish.vignetteRadius = VISUAL.finish.vignetteRadius;
      this.finish.band = VISUAL.finish.tiltBand;
    }
    this.light = sampleDay(this.t);
    this.applySettings();
    this.paint();
  }

  get current(): DayLight {
    return this.light;
  }

  /** Re-reads the player options (cycle on/off, miniature blur on/off). */
  applySettings() {
    if (this.finish) this.finish.blur = settings.miniature && !this.degraded ? VISUAL.finish.tiltBlur : 0;
    this.paint();
  }

  /** Season and weather colour over the world and the sky behind the diorama (white: none). */
  setExtraTint(world: number, sky: number) {
    this.extra = world;
    this.extraSky = sky;
  }

  /** Heat shimmer over the map (0..1, summer afternoons); none at night. */
  setShimmer(v: number) {
    if (this.finish) this.finish.shimmer = v * VISUAL.finish.shimmer * (1 - this.light.night);
  }

  /** Jumps to a time of day (dev hook for tests). */
  setTime(t: number) {
    this.t = ((t % 1) + 1) % 1;
    this.paint();
  }

  /** `gameDt`: seconds times the game speed; `realMs`: frame time, for the frame-rate guard. */
  update(gameDt: number, realMs: number) {
    if (settings.dayNight) this.t = (this.t + gameDt / DN.cycleSeconds) % 1;
    this.paint();
    this.watchFps(realMs);
  }

  private paint() {
    this.light = sampleDay(settings.dayNight ? this.t : NOON);
    const { sky, night } = this.light;
    const tint = mulColor(this.light.tint, this.extra);
    this.shade.setFillStyle(tint).setVisible(tint !== 0xffffff);
    this.stars.setAlpha(night).setVisible(night > 0.02);
    this.scene.cameras.main.setBackgroundColor(mulColor(sky, this.extraSky));
  }

  private watchFps(realMs: number) {
    if (!this.fpsGuard || this.degraded || realMs <= 0 || realMs > 500) return; // ignore hidden tabs and hiccups
    const s = this.sample;
    s.time += realMs / 1000;
    s.frames++;
    if (s.time < VISUAL.perf.sampleSeconds) return;
    const fps = s.frames / s.time;
    s.time = 0;
    s.frames = 0;
    if (fps >= VISUAL.perf.minFps) return;
    this.degraded = true;
    this.applySettings();
  }
}
