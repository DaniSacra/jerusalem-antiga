import * as THREE from 'three';
import { indexOf, type GameState } from '../core';
import { patch } from './shaders';

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
  }

  /** Flatness per cell: 1 on roads and buildings, fading out over two cells (again when the city changes). */
  flatten() {
    const s = this.s;
    const { cols, rows } = s;
    const occ = new Float32Array(cols * rows);
    for (let i = 0; i < occ.length; i++) occ[i] = s.roads[i] || s.grid[i] ? 1 : 0;
    const R = 3;
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        let best = 0;
        for (let dy = -R; dy <= R; dy++)
          for (let dx = -R; dx <= R; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= cols || yy >= rows || !occ[indexOf(s, xx, yy)]) continue;
            best = Math.max(best, 1 - Math.max(0, Math.hypot(dx, dy) - 1) / R);
          }
        this.flat[indexOf(s, x, y)] = best;
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

  /**
   * The city changed (a road or a building came or went): the flat ground under the city follows,
   * moving only the heights of the mesh already built (only the map's vertices can change).
   */
  reshape() {
    this.flatten();
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
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.receiveShadow = true;
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
