import * as THREE from 'three';
import { indexOf, type GameState } from '../core';
import LOOK from './look3d.json';
import { patch, U } from './shaders';
import { moistMap } from './fields';
import { WEAR_RES } from './wear';

/** How far the ground extends around the map (cells), fading into the haze. */
export const SKIRT = 48;
/** Water surface height; river beds go below it. */
export const WATER_Y = -0.16;
const RELIEF = 0.9;
const RIVER_DEPTH = 0.55;


/** Smooth value noise (a few octaves of sines), 0..1. */
function relief(x: number, z: number, seed: number): number {
  const a = Math.sin(x * 0.13 + seed) * Math.cos(z * 0.11 - seed * 0.7);
  const b = Math.sin(x * 0.31 + z * 0.23 + seed * 1.3) * 0.45;
  const c = Math.sin(x * 0.7 - z * 0.53 + seed * 2.1) * 0.15;
  return (a + b + c + 1.6) / 3.2;
}

/** Cheap hash 0..1 for colour speckle. */
const hash = (x: number, z: number) => {
  const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return h - Math.floor(h);
};

/** Flatness an occupied cell gives each neighbour within 3 cells: (dx, dy, weight). */
const SPREAD: [number, number, number][] = [];
for (let dy = -3; dy <= 3; dy++)
  for (let dx = -3; dx <= 3; dx++) {
    const w = 1 - Math.max(0, Math.hypot(dx, dy) - 1) / 3;
    if (w > 0) SPREAD.push([dx, dy, w]);
  }

/**
 * The ground: one height field over the map and a wide skirt around it. Inside the city (roads,
 * buildings and two cells around them) the ground is flat; elsewhere it rolls gently. Cells outside
 * the map copy the nearest edge cell, so the river and the meadows run on into the haze.
 */
export class Terrain {
  private flat: Float32Array;

  constructor(private s: GameState, private seed: number) {
    this.flat = new Float32Array(s.cols * s.rows);
    this.flatten();
    this.setMoist();
  }

  /** The moist land by the river for the crops (the river does not move: once). */
  private moist: THREE.DataTexture | null = null;
  private setMoist() {
    const { cols, rows } = this.s;
    const m = moistMap(this.s);
    this.moist = new THREE.DataTexture(Uint8Array.from(m, (v) => Math.round(v * 255)), cols, rows, THREE.RedFormat);
    this.moist.magFilter = this.moist.minFilter = THREE.LinearFilter;
    this.moist.needsUpdate = true;
    U.uMoist.value = this.moist;
    U.uMapSize.value.set(cols, rows);
    U.uDryCrop.value.setHex(Number(LOOK.fields.dryCrop));
  }

