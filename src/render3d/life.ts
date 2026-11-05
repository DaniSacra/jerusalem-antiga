import * as THREE from 'three';
import { createRng, findPath, pickWalkerType, walkerGoal, walkerStart, type Cell, type GameState, type Rng, type WalkerType } from '../core';
import { COLORS } from './models';
import type { Terrain } from './terrain';
import { patch } from './shaders';

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
  /** Walkers on the streets now (a share of the list: fewer at night and in the rain). */
  private shown = 0;

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
    this.body.count = this.head.count = this.shown = this.list.length;
  }

  /** Shows a share (0..1) of the walkers; the others are indoors. */
  setShare(share: number) {
    this.shown = Math.round(this.list.length * Math.min(1, Math.max(0, share)));
    this.body.count = this.head.count = this.shown;
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
    for (let i = 0; i < this.shown; i++) {
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

  private material: THREE.MeshLambertMaterial;

  /** Sources: x, y, z and in w a 0..1 key (a source smokes when its key is below the share). */
  constructor(private sources: THREE.Vector4[]) {
    const g = new THREE.IcosahedronGeometry(1, 0);
    const m = (this.material = new THREE.MeshLambertMaterial({ color: 0xe2dcd2, transparent: true, opacity: 0.26, depthWrite: false, flatShading: true }));
    this.mesh = new THREE.InstancedMesh(g, m, Math.max(1, sources.length * PUFFS));
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = sources.length * PUFFS;
  }

  /**
   * `share` of the chimneys smoke (the season's: every house in winter, few in summer); the wind
   * bends the plumes and the rain thins them.
   */
  update(time: number, share: number, wind: number, opacity = 0.26) {
    this.material.opacity = opacity;
    let i = 0;
    for (let k = 0; k < this.sources.length; k++) {
      const src = this.sources[k];
      // The first sources (altar, workshops) always smoke; the houses by a stable hash.
      const on = src.w < share;
      for (let p = 0; p < PUFFS; p++, i++) {
        const age = ((time / RISE_SECONDS + p / PUFFS + k * 0.137) % 1 + 1) % 1;
        const size = 0.05 + age * 0.2;
        // Swell, then thin out at the top.
        const s = on ? size * Math.min(1, (1 - age) * 3) : 0;
        const lean = 0.9 + wind * 2.2;
        this.tmp.position.set(src.x + age * lean + Math.sin(time + k) * 0.05, src.y + age * (1.8 - wind * 0.8), src.z - age * 0.3);
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

/**
 * Field hands: figures bent over the crops, a few per field, more at the harvest and the plowing
 * (the count comes from fieldHands, pure and tested). They sway as they work.
 */
export class FieldHands {
  readonly objects: THREE.InstancedMesh[];
  private spots: { x: number; y: number; z: number; phase: number }[] = [];
  private tmp = new THREE.Object3D();
  private shown = 0;

  constructor(fields: THREE.Vector3[], perField: number, shadows: boolean) {
    const rng = createRng(fields.length * 97 + 5);
    for (const f of fields)
      for (let k = 0; k < perField; k++) this.spots.push({ x: f.x + (rng() - 0.5) * 1.4, y: f.y + 0.05, z: f.z + (rng() - 0.5) * 1.4, phase: rng() * 6.28 });
    const robe = new THREE.CylinderGeometry(0.06, 0.11, 0.26, 6);
    robe.translate(0, 0.13, 0);
    const head = new THREE.IcosahedronGeometry(0.06, 0);
    head.translate(0, 0.31, 0);
    const n = Math.max(1, this.spots.length);
    const body = new THREE.InstancedMesh(robe, patch(new THREE.MeshStandardMaterial({ color: 0xd8c8a4, roughness: 0.9, flatShading: true })), n);
    const hd = new THREE.InstancedMesh(head, new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.8, flatShading: true }), n);
    this.objects = [body, hd];
    for (const m of this.objects) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.castShadow = shadows;
      m.frustumCulled = false;
      m.count = 0;
    }
  }

  /** `perField` (0..max) people work each field now. */
  update(time: number, perField: number, max: number) {
    const share = Math.min(1, perField / Math.max(max, 1e-6));
    this.shown = Math.round(this.spots.length * share);
    for (let i = 0; i < this.shown; i++) {
      const p = this.spots[i];
      const bend = 0.5 + Math.sin(time * 2 + p.phase) * 0.25;
      this.tmp.position.set(p.x + Math.sin(time * 0.3 + p.phase) * 0.15, p.y, p.z);
      this.tmp.rotation.set(bend, p.phase, 0);
      this.tmp.updateMatrix();
      this.objects[0].setMatrixAt(i, this.tmp.matrix);
      this.objects[1].setMatrixAt(i, this.tmp.matrix);
    }
    for (const m of this.objects) {
      m.count = this.shown;
      m.instanceMatrix.needsUpdate = true;
    }
  }
}

const GLOW_VERT = /* glsl */ `
attribute float aPhase;
uniform float uTime; uniform float uScale; uniform float uNight;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float f = 0.85 + 0.15 * sin(uTime * 11.0 + aPhase) * sin(uTime * 7.0 + aPhase * 2.0);
  vA = uNight * f;
  gl_PointSize = uScale * f / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const GLOW_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.0, 1.0, d));
  a = a * a * vA;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor * a, a);
}`;

/**
 * Warm lights of the night with no real lights (cheap on phones): flickering flames on the fire
 * spots (tents, braziers along the main streets, the altar, kilns), a glow halo around each and a
 * warm pool of light on the ground. All three fade in with the night.
 */
export class NightFires {
  readonly objects: THREE.Object3D[];
  private flames: THREE.InstancedMesh;
  private glowMat: THREE.ShaderMaterial;
  private poolMat: THREE.MeshBasicMaterial;
  private tmp = new THREE.Object3D();

  constructor(private spots: THREE.Vector3[]) {
    const n = Math.max(1, spots.length);
    const cone = new THREE.ConeGeometry(0.09, 0.26, 5);
    cone.translate(0, 0.13, 0);
    this.flames = new THREE.InstancedMesh(cone, new THREE.MeshBasicMaterial({ color: COLORS.fire }), n);
    this.flames.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.flames.frustumCulled = false;
    this.flames.count = spots.length;
    const pts = new THREE.BufferGeometry();
    pts.setAttribute('position', new THREE.Float32BufferAttribute(spots.flatMap((p) => [p.x, p.y + 0.18, p.z]), 3));
    pts.setAttribute('aPhase', new THREE.Float32BufferAttribute(spots.map((_, i) => i * 1.7), 1));
    this.glowMat = new THREE.ShaderMaterial({
      vertexShader: GLOW_VERT,
      fragmentShader: GLOW_FRAG,
      uniforms: { uTime: { value: 0 }, uScale: { value: 900 }, uNight: { value: 0 }, uColor: { value: new THREE.Color(0xffa040) } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Points(pts, this.glowMat);
    glow.frustumCulled = false;
    // Light pools: soft discs on the ground.
    const disc = new THREE.CircleGeometry(1.6, 20);
    disc.rotateX(-Math.PI / 2);
    this.poolMat = new THREE.MeshBasicMaterial({ color: 0xff9a40, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, alphaMap: poolTexture() });
    const pools = new THREE.InstancedMesh(disc, this.poolMat, n);
    spots.forEach((p, i) => {
      this.tmp.position.set(p.x, p.y + 0.06, p.z);
      this.tmp.rotation.set(0, 0, 0);
      this.tmp.scale.setScalar(1);
      this.tmp.updateMatrix();
      pools.setMatrixAt(i, this.tmp.matrix);
    });
    pools.count = spots.length;
    this.objects = [this.flames, glow, pools];
  }

  /** `pixelRatio`: the glow size is in drawing-buffer pixels. */
  update(time: number, night: number, rain: number, pixelRatio: number) {
    // The rain dampens the fires outside.
    const k = night * (1 - 0.5 * rain);
    this.glowMat.uniforms.uTime.value = time;
    this.glowMat.uniforms.uScale.value = 450 * pixelRatio;
    this.glowMat.uniforms.uNight.value = k;
    this.poolMat.opacity = 0.55 * k;
    const show = k > 0.05;
    for (const o of this.objects) o.visible = show;
    if (!show) return;
    for (let i = 0; i < this.spots.length; i++) {
      const p = this.spots[i];
      const f = 0.8 + 0.25 * Math.sin(time * 13 + i) + 0.1 * Math.sin(time * 23 + i * 2);
      this.tmp.position.copy(p);
      this.tmp.rotation.set(0, time * 2 + i, 0);
      this.tmp.scale.set(k, f * k, k);
      this.tmp.updateMatrix();
      this.flames.setMatrixAt(i, this.tmp.matrix);
    }
    this.flames.instanceMatrix.needsUpdate = true;
  }
}

/** Radial falloff for the light pools. */
function poolTexture(): THREE.DataTexture {
  const n = 64;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2);
      const v = Math.round(255 * Math.max(0, 1 - d) ** 2);
      data.set([v, v, v, 255], (y * n + x) * 4);
    }
  const t = new THREE.DataTexture(data, n, n);
  t.needsUpdate = true;
  return t;
}
