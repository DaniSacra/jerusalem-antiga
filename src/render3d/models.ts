import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { extraOf, footprintOf, hash as hashOf, KILN, SHELTER_AT, MIRRORED_KEYS, mirrorOf, MODEL_KEYS, type ExtraKey, type ModelKey } from './plan';
import { KIT_KEYS, type KitKey } from './kits';
import { COURT, PEN, SITE_KEYS } from './works';
import { paneMaterial, patch } from './shaders';
import LOOK from './look3d.json';

/** Side of a lit window pane with its halo (the lit core is about a third of it, see `paneMaterial`). */
const PANE_SIZE = 0.6;

export type { ModelKey };

/**
 * Model library of the 3D view.
 *
 * Every model is a `Prototype`: a few geometries, each with one material, standing on y = 0 and
 * centred on the footprint of its building (w cells along x, h cells along z, 1 cell = 1 unit),
 * its front facing +z. The instancer draws every copy of a prototype in one draw call per part.
 *
 * The models below are low-poly shapes built in code. A .glb model pack (the Meshy pack in
 * public/models/meshy) replaces some of them by key (see `loadModelPack` and src/render3d/README.md).
 */
export interface Part {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}
export interface Prototype {
  parts: Part[];
  /** From the .glb pack (its windows are lit by panes, see WINDOWS_AT). */
  glb?: boolean;
  /** Top of a .glb model once fitted (its chimney smoke leaves from there, not from inside it). */
  top?: number;
}

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
  /** The blue flower of the flax (grows and sways with the crop). */
  flaxFlower: 0x7f9ee0,
  /** Loose stones of a field's terrace wall. */
  rubble: 0xa89a80,
  leaf: 0x7f9257,
  leafDark: 0x5d7340,
  palm: 0x6f8f3a,
  /** Dates under the palm crown (sway with it). */
  dates: 0xc9902f,
  trunk: 0x7a5a3a,
  /** Conifer needles (a crown part, see `crownMaterial`: darker than the broadleaf crowns, green all year). */
  pine: 0x4a8a42,
  /** Wild flower heads (they sway with the grass, see `flowers`). */
  flowerBlue: 0x5f82ea,
  flowerWhite: 0xf8f6ec,
  flowerYellow: 0xf6d238,
  flowerOrange: 0xf28a26,
  flowerPink: 0xe880ac,
  /** Almond and fig crowns: recoloured by their state of the year (bloom, leaf, yellow; hidden bare, see the stage). */
  almondCrown: 0xf1dfe4,
  figCrown: 0x5e8a36,
  rock: 0xb3a58c,
  water: 0x3d7c8c,
  hedge: 0x4f7234,
  grass: 0x84a14e,
  road: 0xab8f6a,
  roadStone: 0xcdbfa2,
  roadJoint: 0x9c8c70,
  /** A road's dark edge (it reads from far away) and its wheel ruts. */
  roadEdge: 0x7d6448,
  roadRut: 0x93775a,
  /** Tufts of grass (tinted by the season like the grass, see the stage). */
  tuft: 0x6f9a3e,
  tuftDark: 0x4f7a2e,
  /** A road off the network: pale and grey, dashed (see `loose`). */
  roadLoose: 0x8a8070,
  paving: 0xd9cbad,
  sand: 0xd9bf8c,
  dryBush: 0x8f8456,
  fire: 0xff8a2a,
  flame: 0xffd36a,
  /** House kits (kits.ts): reed mats, figs drying, grapes, a tent's pale walls, white goats. */
  reed: 0xc2a66a,
  fig: 0x5a3550,
  grape: 0x5b3a6b,
  tentWall: 0xbdb391,
  goatWhite: 0xe6dccb,
  /** The kits' own walls, matched to the Meshy houses' textures (warmer than the code houses'). */
  kitMud: 0xa36d48,
  kitMudRoof: 0x8b5e3c,
  kitStone: 0xd8c7a6,
  kitStoneDark: 0xbca784,
} as const;

/** Colours of the plants that sway in the wind (trunks too, so a crown never leaves its trunk). */
const SWAYING: number[] = [COLORS.leaf, COLORS.leafDark, COLORS.palm, COLORS.dates, COLORS.trunk, COLORS.tuft, COLORS.tuftDark, COLORS.flowerBlue, COLORS.flowerWhite, COLORS.flowerYellow, COLORS.flowerOrange, COLORS.flowerPink];
/** Plants of many tones: each copy a little yellower or bluer (`PatchOptions.hue`). */
const HUED: number[] = [COLORS.leaf, COLORS.leafDark, COLORS.hedge, COLORS.palm, COLORS.tuft, COLORS.tuftDark];
const WIND = LOOK.wind;

/** Colours of the road surfaces (no snow settles on them). */
const ROAD_COLORS: number[] = [COLORS.road, COLORS.roadStone, COLORS.roadJoint, COLORS.roadLoose, COLORS.roadEdge, COLORS.roadRut];

/** Crop colours of the four field variants (wheat, barley, lentil, flax). */
export const CROPS = [COLORS.wheat, COLORS.barley, COLORS.lentil, COLORS.flax] as const;
/** What grows with the crop (`uGrow`) and sways in waves: the crops and the flax flowers. */
const GROWING: number[] = [...CROPS, COLORS.flaxFlower];

// ------------------------------------------------------------------ building blocks

const materials = new Map<string, THREE.Material>();

/**
 * Shared flat-shaded material per colour (emissive for fire), patched with the world effects:
 * snow on upward faces (not on roads), wetness and cloud shadows; the dark of windows and doors glows at night,
 * the crops grow with the season.
 */
function mat(color: number, emissive = false, cloth = false): THREE.Material {
  const key = `${color}-${emissive}${cloth ? '-cloth' : ''}`;
  let m = materials.get(key);
  if (!m) {
    const crop = GROWING.includes(color);
    m = emissive
      ? new THREE.MeshBasicMaterial({ color })
      : cloth
        ? // Cloth in the wind: washing on the lines, awnings and sails (see `Piece.cloth`).
          patch(new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0, flatShading: true }), { snow: true, cloth: true })
        : patch(new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, flatShading: true }), {
          // Trodden roads stay clear of snow, so the town still reads in winter.
          snow: !ROAD_COLORS.includes(color),
          windows: color === COLORS.dark,
          grow: crop,
          // Plants sway in the wind: trees by their height (the trunk with the crown), crops in waves.
          wind: crop ? WIND.crops : SWAYING.includes(color) ? WIND.trees : 0,
          waves: crop,
          hue: HUED.includes(color),
        });
    materials.set(key, m);
  }
  return m;
}

/** The shared material of a model colour (to recolour plants and crops with the season). */
export const materialOf = (color: number) => mat(color) as THREE.MeshStandardMaterial;

/**
 * A piece of a model, by colour. `cloth` moves in the wind in the vertex shader (no CPU): 'hang', a
 * cloth hanging from its top edge, swings along the wind more the lower it is; 'sail', an awning or
 * sail tied at its edges, billows in the middle.
 */
type Piece = { geo: THREE.BufferGeometry; color: number; emissive?: boolean; cloth?: 'hang' | 'sail'; tone?: number };

/**
 * A tree crown in one part: its lobes share one colour (`crownMaterial`, recoloured and hidden by
 * season in the stage) and differ by a shade in the vertices (`tone`, 1 light .. 0.7 dark), so a
 * two-tone crown is one draw call.
 */
const lobe = (r: number, x: number, y: number, z: number, color: number, tone: number, sy = 1, detail = 0): Piece => ({ ...blob(r, x, y, z, color, sy, detail), tone });

const crowns = new Map<number, THREE.MeshStandardMaterial>();
/** The material of the crowns of a colour (vertex shades times its colour; sways in the wind). */
export function crownMaterial(color: number): THREE.MeshStandardMaterial {
  let m = crowns.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, vertexColors: true, roughness: 0.92, metalness: 0, flatShading: true });
    patch(m, { snow: true, wind: WIND.trees, hue: true });
    crowns.set(color, m);
  }
  return m;
}

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
/** Box tilted by `rotZ` (planks, banners) and turned by `rotY`, centred on (x, y, z). */
const tilted = (sx: number, sy: number, sz: number, x: number, y: number, z: number, color: number, rotZ: number, rotY = 0): Piece => {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  g.rotateZ(rotZ);
  g.rotateY(rotY);
  g.translate(x, y, z);
  return { geo: g, color };
};
/** Rounded blob (crowns, rocks, bushes) of radius r, squashed by sy. */
const blob = (r: number, x: number, y: number, z: number, color: number, sy = 1, detail = 0): Piece => {
  const g = new THREE.IcosahedronGeometry(r, detail);
  g.scale(1, sy, 1);
  g.translate(x, y, z);
  return { geo: g, color };
};

/**
 * Colours that keep a material of their own: recoloured by the season in the stage (plants, grass,
 * soil), growing with the crop, or glowing at night (the dark of windows and doors).
 */
const OWN: number[] = [COLORS.leaf, COLORS.leafDark, COLORS.hedge, COLORS.palm, COLORS.grass, COLORS.tuft, COLORS.tuftDark, COLORS.soil, COLORS.dark, ...GROWING];

/**
 * Merges the pieces into as few parts as it can (one draw call per instanced mesh each): every
 * colour that lives on its own (OWN, fire, tree crowns) is one part with its shared material; the
 * rest takes its colour in the vertices and joins one part per kind of material (solid, cloth in the
 * wind, swaying wood, road), as the kits do. A plaza of ten colours costs two calls, not ten.
 */
function build(pieces: Piece[]): Prototype {
  const groups = new Map<string, { color: number; emissive: boolean; cloth: boolean; geos: THREE.BufferGeometry[] }>();
  const crown = new Map<number, THREE.BufferGeometry[]>();
  const painted: Piece[] = [];
  for (const p of pieces) {
    if (p.tone !== undefined) {
      // A crown lobe: its shade in the vertices, one part per crown colour.
      const geo = clean(p.geo);
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3).fill(p.tone), 3));
      crown.set(p.color, [...(crown.get(p.color) ?? []), geo]);
      continue;
    }
    if (!p.emissive && !OWN.includes(p.color)) {
      painted.push(p);
      continue;
    }
    const key = `${p.color}-${!!p.emissive}-${!!p.cloth}`;
    const g = groups.get(key) ?? { color: p.color, emissive: !!p.emissive, cloth: !!p.cloth, geos: [] };
    g.geos.push(p.cloth ? flapped(clean(p.geo), p.cloth) : clean(p.geo));
    groups.set(key, g);
  }
  return {
    parts: [
      ...buildKit(painted, true).parts,
      ...[...groups.values()].map((g) => ({ geometry: mergeGeometries(g.geos)!, material: mat(g.color, g.emissive, g.cloth) })),
      ...[...crown].map(([color, geos]) => ({ geometry: mergeGeometries(geos)!, material: crownMaterial(color) as THREE.Material })),
    ],
  };
}

/**
 * The wind weight of each vertex of a cloth (`aFlap`: x the hanging swing, y the sail's billow):
 * a hanging cloth 0 at its top edge, 1 at the hem; a sail 0 on its edges, 1 in the middle.
 */
function flapped(g: THREE.BufferGeometry, how: 'hang' | 'sail'): THREE.BufferGeometry {
  g.computeBoundingBox();
  const { min, max } = g.boundingBox!;
  const pos = g.attributes.position;
  const w = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    if (how === 'hang') w[i * 2] = (max.y - pos.getY(i)) / Math.max(1e-4, max.y - min.y);
    else {
      const u = (pos.getX(i) - min.x) / Math.max(1e-4, max.x - min.x);
      const v = (pos.getZ(i) - min.z) / Math.max(1e-4, max.z - min.z);
      w[i * 2 + 1] = 16 * u * (1 - u) * v * (1 - v);
    }
  }
  g.setAttribute('aFlap', new THREE.BufferAttribute(w, 2));
  return g;
}

/** A cloth hanging from its top edge at y + sy (washing, a banner), split so it can bend. */
const hanging = (sx: number, sy: number, sz: number, x: number, y: number, z: number, color: number): Piece => {
  const g = new THREE.BoxGeometry(sx, sy, sz, 1, 3, 2);
  g.translate(x, y + sy / 2, z);
  return { geo: g, color, cloth: 'hang' };
};
/** An awning or sail (thin box standing on y), split so its middle can billow; `rotZ` tilts it. */
const sail = (sx: number, sy: number, sz: number, x: number, y: number, z: number, color: number, rotZ = 0, rotX = 0): Piece => {
  const g = new THREE.BoxGeometry(sx, sy, sz, 4, 1, 4);
  g.rotateZ(rotZ);
  g.rotateX(rotX);
  g.translate(x, y + sy / 2, z);
  return { geo: g, color, cloth: 'sail' };
};

