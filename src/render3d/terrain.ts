import * as THREE from 'three';
import { indexOf, type GameState } from '../core';

/** How far the ground extends around the map (cells), fading into the haze. */
export const SKIRT = 48;
/** Water surface height; river beds go below it. */
export const WATER_Y = -0.16;
const RELIEF = 0.9;
const RIVER_DEPTH = 0.55;

const SAND = new THREE.Color(0xd8bd8a);
const SAND_DARK = new THREE.Color(0xc4a271);
const GRASS = new THREE.Color(0x8ea457);
const GRASS_DARK = new THREE.Color(0x6f8a43);
const MUD = new THREE.Color(0x8d7b5a);

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
    // Flatness per cell: 1 on roads and buildings, fading out over two cells.
    const { cols, rows } = s;
    const occ = new Float32Array(cols * rows);
    for (let i = 0; i < occ.length; i++) occ[i] = s.roads[i] || s.grid[i] ? 1 : 0;
    this.flat = new Float32Array(cols * rows);
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

  private color(x: number, z: number, out: THREE.Color) {
    let grass = 0;
    for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) if (this.s.ground[this.cell(x + dx, z + dz)] === 'grass') grass++;
    const r = hash(x, z);
    out.copy(SAND).lerp(SAND_DARK, r * 0.6);
    if (grass) out.lerp(new THREE.Color().copy(GRASS).lerp(GRASS_DARK, r), grass / 4);
    const river = this.riverAt(x, z);
    if (river) out.lerp(MUD, Math.min(1, river * 1.6));
    return out;
  }

  /** The ground mesh: one vertex per cell corner over the map and the skirt. */
  mesh(): THREE.Mesh {
    const { cols, rows } = this.s;
    const w = cols + SKIRT * 2;
    const h = rows + SKIRT * 2;
    const g = new THREE.PlaneGeometry(w, h, w, h);
    g.rotateX(-Math.PI / 2);
    g.translate(cols / 2, 0, rows / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, this.height(x, z));
      this.color(x, z, c);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
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

  constructor(s: GameState) {
    const g = new THREE.PlaneGeometry(s.cols + SKIRT * 2, s.rows + SKIRT * 2);
    g.rotateX(-Math.PI / 2);
    g.translate(s.cols / 2, WATER_Y, s.rows / 2);
    const material = new THREE.MeshStandardMaterial({
      color: 0x3f8594,
      roughness: 0.12,
      metalness: 0.05,
      transparent: true,
      opacity: 0.88,
      normalMap: this.normal,
      normalScale: new THREE.Vector2(0.6, 0.6),
    });
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.receiveShadow = true;
  }

  update(t: number) {
    this.normal.offset.set(Math.sin(t * 0.3) * 0.02, -t * 0.05);
  }
}
