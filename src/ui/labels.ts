import { balloonNeed, needLocked, type BalloonKind, type GameState } from '../core';
import { insideFree, labelScale, type Anchors, type Free } from './anchors';
import { h } from './dom';

const svg = (body: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;

/** The problem icons (as the 2D's): road, workers crossed out, no source, the missing service, a sad face. */
/** Painted as the 2D drew them: ink outline, a touch of light, a red stroke across what is missing. */
const CROSS = '<path d="M4 4l16 16" stroke="#fff" stroke-width="4.6" stroke-linecap="round"/><path d="M4 4l16 16" stroke="#b0302a" stroke-width="2.6" stroke-linecap="round"/>';
const NEED: Record<BalloonKind, string> = {
  // A road broken in two, struck out.
  road: svg('<path d="M7.5 3L6 10M5.4 13L4.5 21M16.5 3L18 10M18.6 13l.9 8" stroke="#3b2a1a" stroke-width="2.4" stroke-linecap="round"/><path d="M12 4v3M12 16v3" stroke="#d9a93e" stroke-width="2" stroke-linecap="round"/>' + CROSS),
  // A worker, struck out.
  workers: svg('<circle cx="12" cy="7" r="3.4" fill="#e9c39a" stroke="#3b2a1a" stroke-width="1.4"/><path d="M6 21v-5a6 6 0 0 1 12 0v5z" fill="#7fa6c9" stroke="#3b2a1a" stroke-width="1.4" stroke-linejoin="round"/>' + CROSS),
  // Nothing to take from: a fish, struck out.
  noSource: svg('<path d="M3 12c3-4.5 9-5.5 13.5-1.5L21 7v10l-4.5-3.5C12 17.5 6 16.5 3 12z" fill="#8fb3c8" stroke="#3b2a1a" stroke-width="1.4" stroke-linejoin="round"/><circle cx="7.4" cy="11.2" r="1.1" fill="#3b2a1a"/><path d="M6 13.6c2 1.4 5 1.6 7.4.6" stroke="#d6e8f2" stroke-width="1.2" fill="none" stroke-linecap="round"/>' + CROSS),
  // A plaza: a bench under an awning on the paving.
  plaza: svg('<path d="M2.5 20l3-6h13l3 6z" fill="#eadfc8" stroke="#3b2a1a" stroke-width="1.3" stroke-linejoin="round"/><path d="M6 8.5h12l-1.4-4H7.4z" fill="#d29a3a" stroke="#3b2a1a" stroke-width="1.3" stroke-linejoin="round"/><path d="M7.5 8.5v7M16.5 8.5v7" stroke="#6e4a2c" stroke-width="1.5"/><rect x="8.5" y="14" width="7" height="2" rx="0.6" fill="#8a5a32" stroke="#3b2a1a" stroke-width="1"/>'),
  // A market stall with its striped awning.
  market: svg('<path d="M3 9.5h18l-2.2-5.5H5.2z" fill="#b5462f" stroke="#3b2a1a" stroke-width="1.3" stroke-linejoin="round"/><path d="M8 4.2l-.8 5.3M12 4v5.5M16 4.2l.8 5.3" stroke="#f4e8cc" stroke-width="1.6"/><rect x="5" y="9.5" width="14" height="10.5" fill="#dccbaa" stroke="#3b2a1a" stroke-width="1.3"/><circle cx="9" cy="14" r="1.6" fill="#d07a2c"/><circle cx="12.4" cy="14.4" r="1.6" fill="#7a9a3a"/><circle cx="15.6" cy="14" r="1.6" fill="#c0503c"/>'),
  // Two trees on the grass.
  park: svg('<rect x="2" y="17" width="20" height="4" rx="1.5" fill="#6f9a3a" stroke="#3b2a1a" stroke-width="1.2"/><path d="M8 14.5v3.5M16 15v3" stroke="#6e4a2c" stroke-width="2"/><circle cx="8" cy="9.5" r="5" fill="#4f7a2e" stroke="#3b2a1a" stroke-width="1.3"/><circle cx="16" cy="11" r="4" fill="#6f9a3a" stroke="#3b2a1a" stroke-width="1.3"/><path d="M5.4 8a3 3 0 0 1 2.2-2" stroke="#9cc26a" stroke-width="1.3" fill="none" stroke-linecap="round"/>'),
  sad: svg('<circle cx="12" cy="12" r="9.3" fill="#e0603a" stroke="#3b2a1a" stroke-width="1.5"/><path d="M6.4 9a6.5 6.5 0 0 1 3.4-3.2" stroke="#ffd2b8" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M8 17c1-2 7-2 8 0" stroke="#3b1a10" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="9" cy="10" r="1.3" fill="#3b1a10"/><circle cx="15" cy="10" r="1.3" fill="#3b1a10"/>'),
};
export const LOCK = svg('<rect x="5" y="11" width="14" height="10" rx="2" fill="#d9a93e" stroke="#3b2a1a" stroke-width="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="#3b2a1a" stroke-width="2"/>');

/** A problem balloon's size at full scale (px: `.need` in ui.css with its padding and border). */
const NEED_W = 46;
const NEED_H = 58;

/** How high over the ground a problem balloon floats (world units, above most roofs). */
const TOP = 1.7;

/**
 * Problem balloons over the buildings, the first problem of each (`balloonNeed`, the 2D's order):
 * no road, no workers, no source, the service a house misses (with a lock while it is still locked),
 * a sad house. HTML pinned to the world: full size up close, smaller from far (`labelScale`).
 */
export class ProblemLabels {
  readonly el = h('div.labels');
  private shown = new Map<number, { el: HTMLElement; key: string }>();

  constructor(
    private anchors: Anchors,
    private zoom: () => number,
    private free: () => Free,
  ) {}

  /** Over the footprint, its tip on the point, scaled from it; hidden unless all of it is on the free map (not under the bars and buttons). */
  private place = (p: { x: number; y: number }) => {
    const k = labelScale(this.zoom());
    const f = this.free();
    const [w, h] = [NEED_W * k, NEED_H * k];
    const whole = insideFree({ x: p.x - w / 2, y: p.y - h }, f) && insideFree({ x: p.x + w / 2, y: p.y }, f);
    return whole ? `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) scale(${k.toFixed(2)}) translate(-50%, -100%)` : null;
  };

  update(s: GameState) {
    const seen = new Set<number>();
    for (const b of s.buildings) {
      const need = balloonNeed(s, b);
      if (!need) continue;
      seen.add(b.id);
      const locked = needLocked(s, need);
      const key = `${need}:${locked}`;
      let cur = this.shown.get(b.id);
      if (!cur) {
        cur = { el: h('div.anchor.need', { 'data-need': need }), key: '' };
        this.shown.set(b.id, cur);
        this.el.append(cur.el);
      }
      if (cur.key !== key) {
        cur.key = key;
        cur.el.dataset.need = need;
        cur.el.innerHTML = NEED[need] + (locked ? `<span class="lock">${LOCK}</span>` : '');
      }
      this.anchors.pin(cur.el, { x: b.x, y: b.y, w: b.w, h: b.h }, this.place, TOP);
    }
    for (const [id, cur] of this.shown)
      if (!seen.has(id)) {
        this.anchors.unpin(cur.el);
        cur.el.remove();
        this.shown.delete(id);
      }
  }
}
