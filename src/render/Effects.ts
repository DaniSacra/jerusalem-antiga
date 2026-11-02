import Phaser from 'phaser';
import { DEPTH } from './layout';
import { CSS } from './palette';
import { TEX } from './textures';
import { text } from './ui';

export class Effects {
  constructor(private scene: Phaser.Scene) {}

  ring(x: number, y: number, tint = 0xfff3b0) {
    const img = this.scene.add.image(x, y, TEX.ring).setTint(tint).setScale(0.25).setDepth(DEPTH.fx + 2);
    this.scene.tweens.add({ targets: img, scale: 1.3, alpha: 0, duration: 650, ease: 'Cubic.easeOut', onComplete: () => img.destroy() });
  }

  floatText(x: number, y: number, str: string, color: string = CSS.light) {
    const t = text(this.scene, x, y, str, 20, color, true)
      .setOrigin(0.5)
      .setStroke(CSS.ink, 4)
      .setDepth(DEPTH.fx + 3);
    this.scene.tweens.add({ targets: t, y: y - 34, alpha: 0, duration: 1300, ease: 'Sine.easeOut', onComplete: () => t.destroy() });
  }

  dust(x: number, y: number) {
    const e = this.scene.add
      .particles(x, y, TEX.soft, {
        speed: { min: 25, max: 70 },
        lifespan: 550,
        scale: { start: 0.4, end: 1 },
        alpha: { start: 0.8, end: 0 },
        tint: 0xd9c49a,
        emitting: false,
      })
      .setDepth(DEPTH.fx + 2);
    e.explode(12);
    this.scene.time.delayedCall(700, () => e.destroy());
  }
}
