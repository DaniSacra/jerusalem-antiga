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
      const s = this.screenOf(p.at, p.top);
      p.el.style.visibility = s ? 'visible' : 'hidden';
      if (s) p.el.style.transform = p.place(s, p.age);
    }
  }
}
