import LOOK from '../look3d.json';
import { clamp01, hex, lerp, mixColor } from './color';

const D = LOOK.day;

/** Light of a moment of the day, before the season and the weather change it. */
export interface DayKeyLight {
  sun: number;
  sunI: number;
  top: number;
  horizon: number;
  hemi: number;
  ground: number;
  hemiI: number;
}

const KEYS = D.keys.map((k) => ({ t: k.t, sun: hex(k.sun), sunI: k.sunI, top: hex(k.top), horizon: hex(k.horizon), hemi: hex(k.hemi), ground: hex(k.ground), hemiI: k.hemiI }));

/** Time of day (0..1, 0 = dawn) from any running value: only its fraction counts. */
export const dayTime = (u: number) => ((u % 1) + 1) % 1;

/** Real seconds a full day lasts by default (its own clock, apart from the game weeks). */
export const DAY_SECONDS = D.seconds;

/**
 * The day runs on its own real-time clock: `dt` seconds later, at `daySeconds` per day, the time
 * of day moves on, and it stands still while the game is paused.
 */
export const advanceDay = (t: number, dt: number, running: boolean, daySeconds = DAY_SECONDS) =>
  running && daySeconds > 0 ? dayTime(t + dt / daySeconds) : dayTime(t);

/** Key-framed light at time t (0..1), linear between keys. */
export function dayKeyLight(t: number): DayKeyLight {
  const u = dayTime(t);
  let k = 0;
  while (k < KEYS.length - 2 && KEYS[k + 1].t <= u) k++;
  const a = KEYS[k];
  const b = KEYS[k + 1];
  const f = clamp01((u - a.t) / (b.t - a.t || 1));
  return {
    sun: mixColor(a.sun, b.sun, f),
    sunI: lerp(a.sunI, b.sunI, f),
    top: mixColor(a.top, b.top, f),
    horizon: mixColor(a.horizon, b.horizon, f),
    hemi: mixColor(a.hemi, b.hemi, f),
    ground: mixColor(a.ground, b.ground, f),
    hemiI: lerp(a.hemiI, b.hemiI, f),
  };
}

/** Share (0..1) of the day arc the sun has run at time t: 0 at sunrise, 1 at sunset, outside 0..1 at night. */
export function sunArc(t: number): number {
  let u = dayTime(t);
  if (u > D.sunset + (1 - D.sunset + D.sunrise) / 2) u -= 1;
  return (u - D.sunrise) / (D.sunset - D.sunrise);
}

/**
 * Direction towards the sun (unit vector; x east, y up, z south) for time t and the season's
 * highest elevation (degrees). The sun rises in the east, passes south at noon and sets in the
 * west; at night it is below the horizon and the moon lights the city from the opposite side.
 */
export function sunDirection(t: number, maxElevDeg: number): { x: number; y: number; z: number; up: boolean } {
  const arc = sunArc(t);
  const up = arc >= 0 && arc <= 1;
  // Night: the moon runs from west to east, lower, so the light turns without a jump at dusk and dawn.
  const a = up ? arc : dayTime(t - D.sunset) / (1 - (D.sunset - D.sunrise));
  const elev = ((maxElevDeg * Math.PI) / 180) * Math.sin(Math.PI * a) * (up ? 1 : 0.7) + 0.06;
  const az = Math.PI * a;
  const c = Math.cos(elev);
  const x = Math.cos(az) * c * (up ? 1 : -1);
  return { x, y: Math.sin(elev), z: Math.sin(az) * c * 0.8 + 0.2 * c, up };
}

/** How dark it is (0 day .. 1 night), from the sun's height over the horizon. */
export function nightness(t: number): number {
  const arc = sunArc(t);
  const edge = 0.08;
  if (arc >= edge && arc <= 1 - edge) return 0;
  if (arc >= 0 && arc < edge) return 0.5 * (1 - arc / edge);
  if (arc > 1 - edge && arc <= 1) return 0.5 * (1 - (1 - arc) / edge);
  const dist = arc < 0 ? -arc : arc - 1;
  return 0.5 + 0.5 * clamp01(dist / 0.12);
}

/**
 * How much of the day cycle to show (1 full .. min) when a day lasts `secondsPerDay` of real time:
 * at high speeds a full cycle every second would flash, so the light swings around the noon light
 * instead. Linear in the logarithm between `minSeconds` and `fullSeconds`.
 */
export function dayAmplitude(secondsPerDay: number): number {
  const A = D.amplitude;
  if (!(secondsPerDay > 0)) return 1;
  const f = clamp01(Math.log(secondsPerDay / A.minSeconds) / Math.log(A.fullSeconds / A.minSeconds));
  return lerp(A.min, 1, f);
}

/** Moves `cur` towards `target` with a time constant of `follow` seconds (frame-rate independent). */
export const follow = (cur: number, target: number, dt: number, seconds = D.amplitude.follow) => target + (cur - target) * Math.exp(-dt / seconds);

/** Time of day shown at amplitude `amp`: the real time pulled towards noon (1 = unchanged). */
export function shownTime(t: number, amp: number): number {
  let d = dayTime(t) - D.noon;
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return dayTime(D.noon + d * amp);
}

/** Share of houses with a lit window at time t (evening, a few late into the night, none by day). */
export function windowShare(t: number): number {
  const W = D.windows;
  const u = dayTime(t);
  if (u < W.dawnOff) return W.late * (1 - u / W.dawnOff);
  if (u < W.from) return 0;
  if (u < W.full) return (u - W.from) / (W.full - W.from);
  if (u < W.sleep) return 1;
  return lerp(1, W.late, clamp01((u - W.sleep) / 0.04));
}

export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';

/** Name of the part of the day (for the clock on screen). */
export function dayPhase(t: number): DayPhase {
  const arc = sunArc(t);
  if (arc < 0 || arc > 1) return 'night';
  if (arc < 0.12) return 'dawn';
  if (arc > 0.84) return 'dusk';
  return 'day';
}
