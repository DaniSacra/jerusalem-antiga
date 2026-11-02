import Phaser from 'phaser';
import type { Segment } from './info';
import { GAME_W, INFO_H, INFO_MAX_W, INFO_Y, inRect, type Rect } from './layout';
import { C, CSS } from './palette';
import { text } from './ui';

const PAD_X = 18;

/** Compact plaque at the bottom center with colored text; hidden when it has nothing to say. */
export class InfoLine {
  private bg: Phaser.GameObjects.Graphics;
  private row: Phaser.GameObjects.Container;
  private rect: Rect | null = null;

  constructor(private scene: Phaser.Scene) {
    this.bg = scene.add.graphics();
    this.row = scene.add.container(GAME_W / 2, INFO_Y + INFO_H / 2);
  }

  set(segments: Segment[]) {
    this.row.removeAll(true);
    this.bg.clear();
    this.rect = null;
    if (!segments.length) return;
    let x = 0;
    for (const seg of segments) {
      const t = text(this.scene, x, 0, seg.text, 18, seg.color ?? CSS.light, true).setOrigin(0, 0.5);
      this.row.add(t);
      x += t.width;
    }
    // Long lines shrink to fit between the rails.
    const k = x > INFO_MAX_W - 2 * PAD_X ? (INFO_MAX_W - 2 * PAD_X) / x : 1;
    this.row.setScale(k);
    this.row.each((c: Phaser.GameObjects.Text) => c.setX(c.x - x / 2));
    const w = Math.round(x * k + 2 * PAD_X);
    this.rect = { x: (GAME_W - w) / 2, y: INFO_Y, w, h: INFO_H };
    const g = this.bg;
    g.fillStyle(C.shadow, 0.3);
    g.fillRoundedRect(this.rect.x + 2, INFO_Y + 3, w, INFO_H, 12);
    g.fillStyle(C.ui.infoBg, 0.94);
    g.fillRoundedRect(this.rect.x, INFO_Y, w, INFO_H, 12);
    g.lineStyle(2, C.gold, 1);
    g.strokeRoundedRect(this.rect.x, INFO_Y, w, INFO_H, 12);
  }

  contains(x: number, y: number) {
    return !!this.rect && inRect(this.rect, x, y);
  }
}
