import type { Rect } from '../core';

/** Screen point over a footprint, `top` units above the ground (null behind the camera). */
export type ScreenOf = (r: Rect, top?: number) => { x: number; y: number } | null;

interface Pin {
  el: HTMLElement;
  at: Rect | null;
  top: number;
  /** The transform for the point (and, for what moves on its own, the time since pinned). */
  place: (p: { x: number; y: number }, ageMs: number) => string;
  age: number;
  /** Removed (from the page too) after this long (ms; rising texts). */
  life: number;
}

/**
 * Everything pinned to the world (balloon, preview pill, rising texts, the tutorial arrow on a
 * place): one pass per frame that only writes `transform` and `visibility` (no layout reads).
 */
/**
 * Size of what floats over the buildings at a camera zoom (1 at the opening distance): full size up
 * close, smaller when the camera is far, so a whole town of balloons does not cover the map.
 */
export const labelScale = (zoom: number) => Math.min(1, Math.max(0.6, zoom));

/**
 * Where a balloon `w` wide goes beside a building at screen x `px`, between `left` and `right`: right
 * of it if it fits, else left of it. When neither fits it is kept inside and covers the building:
 * `nudge` is how far the camera should move the building on screen to clear it (0 when it fits).
 */
export function besideX(px: number, w: number, left: number, right: number, gap = 30): { x: number; nudge: number } {
  const r = px + gap;
  const l = px - gap - w;
  if (r + w <= right) return { x: r, nudge: 0 };
  if (l >= left) return { x: l, nudge: 0 };
  // The side with more room: the building moves away from the balloon by what is missing.
  const toRight = right - px >= px - left;
  return toRight ? { x: Math.max(left, right - w), nudge: right - w - r } : { x: left, nudge: left - l };
}

export class Anchors {
  private pins = new Map<HTMLElement, Pin>();

  constructor(private screenOf: ScreenOf) {}

  /** Pins an element over a footprint (null: unpinned and left where it is). */
  pin(el: HTMLElement, at: Rect | null, place: Pin['place'], top = 0, life = Infinity) {
    const old = this.pins.get(el);
    this.pins.set(el, { el, at, top, place, age: old && old.at === at ? old.age : 0, life });
  }

  unpin(el: HTMLElement) {
    this.pins.delete(el);
  }

  frame(dtMs: number) {
    for (const p of this.pins.values()) {
      if (!p.at) continue;
      p.age += dtMs;
      if (p.age >= p.life) {
        p.el.remove();
        this.pins.delete(p.el);
        continue;
      }
      this.put(p);
    }
  }

  /** Places a pinned element now (it just showed or changed size), not on the next frame. */
  place(el: HTMLElement) {
    const p = this.pins.get(el);
    if (p?.at) this.put(p);
  }

  private put(p: Pin) {
    const s = this.screenOf(p.at!, p.top);
    p.el.style.visibility = s ? 'visible' : 'hidden';
    if (s) p.el.style.transform = p.place(s, p.age);
  }
}