/** A round rod (pole, rope, rail) from `a` to `b`. */
const rod = (a: [number, number, number], b: [number, number, number], r: number, color: number, seg = 4): Piece => {
  const from = new THREE.Vector3(...a);
  const d = new THREE.Vector3(...b).sub(from);
  const g = new THREE.CylinderGeometry(r, r, d.length(), seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
  const m = from.addScaledVector(d, 0.5);
  g.translate(m.x, m.y, m.z);
  return { geo: g, color };
};

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
  // Empty plot, ready to build: a foundation course, a pile of stones, the corner stakes with the
  // builder's line between them, a wooden sledge for the stones and a mallet (all wood: one part more).
  const wood = COLORS.wood;
  return [
    ...walls(1.4, 1.4, 0.12, 0.14, COLORS.limestoneDark),
    blob(0.16, 0.35, 0.08, 0.3, COLORS.rock, 0.6),
    blob(0.12, 0.15, 0.06, 0.4, COLORS.rock, 0.6),
    ...[[-0.82, -0.82], [0.82, -0.82], [-0.82, 0.82], [0.82, 0.82]].map(([x, z]) => box(0.04, 0.3, 0.04, x, 0, z, wood)),
    ...walls(1.64, 1.64, 0.012, 0.012, wood, 0.26),
    box(0.62, 0.04, 0.3, -0.3, 0.02, 0.45, wood, 0.3),
    box(0.04, 0.03, 0.34, -0.62, 0.03, 0.38, wood, 0.3),
    box(0.04, 0.03, 0.34, 0.0, 0.03, 0.52, wood, 0.3),
    box(0.12, 0.08, 0.08, 0.45, 0, -0.35, wood),
    box(0.03, 0.03, 0.28, 0.45, 0.03, -0.2, wood),
  ];
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
    sail(0.6, 0.03, 0.35, -0.3, 0.72, 0.68, COLORS.red),
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

/**
 * A field on its terrace (plano beleza C6): soil with plowed ridges, a low wall of loose stones round
 * it with grass tufts at its foot, a scarecrow pole with a rag, and five rows of the crop, drawn by
 * kind: wheat in upright clumps with ears, barley bowed under its beards, lentil in low round bushes,
 * flax in thin stems with blue flowers. Crops grow, dry and sway in the shader (see `GROW_CHUNK`).
 */
function field(crop: number): Piece[] {
  let seed = crop % 9973;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const out: Piece[] = [box(1.9, 0.05, 1.9, 0, 0, 0, COLORS.soil)];
  // Barley and flax fields are fenced with wood (posts and two rails, a gap for the gate on the front),
  // the others keep the terrace wall of stones: side by side the fields make a patchwork.
  const fenced = crop === CROPS[1] || crop === CROPS[3];
  if (fenced)
    for (const side of [0, 1, 2, 3]) {
      const rot = (side * Math.PI) / 2;
      const at = (a: number, d: number) => [Math.cos(rot) * a - Math.sin(rot) * d, Math.sin(rot) * a + Math.cos(rot) * d] as const;
      for (let k = 0; k < 5; k++) {
        const [x, z] = at(-0.9 + k * 0.45, 0.94);
        out.push(box(0.07, 0.3 + rnd() * 0.05, 0.07, x, 0, z, COLORS.wood));
      }
      // The front (+z, side 0) leaves a gate gap in the middle.
      for (const h of [0.13, 0.24]) {
        for (const [a0, a1] of side === 0 ? [[-0.9, -0.2], [0.2, 0.9]] : [[-0.9, 0.9]]) {
          const [x, z] = at((a0 + a1) / 2, 0.94);
          out.push(box(Math.abs(a1 - a0), 0.035, 0.035, x, h, z, COLORS.wood, rot));
        }
      }
    }
  // The terrace wall: four stones a side, a little uneven, leaving the corners open.
  for (const side of fenced ? [] : [0, 1, 2, 3]) {
    const rot = (side * Math.PI) / 2;
    for (let k = 0; k < 4; k++) {
      const a = -0.66 + k * 0.44 + (rnd() - 0.5) * 0.06;
      const h = 0.08 + rnd() * 0.05;
      const [x, z] = [Math.cos(rot) * a - Math.sin(rot) * 0.93, Math.sin(rot) * a + Math.cos(rot) * 0.93];
      out.push(box(0.38 + rnd() * 0.06, h, 0.12, x, 0, z, COLORS.rubble, rot + (rnd() - 0.5) * 0.12));
    }
  }
  // Grass at the foot of the wall, at the corners.
  for (const [x, z] of [[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95]]) out.push(cone(0.09, 0.16, 4, x, 0, z, COLORS.tuft, rnd()));
  const kind = CROPS.indexOf(crop as (typeof CROPS)[number]);
  for (let r = 0; r < 5; r++) {
    const x = -0.72 + r * 0.36;
    out.push(box(0.2, 0.05, 1.7, x, 0.03, 0, COLORS.soil));
    const n = kind === 2 ? 6 : 8;
    for (let k = 0; k < n; k++) {
      const z = -0.74 + (k + 0.5) * (1.48 / n) + (rnd() - 0.5) * 0.06;
      const jx = x + (rnd() - 0.5) * 0.06;
      if (kind === 0) {
        // Wheat: an upright clump, its ear a darker tip.
        out.push(cone(0.08, 0.3, 4, jx, 0.05, z, crop, rnd()), cone(0.035, 0.12, 3, jx + 0.02, 0.28, z, crop));
      } else if (kind === 1) {
        // Barley: the clump bows, its beards hang to one side.
        const g = new THREE.ConeGeometry(0.075, 0.32, 4);
        g.translate(0, 0.16, 0);
        g.rotateZ(0.32 + rnd() * 0.15);
        g.rotateY(rnd() * 0.6 - 0.3);
        g.translate(jx, 0.05, z);
        out.push({ geo: g, color: crop });
      } else if (kind === 2) {
        // Lentil: a low round bush.
        out.push(blob(0.11, jx, 0.12, z, crop, 0.65));
      } else {
        // Flax: two thin stems, a blue flower on each.
        for (const d of [-0.04, 0.04]) out.push(cyl(0.012, 0.018, 0.34, 3, jx + d, 0.05, z + d, crop), box(0.05, 0.035, 0.05, jx + d, 0.38, z + d, COLORS.flaxFlower));
      }
    }
  }
  out.push(cyl(0.02, 0.02, 0.6, 4, 0.9, 0, 0.9, COLORS.wood), hanging(0.3, 0.2, 0.05, 0.9, 0.45, 0.9, COLORS.cloth));
  return out;
}

/**
 * Plaza: an open square paved with pale flagstones in two tones (it must never read as a tent:
 * nothing tall but a shade tree), a stone well-head in the middle, benches along two sides and jars.
 */
function plaza(): Piece[] {
  const out: Piece[] = [box(1.92, 0.03, 1.92, 0, 0, 0, COLORS.limestoneDark)];
  const n = 4;
  const cell = 1.84 / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const x = -0.92 + cell * (i + 0.5);
      const z = -0.92 + cell * (j + 0.5);
      if (Math.abs(x) < 0.4 && Math.abs(z) < 0.4) continue;
      out.push(box(cell - 0.04, 0.03, cell - 0.04, x, 0.02, z, (i + j) % 2 ? COLORS.limestone : COLORS.paving));
    }
  // Round paving and, in the middle, an ochre linen awning on four poles over a mat and a jar
  // (no well nor fountain: the design keeps water out of the square).
  out.push(cyl(0.42, 0.42, 0.03, 12, 0, 0.02, 0, COLORS.paving));
  for (const [x, z] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]]) out.push(box(0.035, 0.62, 0.035, x, 0.04, z, COLORS.wood));
  out.push(sail(0.66, 0.025, 0.66, 0, 0.66, 0, COLORS.ochre), box(0.44, 0.012, 0.32, 0, 0.05, 0, COLORS.red), cyl(0.05, 0.04, 0.13, 6, 0.12, 0.05, 0.05, COLORS.mudDark));
  // Benches along the back and the left side; a long stone seat; jars by the awning.
  out.push(box(1.0, 0.1, 0.18, 0.15, 0.04, -0.78, COLORS.limestoneDark), box(0.18, 0.1, 0.8, -0.78, 0.04, 0.25, COLORS.limestoneDark));
  out.push(box(0.42, 0.1, 0.16, 0.55, 0.04, 0.45, COLORS.limestoneDark));
  out.push(cyl(0.06, 0.045, 0.16, 6, 0.36, 0.04, 0.12, COLORS.mudDark), cyl(0.05, 0.04, 0.13, 6, 0.42, 0.04, -0.06, COLORS.red));
  // A fig tree giving shade in the back corner.
  out.push(cyl(0.04, 0.06, 0.5, 5, -0.66, 0.04, -0.62, COLORS.trunk), blob(0.3, -0.66, 0.66, -0.62, COLORS.leaf, 0.7), blob(0.2, -0.5, 0.74, -0.5, COLORS.leafDark, 0.7));
  return out;
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
    out.push(sail(1.3, 0.03, 1.0, -0.2, 1.005, z, canopy[k], -0.18));
    out.push(blob(0.12, -0.45, 0.52, z, goods[k], 0.7), blob(0.1, -0.15, 0.5, z + 0.15, goods[(k + 1) % 3], 0.7), cyl(0.09, 0.07, 0.2, 6, 0.1, 0.44, z - 0.15, COLORS.mudDark));
    out.push(cyl(0.12, 0.1, 0.25, 6, 0.65, 0.04, z, COLORS.mud));
  }
  return out;
}