  /** Flatness per cell: 1 on roads and buildings, fading out over two cells (again when the city changes). */
  flatten() {
    const s = this.s;
    const { cols, rows } = s;
    const flat = this.flat.fill(0);
    // Spread each occupied cell over its neighbours (the city is a small part of the map).
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const i = indexOf(s, x, y);
        if (!s.roads[i] && !s.grid[i]) continue;
        for (const [dx, dy, w] of SPREAD) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= cols || yy >= rows) continue;
          const j = indexOf(s, xx, yy);
          if (flat[j] < w) flat[j] = w;
        }
      }
  }

  private cell(x: number, y: number) {
    const cx = Math.min(this.s.cols - 1, Math.max(0, Math.floor(x)));
    const cy = Math.min(this.s.rows - 1, Math.max(0, Math.floor(y)));
    return indexOf(this.s, cx, cy);
  }

  /** Share of the four cells around a grid corner that are river (0..1). */
  private riverAt(x: number, z: number) {
    let n = 0;
    for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) if (this.s.ground[this.cell(x + dx, z + dz)] === 'river') n++;
    return n / 4;
  }

  /** The river (or its bed) runs here. */
  isRiver(x: number, z: number) {
    return this.riverAt(x, z) > 0;
  }

  private flatAt(x: number, z: number) {
    const inside = x >= 0 && z >= 0 && x < this.s.cols && z < this.s.rows;
    return inside ? this.flat[this.cell(x, z)] : 0;
  }

  /** Ground height at a world point (x along columns, z along rows). */
  height(x: number, z: number): number {
    const river = this.riverAt(x, z);
    const land = relief(x, z, this.seed) * RELIEF * (1 - this.flatAt(x, z)) * (1 - river);
    return land - river * RIVER_DEPTH;
  }

  private geometry: THREE.BufferGeometry | null = null;
  private wear: THREE.DataTexture | null = null;

  /** The trodden ground of the city now (wear.ts), into the terrain shader; again when the city changes. */
  setWear(map: Float32Array) {
    const { cols, rows } = this.s;
    const w = cols * WEAR_RES;
    const h = rows * WEAR_RES;
    if (!this.wear) {
      this.wear = new THREE.DataTexture(new Uint8Array(w * h), w, h, THREE.RedFormat);
      this.wear.magFilter = this.wear.minFilter = THREE.LinearFilter;
    }
    const data = this.wear.image.data as Uint8Array;
    for (let i = 0; i < map.length; i++) data[i] = Math.round(map[i] * 255);
    this.wear.needsUpdate = true;
    U.uWear.value = this.wear;
    U.uMapSize.value.set(cols, rows);
    U.uTrodden.value.setHex(Number(LOOK.wear.trodden));
  }

  private stand: THREE.DataTexture | null = null;

  /** Where the buildings stand now (wear.ts standMap), for the contact shadow; again when the city changes. */
  setStand(map: Uint8Array) {
    const { cols, rows } = this.s;
    if (!this.stand) {
      this.stand = new THREE.DataTexture(new Uint8Array(cols * rows), cols, rows, THREE.RedFormat);
      this.stand.magFilter = this.stand.minFilter = THREE.LinearFilter;
    }
    const data = this.stand.image.data as Uint8Array;
    for (let i = 0; i < map.length; i++) data[i] = map[i] * 255;
    this.stand.needsUpdate = true;
    U.uStand.value = this.stand;
  }

  dispose() {
    this.stand?.dispose();
    this.stand = null;
    this.wear?.dispose();
    this.wear = null;
    this.moist?.dispose();
    this.moist = null;
  }

  /**
   * The city changed (a road or a building came or went): the flat ground under the city follows,
   * moving only the heights of the mesh already built (only the map's vertices can change).
   */
  reshape() {
    const before = this.flat.slice();
    this.flatten();
    // A road on ground already flat (most of a drag through town) changes nothing.
    if (before.every((v, i) => v === this.flat[i])) return;
    const g = this.geometry;
    if (!g) return;
    const pos = g.attributes.position as THREE.BufferAttribute;
    const { cols, rows } = this.s;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      if (x < -1 || z < -1 || x > cols + 1 || z > rows + 1) continue;
      pos.setY(i, this.height(x, z));
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
  }

  /** Share of the four cells around a grid corner that are grass (0..1). */
  private grassAt(x: number, z: number) {
    let grass = 0;
    for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) if (this.s.ground[this.cell(x + dx, z + dz)] === 'grass') grass++;
    return grass / 4;
  }

  /**
   * The ground mesh: one vertex per cell corner over the map and the skirt. Each vertex carries
   * its grass share, river share and a speckle (aGround); the colours come from the season
   * uniforms in the shader, so seasons, drought and snow change the land with no CPU work.
   */
  mesh(): THREE.Mesh {
    const { cols, rows } = this.s;
    const w = cols + SKIRT * 2;
    const h = rows + SKIRT * 2;
    const g = new THREE.PlaneGeometry(w, h, w, h);
    g.rotateX(-Math.PI / 2);
    g.translate(cols / 2, 0, rows / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const ground = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, this.height(x, z));
      ground.set([this.grassAt(x, z), this.riverAt(x, z), hash(x, z)], i * 3);
    }
    g.setAttribute('aGround', new THREE.BufferAttribute(ground, 3));
    g.computeVertexNormals();
    this.geometry = g;
    const material = patch(new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }), { snow: true, terrain: true });
    const m = new THREE.Mesh(g, material);
    m.receiveShadow = true;
    return m;
  }
}

