import VISUAL from '../data/visual.json';
import * as THREE from 'three';
import { ageBand, borderCells, craftOf, createRng, jobsOf, findPath, pickWalkerType, walkerGoal, walkerStart, type Cell, type Craft, type GameState, type Rng, type WalkerType } from '../core';
import { COLORS } from './models';
import LOOK from './look3d.json';
import type { Terrain } from './terrain';
import { castWalkers, COMPANION_AT, companionOf, figureLook, LOADS, loadOf, residentLook, walkerLook } from './crowd';
import { hash } from './plan';
import { Herd } from './animals';
import { HAUL, haulJobs, legOf, waitAfter, type HaulJob, type Pt } from './haul';
import { Figures } from './figures';

/** How far (cells) walkers come from to a milestone; the crowd size and cheering time are in visual.json > moments. */
const GATHER_RADIUS = 14;
const MOMENTS = VISUAL.moments;

interface Walker {
  type: WalkerType;
  path: Cell[];
  seg: number;
  t: number;
  speed: number;
  lane: number;
  phase: number;
  /** Slot of the animal walking beside (donkey or sheep herd), or -1. */
  beast: number;
  /** Walking to a milestone to cheer there (seconds of cheering once it arrives), or 0. */
  cheer?: number;
}

/**
 * Residents walking the road network (paths and destinations from src/core, as in the 2D game),
 * drawn as low-poly people dressed by who walks (the old, children, women carrying water or baskets,
 * men at their trades: see crowd.ts), with a light bob and sway.
 */
export class Walkers {
  private list: Walker[] = [];
  private figures: Figures;
  private donkeys: Herd;
  private sheep: Herd;
  private rng: Rng;
  /** The resident each walker is (null: a passer-by in a town with fewer residents than walkers). */
  private people: (number | null)[] = [];
  /** Where each walker stands now (x, y, z per slot), for a tap. */
  private at: Float32Array = new Float32Array(0);
  /** Walkers on the streets now (a share of the list: fewer at night and in the rain). */
  private shown = 0;

  constructor(private s: GameState, private ground: Terrain, count: number, shadows: boolean) {
    this.rng = createRng(s.week * 31 + 7);
    // The crafts of the city's workshops: an artisan carries the goods of one of them (his own, when he works there).
    const crafts = s.buildings.filter((b) => b.connected).map(craftOf).filter((c): c is Craft => c !== null);
    let donkeys = 0;
    let sheep = 0;
    for (let i = 0; i < count; i++) {
      const w = this.trip(null);
      if (w) {
        w.seg = Math.floor(this.rng() * (w.path.length - 1));
        const beast = companionOf(w.type);
        w.beast = beast === 'donkey' ? donkeys++ : beast === 'sheep' ? sheep++ : -1;
        this.list.push(w);
      }
    }
    // Each walker is a resident (tap one: its sheet opens), dressed as that person.
    const draws = this.list.map(() => this.rng());
    this.people = castWalkers(s, this.list.map((w) => w.type), draws);
    const jobs = jobsOf(s);
    const byId = new Map(s.people.map((p) => [p.id, p]));
    const loads = this.list.map((w, k) => {
      const id = this.people[k];
      const own = id !== null ? s.buildings.find((b) => b.id === jobs.get(id)?.buildingId) : undefined;
      const craft = (own && craftOf(own)) || (crafts.length ? crafts[Math.floor(draws[k] * crafts.length)] : null);
      return loadOf(w.type, craft);
    });
    // One mesh only for each thing someone carries (fewer draw calls).
    this.figures = new Figures(count, shadows, LOADS.filter((l) => loads.includes(l)));
    this.list.forEach((w, k) => {
      const p = this.people[k] !== null ? byId.get(this.people[k]!) : undefined;
      this.figures.dress(k, p ? residentLook(w.type, p.sex, ageBand(p, s.week), hash(p.id, 3)) : walkerLook(w.type, draws[k]));
      this.figures.carry(k, loads[k]);
      w.speed *= this.figures.look(k).pace;
    });
    this.donkeys = new Herd('donkey', donkeys, shadows);
    this.sheep = new Herd('sheep', sheep, shadows);
    this.donkeys.count = donkeys;
    this.sheep.count = sheep;
    this.figures.count = this.shown = this.list.length;
    this.at = new Float32Array(this.list.length * 3);
  }

