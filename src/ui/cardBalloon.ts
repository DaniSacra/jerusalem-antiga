import type { BuildableKind, Rect } from '../core';
import { cardOf, type Card, type CardAction } from '../game/model/card';
import type { Session } from '../game/session';
import { T } from '../render/strings';
import { besideX, type Anchors } from './anchors';
import { h, onTap } from './dom';
import { cardLine } from './lines';

/** The map's free area on screen (between the top bar, the side buttons, the column and the tools). */
export interface Free {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** How long Demolir waits for its second tap ("Certeza?"), ms. */
const CONFIRM_MS = 2500;

/**
 * The tapped cell's balloon, pinned beside it (the same card as the 2D, `cardOf`): name, people (a
 * tap opens their sheet), level, needs; the gold main action ("Onde pôr…", Rua, Melhorar), Demolir
 * with "Certeza?" and Fechar. It stays in the map's free area, never over the controls.
 */
export class CardBalloon {
  readonly el = h('div.anchor.balloon.panel.hidden', { 'data-spot': 'balloon' });
  /** The footprint it points at (null: closed). */
  rect: Rect | null = null;
  private key = '';
  private size = { w: 250, h: 120 };
  private confirm: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private s: Session,
    private anchors: Anchors,
    private free: () => Free,
    private phone: () => boolean,
    private openPerson: (id: number) => void,
    private nudge: (dx: number) => void,
  ) {}

  /** The building the camera was last moved aside for (once per tap). */
  private nudgedFor = '';

  /**
   * Beside the building (right of it, else left), kept in the free area. Too wide for either side
   * (the phone house with its people), the camera moves the building aside once.
   */
  private at = (p: { x: number; y: number }) => {
    const f = this.free();
    const { w, h: ht } = this.size;
    const { x, nudge } = besideX(p.x, w, f.left, f.right);
    const cell = JSON.stringify(this.s.selected);
    if (nudge && this.nudgedFor !== cell) {
      this.nudgedFor = cell;
      this.nudge(nudge);
    }
    const y = Math.max(f.top, Math.min(f.bottom - ht, p.y - ht / 2));
    return `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  };

  update() {
    const s = this.s;
    const c = s.tool === 'view' || s.tool === 'clear' ? s.selected : null;
    const card = c ? cardOf(s.state, c, s.city, this.phone()) : null;
    if (!c || !card) {
      this.el.classList.add('hidden');
      this.rect = null;
      this.key = '';
      this.anchors.unpin(this.el);
      return;
    }
    this.rect = card.foot;
    this.anchors.pin(this.el, card.foot, this.at);
    const key = JSON.stringify([c, card.lines, card.aside, card.action?.label, card.action?.dim, card.demolish]);
    const hidden = this.el.classList.contains('hidden');
    const rebuilt = key !== this.key;
    if (rebuilt) {
      this.key = key;
      this.build(card);
    }
    this.el.classList.remove('hidden');
    this.measure(hidden || rebuilt);
  }

  private maxH = 0;

  /** Never taller than the free area (it scrolls inside then); its size is read only when it changed. */
  private measure(changed: boolean) {
    const f = this.free();
    const maxH = Math.max(120, Math.floor(f.bottom - f.top));
    if (maxH !== this.maxH) {
      this.maxH = maxH;
      this.el.style.maxHeight = `${maxH}px`;
      changed = true;
    }
    if (!changed) return;
    this.size = { w: this.el.offsetWidth, h: this.el.offsetHeight };
    this.anchors.place(this.el);
  }

  private build(card: Card) {
    this.stopConfirm();
    const s = this.s;
    const cell = s.selected!;
    const person = (id: number) => this.openPerson(id);
    const main = h('div.main', {}, ...card.lines.map((l) => cardLine(l, person)));
    const acts = h('div.acts');
    if (card.action) acts.append(this.actionButton(card.action));
    if (card.demolish) {
      const del = h('button.act.red', { 'data-spot': 'balloon-demolish' }, T.nova.inspect.demolish);
      onTap(del, () => {
        if (this.confirm) {
          this.stopConfirm();
          s.demolishAt(cell);
          return;
        }
        del.textContent = T.nova.inspect.confirm;
        del.classList.add('confirm');
        this.confirm = setTimeout(() => {
          this.confirm = null;
          del.textContent = T.nova.inspect.demolish;
          del.classList.remove('confirm');
        }, CONFIRM_MS);
      });
      acts.append(del);
    }
    const close = h('button.act.close', { 'data-spot': 'balloon-close', 'aria-label': T.nova.inspect.close }, '✕');
    onTap(close, () => s.deselect());
    acts.append(close);
    if (card.aside.length) {
      // Phone: the level part in a second column; the buttons under the people, the shorter one
      // (the screen is short).
      main.append(acts);
      const aside = h('div.aside', {}, ...card.aside.map((l) => cardLine(l, person)));
      this.el.replaceChildren(h('div.cols', {}, main, aside));
    } else this.el.replaceChildren(main, acts);
  }

  private actionButton(a: CardAction) {
    const b = h('button.act.gold', { class: a.dim ? 'dim' : null, 'data-spot': 'balloon-action' }, a.label);
    onTap(b, () => (a.kind === 'upgrade' ? this.s.upgradeAt(a.target) : this.s.showSpots(a.kind as BuildableKind | 'road', a.target)));
    return b;
  }

  private stopConfirm() {
    if (this.confirm) clearTimeout(this.confirm);
    this.confirm = null;
  }

  dispose() {
    this.stopConfirm();
  }
}
