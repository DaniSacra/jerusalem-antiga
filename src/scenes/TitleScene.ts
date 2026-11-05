import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../render/layout';
import { cellHash, HH, HW } from '../render/iso';
import { C, CSS } from '../render/palette';
import { T } from '../render/strings';
import { generateTextures, ORIGIN, TEX, VARIANTS, cropImages } from '../render/textures';
import { install, installOffer, onInstallChange } from '../render/install';
import { tutorialSeen } from '../game/tutorial';
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
      [TEX.building('plaza'), 90, 560, 0.8],
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
      if (key === TEX.building('field')) cropImages(this, x, y, k);
    });

    const w = 760;
    const h = 520;
    const px = (GAME_W - w) / 2;
    const py = (GAME_H - h) / 2;
    panel(this.add.graphics(), px, py, w, h, C.parchment, 18);
    text(this, GAME_W / 2, py + 50, T.title, 46, CSS.ink, true).setOrigin(0.5);
    let y = py + 110;
    T.howTo.forEach((line, k) => {
      const t = text(this, px + 56, y, `${k + 1}.  ${line}`, 26, CSS.ink, true).setWordWrapWidth(w - 100);
      y += t.height + 18;
    });
    text(this, GAME_W / 2, y + 8, T.controls, 21, CSS.muted, true).setOrigin(0.5, 0).setWordWrapWidth(w - 80);
    // Once the tutorial was seen, a second button starts a new game with it again.
    const again = tutorialSeen();
    button(this, GAME_W / 2 - (again ? 160 : 0), py + h - 62, 300, 84, T.start, 32, () => this.scene.start('game'));
    if (again) button(this, GAME_W / 2 + 170, py + h - 62, 280, 84, T.tutorial.again, 22, () => this.scene.start('game', { tutorial: true }));
    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start('game'));
    this.installOffer();
  }

  /** "Instalar app" in the top right corner when the browser can install it; on iPhone, how to do it. */
  private installOffer() {
    let shown: Phaser.GameObjects.GameObject | null = null;
    const paint = () => {
      shown?.destroy();
      shown = null;
      const offer = installOffer();
      if (offer === 'prompt') shown = button(this, GAME_W - 130, 50, 220, 64, T.install, 22, () => void install()).container;
      else if (offer === 'ios')
        shown = text(this, GAME_W / 2, GAME_H - 26, T.installIos, 20, CSS.light, true).setOrigin(0.5).setStroke(CSS.ink, 5);
    };
    paint();
    const off = onInstallChange(paint);
    this.events.once('shutdown', off);
  }
}