  /** The residents on the streets now and where they are (world x, y at the head, z). */
  *residents(): Generator<{ id: number; x: number; y: number; z: number }> {
    for (let i = 0; i < this.shown; i++) {
      const id = this.people[i];
      if (id !== null && id !== undefined) yield { id, x: this.at[i * 3], y: this.at[i * 3 + 1] + 0.3, z: this.at[i * 3 + 2] };
    }
  }

  /** Shows a share (0..1) of the walkers; the others are indoors. */
  setShare(share: number) {
    this.shown = Math.round(this.list.length * Math.min(1, Math.max(0, share)));
    this.figures.count = this.shown;
  }

  get objects(): THREE.Object3D[] {
    return [...this.figures.objects, ...this.donkeys.objects, ...this.sheep.objects];
  }

  /** Walkers on the streets now. */
  get count() {
    return this.shown;
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
      if (path && path.length > 2) return { type, path, seg: 0, t: 0, speed: prev?.speed ?? 0.9 + this.rng() * 0.5, lane: (this.rng() - 0.5) * 0.4, phase: this.rng() * 6, beast: prev?.beast ?? -1 };
    }
    return null;
  }

  /**
   * A milestone at a building: up to `milestoneCrowd` walkers on the streets near it walk there by the
   * roads, cheer for `milestoneSeconds` (hopping) and go on their way.
   */
  gather(b: { x: number; y: number; w: number; h: number }) {
    const s = this.s;
    const goals = borderCells(s, b).filter((c) => s.network[c.y * s.cols + c.x]);
    if (!goals.length) return;
    const cx = b.x + b.w / 2;
    const cz = b.y + b.h / 2;
    const near = this.list
      .slice(0, this.shown)
      .map((w, i) => ({ i, d: Math.hypot(w.path[w.seg].x - cx, w.path[w.seg].y - cz) }))
      .filter((o) => o.d < GATHER_RADIUS && !this.list[o.i].cheer)
      .sort((a, c) => a.d - c.d)
      .slice(0, MOMENTS.milestoneCrowd);
    for (const { i } of near) {
      const w = this.list[i];
      const path = findPath(s, w.path[w.seg], goals);
      if (!path || path.length < 2) continue;
      this.list[i] = { ...w, path, seg: 0, t: 0, cheer: MOMENTS.milestoneSeconds, speed: w.speed * 1.3 };
    }
  }

  update(dt: number, time: number) {
    for (let i = 0; i < this.shown; i++) {
      let w = this.list[i];
      if (w.cheer && w.seg >= w.path.length - 1) {
        // At the milestone: hopping for joy, then on its way again.
        w.cheer = Math.max(0, w.cheer - dt);
        const c = w.path[w.path.length - 1];
        const x = c.x + 0.5 + Math.sin(w.phase) * 0.3;
        const z = c.y + 0.5 + Math.cos(w.phase) * 0.3;
        const gy = this.ground.height(x, z);
        this.at.set([x, gy, z], i * 3);
        this.figures.place(i, x, gy + 0.04 + Math.abs(Math.sin(time * 8 + w.phase)) * 0.08, z, w.phase, 0, 0);
        if (w.beast >= 0) (w.type === 'donkeyMan' ? this.donkeys : this.sheep).hide(w.beast);
        if (!w.cheer) this.list[i] = { ...(this.trip({ ...w, speed: w.speed / 1.3 }) ?? { ...w, path: [...w.path].reverse() }), seg: 0, t: 0, cheer: 0 };
        continue;
      }
      w.t += dt * w.speed;
      while (w.t >= 1) {
        w.t -= 1;
        w.seg++;
        if (w.seg >= w.path.length - 1) {
          if (w.cheer) {
            w.seg = w.path.length - 1;
            w.t = 0;
            break;
          }
          w = this.list[i] = this.trip(w) ?? { ...w, seg: 0, path: [...w.path].reverse() };
        }
      }
      if (w.cheer && w.seg >= w.path.length - 1) continue;
      const a = w.path[w.seg];
      const b = w.path[Math.min(w.seg + 1, w.path.length - 1)];
      const dx = b.x - a.x;
      const dz = b.y - a.y;
      // Lane: a sideways offset so people coming and going do not overlap.
      const x = a.x + 0.5 + dx * w.t - dz * w.lane;
      const z = a.y + 0.5 + dz * w.t + dx * w.lane;
      // Two steps per second at the usual pace: a light bob and sway.
      const ph = time * 9 * w.speed + w.phase;
      const yaw = Math.atan2(dx, dz);
      const gy = this.ground.height(x, z);
      this.at.set([x, gy, z], i * 3);
      this.figures.place(i, x, gy + 0.04 + Math.abs(Math.sin(ph)) * 0.022, z, yaw, 0.04, Math.sin(ph) * 0.06);
      if (w.beast >= 0) {
        // The animal walks at the walker's right, a little behind.
        const bx = x - dz * COMPANION_AT.side - dx * COMPANION_AT.back;
        const bz = z + dx * COMPANION_AT.side - dz * COMPANION_AT.back;
        const herd = w.type === 'donkeyMan' ? this.donkeys : this.sheep;
        herd.place(w.beast, bx, this.ground.height(bx, bz) + 0.03 + Math.abs(Math.sin(ph + 1)) * 0.012, bz, yaw, Math.sin(ph + 1) * 0.04);
      }
    }
    // Walkers indoors (night, rain) take their animals in too.
    for (let i = this.shown; i < this.list.length; i++) {
      const w = this.list[i];
      if (w.beast >= 0) (w.type === 'donkeyMan' ? this.donkeys : this.sheep).hide(w.beast);
    }
    this.figures.commit();
    this.donkeys.commit();
    this.sheep.commit();
  }
}

