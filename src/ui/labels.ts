import { balloonNeed, needLocked, type BalloonKind, type Economy, type GameState } from '../core';
import { insideFree, labelScale, type Anchors, type Free } from './anchors';
import { h } from './dom';

const svg = (body: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;

/** The problem icons (as the 2D's): road, workers crossed out, no source, the missing service, a sad face. */
const NEED: Record<BalloonKind, string> = {
  road: svg('<path d="M8 3L5 21M16 3l3 18" stroke="#6b4a2a" stroke-width="2.4" stroke-linecap="round"/><path d="M12 5v3M12 11v3M12 17v3" stroke="#d9a93e" stroke-width="2" stroke-linecap="round"/>'),
  workers: svg('<circle cx="12" cy="7" r="3.4" fill="#e9c39a"/><path d="M6 21v-5a6 6 0 0 1 12 0v5z" fill="#7fa6c9"/><path d="M4 4l16 16" stroke="#b0302a" stroke-width="2.6" stroke-linecap="round"/>'),
  noSource: svg('<circle cx="12" cy="12" r="8" fill="none" stroke="#b0302a" stroke-width="2.4"/><path d="M8 16L16 8" stroke="#b0302a" stroke-width="2.4"/>'),
  plaza: svg('<rect x="3" y="12" width="18" height="8" rx="1" fill="#eadfc8" stroke="#8a7a5a"/><path d="M4 9h16l-2-4H6z" fill="#d29a3a"/><rect x="8" y="15" width="8" height="2" fill="#6e4a2c"/>'),
  market: svg('<path d="M3 9h18l-2-5H5z" fill="#b5462f"/><path d="M6 9v1M10 9v1M14 9v1M18 9v1" stroke="#fff" stroke-width="3"/><rect x="5" y="10" width="14" height="10" fill="#dccbaa"/>'),
  park: svg('<rect x="2" y="17" width="20" height="4" rx="1" fill="#5f8a3a"/><circle cx="8" cy="10" r="5" fill="#4f7a2e"/><circle cx="16" cy="11" r="4" fill="#6f9a3a"/><path d="M8 15v3M16 15v3" stroke="#6e4a2c" stroke-width="2"/>'),
  sad: svg('<circle cx="12" cy="12" r="9" fill="#e0603a"/><path d="M8 17c1-2 7-2 8 0" stroke="#3b1a10" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="9" cy="10" r="1.3" fill="#3b1a10"/><circle cx="15" cy="10" r="1.3" fill="#3b1a10"/>'),
};
const LOCK = svg('<rect x="5" y="11" width="14" height="10" rx="2" fill="#d9a93e" stroke="#3b2a1a" stroke-width="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="#3b2a1a" stroke-width="2"/>');

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

  /** Over the footprint, its tip on the point, scaled from it; hidden off the free map (under the bars and buttons). */
  private place = (p: { x: number; y: number }) =>
    insideFree(p, this.free()) ? `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) scale(${labelScale(this.zoom()).toFixed(2)}) translate(-50%, -100%)` : null;

  update(s: GameState, eco: Economy) {
    const seen = new Set<number>();
    for (const b of s.buildings) {
      const need = balloonNeed(s, b, eco);
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
