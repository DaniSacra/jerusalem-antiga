import type { Rect } from '../core';
import { balloonOf } from '../game/model/inspect';
import type { Session } from '../game/session';
import { T } from '../render/strings';
import type { Anchors } from './anchors';
import { h, keyed, onTap } from './dom';
import { tone } from './parts';

const at = (p: { x: number; y: number }) => `translate(${Math.round(p.x + 24)}px, ${Math.round(p.y - 30)}px)`;

/** The tapped building's balloon, pinned to it: name, road and level, Melhorar and Demolir (`balloonOf`). */
export class Balloon {
  readonly el = h('div.anchor.balloon.panel.hidden');
  /** The footprint it points at (null: closed). */
  rect: Rect | null = null;

  constructor(private s: Session, private anchors: Anchors) {}

  update() {
    const s = this.s;
    const c = s.selected;
    const bal = balloonOf(s.state, c);
    if (!c || !bal) {
      this.el.classList.add('hidden');
      this.rect = null;
      this.anchors.unpin(this.el);
      return;
    }
    this.rect = bal.rect;
    this.anchors.pin(this.el, bal.rect, at);
    const affordable = s.state.silver >= (bal.upgrade?.cost ?? 0);
    keyed(this.el, bal.key + affordable, () => {
      const acts = h('div.acts');
      if (bal.upgrade) {
        const up = h('button.act.gold', {}, bal.upgrade.label);
        onTap(up, () => s.upgradeAt(c));
        acts.append(up);
      }
      if (bal.demolish) {
        const del = h('button.act.red', {}, T.nova.inspect.demolish);
        onTap(del, () => s.demolishAt(c));
        acts.append(del);
      }
      return [h('h3', {}, bal.title), ...bal.lines.map((l) => h('div', { class: tone(l.tone) || null }, l.text)), acts.childElementCount ? acts : null];
    });
    this.el.classList.remove('hidden');
  }
}