const PUFFS = 6;
const RISE_SECONDS = 5;
const SMOKE_COLOR = 0xa29e9c;
/** Peak opacity of a puff (soft sprites need more than the old solid ones to read as much). */
export const SMOKE_OPACITY = 0.82;

/** A quad of side 1 centred on the origin, drawn once per instance (billboards in the shaders). */
function quads(count: number): THREE.InstancedBufferGeometry {
  const g = new THREE.InstancedBufferGeometry();
  const q = new THREE.PlaneGeometry(1, 1);
  g.index = q.index;
  g.setAttribute('position', q.attributes.position);
  g.setAttribute('uv', q.attributes.uv);
  g.instanceCount = count;
  return g;
}

/** GLSL value noise for the soft sprites. */
const SPRITE_NOISE = /* glsl */ `
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }`;

const SMOKE_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute vec4 aSrc; attribute float aOff;
uniform float uTime; uniform float uShare; uniform float uWind; uniform float uOpacity;
varying vec2 vUv; varying vec2 vView; varying float vA; varying float vSeed;
void main() {
  float age = fract(uTime / ${RISE_SECONDS.toFixed(1)} + aOff);
  // A source smokes when its key is under the share (the altar and the kilns always).
  float on = step(aSrc.w + 1e-4, uShare);
  float size = (0.16 + age * 0.6) * min(1.0, (1.0 - age) * 2.5) * on;
  vec3 c = aSrc.xyz + vec3(age * (0.9 + uWind * 2.2) + sin(uTime + aOff * 40.0) * 0.05, age * (1.8 - uWind * 0.8), -age * 0.3);
  vec4 mvPosition = modelViewMatrix * vec4(c, 1.0);
  float r = aOff * 37.0 + age * 1.2;
  vView = mat2(cos(r), sin(r), -sin(r), cos(r)) * position.xy;
  mvPosition.xy += vView * size;
  vUv = uv; vSeed = aOff * 13.0;
  vA = uOpacity * smoothstep(0.0, 0.12, age) * (1.0 - smoothstep(0.4, 1.0, age)) * on;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const SMOKE_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform vec3 uColor;
varying vec2 vUv; varying vec2 vView; varying float vA; varying float vSeed;
${SPRITE_NOISE}
void main() {
  vec2 p = vUv - 0.5;
  // A soft, lumpy puff: radial falloff broken by a little noise at the rim.
  float d = length(p) * 2.0 + (vnoise(vUv * 4.0 + vSeed) - 0.5) * 0.35;
  float a = pow(max(0.0, 1.0 - d), 0.8) * vA;
  if (a < 0.004) discard;
  // Lit from above: a brighter top and a greyer underside give the puff its volume (and contrast on
  // pale roofs and sand).
  float shade = clamp(0.5 + vView.y * 1.2 - vView.x * 0.4, 0.0, 1.0);
  gl_FragColor = vec4(uColor * mix(0.7, 1.15, shade), a);
  #include <fog_fragment>
}`;

/**
 * Smoke from house roofs, workshop kilns and the altar fire: soft round puffs (billboards) that rise,
 * drift with the wind and swell. Everything moves in the vertex shader: no work per puff on the CPU.
 */
export class Smoke {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  /** Sources: x, y, z and in w a 0..1 key (a source smokes when its key is below the share; see `smokeShare`). */
  constructor(sources: THREE.Vector4[]) {
    const n = Math.max(1, sources.length * PUFFS);
    const g = quads(sources.length * PUFFS);
    const src = new Float32Array(n * 4);
    const off = new Float32Array(n);
    sources.forEach((v, k) => {
      for (let p = 0; p < PUFFS; p++) {
        src.set([v.x, v.y, v.z, v.w], (k * PUFFS + p) * 4);
        off[k * PUFFS + p] = (p / PUFFS + k * 0.137) % 1;
      }
    });
    g.setAttribute('aSrc', new THREE.InstancedBufferAttribute(src, 4));
    g.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 1));
    this.material = new THREE.ShaderMaterial({
      vertexShader: SMOKE_VERT,
      fragmentShader: SMOKE_FRAG,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uShare: { value: 0 }, uWind: { value: 0 }, uOpacity: { value: SMOKE_OPACITY }, uColor: { value: new THREE.Color(SMOKE_COLOR) } }]),
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.visible = sources.length > 0;
  }

  /**
   * `share` of the chimneys smoke (`smokeShare`); the wind bends the plumes and the rain thins them;
   * `light` (0..1) dims them at night.
   */
  update(time: number, share: number, wind: number, opacity = SMOKE_OPACITY, light = 1) {
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uShare.value = share;
    u.uWind.value = wind;
    u.uOpacity.value = opacity;
    (u.uColor.value as THREE.Color).setHex(SMOKE_COLOR).multiplyScalar(0.35 + 0.65 * light);
  }
}

/** Tongues, embers and sparks of the altar fire; sparks over each tent fire. */
const TONGUES = 7;
const EMBERS = 7;
const ALTAR_SPARKS = 14;
const TENT_SPARKS = 3;

const FLAME_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute vec3 aAt; attribute vec4 aShape; attribute vec2 aFlags;
uniform float uTime; uniform float uNight; uniform float uCold; uniform float uRain;
varying vec2 vUv; varying float vKind; varying float vA; varying float vSeed;
void main() {
  float kind = aShape.x; float seed = aShape.y; float size = aShape.z;
  // Tent sparks show at night only, and never in a winter without firewood; the altar burns always.
  float vis = max(aFlags.x, uNight) * (1.0 - aFlags.y * uCold) * (1.0 - 0.5 * uRain);
  vec3 c = aAt; vec2 q = position.xy; float a = vis;
  float ang = seed * 6.2832;
  if (kind < 0.5) {
    // A tongue of flame on a ring, anchored at its foot, flickering in height and licking sideways.
    float r = 0.13 * aShape.w;
    c += vec3(cos(ang) * r, 0.0, sin(ang) * r);
    float h = size * (0.75 + 0.25 * sin(uTime * 9.0 + seed * 21.0) * sin(uTime * 5.3 + seed * 7.0));
    q = vec2(q.x * size * 0.55, (q.y + 0.5) * h);
    q.x += q.y * q.y * 0.5 * sin(uTime * 4.0 + seed * 11.0);
  } else if (kind < 1.5) {
    // A glowing ember in the bed of the fire, pulsing slowly.
    c += vec3(cos(ang) * 0.28 * aShape.w, 0.02, sin(ang) * 0.24 * aShape.w);
    q *= size;
    a *= 0.6 + 0.4 * sin(uTime * 2.0 + seed * 30.0);
  } else {
    // A spark flying up, drifting and dying out.
    float age = fract(uTime * (0.45 + seed * 0.35) + seed * 3.7);
    c += vec3(sin(ang + uTime) * 0.12 * age + cos(ang) * 0.05, age * 1.3 * aShape.w, cos(ang * 1.7 + uTime) * 0.12 * age);
    q *= size * (1.0 - age * 0.7);
    a *= (1.0 - age) * smoothstep(0.0, 0.08, age);
  }
  vec4 mvPosition = modelViewMatrix * vec4(c, 1.0);
  mvPosition.xy += q * step(0.01, a);
  vUv = uv; vKind = kind; vA = a; vSeed = seed;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FLAME_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
varying vec2 vUv; varying float vKind; varying float vA; varying float vSeed;
${SPRITE_NOISE}
void main() {
  vec3 col; float a;
  if (vKind < 0.5) {
    // Flame: wide and round at the foot, a tip on top; white-yellow core, orange, red edges.
    float y = vUv.y;
    float hw = pow(1.0 - y, 0.85) * (0.55 + 0.45 * smoothstep(0.0, 0.3, y));
    float e = abs(vUv.x - 0.5) * 2.0 / max(hw, 1e-3);
    float flick = vnoise(vec2(vUv.x * 3.0 + vSeed * 5.0, y * 4.0 - uTime * 5.0));
    a = (1.0 - smoothstep(0.55, 1.0, e + (flick - 0.5) * 0.5)) * (1.0 - smoothstep(0.7, 1.0, y));
    float heat = (1.0 - min(e, 1.0)) * (1.0 - y * 0.8);
    col = mix(vec3(0.85, 0.2, 0.05), vec3(1.0, 0.55, 0.12), smoothstep(0.05, 0.45, heat));
    col = mix(col, vec3(1.0, 0.92, 0.6), smoothstep(0.5, 0.85, heat));
  } else {
    float d = length(vUv - 0.5) * 2.0;
    a = pow(max(0.0, 1.0 - d), 1.5);
    col = vKind < 1.5 ? vec3(1.0, 0.36, 0.08) : vec3(1.0, 0.8, 0.35);
  }
  a *= vA;
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
  #include <fog_fragment>
}`;

/**
 * Live fire, all in one draw call and animated in the vertex shader: the altar fire in layers (a ring
 * of flickering tongues over glowing embers, sparks flying up) and a few sparks over each tent fire
 * at night (none in a winter without firewood). No lights: cheap on phones.
 */
export class Flames {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor(altar: THREE.Vector3 | null, tents: THREE.Vector3[]) {
    const at: number[] = [];
    const shape: number[] = [];
    const flags: number[] = [];
    const add = (p: THREE.Vector3, kind: number, seed: number, size: number, spread: number, always: number, house: number) => {
      at.push(p.x, p.y, p.z);
      shape.push(kind, seed, size, spread);
      flags.push(always, house);
    };
    if (altar) {
      // The tall one in the middle, smaller ones around it.
      for (let k = 0; k < TONGUES; k++) add(altar, 0, (k + 0.5) / TONGUES, k === 0 ? 0.8 : 0.42 + hash(k, 1) * 0.25, k === 0 ? 0 : 0.6 + hash(k, 2) * 0.8, 1, 0);
      for (let k = 0; k < EMBERS; k++) add(altar, 1, (k + 0.3) / EMBERS, 0.08 + hash(k, 3) * 0.05, 0.5 + hash(k, 4) * 0.5, 1, 0);
      for (let k = 0; k < ALTAR_SPARKS; k++) add(altar, 2, hash(k, 5), 0.05, 1, 1, 0);
    }
    tents.forEach((p, i) => {
      for (let k = 0; k < TENT_SPARKS; k++) add(p, 2, hash(i, k + 7), 0.035, 0.45, 0, 1);
    });
    const n = at.length / 3;
    const g = quads(n);
    g.setAttribute('aAt', new THREE.InstancedBufferAttribute(new Float32Array(at), 3));
    g.setAttribute('aShape', new THREE.InstancedBufferAttribute(new Float32Array(shape), 4));
    g.setAttribute('aFlags', new THREE.InstancedBufferAttribute(new Float32Array(flags), 2));
    this.material = new THREE.ShaderMaterial({
      vertexShader: FLAME_VERT,
      fragmentShader: FLAME_FRAG,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uNight: { value: 0 }, uCold: { value: 0 }, uRain: { value: 0 } }]),
      transparent: true,
      depthWrite: false,
      fog: true,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.visible = n > 0;
    this.mesh.renderOrder = 2;
  }

  update(time: number, night: number, rain: number, cold: boolean) {
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uNight.value = night;
    u.uRain.value = rain;
    u.uCold.value = cold ? 1 : 0;
  }
}

