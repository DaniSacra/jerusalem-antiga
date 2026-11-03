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

export type ButtonLook = 'normal' | 'active' | 'disabled';

/** Draws a rail button centered at (0, 0): stone, gold when active, darker when disabled. */
export function drawRailButton(g: Phaser.GameObjects.Graphics, w: number, h: number, look: ButtonLook, pressed = false) {
  const dy = pressed ? 2 : 0;
  g.clear();
  g.fillStyle(look === 'active' ? C.ui.goldDark : C.ui.stoneEdge);
  g.fillRoundedRect(-w / 2, -h / 2 + 3, w, h - 3, 10);
  g.fillStyle(look === 'active' ? C.ui.goldLight : look === 'disabled' ? C.ui.stoneDark : C.cream);
  g.fillRoundedRect(-w / 2, -h / 2 + dy, w, h - 3, 10);
  g.lineStyle(look === 'active' ? 3 : 1.5, look === 'active' ? C.ui.goldDark : C.ui.stoneEdge, 1);
  g.strokeRoundedRect(-w / 2, -h / 2 + dy, w, h - 3, 10);
}

/** A stone rail button with any content; `setLook` restyles it. */
export class RailButton {
  readonly root: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private look: ButtonLook = 'normal';

  constructor(scene: Phaser.Scene, x: number, y: number, readonly w: number, readonly h: number, content: Phaser.GameObjects.GameObject[], onPress: () => void, onDown = false) {
    this.bg = scene.add.graphics();
    this.root = scene.add.container(x, y, [this.bg, ...content]).setSize(w, h).setInteractive({ useHandCursor: true });
    drawRailButton(this.bg, w, h, this.look);
    // Tools react on press (instant); toggles like speed and turning react on release.
    this.root.on('pointerdown', () => (onDown ? onPress() : drawRailButton(this.bg, w, h, this.look, true)));
    this.root.on('pointerout', () => drawRailButton(this.bg, w, h, this.look));
    if (!onDown)
      this.root.on('pointerup', () => {
        drawRailButton(this.bg, w, h, this.look);
        onPress();
      });
  }

  setLook(look: ButtonLook) {
    if (look === this.look) return;
    this.look = look;
    drawRailButton(this.bg, this.w, this.h, look);
  }
}