function workshop(): Piece[] {
  // Laid out like the Meshy model: a tall workroom at the back left (the level 2–3 room stands on
  // its roof at 1.6), a domed kiln on the right, a shed and pots in front.
  return [
    box(1.0, 1.6, 1.0, -0.85, 0, -0.85, COLORS.mud),
    box(1.1, 0.07, 1.1, -0.85, 1.55, -0.85, COLORS.roofMud),
    box(0.35, 0.6, 0.04, -0.85, 0, -0.34, COLORS.dark),
    box(1.6, 1.0, 0.25, 0.55, 0, -1.2, COLORS.mud),
    // Open shed with a work table.
    ...[[-1.3, 0.3], [0.3, 0.3], [-1.3, 1.2], [0.3, 1.2]].map(([x, z]) => box(0.07, 0.85, 0.07, x, 0, z, COLORS.wood)),
    sail(1.7, 0.05, 1.0, -0.5, 0.85, 0.75, COLORS.cloth),
    box(0.6, 0.35, 0.4, -0.5, 0, 0.75, COLORS.wood),
    // Kiln, pots and a wood pile.
    blob(0.32, KILN[0], 0.2, KILN[1], COLORS.mudDark, 0.9, 1),
    cyl(0.1, 0.08, 0.22, 6, 0.55, 0, 0.6, COLORS.red),
    cyl(0.09, 0.07, 0.18, 6, 0.85, 0, 0.75, COLORS.ochre),
    box(0.6, 0.25, 0.3, 1.0, 0, -0.75, COLORS.trunk),
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

/** The street lamp (plano-dificuldade D): a stone foot, a wooden post and a clay lamp (its flame is the night glow while lit, `NightFires`). */
function lamp(): Piece[] {
  return [
    cyl(0.16, 0.2, 0.12, 8, 0, 0, 0, COLORS.limestone),
    cyl(0.04, 0.05, 0.85, 6, 0, 0.12, 0, COLORS.trunk),
    box(0.3, 0.04, 0.06, 0, 0.92, 0, COLORS.trunk),
    cyl(0.07, 0.05, 0.08, 8, 0.12, 0.84, 0, COLORS.ochre),
  ];
}

/**
 * The tannery (plano-dificuldade E, 2 x 2): a mud shed with a flat roof and a brown awning at the
 * back, hides stretched on two frames and three soaking vats in the yard.
 */
const HIDE = 0x9a6a3a;
function tannery(): Piece[] {
  return [
    box(1.1, 0.7, 0.85, -0.38, 0, -0.45, COLORS.mud),
    box(1.2, 0.07, 0.95, -0.38, 0.7, -0.45, COLORS.roofMud),
    box(0.26, 0.45, 0.04, -0.38, 0, -0.01, COLORS.dark),
    sail(0.7, 0.025, 0.55, 0.55, 0.62, -0.55, 0x7a5236),
    ...[[0.25, -0.8], [0.85, -0.8], [0.25, -0.3], [0.85, -0.3]].map(([x, z]) => box(0.035, 0.62, 0.035, x, 0, z, COLORS.wood)),
    // Hides on frames.
    ...[-0.1, 0.55].flatMap((x) => [
      box(0.04, 0.55, 0.04, x - 0.22, 0, 0.55, COLORS.wood),
      box(0.04, 0.55, 0.04, x + 0.22, 0, 0.55, COLORS.wood),
      box(0.48, 0.04, 0.04, x, 0.53, 0.55, COLORS.wood),
      box(0.4, 0.4, 0.02, x, 0.1, 0.55, HIDE),
    ]),
    // Soaking vats.
    ...[[-0.75, 0.3], [-0.75, 0.72], [0.75, 0.05]].flatMap(([x, z]) => [cyl(0.15, 0.13, 0.2, 8, x, 0, z, COLORS.mudDark), cyl(0.12, 0.12, 0.01, 8, x, 0.19, z, 0x5a3a22)]),
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

/**
 * The Temple, the most beautiful building in the city (6x6 cells): a platform in two steps with a stair
 * at the front, a paved court inside a low wall with a gatehouse, the tall sanctuary at the back (the
 * porch taller than the hall, side chambers, flat roofs with a gold cornice: no pediment, no
 * battlements), the two free bronze columns before the porch, the bronze sea and the altar of rough
 * stones in the court. Five colours: five parts.
 */
function temple(): Piece[] {
  const white = 0xf4ecdc;
  const bronze = COLORS.ochre;
  const { limestone: stone, limestoneDark: dark, gold } = COLORS;
  const back = (p: Piece) => (p.geo.translate(0, 0, -0.3), p);
  const court = 0.45;
  /** A flat roof: a limestone slab with a thin gold cornice around its edge. */
  const roof = (w: number, d: number, y: number, z: number): Piece[] => [
    box(w + 0.06, 0.08, d + 0.06, 0, y, z, stone),
    ...walls(w + 0.1, d + 0.1, 0.1, 0.07, gold, y + 0.04).map((p) => (p.geo.translate(0, 0, z), p)),
  ];
  return [
    // Platform: a full lower step, the court raised on it, and a stair up the front.
    box(5.95, 0.22, 5.95, 0, 0, 0, dark),
    box(5.6, 0.23, 5.0, 0, 0.22, -0.3, stone),
    box(1.4, 0.115, 0.4, 0, 0.22, 2.4, stone),
    box(1.4, 0.23, 0.2, 0, 0.22, 2.3, stone),
    // Joints of the paving.
    ...[-1.6, -0.5, 0.6, 1.7].map((z) => box(5.4, 0.006, 0.035, 0, court, z, dark)),
    ...[-1.9, -0.65, 0.65, 1.9].map((x) => box(0.035, 0.006, 4.8, x, court, -0.3, dark)),
    // The court's wall, open at the gate, and the gatehouse: two towers and a lintel, gold on top.
    ...walls(5.6, 5.0, 0.5, 0.16, stone, court, 1.4).map(back),
    ...[-0.95, 0.95].flatMap((x) => [box(0.5, 1.25, 0.5, x, court, 2.0, white), box(0.54, 0.06, 0.54, x, court + 1.25, 2.0, gold)]),
    box(1.9, 0.28, 0.42, 0, court + 0.97, 2.0, white),
    // The sanctuary: the hall, the side chambers along it, the tall porch in front, gold cornices and doors.
    box(1.9, 2.0, 2.6, 0, court, -1.35, white),
    ...roof(1.9, 2.6, court + 2.0, -1.35),
    // Narrow windows high on the hall, above the side chambers.
    ...[-0.95, 0.95].flatMap((x) => [-2.2, -1.35, -0.5].map((z) => box(0.04, 0.38, 0.13, x, court + 1.42, z, dark))),
    ...[-1.18, 1.18].flatMap((x) => [box(0.45, 1.25, 2.4, x, court, -1.4, stone), box(0.49, 0.06, 2.44, x, court + 1.25, -1.4, dark)]),
    box(2.3, 2.8, 0.7, 0, court, 0.25, white),
    ...roof(2.3, 0.7, court + 2.8, 0.25),
    // Pilasters on the porch front and a band of stone above the doors.
    ...[-1.08, -0.42, 0.42, 1.08].map((x) => box(0.14, 2.8, 0.05, x, court, 0.62, stone)),
    box(2.3, 0.1, 0.06, 0, court + 1.38, 0.62, stone),
    box(0.62, 1.15, 0.04, 0, court, 0.61, gold),
    ...[-0.62, 0.62].map((x) => box(0.12, 0.42, 0.03, x, court + 1.7, 0.61, bronze)),
    // The two free columns of bronze before the porch, with bowl capitals.
    ...[-0.78, 0.78].flatMap((x) => [cyl(0.13, 0.15, 1.95, 10, x, court, 1.0, bronze), cyl(0.23, 0.14, 0.3, 10, x, court + 1.95, 1.0, gold)]),
    // The bronze sea on its base (front right) and the altar of rough stones with its ramp (front left).
    box(0.72, 0.16, 0.72, 1.55, court, 1.25, dark),
    cyl(0.55, 0.4, 0.36, 12, 1.55, court + 0.16, 1.25, bronze),
    box(1.0, 0.55, 1.0, -1.55, court, 1.15, dark),
    ...[-0.4, 0.4].flatMap((dx) => [-0.4, 0.4].map((dz) => box(0.14, 0.14, 0.14, -1.55 + dx, court + 0.55, 1.15 + dz, dark))),
    (() => {
      const g = new THREE.BoxGeometry(0.42, 0.06, 0.9);
      g.rotateX(0.55);
      g.translate(-1.55, court + 0.27, 1.95);
      return { geo: g, color: dark };
    })(),
  ];
}

// ------------------------------------------------------------------ the Temple in stages (works.ts)

/**
 * The Temple's stages, front +z, built like the consecrated `temple()` but without its gold, sea and
 * altar: the platform (Alicerce), the court, its wall and gatehouse and the roofless sanctuary
 * (Paredes), the porch, the columns and the roofs (Pórtico e telhado). Drawn as one part each (the
 * colours in the vertices, see ONE_PART), so a stage costs one draw call.
 */
const SITE = {
  white: 0xf4ecdc,
  /** Fresh-cut stone of the works (paler than the weathered limestone). */
  fresh: 0xe9dcc0,
  /** Scaffold poles and planks: light new timber, so they read against the stone. */
  timber: 0xa07a4e,
  rope: 0xcdb48a,
} as const;

function templePlatform(): Piece[] {
  const { limestone: stone, limestoneDark: dark } = COLORS;
  return [
    box(5.95, 0.22, 5.95, 0, 0, 0, dark),
    box(5.6, 0.23, 5.0, 0, 0.22, -0.3, stone),
    box(1.4, 0.115, 0.4, 0, 0.22, 2.4, stone),
    box(1.4, 0.23, 0.2, 0, 0.22, 2.3, stone),
    ...[-1.6, -0.5, 0.6, 1.7].map((z) => box(5.4, 0.006, 0.035, 0, COURT, z, dark)),
    ...[-1.9, -0.65, 0.65, 1.9].map((x) => box(0.035, 0.006, 4.8, x, COURT, -0.3, dark)),
  ];
}

/** Paredes: the court's wall and gatehouse, the hall's walls open to the sky, the side chambers. */
function templeWalls(): Piece[] {
  const { limestone: stone, limestoneDark: dark } = COLORS;
  const back = (p: Piece) => (p.geo.translate(0, 0, -0.3), p);
  const at = (z: number) => (p: Piece) => (p.geo.translate(0, 0, z), p);
  return [
    ...walls(5.6, 5.0, 0.5, 0.16, stone, COURT, 1.4).map(back),
    ...[-0.95, 0.95].map((x) => box(0.5, 1.25, 0.5, x, COURT, 2.0, SITE.white)),
    box(1.9, 0.28, 0.42, 0, COURT + 0.97, 2.0, SITE.white),
    // The hall: four walls and nothing over them yet (the floor inside is the court's).
    ...walls(1.9, 2.6, 2.0, 0.18, SITE.white, COURT).map(at(-1.35)),
    ...[-0.95, 0.95].flatMap((x) => [-2.2, -1.35, -0.5].map((z) => box(0.04, 0.38, 0.13, x, COURT + 1.42, z, COLORS.dark))),
    ...[-1.18, 1.18].flatMap((x) => [box(0.45, 1.25, 2.4, x, COURT, -1.4, stone), box(0.49, 0.06, 2.44, x, COURT + 1.25, -1.4, dark)]),
  ];
}

/** Pórtico e telhado: the tall porch with its pilasters and doors, the two columns, the roofs (no gold yet). */
function templePorch(): Piece[] {
  const { limestone: stone, limestoneDark: dark } = COLORS;
  const roof = (w: number, d: number, y: number, z: number): Piece[] => [
    box(w + 0.06, 0.08, d + 0.06, 0, y, z, stone),
    ...walls(w + 0.1, d + 0.1, 0.1, 0.07, dark, y + 0.04).map((p) => (p.geo.translate(0, 0, z), p)),
  ];
  return [
    ...roof(1.9, 2.6, COURT + 2.0, -1.35),
    box(2.3, 2.8, 0.7, 0, COURT, 0.25, SITE.white),
    ...roof(2.3, 0.7, COURT + 2.8, 0.25),
    ...[-1.08, -0.42, 0.42, 1.08].map((x) => box(0.14, 2.8, 0.05, x, COURT, 0.62, stone)),
    box(2.3, 0.1, 0.06, 0, COURT + 1.38, 0.62, stone),
    box(0.62, 1.15, 0.04, 0, COURT, 0.61, COLORS.wood),
    ...[-0.78, 0.78].flatMap((x) => [cyl(0.13, 0.15, 1.95, 10, x, COURT, 1.0, COLORS.ochre), cyl(0.23, 0.14, 0.3, 10, x, COURT + 1.95, 1.0, COLORS.ochre)]),
  ];
}

/** A stack of cut blocks (n courses of k, each a little smaller), centred on (x, z). */
function blocks(x: number, z: number, k: number, n: number, y = 0, color: number = SITE.fresh, rot = 0): Piece[] {
  const out: Piece[] = [];
  for (let c = 0; c < n; c++)
    for (let i = 0; i < k - c; i++) {
      const dx = (i - (k - c - 1) / 2) * 0.3;
      out.push(box(0.27, 0.17, 0.2, x + Math.cos(rot) * dx, y + c * 0.17, z - Math.sin(rot) * dx, c % 2 ? COLORS.limestone : color, rot));
    }
  return out;
}

/** A pile of rough stones (for the core of the walls). */
const rubble = (x: number, z: number, y = 0): Piece[] => [
  blob(0.22, x, y + 0.06, z, COLORS.rock, 0.6),
  blob(0.15, x + 0.2, y + 0.05, z + 0.12, COLORS.rubble, 0.6),
  blob(0.13, x - 0.18, y + 0.05, z + 0.1, COLORS.limestoneDark, 0.6),
  blob(0.12, x + 0.02, y + 0.2, z + 0.03, COLORS.rubble, 0.6),
];

/** A stone sledge on rollers. */
const sledge = (x: number, z: number, y = 0, rot = 0): Piece[] => [
  box(0.7, 0.05, 0.32, x, y + 0.06, z, COLORS.wood, rot),
  ...[-0.22, 0.22].map((d) => rod([x + Math.cos(rot) * d, y + 0.03, z - Math.sin(rot) * d - 0.2], [x + Math.cos(rot) * d, y + 0.03, z - Math.sin(rot) * d + 0.2], 0.03, SITE.timber)),
  box(0.3, 0.18, 0.22, x, y + 0.11, z, SITE.fresh, rot),
];

/** A stack of squared timbers along x. */
const timbers = (x: number, z: number, y = 0, len = 1.3): Piece[] =>
  [0, 1, 2, 3, 4].map((k) => box(len, 0.09, 0.09, x, y + (k > 2 ? 0.09 : 0), z + (k > 2 ? (k - 3.5) * 0.1 : (k - 1) * 0.1), k % 2 ? COLORS.wood : SITE.timber));

/**
 * A treadwheel crane standing on (x, z): a tall wooden wheel on its frame (a man walks inside it),
 * a leaning jib with a rope and a block hanging under its head, toward -x.
 */
function crane(x: number, z: number, y: number, reach = 1.1, high = 2.6): Piece[] {
  const r = 0.42;
  const wheel = new THREE.TorusGeometry(r, 0.035, 4, 14);
  wheel.rotateY(Math.PI / 2);
  wheel.translate(x + 0.15, y + r + 0.06, z);
  const wheel2 = wheel.clone();
  wheel2.translate(-0.3, 0, 0);
  const top: [number, number, number] = [x - reach, y + high, z];
  return [
    { geo: wheel, color: SITE.timber },
    { geo: wheel2, color: SITE.timber },
    ...[0, 1, 2, 3].map((k) => rod([x + 0.15, y + r + 0.06 + Math.sin(k * 0.785) * r, z + Math.cos(k * 0.785) * r], [x + 0.15, y + r + 0.06 - Math.sin(k * 0.785) * r, z - Math.cos(k * 0.785) * r], 0.015, COLORS.wood)),
    rod([x, y + r + 0.06, z], [x + 0.3, y + r + 0.06, z], 0.03, COLORS.wood),
    ...[-0.2, 0.2].flatMap((dz) => [rod([x - 0.05, y, z + dz * 2], [x, y + r + 0.06, z], 0.03, COLORS.wood), rod([x + 0.35, y, z + dz * 2], [x + 0.3, y + r + 0.06, z], 0.03, COLORS.wood)]),
    box(0.6, 0.06, 0.95, x + 0.15, y, z, COLORS.wood),
    // The jib from the frame up to its head, braced back, the rope down to a block.
    rod([x - 0.1, y + 0.06, z - 0.12], top, 0.04, SITE.timber),
    rod([x - 0.1, y + 0.06, z + 0.12], top, 0.04, SITE.timber),
    rod([x + 0.4, y + 0.1, z], top, 0.02, SITE.rope),
    rod(top, [top[0], y + high * 0.45, z], 0.012, SITE.rope),
    box(0.26, 0.16, 0.2, top[0], y + high * 0.45 - 0.17, z, SITE.fresh),
  ];
}

/** Scaffold along a wall: poles from `y0` to `y1` at `xs` (z fixed), planks every `step` up. */
function scaffold(xs: number[], z: number, y0: number, y1: number, along: 'x' | 'z', at = 0): Piece[] {
  const p = (u: number, y: number): [number, number, number] => (along === 'x' ? [u, y, z] : [at, y, u]);
  const out: Piece[] = [];
  for (const u of xs) out.push(rod(p(u, y0), p(u, y1), 0.022, SITE.timber));
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  for (let y = y0 + 0.65; y < y1 - 0.05; y += 0.65) {
    const len = hi - lo + 0.15;
    out.push(along === 'x' ? box(len, 0.03, 0.2, (lo + hi) / 2, y, z, COLORS.wood) : box(0.2, 0.03, len, at, y, (lo + hi) / 2, COLORS.wood));
    out.push(rod(p(lo, y - 0.6), p(hi, y), 0.012, SITE.timber));
  }
  return out;
}

/** The altar's works: stacked new stones at its corners, a sledge and rough stones. */
function altarWorks(): Piece[] {
  return [...blocks(-1.55, 1.6, 3, 2, 0, SITE.fresh, 0.2), ...blocks(1.6, -1.5, 3, 2, 0, SITE.fresh, -0.4), ...blocks(1.55, 1.55, 2, 2), ...sledge(-1.5, -1.3, 0, 0.5), ...rubble(0.9, 1.75)];
}

/** The restored altar: a low wall of new stone around its court, open at the front, with steps and corner stones. */
function altarNew(): Piece[] {
  const fresh = SITE.fresh;
  return [
    ...walls(3.85, 3.85, 0.26, 0.18, fresh, 0, 1.1),
    ...[-1.84, 1.84].flatMap((x) => [-1.84, 1.84].map((z) => box(0.28, 0.36, 0.28, x, 0, z, COLORS.limestone))),
    box(1.1, 0.08, 0.36, 0, 0, 1.75, COLORS.limestone),
    box(0.9, 0.08, 0.26, 0, 0.08, 1.7, fresh),
    // A border of new paving inside the wall.
    ...walls(3.5, 3.5, 0.03, 0.22, COLORS.limestone),
    // The pen of the offerings' lambs in a front corner (PEN; the lambs are the ambient's): the altar's
    // wall closes it on two sides, rails of new timber on the other two, a trough of straw.
    ...[[-1, -1], [1, -1], [1, 1], [0, -1], [1, 0]].map(([i, j]) => box(0.05, 0.3, 0.05, PEN.x + (i * PEN.w) / 2, 0, PEN.z + (j * PEN.d) / 2, COLORS.wood)),
    ...[0.12, 0.24].flatMap((h) => [
      box(PEN.w, 0.03, 0.03, PEN.x, h, PEN.z - PEN.d / 2, SITE.timber),
      box(0.03, 0.03, PEN.d, PEN.x + PEN.w / 2, h, PEN.z, SITE.timber),
    ]),
    box(0.14, 0.08, 0.34, PEN.x - 0.18, 0, PEN.z, COLORS.reed),
  ];
}

/** Alicerce: blocks being laid on the rising platform, stacks waiting, rough stones for the core. */
function works2(): Piece[] {
  return [
    ...blocks(-2.2, 1.6, 4, 2), ...blocks(2.2, -2.2, 3, 2, 0, SITE.fresh, Math.PI / 2), ...blocks(-2.3, -2.2, 3, 1),
    ...[[-0.6, -0.4, 0.3], [0.5, 0.8, -0.2], [1.4, -1.2, 0.6], [-1.2, 0.9, 1.2], [0.2, -2.0, 0]].map(([x, z, r]) => box(0.3, 0.17, 0.21, x, 0, z, SITE.fresh, r)),
    ...rubble(1.9, 1.3), ...rubble(-0.3, 1.7), ...sledge(0.9, 1.9, 0, 0.2),
    // The builder's line still along the sanctuary's place.
    ...walls(2.3, 3.3, 0.01, 0.012, SITE.rope, 0.2).map((p) => (p.geo.translate(0, 0, -1.0), p)),
  ];
}

/** Paredes: scaffolds around the hall, the treadwheel crane by it, stacks of blocks in the court. */
function works3(): Piece[] {
  const y = COURT;
  return [
    ...scaffold([-1.15, -0.4, 0.4, 1.15], -2.85, y, y + 2.3, 'x'),
    ...scaffold([-2.5, -1.6, -0.6], 0, y + 1.25, y + 2.3, 'z', 1.48),
    ...scaffold([-2.5, -1.6, -0.6], 0, y + 1.25, y + 2.3, 'z', -1.48),
    ...crane(2.25, -0.2, y, 1.15, 2.7),
    ...blocks(-1.9, 1.3, 4, 2, y), ...blocks(1.6, 1.4, 3, 2, y, SITE.fresh, 0.3), ...rubble(-2.1, -1.4, y),
  ];
}

/** Pórtico e telhado: scaffold only up high (on the side chambers and the porch top), the crane, timbers for the roof. */
function works4(): Piece[] {
  const y = COURT;
  return [
    ...scaffold([-1.0, 0, 1.0], 0.72, y + 1.9, y + 3.3, 'x'),
    ...scaffold([-2.4, -1.4, -0.4], 0, y + 1.31, y + 2.6, 'z', 1.2),
    ...scaffold([-2.4, -1.4, -0.4], 0, y + 1.31, y + 2.6, 'z', -1.2),
    ...crane(2.25, -0.4, y, 1.1, 3.4),
    ...timbers(-1.7, 1.4, y), ...timbers(1.6, 1.7, y, 1.0),
  ];
}

/** Consagração: oil jars, rolls of cloth and a little wood in the court, a ladder at the porch. */
function works5(): Piece[] {
  const y = COURT;
  return [
    ...jars(4, -1.7, y, 1.3, [COLORS.mudDark, COLORS.red, COLORS.ochre, COLORS.mud]),
    ...[0, 1, 2].map((k) => cyl(0.08, 0.08, 0.5, 6, 1.4 + k * 0.18, y, 1.5, k % 2 ? COLORS.blue : COLORS.cloth)),
    ...timbers(1.7, 0.9, y, 0.8),
    rod([-0.7, y, 1.05], [-0.7, y + 2.6, 0.66], 0.022, SITE.timber),
    rod([-0.4, y, 1.05], [-0.4, y + 2.6, 0.66], 0.022, SITE.timber),
    ...[0.5, 1.0, 1.5, 2.0].map((h) => box(0.3, 0.025, 0.03, -0.55, y + h, 1.05 - (h / 2.6) * 0.39, SITE.timber)),
  ];
}

/** Tools left on the ground while nobody works: two mallets, a chisel, a basket, a plank. */
function tools(): Piece[] {
  const mallet = (x: number, z: number, r: number): Piece[] => [
    box(0.12, 0.08, 0.08, x, 0, z, COLORS.wood, r),
    box(0.03, 0.03, 0.26, x + Math.sin(r) * 0.15, 0.025, z + Math.cos(r) * 0.15, SITE.timber, r),
  ];
  return [
    ...mallet(-1.1, 1.3, 0.4), ...mallet(1.3, 0.75, -1.1),
    box(0.02, 0.02, 0.16, -0.85, 0, 1.45, COLORS.rock, 1.2),
    cyl(0.1, 0.08, 0.1, 7, -0.75, 0, 1.15, COLORS.ochre),
    box(0.7, 0.03, 0.14, 0.9, 0, 1.25, SITE.timber, 0.3),
  ];
}

/**
 * The ruins of the old Temple on its old platform: a worn platform broken at the corners, a broken
 * stair, stubs of the court wall and of the sanctuary, fallen blocks and column drums, rubble and
 * dry weeds in the cracks.
 */
function templeRuin(): Piece[] {
  const old = 0xb9a989;
  const worn = 0xa69676;
  const soot = 0x6d6250;
  const weed = (x: number, z: number, y: number): Piece[] => [blob(0.12, x, y + 0.05, z, COLORS.dryBush, 0.7), blob(0.08, x + 0.1, y + 0.04, z + 0.06, COLORS.hedge, 0.8)];
  const y = 0.3;
  return [
    // The old platform, lower than the new one, with its front corners fallen.
    box(5.7, 0.18, 5.2, 0, 0, -0.3, worn),
    box(4.6, 0.12, 4.3, 0.2, 0.18, -0.6, old),
    box(1.2, 0.09, 0.5, -0.2, 0, 2.5, worn, 0.08),
    box(0.6, 0.09, 0.3, 0.4, 0.09, 2.2, old, -0.15),
    // Stubs of the court wall and of the sanctuary, broken to different heights.
    ...[
      // The court wall (x, z, along x, along z, height).
      [-2.0, -2.7, 1.2, 0.18, 0.5], [-0.6, -2.7, 0.9, 0.18, 0.3], [1.6, -2.7, 1.4, 0.18, 0.65], [2.6, -1.2, 0.18, 1.4, 0.45], [-2.6, 0.2, 0.18, 1.0, 0.35],
      // The sanctuary's walls.
      [-0.95, -2.0, 0.2, 0.9, 0.9], [-0.95, -0.8, 0.2, 0.7, 0.55], [0.95, -1.7, 0.2, 0.9, 0.7], [0.95, -0.4, 0.2, 0.6, 0.35], [0, -2.55, 1.2, 0.2, 0.6],
    ].map(([x, z, w, d, h]) => box(w, h, d, x, y, z, old)),
    // A burnt lintel, a fallen block or two leaning, column drums lying in the court.
    tilted(1.1, 0.22, 0.3, 0.2, y + 0.18, 0.4, soot, 0.25, 0.5),
    tilted(0.4, 0.3, 0.32, -1.6, y + 0.12, -1.3, old, 0.5, 0.3),
    ...[[-0.8, 1.0, 0.2], [-0.35, 1.25, 0.9], [1.0, 0.9, 1.6]].map(([x, z, r]) => {
      const g = new THREE.CylinderGeometry(0.17, 0.17, 0.32, 8);
      g.rotateZ(Math.PI / 2);
      g.rotateY(r);
      g.translate(x, y + 0.17, z);
      return { geo: g, color: worn };
    }),
    cyl(0.17, 0.18, 0.5, 8, 0.78, y, 1.6, old),
    ...rubble(-1.9, 1.3, y), ...rubble(1.8, 0.0, y), ...rubble(0.2, -1.4, y), ...rubble(-2.3, -2.2, 0.18),
    ...weed(-1.2, 1.9, y), ...weed(2.1, 1.5, y), ...weed(-0.2, -0.7, y), ...weed(1.4, -2.2, y), ...weed(-2.2, -0.6, y),
  ];
}

/** The ruined altar: its rough stones scattered and blackened around a low mound, no fire. */
function altarRuin(): Piece[] {
  const soot = 0x5c5446;
  return [
    box(3.2, 0.1, 3.2, 0, 0, 0, 0xa69676),
    blob(0.75, 0, 0.1, -0.2, COLORS.rock, 0.45),
    ...[[0.5, -0.6, 0.32], [-0.6, 0.1, 0.28], [0.2, 0.55, 0.24], [-0.3, -0.9, 0.3]].map(([x, z, r]) => blob(r, x, 0.32, z, soot, 0.7)),
    ...[[-1.2, 0.9, 0.4], [1.1, 0.8, -0.6], [1.3, -1.0, 1.0], [-1.1, -1.2, 0.2], [0.1, 1.3, 0.8]].map(([x, z, r]) => box(0.3, 0.2, 0.24, x, 0.06, z, (x * z > 0 ? soot : COLORS.rock), r)),
    tilted(0.28, 0.28, 0.28, 0.9, 0.2, -0.2, COLORS.rock, 0.6, 0.4),
    blob(0.1, -0.9, 0.12, 0.4, COLORS.dryBush, 0.7),
    blob(0.09, 0.7, 0.12, 1.1, COLORS.dryBush, 0.7),
  ];
}

/**
 * The pasture (3x3): a low dry-stone fence with a wooden gate at the front, the shepherd's straw
 * shelter in a back corner (SHELTER_AT, where the flock huddles in winter), a trough of water and a
 * white salt stone. Its sheep and goats graze the grass around it (ambient.ts). One part (ONE_PART).
 */
function pasture(): Piece[] {
  const stones: Piece[] = [];
  const w = 2.8;
  // The fence: rough stones in a course, a little uneven, open at the gate.
  for (let k = 0; k < 14; k++) {
    const t = -w / 2 + 0.1 + (k * (w - 0.2)) / 13;
    const h = 0.2 + hashOf(k, 1) * 0.08;
    stones.push(box(0.22, h, 0.16, t, 0, -w / 2 + 0.08, k % 3 ? COLORS.rubble : COLORS.rock, hashOf(k, 2) * 0.3));
    stones.push(box(0.16, h, 0.22, -w / 2 + 0.08, 0, t, k % 2 ? COLORS.rubble : COLORS.limestoneDark, hashOf(k, 3) * 0.3));
    stones.push(box(0.16, h, 0.22, w / 2 - 0.08, 0, t, k % 3 ? COLORS.rock : COLORS.rubble, hashOf(k, 4) * 0.3));
    if (Math.abs(t) > 0.4) stones.push(box(0.22, h, 0.16, t, 0, w / 2 - 0.08, k % 2 ? COLORS.rock : COLORS.rubble, hashOf(k, 5) * 0.3));
  }
  const [sx, sz] = SHELTER_AT;
  return [
    ...stones,
    // The gate: two posts and a hurdle of poles, swung half open.
    box(0.07, 0.42, 0.07, -0.4, 0, w / 2 - 0.08, COLORS.wood),
    box(0.07, 0.42, 0.07, 0.4, 0, w / 2 - 0.08, COLORS.wood),
    ...[0.12, 0.26].map((h) => box(0.7, 0.035, 0.035, -0.12, h, w / 2 + 0.15, COLORS.wood, 0.6)),
    // The shelter: four posts and a sloped roof of straw over a bed of straw.
    ...[[-0.45, -0.4], [0.45, -0.4], [-0.45, 0.4], [0.45, 0.4]].map(([x, z]) => box(0.06, z < 0 ? 0.62 : 0.48, 0.06, sx + x, 0, sz + z, COLORS.wood)),
    (() => {
      const g = new THREE.BoxGeometry(1.1, 0.07, 1.0);
      g.rotateX(0.15);
      g.translate(sx, 0.58, sz);
      return { geo: g, color: COLORS.reed };
    })(),
    box(0.8, 0.04, 0.7, sx, 0, sz, COLORS.barley),
    // The trough of water and the salt stone.
    box(0.5, 0.13, 0.18, 0.75, 0, 0.55, COLORS.wood),
    box(0.44, 0.02, 0.12, 0.75, 0.12, 0.55, COLORS.water),
    box(0.16, 0.12, 0.14, 0.35, 0, -0.2, 0xf3efe6, 0.4),
    blob(0.1, 0.9, 0.06, -0.6, COLORS.dryBush, 0.6),
  ];
}

/** A crooked trunk: two leaning rods (open, few triangles), the second from the top of the first. */
function crooked(lean: [number, number], h: number, r: number): { pieces: Piece[]; top: [number, number, number] } {
  const mid: [number, number, number] = [lean[0] * 0.5, h * 0.55, lean[1] * 0.5];
  const top: [number, number, number] = [lean[0] * 0.2 - lean[1] * 0.3, h, lean[1] * 0.2 + lean[0] * 0.3];
  return { pieces: [rod([0, 0, 0], mid, r, COLORS.trunk, 4), rod(mid, top, r * 0.8, COLORS.trunk, 4)], top };
}

/** Olive: a thick gnarled, leaning trunk and a wide crown of five lobes, light and dark (silvery leaves). */
function olive(): Piece[] {
  const { pieces, top } = crooked([0.14, 0.05], 0.55, 0.1);
  const [x, y, z] = top;
  return [
    ...pieces,
    lobe(0.4, x - 0.1, y + 0.1, z, COLORS.leaf, 1, 0.8, 1),
    lobe(0.32, x + 0.25, y + 0.14, z + 0.1, COLORS.leaf, 0.78, 0.8, 1),
    lobe(0.3, x + 0.0, y + 0.3, z - 0.24, COLORS.leaf, 1, 0.8, 1),
    lobe(0.27, x - 0.04, y + 0.34, z + 0.22, COLORS.leaf, 0.8, 0.8, 1),
    lobe(0.26, x - 0.3, y + 0.05, z - 0.18, COLORS.leaf, 0.7, 0.8, 0),
  ];
}

/**
 * Oak (the broad round crown of the countryside): a thick trunk that forks, and a wide crown of five
 * lobes (light on top, dark under), the tallest tree of the fields.
 */
function oak(): Piece[] {
  const branches = [[0.2, 0.62, 0.05], [-0.18, 0.66, -0.08]].map(([dx, dy, dz]) => rod([0, 0.35, 0], [dx, dy, dz], 0.055, COLORS.trunk, 5));
  return [
    cyl(0.085, 0.14, 0.5, 6, 0, 0, 0, COLORS.trunk),
    ...branches,
    lobe(0.5, 0, 1.0, 0, COLORS.leaf, 1, 0.82, 1),
    lobe(0.38, 0.36, 0.86, 0.16, COLORS.leaf, 0.78, 0.82, 1),
    lobe(0.4, -0.34, 0.9, -0.12, COLORS.leaf, 0.84, 0.82, 1),
    lobe(0.36, 0.04, 1.34, -0.04, COLORS.leaf, 1, 0.82, 0),
    lobe(0.32, -0.1, 0.78, 0.36, COLORS.leaf, 0.7, 0.82, 0),
  ];
}

/** A cone of a conifer's crown, open at the foot (it hides under the tier above), one shade in the vertices. */
const tier = (r: number, h: number, y: number, tone: number): Piece => {
  const g = new THREE.ConeGeometry(r, h, 6, 1, true);
  g.translate(0, y + h / 2, 0);
  return { geo: g, color: COLORS.pine, tone };
};

/** A thin trunk of a far tree: an open four-sided cone (4 triangles; the crown hides its top). */
const stub = (r: number, h: number): Piece => {
  const g = new THREE.ConeGeometry(r, h, 4, 1, true);
  g.translate(0, h / 2, 0);
  return { geo: g, color: COLORS.trunk };
};

/** Pine (or cypress of the hills): a slim trunk and four tiers of needles, dark green all year. */
function pine(): Piece[] {
  return [
    stub(0.07, 0.5),
    tier(0.52, 0.6, 0.28, 0.8),
    tier(0.42, 0.55, 0.62, 0.9),
    tier(0.3, 0.5, 0.95, 1),
    tier(0.17, 0.42, 1.28, 1.08),
  ];
}

/** A far tree for the woods around the map: two lobes and a stub of trunk (about 50 triangles). */
function wood(): Piece[] {
  return [stub(0.09, 0.5), lobe(0.45, 0, 0.8, 0, COLORS.leaf, 1, 0.9, 0), lobe(0.32, 0.22, 0.62, 0.1, COLORS.leaf, 0.75, 0.9, 0)];
}

/** Almond: a slim trunk, bare branches and a light airy crown (white-pink in bloom, green in leaf). */
function almond(): Piece[] {
  const { pieces, top } = crooked([-0.06, 0.1], 0.55, 0.055);
  const [x, y, z] = top;
  const branches = [[0.28, 0.32, 0.05], [-0.22, 0.3, 0.14], [0.02, 0.36, -0.26]].map(([dx, dy, dz]) => rod([x, y, z], [x + dx, y + dy, z + dz], 0.025, COLORS.trunk, 3));
  return [
    ...pieces,
    ...branches,
    lobe(0.25, x + 0.12, y + 0.3, z + 0.03, COLORS.almondCrown, 1, 0.7),
    lobe(0.22, x - 0.15, y + 0.28, z + 0.1, COLORS.almondCrown, 0.86, 0.72),
    lobe(0.2, x, y + 0.38, z - 0.17, COLORS.almondCrown, 1, 0.7),
  ];
}

/** Fig: a short trunk that splits low and a broad, flat, dark crown of big leaves. */
function fig(): Piece[] {
  const branches = [[0.3, 0.42, 0.08], [-0.26, 0.4, 0.12], [0.04, 0.44, -0.3]].map(([dx, dy, dz]) => rod([0, 0.18, 0], [dx, dy, dz], 0.04, COLORS.trunk, 4));
  return [
    cyl(0.07, 0.09, 0.22, 5, 0, 0, 0, COLORS.trunk),
    ...branches,
    lobe(0.34, 0.12, 0.52, 0.05, COLORS.figCrown, 1, 0.5),
    lobe(0.3, -0.2, 0.5, 0.08, COLORS.figCrown, 0.78, 0.5),
    lobe(0.28, 0.02, 0.56, -0.24, COLORS.figCrown, 1, 0.5),
  ];
}

/** Palm: a slightly bent trunk, fronds rising and falling in an arc, clusters of dates under them. */
function palm(): Piece[] {
  const out: Piece[] = [];
  for (let k = 0; k < 3; k++) out.push(cyl(0.05 - k * 0.006, 0.065 - k * 0.006, 0.55, 5, k * 0.04, k * 0.55, 0, COLORS.trunk));
  for (let k = 0; k < 6; k++) {
    const turn = (k / 6) * Math.PI * 2 + 0.3;
    // Two segments: up and out, then bending down.
    for (const [len, tilt, at] of [[0.42, 0.35, 0], [0.4, -0.55, 0.38]] as const) {
      const g = new THREE.BoxGeometry(len, 0.02, 0.1 - at * 0.1);
      g.translate(len / 2, 0, 0);
      g.rotateZ(tilt);
      g.translate(at, at === 0 ? 0 : Math.sin(0.35) * 0.42, 0);
      g.rotateY(turn);
      g.translate(0.12, 1.66, 0);
      out.push({ geo: g, color: COLORS.palm });
    }
  }
  out.push(blob(0.07, 0.17, 1.56, 0.06, COLORS.dates, 1.2), blob(0.06, 0.06, 1.56, -0.08, COLORS.dates, 1.2));
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

/** A rock with a cap of moss and a tuft at its foot (the Foundation's mossy stones). */
const rock = (): Piece[] => [blob(0.32, 0, 0.1, 0, COLORS.rock, 0.55), blob(0.18, 0.25, 0.05, 0.2, COLORS.limestoneDark, 0.6), blob(0.26, -0.03, 0.15, -0.02, COLORS.hedge, 0.3)];
/** A round bush: two lobes in two shades (one draw call with the crowns, recoloured by the season). */
const shrub = (): Piece[] => [
  lobe(0.24, 0, 0.17, 0, COLORS.leaf, 1, 0.82, 1),
  lobe(0.17, 0.17, 0.1, 0.06, COLORS.leaf, 0.76, 0.82, 0),
];
const road = (): Piece[] => [box(1, 0.04, 1, 0, 0, 0, COLORS.road)];
/** A trail: a narrow patch of trodden earth in the middle of the cell (the sand shows around it). */
const trail = (): Piece[] => [box(0.4, 0.04, 0.4, 0, 0, 0, COLORS.road)];
/** A trail's arm from the middle toward the road beside it (+z), so trails join. */
const trailArm = (): Piece[] => [box(0.34, 0.039, 0.52, 0, 0, 0.25, COLORS.road)];
/** A road off the network: a pale dash in the middle of the cell... */
const loose = (): Piece[] => [box(0.3, 0.035, 0.3, 0, 0, 0, COLORS.roadLoose)];
/** ...and half a dash on the border toward the road beside it (+z): with the neighbour's half, one dash. */
const looseArm = (): Piece[] => [box(0.3, 0.035, 0.15, 0, 0, 0.425, COLORS.roadLoose)];
/** A road's dark edge along its +z side (no road there): the road reads as a road from far away. */
const roadEdge = (): Piece[] => [box(1, 0.043, 0.08, 0, 0, 0.46, COLORS.roadEdge)];
/** Two wheel ruts from the middle toward the road beside it (+z). */
const ruts = (): Piece[] => [-0.17, 0.17].map((x) => box(0.07, 0.044, 0.5, x, 0, 0.25, COLORS.roadRut));
/** A few worn stones on a road. */
const roadStones = (): Piece[] => [
  blob(0.05, 0.22, 0.04, -0.12, COLORS.roadStone, 0.45),
  blob(0.035, -0.25, 0.04, 0.2, COLORS.roadJoint, 0.5),
  blob(0.03, 0.05, 0.04, 0.3, COLORS.roadStone, 0.5),
];
/** A busy road paved with flagstones: three rows of slabs with staggered joints. */
const flags = (): Piece[] => {
  const j = (sx: number, sz: number, x: number, z: number) => box(sx, 0.043, sz, x, 0, z, COLORS.roadJoint);
  const rows: [number, number[]][] = [[-0.33, [-0.2, 0.25]], [0, [-0.35, 0.05, 0.4]], [0.33, [-0.1, 0.3]]];
  return [
    box(1, 0.04, 1, 0, 0, 0, COLORS.roadStone),
    j(1, 0.025, 0, -0.165),
    j(1, 0.025, 0, 0.165),
    ...rows.flatMap(([z, xs]) => xs.map((x) => j(0.025, 0.33, x, z))),
  ];
};
/** A fallen log lying in the grass (8-sided, a short branch stub on it). */
const log = (): Piece[] => {
  const g = new THREE.CylinderGeometry(0.075, 0.09, 0.85, 8);
  g.rotateZ(Math.PI / 2);
  g.translate(0, 0.08, 0);
  const b = new THREE.CylinderGeometry(0.025, 0.035, 0.18, 5);
  b.rotateZ(0.9);
  b.translate(0.12, 0.18, 0.03);
  return [{ geo: g, color: COLORS.wood }, { geo: b, color: COLORS.wood }, { geo: new THREE.CircleGeometry(0.075, 8).rotateY(Math.PI / 2).translate(0.43, 0.08, 0), color: 0xc9a46a }];
};
/** A pile of firewood: three rows of cut logs (3, 2 and 1 high), a pale cut face on the front. */
const woodpile = (): Piece[] => {
  const out: Piece[] = [];
  for (let row = 0; row < 3; row++)
    for (let k = 0; k < 4 - row; k++) {
      const x = -0.3 + row * 0.1 + k * 0.2;
      out.push(box(0.17, 0.17, 0.5, x, 0.01 + row * 0.16, 0, (k + row) % 2 ? COLORS.wood : 0x8a6440), box(0.12, 0.12, 0.01, x, 0.035 + row * 0.16, 0.255, 0xd2b47a));
    }
  return out;
};
/** A short wooden fence, one cell long along x: two posts and two rails. */
const fence = (): Piece[] => [
  box(0.07, 0.34, 0.07, -0.46, 0, 0, COLORS.wood),
  box(0.07, 0.34, 0.07, 0.46, 0, 0, COLORS.wood),
  box(0.07, 0.3, 0.07, 0, 0, 0, COLORS.wood),
  box(1, 0.045, 0.04, 0, 0.12, 0, 0x8a6440),
  box(1, 0.045, 0.04, 0, 0.25, 0, 0x8a6440),
];
/** Hay: a stack of three square bales and a round one beside it. */
const hay = (): Piece[] => {
  const round = new THREE.CylinderGeometry(0.17, 0.17, 0.26, 10);
  round.rotateZ(Math.PI / 2);
  round.translate(0.32, 0.17, 0.12);
  return [
    box(0.34, 0.18, 0.24, -0.1, 0, 0, COLORS.reed),
    box(0.34, 0.18, 0.24, -0.1, 0.18, 0.02, 0xd6b878, 0.15),
    box(0.34, 0.18, 0.24, -0.2, 0, 0.26, 0xd6b878, 0.1),
    { geo: round, color: COLORS.reed },
    box(0.4, 0.015, 0.015, -0.1, 0.1, 0.125, 0x8a6440),
  ];
};
/** A small field shed: plank walls, a door, a thatched roof sloping to the front and a stack of crates beside it. */
const shed = (): Piece[] => {
  const roofL = new THREE.BoxGeometry(0.55, 0.05, 0.8);
  roofL.rotateZ(0.5);
  roofL.translate(-0.16, 0.6, 0);
  const roofR = new THREE.BoxGeometry(0.55, 0.05, 0.8);
  roofR.rotateZ(-0.5);
  roofR.translate(0.16, 0.6, 0);
  return [
    box(0.62, 0.42, 0.66, 0, 0, -0.05, COLORS.wood),
    box(0.22, 0.3, 0.02, 0.1, 0, 0.29, 0x2a1c14),
    { geo: roofL, color: COLORS.reed },
    { geo: roofR, color: COLORS.reed },
    box(0.2, 0.16, 0.2, 0.46, 0, 0.1, 0x8a6440),
    box(0.16, 0.14, 0.16, 0.46, 0.16, 0.1, COLORS.wood, 0.4),
  ];
};

/** A tuft of grass: seven fat blades of different heights leaning out (green of the season, 3 triangles a blade). */
const tuft = (): Piece[] =>
  [0.26, 0.4, 0.22, 0.46, 0.3, 0.24, 0.36].map((h, k) => {
    const a = k * 0.9 + 0.3;
    const lean = 0.14 + (k % 3) * 0.09;
    // Open at the foot (no cap: it stands on the ground).
    const g = new THREE.ConeGeometry(0.05, h, 3, 1, true);
    g.translate(0, h / 2, 0);
    g.rotateZ(Math.cos(a) * lean);
    g.rotateX(Math.sin(a) * lean);
    g.translate(Math.cos(a) * 0.06, 0, Math.sin(a) * 0.06);
    return { geo: g, color: k % 2 ? COLORS.tuftDark : COLORS.tuft };
  });

/** A patch of wild flowers: stems of the grass's green and heads of a few colours (they sway with it). */
function flowerPatch(heads: [number, number, number][]): Piece[] {
  return heads.flatMap(([x, z, color], k) => {
    const h = 0.2 + (k % 3) * 0.05;
    const stem = new THREE.ConeGeometry(0.014, h, 3, 1, true);
    stem.translate(x, h / 2, z);
    const head = new THREE.OctahedronGeometry(0.048, 0);
    head.scale(1, 0.75, 1);
    head.translate(x, h + 0.015, z);
    return [{ geo: stem, color: COLORS.tuft }, { geo: head, color }];
  });
}
const flowers = (): Piece[] =>
  flowerPatch([[-0.13, 0.04, COLORS.flowerBlue], [0.1, -0.07, COLORS.flowerBlue], [0, 0.15, COLORS.flowerWhite], [0.17, 0.11, COLORS.flowerYellow], [-0.07, -0.13, COLORS.flowerBlue], [0.04, -0.02, COLORS.flowerPink], [-0.2, 0.17, COLORS.flowerWhite]]);
const flowersB = (): Piece[] =>
  flowerPatch([[0.12, 0.05, COLORS.flowerOrange], [-0.1, -0.06, COLORS.flowerYellow], [0.02, 0.14, COLORS.flowerOrange], [-0.17, 0.1, COLORS.flowerWhite], [0.15, -0.14, COLORS.flowerYellow], [0.0, -0.04, COLORS.flowerOrange]]);
/** Pebbles half sunk in the sand (octahedra: 8 triangles each, there are hundreds). */
const pebble = (r: number, x: number, y: number, z: number, color: number, sy: number): Piece => {
  const g = new THREE.OctahedronGeometry(r, 0);
  g.rotateY(x * 17);
  g.scale(1, sy, 1);
  g.translate(x, y, z);
  return { geo: g, color };
};
/** A ragged lump of the lawn creeping over a road's edge: three flat tufts of turf (two shades, 24 triangles). */
const verge = (): Piece[] => [
  pebble(0.13, 0, 0.03, 0, COLORS.hedge, 0.3),
  pebble(0.09, 0.12, 0.025, 0.05, COLORS.hedge, 0.34),
  pebble(0.08, -0.11, 0.025, -0.05, COLORS.hedge, 0.34),
];
const pebbles = (): Piece[] => [
  pebble(0.045, 0, 0.01, 0, COLORS.rock, 0.5),
  pebble(0.03, 0.09, 0.005, 0.05, COLORS.limestoneDark, 0.55),
  pebble(0.025, -0.06, 0.005, 0.08, COLORS.rock, 0.6),
  pebble(0.035, 0.02, 0.008, -0.1, COLORS.limestoneDark, 0.5),
];

/** A busy road's stone kerb along its +z side (no road there). */
const kerb = (): Piece[] => [
  box(1, 0.075, 0.09, 0, 0, 0.455, COLORS.roadStone),
  ...[-0.34, 0, 0.34].map((x) => box(0.012, 0.077, 0.092, x, 0, 0.455, COLORS.roadJoint)),
];

/** Sacks of grain (blobs), each at (x, y, z) in the granary yard. */
const sacks = (at: number[][]): Piece[] => at.map(([x, y, z], k) => blob(0.11 + (k % 3) * 0.015, x, y + 0.08, z, k % 4 === 3 ? COLORS.ochre : COLORS.cloth, 0.75));
/**
 * The granary yard as the food store fills, between the silos and the front wall, beside the gate
 * gap: a couple of sacks, then a row of sacks and jars, then sacks stacked two high and a heap of grain.
 */
function stock(level: 1 | 2 | 3): Piece[] {
  const row = [[0.15, 0, 1.0], [0.38, 0, 1.06], [0.6, 0, 0.98], [-0.3, 0, 1.04]];
  if (level === 1) return sacks(row.slice(0, 2));
  const out = [...sacks(row), ...jars(3, -0.75, 0.05, 0.95, [COLORS.mudDark, COLORS.red])];
  if (level === 3) out.push(...sacks([[0.27, 0.17, 1.03], [0.5, 0.17, 1.02]]), blob(0.2, -0.02, 0.05, 1.12, COLORS.wheat, 0.45), ...jars(2, -0.75, 0.05, 1.15, [COLORS.ochre]));
  return out;
}

/**
 * The craft of a workshop, in the front right corner of its yard (around CRAFT_AT): the smithy's
 * anvil and glowing forge, the carpenter's planks and logs, the weaver's loom with a striped cloth,
 * the dyer's vats of colour and cloths drying, the tanner's hides stretched on frames.
 */
const CRAFT_AT: [number, number] = [0.72, 0.78];
/** Height of the workshop's yard floor (the Meshy model stands on a raised platform). */
const CRAFT_FLOOR = 0.24;
function craft(k: 1 | 2 | 3 | 4 | 5): Piece[] {
  return [...craftPieces(k).map((p) => ({ ...p, geo: p.geo.translate(0, CRAFT_FLOOR, 0) })), ...craftSign(k)];
}

/** Over the workshop's porch (its front, +z) and on its roof (the back half). */
const PORCH: [y: number, z: number] = [1.02, 0.72];
const ROOF: [y: number, z: number] = [1.32, -0.85];

/**
 * What tells a craft from far away (plano beleza C8): a large shape in the craft's own colour over
 * the porch and on the roof, so a row of workshops no longer reads as six potteries. The smithy: a
 * sooty awning and a tall forge chimney glowing at its mouth; the carpentry: stacks of yellow planks on
 * the roof and long timbers leaning on the porch; the weaving: a striped awning and a loom on the roof;
 * the dyeing: lines of red, blue and ochre cloth drying on the roof; the tannery: a brown awning and
 * hides stretched on frames on the roof.
 */
function craftSign(k: 1 | 2 | 3 | 4 | 5): Piece[] {
  const [py, pz] = PORCH;
  const [ry, rz] = ROOF;
  const awning = (color: number, x = 0, w = 2.5): Piece => ({ ...box(w, 0.03, 1.15, x, py, pz, color), cloth: 'sail' });
  switch (k) {
    case 1:
      return [
        awning(COLORS.dark),
        box(0.42, 0.95, 0.42, -0.85, ry, rz, COLORS.rock),
        box(0.5, 0.08, 0.5, -0.85, ry + 0.95, rz, COLORS.dark),
        { ...box(0.24, 0.16, 0.03, -0.85, ry + 0.12, rz + 0.215, COLORS.flame), emissive: true },
      ];
    case 2:
      return [
        ...[0, 1, 2, 3, 4].map((n) => box(1.5, 0.07, 0.2, 0.1, ry + n * 0.07, rz - 0.4 + (n % 2) * 0.05, COLORS.wheat)),
        ...[0, 1, 2].map((n) => box(1.2, 0.07, 0.2, 0.25, ry + n * 0.07, rz - 0.05, COLORS.wheat)),
        ...[-1.0, -0.75].map((x) => box(0.08, 1.2, 0.08, x, 0, pz + 0.55, COLORS.trunk, 0.2)),
      ];
    case 3:
      return [
        ...[0, 1, 2, 3, 4].map((n) => ({ ...box(0.5, 0.03, 1.15, -1.0 + n * 0.5, py, pz, n % 2 ? COLORS.cloth : COLORS.blue), cloth: 'sail' as const })),
        box(0.06, 0.6, 0.06, -0.5, ry, rz, COLORS.wood),
        box(0.06, 0.6, 0.06, 0.5, ry, rz, COLORS.wood),
        box(1.1, 0.06, 0.06, 0, ry + 0.58, rz, COLORS.wood),
        { ...box(0.9, 0.5, 0.02, 0, ry + 0.06, rz, COLORS.blue), cloth: 'hang' },
      ];
    case 4:
      return [
        ...[-0.25, 0.25].map((dz) => box(2.0, 0.025, 0.025, 0, ry + 0.62, rz + dz, COLORS.dark)),
        ...[-1.0, 1.0].flatMap((x) => [-0.25, 0.25].map((dz) => box(0.05, 0.64, 0.05, x, ry, rz + dz, COLORS.wood))),
        ...[COLORS.red, COLORS.blue, COLORS.ochre, COLORS.red, COLORS.blue, COLORS.ochre].map((c, n) => ({
          ...box(0.28, 0.45, 0.02, -0.75 + (n % 3) * 0.6 + (n > 2 ? 0.3 : 0), ry + 0.17, rz + (n > 2 ? 0.25 : -0.25), c),
          cloth: 'hang' as const,
        })),
      ];
    case 5:
      return [
        awning(0x7a5236),
        ...[-0.6, 0, 0.6].flatMap((x) => [
          box(0.04, 0.6, 0.04, x - 0.24, ry, rz, COLORS.wood),
          box(0.04, 0.6, 0.04, x + 0.24, ry, rz, COLORS.wood),
          box(0.52, 0.04, 0.04, x, ry + 0.58, rz, COLORS.wood),
          box(0.42, 0.46, 0.02, x, ry + 0.08, rz, 0x9a6a3a),
        ]),
      ];
  }
}
function craftPieces(k: 1 | 2 | 3 | 4 | 5): Piece[] {
  const [x, z] = CRAFT_AT;
  switch (k) {
    case 1:
      return [
        box(0.3, 0.22, 0.3, x - 0.15, 0, z - 0.1, COLORS.rock),
        box(0.22, 0.03, 0.22, x - 0.15, 0.22, z - 0.1, COLORS.fire, 0),
        { ...box(0.16, 0.025, 0.16, x - 0.15, 0.245, z - 0.1, COLORS.flame), emissive: true },
        box(0.08, 0.12, 0.08, x + 0.2, 0, z + 0.1, COLORS.dark),
        box(0.18, 0.05, 0.08, x + 0.2, 0.12, z + 0.1, 0x4a4a4e),
        blob(0.1, x + 0.2, 0.05, z - 0.25, 0x2e2a28, 0.5),
      ];
    case 2:
      return [
        ...[0, 1, 2, 3].map((n) => box(0.5, 0.035, 0.11, x, 0.035 * n, z - 0.15 + (n % 2) * 0.02, COLORS.wheat)),
        // Logs lying across, two below and one on top.
        ...[[-0.06, 0.05], [0.06, 0.05], [0, 0.14]].map(([dz, y]) => ({ geo: new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6).rotateZ(Math.PI / 2).translate(x, y, z + 0.2 + dz), color: COLORS.trunk })),
        box(0.3, 0.2, 0.1, x + 0.05, 0, z + 0.42, COLORS.wood),
      ];
    case 3:
      return [
        box(0.04, 0.6, 0.04, x - 0.25, 0, z, COLORS.wood),
        box(0.04, 0.6, 0.04, x + 0.25, 0, z, COLORS.wood),
        box(0.56, 0.04, 0.05, x, 0.58, z, COLORS.wood),
        box(0.44, 0.24, 0.015, x, 0.3, z, COLORS.blue),
        box(0.44, 0.06, 0.016, x, 0.4, z, COLORS.cloth),
        box(0.44, 0.04, 0.016, x, 0.32, z, COLORS.red),
        ...[0, 1, 2].map((n) => cyl(0.025, 0.025, 0.1, 5, x - 0.12 + n * 0.12, 0.08, z, COLORS.mudDark)),
        cyl(0.05, 0.05, 0.22, 7, x + 0.05, 0, z + 0.32, COLORS.ochre),
      ];
    case 4:
      return [
        ...[COLORS.blue, COLORS.red, COLORS.ochre].flatMap((c, n) => [cyl(0.11, 0.1, 0.16, 8, x - 0.25 + n * 0.25, 0, z - 0.05, COLORS.mudDark), cyl(0.09, 0.09, 0.01, 8, x - 0.25 + n * 0.25, 0.155, z - 0.05, c)]),
        box(0.04, 0.55, 0.04, x - 0.35, 0, z + 0.3, COLORS.wood),
        box(0.04, 0.55, 0.04, x + 0.35, 0, z + 0.3, COLORS.wood),
        box(0.7, 0.015, 0.015, x, 0.53, z + 0.3, COLORS.dark),
        box(0.16, 0.3, 0.015, x - 0.2, 0.23, z + 0.3, COLORS.blue),
        box(0.16, 0.26, 0.015, x, 0.27, z + 0.3, COLORS.red),
        box(0.16, 0.28, 0.015, x + 0.2, 0.25, z + 0.3, COLORS.ochre),
      ];
    case 5:
      return [
        ...[-0.2, 0.2].flatMap((dx) => [
          box(0.03, 0.45, 0.03, x + dx - 0.15, 0, z, COLORS.wood),
          box(0.03, 0.45, 0.03, x + dx + 0.15, 0, z, COLORS.wood),
          box(0.34, 0.03, 0.03, x + dx, 0.43, z, COLORS.wood),
          box(0.26, 0.3, 0.015, x + dx, 0.1, z, 0x9a6a3a),
        ]),
        cyl(0.13, 0.12, 0.14, 8, x, 0, z + 0.32, COLORS.wood),
        cyl(0.11, 0.11, 0.01, 8, x, 0.135, z + 0.32, COLORS.limestone),
        box(0.3, 0.06, 0.2, x + 0.3, 0, z + 0.35, 0x7a5236),
      ];
  }
}

/** Yard of a lived-in house (variant 1): three jars by the wall and a potted plant. */
const yardJars = (): Piece[] => [...jars(3, -0.17, 0, -0.05, [COLORS.mudDark, COLORS.red, COLORS.ochre]), cyl(0.09, 0.07, 0.13, 7, 0.05, 0, 0.17, COLORS.mud), blob(0.11, 0.05, 0.2, 0.17, COLORS.leaf, 0.9)];
/** Yard of a lived-in house (variant 2): a washing line between two posts with cloths drying. */
const yardLine = (): Piece[] => [
  box(0.04, 0.5, 0.04, 0, 0, -0.25, COLORS.wood),
  box(0.04, 0.5, 0.04, 0, 0, 0.25, COLORS.wood),
  box(0.012, 0.012, 0.5, 0, 0.48, 0, COLORS.dark),
  hanging(0.02, 0.2, 0.14, 0, 0.28, -0.12, COLORS.red),
  hanging(0.02, 0.16, 0.12, 0, 0.32, 0.08, COLORS.cloth),
  hanging(0.02, 0.18, 0.08, 0, 0.3, 0.2, COLORS.blue),
];


function lumber(): Piece[] {
  // Woodcutter's shed, a stack of logs, a chopping block with an axe.
  return [
    box(1.0, 0.7, 0.8, -0.4, 0, -0.45, COLORS.mud),
    box(1.1, 0.07, 0.9, -0.4, 0.7, -0.45, COLORS.roofMud),
    box(0.26, 0.45, 0.04, -0.4, 0, -0.04, COLORS.dark),
    ...[0, 1, 2].map((k) => {
      const g = new THREE.CylinderGeometry(0.09, 0.09, 0.9, 6);
      g.rotateZ(Math.PI / 2);
      g.translate(0.35, 0.09 + k * 0.15, 0.25 + (k % 2) * 0.09 - k * 0.04);
      return { geo: g, color: COLORS.trunk };
    }),
    cyl(0.14, 0.15, 0.22, 7, -0.35, 0, 0.55, COLORS.trunk),
    box(0.04, 0.3, 0.04, -0.33, 0.22, 0.55, COLORS.wood),
    box(0.12, 0.08, 0.03, -0.29, 0.46, 0.55, COLORS.rock),
  ];
}

function quarry(): Piece[] {
  // A limestone outcrop cut in steps, cut blocks in front, a tripod crane.
  return [
    box(1.8, 0.75, 0.7, 0, 0, -0.55, COLORS.limestoneDark),
    box(1.5, 0.45, 0.45, 0, 0, -0.05, COLORS.limestone),
    box(1.2, 0.2, 0.3, 0, 0, 0.3, COLORS.limestone),
    box(0.35, 0.22, 0.25, -0.55, 0, 0.7, COLORS.limestone),
    box(0.35, 0.22, 0.25, -0.15, 0, 0.72, COLORS.limestone),
    box(0.35, 0.22, 0.25, -0.35, 0.22, 0.7, COLORS.limestone),
    ...[0, 2.1, 4.2].map((a) => {
      const g = new THREE.CylinderGeometry(0.03, 0.04, 1.2, 5);
      g.translate(0, 0.6, 0);
      g.rotateX(0.32);
      g.rotateY(a);
      g.translate(0.6, 0, 0.55);
      return { geo: g, color: COLORS.wood };
    }),
  ];
}

/** A cut tree: a short trunk with a pale cut top. */
const stump = (): Piece[] => [cyl(0.09, 0.12, 0.16, 6, 0, 0, 0, COLORS.trunk), cyl(0.085, 0.085, 0.015, 6, 0, 0.16, 0, COLORS.cloth)];
/** A young tree growing back on a stump (scaled by how far it grew). */
const sapling = (): Piece[] => [cyl(0.03, 0.04, 0.35, 5, 0, 0, 0, COLORS.trunk), blob(0.2, 0, 0.42, 0, COLORS.leaf, 0.8)];

/**
 * The common stone dress of a service building at level 2–3: a limestone kerb round the footprint and
 * corner posts, short with stone caps at level 2, tall with gold caps and red banners at level 3.
 */
function stoneDress(w: number, d: number, level: 2 | 3): Piece[] {
  const t = 0.1;
  const out: Piece[] = [
    box(w, 0.1, t, 0, 0, -d / 2 + t / 2 - 0.02, COLORS.limestone),
    box(w, 0.1, t, 0, 0, d / 2 - t / 2 + 0.02, COLORS.limestone),
    box(t, 0.1, d, -w / 2 + t / 2 - 0.02, 0, 0, COLORS.limestone),
    box(t, 0.1, d, w / 2 - t / 2 + 0.02, 0, 0, COLORS.limestone),
  ];
  const postH = level === 3 ? 1.15 : 0.6;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const x = sx * (w / 2 - 0.1);
      const z = sz * (d / 2 - 0.1);
      out.push(box(0.2, postH, 0.2, x, 0, z, COLORS.limestone), box(0.26, 0.07, 0.26, x, postH, z, level === 3 ? COLORS.gold : COLORS.limestoneDark));
      if (level === 3 && sz === 1) out.push(box(0.03, 0.6, 0.03, x, postH + 0.07, z, COLORS.wood), box(0.02, 0.34, 0.28, x, postH + 0.3, z - 0.15, COLORS.red));
    }
  return out;
}

/** Jars of a store or a stall, in a row from (x, z) along x. */
const jars = (n: number, x: number, y: number, z: number, colors: number[]): Piece[] =>
  Array.from({ length: n }, (_, k) => cyl(0.07, 0.05, 0.18, 6, x + k * 0.17, y, z, colors[k % colors.length]));

/**
 * Granary at level 2: a limestone upper storey on the store house, coping on the court walls, gate
 * posts and sacks in the yard. Level 3: a taller storey with a gold band and a shade on the roof,
 * a gateway with a lintel, gold finials on the silos.
 */
function granaryUp(level: 2 | 3): Piece[] {
  const top = level === 3 ? 0.7 : 0.48;
  const gateH = level === 3 ? 1.1 : 0.75;
  const out: Piece[] = [
    ...stoneDress(3, 3, level),
    box(2.0, top, 0.78, 0, 1.22, -0.88, COLORS.limestone),
    box(2.1, 0.07, 0.88, 0, 1.22 + top, -0.88, COLORS.limestoneDark),
    ...[-0.6, 0, 0.6].map((x) => box(0.14, 0.17, 0.03, x, 1.22 + top * 0.4, -0.48, COLORS.dark)),
    // Coping on the court walls (they stand 0.45 high, with a 0.8 gap in front).
    box(2.96, 0.05, 0.17, 0, 0.45, -1.39, COLORS.limestone),
    box(0.17, 0.05, 2.96, -1.39, 0.45, 0, COLORS.limestone),
    box(0.17, 0.05, 2.96, 1.39, 0.45, 0, COLORS.limestone),
    box(1.08, 0.05, 0.17, -0.94, 0.45, 1.39, COLORS.limestone),
    box(1.08, 0.05, 0.17, 0.94, 0.45, 1.39, COLORS.limestone),
    box(0.2, gateH, 0.22, -0.5, 0, 1.39, COLORS.limestone),
    box(0.2, gateH, 0.22, 0.5, 0, 1.39, COLORS.limestone),
    blob(0.14, -1.05, 0.12, 1.0, COLORS.cloth, 0.75),
    blob(0.13, -0.85, 0.11, 1.1, COLORS.cloth, 0.75),
    blob(0.12, -0.97, 0.3, 1.04, COLORS.cloth, 0.75),
    ...jars(3, -1.15, 0.05, -0.3, [COLORS.mudDark, COLORS.red]),
  ];
  if (level === 3) {
    out.push(box(2.06, 0.05, 0.84, 0, 1.22 + top - 0.08, -0.88, COLORS.gold));
    out.push(box(1.24, 0.16, 0.26, 0, gateH, 1.39, COLORS.limestone), box(1.26, 0.05, 0.28, 0, gateH + 0.16, 1.39, COLORS.gold));
    for (const x of [-0.75, 0, 0.75]) out.push(cyl(0.03, 0.05, 0.14, 6, x, 0.98, 0.45, COLORS.gold));
    // Shade on the roof: four posts and an awning.
    for (const [x, z] of [[-0.8, -1.2], [-0.1, -1.2], [-0.8, -0.56], [-0.1, -0.56]]) out.push(box(0.04, 0.42, 0.04, x, 1.29 + top, z, COLORS.wood));
    out.push(sail(0.8, 0.03, 0.74, -0.45, 1.71 + top, -0.88, COLORS.blue), ...jars(3, 0.25, 1.29 + top, -0.88, [COLORS.ochre, COLORS.mudDark]));
  }
  return out;
}

/**
 * Workshop at level 2: a limestone room on the roof, a shelf of pots for sale in front and a second
 * kiln. Level 3: a taller room with a gold band and an awning, a tall kiln chimney and glazed jars.
 */
function workshopUp(level: 2 | 3): Piece[] {
  const top = level === 3 ? 0.72 : 0.5;
  // The room stands on the workroom roof (1.6 in the Meshy and the code model).
  const roof = 1.6;
  const out: Piece[] = [
    ...stoneDress(3, 3, level),
    box(1.0, top, 0.9, -0.85, roof, -0.85, COLORS.limestone),
    box(1.08, 0.06, 0.98, -0.85, roof + top, -0.85, COLORS.limestoneDark),
    box(0.16, 0.18, 0.03, -0.85, roof + top * 0.4, -0.39, COLORS.dark),
    // Shelf of pots in front, between the kiln and the shed.
    box(0.8, 0.05, 0.24, 0.05, 0.3, 1.32, COLORS.wood),
    box(0.05, 0.3, 0.05, -0.3, 0, 1.32, COLORS.wood),
    box(0.05, 0.3, 0.05, 0.4, 0, 1.32, COLORS.wood),
    ...jars(4, -0.22, 0.35, 1.32, level === 3 ? [COLORS.blue, COLORS.gold, COLORS.red] : [COLORS.red, COLORS.ochre, COLORS.mudDark]),
    // A second kiln in the front left corner.
    blob(0.26, -0.95, 0.12, 0.8, COLORS.mudDark, 0.8, 1),
  ];
  if (level === 3) {
    out.push(box(1.04, 0.05, 0.94, -0.85, roof + top - 0.08, -0.85, COLORS.gold));
    // Tall chimney on the kiln (the smoke leaves from its top, see world.ts).
    out.push(cyl(0.1, 0.14, 1.0, 7, KILN[0], 0.75, KILN[1], COLORS.mudDark), cyl(0.13, 0.13, 0.06, 7, KILN[0], 1.75, KILN[1], COLORS.limestone));
    out.push(sail(1.1, 0.03, 0.5, -0.85, 0.95, 0.1, COLORS.red), box(0.04, 0.95, 0.04, -1.35, 0, 0.3, COLORS.wood), box(0.04, 0.95, 0.04, -0.35, 0, 0.3, COLORS.wood));
    out.push(...jars(3, -1.25, 0, 1.25, [COLORS.blue, COLORS.gold]));
  }
  return out;
}

/**
 * Market (2 x 4, the stalls of the model fill it) at level 2: goods along the sides and a blue shade
 * sail over the middle. Level 3: a limestone colonnade (stoa) down both long sides with a gold band.
 */
function marketUp(level: 2 | 3): Piece[] {
  const out: Piece[] = [...stoneDress(2, 4, level)];
  for (const z of [-1.45, 0.05, 1.45]) out.push(...jars(3, -0.95, 0.06, z, [COLORS.mudDark, COLORS.ochre, COLORS.red]));
  out.push(box(0.3, 0.12, 0.22, 0.8, 0.06, -0.6, COLORS.red), box(0.3, 0.1, 0.22, 0.8, 0.18, -0.6, COLORS.blue), box(0.3, 0.12, 0.22, 0.8, 0.06, 0.7, COLORS.ochre));
  // Heaps of produce on the stalls' fronts: pomegranates, oranges and grain (colours the stalls already use).
  for (const [x, z, c] of [[-0.55, -1.0, COLORS.red], [0.55, -1.0, COLORS.ochre], [-0.55, 1.0, COLORS.ochre], [0.55, 1.0, COLORS.red], [-0.55, 0.0, COLORS.red], [0.55, 0.25, COLORS.ochre]] as const)
    out.push(blob(0.12, x, 0.42, z, c, 0.6), blob(0.08, x + 0.1, 0.44, z + 0.08, c, 0.6));
  for (const [x, z] of [[-0.78, -0.4], [0.78, -0.4], [-0.78, 0.4], [0.78, 0.4]]) out.push(box(0.04, 1.5, 0.04, x, 0, z, COLORS.wood));
  out.push(sail(1.7, 0.03, 0.9, 0, 1.5, 0, COLORS.blue));
  if (level === 3) {
    for (const x of [-0.94, 0.94]) {
      for (const z of [-1.4, -0.47, 0.47, 1.4]) out.push(cyl(0.065, 0.075, 1.7, 8, x, 0.08, z, COLORS.limestone), cyl(0.1, 0.07, 0.08, 8, x, 1.74, z, COLORS.gold));
      out.push(box(0.16, 0.13, 4.0, x, 1.82, 0, COLORS.limestone), box(0.17, 0.04, 4.02, x, 1.95, 0, COLORS.gold));
    }
    for (const z of [-1.92, 1.92]) out.push(box(2.0, 0.13, 0.16, 0, 1.82, z, COLORS.limestone));
  }
  return out;
}

/** Additions of each levelled kind, by level. */
const EXTRAS: Partial<Record<string, (level: 2 | 3) => Piece[]>> = { granary: granaryUp, workshop: workshopUp, market: marketUp };

/**
 * Before an empty house that kept its level: a barred gate (two posts, crossed planks), drifted
 * sand and a dry bush. Placed by the world at the door of each level (see CLOSED_AT).
 */
function closed(): Piece[] {
  return [
    box(0.06, 0.46, 0.06, -0.24, 0, 0, COLORS.wood),
    box(0.06, 0.46, 0.06, 0.24, 0, 0, COLORS.wood),
    tilted(0.6, 0.07, 0.03, 0, 0.24, 0.03, COLORS.trunk, 0.55),
    tilted(0.6, 0.07, 0.03, 0, 0.24, 0.035, COLORS.trunk, -0.55),
    blob(0.2, 0.3, 0.0, -0.08, COLORS.sand, 0.3),
    blob(0.11, -0.38, 0.07, 0.02, COLORS.dryBush, 0.8),
  ];
}


// ------------------------------------------------------------------ house kits (kits.ts)

/**
 * The pieces of the house kits, each in its own space (see kits.ts for where they stand). Built
 * with the colour in the vertices (`buildKit`), so a piece costs one draw call (two with cloth or
 * leaves) however many colours it has.
 */
const KIT_MAKERS: Record<KitKey, () => Piece[]> = {
  // A ladder leaning back on a wall behind it, up to a roof at 1.5.
  'kit-ladder': () => [
    rod([-0.12, 0, 0], [-0.12, 1.55, -0.3], 0.022, COLORS.wood),
    rod([0.12, 0, 0], [0.12, 1.55, -0.3], 0.022, COLORS.wood),
    ...[0.25, 0.5, 0.75, 1.0, 1.25].map((y) => box(0.24, 0.025, 0.03, 0, y, -(y / 1.55) * 0.3, COLORS.wood)),
  ],
  // A reed mat with figs drying and a basket.
  'kit-figs': () => [
    box(0.5, 0.015, 0.36, 0, 0, 0, COLORS.reed),
    ...[0, 1, 2, 3].flatMap((i) => [0, 1, 2].map((j) => blob(0.032, -0.17 + i * 0.1, 0.03, -0.1 + j * 0.1, COLORS.fig, 0.6))),
    cyl(0.07, 0.055, 0.09, 6, 0.33, 0, 0.12, COLORS.ochre),
  ],
  // A tabun: a clay dome with its dark mouth, and a pile of sticks.
  'kit-oven': () => [
    cyl(0.15, 0.17, 0.14, 7, 0, 0, 0, COLORS.mudDark),
    blob(0.15, 0, 0.14, 0, COLORS.mudDark, 0.65),
    box(0.09, 0.08, 0.04, 0, 0.06, 0.15, COLORS.dark),
    ...[-0.05, 0, 0.05].map((z, k) => tilted(0.32, 0.035, 0.035, 0.27, 0.02 + (k % 2) * 0.03, z, COLORS.trunk, 0, Math.PI / 2 + z)),
  ],
  // An upper room on a mud roof: walls, a roof slab with beam ends, a door and a small window.
  'kit-room-mud': () => [
    box(0.62, 0.46, 0.5, 0, 0, 0, COLORS.kitMud),
    box(0.7, 0.05, 0.58, 0, 0.46, 0, COLORS.kitMudRoof),
    ...[-0.24, -0.08, 0.08, 0.24].map((x) => box(0.04, 0.04, 0.07, x, 0.4, 0.27, COLORS.wood)),
    box(0.16, 0.3, 0.02, 0.12, 0, 0.255, COLORS.dark),
    box(0.1, 0.08, 0.02, -0.16, 0.26, 0.255, COLORS.dark),
  ],
  // An upper storey of limestone: coping, a wooden door and a window.
  'kit-room-stone': () => [
    box(0.62, 0.5, 0.5, 0, 0, 0, COLORS.kitStone),
    box(0.68, 0.05, 0.56, 0, 0.5, 0, COLORS.kitStoneDark),
    box(0.16, 0.32, 0.02, -0.12, 0, 0.255, COLORS.wood),
    box(0.1, 0.12, 0.02, 0.16, 0.24, 0.255, COLORS.dark),
  ],
  // A striped awning on four poles.
  'kit-awning': () => [
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => cyl(0.016, 0.016, 0.5, 4, sx * 0.38, 0, sz * 0.27, COLORS.wood))),
    ...[0, 1, 2, 3].map((k) => sail(0.2, 0.02, 0.6, -0.3 + k * 0.2, 0.49, 0, k % 2 ? COLORS.cloth : COLORS.red)),
  ],
  // A rug over a parapet: its top on the coping (y 0), hanging down the front.
  'kit-rug': () => [
    box(0.42, 0.012, 0.12, 0, 0, -0.04, COLORS.red),
    hanging(0.42, 0.34, 0.014, 0, -0.34, 0.025, COLORS.red),
    hanging(0.42, 0.05, 0.016, 0, -0.24, 0.034, COLORS.blue),
  ],
  // A grapevine up the wall behind it, on a pergola, with bunches of grapes.
  'kit-vine': () => [
    cyl(0.03, 0.045, 1.0, 5, 0, 0, 0.05, COLORS.trunk),
    ...[-0.25, 0.25].flatMap((x) => [cyl(0.02, 0.02, 1.0, 4, x, 0, 0.24, COLORS.wood), box(0.035, 0.035, 0.26, x, 0.98, 0.12, COLORS.wood)]),
    box(0.56, 0.035, 0.035, 0, 0.98, 0.24, COLORS.wood),
    blob(0.17, -0.18, 1.06, 0.12, COLORS.leaf, 0.5),
    blob(0.16, 0.06, 1.08, 0.18, COLORS.leafDark, 0.5),
    blob(0.15, 0.24, 1.05, 0.1, COLORS.leaf, 0.5),
    blob(0.1, -0.06, 0.55, 0.06, COLORS.leafDark, 0.8),
    blob(0.08, 0.06, 0.8, 0.06, COLORS.leaf, 0.8),
    ...([[-0.12, 0.27], [0.14, 0.2], [0.02, 0.3]] as const).map(([x, z]) => blob(0.045, x, 0.9, z, COLORS.grape, 1.3)),
  ],
  // An arched gate in a low wall.
  'kit-arch': () => {
    const arch = new THREE.TorusGeometry(0.26, 0.06, 4, 8, Math.PI);
    arch.translate(0, 0.62, 0);
    return [
      box(0.12, 0.62, 0.12, -0.26, 0, 0, COLORS.kitStoneDark),
      box(0.12, 0.62, 0.12, 0.26, 0, 0, COLORS.kitStoneDark),
      { geo: arch, color: COLORS.kitStoneDark },
      box(0.1, 0.09, 0.13, 0, 0.84, 0, COLORS.kitStone),
      box(0.32, 0.3, 0.1, -0.48, 0, 0, COLORS.kitStone),
      box(0.32, 0.3, 0.1, 0.48, 0, 0, COLORS.kitStone),
    ];
  },
  // A fig tree: a short trunk and broad dark crowns.
  'kit-fig': () => [
    cyl(0.04, 0.06, 0.5, 5, 0, 0, 0, COLORS.trunk),
    rod([0, 0.4, 0], [0.16, 0.58, 0.08], 0.025, COLORS.trunk),
    blob(0.27, 0, 0.72, 0, COLORS.leafDark, 0.65, 1),
    blob(0.19, 0.18, 0.62, 0.1, COLORS.leaf, 0.7),
    blob(0.17, -0.16, 0.64, -0.08, COLORS.leaf, 0.7),
  ],
  // A cistern: a stone ring with a windlass and a bucket.
  'kit-cistern': () => [
    cyl(0.16, 0.17, 0.16, 8, 0, 0, 0, COLORS.kitStoneDark),
    cyl(0.12, 0.12, 0.01, 8, 0, 0.155, 0, COLORS.dark),
    box(0.03, 0.34, 0.03, -0.15, 0, 0, COLORS.wood),
    box(0.03, 0.34, 0.03, 0.15, 0, 0, COLORS.wood),
    box(0.33, 0.03, 0.03, 0, 0.31, 0, COLORS.wood),
    cyl(0.04, 0.032, 0.07, 6, 0.08, 0.16, 0.11, COLORS.wood),
  ],
  // An upright loom with a half-woven cloth and loom weights.
  'kit-loom': () => [
    box(0.03, 0.6, 0.03, -0.2, 0, 0, COLORS.wood),
    box(0.03, 0.6, 0.03, 0.2, 0, 0, COLORS.wood),
    box(0.46, 0.04, 0.04, 0, 0.57, 0, COLORS.wood),
    hanging(0.36, 0.38, 0.012, 0, 0.18, 0, COLORS.blue),
    hanging(0.36, 0.06, 0.014, 0, 0.36, 0.008, COLORS.red),
    ...[-0.15, -0.075, 0, 0.075, 0.15].map((x) => blob(0.025, x, 0.12, 0.01, COLORS.rock)),
  ],
  // A tripod over the fire with a cooking pot.
  'kit-tripod': () => [
    ...[0, 1, 2].map((k) => rod([Math.sin(k * 2.09) * 0.17, 0, Math.cos(k * 2.09) * 0.17], [0, 0.5, 0], 0.012, COLORS.wood)),
    rod([0, 0.5, 0], [0, 0.3, 0], 0.005, COLORS.dark),
    blob(0.075, 0, 0.24, 0, COLORS.dark, 0.85),
  ],
  // A tent's front fly: a goat-hair cloth from the eaves to two poles, with guy ropes.
  'kit-fly': () => [
    rod([-0.42, 0, 0.18], [-0.42, 0.72, 0.18], 0.018, COLORS.wood),
    rod([0.42, 0, 0.18], [0.42, 0.72, 0.18], 0.018, COLORS.wood),
    sail(0.95, 0.025, 0.44, 0, 0.74, -0.02, COLORS.goatHair, 0, 0.3),
    rod([-0.42, 0.72, 0.18], [-0.55, 0, 0.3], 0.006, COLORS.dark),
    rod([0.42, 0.72, 0.18], [0.55, 0, 0.3], 0.006, COLORS.dark),
  ],
  // Two goats tied at a manger (a dark one and a white one).
  'kit-goats': () => [
    box(0.42, 0.13, 0.12, 0, 0, -0.06, COLORS.wood),
    box(0.38, 0.02, 0.09, 0, 0.13, -0.06, COLORS.wheat),
    ...goat(-0.1, 0.1, COLORS.goatHair),
    ...goat(0.13, 0.12, COLORS.goatWhite),
  ],
  // A lean-to beside the tent: pale walls under a sloping goat-hair roof.
  'kit-lean': () => [
    box(0.6, 0.36, 0.42, 0, 0, 0, COLORS.tentWall),
    sail(0.72, 0.025, 0.54, 0, 0.36, 0, COLORS.goatHair, 0, -0.28),
    rod([-0.36, 0, 0.27], [-0.36, 0.42, 0.27], 0.015, COLORS.wood),
    rod([0.36, 0, 0.27], [0.36, 0.42, 0.27], 0.015, COLORS.wood),
  ],
  // Woven bands hanging along a tent wall (the wall behind, -z), from y 0 down.
  'kit-stripes': () => [hanging(1.0, 0.12, 0.016, 0, -0.14, 0.012, COLORS.red), hanging(1.0, 0.08, 0.016, 0, -0.3, 0.012, COLORS.cloth)],
};

/** A goat standing along x (head to +x) at (x, z). */
function goat(x: number, z: number, color: number): Piece[] {
  return [
    box(0.22, 0.1, 0.1, x, 0.12, z, color),
    box(0.08, 0.08, 0.07, x + 0.13, 0.2, z, color),
    box(0.02, 0.06, 0.02, x + 0.12, 0.27, z, COLORS.dark),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box(0.025, 0.12, 0.025, x + sx * 0.08, 0, z + sz * 0.035, color))),
  ];
}

