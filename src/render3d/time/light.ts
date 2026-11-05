import LOOK from '../look3d.json';
import { clamp01, hex, lerp, mixColor, mulColor, scaleColor } from './color';
import { dayKeyLight, nightness, sunDirection, windowShare } from './day';
import type { Season3D } from './season';
import type { WeatherNow } from './weather';

const WX = LOOK.weather;

/** Everything the 3D scene needs to light a frame. */
export interface FrameLight {
  sunDir: { x: number; y: number; z: number };
  /** The light comes from the sun (false: from the moon). */
  sunUp: boolean;
  sunColor: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  skyTop: number;
  skyHorizon: number;
  fog: number;
  /** Fog distance factor (1 normal, lower = thicker). */
  fogScale: number;
  /** 0 day .. 1 night. */
  night: number;
  /** Share of houses with lit windows. */
  windows: number;
  /** Stars on the sky (0..1). */
  stars: number;
  /** Cloud cover (0..1) and the cloud colour. */
  clouds: number;
  cloudColor: number;
  /** Shadow strength 0..1 (weak under clouds and by moonlight). */
  shadow: number;
}

/**
 * The light of a frame: the key-framed light of the time of day `t`, coloured and scaled by the
 * season (golden and low in autumn, cold and blue in winter, white and strong in summer), then
 * dimmed and greyed by the weather. `amp` (0..1) pulls colours towards the noon light at high
 * speeds (see dayAmplitude); `tShown` is the time used for the sun's position.
 */
export function frameLight(t: number, tShown: number, amp: number, season: Season3D, w: WeatherNow, baseClouds: number): FrameLight {
  const k = dayKeyLight(t);
  const noon = dayKeyLight(LOOK.day.noon);
  const mix = (a: number, b: number) => mixColor(a, b, amp);
  const night = nightness(t) * amp;
  const dir = sunDirection(tShown, season.elev);
  const overcast = clamp01(Math.max(w.overcast, w.rain));
  const clouds = clamp01(Math.max(baseClouds, overcast));
  const grey = hex(WX.sky);
  const cut = 1 - WX.sunCut * overcast;
  const skyTop = mixColor(mulColor(mix(noon.top, k.top), season.sky), mulColor(grey, mixColor(mix(noon.top, k.top), 0xffffff, 0.3)), overcast * 0.85);
  const skyHorizon = mixColor(mulColor(mix(noon.horizon, k.horizon), season.haze), mulColor(grey, mix(noon.horizon, k.horizon)), overcast * 0.7);
  return {
    sunDir: dir,
    sunUp: dir.up,
    sunColor: mulColor(mix(noon.sun, k.sun), season.sun),
    sunIntensity: lerp(noon.sunI, k.sunI, amp) * season.sunI * cut,
    hemiSky: mulColor(mix(noon.hemi, k.hemi), mixColor(0xffffff, season.sky, 0.6)),
    hemiGround: mix(noon.ground, k.ground),
    hemiIntensity: lerp(noon.hemiI, k.hemiI, amp) * (1 + 0.15 * overcast),
    skyTop,
    skyHorizon,
    fog: skyHorizon,
    fogScale: 1 / (season.fog * (1 + 0.25 * overcast + 0.2 * w.rain)),
    night,
    windows: windowShare(t) * amp,
    stars: clamp01((night - 0.6) / 0.4) * (1 - clouds),
    clouds,
    cloudColor: scaleColor(mixColor(mixColor(mix(noon.horizon, k.horizon), 0xffffff, 0.5), grey, overcast), lerp(1, 0.75, overcast)),
    shadow: (1 - 0.8 * overcast) * (dir.up ? 1 : 0.35),
  };
}

/** Share of the usual walkers out on the streets: fewer at night and in the rain. */
export function streetShare(night: number, rain: number): number {
  const C = LOOK.crowd;
  return lerp(1, C.night, clamp01(night)) * lerp(1, C.rain, clamp01(rain));
}

/** People working one field: more at the harvest and the plowing, almost none at night or in the rain. */
export function fieldHands(harvest: boolean, plowing: boolean, night: number, rain: number): number {
  const F = LOOK.crowd.fieldHands;
  const base = harvest ? F.harvest : plowing ? F.plow : F.other;
  return base * (1 - 0.9 * clamp01(night)) * (1 - 0.7 * clamp01(rain));
}
