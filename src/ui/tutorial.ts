import type { Rect } from '../core';
import type { Session } from '../game/session';
import { T } from '../game/strings';
import type { Tool } from '../game/tools';
import type { Anchors } from './anchors';
import { h, onTap, setText } from './dom';
import { ICONS } from './icons';

type Dir = 'down' | 'left' | 'right';
export type ArrowTarget = { tool: Tool } | { rect: Rect; lift: number } | null;

/** The arrow is drawn pointing down with its tip at the bottom centre. */
const arrowAt = (p: { x: number; y: number }, dir: Dir) =>
  `translate(${Math.round(p.x - 20)}px, ${Math.round(p.y - 56)}px) rotate(${dir === 'down' ? 0 : dir === 'right' ? -90 : 90}deg)`;

/** The tutorial bubble (sentence and Pular) and its arrow, at a button or a place on the map. */
export class Tutorial {
  readonly bubble: HTMLDivElement;
  readonly arrow = h('div.anchor.arrow.hidden');
  private text = h('span');
  /** The last target, and its key (a button's spot is measured again only on `remeasure`). */
  private key = '';

  constructor(s: Session, private anchors: Anchors, private buttonArrow: (t: Tool) => { x: number; y: number; dir: Dir } | null) {
    const skip = h('button', {}, T.tutorial.skip);
    onTap(skip, () => s.skipTutorial());
    this.bubble = h('div.tutorial.hidden', {}, this.text, skip);
    this.arrow.innerHTML = ICONS.arrow;
  }

  get open() {
    return !this.bubble.classList.contains('hidden');
  }

  setSentence(sentence: string | null) {
    this.bubble.classList.toggle('hidden', sentence === null);
    if (sentence !== null) setText(this.text, sentence);
    else this.point(null);
  }

  /** Buttons moved (resize, a refresh): the next `point` measures them again. */
  remeasure() {
    this.key = '';
  }

  /** Where the arrow points (called every frame: cheap when the target did not change). */
  point(target: ArrowTarget) {
    const show = !!target && this.open;
    const key = !show ? '' : 'tool' in target! ? `t:${target.tool}` : `r:${target.rect.x},${target.rect.y},${target.rect.w},${target.rect.h},${target.lift}`;
    if (key === this.key) return;
    this.key = key;
    const a = this.arrow;
    if (!show) {
      a.classList.add('hidden');
      this.anchors.unpin(a);
      return;
    }
    if ('tool' in target!) {
      this.anchors.unpin(a);
      const b = this.buttonArrow(target.tool);
      a.classList.toggle('hidden', !b);
      if (b) {
        a.style.visibility = 'visible';
        a.style.transform = arrowAt(b, b.dir);
      }
      return;
    }
    const { rect, lift } = target!;
    a.classList.remove('hidden');
    this.anchors.pin(a, rect, (p) => arrowAt({ x: p.x, y: p.y + lift }, 'down'), 1);
  }
}
