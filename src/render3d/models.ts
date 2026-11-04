import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { patch } from './shaders';

/**
 * Model library of the 3D proof of concept.
 *
 * Every model is a `Prototype`: a few geometries, each with one material, standing on y = 0 and
 * centred on the footprint of its building (w cells along x, h cells along z, 1 cell = 1 unit),
 * its front facing +z. The instancer draws every copy of a prototype in one draw call per part.
 *
 * The models below are provisional low-poly shapes built in code. A .glb model pack can replace any
 * of them by key (see `loadModelPack` and src/render3d/README.md).
 */
export interface Part {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}
export interface Prototype {
  parts: Part[];
}

export type ModelKey =
  | 'house-0' | 'house-1' | 'house-2' | 'house-3' | 'house-4'
  | 'field-0' | 'field-1' | 'field-2' | 'field-3'
  | 'plaza' | 'park' | 'fisher' | 'gatherer' | 'granary' | 'market' | 'workshop' | 'altar' | 'temple'
  | 'olive' | 'palm' | 'rock' | 'shrub' | 'road';

/** Footprint (cells) of each model key, used to fit .glb models. */
export const FOOTPRINT: Record<ModelKey, [number, number]> = {
  'house-0': [2, 2], 'house-1': [2, 2], 'house-2': [2, 2], 'house-3': [2, 2], 'house-4': [2, 2],
  'field-0': [2, 2], 'field-1': [2, 2], 'field-2': [2, 2], 'field-3': [2, 2],
  plaza: [2, 2], park: [2, 2], fisher: [2, 2], gatherer: [2, 2], granary: [3, 3],
  market: [2, 4], workshop: [3, 3], altar: [4, 4], temple: [6, 6],
  olive: [1, 1], palm: [1, 1], rock: [1, 1], shrub: [1, 1], road: [1, 1],
};

export const COLORS = {
  limestone: 0xeadfc8,
  limestoneDark: 0xcbb994,
  mud: 0xb8957a,
  mudDark: 0x957257,
  roofMud: 0xa68768,
  wood: 0x6e4a2c,
  dark: 0x3b2a20,
  goatHair: 0x4b3b31,
  cloth: 0xdccbaa,
  red: 0xb5462f,
  blue: 0x3f6e9e,
  green: 0x5f8a3a,
  ochre: 0xd29a3a,
  gold: 0xd9a93e,
  soil: 0x8a6440,
  wheat: 0xd8b65a,
  barley: 0xe2cf8c,
  lentil: 0x7f9a45,
  flax: 0x6f9a8a,
  leaf: 0x7f9257,
  leafDark: 0x5d7340,
  palm: 0x6f8f3a,
  trunk: 0x7a5a3a,
  rock: 0xb3a58c,
  water: 0x3d7c8c,
  hedge: 0x4f7234,
  grass: 0x84a14e,
  road: 0xab8f6a,
  fire: 0xff8a2a,
  flame: 0xffd36a,
} as const;

/** Crop colours of the four field variants (wheat, barley, lentil, flax). */
export const CROPS = [COLORS.wheat, COLORS.barley, COLORS.lentil, COLORS.flax] as const;

// ------------------------------------------------------------------ building blocks

const materials = new Map<string, THREE.Material>();

/**
 * Shared flat-shaded material per colour (emissive for fire), patched with the world effects:
 * snow on upward faces, wetness and cloud shadows; the dark of windows and doors glows at night,
 * the crops grow with the season.
 */
function mat(color: number, emissive = false): THREE.Material {
  const key = `${color}-${emissive}`;
  let m = materials.get(key);
  if (!m) {
    m = emissive
      ? new THREE.MeshBasicMaterial({ color })
      : patch(new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, flatShading: true }), {
          snow: true,
          windows: color === COLORS.dark,
          grow: (CROPS as readonly number[]).includes(color),
        });
    materials.set(key, m);
  }
  return m;
}

/** The shared material of a model colour (to recolour plants and crops with the season). */
export const materialOf = (color: number) => mat(color) as THREE.MeshStandardMaterial;

type Piece = { geo: THREE.BufferGeometry; color: number; emissive?: boolean };

/** Geometry with only position and normal, non-indexed, so every piece can be merged. */
function clean(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
  return n;
}

