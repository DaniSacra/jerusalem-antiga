import Phaser from 'phaser';
import { CELL, GAME_H, GAME_W } from '../render/layout';
import { C, CSS } from '../render/palette';
import { T } from '../render/strings';
import { generateTextures, GRASS_VARIANTS, TEX } from '../render/textures';
import { button, panel, text } from '../render/ui';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  create() {
    generateTextures(this);
    for (let y = 0; y < GAME_H; y += CELL) {
      for (let x = 0; x < GAME_W; x += CELL) {
        this.add.image(x, y, TEX.grass(((x * 7 + y * 13) / CELL) % GRASS_VARIANTS)).setOrigin(0);
      }
    }
    const deco: [string, number, number][] = [
      [TEX.house(4), 150, 170], [TEX.house(3), 205, 205], [TEX.tree(0), 110, 260], [TEX.building('well'), 165, 300],
      [TEX.house(2), 1110, 180], [TEX.building('market'), 1160, 250], [TEX.tree(1), 1080, 300], [TEX.house(1), 1150, 360],
      [TEX.building('field'), 140, 520], [TEX.building('field'), 188, 520], [TEX.building('altar'), 1120, 520], [TEX.rock(0), 230, 600],
      [TEX.tree(0), 1060, 610],
    ];
    deco.forEach(([key, x, y]) => this.add.image(x, y, key).setOrigin(0.5, 1).setScale(1.4));

    const w = 720;
    const h = 470;
    const px = (GAME_W - w) / 2;
    const py = (GAME_H - h) / 2;
    panel(this.add.graphics(), px, py, w, h, C.parchment, 18);
    text(this, GAME_W / 2, py + 52, T.title, 46, CSS.ink, true).setOrigin(0.5);
    let y = py + 108;
    T.howTo.forEach((line, k) => {
      const tip = k === T.howTo.length - 1;
      const t = text(this, px + 60, y, `•  ${line}`, 20, tip ? CSS.muted : CSS.ink, !tip).setWordWrapWidth(w - 110);
      y += t.height + 14;
    });
    button(this, GAME_W / 2, py + h - 55, 240, 60, T.start, 26, () => this.scene.start('game'));
    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start('game'));
  }
}
