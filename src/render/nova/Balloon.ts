import Phaser from 'phaser';
import type { AgeBand, Sex } from '../../core';
import { px, type Rect } from '../layout';
import { NOVA, NOVA_CSS } from '../palette';
import { onTap } from '../ui';
import { lineH, PHONE, S } from './metrics';
import { personFigure } from './people';
import { balloon, ntext, type ArrowSide } from './widgets';

/** A tappable row of a person (house balloon): figure, "Natã, 22" and the work under it. */
export interface Chip {
  id: number;
  title: string;
  sub: string;
  subColor?: string;
  band: AgeBand;
  sex: Sex;
}

/** Size of a person row (game px): 44 real px tall, wide enough for a name and a trade. */
export const CHIP_H = px(44);
export const CHIP_W = px(PHONE ? 140 : 190);
const CHIP_GAP = px(4);

/** One line of a balloon. `box` draws it on a darker rounded box (the "Ao evoluir" gains). */
export interface Line {
  text: string;
  color?: string;
  size?: number;
  bold?: boolean;
  box?: boolean;
  /** Extra space above the line. */
  gap?: number;
  /**
   * Pieces of a short line in their own colors (the cost "25 prata · 10 madeira" with what is
   * missing in red); `text` is then the whole line (it is what the tests read). Never wraps.
   */
  parts?: { text: string; color?: string }[];
  /** Instead of the text: rows of people in `cols` columns (the text is ignored). */
  grid?: Chip[];
  cols?: number;
}

/** Where a balloon of size w x h goes, and where its arrow points (along its side, from its corner). */
export type Placer = (w: number, h: number) => { x: number; y: number; arrow: { side: ArrowSide; at: number } | null };

/** A dark informative balloon (rounded corners, small arrow) with lines of text that wrap. */
export class TextBalloon {
  readonly root: Phaser.GameObjects.Container;
  private g: Phaser.GameObjects.Graphics;
  private body: Phaser.GameObjects.Container;
  private size = { w: 0, h: 0 };
  private key = '';
  /** Last drawn place, so following the camera redraws only when it moved. */
  private placed = '';
  rect: Rect | null = null;

  /** A person row was tapped. */
  onChip: ((id: number) => void) | null = null;

  constructor(private scene: Phaser.Scene, depth: number, private maxW = S.balloonW) {
    this.g = scene.add.graphics();
    this.body = scene.add.container(0, 0);
    this.root = scene.add.container(0, 0, [this.g, this.body]).setDepth(depth).setVisible(false);
  }

  get visible() {
    return this.root.visible;
  }

  /** Local top-left of the room kept under the `aside` column (see `show`), or null. */
  slot: { x: number; y: number } | null = null;

  /**
   * Sets the lines (redrawn only when they change) and places the balloon; `aside` goes in a second
   * column at the right, with room of `reserve` kept under it (the phone house keeps its buttons there).
   */
  show(lines: Line[], place: Placer, aside: Line[] = [], reserve: { w: number; h: number } | null = null) {
    const key = JSON.stringify([lines, aside, reserve]);
    if (key !== this.key) {
      this.key = key;
      this.placed = '';
      this.build(lines, aside, reserve);
    }
    this.root.setVisible(true);
    this.place(place);
  }

  /** Moves it (e.g. following a building as the camera moves). */
  place(place: Placer) {
    const { w, h } = this.size;
    const p = place(w, h);
    this.root.setPosition(p.x, p.y);
    this.rect = { x: p.x, y: p.y, w, h };
    const at = JSON.stringify(p.arrow);
    if (at === this.placed) return;
    this.placed = at;
    this.g.clear();
    balloon(this.g, 0, 0, w, h, p.arrow);
  }

  hide() {
    this.root.setVisible(false);
    this.rect = null;
  }

  get height() {
    return this.size.h;
  }

  private build(lines: Line[], aside: Line[], reserve: { w: number; h: number } | null) {
    this.body.removeAll(true);
    this.slot = null;
    const pad = px(12);
    const box = this.scene.add.graphics();
    this.body.add(box);
    const main = this.column(lines, pad, pad, box);
    let w = main.w;
    let h = main.h;
    if (aside.length) {
      const gap = px(16);
      const x = pad + main.w + gap;
      const side = this.column(aside, x, pad, box, reserve?.w);
      if (reserve) {
        this.slot = { x, y: pad + side.h + px(8) };
        side.w = Math.max(side.w, reserve.w);
        side.h += px(8) + reserve.h;
      }
      box.lineStyle(Math.max(1, px(1)), NOVA.edge, 0.25).lineBetween(x - gap / 2, pad, x - gap / 2, pad + Math.max(main.h, side.h));
      w += gap + side.w;
      h = Math.max(h, side.h);
    }
    this.size = { w: Math.ceil(w + 2 * pad), h: Math.ceil(h + 2 * pad) };
  }