/** Box of size (sx, sy, sz) standing on y, centred on (x, z). */
const box = (sx: number, sy: number, sz: number, x: number, y: number, z: number, color: number, rotY = 0): Piece => {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  g.rotateY(rotY);
  g.translate(x, y + sy / 2, z);
  return { geo: g, color };
};
const cyl = (rTop: number, rBot: number, h: number, seg: number, x: number, y: number, z: number, color: number): Piece => {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg);
  g.translate(x, y + h / 2, z);
  return { geo: g, color };
};
const cone = (r: number, h: number, seg: number, x: number, y: number, z: number, color: number, rotY = 0): Piece => {
  const g = new THREE.ConeGeometry(r, h, seg);
  g.rotateY(rotY);
  g.translate(x, y + h / 2, z);
  return { geo: g, color };
};
/** Rounded blob (crowns, rocks, bushes) of radius r, squashed by sy. */
const blob = (r: number, x: number, y: number, z: number, color: number, sy = 1, detail = 0): Piece => {
  const g = new THREE.IcosahedronGeometry(r, detail);
  g.scale(1, sy, 1);
  g.translate(x, y, z);
  return { geo: g, color };
};

/** Merges the pieces by colour: one part (one draw call per instanced mesh) per material. */
function build(pieces: Piece[]): Prototype {
  const groups = new Map<string, { color: number; emissive: boolean; geos: THREE.BufferGeometry[] }>();
  for (const p of pieces) {
    const key = `${p.color}-${!!p.emissive}`;
    const g = groups.get(key) ?? { color: p.color, emissive: !!p.emissive, geos: [] };
    g.geos.push(clean(p.geo));
    groups.set(key, g);
  }
  return {
    parts: [...groups.values()].map((g) => ({ geometry: mergeGeometries(g.geos)!, material: mat(g.color, g.emissive) })),
  };
}

/** Low wall of `h` around a rectangle (w x d) with an optional gap on the front (+z). */
function walls(w: number, d: number, h: number, t: number, color: number, y = 0, frontGap = 0): Piece[] {
  const out = [box(w, h, t, 0, y, -d / 2 + t / 2, color), box(t, h, d, -w / 2 + t / 2, y, 0, color), box(t, h, d, w / 2 - t / 2, y, 0, color)];
  if (frontGap > 0) {
    const side = (w - frontGap) / 2;
    out.push(box(side, h, t, -w / 2 + side / 2, y, d / 2 - t / 2, color), box(side, h, t, w / 2 - side / 2, y, d / 2 - t / 2, color));
  } else out.push(box(w, h, t, 0, y, d / 2 - t / 2, color));
  return out;
}

// ------------------------------------------------------------------ the models

function plot(): Piece[] {
  // Empty plot: a foundation course and a pile of stones ready to build.
  return [...walls(1.4, 1.4, 0.12, 0.14, COLORS.limestoneDark), blob(0.16, 0.35, 0.08, 0.3, COLORS.rock, 0.6), blob(0.12, 0.15, 0.06, 0.4, COLORS.rock, 0.6)];
}

function tent(): Piece[] {
  // Goat-hair tent on poles, a rug and a fire ring.
  return [
    cone(0.95, 0.85, 4, 0, 0, -0.1, COLORS.goatHair, Math.PI / 4),
    box(0.7, 0.02, 0.5, 0.15, 0, 0.6, COLORS.red),
    cyl(0.16, 0.18, 0.06, 7, -0.55, 0, 0.6, COLORS.rock),
    cyl(0.03, 0.03, 1, 4, 0.7, 0, 0.55, COLORS.wood),
  ];
}

function mudHouse(): Piece[] {
  return [
    box(1.3, 0.8, 1.2, 0, 0, -0.1, COLORS.mud),
    box(1.42, 0.08, 1.32, 0, 0.8, -0.1, COLORS.roofMud),
    box(0.3, 0.5, 0.04, 0.2, 0, 0.51, COLORS.dark),
    box(0.16, 0.16, 0.04, -0.35, 0.45, 0.51, COLORS.dark),
    cyl(0.1, 0.08, 0.22, 6, -0.4, 0.88, -0.4, COLORS.mudDark),
    box(0.5, 0.35, 0.3, -0.45, 0, 0.7, COLORS.mudDark),
  ];
}

