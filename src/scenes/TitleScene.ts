import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../render/layout';
import { cellHash, HH, HW } from '../render/iso';
import { C, CSS } from '../render/palette';
import { T } from '../render/strings';
import { generateTextures, ORIGIN, TEX, VARIANTS, wheatImages } from '../render/textures';
import { button, panel, text } from '../render/ui';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  create() {
    generateTextures(this);
    this.cameras.main.setBackgroundColor(C.bg);
    for (let gy = -24; gy < 40; gy++) {
      for (let gx = -14; gx < 40; gx++) {
        const x = GAME_W / 2 + (gx - gy) * HW;
        const y = -260 + (gx + gy) * HH;
        if (x < -40 || x > GAME_W + 40 || y < -20 || y > GAME_H + 20) continue;
        const h = cellHash(gx + 40, gy + 40);
        this.add.image(x, y, TEX.ground(h % 3 ? 'sand' : 'grass', h % VARIANTS));
      }
    }
    // [texture, x, y, scale]: buildings are drawn at their real footprint, trees fill one cell.
    const deco: [string, number, number, number][] = [
      [TEX.building('temple'), 140, 250, 0.55],
      [TEX.feature('palm', 0), 245, 140, 1.4],
      [TEX.building('house', 4), 80, 410, 0.8],
      [TEX.building('house', 3), 185, 470, 0.8],
      [TEX.building('well'), 90, 560, 0.8],
      [TEX.feature('olive', 1), 220, 640, 1.4],
      [TEX.building('altar'), 1150, 200, 0.6],
      [TEX.building('market', 0, true), 1110, 330, 0.7],
      [TEX.building('house', 2), 1200, 420, 0.8],
      [TEX.building('house', 1), 1080, 470, 0.8],
      [TEX.building('field'), 1190, 560, 0.7],
      [TEX.feature('palm', 1), 1050, 620, 1.4],
      [TEX.building('workshop'), 1180, 680, 0.6],
    ];
    deco.forEach(([key, x, y, k]) => {
      this.add.image(x, y, key).setOrigin(...(ORIGIN[key] ?? [0.5, 1])).setScale(k);
      if (key === TEX.building('field')) wheatImages(this, x, y, k);
    });

    const w = 760;
    const h = 520;
    const px = (GAME_W - w) / 2;
    const py = (GAME_H - h) / 2;
    panel(this.add.graphics(), px, py, w, h, C.parchment, 18);
    text(this, GAME_W / 2, py + 50, T.title, 46, CSS.ink, true).setOrigin(0.5);
    let y = py + 102;
    T.howTo.forEach((line, k) => {
      const tip = k === T.howTo.length - 1;
      const t = text(this, px + 56, y, `•  ${line}`, 19, tip ? CSS.muted : CSS.ink, !tip).setWordWrapWidth(w - 100);
      y += t.height + 12;
    });
    button(this, GAME_W / 2, py + h - 50, 240, 60, T.start, 26, () => this.scene.start('game'));
    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start('game'));
  }
}
