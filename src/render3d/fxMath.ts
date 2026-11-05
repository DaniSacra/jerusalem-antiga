import type { Rect } from '../core';
import VISUAL from '../data/visual.json';
import { C } from '../render/palette';
import LOOK from './look3d.json';

/**
 * Pure timing and shape of the world effects (see fx.ts): ring radius and fade over time, the hop
 * of a building, a falling tree, and the particles each effect throws (where, how fast, how long).
 * No Three.js here, so it is tested in tests/render3d/fx.test.ts.
 */

const F = LOOK.fx;
const M = VISUAL.moments;

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const easeOutCubic = (u: number) => 1 - (1 - clamp01(u)) ** 3;
export const easeInQuad = (u: number) => clamp01(u) ** 2;

/** Seconds each moment lasts (the 2D ones, from visual.json). */
export const FX_SECONDS = {
  ring: F.ring.seconds,
  milestone: M.milestoneSeconds,
  spoil: M.spoilSeconds,
  fall: M.treeFallMs / 1000,
  hop: F.hop.seconds,
  scaffold: VISUAL.build.scaffoldMs / 1000,
  scaffoldUpgrade: VISUAL.build.upgradeMs / 1000,
};

// ---------------------------------------------------------------- scaffold

/** A wooden bar of a scaffold: centre (x, y up, z) and size, in cells. */
export interface Bar {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
}

/** Thickness of a scaffold pole or rail (cells). */
const POLE = 0.05;

/**
 * The scaffold round a footprint `top` high: a pole at each corner and between them every cell or
 * so, and two rails round it (a third of the way up and near the top). Feet on y = 0.
 */