function stoneHouse(): Piece[] {
  return [
    box(1.5, 1.05, 1.3, 0, 0, -0.15, COLORS.limestone),
    box(1.56, 0.07, 1.36, 0, 1.05, -0.15, COLORS.limestoneDark),
    ...walls(1.5, 1.3, 0.16, 0.07, COLORS.limestone, 1.12).map((p) => (p.geo.translate(0, 0, -0.15), p)),
    box(0.32, 0.62, 0.04, -0.3, 0, 0.52, COLORS.wood),
    box(0.18, 0.2, 0.04, 0.35, 0.6, 0.52, COLORS.dark),
    // Outside stair to the roof.
    box(0.3, 0.3, 0.3, 0.6, 0, 0.7, COLORS.limestoneDark),
    box(0.3, 0.3, 0.3, 0.6, 0.3, 0.4, COLORS.limestoneDark),
    box(0.3, 0.45, 0.3, 0.6, 0.6, 0.12, COLORS.limestoneDark),
    // Striped awning over the door.
    box(0.6, 0.03, 0.35, -0.3, 0.72, 0.68, COLORS.red),
    cyl(0.12, 0.09, 0.26, 6, -0.5, 1.12, -0.55, COLORS.mudDark),
  ];
}

function bigHouse(): Piece[] {
  return [
    // Main two-storey block at the back, a wing on the left, a walled courtyard in front.
    box(1.75, 1.45, 0.95, 0, 0, -0.5, COLORS.limestone),
    box(1.8, 0.07, 1.0, 0, 1.45, -0.5, COLORS.limestoneDark),
    ...walls(1.75, 0.95, 0.18, 0.07, COLORS.limestone, 1.52).map((p) => (p.geo.translate(0, 0, -0.5), p)),
    box(0.65, 0.95, 0.9, -0.55, 0, 0.42, COLORS.limestone),
    box(0.7, 0.07, 0.95, -0.55, 0.95, 0.42, COLORS.limestoneDark),
    box(0.9, 0.35, 0.07, 0.42, 0, 0.88, COLORS.limestoneDark),
    box(0.07, 0.35, 0.9, 0.86, 0, 0.42, COLORS.limestoneDark),
    blob(0.25, 0.4, 0.55, 0.4, COLORS.leaf, 0.9),
    cyl(0.04, 0.05, 0.35, 5, 0.4, 0, 0.4, COLORS.trunk),
    // Rooftop pergola and windows.
    box(0.05, 0.4, 0.05, 0.55, 1.52, -0.75, COLORS.wood),
    box(0.05, 0.4, 0.05, 0.55, 1.52, -0.25, COLORS.wood),
    box(0.6, 0.04, 0.6, 0.55, 1.9, -0.5, COLORS.green),
    box(0.2, 0.22, 0.04, -0.3, 0.95, -0.01, COLORS.dark),
    box(0.2, 0.22, 0.04, 0.3, 0.95, -0.01, COLORS.dark),
    box(0.3, 0.55, 0.04, 0.0, 0, -0.01, COLORS.wood),
  ];
}

function field(crop: number): Piece[] {
  // Soil with plowed ridges (they show when the crop is low) and five rows of crop.
  const rows: Piece[] = [box(1.9, 0.05, 1.9, 0, 0, 0, COLORS.soil)];
  for (let k = 0; k < 5; k++) rows.push(box(0.2, 0.05, 1.7, -0.72 + k * 0.36, 0.03, 0, COLORS.soil), box(0.24, 0.22, 1.65, -0.72 + k * 0.36, 0.05, 0, crop));
  rows.push(cyl(0.02, 0.02, 0.6, 4, 0.9, 0, 0.9, COLORS.wood), box(0.3, 0.2, 0.05, 0.9, 0.45, 0.9, COLORS.cloth));
  return rows;
}

