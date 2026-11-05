import Phaser from 'phaser';
import { indexOf, inBounds, WALKERS, type GameState, type Rect } from '../core';
import VISUAL from '../data/visual.json';
import { DEPTH, HH, HW, cellHash, footCenter } from './iso';
import { C, CSS } from './palette';
import { TEX, WALKER_LOOKS } from './textures';
import { text } from './ui';
import { place } from './Walkers';

const M = VISUAL.moments;
/** Residents who come to see a milestone (the ones whose drawings carry nothing too big). */
const ONLOOKERS = WALKERS.map((w) => w.type).filter((t) => ['elder', 'child', 'basketWoman', 'waterCarrier', 'farmer', 'priest', 'porter'].includes(t));
const ADD = Phaser.BlendModes.ADD;

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

  /**
   * A milestone moment, without pausing: a warm halo, golden rings and sparkles rising over the
   * footprint `foot` (the building glows too, see MapView.shine), and a few residents who walk up
   * from around it, cheer for a few seconds and go back. `top` is the drawing's height in px.
   */
  milestone(s: GameState, foot: Rect, top: number) {
    const ms = M.milestoneSeconds * 1000;
    const c = footCenter(foot.x, foot.y, foot.w, foot.h);
    const size = Math.max(foot.w, foot.h);
    for (let k = 0; k < 3; k++) this.ring(c.x, c.y, C.milestone, 1.6 + size * 0.7 + k * 0.8, k * 320);
    const halo = this.scene.add
      .image(c.x, c.y - top * 0.45, TEX.soft)
      .setTint(C.milestoneGlow)
      .setBlendMode(ADD)
      .setScale(size * 2.4, size * 1.8)
      .setAlpha(0)
      .setDepth(DEPTH.fx + 1);
    this.scene.tweens.add({ targets: halo, alpha: 0.75, duration: 500, hold: ms - 1300, yoyo: true, ease: 'Sine.easeInOut', onComplete: () => halo.destroy() });
    const zone = new Phaser.Geom.Ellipse(0, 0, size * HW * 1.5, size * HH * 1.5);
    const sparks = this.scene.add
      .particles(c.x, c.y - top * 0.3, TEX.spark, {
        emitZone: { type: 'random', source: zone } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        speedY: { min: -46, max: -16 },
        speedX: { min: -10, max: 10 },
        lifespan: { min: 1100, max: 1900 },
        scale: { start: 0.75, end: 0.1 },
        rotate: { min: 0, max: 90 },
        alpha: { start: 1, end: 0 },
        tint: [C.milestone, C.milestoneGlow, C.gold],
        blendMode: ADD,
        frequency: 60,
      })
      .setDepth(DEPTH.fx + 2);
    this.scene.time.delayedCall(ms * 0.7, () => sparks.stop());
    this.scene.time.delayedCall(ms + 2000, () => sparks.destroy());
    this.crowd(s, foot, ms);
  }

  /** Residents who walk up to the footprint from a little farther out, cheer with small hops, and leave. */
  private crowd(s: GameState, foot: Rect, ms: number) {
    const mid = { x: foot.x + foot.w / 2, y: foot.y + foot.h / 2 };
    const spots: { x: number; y: number }[] = [];
    // Free ground, roads or the target itself one or two cells around the footprint (never water).
    for (let y = foot.y - 2; y < foot.y + foot.h + 2; y++) {
      for (let x = foot.x - 2; x < foot.x + foot.w + 2; x++) {
        const inside = x >= foot.x && x < foot.x + foot.w && y >= foot.y && y < foot.y + foot.h;
        if (inside || !inBounds(s, x, y)) continue;
        const i = indexOf(s, x, y);
        if (s.ground[i] === 'river' || s.feature[i] || (s.grid[i] && !s.roads[i])) continue;
        spots.push({ x, y });
      }
    }
    spots.sort((a, b) => (cellHash(a.x, a.y) % 97) - (cellHash(b.x, b.y) % 97));
    const picked = spots.filter((p, k) => !spots.slice(0, k).some((q) => Math.abs(q.x - p.x) + Math.abs(q.y - p.y) < 2)).slice(0, M.milestoneCrowd);
    picked.forEach((p, k) => {
      const at = { x: p.x + 0.5 + (Math.random() - 0.5) * 0.3, y: p.y + 0.5 + (Math.random() - 0.5) * 0.3 };
      const away = Math.hypot(at.x - mid.x, at.y - mid.y) || 1;
      const from = { x: at.x + ((at.x - mid.x) / away) * 2.5, y: at.y + ((at.y - mid.y) / away) * 2.5 };
      const type = ONLOOKERS[k % ONLOOKERS.length];
      const look = Math.floor(Math.random() * WALKER_LOOKS);
      const img = this.scene.add.image(0, 0, TEX.walker(type, look, 0)).setOrigin(0.5, 1).setAlpha(0);
      const pos = { gx: from.x, gy: from.y, hop: 0, step: 0 };
      const dx = at.x - from.x;
      const dy = at.y - from.y;
      const show = (fx: number, fy: number) => {
        place(img, pos.gx, pos.gy, fx, fy, pos.hop);
        img.setTexture(TEX.walker(type, look, Math.sin(pos.step) > 0 ? 1 : 0));
      };
      show(dx, dy);
      const walk = 1200;
      const cheer = Math.max(600, ms - walk * 2);
      this.scene.tweens.chain({
        targets: pos,
        delay: k * 140,
        tweens: [
          { gx: at.x, gy: at.y, step: 14, duration: walk, ease: 'Sine.easeOut', onUpdate: () => show(dx, dy), onStart: () => this.scene.tweens.add({ targets: img, alpha: 1, duration: 300 }) },
          // Facing the building, small hops of joy.
          { hop: 4, duration: 180, yoyo: true, repeat: Math.floor(cheer / 360) - 1, delay: 120 + Math.random() * 200, ease: 'Quad.easeOut', onUpdate: () => show(mid.x - at.x, mid.y - at.y) },
          { gx: from.x, gy: from.y, step: 28, duration: walk, ease: 'Sine.easeIn', onUpdate: () => show(-dx, -dy), onStart: () => this.scene.tweens.add({ targets: img, alpha: 0, delay: walk - 400, duration: 400 }) },
        ],
        onComplete: () => img.destroy(),
      });
    });
  }

  /**
   * Food spoiling at (x, y) (the granary yard or the altar): a few flies buzzing over it and a short
   * sickly green puff. Small and brief on purpose.
   */
  spoil(x: number, y: number) {
    const ms = M.spoilSeconds * 1000;
    const zone = new Phaser.Geom.Ellipse(0, 0, HW * 0.9, HH * 0.9);
    const puff = this.scene.add
      .particles(x, y, TEX.soft, {
        emitZone: { type: 'random', source: zone } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        speedY: { min: -18, max: -8 },
        speedX: { min: -6, max: 6 },
        lifespan: { min: 1200, max: 1800 },
        scale: { start: 0.35, end: 1.1 },
        alpha: { start: 0.45, end: 0 },
        tint: C.spoil,
        frequency: 260,
      })
      .setDepth(DEPTH.fx + 1);
    const flies = this.scene.add
      .particles(x, y - 10, TEX.fly, {
        emitZone: { type: 'random', source: zone } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        speed: { min: 14, max: 34 },
        angle: { min: 0, max: 360 },
        lifespan: { min: 500, max: 900 },
        scale: { min: 0.8, max: 1.2 },
        alpha: { start: 0.9, end: 0.3 },
        tint: C.fly,
        frequency: 70,
      })
      .setDepth(DEPTH.fx + 2);
    this.scene.time.delayedCall(ms * 0.5, () => puff.stop());
    this.scene.time.delayedCall(ms, () => flies.stop());
    this.scene.time.delayedCall(ms + 2000, () => {
      puff.destroy();
      flies.destroy();
    });
  }

  private burst(x: number, y: number, tint: number, count: number, speed: { min: number; max: number }, lifespan: number) {
    const e = this.scene.add
      .particles(x, y, TEX.soft, { speed, lifespan, scale: { start: 0.4, end: 1 }, alpha: { start: 0.8, end: 0 }, tint, emitting: false })
      .setDepth(DEPTH.fx + 2);
    e.explode(count);
    this.scene.time.delayedCall(lifespan + 200, () => e.destroy());
  }
}
