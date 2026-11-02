import Phaser from 'phaser';
import VISUAL from '../data/visual.json';
import { craftOf, indexOf, type Building, type GameState } from '../core';
import { cellHash, DEPTH, depthAt, footCenter, gridToWorld, HH, HW } from './iso';
import { PARTS, TEX } from './textures';

const L = VISUAL.lights;
const WARM = 0xffc25a;
const FIRE = 0xff8a3c;

interface Glow {
  img: Phaser.GameObjects.Image;
  base: number;
  /** Flicker speed (0 = steady window light). */
  flicker: number;
  phase: number;
}

interface Group {
  glows: Glow[];
  /** Lamp post (seen day and night). */
  post?: Phaser.GameObjects.Image;
  /** Night flame over a tent campfire. */
  flame?: Phaser.GameObjects.Image;
  sparks?: Phaser.GameObjects.Particles.ParticleEmitter;
}

/** Screen offset of a local point (grid units from the footprint center); mirrored drawings swap x and y. */
const local = (x: number, y: number, z: number, mirrored = false) => (mirrored ? { x: (y - x) * HW, y: (x + y) * HH - z } : { x: (x - y) * HW, y: (x + y) * HH - z });

/** Chebyshev distance from a cell to a building's footprint. */
const distTo = (b: Building, x: number, y: number) => Math.max(b.x - x, x - (b.x + b.w - 1), b.y - y, y - (b.y + b.h - 1), 0);

/**
 * Night lights, added on top of the day/night tint: warm windows in stone and big houses, oil lamps
 * on the roads near the altar and the market, brighter fires at the altar and workshops, and the tent
 * campfires with a few sparks. Rebuilt only when the city changes; per frame only alphas move.
 */
export class Lights {
  private groups = new Map<string, Group>();
  private layer: Phaser.GameObjects.Container;
  private night = 0;

  constructor(private scene: Phaser.Scene) {
    this.layer = scene.add.container(0, 0).setDepth(DEPTH.light);
  }

  /** `heightOf` gives the drawn height of a building (for the windows). */
  sync(s: GameState, heightOf: (b: Building) => number, degraded: boolean) {
    const want = new Set<string>();
    const keep = (key: string, make: () => Group) => {
      want.add(key);
      if (!this.groups.has(key)) this.groups.set(key, make());
    };
    const services = s.buildings.filter((b) => b.kind === 'altar' || b.kind === 'market');
    let sparkFires = 0;
    for (const b of s.buildings) {
      const c = footCenter(b.x, b.y, b.w, b.h);
      const id = `${b.id}`;
      if (b.kind === 'house' && b.level >= L.windowLevel) {
        const h = heightOf(b);
        // Two lit windows: a warm halo and a small bright core each.
        const win = (x: number, y: number) => [this.glow(x, y, WARM, 0.55, 0.9), this.glow(x, y, 0xfff0c0, 0.16, 1)];
        keep(`w${id}-${b.level}`, () => ({ glows: [...win(c.x - 10, c.y - h * 0.4), ...win(c.x + 11, c.y - h * 0.32)] }));
      }
      if (b.kind === 'house' && b.level === 1) {
        const f = PARTS.tentFire[(b.variant ?? 0) % 6];
        if (f) {
          const p = local(f.x, f.y, f.z, b.mirrored);
          const sparks = !degraded && sparkFires++ < L.maxSparkFires;
          keep(`t${id}-${b.variant}-${sparks}`, () => this.campfire(c.x + p.x, c.y + p.y, f.scale, sparks));
        }
      }
      if (b.kind === 'altar') {
        const f = PARTS.altarFire;
        const p = local(f.x, f.y, f.z);
        keep(`a${id}`, () => ({ glows: [this.glow(c.x + p.x, c.y + p.y - 8, FIRE, 2.6, 0.75, 9)] }));
      }
      const fire = b.kind === 'workshop' ? PARTS.craftFire[craftOf(b)!] : undefined;
      if (fire) {
        const p = local(fire.glow.x, fire.glow.y, fire.glow.z, b.mirrored);
        keep(`f${id}`, () => ({ glows: [this.glow(c.x + p.x, c.y + p.y - 2, FIRE, 1.5, 0.7, 7)] }));
      }
    }
    // Oil lamps on some road cells near the altar and the market.
    for (let y = 0; y < s.rows; y++) {
      for (let x = 0; x < s.cols; x++) {
        if (!s.roads[indexOf(s, x, y)] || cellHash(x, y) % L.lampEvery) continue;
        if (!services.some((b) => distTo(b, x, y) <= L.lampRadius)) continue;
        keep(`l${x},${y}`, () => this.lamp(x, y));
      }
    }
    for (const [key, g] of this.groups) {
      if (want.has(key)) continue;
      this.destroy(g);
      this.groups.delete(key);
    }
    this.update(0, this.night);
  }