/** Plaza: a paved square with a well in the middle (the old well model). */
function plaza(): Piece[] {
  return [
    box(1.7, 0.05, 1.7, 0, 0, 0, COLORS.limestoneDark),
    cyl(0.45, 0.5, 0.45, 10, 0, 0.05, 0, COLORS.limestone),
    cyl(0.36, 0.36, 0.02, 10, 0, 0.48, 0, COLORS.water),
    box(0.07, 0.9, 0.07, -0.42, 0.05, 0, COLORS.wood),
    box(0.07, 0.9, 0.07, 0.42, 0.05, 0, COLORS.wood),
    box(0.95, 0.07, 0.07, 0, 0.95, 0, COLORS.wood),
    cyl(0.07, 0.06, 0.12, 6, 0.1, 0.6, 0, COLORS.wood),
    box(0.6, 0.18, 0.25, 0.3, 0.05, 0.65, COLORS.limestoneDark),
    cyl(0.1, 0.07, 0.25, 6, -0.6, 0.05, 0.55, COLORS.mudDark),
  ];
}

function market(): Piece[] {
  // Three stalls along z, each with a table, goods and a coloured canopy.
  const out: Piece[] = [box(1.9, 0.04, 3.9, 0, 0, 0, COLORS.limestoneDark)];
  const canopy = [COLORS.red, COLORS.blue, COLORS.ochre];
  const goods = [COLORS.ochre, COLORS.green, COLORS.red];
  for (let k = 0; k < 3; k++) {
    const z = -1.25 + k * 1.25;
    out.push(box(1.1, 0.4, 0.7, -0.2, 0.04, z, COLORS.wood));
    for (const [dx, dz] of [[-0.75, -0.45], [0.35, -0.45], [-0.75, 0.45], [0.35, 0.45]]) out.push(box(0.05, 0.95, 0.05, dx, 0.04, z + dz, COLORS.wood));
    const top = new THREE.BoxGeometry(1.3, 0.03, 1.0);
    top.rotateZ(-0.18);
    top.translate(-0.2, 1.02, z);
    out.push({ geo: top, color: canopy[k] });
    out.push(blob(0.12, -0.45, 0.52, z, goods[k], 0.7), blob(0.1, -0.15, 0.5, z + 0.15, goods[(k + 1) % 3], 0.7), cyl(0.09, 0.07, 0.2, 6, 0.1, 0.44, z - 0.15, COLORS.mudDark));
    out.push(cyl(0.12, 0.1, 0.25, 6, 0.65, 0.04, z, COLORS.mud));
  }
  return out;
}

function workshop(): Piece[] {
  return [
    box(1.7, 1.0, 1.3, -0.45, 0, -0.65, COLORS.mud),
    box(1.8, 0.07, 1.4, -0.45, 1.0, -0.65, COLORS.roofMud),
    box(0.35, 0.6, 0.04, -0.45, 0, 0.01, COLORS.dark),
    // Open shed with a work table.
    ...[[0.5, 0.2], [1.3, 0.2], [0.5, 1.2], [1.3, 1.2]].map(([x, z]) => box(0.07, 0.85, 0.07, x, 0, z, COLORS.wood)),
    box(1.0, 0.05, 1.2, 0.9, 0.85, 0.7, COLORS.cloth),
    box(0.6, 0.35, 0.4, 0.9, 0, 0.7, COLORS.wood),
    // Kiln, pots and a wood pile.
    blob(0.38, -0.9, 0.2, 0.75, COLORS.mudDark, 0.8, 1),
    cyl(0.1, 0.08, 0.22, 6, -0.25, 0, 0.9, COLORS.red),
    cyl(0.09, 0.07, 0.18, 6, -0.05, 0, 1.1, COLORS.ochre),
    box(0.6, 0.25, 0.3, 1.1, 0, -0.9, COLORS.trunk),
  ];
}