/** Procedural normal map of small ripples, tiled over the water. */
function rippleTexture(): THREE.DataTexture {
  const n = 128;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const u = (x / n) * Math.PI * 2;
      const v = (y / n) * Math.PI * 2;
      const dx = Math.cos(u * 3 + Math.sin(v * 2)) * 0.5 + Math.cos(u * 7 + v * 5) * 0.25;
      const dy = Math.cos(v * 4 + Math.sin(u * 3)) * 0.5 + Math.sin(v * 6 - u * 2) * 0.25;
      const i = (y * n + x) * 4;
      data[i] = 128 + dx * 60;
      data[i + 1] = 128 + dy * 60;
      data[i + 2] = 255;
      data[i + 3] = 255;
    }
  const t = new THREE.DataTexture(data, n, n);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(36, 36);
  t.needsUpdate = true;
  return t;
}

/** The river surface: one sheet over the map and the skirt; it only shows above the river bed. */
export class Water {
  readonly mesh: THREE.Mesh;
  private normal = rippleTexture();
  private material: THREE.MeshStandardMaterial;
  private flow = 0;

  constructor(s: GameState) {
    const g = new THREE.PlaneGeometry(s.cols + SKIRT * 2, s.rows + SKIRT * 2);
    g.rotateX(-Math.PI / 2);
    g.translate(s.cols / 2, WATER_Y, s.rows / 2);
    const material = (this.material = new THREE.MeshStandardMaterial({
      color: 0x3f8594,
      roughness: 0.12,
      metalness: 0.05,
      transparent: true,
      opacity: 0.88,
      normalMap: this.normal,
      normalScale: new THREE.Vector2(0.6, 0.6),
    }));
    // Sun glints (plano beleza C6): where a ripple mirrors the sun, a warm spark (strong when the sun is low).
    material.onBeforeCompile = (sh) => {
      sh.uniforms.uSunView = this.sunView;
      sh.uniforms.uGlint = this.glint;
      sh.uniforms.uTime = U.uTime;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uSunView; uniform float uGlint; uniform float uTime;')
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          vec3 rv = reflect(-normalize(vViewPosition), normal);
          float toSun = max(dot(rv, uSunView), 0.0);
          // A soft sheen toward the sun, and sparks that flicker on the ripples (a few pixels, a few times a second).
          vec2 cell = floor(gl_FragCoord.xy / 2.0) + floor(uTime * 5.0) * vec2(17.0, 31.0);
          float flick = step(0.955, fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453));
          float spark = pow(toSun, 40.0) * 0.8 + pow(toSun, 6.0) * flick * 4.5;
          totalEmissiveRadiance += vec3(1.0, 0.88, 0.62) * spark * uGlint;`,
        );
    };
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.receiveShadow = true;
  }

  private sunView = { value: new THREE.Vector3(0, 1, 0) };
  private glint = { value: 0 };

  /** The sun for the glints: its direction (world) seen from `camera`, and how strong they are (0..1). */
  sun(dir: { x: number; y: number; z: number }, camera: THREE.Camera, glint: number) {
    this.sunView.value.set(dir.x, dir.y, dir.z).normalize().transformDirection(camera.matrixWorldInverse);
    this.glint.value = glint;
  }

  /**
   * Ripples drift downstream (faster in wind and rain, rougher too); in a drought the river runs
   * lower (`drop`), uncovering its muddy bed; snow and rain grey the water.
   */
  update(t: number, dt: number, rain: number, wind: number, drop: number, tint: THREE.Color) {
    this.flow += dt * (0.05 + 0.08 * wind + 0.05 * rain);
    this.normal.offset.set(Math.sin(t * 0.3) * 0.02, -this.flow);
    const k = 0.6 + 0.6 * rain + 0.4 * wind;
    this.material.normalScale.set(k, k);
    this.material.roughness = 0.12 + 0.3 * rain;
    this.material.color.copy(tint);
    this.mesh.position.y = -drop;
  }
}
