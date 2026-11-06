import * as THREE from 'three';

/**
 * Low-poly animals and boats, instanced: one mesh per kind with the colours baked in the vertices
 * (one draw call per kind for any number of them). Feet (or the keel) on y = 0, facing +z.
 */
export const HERD_KINDS = ['donkey', 'sheep', 'goat', 'chicken', 'pigeon', 'boat'] as const;
export type HerdKind = (typeof HERD_KINDS)[number];

type Piece = { g: THREE.BufferGeometry; c: number };

const boxAt = (sx: number, sy: number, sz: number, x: number, y: number, z: number, c: number, rx = 0): Piece => {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  g.rotateX(rx);
  g.translate(x, y, z);
  return { g, c };
};
const blobAt = (r: number, x: number, y: number, z: number, c: number, sy = 1, sz = 1): Piece => {
  const g = new THREE.IcosahedronGeometry(r, 0);
  g.scale(1, sy, sz);
  g.translate(x, y, z);
  return { g, c };
};
const legs = (dx: number, dz: number, h: number, w: number, c: number): Piece[] =>
  [[-dx, dz], [dx, dz], [-dx, -dz], [dx, -dz]].map(([x, z]) => boxAt(w, h, w, x, h / 2, z, c));

/** The pieces of each kind, in model units (1 = a cell). */
const MAKERS: Record<HerdKind, () => Piece[]> = {
  donkey: () => [
    boxAt(0.14, 0.13, 0.32, 0, 0.22, 0, 0x8a7e72),
    ...legs(0.05, 0.12, 0.16, 0.04, 0x8a7e72),
    boxAt(0.08, 0.16, 0.08, 0, 0.32, 0.17, 0x8a7e72, -0.5),
    boxAt(0.07, 0.07, 0.13, 0, 0.38, 0.24, 0x8a7e72),
    boxAt(0.02, 0.08, 0.02, -0.025, 0.44, 0.19, 0x5c534a),
    boxAt(0.02, 0.08, 0.02, 0.025, 0.44, 0.19, 0x5c534a),
    boxAt(0.06, 0.12, 0.16, -0.1, 0.24, -0.02, 0xb5462f),
    boxAt(0.06, 0.12, 0.16, 0.1, 0.24, -0.02, 0xb5462f),
    boxAt(0.16, 0.06, 0.18, 0, 0.31, -0.02, 0xc89848),
  ],
  sheep: () => [blobAt(0.09, 0, 0.15, 0, 0xeee6d6, 0.8, 1.35), ...legs(0.04, 0.07, 0.1, 0.025, 0x3b2f28), blobAt(0.04, 0, 0.18, 0.13, 0x3b2f28, 1, 1.3)],
  goat: () => [
    boxAt(0.09, 0.09, 0.22, 0, 0.17, 0, 0x5c4636),
    ...legs(0.03, 0.08, 0.13, 0.025, 0x3b2f28),
    boxAt(0.05, 0.06, 0.09, 0, 0.25, 0.13, 0x5c4636, -0.4),
    boxAt(0.012, 0.06, 0.012, -0.015, 0.3, 0.1, 0xc4ab82, 0.5),
    boxAt(0.012, 0.06, 0.012, 0.015, 0.3, 0.1, 0xc4ab82, 0.5),
  ],
  chicken: () => [blobAt(0.04, 0, 0.06, 0, 0xc8862c, 0.9, 1.3), blobAt(0.022, 0, 0.1, 0.04, 0xc8862c), boxAt(0.012, 0.018, 0.012, 0, 0.125, 0.045, 0xb5462f), boxAt(0.01, 0.04, 0.01, 0, 0.02, 0, 0xd29a3a)],
  // A little larger than life, so it reads from the usual zoom.
  pigeon: () => [blobAt(0.045, 0, 0.055, 0, 0xc4c8d0, 0.85, 1.4), blobAt(0.026, 0, 0.095, 0.05, 0x7a8494), boxAt(0.1, 0.008, 0.045, 0, 0.07, -0.008, 0x9aa0aa)],
  boat: () => [
    boxAt(0.22, 0.07, 0.62, 0, 0.035, 0, 0x6e4a2c),
    boxAt(0.14, 0.05, 0.16, 0, 0.09, 0.27, 0x6e4a2c),
    boxAt(0.14, 0.05, 0.16, 0, 0.09, -0.27, 0x6e4a2c),
    boxAt(0.18, 0.02, 0.06, 0, 0.08, 0.05, 0x8a6440),
    boxAt(0.012, 0.012, 0.5, 0.13, 0.09, 0.02, 0x3b2a20, 0),
    // The fisherman in the boat: robe and head.
    { g: new THREE.CylinderGeometry(0.04, 0.07, 0.17, 6).translate(0, 0.15, -0.08), c: 0xc9b48a },
    blobAt(0.04, 0, 0.27, -0.08, 0xb98463),
  ],
};