/** Park: a walled green with a fountain and trees (the old garden model). */
function park(): Piece[] {
  return [
    box(1.9, 0.05, 1.9, 0, 0, 0, COLORS.grass),
    ...walls(1.9, 1.9, 0.22, 0.14, COLORS.hedge, 0.05, 0.5),
    cyl(0.32, 0.34, 0.1, 10, 0, 0.05, 0, COLORS.limestone),
    cyl(0.27, 0.27, 0.02, 10, 0, 0.14, 0, COLORS.water),
    blob(0.28, -0.5, 0.6, -0.5, COLORS.leaf, 0.9),
    cyl(0.04, 0.05, 0.45, 5, -0.5, 0.05, -0.5, COLORS.trunk),
    blob(0.24, 0.5, 0.55, -0.5, COLORS.leafDark, 0.9),
    cyl(0.04, 0.05, 0.4, 5, 0.5, 0.05, -0.5, COLORS.trunk),
    ...[[-0.5, 0.45, COLORS.red], [0.5, 0.45, COLORS.ochre], [-0.25, 0.6, COLORS.flame], [0.3, 0.65, COLORS.red]].map(([x, z, c]) => box(0.14, 0.1, 0.14, x, 0.05, z, c)),
  ];
}

function altar(): Piece[] {
  return [
    box(3.6, 0.3, 3.6, 0, 0, 0, COLORS.limestoneDark),
    box(1.7, 0.85, 1.7, 0, 0.3, -0.2, COLORS.rock),
    ...[[-0.75, -0.95], [0.75, -0.95], [-0.75, 0.55], [0.75, 0.55]].map(([x, z]) => box(0.18, 0.18, 0.18, x, 1.15, z, COLORS.rock)),
    // Ramp up the south side.
    (() => {
      const g = new THREE.BoxGeometry(0.7, 0.08, 1.4);
      g.rotateX(-0.55);
      g.translate(0, 0.72, 1.05);
      return { geo: g, color: COLORS.rock };
    })(),
    cyl(0.4, 0.45, 0.08, 8, 0, 1.15, -0.2, COLORS.dark),
    cyl(0.22, 0.25, 0.18, 8, 1.3, 0.3, 1.2, COLORS.gold),
  ];
}

function temple(): Piece[] {
  return [
    box(5.9, 0.3, 5.9, 0, 0, 0, COLORS.limestoneDark),
    box(5.3, 0.25, 5.3, 0, 0.3, 0, COLORS.limestone),
    ...walls(5.3, 5.3, 0.55, 0.18, COLORS.limestone, 0.55, 1.2),
    // Sanctuary with a gold cornice, porch and two columns.
    box(2.0, 2.4, 3.0, 0, 0.55, -0.9, 0xf4ecdc),
    box(2.1, 0.14, 3.1, 0, 2.95, -0.9, COLORS.gold),
    box(1.4, 0.5, 0.8, 0, 2.95, -0.2, 0xf4ecdc),
    cyl(0.14, 0.14, 1.6, 8, -0.55, 0.55, 0.85, 0xf4ecdc),
    cyl(0.14, 0.14, 1.6, 8, 0.55, 0.55, 0.85, 0xf4ecdc),
    cyl(0.2, 0.17, 0.18, 8, -0.55, 2.15, 0.85, COLORS.gold),
    cyl(0.2, 0.17, 0.18, 8, 0.55, 2.15, 0.85, COLORS.gold),
    box(0.6, 1.1, 0.04, 0, 0.55, 0.61, COLORS.gold),
    // Bronze altar and basin in the court.
    box(0.9, 0.45, 0.9, -1.4, 0.55, 1.6, COLORS.ochre),
    cyl(0.35, 0.25, 0.3, 10, 1.4, 0.55, 1.6, COLORS.gold),
  ];
}

function olive(): Piece[] {
  return [
    cyl(0.06, 0.1, 0.42, 5, 0, 0, 0, COLORS.trunk),
    blob(0.36, 0, 0.62, 0, COLORS.leaf, 0.7),
    blob(0.24, 0.18, 0.72, 0.1, COLORS.leafDark, 0.75),
  ];
}

function palm(): Piece[] {
  const out: Piece[] = [];
  // Slightly bent trunk made of three segments.
  for (let k = 0; k < 3; k++) out.push(cyl(0.05 - k * 0.006, 0.065 - k * 0.006, 0.55, 5, k * 0.04, k * 0.55, 0, COLORS.trunk));
  for (let k = 0; k < 7; k++) {
    const g = new THREE.BoxGeometry(0.75, 0.03, 0.14);
    g.translate(0.38, 0, 0);
    g.rotateZ(-0.45);
    g.rotateY((k / 7) * Math.PI * 2);
    g.translate(0.12, 1.68, 0);
    out.push({ geo: g, color: COLORS.palm });
  }
  out.push(blob(0.08, 0.12, 1.6, 0.05, COLORS.ochre, 1));
  return out;
}

