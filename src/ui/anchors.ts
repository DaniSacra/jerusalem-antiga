import type { Rect } from '../core';

/** Screen point over a footprint, `top` units above the ground (null behind the camera). */
export type ScreenOf = (r: Rect, top?: number) => { x: number; y: number } | null;

interface Pin {
  el: HTMLElement;
  at: Rect | null;
  top: number;
  /** The transform for the point (and, for what moves on its own, the time since pinned); null hides it there. */
  place: (p: { x: number; y: number }, ageMs: number) => string | null;
  age: number;
  /** Removed (from the page too) after this long (ms; rising texts). */
  life: number;
  /** The transform last written, null when hidden, undefined before the first (a still camera writes nothing). */
  shown?: string | null;
}

/** The map's free area on screen (between the top bar, the side buttons, the column and the tools). */
export interface Free {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A screen point inside the free map. */
export const insideFree = (p: { x: number; y: number }, f: Free) => p.x >= f.left && p.x <= f.right && p.y >= f.top && p.y <= f.bottom;

/**
 * Size of what floats over the buildings at a camera zoom (1 at the opening distance): full size up
 * close, smaller when the camera is far, so a whole town of balloons does not cover the map.
 */
export const labelScale = (zoom: number) => Math.min(1, Math.max(0.6, zoom));

/**
 * Where a balloon `w` wide goes beside a building at screen x `px`, between `left` and `right`: right
 * of it if it fits, else left of it. When neither fits (too wide, or the building is off the free
 * map) it is kept inside: `nudge` is how far the camera should move the building on screen to clear
 * it (0 when it fits).
 */
export function besideX(px: number, w: number, left: number, right: number, gap = 30): { x: number; nudge: number } {
  const r = px + gap;
  const l = px - gap - w;
  if (r >= left && r + w <= right) return { x: r, nudge: 0 };
  if (l >= left && l + w <= right) return { x: l, nudge: 0 };
  // The side with more room: the building moves away from the balloon by what is missing.
  const toRight = right - px >= px - left;
  return toRight ? { x: Math.max(left, right - w), nudge: right - w - r } : { x: left, nudge: left - l };
}

/**
 * The arrow of a balloon at (x, y), `w` x `h`, pointing at `p`: on the side the point is ('left' when
 * it is left of the balloon), at the point's height inside the balloon (kept `inset` from the
 * corners); null when the point is under the balloon (no side to point from).
 */
export function arrowOf(p: { x: number; y: number }, x: number, y: number, w: number, h: number, inset = 18): { side: 'left' | 'right'; y: number } | null {
  const side = p.x <= x ? 'left' : p.x >= x + w ? 'right' : null;
  if (!side) return null;
  return { side, y: Math.round(Math.max(inset, Math.min(h - inset, p.y - y))) };
}

/** Writes a balloon's arrow (`data-arrow` and `--ay` in ui.css), only when it changed. */
export function setArrow(el: HTMLElement, a: ReturnType<typeof arrowOf>) {
  const side = a?.side ?? '';
  if ((el.dataset.arrow ?? '') !== side) {
    if (side) el.dataset.arrow = side;
    else delete el.dataset.arrow;
  }
  const ay = a ? `${a.y}px` : '';
  if (el.style.getPropertyValue('--ay') !== ay) el.style.setProperty('--ay', ay);
}

/**
 * Everything pinned to the world (balloon, preview pill, rising texts, the tutorial arrow on a
 * place): one pass per frame that writes `transform` and `visibility` only when they change (no
 * layout reads).
 */
export class Anchors {
  private pins = new Map<HTMLElement, Pin>();

  constructor(private screenOf: ScreenOf) {}

  /** Pins an element over a footprint (null: unpinned and left where it is). */
  pin(el: HTMLElement, at: Rect | null, place: Pin['place'], top = 0, life = Infinity) {
    const old = this.pins.get(el);
    this.pins.set(el, { el, at, top, place, age: old && old.at === at ? old.age : 0, life, shown: old?.shown });
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
    const t = s ? p.place(s, p.age) : null;
    if (t === p.shown) return;
    if (p.shown === undefined || (t === null) !== (p.shown === null)) p.el.style.visibility = t === null ? 'hidden' : 'visible';
    if (t !== null) p.el.style.transform = t;
    p.shown = t;
  }
}