const kitMaterials = new Map<string, THREE.Material>();

type KitKind = 'solid' | 'cloth' | 'sway' | 'road';

/** A material that takes its colour from the vertices: solid, cloth in the wind, leaves that sway, or road (no snow settles). */
function kitMat(kind: KitKind): THREE.Material {
  let m = kitMaterials.get(kind);
  if (!m) {
    const base = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: kind === 'cloth' ? 0.95 : 0.92, metalness: 0, flatShading: true });
    m = patch(base, kind === 'cloth' ? { snow: true, cloth: true } : kind === 'sway' ? { snow: true, wind: WIND.trees } : kind === 'road' ? {} : { snow: true });
    kitMaterials.set(kind, m);
  }
  return m;
}

/** Merges a kit piece with its colours in the vertices: one part solid, one cloth, one leaves (and with `roads`, one of road colours). */
function buildKit(pieces: Piece[], roads = false): Prototype {
  const groups = new Map<KitKind, THREE.BufferGeometry[]>();
  const c = new THREE.Color();
  for (const p of pieces) {
    const kind: KitKind = p.cloth ? 'cloth' : SWAYING.includes(p.color) ? 'sway' : roads && ROAD_COLORS.includes(p.color) ? 'road' : 'solid';
    const g = p.cloth ? flapped(clean(p.geo), p.cloth) : clean(p.geo);
    c.setHex(p.color);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    groups.set(kind, [...(groups.get(kind) ?? []), g]);
  }
  return { parts: [...groups].map(([kind, geos]) => ({ geometry: mergeGeometries(geos)!, material: kitMat(kind) })) };
}