function fisher(): Piece[] {
  // Reed hut, drying rack with fish and a boat pulled up on the bank.
  return [
    box(1.0, 0.7, 0.9, -0.35, 0, -0.35, COLORS.mud),
    cone(0.8, 0.45, 4, -0.35, 0.7, -0.35, COLORS.roofMud, Math.PI / 4),
    box(0.26, 0.45, 0.04, -0.35, 0, 0.11, COLORS.dark),
    box(0.05, 0.6, 0.05, 0.35, 0, 0.1, COLORS.wood),
    box(0.05, 0.6, 0.05, 0.85, 0, 0.1, COLORS.wood),
    box(0.6, 0.04, 0.04, 0.6, 0.56, 0.1, COLORS.wood),
    ...[0.42, 0.56, 0.7, 0.84].map((x) => box(0.05, 0.16, 0.03, x, 0.38, 0.1, COLORS.limestoneDark)),
    (() => {
      const g = new THREE.CylinderGeometry(0.2, 0.2, 1.2, 8, 1, false, 0, Math.PI);
      g.rotateZ(Math.PI / 2);
      g.rotateX(Math.PI);
      g.translate(0.2, 0.2, 0.7);
      return { geo: g, color: COLORS.wood };
    })(),
  ];
}

function gatherer(): Piece[] {
  // Small hut, baskets of fruit and a ladder against a tree.
  return [
    box(0.9, 0.65, 0.8, -0.4, 0, -0.4, COLORS.mud),
    box(1.0, 0.07, 0.9, -0.4, 0.65, -0.4, COLORS.roofMud),
    box(0.24, 0.42, 0.04, -0.4, 0, 0.01, COLORS.dark),
    cyl(0.16, 0.12, 0.2, 7, 0.2, 0, 0.45, COLORS.wood),
    blob(0.12, 0.2, 0.22, 0.45, COLORS.leafDark, 0.6),
    cyl(0.14, 0.11, 0.18, 7, 0.55, 0, 0.6, COLORS.wood),
    blob(0.1, 0.55, 0.2, 0.6, COLORS.ochre, 0.6),
    cyl(0.06, 0.09, 0.5, 5, 0.5, 0, -0.45, COLORS.trunk),
    blob(0.34, 0.5, 0.7, -0.45, COLORS.leaf, 0.75),
  ];
}

function granary(): Piece[] {
  // Courtyard with three domed silos and a store house.
  return [
    box(2.9, 0.05, 2.9, 0, 0, 0, COLORS.limestoneDark),
    ...walls(2.9, 2.9, 0.4, 0.12, COLORS.mud, 0.05, 0.8),
    box(2.4, 1.1, 0.9, 0, 0.05, -0.85, COLORS.mud),
    box(2.5, 0.07, 1.0, 0, 1.15, -0.85, COLORS.roofMud),
    box(0.4, 0.6, 0.04, 0, 0.05, -0.39, COLORS.wood),
    ...[-0.75, 0, 0.75].map((x) => cyl(0.32, 0.36, 0.7, 10, x, 0.05, 0.45, COLORS.mudDark)),
    ...[-0.75, 0, 0.75].map((x) => blob(0.33, x, 0.75, 0.45, COLORS.roofMud, 0.7, 1)),
    box(0.4, 0.25, 0.3, 1.0, 0.05, 1.05, COLORS.cloth),
  ];
}

const rock = (): Piece[] => [blob(0.32, 0, 0.1, 0, COLORS.rock, 0.55), blob(0.18, 0.25, 0.05, 0.2, COLORS.limestoneDark, 0.6)];
const shrub = (): Piece[] => [blob(0.16, 0, 0.1, 0, COLORS.leafDark, 0.7)];
const road = (): Piece[] => [box(1, 0.04, 1, 0, 0, 0, COLORS.road)];


