import * as THREE from 'three';
import type { GameState } from '../core';
import { ambientCounts, ambientPlan, ambientPose, PEOPLE, type AmbientSpot } from './ambient';
import { Herd, HERD_KINDS, type HerdKind } from './animals';
import { figureLook } from './crowd';
import { Figures } from './figures';
import type { Terrain } from './terrain';

/**
 * The life around the town (ambient.ts says where): goats, chickens, a tied donkey, sheep, pigeons,
 * fishing boats, washerwomen and the shepherds of the pastures, moved every frame (one draw call per
 * kind; the people share one set of figures). Built with the city.
 */
export class Pasture {
  private spots: AmbientSpot[];
  private herds: Record<HerdKind, Herd>;
  /** The washerwomen and the shepherds. */
  private folk: Figures;
  /** Slot of each spot in its herd (or in the folk). */
  private slot: number[] = [];

  /** `water` is the river's surface height now (it runs lower in a drought). */
  constructor(s: GameState, private ground: Terrain, private water: () => number, shadows: boolean) {
    this.spots = ambientPlan(s);
    const n = ambientCounts(this.spots);
    this.herds = Object.fromEntries(HERD_KINDS.map((k) => [k, new Herd(k, n[k], shadows)])) as Record<HerdKind, Herd>;
    const folk = n.washer + n.shepherd;
    this.folk = new Figures(folk, shadows, [...(n.washer ? (['basket'] as const) : []), ...(n.shepherd ? (['staff'] as const) : [])]);
    const next: Record<string, number> = {};
    let person = 0;
    for (const o of this.spots) {
      const people = PEOPLE.includes(o.kind);
      const i = people ? person++ : (next[o.kind] = (next[o.kind] ?? -1) + 1);
      this.slot.push(i);
      if (people) {
        this.folk.dress(i, figureLook(o.kind === 'washer' ? 'f' : 'm', 'adult', o.k));
        this.folk.carry(i, o.kind === 'washer' ? 'basket' : 'staff');
      }
    }
    for (const k of HERD_KINDS) this.herds[k].count = n[k];
    this.folk.count = folk;
  }

  get objects(): THREE.Object3D[] {
    return [...HERD_KINDS.flatMap((k) => this.herds[k].objects), ...this.folk.objects];
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
        this.folk.place(i, p.x, this.ground.height(p.x, p.z) - 0.03, p.z, p.yaw, p.pitch);
        return;
      }
      if (o.kind === 'shepherd') {
        this.folk.place(i, p.x, this.ground.height(p.x, p.z) + 0.04 + Math.abs(Math.sin(time * 4 + o.k * 9)) * 0.012, p.z, p.yaw, p.pitch);
        return;
      }
      const y = o.kind === 'boat' ? this.water() + p.y : this.ground.height(p.x, p.z) + 0.02 + p.y;
      this.herds[o.kind].place(i, p.x, y, p.z, p.yaw, p.roll, p.pitch);
    });
    for (const k of HERD_KINDS) this.herds[k].commit();
    this.folk.commit();
  }
}