/**
 * A model mirrored left to right (x to -x), with its faces turned back the right way out: an
 * instanced mesh cannot flip one copy, so a mirrored house is its own prototype.
 */
export function mirrored(p: Prototype): Prototype {
  const flip = new THREE.Matrix4().makeScale(-1, 1, 1);
  return {
    ...p,
    parts: p.parts.map(({ geometry, material }) => {
      const g = geometry.clone().applyMatrix4(flip);
      if (g.index) {
        const a = g.index.array;
        for (let i = 0; i < a.length; i += 3) [a[i + 1], a[i + 2]] = [a[i + 2], a[i + 1]];
        g.index.needsUpdate = true;
      } else
        for (const attr of Object.values(g.attributes) as THREE.BufferAttribute[]) {
          const a = attr.array;
          const k = attr.itemSize;
          for (let t = 0; t < attr.count; t += 3)
            for (let j = 0; j < k; j++) [a[(t + 1) * k + j], a[(t + 2) * k + j]] = [a[(t + 2) * k + j], a[(t + 1) * k + j]];
          attr.needsUpdate = true;
        }
      return { geometry: g, material };
    }),
  };
}

/** Adds the mirrored house models of `out` (after the code models are built or a pack replaced them). */
function addMirrors(out: Record<ModelKey, Prototype>) {
  for (const key of MIRRORED_KEYS) out[key] = mirrored(out[mirrorOf(key)]);
}

