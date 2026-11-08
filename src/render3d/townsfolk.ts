import * as THREE from 'three';
import { ageBand, type GameState } from '../core';
import { figureLook, groupLength, groupSlots, type Load, type Slot } from './crowd';
import { along, Figures } from './figures';
import LOOK from './look3d.json';
import { hash } from './plan';
import { idlePose, idleShown, leaveLead, leaveLoad, leavePath, leavers, streetPlan, type IdleSpot, type Placed } from './street';
import type { Terrain } from './terrain';

const L = LOOK.street;

/**
 * The still life of the streets (street.ts says who and where): neighbours at the doors, buyers at
 * the markets and olive pickers in autumn, one instanced crowd (one draw call and one per thing
 * held). Built with the city and with the people; per frame only their small motions.
 */
export class Idlers {
  readonly figures: Figures;
  private spots: IdleSpot[];

  constructor(s: GameState, placed: readonly Placed[], private ground: Terrain, shadows: boolean) {
    this.spots = streetPlan(s, placed);
    const loads = [...new Set(this.spots.map((o) => o.load).filter((l): l is Load => l !== null))];
    this.figures = new Figures(this.spots.length, shadows, loads);
    this.spots.forEach((o, i) => {
      this.figures.dress(i, figureLook(o.sex, o.band, o.k));
      this.figures.carry(i, o.load);
    });
    this.figures.count = 0;
  }

  get objects(): THREE.Object3D[] {
    return this.figures.objects;
  }

  /** Figures planned (for the tests and the dev hooks). */
  get planned() {
    return this.spots.length;
  }

  /** Figures out now. */
  shown = 0;

  /**
   * Moves the figures out for a street `share` (0..1: fewer at night, in the rain, at the lower
   * qualities, none from far away); the olive pickers only in `autumn`.
   */
  update(time: number, share: number, autumn: boolean) {
    const n = (this.shown = idleShown(this.spots, share));
    this.figures.count = n;
    if (!n) return;
    for (let i = 0; i < n; i++) {
      const o = this.spots[i];
      if (o.autumn && !autumn) {
        this.figures.hide(i);
        continue;
      }
      const p = idlePose(o, time);
      this.figures.place(i, p.x, this.ground.height(p.x, p.z) + 0.04 + p.y, p.z, p.yaw, p.lean, p.roll);
    }
    this.figures.commit();
  }
}

interface Leaving {
  path: ReturnType<typeof leavePath>;
  /** Seconds (scene time) it set out; -1 until the first frame. */
  t0: number;
  first: number;
  slots: Slot[];
  length: number;
  phase: number;
}

/**
 * A family that left (`familyLeft`, the 'leave' output) walking out of town: from its house along
 * the roads to the entrance, with bundles on the back, once. A few groups at a time, kept across the
 * city's rebuilds (the house goes empty, the city is drawn again, they walk on).
 */
export class Leavers {
  readonly figures: Figures;
  private groups: (Leaving | null)[] = new Array(L.leaveGroups).fill(null);

  constructor(
    private s: GameState,
    private ground: Terrain,
    shadows: boolean,
  ) {
    this.figures = new Figures(L.leaveGroups * L.leaveSize, shadows, ['sack', 'staff']);
    this.figures.count = 0;
  }

  get objects(): THREE.Object3D[] {
    return this.figures.objects;
  }

  /** Groups walking out now (for the tests). */
  get walking() {
    return this.groups.filter(Boolean).length;
  }

  /** The family of the house on cell (x, y) sets out (nothing when nobody left from there or every group is on the way). */
  leave(x: number, y: number) {
    const s = this.s;
    const slot = this.groups.indexOf(null);
    const people = leavers(s, x, y, L.leaveSize);
    if (slot < 0 || !people.length) return;
    const bands = people.map((p) => ageBand(p, s.week));
    const first = slot * L.leaveSize;
    people.forEach((p, j) => {
      this.figures.dress(first + j, figureLook(p.sex, bands[j], hash(p.id, 3)));
      this.figures.carry(first + j, leaveLoad(bands[j]));
    });
    for (let j = people.length; j < L.leaveSize; j++) this.figures.hide(first + j);
    const slots = groupSlots(bands);
    this.groups[slot] = { path: leavePath(s, x, y), t0: -1, first, slots, length: groupLength(slots), phase: hash(x, y, 74) * 6 };
  }

  update(time: number) {
    if (!this.walking) {
      this.figures.count = 0;
      return;
    }
    this.figures.count = L.leaveGroups * L.leaveSize;
    this.groups.forEach((g, n) => {
      if (!g) {
        for (let j = 0; j < L.leaveSize; j++) this.figures.hide(n * L.leaveSize + j);
        return;
      }
      if (g.t0 < 0) g.t0 = time;
      const last = g.path.length - 1;
      const lead = leaveLead(time - g.t0, L.leaveSpeed, last, g.length);
      if (lead === null) {
        this.groups[n] = null;
        for (let j = 0; j < L.leaveSize; j++) this.figures.hide(g.first + j);
        return;
      }
      g.slots.forEach((slot, j) => {
        const step = lead - slot.back;
        const i = g.first + j;
        // Still at the door, or already out at the entrance.
        if (step < 0 || step > last) return this.figures.hide(i);
        const p = along(g.path, step);
        const len = Math.hypot(p.dx, p.dz) || 1;
        const x = p.x - (p.dz / len) * slot.side;
        const z = p.z + (p.dx / len) * slot.side;
        const ph = step * Math.PI * 4 + g.phase + j;
        // A slow, heavy walk: bent a little under the bundles.
        this.figures.place(i, x, this.ground.height(x, z) + 0.04 + Math.abs(Math.sin(ph)) * 0.018, z, Math.atan2(p.dx, p.dz), 0.1, Math.sin(ph) * 0.05);
      });
    });
    this.figures.commit();
  }
}