/**
 * Field hands: men and women bent over the crops, a few per field, more at the harvest and the
 * plowing (the count comes from fieldHands, pure and tested). They sway as they work.
 */
export class FieldHands {
  private figures: Figures;
  private spots: { x: number; y: number; z: number; phase: number }[] = [];

  constructor(fields: THREE.Vector3[], perField: number, shadows: boolean) {
    const rng = createRng(fields.length * 97 + 5);
    for (const f of fields)
      for (let k = 0; k < perField; k++) this.spots.push({ x: f.x + (rng() - 0.5) * 1.4, y: f.y + 0.05, z: f.z + (rng() - 0.5) * 1.4, phase: rng() * 6.28 });
    this.figures = new Figures(this.spots.length, shadows);
    this.spots.forEach((p, i) => this.figures.dress(i, figureLook(i % 2 ? 'f' : 'm', 'adult', p.phase / 6.28)));
  }

  get objects() {
    return this.figures.objects;
  }

  /** `perField` (0..max) people work each field now. */
  update(time: number, perField: number, max: number) {
    const share = Math.min(1, perField / Math.max(max, 1e-6));
    const shown = Math.round(this.spots.length * share);
    for (let i = 0; i < shown; i++) {
      const p = this.spots[i];
      const bend = 0.5 + Math.sin(time * 2 + p.phase) * 0.25;
      this.figures.place(i, p.x + Math.sin(time * 0.3 + p.phase) * 0.15, p.y, p.z, p.phase, bend);
    }
    this.figures.count = shown;
    this.figures.commit();
  }
}