/** Code-built model of each key except the additions, the kits and the mirrored houses. */
const MAKERS: Record<Exclude<ModelKey, ExtraKey | KitKey | `house-${number}-m`>, () => Piece[]> = {
  'house-0': plot,
  pasture,
  lamp,
  tannery,
  'house-1': tent,
  'house-2': mudHouse,
  'house-3': stoneHouse,
  'house-4': bigHouse,
  'field-0': () => field(CROPS[0]),
  'field-1': () => field(CROPS[1]),
  'field-2': () => field(CROPS[2]),
  'field-3': () => field(CROPS[3]),
  plaza,
  park,
  fisher,
  gatherer,
  lumber,
  quarry,
  granary,
  market,
  workshop,
  altar,
  temple,
  'temple-0': templeRuin,
  'altar-ruin': altarRuin,
  'temple-1': templePlatform,
  'temple-2': () => [...templePlatform(), ...templeWalls()],
  'temple-3': () => [...templePlatform(), ...templeWalls(), ...templePorch()],
  'rise-3': templeWalls,
  'rise-4': templePorch,
  'works-1': altarWorks,
  'works-2': works2,
  'works-3': works3,
  'works-4': works4,
  'works-5': works5,
  'altar-new': altarNew,
  tools,
  olive,
  almond,
  fig,
  palm,
  rock,
  shrub,
  stump,
  sapling,
  road,
  'road-edge': roadEdge,
  ruts,
  'road-stones': roadStones,
  flags,
  tuft,
  log,
  woodpile,
  fence,
  hay,
  shed,
  flowers,
  'flowers-b': flowersB,
  pebbles,
  verge,
  oak,
  pine,
  wood,
  trail,
  'trail-arm': trailArm,
  kerb,
  loose,
  'loose-arm': looseArm,
  pane: () => [],
  'stock-1': () => stock(1),
  'stock-2': () => stock(2),
  'stock-3': () => stock(3),
  'yard-1': yardJars,
  'craft-1': () => craft(1),
  'craft-2': () => craft(2),
  'craft-3': () => craft(3),
  'craft-4': () => craft(4),
  'craft-5': () => craft(5),
  'yard-2': yardLine,
  closed,
};