  /** Called every frame with the time in seconds and how dark it is (0..1). */
  update(t: number, night: number) {
    this.night = night;
    const on = night > 0.02;
    this.layer.setVisible(on);
    for (const g of this.groups.values()) {
      g.flame?.setVisible(on).setAlpha(night);
      if (g.sparks) g.sparks.emitting = night > 0.5;
      if (!on) continue;
      for (const l of g.glows) l.img.setAlpha(l.base * night * (l.flicker ? 1 + Math.sin(t * l.flicker + l.phase) * 0.12 : 1));
      if (g.flame) g.flame.setScale(g.flame.scaleX, g.flame.scaleX * (1 + Math.sin(t * 13 + g.glows[0].phase) * 0.12));
    }
  }

  destroyAll() {
    for (const g of this.groups.values()) this.destroy(g);
    this.groups.clear();
    this.layer.destroy();
  }

  private glow(x: number, y: number, tint: number, scale: number, base: number, flicker = 0): Glow {
    const img = this.scene.add.image(x, y, TEX.soft).setTint(tint).setScale(scale).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.layer.add(img);
    return { img, base, flicker, phase: Math.random() * 6 };
  }

  private lamp(x: number, y: number): Group {
    // On the cell's back corner as seen on screen, so it never stands in the middle of the street.
    const gx = x + 0.2;
    const gy = y + 0.2;
    const w = gridToWorld(gx, gy);
    const post = this.scene.add.image(w.x, w.y, TEX.lamp).setOrigin(0.5, 1).setDepth(depthAt(gx, gy) + 4);
    return { post, glows: [this.glow(w.x + 3, w.y - 29, WARM, 1.1, 0.85, 5), this.glow(w.x + 3, w.y - 29, 0xffffff, 0.22, 0.9)] };
  }

  private campfire(x: number, y: number, scale: number, sparks: boolean): Group {
    const flame = this.scene.add.image(x, y + 1, TEX.flame).setOrigin(0.5, 1).setScale(0.75 * scale).setBlendMode(Phaser.BlendModes.ADD);
    this.layer.add(flame);
    const group: Group = { flame, glows: [this.glow(x, y - 4, FIRE, 1.4 * scale, 0.8, 11)] };
    if (sparks) {
      group.sparks = this.scene.add
        .particles(x, y - 6, TEX.soft, {
          lifespan: 900,
          speedY: { min: -40, max: -20 },
          speedX: { min: -8, max: 8 },
          scale: { start: 0.08, end: 0 },
          alpha: { start: 1, end: 0 },
          tint: 0xffc060,
          blendMode: Phaser.BlendModes.ADD,
          frequency: 260,
          maxAliveParticles: 4,
        })
        .setDepth(DEPTH.light + 1);
      group.sparks.emitting = false;
    }
    return group;
  }

  private destroy(g: Group) {
    for (const l of g.glows) l.img.destroy();
    g.post?.destroy();
    g.flame?.destroy();
    g.sparks?.destroy();
  }
}
