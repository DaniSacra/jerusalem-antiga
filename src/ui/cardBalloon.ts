import type { BuildableKind, Cell, Rect } from '../core';
import { cardOf, type Card, type CardAction } from '../game/model/card';
import type { Session } from '../game/session';
import { T } from '../game/strings';
import { arrowOf, besideX, setArrow, type Anchors, type Free } from './anchors';
import { h, onTap } from './dom';
import { cardLine } from './lines';
import { ICONS } from './icons';

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
  private thumbs: Partial<Record<BuildableKind, string>> = {};
  private key = '';

  /** The buildings' thumbnails (data URLs) for the main action's button (built again with them). */
  setThumbs(urls: Partial<Record<BuildableKind, string>>) {
    this.thumbs = urls;
    this.key = '';
  }
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
  private nudgedFor: Cell | null = null;

  /**
   * Beside the building (right of it, else left), kept in the free area. Too wide for either side
   * (the phone house with its people), the camera moves the building aside once.
   */
  private at = (p: { x: number; y: number }) => {
    const f = this.free();
    const { w, h: ht } = this.size;
    const { x, nudge } = besideX(p.x, w, f.left, f.right);
    if (nudge && this.nudgedFor !== this.s.selected) {
      this.nudgedFor = this.s.selected;
      this.nudge(nudge);
    }
    const y = Math.max(f.top, Math.min(f.bottom - ht, p.y - ht / 2));
    // The arrow points at the building's side, from its height on the balloon.
    setArrow(this.el, arrowOf(p, x, y, w, ht));
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
    // Measured on every update (not per frame): fonts and wrapping can change its size after a build.
    this.measure(hidden || rebuilt || this.el.offsetWidth !== this.size.w || this.el.offsetHeight !== this.size.h);
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
    // ✕ on the title's line (a building with no buttons, the altar, needs no row of its own).
    const close = h('button.act.close', { 'data-spot': 'balloon-close', 'aria-label': T.nova.inspect.close }, '✕');
    onTap(close, () => s.deselect());
    const [title, ...rest] = card.lines.map((l) => cardLine(l, person));
    const main = h('div.main', {}, h('div.bhead', {}, title, close), ...rest);
    const acts = h('div.acts');
    if (card.action) acts.append(this.actionButton(card.action));
    if (card.demolish) {
      const label = h('span', {}, T.nova.inspect.demolish);
      const del = h('button.act.red', { 'data-spot': 'balloon-demolish' }, icon('clear'), label);
      onTap(del, () => {
        if (this.confirm) {
          this.stopConfirm();
          s.demolishAt(cell);
          return;
        }
        label.textContent = T.nova.inspect.confirm;
        del.classList.add('confirm');
        this.confirm = setTimeout(() => {
          this.confirm = null;
          label.textContent = T.nova.inspect.demolish;
          del.classList.remove('confirm');
        }, CONFIRM_MS);
      });
      acts.append(del);
    }
    if (card.aside.length) {
      // Phone: the level part in a second column; the buttons under the people, the shorter one
      // (the screen is short).
      if (acts.childElementCount) main.append(acts);
      const aside = h('div.aside', {}, ...card.aside.map((l) => cardLine(l, person)));
      this.el.replaceChildren(h('div.body', {}, h('div.cols', {}, main, aside)));
    } else this.el.replaceChildren(h('div.body', {}, main, ...(acts.childElementCount ? [acts] : [])));
  }

  private actionButton(a: CardAction) {
    // The building's thumbnail (Melhorar: the building itself), or the road's icon.
    const kind = a.kind === 'upgrade' ? (a.target.kind as BuildableKind) : a.kind;
    const url = kind === 'road' ? null : this.thumbs[kind];
    const pic = url ? h('img.pic', { src: url, alt: '' }) : kind === 'road' ? icon('road') : null;
    const b = h('button.act.gold', { class: a.dim ? 'dim' : null, 'data-spot': 'balloon-action' }, pic, h('span', {}, a.label));
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

/** A small icon in a balloon button. */
function icon(name: string) {
  const i = h('i.icon');
  i.innerHTML = ICONS[name] ?? '';
  return i;
}
