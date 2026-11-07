import type { Rect } from '../core';
import type { Session } from '../game/session';
import { T } from '../game/strings';
import type { Tool } from '../game/tools';
import type { Anchors } from './anchors';
import { h, onTap, setText } from './dom';
import { ICONS } from './icons';

type Dir = 'down' | 'left' | 'right';
export type ArrowTarget = { tool: Tool } | { rect: Rect; lift: number } | null;
/** Where a tool's (or a building's) button is, for the arrow (measured: on update/resize only). */
export type ButtonArrow = (t: Tool) => { x: number; y: number; dir: Dir } | null;

/** The arrow is drawn pointing down with its tip at the bottom centre. */
const arrowAt = (p: { x: number; y: number }, dir: Dir) =>
  `translate(${Math.round(p.x - 20)}px, ${Math.round(p.y - 56)}px) rotate(${dir === 'down' ? 0 : dir === 'right' ? -90 : 90}deg)`;

/** The bobbing gold arrow at a button or a place on the map (the tutorial's, and the "O que fazer agora" line's). */
export class Pointer {
  readonly el = h('div.anchor.arrow.hidden');
  /** The last target, and its key (a button's spot is measured again only on `remeasure`). */
  private key = '';

  constructor(private anchors: Anchors, private buttonArrow: ButtonArrow) {
    this.el.innerHTML = ICONS.arrow;
  }

  /** Buttons moved (resize, a refresh): the next `point` measures them again. */
  remeasure() {
    this.key = '';
  }

  /** Where the arrow points (called every frame: cheap when the target did not change). */
  point(target: ArrowTarget) {
    const key = !target ? '' : 'tool' in target ? `t:${target.tool}` : `r:${target.rect.x},${target.rect.y},${target.rect.w},${target.rect.h},${target.lift}`;
    if (key === this.key) return;
    this.key = key;
    const a = this.el;
    if (!target) {
      a.classList.add('hidden');
      this.anchors.unpin(a);
      return;
    }
    if ('tool' in target) {
      this.anchors.unpin(a);
      const b = this.buttonArrow(target.tool);
      a.classList.toggle('hidden', !b);
      if (b) {
        a.style.visibility = 'visible';
        a.style.transform = arrowAt(b, b.dir);
      }
      return;
    }
    const { rect, lift } = target;
    a.classList.remove('hidden');
    this.anchors.pin(a, rect, (p) => arrowAt({ x: p.x, y: p.y + lift }, 'down'), 1);
  }
}

/** The tutorial bubble (sentence and Pular) and its arrow, at a button or a place on the map. */
export class Tutorial {
  readonly bubble: HTMLDivElement;
  private pointer: Pointer;
  private text = h('span');

  constructor(s: Session, anchors: Anchors, buttonArrow: ButtonArrow) {
    const skip = h('button', {}, T.tutorial.skip);
    onTap(skip, () => s.skipTutorial());
    this.bubble = h('div.tutorial.hidden', {}, this.text, skip);
    this.pointer = new Pointer(anchors, buttonArrow);
  }

  get arrow() {
    return this.pointer.el;
  }

  get open() {
    return !this.bubble.classList.contains('hidden');
  }

  setSentence(sentence: string | null) {
    this.bubble.classList.toggle('hidden', sentence === null);
    if (sentence !== null) setText(this.text, sentence);
    else this.point(null);
  }

  remeasure() {
    this.pointer.remeasure();
  }

  /** Where the arrow points, while the bubble shows. */
  point(target: ArrowTarget) {
    this.pointer.point(this.open ? target : null);
  }
}
