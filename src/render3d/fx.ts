import * as THREE from 'three';
import { createRng, type Rect } from '../core';
import { C } from '../render/palette';
import { COLORS, materialOf } from './models';
import {
  celebrateRecipe,
  dustRecipe,
  fallAlpha,
  fallAngle,
  fallSide,
  fellRecipe,
  FX_SECONDS,
  haloRecipe,
  hopHeight,
  hopStretch,
  ringAlpha,
  ringProgress,
  ringRadius,
  ringRadiusFor,
  sparkAlpha,
  sparkAt,
  sparkleRecipe,
  sparkSize,
  spoilRecipe,
  topOf,
  type Spark,
} from './fxMath';
import LOOK from './look3d.json';

const F = LOOK.fx;
/** Most rings, particles and falling trees at once (the oldest effects simply end). */
const RINGS = 32;
const SPARKS = 640;
const TREES = 4;
/** Ring light colour (as the 2D `Effects.ring` default). */
export const RING_LIGHT = 0xfff3b0;
const CELEBRATE = 0xffe08a;

/**
 * Lifts a building on a cell while it hops (`dy` up, `stretch` taller and as much thinner); called
 * every frame of the hop and once with (0, 1) at its end. The world owns the building instances.
 */
export type LiftFn = (x: number, y: number, dy: number, stretch: number) => void;

interface Ring {
  x: number;
  y: number;
  z: number;
  radius: number;
  r: number;
  g: number;
  b: number;
  delay: number;
  age: number;
}

type Live = Spark & { age: number; lr: number; lg: number; lb: number };

interface Faller {
  group: THREE.Group;
  mats: THREE.MeshStandardMaterial[];
  side: number;
  age: number;
  palm: boolean;
}

