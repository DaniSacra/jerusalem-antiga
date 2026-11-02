import Phaser from 'phaser';
import { C, CSS, FONT } from './palette';

export function text(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  size: number,
  color: string = CSS.ink,
  bold = false,
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, str, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    fontStyle: bold ? 'bold' : 'normal',
    color,
    resolution: 2,
  });
}

export function panel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, fill: number = C.parchment, r = 10) {
  g.fillStyle(C.shadow, 0.25);
  g.fillRoundedRect(x + 2, y + 4, w, h, r);
  g.fillStyle(fill);
  g.fillRoundedRect(x, y, w, h, r);
  g.lineStyle(3, C.border, 1);
  g.strokeRoundedRect(x, y, w, h, r);
}

/** A rounded button with a centered label. Returns the container and its label. */
export function button(scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, size: number, onClick: () => void) {
  const g = scene.add.graphics();
  const draw = (pressed: boolean) => {
    g.clear();
    g.fillStyle(C.shadow, 0.3);
    g.fillRoundedRect(-w / 2 + 1, -h / 2 + (pressed ? 2 : 4), w, h, 10);
    g.fillStyle(pressed ? 0xc9853a : C.gold);
    g.fillRoundedRect(-w / 2, -h / 2 + (pressed ? 2 : 0), w, h, 10);
    g.lineStyle(3, C.border, 1);
    g.strokeRoundedRect(-w / 2, -h / 2 + (pressed ? 2 : 0), w, h, 10);
  };
  draw(false);
  const t = text(scene, 0, 0, label, size, CSS.ink, true).setOrigin(0.5);
  const c = scene.add.container(x, y, [g, t]).setSize(w, h).setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => draw(true));
  c.on('pointerout', () => draw(false));
  c.on('pointerup', () => {
    draw(false);
    onClick();
  });
  return { container: c, label: t };
}