  /** Lays out a column of lines from (x, y); returns its size. Boxes are drawn on `box`. */
  private column(lines: Line[], x: number, y0: number, box: Phaser.GameObjects.Graphics, minWrap = 0): { w: number; h: number } {
    const wrap = Math.max(this.maxW - px(24), minWrap);
    let y = y0;
    let w = 0;
    const boxes: [number, number][] = [];
    for (const l of lines) {
      y += l.gap ?? 0;
      if (l.grid) {
        const cols = l.cols ?? 1;
        l.grid.forEach((c, k) => this.body.add(this.chip(c, x + (k % cols) * (CHIP_W + CHIP_GAP), y + Math.floor(k / cols) * (CHIP_H + CHIP_GAP))));
        const rows = Math.ceil(l.grid.length / cols);
        w = Math.max(w, Math.min(cols, l.grid.length) * (CHIP_W + CHIP_GAP) - CHIP_GAP);
        y += rows * (CHIP_H + CHIP_GAP) - CHIP_GAP + px(5);
        continue;
      }
      const size = l.size ?? S.text;
      const inset = l.box ? px(8) : 0;
      if (l.parts) {
        let px0 = x + inset;
        let th = 0;
        for (const p of l.parts) {
          const t = ntext(this.scene, px0, y + inset, p.text, size, p.color ?? l.color ?? NOVA_CSS.text, l.bold ?? true);
          this.body.add(t);
          px0 += t.width;
          th = Math.max(th, t.height);
        }
        w = Math.max(w, px0 - x + inset);
        if (l.box) boxes.push([y, th + 2 * inset]);
        y += th + 2 * inset + px(3);
        continue;
      }
      const t = ntext(this.scene, x + inset, y + inset, l.text, size, l.color ?? NOVA_CSS.text, l.bold ?? true)
        .setWordWrapWidth(wrap - 2 * inset)
        .setLineSpacing(lineH(size) - size * 1.15);
      this.body.add(t);
      w = Math.max(w, t.width + 2 * inset);
      if (l.box) boxes.push([y, t.height + 2 * inset]);
      y += t.height + 2 * inset + px(3);
    }
    for (const [by, bh] of boxes) box.fillStyle(NOVA.box, 0.95).fillRoundedRect(x - px(2), by, w + px(4), bh, px(8));
    return { w, h: y - px(3) - y0 };
  }

  /** A person row: a rounded dark box with the figure, the name and age, and the work under it; a tap calls `onChip`. */
  private chip(c: Chip, x: number, y: number): Phaser.GameObjects.Container {
    const s = this.scene;
    const bg = s.add.graphics().fillStyle(NOVA.box, 0.95).fillRoundedRect(0, 0, CHIP_W, CHIP_H, px(10));
    bg.lineStyle(Math.max(1, px(1)), NOVA.edge, 0.25).strokeRoundedRect(0, 0, CHIP_W, CHIP_H, px(10));
    const fig = personFigure(s, c.band, c.sex, CHIP_H - px(10)).setPosition(CHIP_H / 2, CHIP_H / 2);
    const tx = CHIP_H - px(1);
    const title = ntext(s, tx, CHIP_H / 2 - px(1), c.title, S.text).setOrigin(0, 1);
    const sub = ntext(s, tx, CHIP_H / 2 + px(1), c.sub, S.small, c.subColor ?? NOVA_CSS.muted, false).setOrigin(0, 0);
    // A long name or trade shrinks to fit the row, never under 12 real px.
    for (const t of [title, sub]) for (let f = parseFloat(t.style.fontSize as string); t.width > CHIP_W - tx - px(6) && f > S.small; f -= px(0.5)) t.setFontSize(Math.max(S.small, f - px(0.5)));
    const root = s.add.container(x, y, [bg, fig, title, sub]).setSize(CHIP_W, CHIP_H);
    // A container's hit area is measured from its size box centered on it: the drawing starts at its corner.
    root.setInteractive({ hitArea: new Phaser.Geom.Rectangle(CHIP_W / 2, CHIP_H / 2, CHIP_W, CHIP_H), hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: true });
    // Next frame: opening the sheet destroys this balloon's rows, never inside their own input event.
    onTap(root, () => s.time.delayedCall(0, () => this.onChip?.(c.id)), (down) => root.setAlpha(down ? 0.7 : 1));
    return root;
  }
}