/** The provisional code-built models, by key. */
export function codeModels(): Record<ModelKey, Prototype> {
  return {
    'house-0': build(plot()),
    'house-1': build(tent()),
    'house-2': build(mudHouse()),
    'house-3': build(stoneHouse()),
    'house-4': build(bigHouse()),
    'field-0': build(field(CROPS[0])),
    'field-1': build(field(CROPS[1])),
    'field-2': build(field(CROPS[2])),
    'field-3': build(field(CROPS[3])),
    plaza: build(plaza()),
    park: build(park()),
    fisher: build(fisher()),
    gatherer: build(gatherer()),
    granary: build(granary()),
    market: build(market()),
    workshop: build(workshop()),
    altar: build(altar()),
    temple: build(temple()),
    olive: build(olive()),
    palm: build(palm()),
    rock: build(rock()),
    shrub: build(shrub()),
    road: build(road()),
  };
}

// ------------------------------------------------------------------ .glb model pack

/**
 * One entry of a model pack manifest (JSON): the .glb file (relative to the manifest), and
 * optionally a scale (default: fit the footprint), a turn in degrees and a vertical offset.
 */
export interface PackEntry {
  file: string;
  scale?: number;
  rotationDeg?: number;
  yOffset?: number;
}
export type PackManifest = Partial<Record<ModelKey, PackEntry>>;

/**
 * Loads a model pack: every key in the manifest replaces the code-built model of the same key.
 * Each .glb is flattened into parts (its meshes with their transforms baked, grouped by material),
 * centred on its footprint and standing on y = 0, so it is instanced like the provisional models.
 */
export async function loadModelPack(manifestUrl: string, base: Record<ModelKey, Prototype>): Promise<Record<ModelKey, Prototype>> {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const manifest = (await (await fetch(manifestUrl)).json()) as PackManifest;
  const loader = new GLTFLoader();
  const out = { ...base };
  for (const [key, entry] of Object.entries(manifest) as [ModelKey, PackEntry][]) {
    // A model for a building the proof does not draw yet (e.g. a newer pack) is kept for later.
    if (!FOOTPRINT[key]) {
      console.warn(`model pack: unknown key "${key}" skipped`);
      continue;
    }
    const url = new URL(entry.file, new URL(manifestUrl, location.href)).href;
    const gltf = await loader.loadAsync(url);
    out[key] = fromObject(gltf.scene, FOOTPRINT[key], entry);
  }
  return out;
}

function fromObject(root: THREE.Object3D, [w, h]: [number, number], entry: PackEntry): Prototype {
  root.updateMatrixWorld(true);
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    byMat.set(material, [...(byMat.get(material) ?? []), g]);
  });
  // Fit: centre on the footprint, feet on y = 0, scaled to the footprint unless a scale is given.
  const bounds = new THREE.Box3();
  for (const gs of byMat.values()) for (const g of gs) {
    g.computeBoundingBox();
    bounds.union(g.boundingBox!);
  }
  const size = bounds.getSize(new THREE.Vector3());
  // The turn comes first, so the fit uses the model's extent once turned (a long market turned 90°).
  const turn = ((entry.rotationDeg ?? 0) * Math.PI) / 180;
  const [c, sn] = [Math.abs(Math.cos(turn)), Math.abs(Math.sin(turn))];
  const sx = c * size.x + sn * size.z;
  const sz = sn * size.x + c * size.z;
  const k = entry.scale ?? Math.min(w / Math.max(sx, 1e-6), h / Math.max(sz, 1e-6)) * 0.95;
  const centre = bounds.getCenter(new THREE.Vector3());
  const fit = new THREE.Matrix4()
    .makeTranslation(0, entry.yOffset ?? 0, 0)
    .multiply(new THREE.Matrix4().makeRotationY(turn))
    .multiply(new THREE.Matrix4().makeScale(k, k, k))
    .multiply(new THREE.Matrix4().makeTranslation(-centre.x, -bounds.min.y, -centre.z));
  const parts: Part[] = [];
  for (const [material, geos] of byMat) {
    for (const g of geos) g.applyMatrix4(fit);
    // Bought models get the world effects too (snow, wetness, cloud shadows).
    if (material instanceof THREE.MeshStandardMaterial) patch(material);
    const merged = mergeGeometries(geos);
    if (merged) parts.push({ geometry: merged, material });
    else for (const g of geos) parts.push({ geometry: g, material });
  }
  return { parts };
}
