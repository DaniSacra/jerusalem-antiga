import type { Rect } from '../core';
import { balloonOf } from '../game/model/inspect';
import type { Session } from '../game/session';
import { T } from '../render/strings';
import type { Anchors } from './anchors';
import { h, keyed, onTap } from './dom';
import { tone } from './parts';

/** The map's free area on screen (between the top bar, the column and the tools). */
export interface Free {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The tapped building's balloon, pinned to it: name, road and level, Melhorar and Demolir (`balloonOf`). */
export class Balloon {
  readonly el = h('div.anchor.balloon.panel.hidden');
  /** The footprint it points at (null: closed). */
  rect: Rect | null = null;
  /** The balloon's size, measured when its content changes (not every frame). */
  private size = { w: 250, h: 120 };
  /** Beside the building, kept in the map's free area (never over the controls). */
  private at = (p: { x: number; y: number }) => {
    const f = this.free();
    const x = Math.max(f.left, Math.min(p.x + 24, f.right - this.size.w));
    const y = Math.max(f.top, Math.min(p.y - 30, f.bottom - this.size.h));
    return `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  };

  constructor(private s: Session, private anchors: Anchors, private free: () => Free) {}

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
    this.anchors.pin(this.el, bal.rect, this.at);
    const affordable = s.state.silver >= (bal.upgrade?.cost ?? 0);
    const key = bal.key + affordable;
    const changed = (this.el as { _key?: string })._key !== key || this.el.classList.contains('hidden');
    keyed(this.el, key, () => {
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
    if (changed) this.size = { w: this.el.offsetWidth, h: this.el.offsetHeight };
  }
}