const RING_VERT = /* glsl */ `
attribute vec4 aColor;
varying vec2 vUv; varying vec4 vColor;
void main() {
  vUv = uv; vColor = aColor;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;

const RING_FRAG = /* glsl */ `
varying vec2 vUv; varying vec4 vColor;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  // A bright band, a faint glow inside it and a thin dark edge outside, so it reads on pale sand.
  float band = smoothstep(0.5, 0.8, r) * (1.0 - smoothstep(0.86, 0.93, r));
  float glow = 0.2 * (1.0 - smoothstep(0.3, 0.8, r));
  float edge = 0.4 * smoothstep(0.88, 0.94, r) * (1.0 - smoothstep(0.95, 1.0, r));
  float a = max(band + glow, edge) * vColor.a;
  if (a < 0.01) discard;
  vec3 c = mix(vColor.rgb * 0.3, vColor.rgb, clamp((band + glow) / max(band + glow + edge, 1e-3), 0.0, 1.0));
  gl_FragColor = vec4(c, a);
  #include <colorspace_fragment>
}`;

const SPARK_VERT = /* glsl */ `
attribute vec4 aColor; attribute float aSize; attribute float aSoft;
uniform float uScale; uniform float uLight;
varying vec4 vColor; varying float vSoft;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(aSize * uScale / max(-mv.z, 0.1), 256.0);
  vColor = vec4(aColor.rgb * uLight, aColor.a);
  vSoft = aSoft;
}`;

const SPARK_FRAG = /* glsl */ `
varying vec4 vColor; varying float vSoft;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = vSoft > 0.5 ? pow(max(0.0, 1.0 - r), 1.6) : 1.0 - smoothstep(0.75, 1.0, r);
  a *= vColor.a;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor.rgb, a);
  #include <colorspace_fragment>
}`;

/** One batch of point sprites (normal or additive): positions, colour and alpha, size, softness. */
class SparkBatch {
  readonly points: THREE.Points;
  readonly pos: Float32Array;
  readonly col: Float32Array;
  readonly size: Float32Array;
  readonly soft: Float32Array;
  private geo = new THREE.BufferGeometry();
  readonly mat: THREE.ShaderMaterial;
  n = 0;

  constructor(cap: number, additive: boolean) {
    this.pos = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 4);
    this.size = new Float32Array(cap);
    this.soft = new Float32Array(cap);
    const attr = (a: Float32Array, k: number) => new THREE.BufferAttribute(a, k).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', attr(this.pos, 3));
    this.geo.setAttribute('aColor', attr(this.col, 4));
    this.geo.setAttribute('aSize', attr(this.size, 1));
    this.geo.setAttribute('aSoft', attr(this.soft, 1));
    this.geo.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: SPARK_VERT,
      fragmentShader: SPARK_FRAG,
      uniforms: { uScale: { value: 500 }, uLight: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    const buf = new THREE.Vector2();
    // Point sizes are in world units: the pixels per unit at distance 1 come from the camera.
    this.points.onBeforeRender = (renderer, _scene, camera) => {
      renderer.getDrawingBufferSize(buf);
      this.mat.uniforms.uScale.value = buf.y * camera.projectionMatrix.elements[5] * 0.5;
    };
  }

  /** Sends the first `n` particles written this frame to the GPU. */
  commit(n: number) {
    this.n = n;
    this.geo.setDrawRange(0, n);
    this.points.visible = n > 0;
    if (!n) return;
    for (const name of ['position', 'aColor', 'aSize', 'aSoft']) {
      const a = this.geo.getAttribute(name) as THREE.BufferAttribute;
      a.clearUpdateRanges();
      a.addUpdateRange(0, n * a.itemSize);
      a.needsUpdate = true;
    }
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}

/**
 * The world's moments, drawn in 3D as the 2D `Effects` draws them: light rings on the ground,
 * dust and pebbles when something is demolished, golden sparks and a halo for the temple and the
 * milestones, a green puff and flies when food spoils, a tree tipping over when it is cut, and a
 * building's hop (through `lift`). Everything is pooled: no allocation per frame, three draw calls
 * (rings, normal particles, glowing particles) plus the few falling trees.
 */
export class WorldFx {
  readonly group = new THREE.Group();
  private ringMesh: THREE.InstancedMesh;
  private ringColor: THREE.InstancedBufferAttribute;
  private rings: Ring[] = [];
  private ringCount = 0;
  private live: Live[] = [];
  private liveCount = 0;
  private normal = new SparkBatch(SPARKS, false);
  private glow = new SparkBatch(SPARKS, true);
  private fallers: Faller[] = [];
  private hops: { x: number; y: number; age: number }[] = [];
  private seed = 1;
  private share = 1;
  private shareAcc = 0;
  private m = new THREE.Matrix4();
  private c = new THREE.Color();
  private at = { x: 0, y: 0, z: 0 };
  private readonly emit = (p: Readonly<Spark>) => this.add(p);

  constructor(
    private height: (x: number, z: number) => number,
    private lift: LiftFn | null = null,
  ) {
    const plane = new THREE.PlaneGeometry(1, 1);
    plane.rotateX(-Math.PI / 2);
    this.ringColor = new THREE.InstancedBufferAttribute(new Float32Array(RINGS * 4), 4).setUsage(THREE.DynamicDrawUsage);
    plane.setAttribute('aColor', this.ringColor);
    const ringMat = new THREE.ShaderMaterial({ vertexShader: RING_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false });
    this.ringMesh = new THREE.InstancedMesh(plane, ringMat, RINGS);
    this.ringMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.ringMesh.frustumCulled = false;
    this.ringMesh.renderOrder = 4;
    this.ringMesh.count = 0;
    for (let k = 0; k < RINGS; k++) this.rings.push({ x: 0, y: 0, z: 0, radius: 1, r: 1, g: 1, b: 1, delay: 0, age: 0 });
    for (let k = 0; k < SPARKS; k++) this.live.push({ ...blankLive() });
    for (let k = 0; k < TREES; k++) this.fallers.push(this.makeFaller());
    this.group.add(this.ringMesh, this.normal.points, this.glow.points, ...this.fallers.map((f) => f.group));
    this.group.name = 'worldFx';
  }

  // ---------------------------------------------------------------- the moments

  /** A ring of light spreading on the ground round a footprint; `radius` is where it ends (cells). */
  ring(r: Rect, color = RING_LIGHT, radius = ringRadiusFor(r), delay = 0) {
    if (this.ringCount >= RINGS) return;
    const g = this.rings[this.ringCount++];
    g.x = r.x + r.w / 2;
    g.z = r.y + r.h / 2;
    g.y = this.height(g.x, g.z) + F.ring.lift;
    g.radius = radius;
    this.c.setHex(color);
    g.r = this.c.r;
    g.g = this.c.g;
    g.b = this.c.b;
    g.delay = delay;
    g.age = 0;
  }

  /** Demolition: dust the size of the footprint and pebbles thrown up. */
  dust(r: Rect) {
    dustRecipe(r, this.height(r.x + r.w / 2, r.y + r.h / 2), this.rng(), this.emit);
  }

  /** The temple is built: golden rings one after another, a burst of light and a short glow. */
  celebrate(r: Rect) {
    const C3 = F.celebrate;
    for (let k = 0; k < C3.rings; k++) this.ring(r, CELEBRATE, C3.radius + k * C3.grow, k * C3.every);
    const ground = this.height(r.x + r.w / 2, r.y + r.h / 2);
    celebrateRecipe(r, ground, this.rng(), this.emit);
    haloRecipe(r, ground, this.emit, 1.4);
  }

  /** A short burst of sparkles rising over a footprint. */
  spark(r: Rect, color: number = C.milestone) {
    sparkleRecipe(r, this.height(r.x + r.w / 2, r.y + r.h / 2), this.rng(), this.emit, [color, C.milestoneGlow], 0);
  }

  /**
   * A milestone: golden rings, a warm halo over the building and sparkles rising for most of the
   * moment (`top`: the building's height, guessed from the footprint when not given).
   */
  milestone(r: Rect, top = topOf(r)) {
    const M3 = F.milestone;
    const base = ringRadiusFor(r);
    for (let k = 0; k < M3.rings; k++) this.ring(r, C.milestone, base * (1.15 + 0.35 * k), k * M3.every);
    const ground = this.height(r.x + r.w / 2, r.y + r.h / 2);
    haloRecipe(r, ground, this.emit, FX_SECONDS.milestone, top);
    sparkleRecipe(r, ground, this.rng(), this.emit, [C.milestone, C.milestoneGlow, C.gold], FX_SECONDS.milestone * M3.sparkShare, top);
  }

  /** Food spoiling at a building (the granary or the altar): a green puff and flies. */
  spoil(r: Rect) {
    spoilRecipe(r, this.height(r.x + r.w / 2, r.y + r.h / 2), this.rng(), this.emit);
  }

  /** A building hops on cell (x, y) (needs `lift`). */
  hop(x: number, y: number) {
    if (!this.lift) return;
    const h = this.hops.find((o) => o.x === x && o.y === y);
    if (h) h.age = 0;
    else if (this.hops.length < 16) this.hops.push({ x, y, age: 0 });
  }

  /**
   * The tree on cell (x, y) was cut: a tree like it tips over, lies a moment and fades, its leaves
   * burst where it lands (the world already shows the stump).
   */
  fell(x: number, y: number, palm = false) {
    const f = this.fallers.reduce((a, b) => (b.age > a.age ? b : a));
    f.age = 0;
    f.side = fallSide(x, y);
    f.palm = palm;
    f.group.visible = true;
    f.group.children[0].visible = !palm;
    f.group.children[1].visible = !palm;
    f.group.children[2].visible = palm;
    f.group.children[3].visible = palm;
    const ground = this.height(x + 0.5, y + 0.5);
    f.group.position.set(x + 0.5, ground, y + 0.5);
    f.group.rotation.set(0, 0, 0);
    for (const m of f.mats) m.opacity = 1;
    // The crown in the season's colour, as the trees around it.
    const leaf = materialOf(palm ? COLORS.palm : COLORS.leaf).color;
    f.mats[palm ? 2 : 1].color.copy(leaf);
    const hex = leaf.getHex();
    fellRecipe(x, y, ground, this.rng(), this.emit, [hex, materialOf(COLORS.leafDark).color.getHex(), palm ? C.palmDark : C.oliveLight]);
  }

  /** Low quality: only this share (0..1) of the particles is thrown. */
  limit(share: number) {
    this.share = Math.max(0.1, Math.min(1, share));
  }

  // ---------------------------------------------------------------- frame

  /** Advances every effect by `dt` seconds; `light` (0..1) dims the dust and flies at night. */
  update(dt: number, _time = 0, light = 1) {
    this.updateRings(dt);
    this.updateSparks(dt, light);
    this.updateFallers(dt);
    this.updateHops(dt);
  }

  private updateRings(dt: number) {
    let n = 0;
    for (let k = 0; k < this.ringCount; k++) {
      const g = this.rings[k];
      g.age += dt;
      const u = ringProgress(g.age, g.delay);
      if (u >= 1) continue;
      // Kept: packed to the front of the pool and drawn.
      if (n !== k) {
        const t = this.rings[n];
        this.rings[n] = g;
        this.rings[k] = t;
      }
      const d = ringRadius(Math.max(0, u), g.radius) * 2;
      this.m.makeScale(d, 1, d).setPosition(g.x, g.y, g.z);
      this.ringMesh.setMatrixAt(n, this.m);
      this.ringColor.setXYZW(n, g.r, g.g, g.b, u < 0 ? 0 : ringAlpha(u));
      n++;
    }
    this.ringCount = n;
    this.ringMesh.count = n;
    this.ringMesh.visible = n > 0;
    if (n) {
      this.ringMesh.instanceMatrix.needsUpdate = true;
      this.ringColor.needsUpdate = true;
    }
  }

  private updateSparks(dt: number, light: number) {
    let nn = 0;
    let ng = 0;
    const at = this.at;
    for (let k = 0; k < this.liveCount; ) {
      const p = this.live[k];
      p.age += dt;
      const t = p.age - p.delay;
      if (t >= p.life) {
        // Dead: swap the last live one in.
        const last = this.live[--this.liveCount];
        this.live[this.liveCount] = p;
        this.live[k] = last;
        continue;
      }
      k++;
      if (t < 0) continue;
      const b = p.additive ? this.glow : this.normal;
      const i = p.additive ? ng++ : nn++;
      sparkAt(p, t, at);
      b.pos[i * 3] = at.x;
      b.pos[i * 3 + 1] = at.y;
      b.pos[i * 3 + 2] = at.z;
      b.col[i * 4] = p.lr;
      b.col[i * 4 + 1] = p.lg;
      b.col[i * 4 + 2] = p.lb;
      b.col[i * 4 + 3] = sparkAlpha(p, t);
      b.size[i] = sparkSize(p, t);
      b.soft[i] = p.soft;
    }
    this.normal.mat.uniforms.uLight.value = light;
    this.normal.commit(nn);
    this.glow.commit(ng);
  }

  private updateFallers(dt: number) {
    const sec = FX_SECONDS.fall;
    for (const f of this.fallers) {
      if (!f.group.visible) continue;
      f.age += dt;
      const u = f.age / sec;
      if (u >= 1) {
        f.group.visible = false;
        continue;
      }
      f.group.rotation.z = -f.side * fallAngle(u);
      const a = fallAlpha(u);
      for (const m of f.mats) m.opacity = a;
    }
  }

  private updateHops(dt: number) {
    for (let k = this.hops.length - 1; k >= 0; k--) {
      const h = this.hops[k];
      h.age += dt;
      const u = h.age / FX_SECONDS.hop;
      if (u >= 1) {
        this.lift?.(h.x, h.y, 0, 1);
        this.hops.splice(k, 1);
      } else this.lift?.(h.x, h.y, hopHeight(u), hopStretch(u));
    }
  }

  // ---------------------------------------------------------------- pools

  private add(p: Readonly<Spark>) {
    if (this.share < 1) {
      this.shareAcc += this.share;
      if (this.shareAcc < 1) return;
      this.shareAcc -= 1;
    }
    if (this.liveCount >= SPARKS) return;
    const q = this.live[this.liveCount++];
    Object.assign(q, p);
    q.age = 0;
    this.c.setHex(p.color);
    q.lr = this.c.r;
    q.lg = this.c.g;
    q.lb = this.c.b;
  }

  private rng() {
    return createRng(this.seed++ * 7919);
  }

  /** A tree that can fall: an olive (trunk, crown) and a palm (tall trunk, fronds), one shown. */
  private makeFaller(): Faller {
    const mat = (color: number) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, transparent: true });
    const bark = mat(C.trunk);
    const leaf = mat(C.olive);
    const palmLeaf = mat(C.palm);
    const olTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.45, 5).translate(0, 0.225, 0), bark);
    const olCrown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 0).scale(1, 0.75, 1).translate(0, 0.65, 0), leaf);
    const pTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, 1.6, 5).translate(0, 0.8, 0), bark);
    const pCrown = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.25, 7).rotateX(Math.PI).translate(0, 1.6, 0), palmLeaf);
    const group = new THREE.Group();
    group.add(olTrunk, olCrown, pTrunk, pCrown);
    for (const m of group.children as THREE.Mesh[]) m.castShadow = true;
    group.visible = false;
    return { group, mats: [bark, leaf, palmLeaf], side: 1, age: 1e9, palm: false };
  }

  /** Frees the GPU side (geometries and materials). */
  dispose() {
    this.ringMesh.geometry.dispose();
    (this.ringMesh.material as THREE.Material).dispose();
    this.ringMesh.dispose();
    this.normal.dispose();
    this.glow.dispose();
    for (const f of this.fallers) {
      for (const m of f.group.children as THREE.Mesh[]) m.geometry.dispose();
      for (const m of f.mats) m.dispose();
    }
    this.group.removeFromParent();
  }
}

function blankLive(): Live {
  return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, gravity: 0, drag: 0, delay: 0, life: 0, size0: 0, size1: 0, alpha: 0, fadeIn: 0, fadeOut: 0, color: 0, soft: 1, additive: false, floor: 0, buzz: 0, seed: 0, age: 0, lr: 1, lg: 1, lb: 1 };
}
