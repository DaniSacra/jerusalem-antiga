import Phaser from 'phaser';
import type { BuildableKind, Building, Cell, CityReadout, GameState } from '../../core';
import { cardOf, levelStatOf, type CardAction, type CardLine, type CardTone } from '../../game/model/card';
import { HW } from '../iso';
import { px, type Rect } from '../layout';
import { NOVA_CSS } from '../palette';
import { T } from '../strings';
import { TEX } from '../textures';
import { TextBalloon, type Line } from './Balloon';
import { H, PHONE, S, W } from './metrics';
import { icon, nameTag, ntext, RoundButton } from './widgets';

export { levelStatOf };

/** What the main (gold) button does (see `CardAction`). */
export type Action = CardAction;

interface Card {
  lines: Line[];
  /** Phone: a second column at the right of the lines (the house's level, beside its people). */
  aside: Line[];
  /** Footprint the balloon points at. */
  foot: { x: number; y: number; w: number; h: number };
  building: Building | null;
  action: Action | null;
  demolish: boolean;
}

export interface InspectorHost {
  /** Screen point (UI coordinates) of the center of a grid footprint, and the camera zoom. */
  cellScreen(x: number, y: number, w: number, h: number): { x: number; y: number; zoom: number };
  act(a: Action): void;
  demolish(cell: Cell): void;
  close(): void;
  /** Where the balloon may go: under the top bar, and above the bottom tools when over them. */
  limits(): { top: number; toolsRight: number; toolsTop: number };
  /** A person row was tapped: open the person sheet. */
  openPerson(id: number): void;
  /** The balloon does not fit beside the building: move the camera so the building goes `dx` screen px sideways. */
  nudge(dx: number): void;
}

const COLOR: Record<CardTone, string> = { text: NOVA_CSS.text, good: NOVA_CSS.good, bad: NOVA_CSS.bad, warn: NOVA_CSS.warn, gold: NOVA_CSS.gold, muted: NOVA_CSS.muted };

/** A card line (`src/game/model/card`, shared with the 3D) as a line of the 2D balloon. */
export function cardLine(l: CardLine): Line {
  return {
    text: l.text,
    color: l.tone ? COLOR[l.tone] : undefined,
    size: l.big ? S.num : undefined,
    bold: l.plain ? false : undefined,
    box: l.box,
    gap: l.gap ? px(l.gap) : undefined,
    grid: l.people?.map(({ subTone, ...p }) => ({ ...p, subColor: subTone ? COLOR[subTone] : undefined })),
    cols: l.cols,
    parts: l.parts?.map((p) => ({ text: p.text, color: COLOR[p.tone] })),
  };
}

/** The card of a tapped cell; null for plain land and the river (a tap there closes the balloon). */
function card(s: GameState, c: Cell, city: CityReadout): Card | null {
  const k = cardOf(s, c, city, PHONE);
  return k && { ...k, lines: k.lines.map(cardLine), aside: k.aside.map(cardLine) };
}

/**
 * Balloon of the cell tapped with Mover, beside it with an arrow, following the camera. Round buttons
 * under it: the gold main action (when there is something to do), Demolir (never the altar or the
 * temple; a second tap confirms) and Fechar.
 */
export class Inspector {
  private balloon: TextBalloon;
  private buttons: Phaser.GameObjects.Container;
  private btns: RoundButton[] = [];
  private tags: Rect[] = [];
  private card: Card | null = null;
  private cell: Cell | null = null;
  private key = '';
  private confirm: Phaser.Time.TimerEvent | null = null;
  private side: 'left' | 'right' = 'right';
  /** Width of the row of round buttons. */
  private rowW = 0;
  /** The buttons sit inside the balloon (see `TextBalloon.slot`) instead of under it. */
  private inside = false;

  constructor(private scene: Phaser.Scene, private host: InspectorHost) {
    this.balloon = new TextBalloon(scene, 46);
    this.balloon.onChip = (id) => this.host.openPerson(id);
    this.buttons = scene.add.container(0, 0).setDepth(46).setVisible(false);
  }

  get open() {
    return !!this.card;
  }

  refresh(s: GameState, city: CityReadout, selected: Cell | null) {
    this.cell = selected;
    this.card = selected ? card(s, selected, city) : null;
    if (!this.card) {
      this.balloon.hide();
      this.buttons.setVisible(false);
      this.key = '';
      this.nudgedFor = '';
      return;
    }
    const key = JSON.stringify([selected, this.card.action?.label, this.card.action?.dim, this.card.demolish]);
    if (key !== this.key) {
      this.key = key;
      this.makeButtons();
    }
    // Phone house: the buttons go inside the balloon, under the level column (the screen is short).
    this.inside = PHONE && this.card.aside.length > 0;
    this.balloon.show(this.card.lines, this.placer(), this.card.aside, this.inside ? { w: this.rowW, h: S.btn + S.labelH + px(3) } : null);
    this.placeButtons();
  }

