import * as THREE from 'three';
import { createRng } from '../core';

/**
 * Shapes a particle can take: a rain streak along its fall, a round flake or mote facing the
 * camera, a tumbling leaf or petal, a splash ring flat on the ground.
 */
export type ParticleShape = 'streak' | 'dot' | 'leaf' | 'ring';

export interface ParticleOptions {
  count: number;
  shape: ParticleShape;
  /** Size of the quad (width, height) in world units. */
  size: [number, number];
  /** Box around the view centre the particles wrap in (x, y, z). */
  box: [number, number, number];
  /** Height of the box floor. */
  floor?: number;
  /** Fall speed (units per second), how much the wind carries them, side sway. */
  fall: number;
  drift: number;
  sway: number;
  colors: number[];
  opacity: number;
  additive?: boolean;
}

const VERT = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime; uniform vec3 uCenter; uniform vec3 uBox; uniform float uFloor;
uniform float uFall; uniform float uDrift; uniform float uSway; uniform float uWind; uniform float uAmount;
uniform vec2 uSize; uniform int uShape;
varying vec2 vUv; varying float vSeed; varying float vLife;
void main() {
  vUv = uv; vSeed = aSeed.w; vLife = 1.0;
  if (aSeed.w > uAmount) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec3 vel = vec3(uWind * uDrift, -uFall * (0.75 + 0.5 * aSeed.w), uWind * uDrift * 0.35);
  vec3 p;
  if (uShape == 3) {
    // Splash rings: born at random spots on the ground, they grow and fade.
    float cyc = uTime * (1.2 + aSeed.w) + aSeed.w * 13.0;
    float id = floor(cyc);
    vLife = fract(cyc);
    vec2 r = fract(vec2(sin(id * 12.9 + aSeed.x * 78.2), sin(id * 39.3 + aSeed.z * 11.1)) * 43758.5);
    p = vec3(uCenter.x + (r.x - 0.5) * uBox.x, uFloor + 0.03, uCenter.z + (r.y - 0.5) * uBox.z);
  } else {
    vec3 base = aSeed.xyz * uBox + vel * uTime;
    vec3 rel = mod(base - uCenter * vec3(1.0, 0.0, 1.0), uBox) - uBox * 0.5;
    p = vec3(uCenter.x + rel.x, uFloor + rel.y + uBox.y * 0.5, uCenter.z + rel.z);
    p.x += sin(uTime * 1.7 + aSeed.w * 40.0) * uSway;
    p.z += cos(uTime * 1.3 + aSeed.w * 30.0) * uSway;
  }
  vec3 corner = vec3((uv.x - 0.5) * uSize.x, (uv.y - 0.5) * uSize.y, 0.0);
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 wpos;
  if (uShape == 0) {
    vec3 along = normalize(vel);
    vec3 side = normalize(cross(along, normalize(cameraPosition - p)));
    wpos = p + side * corner.x + along * corner.y;
  } else if (uShape == 2) {
    float a = uTime * (2.0 + 3.0 * aSeed.w) + aSeed.x * 20.0;
    vec2 c = vec2(corner.x * cos(a * 0.7), corner.y);
    c = vec2(c.x * cos(a) - c.y * sin(a), c.x * sin(a) + c.y * cos(a));
    wpos = p + right * c.x + up * c.y;
  } else if (uShape == 3) {
    float s = 0.25 + vLife;
    wpos = p + vec3(corner.x * s, 0.0, corner.y * s);
  } else {
    wpos = p + right * corner.x + up * corner.y;
  }
  gl_Position = projectionMatrix * viewMatrix * vec4(wpos, 1.0);
}`;

const FRAG = /* glsl */ `
uniform vec3 uColors[4]; uniform float uOpacity; uniform float uLight; uniform int uShape;
varying vec2 vUv; varying float vSeed; varying float vLife;
void main() {
  vec2 q = vUv - 0.5;
  float a;
  if (uShape == 0) a = (1.0 - abs(q.x) * 2.0) * smoothstep(0.0, 0.5, vUv.y);
  else if (uShape == 3) { float r = length(q) * 2.0; a = smoothstep(0.75, 0.9, r) * (1.0 - smoothstep(0.9, 1.0, r)) * (1.0 - vLife); }
  else if (uShape == 2) a = 1.0 - smoothstep(0.3, 0.5, length(q * vec2(1.6, 1.0)));
  else a = 1.0 - smoothstep(0.15, 0.5, length(q));
  int k = int(floor(fract(vSeed * 7.31) * 4.0));
  vec3 c = k == 0 ? uColors[0] : k == 1 ? uColors[1] : k == 2 ? uColors[2] : uColors[3];
  gl_FragColor = vec4(c * uLight, a * uOpacity);
  if (gl_FragColor.a < 0.01) discard;
  #include <colorspace_fragment>
}`;

const SHAPES: Record<ParticleShape, number> = { streak: 0, dot: 1, leaf: 2, ring: 3 };

/**
 * A field of particles in a box that follows the view (rain, snow, leaves, petals, dust, splashes).
 * Positions are computed on the GPU from a seed and the time: one draw call and no CPU work per
 * particle. `amount` (0..1) shows that share of them.
 */
export class Particles {
  readonly mesh: THREE.Mesh;
  private u: Record<string, THREE.IUniform>;

  constructor(o: ParticleOptions, seed: number) {
    const quad = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = quad.index;
    g.setAttribute('position', quad.getAttribute('position'));
    g.setAttribute('uv', quad.getAttribute('uv'));
    const rng = createRng(seed);
    const seeds = new Float32Array(o.count * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = rng();
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    g.instanceCount = o.count;
    const colors = [0, 1, 2, 3].map((k) => new THREE.Color(o.colors[k % o.colors.length]));
    this.u = {
      uTime: { value: 0 },
      uCenter: { value: new THREE.Vector3() },
      uBox: { value: new THREE.Vector3(...o.box) },
      uFloor: { value: o.floor ?? 0 },
      uFall: { value: o.fall },
      uDrift: { value: o.drift },
      uSway: { value: o.sway },
      uWind: { value: 0 },
      uAmount: { value: 0 },
      uSize: { value: new THREE.Vector2(...o.size) },
      uShape: { value: SHAPES[o.shape] },
      uColors: { value: colors },
      uOpacity: { value: o.opacity },
      uLight: { value: 1 },
    };
    const m = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: this.u,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(g, m);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** Shows `amount` (0..1) of the particles around `centre`; `light` darkens them at night. */
  update(time: number, centre: THREE.Vector3, amount: number, wind: number, light: number, floor?: number) {
    this.mesh.visible = amount > 0.005;
    if (!this.mesh.visible) return;
    this.u.uTime.value = time;
    (this.u.uCenter.value as THREE.Vector3).copy(centre);
    this.u.uAmount.value = amount;
    this.u.uWind.value = wind;
    this.u.uLight.value = light;
    if (floor !== undefined) this.u.uFloor.value = floor;
  }

  /** Thins the field (low quality): only this share of the particles is ever drawn. */
  limit(share: number) {
    const g = this.mesh.geometry as THREE.InstancedBufferGeometry;
    const total = (g.getAttribute('aSeed') as THREE.InstancedBufferAttribute).count;
    g.instanceCount = Math.max(1, Math.round(total * share));
  }
}