/** One geometry with colours in the vertices from coloured pieces. */
export function bake(pieces: Piece[]): THREE.BufferGeometry {
  const parts = pieces.map(({ g, c }) => {
    const n = g.index ? g.toNonIndexed() : g;
    const col = new THREE.Color(c);
    const k = n.attributes.position.count;
    const arr = new Float32Array(k * 3);
    for (let i = 0; i < k; i++) arr.set([col.r, col.g, col.b], i * 3);
    return { pos: n.attributes.position.array as Float32Array, nor: n.attributes.normal.array as Float32Array, col: arr };
  });
  const total = parts.reduce((n, p) => n + p.pos.length, 0);
  const pos = new Float32Array(total);
  const nor = new Float32Array(total);
  const col = new Float32Array(total);
  let o = 0;
  for (const p of parts) {
    pos.set(p.pos, o);
    nor.set(p.nor, o);
    col.set(p.col, o);
    o += p.pos.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

/** One shared material for every baked mesh (vertex colours, flat shaded; never disposed). */
export const BAKED = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true });

const geometries = new Map<HerdKind, THREE.BufferGeometry>();
/** The baked geometry of a kind (built once and shared; never disposed). */
export function herdGeometry(kind: HerdKind): THREE.BufferGeometry {
  let g = geometries.get(kind);
  if (!g) geometries.set(kind, (g = bake(MAKERS[kind]())));
  return g;
}

/** A herd of one kind: `capacity` slots, each moved with `place` and hidden with `hide`. */
export class Herd {
  readonly mesh: THREE.InstancedMesh;
  private tmp = new THREE.Object3D();

  constructor(kind: HerdKind, capacity: number, shadows: boolean) {
    this.mesh = new THREE.InstancedMesh(herdGeometry(kind), BAKED, Math.max(1, capacity));
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = shadows;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    // Shared geometry: the world's cleanup must not free it.
    this.mesh.userData.shared = true;
  }

  get objects(): THREE.Object3D[] {
    return [this.mesh];
  }

  set count(n: number) {
    this.mesh.count = n;
    // An empty herd draws nothing at all (no draw call).
    this.mesh.visible = n > 0;
  }

  /** Slot `i` at (x, y, z) facing `yaw`, pitched by `pitch` (head down to graze) and rolled by `roll`. */
  place(i: number, x: number, y: number, z: number, yaw: number, roll = 0, pitch = 0, scale = 1) {
    this.tmp.position.set(x, y, z);
    this.tmp.rotation.set(pitch, yaw, roll, 'YXZ');
    this.tmp.scale.setScalar(scale);
    this.tmp.updateMatrix();
    this.mesh.setMatrixAt(i, this.tmp.matrix);
  }

  hide(i: number) {
    this.tmp.scale.setScalar(0);
    this.tmp.updateMatrix();
    this.mesh.setMatrixAt(i, this.tmp.matrix);
  }

  commit() {
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
