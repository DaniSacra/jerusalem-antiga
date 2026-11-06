import * as THREE from 'three';
import type { GameState } from '../core';
import { ambientCounts, ambientPlan, ambientPose, type AmbientSpot } from './ambient';
import { Herd, HERD_KINDS, type HerdKind } from './animals';
import { figureLook } from './crowd';
import { Figures } from './figures';
import type { Terrain } from './terrain';

/**
 * The life around the town (ambient.ts says where): goats, chickens, a tied donkey, sheep, pigeons,
 * fishing boats and washerwomen, moved every frame (one draw call per kind). Built with the city.
 */
export class Pasture {
  private spots: AmbientSpot[];
  private herds: Record<HerdKind, Herd>;
  private washers: Figures;
  /** Slot of each spot in its herd (or in the washerwomen). */
  private slot: number[] = [];

  /** `water` is the river's surface height now (it runs lower in a drought). */
  constructor(s: GameState, private ground: Terrain, private water: () => number, shadows: boolean) {
    this.spots = ambientPlan(s);
    const n = ambientCounts(this.spots);
    this.herds = Object.fromEntries(HERD_KINDS.map((k) => [k, new Herd(k, n[k], shadows)])) as Record<HerdKind, Herd>;
    this.washers = new Figures(n.washer, shadows, ['basket']);
    const next: Record<string, number> = {};
    for (const o of this.spots) {
      const i = (next[o.kind] = (next[o.kind] ?? -1) + 1);
      this.slot.push(i);
      if (o.kind === 'washer') {
        this.washers.dress(i, figureLook('f', 'adult', o.k));
        this.washers.carry(i, 'basket');
      }
    }
    for (const k of HERD_KINDS) this.herds[k].count = n[k];
    this.washers.count = n.washer;
  }

  get objects(): THREE.Object3D[] {
    return [...HERD_KINDS.flatMap((k) => this.herds[k].objects), ...this.washers.objects];
  }

  /** Animals, boats and washerwomen around the town (for the tests). */
  get count() {
    return this.spots.length;
  }

  update(time: number) {
    this.spots.forEach((o, j) => {
      const p = ambientPose(o, time);
      const i = this.slot[j];
      if (o.kind === 'washer') {
        // Kneeling on the bank: lower, bent over the water.
        this.washers.place(i, p.x, this.ground.height(p.x, p.z) - 0.03, p.z, p.yaw, p.pitch);
        return;
      }
      const y = o.kind === 'boat' ? this.water() + p.y : this.ground.height(p.x, p.z) + 0.02 + p.y;
      this.herds[o.kind].place(i, p.x, y, p.z, p.yaw, p.roll, p.pitch);
    });
    for (const k of HERD_KINDS) this.herds[k].commit();
    this.washers.commit();
  }
}
