import * as THREE from 'three';
import { createRng, findPath, pickWalkerType, walkerGoal, walkerStart, type Cell, type GameState, type Rng, type WalkerType } from '../core';
import { COLORS } from './models';
import type { Terrain } from './terrain';

const ROBES = [0x8a3b2c, 0x3f5f8a, 0xc9b48a, 0x6b7a3a, 0x7a5a8a, 0xe6dcc4, 0x9a6a3a];
const SKIN = 0xb98463;

interface Walker {
  type: WalkerType;
  path: Cell[];
  seg: number;
  t: number;
  speed: number;
  lane: number;
  phase: number;
}

/**
 * Residents walking the road network (paths and destinations from src/core, as in the 2D game),
 * drawn as simple instanced figures: a robe and a head.
 */
export class Walkers {
  private list: Walker[] = [];
  private body: THREE.InstancedMesh;
  private head: THREE.InstancedMesh;
  private rng: Rng;
  private tmp = new THREE.Object3D();

  constructor(private s: GameState, private ground: Terrain, count: number, shadows: boolean) {
    this.rng = createRng(s.week * 31 + 7);
    const robe = new THREE.CylinderGeometry(0.06, 0.11, 0.28, 6);
    robe.translate(0, 0.14, 0);
    const head = new THREE.IcosahedronGeometry(0.06, 0);
    head.translate(0, 0.34, 0);
    this.body = new THREE.InstancedMesh(robe, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), count);
    this.head = new THREE.InstancedMesh(head, new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.8, flatShading: true }), count);
    for (const m of [this.body, this.head]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.castShadow = shadows;
      m.frustumCulled = false;
    }
    for (let i = 0; i < count; i++) {
      this.body.setColorAt(i, new THREE.Color(ROBES[i % ROBES.length]));
      const w = this.trip(null);
      if (w) {
        w.seg = Math.floor(this.rng() * (w.path.length - 1));
        this.list.push(w);
      }
    }
    this.body.count = this.head.count = this.list.length;
  }

  get objects() {
    return [this.body, this.head];
  }

  /** A new walk, from `from` (the end of the last one) or from a starting building. */
  private trip(prev: Walker | null): Walker | null {
    const s = this.s;
    for (let tries = 0; tries < 6; tries++) {
      const type = prev?.type ?? pickWalkerType(s, this.rng);
      if (!type) return null;
      const start = prev ? prev.path[prev.path.length - 1] : walkerStart(s, type, this.rng);
      const goal = start && walkerGoal(s, type, this.rng, !!prev && this.rng() < 0.5);
      const path = goal && findPath(s, start!, goal.cells);
      if (path && path.length > 2) return { type, path, seg: 0, t: 0, speed: 0.9 + this.rng() * 0.5, lane: (this.rng() - 0.5) * 0.4, phase: this.rng() * 6 };
    }
    return null;
  }

  update(dt: number, time: number) {
    for (let i = 0; i < this.list.length; i++) {
      let w = this.list[i];
      w.t += dt * w.speed;
      while (w.t >= 1) {
        w.t -= 1;
        w.seg++;
        if (w.seg >= w.path.length - 1) {
          w = this.list[i] = this.trip(w) ?? { ...w, seg: 0, path: [...w.path].reverse() };
        }
      }
      const a = w.path[w.seg];
      const b = w.path[Math.min(w.seg + 1, w.path.length - 1)];
      const dx = b.x - a.x;
      const dz = b.y - a.y;
      // Lane: a sideways offset so people coming and going do not overlap.
      const x = a.x + 0.5 + dx * w.t - dz * w.lane;
      const z = a.y + 0.5 + dz * w.t + dx * w.lane;
      const bob = Math.abs(Math.sin(time * 9 + w.phase)) * 0.03;
      this.tmp.position.set(x, this.ground.height(x, z) + 0.04 + bob, z);
      this.tmp.rotation.set(0, Math.atan2(dx, dz), Math.sin(time * 9 + w.phase) * 0.06);
      this.tmp.updateMatrix();
      this.body.setMatrixAt(i, this.tmp.matrix);
      this.head.setMatrixAt(i, this.tmp.matrix);
    }
    this.body.instanceMatrix.needsUpdate = true;
    this.head.instanceMatrix.needsUpdate = true;
  }
}

const PUFFS = 4;
const RISE_SECONDS = 4.5;

/** Smoke from house roofs, workshop kilns and the altar fire: puffs that rise, drift and swell. */
export class Smoke {
  readonly mesh: THREE.InstancedMesh;
  private tmp = new THREE.Object3D();

  constructor(private sources: THREE.Vector3[]) {
    const g = new THREE.IcosahedronGeometry(1, 0);
    const m = new THREE.MeshLambertMaterial({ color: 0xe2dcd2, transparent: true, opacity: 0.26, depthWrite: false, flatShading: true });
    this.mesh = new THREE.InstancedMesh(g, m, Math.max(1, sources.length * PUFFS));
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = sources.length * PUFFS;
  }

  update(time: number) {
    let i = 0;
    for (let k = 0; k < this.sources.length; k++) {
      const src = this.sources[k];
      for (let p = 0; p < PUFFS; p++, i++) {
        const age = ((time / RISE_SECONDS + p / PUFFS + k * 0.137) % 1 + 1) % 1;
        const size = 0.05 + age * 0.2;
        // Swell, then thin out at the top.
        const s = size * Math.min(1, (1 - age) * 3);
        this.tmp.position.set(src.x + age * 0.9 + Math.sin(time + k) * 0.05, src.y + age * 1.8, src.z - age * 0.3);
        this.tmp.scale.setScalar(s);
        this.tmp.rotation.set(age * 2, k, 0);
        this.tmp.updateMatrix();
        this.mesh.setMatrixAt(i, this.tmp.matrix);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Flickering fire on the altar (emissive, no light: cheap on phones). */
export class Fire {
  readonly group = new THREE.Group();
  private outer: THREE.Mesh;
  private inner: THREE.Mesh;

  constructor(at: THREE.Vector3) {
    this.outer = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 6), new THREE.MeshBasicMaterial({ color: COLORS.fire }));
    this.inner = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 6), new THREE.MeshBasicMaterial({ color: COLORS.flame }));
    this.outer.position.y = 0.3;
    this.inner.position.y = 0.22;
    this.group.add(this.outer, this.inner);
    this.group.position.copy(at);
  }

  update(time: number) {
    const f = 1 + Math.sin(time * 13) * 0.08 + Math.sin(time * 23) * 0.05;
    this.outer.scale.set(1, f, 1);
    this.inner.scale.set(1, 2 - f, 1);
    this.group.rotation.y = time * 0.7;
  }
}
