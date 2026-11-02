import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../render/layout';
import { cellHash, HH, HW } from '../render/iso';
import { C, CSS } from '../render/palette';
import { T } from '../render/strings';
import { generateTextures, ORIGIN, TEX, VARIANTS } from '../render/textures';
import { button, panel, text } from '../render/ui';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  create() {
    generateTextures(this);
    this.cameras.main.setBackgroundColor(C.bg);
    for (let gy = -2; gy < 26; gy++) {
      for (let gx = -2; gx < 26; gx++) {
        const x = GAME_W / 2 + (gx - gy) * HW;
        const y = -260 + (gx + gy) * HH;
        if (x < -40 || x > GAME_W + 40 || y < -20 || y > GAME_H + 20) continue;
        const h = cellHash(gx + 40, gy + 40);
        this.add.image(x, y, TEX.ground(h % 3 ? 'sand' : 'grass', h % VARIANTS));
      }
    }
    const deco: [string, number, number][] = [
      [TEX.building('temple'), 150, 230],
      [TEX.feature('palm', 0), 260, 160],
      [TEX.building('house', 4), 90, 400],
      [TEX.building('house', 3), 170, 450],
      [TEX.building('well'), 250, 500],
      [TEX.feature('olive', 1), 100, 600],
      [TEX.building('altar'), 1130, 210],
      [TEX.building('market'), 1050, 300],
      [TEX.building('house', 2), 1170, 360],
      [TEX.building('house', 1), 1090, 470],
      [TEX.building('field'), 1180, 560],
      [TEX.feature('palm', 1), 1040, 620],
      [TEX.building('workshop'), 1210, 660],
    ];
    deco.forEach(([key, x, y]) => this.add.image(x, y, key).setOrigin(...(ORIGIN[key] ?? [0.5, 1])).setScale(1.4));

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
