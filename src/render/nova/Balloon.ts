import Phaser from 'phaser';
import { px, type Rect } from '../layout';
import { NOVA, NOVA_CSS } from '../palette';
import { lineH, S } from './metrics';
import { balloon, ntext, type ArrowSide } from './widgets';

/** One line of a balloon. `box` draws it on a darker rounded box (the "Ao evoluir" gains). */
export interface Line {
  text: string;
  color?: string;
  size?: number;
  bold?: boolean;
  box?: boolean;
  /** Extra space above the line. */
  gap?: number;
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

  constructor(private scene: Phaser.Scene, depth: number, private maxW = S.balloonW) {
    this.g = scene.add.graphics();
    this.body = scene.add.container(0, 0);
    this.root = scene.add.container(0, 0, [this.g, this.body]).setDepth(depth).setVisible(false);
  }

  get visible() {
    return this.root.visible;
  }

  /** Sets the lines (redrawn only when they change) and places the balloon. */
  show(lines: Line[], place: Placer) {
    const key = JSON.stringify(lines);
    if (key !== this.key) {
      this.key = key;
      this.placed = '';
      this.build(lines);
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

  private build(lines: Line[]) {
    this.body.removeAll(true);
    const pad = px(12);
    const wrap = this.maxW - 2 * pad;
    let y = pad;
    let w = 0;
    const boxes: [number, number][] = [];
    for (const l of lines) {
      y += l.gap ?? 0;
      const size = l.size ?? S.text;
      const inset = l.box ? px(8) : 0;
      const t = ntext(this.scene, pad + inset, y + inset, l.text, size, l.color ?? NOVA_CSS.text, l.bold ?? true)
        .setWordWrapWidth(wrap - 2 * inset)
        .setLineSpacing(lineH(size) - size * 1.15);
      this.body.add(t);
      w = Math.max(w, t.width + 2 * inset);
      if (l.box) boxes.push([y, t.height + 2 * inset]);
      y += t.height + 2 * inset + px(3);
    }
    const bw = Math.ceil(w + 2 * pad);
    const box = this.scene.add.graphics();
    for (const [by, bh] of boxes) box.fillStyle(NOVA.box, 0.95).fillRoundedRect(pad - px(2), by, bw - 2 * pad + px(4), bh, px(8));
    this.body.addAt(box, 0);
    this.size = { w: bw, h: Math.ceil(y - px(3) + pad) };
  }
}
