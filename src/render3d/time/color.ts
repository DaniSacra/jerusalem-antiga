import { mixColor, mulColor } from '../../render/Seasons';

export { mixColor, mulColor };

/** "0xrrggbb" strings of the JSON files as numbers. */
export const hex = (s: string) => Number(s);

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Smooth 0..1 step (cosine-like, zero slope at both ends). */
export const smooth = (v: number) => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};

export const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

/** Colour times a scalar, per channel, clamped. */
export const scaleColor = (c: number, k: number) => {
  const ch = (s: number) => Math.min(255, Math.round(((c >> s) & 255) * k));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};
