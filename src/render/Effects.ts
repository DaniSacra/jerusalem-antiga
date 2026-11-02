import Phaser from 'phaser';
import { DEPTH } from './iso';
import { CSS } from './palette';
import { TEX } from './textures';
import { text } from './ui';

export class Effects {
  constructor(private scene: Phaser.Scene) {}

  /** Flat glowing ring on the ground. */
  ring(x: number, y: number, tint = 0xfff3b0, scale = 1.4, delay = 0) {
    const img = this.scene.add.image(x, y, TEX.ring).setTint(tint).setScale(0.2, 0.1).setDepth(DEPTH.fx + 2);
    this.scene.tweens.add({
      targets: img,
      scaleX: scale,
      scaleY: scale / 2,
      alpha: 0,
      delay,
      duration: 700,
      ease: 'Cubic.easeOut',
      onComplete: () => img.destroy(),
    });
  }

  floatText(x: number, y: number, str: string, color: string = CSS.light) {
    const t = text(this.scene, x, y, str, 18, color, true).setOrigin(0.5).setStroke(CSS.ink, 4).setDepth(DEPTH.fx + 3);
    this.scene.tweens.add({ targets: t, y: y - 34, alpha: 0, duration: 1300, ease: 'Sine.easeOut', onComplete: () => t.destroy() });
  }

  dust(x: number, y: number) {
    this.burst(x, y, 0xd9c49a, 12, { min: 25, max: 70 }, 550);
  }

  /** The temple moment: golden rings, sparkles and a warm flash. */
  celebrate(x: number, y: number) {
    for (let k = 0; k < 4; k++) this.ring(x, y, 0xffe08a, 3 + k * 1.2, k * 180);
    this.burst(x, y - 40, 0xffe08a, 40, { min: 40, max: 160 }, 1400);
    this.scene.cameras.main.flash(500, 255, 236, 190);
  }

  private burst(x: number, y: number, tint: number, count: number, speed: { min: number; max: number }, lifespan: number) {
    const e = this.scene.add
      .particles(x, y, TEX.soft, { speed, lifespan, scale: { start: 0.4, end: 1 }, alpha: { start: 0.8, end: 0 }, tint, emitting: false })
      .setDepth(DEPTH.fx + 2);
    e.explode(count);
    this.scene.time.delayedCall(lifespan + 200, () => e.destroy());
  }
}