/**
 * Code models drawn as one part, their colours in the vertices like the kits: the empty plot's
 * building site and the pasture are many small pieces in a few colours, and the city can hold many;
 * the Temple's stages and works (works.ts) cost one draw call each.
 */
const ONE_PART: readonly ModelKey[] = ['house-0', 'pasture', ...SITE_KEYS];

let built: Record<ModelKey, Prototype> | null = null;

/** The code-built models, by key (built once and kept: they are reused each time the 3D view opens). */
export function codeModels(): Record<ModelKey, Prototype> {
  if (built) return built;
  const out = {} as Record<ModelKey, Prototype>;
  for (const key of MODEL_KEYS) {
    if ((MIRRORED_KEYS as ModelKey[]).includes(key)) continue;
    if ((KIT_KEYS as readonly ModelKey[]).includes(key)) {
      out[key] = buildKit(KIT_MAKERS[key as KitKey]());
      continue;
    }
    if (ONE_PART.includes(key)) {
      out[key] = buildKit(MAKERS[key as keyof typeof MAKERS]());
      continue;
    }
    const extra = extraOf(key);
    out[key] = build(extra ? (EXTRAS[extra.kind]?.(extra.level) ?? stoneDress(...footprintOf(key), extra.level)) : MAKERS[key as keyof typeof MAKERS]());
  }
  addMirrors(out);
  out.pane = { parts: [{ geometry: new THREE.PlaneGeometry(PANE_SIZE, PANE_SIZE), material: paneMaterial() }] };
  return (built = out);
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

const packs = new Map<string, Promise<Record<ModelKey, Prototype>>>();

/**
 * Loads a model pack: every key in the manifest replaces the code-built model of the same key.
 * Each .glb is flattened into parts (its meshes with their transforms baked, grouped by material),
 * centred on its footprint and standing on y = 0, so it is instanced like the code models. The
 * files load in parallel; a file that fails (offline before the first visit) keeps the code model.
 * A pack is loaded once and kept for the next openings.
 */
export function loadModelPack(manifestUrl: string, base: Record<ModelKey, Prototype>): Promise<Record<ModelKey, Prototype>> {
  let p = packs.get(manifestUrl);
  if (!p) {
    p = readPack(manifestUrl, base);
    packs.set(manifestUrl, p);
    // A pack that failed as a whole is tried again next time.
    p.catch(() => packs.delete(manifestUrl));
  }
  return p;
}

async function readPack(manifestUrl: string, base: Record<ModelKey, Prototype>): Promise<Record<ModelKey, Prototype>> {
  const res = await fetch(manifestUrl);
  if (!res.ok) throw new Error(`model pack: ${res.status}`);
  const manifest = (await res.json()) as PackManifest;
  const loader = new GLTFLoader();
  const out = { ...base };
  const root = new URL(manifestUrl, location.href);
  await Promise.all(
    (Object.entries(manifest) as [ModelKey, PackEntry][]).map(async ([key, entry]) => {
      // A model for a key the view does not draw (e.g. a newer pack) is skipped.
      if (!MODEL_KEYS.includes(key)) return;
      try {
        const gltf = await loader.loadAsync(new URL(entry.file, root).href);
        out[key] = fromObject(gltf.scene, footprintOf(key), entry);
      } catch (e) {
        console.warn(`model pack: ${key} kept the code model (${e})`);
      }
    }),
  );
  addMirrors(out);
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
  const top = (bounds.max.y - bounds.min.y) * k + (entry.yOffset ?? 0);
  return { parts, glb: true, top };
}