  private makeButtons() {
    this.buttons.removeAll(true);
    this.btns = [];
    this.tags = [];
    this.confirm?.remove();
    const c = this.card!;
    const d = S.btn;
    const list: [Phaser.GameObjects.GameObject[], string, () => void, 'gold' | 'parchment' | 'dim'][] = [];
    if (c.action) {
      const a = c.action;
      const kind = a.kind === 'upgrade' ? (a.target.kind as BuildableKind) : a.kind;
      const content = kind === 'road' ? [icon(this.scene, 'road', d * 0.56)] : [this.scene.add.image(0, 0, TEX.thumb(kind)).setDisplaySize(d - px(8), d - px(8))];
      list.push([content, a.label, () => this.host.act(a), a.dim ? 'dim' : 'gold']);
    }
    if (c.demolish) list.push([[icon(this.scene, 'hammer', d * 0.56)], T.nova.inspect.demolish, () => this.demolishTap(), 'parchment']);
    list.push([[ntext(this.scene, 0, 0, '✕', S.num, NOVA_CSS.ink).setOrigin(0.5)], T.nova.inspect.close, () => this.host.close(), 'parchment']);
    let x = 0;
    for (const [content, label, press, style] of list) {
      const tag = nameTag(this.scene, 0, d / 2 + px(3) + S.labelH / 2, label);
      const w = Math.max(d, tag.w);
      const cx = x + w / 2;
      for (const o of tag.objects) o.x += cx;
      const btn = new RoundButton(this.scene, cx, 0, d, d, content, press, style === 'dim' ? { dim: true } : { style });
      this.buttons.add([btn.root, ...tag.objects]);
      this.btns.push(btn);
      this.tags.push({ x: cx - tag.w / 2, y: d / 2, w: tag.w, h: S.labelH + px(3) });
      x += w + px(10);
    }
    this.rowW = x - px(10);
  }

  /** First tap on Demolir asks "Certeza?"; a second tap within 2.5 s demolishes. */
  private demolishTap() {
    const btn = this.btns[this.card?.action ? 1 : 0];
    if (this.confirm) {
      this.confirm.remove();
      this.confirm = null;
      if (this.cell) this.host.demolish(this.cell);
      return;
    }
    btn.setLook({ style: 'gold', selected: true });
    const tagText = this.buttons.list.find((o) => o instanceof Phaser.GameObjects.Text && o.text === T.nova.inspect.demolish) as Phaser.GameObjects.Text | undefined;
    tagText?.setText(T.nova.inspect.confirm).setColor(NOVA_CSS.bad);
    this.confirm = this.scene.time.delayedCall(2500, () => {
      this.confirm = null;
      btn.setLook({ style: 'parchment' });
      tagText?.setText(T.nova.inspect.demolish).setColor(NOVA_CSS.text);
    });
  }

  /** The selection the camera was last nudged for (once per tapped building). */
  private nudgedFor = '';

  /**
   * Beside the building: right of it if there is room, else left; never under the screen edges. A
   * balloon too wide for either side (the phone house with its people) is kept on screen and the
   * camera is asked once to move the building aside.
   */
  private placer() {
    const f = this.card!.foot;
    return (w: number, h: number) => {
      const p = this.host.cellScreen(f.x, f.y, f.w, f.h);
      const reach = Math.max(px(24), ((f.w + f.h) / 2) * HW * p.zoom);
      const right = p.x + reach + px(9);
      const left = p.x - reach - px(9) - w;
      const btnH = this.inside ? 0 : S.btn + S.labelH + px(10);
      const maxRight = W - S.col - px(30);
      const minLeft = S.margin + S.side + px(10);
      const fitsRight = right + w <= maxRight;
      const fitsLeft = left >= minLeft;
      this.side = fitsRight || (!fitsLeft && p.x < W / 2) ? 'right' : 'left';
      let x = this.side === 'right' ? right : left;
      if (!fitsRight && !fitsLeft) {
        x = Math.max(minLeft, Math.min(maxRight - w, x));
        const key = JSON.stringify(this.cell);
        if (this.nudgedFor !== key) {
          this.nudgedFor = key;
          this.host.nudge(this.side === 'right' ? maxRight - w - right : minLeft - left);
        }
      }
      // Under the top bar, and above the bottom tools when it would reach them (never hides a control).
      const lim = this.host.limits();
      const bottom = x < lim.toolsRight ? lim.toolsTop - S.gap : H - S.margin;
      const y = Math.max(lim.top + S.gap, Math.min(bottom - h - btnH, p.y - h / 2));
      return { x, y, arrow: { side: this.side === 'right' ? ('left' as const) : ('right' as const), at: p.y - y } };
    };
  }

  private placeButtons() {
    const r = this.balloon.rect;
    if (!r) return;
    const slot = this.inside ? this.balloon.slot : null;
    if (slot) this.buttons.setVisible(true).setPosition(r.x + slot.x, r.y + slot.y + S.btn / 2);
    else this.buttons.setVisible(true).setPosition(r.x + px(4), r.y + r.h + px(8) + S.btn / 2);
  }

  /** Every frame: follows the building when the camera moves. */
  update() {
    if (!this.card) return;
    this.balloon.place(this.placer());
    this.placeButtons();
  }

  contains(x: number, y: number) {
    if (!this.card) return false;
    const inR = (r: Rect | null) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    const ox = this.buttons.x;
    const oy = this.buttons.y;
    return inR(this.balloon.rect) || this.btns.some((b) => b.contains(x, y)) || this.tags.some((t) => inR({ x: t.x + ox, y: t.y + oy, w: t.w, h: t.h }));
  }
}