const GLOW_VERT = /* glsl */ `
attribute float aPhase; attribute float aHouse;
uniform float uTime; uniform float uScale; uniform float uNight; uniform float uCold;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float f = 0.85 + 0.15 * sin(uTime * 11.0 + aPhase) * sin(uTime * 7.0 + aPhase * 2.0);
  vA = uNight * f * (1.0 - aHouse * uCold);
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
 * warm pool of light on the ground. All three fade in with the night. The tent fires (`house`) are
 * out in a winter without firewood (`s.cold`).
 */
export class NightFires {
  readonly objects: THREE.Object3D[];
  private flames: THREE.InstancedMesh;
  private glowMat: THREE.ShaderMaterial;
  private poolMat: THREE.MeshBasicMaterial;
  private pools: THREE.InstancedMesh;
  private tmp = new THREE.Object3D();
  private cold: boolean | null = null;
  private house: boolean[];

  /** `kinds`: a tent's fire (out in the cold) or the altar's (its flame is `Flames`: glow and pool only). */
  constructor(private spots: THREE.Vector3[], private kinds: ('tent' | 'altar' | undefined)[] = []) {
    const house = (this.house = spots.map((_, i) => kinds[i] === 'tent'));
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
    pts.setAttribute('aHouse', new THREE.Float32BufferAttribute(spots.map((_, i) => (house[i] ? 1 : 0)), 1));
    this.glowMat = new THREE.ShaderMaterial({
      vertexShader: GLOW_VERT,
      fragmentShader: GLOW_FRAG,
      uniforms: { uTime: { value: 0 }, uScale: { value: 900 }, uNight: { value: 0 }, uCold: { value: 0 }, uColor: { value: new THREE.Color(0xffa040) } },
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
    const pools = (this.pools = new THREE.InstancedMesh(disc, this.poolMat, n));
    pools.count = spots.length;
    this.setCold(false);
    this.objects = [this.flames, glow, pools];
  }

  /** The tent fires go out (their pools of light too) in a winter without firewood, and back. */
  private setCold(cold: boolean) {
    if (cold === this.cold) return;
    this.cold = cold;
    this.glowMat.uniforms.uCold.value = cold ? 1 : 0;
    this.spots.forEach((p, i) => {
      this.tmp.position.set(p.x, p.y + 0.06, p.z);
      this.tmp.rotation.set(0, 0, 0);
      this.tmp.scale.setScalar(cold && this.house[i] ? 0 : 1);
      this.tmp.updateMatrix();
      this.pools.setMatrixAt(i, this.tmp.matrix);
    });
    this.pools.instanceMatrix.needsUpdate = true;
  }

  /** `pixelRatio`: the glow size is in drawing-buffer pixels. */
  update(time: number, night: number, rain: number, pixelRatio: number, cold = false) {
    this.setCold(cold);
    // The rain dampens the fires outside.
    const k = night * (1 - 0.5 * rain);
    this.glowMat.uniforms.uTime.value = time;
    this.glowMat.uniforms.uScale.value = 450 * pixelRatio;
    this.glowMat.uniforms.uNight.value = k;
    this.poolMat.opacity = LOOK.night.tentPool * k;
    const show = k > 0.05;
    for (const o of this.objects) o.visible = show;
    if (!show) return;
    for (let i = 0; i < this.spots.length; i++) {
      const p = this.spots[i];
      const f = 0.8 + 0.25 * Math.sin(time * 13 + i) + 0.1 * Math.sin(time * 23 + i * 2);
      this.tmp.position.copy(p);
      this.tmp.rotation.set(0, time * 2 + i, 0);
      const out = (cold && this.house[i]) || this.kinds[i] === 'altar' ? 0 : 1;
      this.tmp.scale.set(k * out, f * k * out, k * out);
      this.tmp.updateMatrix();
      this.flames.setMatrixAt(i, this.tmp.matrix);
    }
    this.flames.instanceMatrix.needsUpdate = true;
  }
}

/**
 * Warm light on the ground before the door of every lived-in house, and in the yards of the market
 * and the workshop, at night (no real lights: additive discs, one draw call). They go out with the
 * windows late at night (`windows`, the share of lit houses).
 */
export class DoorLights {
  readonly mesh: THREE.InstancedMesh;
  private mat: THREE.MeshBasicMaterial;

  /** `spots`: x, y, z of the ground and the radius (w). */
  constructor(spots: THREE.Vector4[]) {
    const disc = new THREE.CircleGeometry(1, 20);
    disc.rotateX(-Math.PI / 2);
    this.mat = new THREE.MeshBasicMaterial({ color: 0xffa04a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, alphaMap: poolTexture() });
    this.mesh = new THREE.InstancedMesh(disc, this.mat, Math.max(1, spots.length));
    const tmp = new THREE.Object3D();
    spots.forEach((p, i) => {
      tmp.position.set(p.x, p.y + 0.05, p.z);
      tmp.scale.setScalar(p.w);
      tmp.updateMatrix();
      this.mesh.setMatrixAt(i, tmp.matrix);
    });
    this.mesh.count = spots.length;
    this.mesh.visible = false;
  }

  update(night: number, windows: number, rain: number) {
    const k = night * windows * (1 - 0.3 * rain);
    this.mat.opacity = LOOK.night.door * k;
    this.mesh.visible = this.mesh.count > 0 && k > 0.03;
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

interface Hauler {
  job: HaulJob;
  home: number;
  route: Pt[];
  seg: number;
  t: number;
  /** Heading out (a carrier with a sack to the store, a fisher to the bank, a gatherer to a tree). */
  out: boolean;
  wait: number;
  phase: number;
  pace: number;
}

/** Cells a second a worker walks at the usual pace. */
const HAUL_SPEED = 1.1;
/** Sacks and baskets: one material each for every rebuild of the people (never disposed). */
const LOAD_MATS = {
  sack: new THREE.MeshStandardMaterial({ color: 0xb08a58, roughness: 0.95, flatShading: true }),
  basket: new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.95, flatShading: true }),
};

/**
 * The people of the food buildings (haul.ts says who and where): harvest carriers with a sack on
 * the back to the granary and back empty-handed, the fisherman with his net basket at the river bank,
 * the gatherer with a basket on her head under a tree. Built with the people layer.
 */
export class Haulers {
  private list: Hauler[] = [];
  private figures: Figures;
  private sacks: THREE.InstancedMesh;
  private baskets: THREE.InstancedMesh;
  private rng: Rng;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private sc = new THREE.Vector3();

  constructor(private s: GameState, private ground: Terrain, shadows: boolean) {
    this.rng = createRng(s.week * 17 + 3);
    const jobs = haulJobs(s);
    const n = Math.max(1, jobs.length);
    this.figures = new Figures(n, shadows);
    const sack = new THREE.IcosahedronGeometry(0.075, 0);
    sack.scale(1, 1.25, 0.8);
    this.sacks = new THREE.InstancedMesh(sack, LOAD_MATS.sack, n);
    const basket = new THREE.CylinderGeometry(0.075, 0.055, 0.06, 8);
    this.baskets = new THREE.InstancedMesh(basket, LOAD_MATS.basket, n);
    for (const o of [this.sacks, this.baskets]) {
      o.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      o.castShadow = shadows;
      o.frustumCulled = false;
    }
    for (const { job, home } of jobs) {
      const i = this.list.length;
      const k = this.rng();
      this.figures.dress(i, figureLook(job === 'gather' ? 'f' : 'm', 'adult', k));
      this.list.push({ job, home, route: [], seg: 0, t: 0, out: true, wait: this.rng() * 2, phase: this.rng() * 6, pace: 0.9 + this.rng() * 0.2 });
      this.plan(this.list[i]);
    }
    this.figures.count = this.sacks.count = this.baskets.count = this.list.length;
  }

  get objects(): THREE.Object3D[] {
    return [...this.figures.objects, this.sacks, this.baskets];
  }

  /** Workers out now. */
  get count() {
    return this.list.length;
  }

  private plan(h: Hauler) {
    const b = this.s.buildings.find((o) => o.id === h.home);
    h.seg = 0;
    h.t = 0;
    h.route = b ? legOf(this.s, h.job, b, h.out, h.route, this.rng) : [];
    // Nowhere to go now (no road to a store): try again in a moment, not every frame.
    if (h.route.length < 2) {
      // Its building is gone (until the people are rebuilt): hidden, not in a corner of the map.
      h.route = b ? [{ x: b.x + b.w / 2, y: b.y + b.h / 2 }] : [];
      h.wait = 2;
    }
  }

  /** `speed` is the game speed: the workers stop when the game is paused. */
  update(dt: number, time: number, speed: number) {
    const run = speed > 0 ? 1 : 0;
    for (let i = 0; i < this.list.length; i++) {
      const h = this.list[i];
      const end = h.route.length - 1;
      if (h.seg >= end) {
        h.wait -= dt * run;
        if (h.wait <= 0) this.plan(h);
      } else {
        h.t += dt * run * HAUL_SPEED * HAUL.pace * h.pace;
        while (h.t >= 1 && h.seg < end) {
          h.t -= 1;
          h.seg++;
        }
        if (h.seg >= end) {
          h.t = 0;
          h.wait = waitAfter(h.job, h.out, this.rng);
          h.out = !h.out;
        }
      }
      this.draw(i, h, time, run > 0 && h.seg < h.route.length - 1);
    }
    this.figures.commit();
    this.sacks.instanceMatrix.needsUpdate = true;
    this.baskets.instanceMatrix.needsUpdate = true;
  }

  private draw(i: number, h: Hauler, time: number, walking: boolean) {
    if (!h.route.length) {
      this.figures.hide(i);
      this.load(this.sacks, i, false, 0, 0, 0, 0, 0, 0, 0);
      this.load(this.baskets, i, false, 0, 0, 0, 0, 0, 0, 0);
      return;
    }
    const a = h.route[Math.min(h.seg, h.route.length - 1)];
    const b = h.route[Math.min(h.seg + 1, h.route.length - 1)];
    const x = a.x + (b.x - a.x) * h.t;
    const z = a.y + (b.y - a.y) * h.t;
    // At work (the end of an outward leg) the figure faces the water or the tree.
    const last = h.route[h.route.length - 1];
    const prev = h.route[Math.max(0, h.route.length - 2)];
    const dx = walking ? b.x - a.x : last.x - prev.x;
    const dz = walking ? b.y - a.y : last.y - prev.y;
    const yaw = Math.atan2(dx, dz);
    const ph = time * 9 * h.pace + h.phase;
    const atWork = !walking && h.job !== 'harvest' && !h.out;
    // Walking: a bob and sway; at work, casting or reaching now and then.
    const lean = walking ? 0.06 : atWork ? Math.max(0, Math.sin(time * 1.6 + h.phase)) * (h.job === 'fish' ? 0.35 : -0.2) : 0;
    const y = this.ground.height(x, z) + 0.04 + (walking ? Math.abs(Math.sin(ph)) * 0.022 : 0);
    this.figures.place(i, x, y, z, yaw, lean, walking ? Math.sin(ph) * 0.06 : 0);
    const size = this.figures.look(i).size;
    // A sack on the back of a carrier heading out; a basket on the gatherer's head; the fisher's at his hip.
    const sack = h.job === 'harvest' && h.out;
    this.load(this.sacks, i, sack, x, y, z, yaw, 0, 0.3 * size, -0.09 * size);
    const basket = h.job !== 'harvest';
    this.load(this.baskets, i, basket, x, y, z, yaw, h.job === 'fish' ? 0.09 * size : 0, h.job === 'fish' ? 0.18 * size : 0.48 * size, 0);
  }

  /** Puts a load at a point of the figure (side `ox`, up `oy`, forward `oz`), or hides it. */
  private load(mesh: THREE.InstancedMesh, i: number, on: boolean, x: number, y: number, z: number, yaw: number, ox: number, oy: number, oz: number) {
    if (!on) {
      mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0));
      return;
    }
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    this.q.setFromAxisAngle(this.v.set(0, 1, 0), yaw);
    this.m.compose(this.v.set(x + sin * oz + cos * ox, y + oy, z + cos * oz - sin * ox), this.q, this.sc.setScalar(1));
    mesh.setMatrixAt(i, this.m);
  }
}
