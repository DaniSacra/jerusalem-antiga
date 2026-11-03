import Phaser from 'phaser';
import { DEPTH, HH, HW } from './iso';
import { C, CSS } from './palette';
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

  /**
   * Demolition at a footprint center: a cloud of dust spread over the footprint and pebbles thrown
   * up that fall back. `size` is the footprint side in cells (1 for a road, a tree or a rock).
   */
  dust(x: number, y: number, size = 1) {
    const s = Math.max(1, size);
    const ground = new Phaser.Geom.Ellipse(0, 0, s * HW * 1.6, s * HH * 1.6);
    const cloud = this.scene.add
      .particles(x, y, TEX.soft, {
        emitZone: { type: 'random', source: ground } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        speed: { min: 12, max: 40 + s * 12 },
        angle: { min: 190, max: 350 },
        lifespan: { min: 600, max: 1000 },
        scale: { start: 0.5 + s * 0.15, end: 1.3 + s * 0.35 },
        alpha: { start: 0.75, end: 0 },
        tint: C.dust,
        emitting: false,
      })
      .setDepth(DEPTH.fx + 2);
    cloud.explode(Math.min(28, 8 + s * 6));
    const pebbles = this.scene.add
      .particles(x, y - 4, TEX.pebble, {
        emitZone: { type: 'random', source: ground } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        speed: { min: 50, max: 110 + s * 15 },
        angle: { min: 215, max: 325 },
        gravityY: 420,
        lifespan: { min: 450, max: 750 },
        rotate: { min: 0, max: 360 },
        scale: { min: 0.8, max: 1.5 },
        alpha: { start: 1, end: 0.2 },
        tint: [C.rock, C.rockLight, C.rockDark, C.mud],
        emitting: false,
      })
      .setDepth(DEPTH.fx + 2);
    pebbles.explode(Math.min(18, 4 + s * 4));
    this.scene.time.delayedCall(1200, () => {
      cloud.destroy();
      pebbles.destroy();
    });
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