export function scaffoldBars(r: Pick<Rect, 'x' | 'y' | 'w' | 'h'>, top: number): Bar[] {
  const out: Bar[] = [];
  const m = 0.12;
  const x0 = r.x - m;
  const x1 = r.x + r.w + m;
  const z0 = r.y - m;
  const z1 = r.y + r.h + m;
  const poles = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, k) => a + ((b - a) * k) / n);
  const nx = Math.max(1, Math.round(r.w));
  const nz = Math.max(1, Math.round(r.h));
  const seen = new Set<string>();
  const pole = (x: number, z: number) => {
    const k = `${x.toFixed(2)},${z.toFixed(2)}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ x, y: top / 2, z, sx: POLE, sy: top, sz: POLE });
  };
  for (const x of poles(x0, x1, nx)) {
    pole(x, z0);
    pole(x, z1);
  }
  for (const z of poles(z0, z1, nz)) {
    pole(x0, z);
    pole(x1, z);
  }
  for (const y of [top * 0.35, top * 0.85]) {
    out.push({ x: (x0 + x1) / 2, y, z: z0, sx: x1 - x0, sy: POLE, sz: POLE }, { x: (x0 + x1) / 2, y, z: z1, sx: x1 - x0, sy: POLE, sz: POLE });
    out.push({ x: x0, y, z: (z0 + z1) / 2, sx: POLE, sy: POLE, sz: z1 - z0 }, { x: x1, y, z: (z0 + z1) / 2, sx: POLE, sy: POLE, sz: z1 - z0 });
  }
  return out;
}

/** How much of the scaffold stands at `u` (0..1 of its time): it goes up quickly, stays, and comes down at the end. */
export const scaffoldRise = (u: number) => (u <= 0 || u >= 1 ? 0 : Math.min(1, u / 0.15, (1 - u) / 0.2));

// ---------------------------------------------------------------- rings

/** Final radius of the ring around a footprint (it starts at `ring.start` of it). */
export const ringRadiusFor = (r: Pick<Rect, 'w' | 'h'>) => Math.max(r.w, r.h) * 0.5 + 0.55;

/** Progress of a ring `age` seconds after it was asked for, starting `delay` later (<0: not yet). */
export const ringProgress = (age: number, delay: number, seconds = F.ring.seconds) => (age - delay) / seconds;

/** Radius at progress `u`: it spreads fast and slows down (as the 2D Cubic.easeOut). */
export const ringRadius = (u: number, radius: number) => radius * (F.ring.start + (1 - F.ring.start) * easeOutCubic(u));

/** Opacity at progress `u`: none before it starts or after it ends, fading out on the way. */
export const ringAlpha = (u: number) => (u < 0 || u >= 1 ? 0 : (1 - u) ** 1.1);

// ---------------------------------------------------------------- building hop and tree fall

/** Lift of a hopping building at progress `u` (0..1): up and back down once. */
export const hopHeight = (u: number) => (u <= 0 || u >= 1 ? 0 : F.hop.height * Math.sin(Math.PI * u));

/** Vertical stretch while it hops (the width shrinks by as much): 1 at rest. */
export const hopStretch = (u: number) => (u <= 0 || u >= 1 ? 1 : 1 + F.hop.stretch * Math.sin(Math.PI * u));

/** Tilt of a falling tree (radians) at progress `u`: it tips faster and faster, then lies. */
export const fallAngle = (u: number) => ((F.fall.angleDeg * Math.PI) / 180) * easeInQuad(u / F.fall.tip);

/** Opacity of the fallen tree: whole while falling, then it fades away. */
export const fallAlpha = (u: number) => (u < F.fall.tip ? 1 : clamp01(1 - (u - F.fall.tip) / (1 - F.fall.tip)));

/** Which way a tree on a cell falls (+1 or -1 along x), fixed per cell. */
export const fallSide = (x: number, y: number) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 2 ? 1 : -1;

/** Height of a building's top for effects over it, from its footprint (the temple is the tallest). */
export const topOf = (r: Pick<Rect, 'w' | 'h'>) => (Math.max(r.w, r.h) >= 3 ? 2.6 : 1.1 + 0.15 * Math.max(r.w, r.h));

// ---------------------------------------------------------------- particles

/** One particle: thrown at `delay`, it lives `life` seconds. Sizes and positions in cells. */
export interface Spark {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Pull down (cells/s²) and air drag (1/s: the speed falls by e every 1/drag seconds). */
  gravity: number;
  drag: number;
  delay: number;
  life: number;
  size0: number;
  size1: number;
  alpha: number;
  /** Seconds to appear and to fade out at the end. */
  fadeIn: number;
  fadeOut: number;
  color: number;
  /** 1: a soft puff; 0: a hard dot (pebbles, flies, leaves). */
  soft: number;
  /** Drawn adding light (sparks and glows) instead of covering. */
  additive: boolean;
  /** Ground under it: it never sinks below. */
  floor: number;
  /** Flies: radius they buzz around their path. */
  buzz: number;
  /** A per-particle number 0..1 (the buzz phase). */
  seed: number;
}

export type Emit = (p: Readonly<Spark>) => void;
type Rng = () => number;

const blank = (): Spark => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, gravity: 0, drag: 0, delay: 0, life: 1, size0: 0.1, size1: 0.1, alpha: 1, fadeIn: 0.05, fadeOut: 1, color: 0xffffff, soft: 1, additive: false, floor: 0, buzz: 0, seed: 0 });
/** The one particle the recipes fill and hand to `emit` (it is copied there: no garbage per effect). */
const P = blank();
const BLANK = blank();
const reset = () => Object.assign(P, BLANK);

const between = (rng: Rng, [a, b]: readonly number[]) => a + (b - a) * rng();
const pick = <T>(rng: Rng, list: readonly T[]) => list[Math.floor(rng() * list.length) % list.length];
/** How many for a footprint of side `s`: base + per × s, at most cap. */
export const countFor = ([base, per, cap]: readonly number[], s: number) => Math.min(cap, base + per * s);

/** Distance travelled at speed `v` with drag `k` after `t` seconds. */
export const travel = (v: number, k: number, t: number) => (k > 0 ? (v * (1 - Math.exp(-k * t))) / k : v * t);

/** Position of a particle `t` seconds after it was thrown (written into `out`). */
export function sparkAt(p: Readonly<Spark>, t: number, out: { x: number; y: number; z: number }) {
  out.x = p.x + travel(p.vx, p.drag, t);
  out.z = p.z + travel(p.vz, p.drag, t);
  out.y = Math.max(p.floor, p.y + travel(p.vy, p.drag, t) - 0.5 * p.gravity * t * t);
  if (p.buzz) {
    const w = 9 + p.seed * 7;
    const ph = p.seed * 40;
    out.x += Math.sin(t * w + ph) * p.buzz;
    out.z += Math.cos(t * w * 1.3 + ph) * p.buzz;
    out.y += Math.sin(t * w * 0.7 + ph) * p.buzz * 0.4;
  }
  return out;
}

/** Opacity `t` seconds after it was thrown: it appears, holds, fades out by the end of its life. */
export function sparkAlpha(p: Readonly<Spark>, t: number) {
  if (t < 0 || t >= p.life) return 0;
  return p.alpha * clamp01(t / Math.max(1e-3, p.fadeIn)) * clamp01((p.life - t) / Math.max(1e-3, p.fadeOut));
}

/** Size `t` seconds after it was thrown (it grows or shrinks toward size1). */
export const sparkSize = (p: Readonly<Spark>, t: number) => p.size0 + (p.size1 - p.size0) * easeOutCubic(t / p.life);

const centre = (r: Rect) => ({ x: r.x + r.w / 2, z: r.y + r.h / 2, s: Math.max(1, r.w, r.h) });

/** A random point on an ellipse-shaped spot of radius `rad` round (x, z), into P. */
function spot(rng: Rng, x: number, z: number, rad: number) {
  const a = rng() * Math.PI * 2;
  const d = Math.sqrt(rng()) * rad;
  P.x = x + Math.cos(a) * d;
  P.z = z + Math.sin(a) * d;
  return a;
}

/**
 * Demolition: a cloud of dust spread over the footprint and pebbles thrown up that fall back
 * (more for a bigger footprint, capped). `ground` is the height of the ground there.
 */
export function dustRecipe(r: Rect, ground: number, rng: Rng, emit: Emit) {
  const D = F.dust;
  const { x, z, s } = centre(r);
  for (let k = 0, n = countFor(D.puffs, s); k < n; k++) {
    reset();
    const a = spot(rng, x, z, s * 0.42);
    const v = 0.3 + rng() * (0.4 + s * 0.15);
    P.y = ground + 0.1 + rng() * 0.2;
    P.vx = Math.cos(a) * v;
    P.vz = Math.sin(a) * v;
    P.vy = 0.3 + rng() * 0.5;
    P.drag = 2.2;
    P.life = between(rng, D.seconds);
    P.fadeOut = P.life;
    P.size0 = 0.45 + s * 0.15;
    P.size1 = 1.1 + s * 0.4;
    P.alpha = 0.85;
    // Sand dust and greyer stone dust, so the cloud stands out from the ground.
    P.color = k % 3 ? C.dust : C.rockLight;
    P.floor = ground;
    emit(P);
  }
  const rocks = [C.rock, C.rockLight, C.rockDark, C.mud];
  for (let k = 0, n = countFor(D.pebbles, s); k < n; k++) {
    reset();
    const a = spot(rng, x, z, s * 0.35);
    const v = 0.5 + rng() * (0.8 + s * 0.1);
    P.y = ground + 0.15;
    P.vx = Math.cos(a) * v;
    P.vz = Math.sin(a) * v;
    P.vy = 1.8 + rng() * 1.6;
    P.gravity = D.gravity;
    P.life = between(rng, D.pebbleSeconds);
    P.fadeOut = P.life * 0.4;
    P.size0 = P.size1 = 0.06 + rng() * 0.05;
    P.color = pick(rng, rocks);
    P.soft = 0;
    P.floor = ground + 0.03;
    emit(P);
  }
}

/** The temple moment: a burst of golden light thrown out from over it. */
export function celebrateRecipe(r: Rect, ground: number, rng: Rng, emit: Emit) {
  const { x, z } = centre(r);
  const top = ground + topOf(r) * 0.7;
  for (let k = 0; k < F.celebrate.sparks; k++) {
    reset();
    const a = rng() * Math.PI * 2;
    const up = rng() * 0.8 - 0.1;
    const v = 0.9 + rng() * 2;
    P.x = x;
    P.z = z;
    P.y = top;
    P.vx = Math.cos(a) * v;
    P.vz = Math.sin(a) * v;
    P.vy = up * v;
    P.drag = 1.6;
    P.life = 1.4;
    P.fadeOut = 1;
    P.size0 = 0.2;
    P.size1 = 0.45;
    P.alpha = 0.8;
    P.color = pick(rng, [C.milestone, C.milestoneGlow, C.gold]);
    P.additive = true;
    P.floor = ground;
    emit(P);
  }
}

/**
 * Sparkles rising over a footprint for `seconds` (one every `every`), from about a third of the
 * building's height: the milestone glitter, or a short burst when `seconds` is 0.
 */
export function sparkleRecipe(r: Rect, ground: number, rng: Rng, emit: Emit, colors: readonly number[], seconds: number, top = topOf(r)) {
  const { x, z, s } = centre(r);
  const n = seconds > 0 ? Math.round(seconds / F.milestone.sparkEvery) : 10 + 4 * s;
  for (let k = 0; k < n; k++) {
    reset();
    spot(rng, x, z, s * 0.55);
    P.y = ground + top * (0.25 + rng() * 0.3);
    P.vx = (rng() - 0.5) * 0.3;
    P.vz = (rng() - 0.5) * 0.3;
    P.vy = 0.45 + rng() * 0.8;
    P.delay = seconds > 0 ? k * F.milestone.sparkEvery : rng() * 0.15;
    P.life = 1.1 + rng() * 0.8;
    P.fadeOut = P.life;
    P.size0 = 0.16;
    P.size1 = 0.03;
    P.color = pick(rng, colors);
    P.additive = true;
    P.floor = ground;
    emit(P);
  }
}

/** A warm halo over a building that shows, holds for `seconds` and fades (the milestone glow). */
export function haloRecipe(r: Rect, ground: number, emit: Emit, seconds: number, top = topOf(r)) {
  const { x, z, s } = centre(r);
  reset();
  P.x = x;
  P.z = z;
  P.y = ground + top * 0.5;
  P.life = seconds;
  P.fadeIn = 0.5;
  P.fadeOut = 0.8;
  P.size0 = P.size1 = s * 1.6 + 0.8;
  P.alpha = F.milestone.halo;
  P.color = C.milestoneGlow;
  P.additive = true;
  P.floor = -1e3;
  emit(P);
}

/** Food spoiling: a short sickly green puff rising and a few flies buzzing over it. */
export function spoilRecipe(r: Rect, ground: number, rng: Rng, emit: Emit) {
  const { x, z } = centre(r);
  const sec = M.spoilSeconds;
  for (let t = 0; t < sec * 0.5; t += F.spoil.puffEvery) {
    reset();
    spot(rng, x, z, 0.45);
    P.y = ground + 0.35;
    P.vx = (rng() - 0.5) * 0.15;
    P.vz = (rng() - 0.5) * 0.15;
    P.vy = 0.2 + rng() * 0.25;
    P.delay = t;
    P.life = 1.2 + rng() * 0.6;
    P.fadeIn = 0.2;
    P.fadeOut = P.life;
    P.size0 = 0.3;
    P.size1 = 0.9;
    P.alpha = 0.6;
    P.color = C.spoil;
    P.floor = ground;
    emit(P);
  }
  for (let k = 0; k < F.spoil.flies; k++) {
    reset();
    spot(rng, x, z, 0.4);
    P.y = ground + 0.5 + rng() * 0.4;
    P.vx = (rng() - 0.5) * 0.1;
    P.vz = (rng() - 0.5) * 0.1;
    P.delay = rng() * 0.4;
    P.life = sec - P.delay;
    P.fadeIn = 0.2;
    P.fadeOut = 0.5;
    P.size0 = P.size1 = 0.08;
    P.color = C.fly;
    P.soft = 0;
    P.floor = ground;
    P.buzz = 0.16 + rng() * 0.1;
    P.seed = rng();
    emit(P);
  }
}

/**
 * A tree on cell (x, y) hits the ground: leaves burst where its crown lands and a little dust
 * (thrown when the fall ends, `FX_SECONDS.fall × fall.tip` after it began).
 */
export function fellRecipe(x: number, y: number, ground: number, rng: Rng, emit: Emit, leaves: readonly number[]) {
  const side = fallSide(x, y);
  const at = FX_SECONDS.fall * F.fall.tip;
  const cx = x + 0.5 + side * 0.6;
  const cz = y + 0.5;
  for (let k = 0; k < F.fall.leaves; k++) {
    reset();
    const a = spot(rng, cx, cz, 0.3);
    const v = 0.3 + rng() * 0.8;
    P.y = ground + 0.25;
    P.vx = Math.cos(a) * v + side * 0.3;
    P.vz = Math.sin(a) * v;
    P.vy = 0.6 + rng() * 0.9;
    P.gravity = 2.4;
    P.drag = 1.2;
    P.delay = at;
    P.life = 0.8 + rng() * 0.5;
    P.fadeOut = 0.4;
    P.size0 = P.size1 = 0.07 + rng() * 0.04;
    P.color = pick(rng, leaves);
    P.soft = 0;
    P.floor = ground + 0.02;
    emit(P);
  }
  for (let k = 0; k < 5; k++) {
    reset();
    const a = spot(rng, cx, cz, 0.35);
    P.y = ground + 0.08;
    P.vx = Math.cos(a) * 0.4;
    P.vz = Math.sin(a) * 0.4;
    P.vy = 0.25;
    P.drag = 2;
    P.delay = at;
    P.life = 0.7 + rng() * 0.3;
    P.fadeOut = P.life;
    P.size0 = 0.25;
    P.size1 = 0.6;
    P.alpha = 0.6;
    P.color = C.dust;
    P.floor = ground;
    emit(P);
  }
}
