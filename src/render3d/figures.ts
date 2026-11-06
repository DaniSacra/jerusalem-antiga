import * as THREE from 'three';
import { ageBand, type Cell, type GameState } from '../core';
import { BAKED, bake, Herd } from './animals';
import { betrothed, familyLead, figureLook, groupLength, groupSlots, HOLD_SLOTS, holdLoad, LOADS, memberAt, type FigureLook, type Load, type Slot } from './crowd';
import { hash } from './plan';
import type { Terrain } from './terrain';

/**
 * Low-poly people, instanced: a robe with shoulders, a head, and a cap or mantle (four draw calls for
 * any number of them). Colours come from `FigureLook` (crowd.ts); each slot keeps its look and is
 * moved every frame with `place`. Feet on y = 0, about 0.45 tall for an adult, facing +z.
 */
export class Figures {
  readonly objects: THREE.InstancedMesh[];
  private body: THREE.InstancedMesh;
  private head: THREE.InstancedMesh;
  private cap: THREE.InstancedMesh;
  private mantle: THREE.InstancedMesh;
  private looks: FigureLook[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private static zero = new THREE.Matrix4().makeScale(0, 0, 0);
  /** One mesh per load kind (only when the figures carry things), and the load of each slot. */
  private loadMeshes: Partial<Record<Load, THREE.InstancedMesh>> = {};
  private loads: (Load | null)[] = [];

  constructor(capacity: number, shadows: boolean, carry: readonly Load[] = []) {
    const n = Math.max(1, capacity);
    const mat = () => new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
    this.body = new THREE.InstancedMesh(bodyGeometry(), mat(), n);
    this.head = new THREE.InstancedMesh(headGeometry(), mat(), n);
    this.cap = new THREE.InstancedMesh(capGeometry(), mat(), n);
    this.mantle = new THREE.InstancedMesh(mantleGeometry(), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true, side: THREE.DoubleSide }), n);
    this.objects = [this.body, this.head, this.cap, this.mantle];
    for (const l of carry) {
      const mesh = new THREE.InstancedMesh(loadGeometry(l), BAKED, n);
      mesh.userData.shared = true;
      for (let i = 0; i < n; i++) mesh.setMatrixAt(i, Figures.zero);
      this.loadMeshes[l] = mesh;
      this.objects.push(mesh);
    }
    for (const o of this.objects) {
      o.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      o.castShadow = shadows;
      o.frustumCulled = false;
      o.count = 0;
    }
  }

  /** Gives slot `i` its look (colours set once). */
  dress(i: number, look: FigureLook) {
    this.looks[i] = look;
    const c = new THREE.Color();
    this.body.setColorAt(i, c.setHex(look.robe));
    this.head.setColorAt(i, c.setHex(look.skin));
    this.cap.setColorAt(i, c.setHex(look.cover));
    this.mantle.setColorAt(i, c.setHex(look.cover));
    for (const o of this.objects) if (o.instanceColor) o.instanceColor.needsUpdate = true;
  }

  /** What slot `i` carries (it rides the figure: the step, the lean and the size). */
  carry(i: number, load: Load | null) {
    const old = this.loads[i];
    if (old && old !== load) this.loadMeshes[old]?.setMatrixAt(i, Figures.zero);
    this.loads[i] = load && this.loadMeshes[load] ? load : null;
  }

  look(i: number): FigureLook {
    return this.looks[i];
  }

  /** Number of slots drawn (the first `n`). */
  set count(n: number) {
    // None at all: no draw calls.
    for (const o of this.objects) {
      o.count = n;
      o.visible = n > 0;
    }
  }

  /**
   * Puts slot `i` at (x, y, z) facing `yaw`, bent forward by `lean` (plus its stoop), rolled by
   * `roll` (the sway of a step).
   */
  place(i: number, x: number, y: number, z: number, yaw: number, lean = 0, roll = 0) {
    const l = this.looks[i];
    this.q.setFromEuler(this.e.set(lean + l.stoop, yaw, roll, 'YXZ'));
    this.m.compose(this.v.set(x, y, z), this.q, this.sc.setScalar(l.size));
    this.body.setMatrixAt(i, this.m);
    this.head.setMatrixAt(i, this.m);
    this.cap.setMatrixAt(i, l.mantle ? Figures.zero : this.m);
    this.mantle.setMatrixAt(i, l.mantle ? this.m : Figures.zero);
    const load = this.loads[i];
    if (load) this.loadMeshes[load]!.setMatrixAt(i, this.m);
  }

  /** Hides slot `i` (it keeps its place in the list). */
  hide(i: number) {
    for (const o of this.objects) o.setMatrixAt(i, Figures.zero);
  }

  /** Call once per frame after placing. */
  commit() {
    for (const o of this.objects) o.instanceMatrix.needsUpdate = true;
  }
}

type LoadPiece = { g: THREE.BufferGeometry; c: number };
const lbox = (sx: number, sy: number, sz: number, x: number, y: number, z: number, c: number, rx = 0, rz = 0): LoadPiece => {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  g.rotateX(rx);
  g.rotateZ(rz);
  g.translate(x, y, z);
  return { g, c };
};
/** Cylinder of radius r and length h; `axis` 'y' upright, 'z' lying front to back, 'x' across. */
const lcyl = (r0: number, r1: number, h: number, x: number, y: number, z: number, c: number, axis: 'x' | 'y' | 'z' = 'y', seg = 7): LoadPiece => {
  const g = new THREE.CylinderGeometry(r0, r1, h, seg);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  g.translate(x, y, z);
  return { g, c };
};
const WOOD = 0x6e4a2c;
const LIGHT_WOOD = 0xd8b07a;

/**
 * Things carried, in the figure's space (feet on y = 0, facing +z, an adult 0.45 tall; the head at
 * 0.4, the shoulders at 0.31, the right hand at x 0.09). Each is one baked mesh.
 */
const LOAD_PIECES: Record<Load, () => LoadPiece[]> = {
  jar: () => [lcyl(0.026, 0.036, 0.075, 0, 0.49, 0, 0xb5653a), lcyl(0.016, 0.022, 0.03, 0, 0.54, 0, 0xa0552f), lcyl(0.045, 0.045, 0.012, 0, 0.452, 0, 0xe6dcc4)],
  basket: () => [lcyl(0.06, 0.045, 0.055, 0.1, 0.17, 0.03, 0x9a6a3a), lbox(0.03, 0.025, 0.03, 0.09, 0.205, 0.03, 0xc89848), lbox(0.025, 0.025, 0.025, 0.115, 0.205, 0.02, 0xa8473a)],
  sack: () => {
    const g = new THREE.IcosahedronGeometry(0.075, 0);
    g.scale(1, 1.25, 0.8);
    g.translate(0, 0.3, -0.09);
    return [{ g, c: 0xb08a58 }];
  },
  sickle: () => {
    const blade = new THREE.TorusGeometry(0.04, 0.007, 3, 8, Math.PI * 1.1);
    blade.translate(0.1, 0.26, 0.04);
    return [lbox(0.014, 0.08, 0.014, 0.1, 0.2, 0.04, WOOD), { g: blade, c: 0xa8a8a8 }];
  },
  log: () => [lcyl(0.028, 0.028, 0.4, 0.06, 0.34, 0.02, 0x7a5a3a, 'z'), lcyl(0.026, 0.026, 0.006, 0.06, 0.34, 0.222, LIGHT_WOOD, 'z')],
  staff: () => [lcyl(0.008, 0.009, 0.52, 0.1, 0.26, 0.05, WOOD)],
  cart: () => [
    lbox(0.18, 0.03, 0.22, 0, 0.11, 0.26, WOOD),
    lcyl(0.06, 0.06, 0.02, -0.105, 0.06, 0.26, 0x5c3f2c, 'x', 8),
    lcyl(0.06, 0.06, 0.02, 0.105, 0.06, 0.26, 0x5c3f2c, 'x', 8),
    lbox(0.12, 0.09, 0.12, 0, 0.17, 0.27, 0xeadfc8),
    lbox(0.012, 0.012, 0.16, -0.07, 0.15, 0.1, WOOD, 0.35),
    lbox(0.012, 0.012, 0.16, 0.07, 0.15, 0.1, WOOD, 0.35),
  ],
  pot: () => [lcyl(0.03, 0.04, 0.07, 0, 0.21, 0.07, 0xb5462f), lcyl(0.02, 0.026, 0.02, 0, 0.255, 0.07, 0xa03a28)],
  hammer: () => [lbox(0.012, 0.12, 0.012, 0.1, 0.26, 0.04, WOOD, 0, 0.3), lbox(0.05, 0.025, 0.025, 0.12, 0.32, 0.04, 0x4a4a4e, 0, 0.3)],
  plank: () => [lbox(0.05, 0.016, 0.44, 0.06, 0.345, 0.02, LIGHT_WOOD)],
  bolt: () => [lcyl(0.032, 0.032, 0.15, 0.09, 0.22, 0.03, 0x3f6e9e, 'x'), lcyl(0.033, 0.033, 0.02, 0.09, 0.22, 0.03, 0xe6dcc4, 'x')],
  dyed: () => [lbox(0.11, 0.018, 0.09, 0, 0.455, 0, 0xa8473a), lbox(0.1, 0.018, 0.085, 0, 0.473, 0, 0xd8b040), lbox(0.095, 0.018, 0.08, 0, 0.491, 0, 0x3f6e9e)],
  hide: () => [lbox(0.15, 0.13, 0.014, 0, 0.27, -0.085, 0x9a6a3a, 0.08)],
  // A long pole held up before the figure, tilted forward into the branches.
  pole: () => [lcyl(0.009, 0.011, 0.8, 0.0, 0.0, 0.0, WOOD, 'y', 5)].map((p) => (p.g.rotateX(0.5), p.g.translate(0.07, 0.56, 0.19), p)),
  // An arm reaching down to the side to hold the other's hand: a sleeve and the hand.
  'hold-r': () => [lbox(0.026, 0.1, 0.026, 0.07, 0.245, 0.01, 0x8a6a4a, 0, 0.45), lbox(0.024, 0.026, 0.024, 0.088, 0.19, 0.012, 0xb98463)],
  'hold-l': () => [lbox(0.026, 0.1, 0.026, -0.07, 0.245, 0.01, 0x8a6a4a, 0, -0.45), lbox(0.024, 0.026, 0.024, -0.088, 0.19, 0.012, 0xb98463)],
};

const loadGeometries = new Map<Load, THREE.BufferGeometry>();
function loadGeometry(l: Load): THREE.BufferGeometry {
  let g = loadGeometries.get(l);
  if (!g) loadGeometries.set(l, (g = bake(LOAD_PIECES[l]())));
  return g;
}
/** Every load kind (the walkers carry any of them). */
export const ALL_LOADS = LOADS;

/** Robe (wider at the hem) with shoulders. */
function bodyGeometry(): THREE.BufferGeometry {
  const robe = new THREE.CylinderGeometry(0.055, 0.1, 0.27, 7);
  robe.translate(0, 0.135, 0);
  const shoulders = new THREE.CylinderGeometry(0.04, 0.066, 0.08, 7);
  shoulders.translate(0, 0.31, 0);
  return merge([robe, shoulders]);
}

function headGeometry(): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(0.052, 0);
  g.translate(0, 0.395, 0.005);
  return g;
}

/** A head cloth (or hair): a cap over the top and back of the head. */
function capGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(0.058, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2);
  g.translate(0, 0.4, -0.006);
  return g;
}

/** A mantle: a cap and a drape over the back and shoulders. */
function mantleGeometry(): THREE.BufferGeometry {
  const cap = new THREE.SphereGeometry(0.062, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2);
  cap.translate(0, 0.395, -0.008);
  const drape = new THREE.CylinderGeometry(0.06, 0.085, 0.2, 7, 1, true, Math.PI * 0.5, Math.PI);
  drape.translate(0, 0.3, -0.01);
  return merge([cap, drape]);
}

function merge(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const parts = gs.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of parts) for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  const out = new THREE.BufferGeometry();
  const total = parts.reduce((n, g) => n + g.attributes.position.count, 0);
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    nor.set(g.attributes.normal.array as Float32Array, o * 3);
    o += g.attributes.position.count;
  }
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

/** Point and heading at a fractional step along a cell path (cell centres). */
export function along(path: Cell[], step: number): { x: number; z: number; dx: number; dz: number } {
  const last = path.length - 1;
  const i = Math.max(0, Math.min(last, Math.floor(step)));
  const t = Math.min(1, Math.max(0, step - i));
  const a = path[i];
  const b = path[Math.min(i + 1, last)];
  const p = i > 0 ? path[i - 1] : a;
  const dx = b.x - a.x || a.x - p.x;
  const dz = b.y - a.y || a.y - p.y;
  return { x: a.x + 0.5 + (b.x - a.x) * t, z: a.y + 0.5 + (b.y - a.y) * t, dx, dz };
}

/** Cells per second the families walk in the 3D view, and seconds they rest at home before the stretch again. */
const FAMILY_SPEED = 0.8;
const FAMILY_REST = 5;

interface Walking {
  path: Cell[];
  from: number;
  last: number;
  /** First figure slot of the family; its members follow in order. */
  first: number;
  slots: Slot[];
  length: number;
  /** Donkey slot (caravans), or -1. */
  donkey: number;
  phase: number;
}

/**
 * Families and caravans walking home along the roads (`s.families`, read when the view opens) as a
 * group: adults in front, children in the middle, the old behind, and a pack donkey for a caravan
 * family (someone not yet housed); a betrothed couple on the way to marry walks side by side, hand in
 * hand. The game is paused meanwhile, so each group walks the rest of its way, goes in and walks it again.
 */
export class Families {
  readonly figures: Figures;
  readonly donkeys: Herd;
  private list: Walking[] = [];

  constructor(s: GameState, private ground: Terrain, shadows: boolean) {
    const fams = s.families.filter((f) => f.path.length > 1 && f.step < f.path.length - 1);
    const people = new Map(s.people.map((p) => [p.id, p]));
    const total = fams.reduce((n, f) => n + f.members.length, 0);
    const groups = fams.map((f) => f.members.map((id) => people.get(id)).filter((p) => p !== undefined));
    const couples = groups.map((m) => betrothed(s, m));
    this.figures = new Figures(total, shadows, couples.includes(true) ? ['hold-r', 'hold-l'] : []);
    let caravans = 0;
    let slot = 0;
    for (const [n, f] of fams.entries()) {
      const members = groups[n];
      const caravan = members.some((p) => p.houseId === null);
      const slots = couples[n]
        ? [...HOLD_SLOTS]
        : groupSlots(
            members.map((p) => ageBand(p, s.week)),
            caravan,
          );
      members.forEach((p, j) => {
        this.figures.dress(slot + j, figureLook(p.sex, ageBand(p, s.week), hash(p.id, 3)));
        if (couples[n]) this.figures.carry(slot + j, holdLoad(slots[j]));
      });
      this.list.push({ path: f.path, from: f.step, last: f.path.length - 1, first: slot, slots, length: groupLength(slots), donkey: caravan ? caravans++ : -1, phase: hash(f.id, 5) * 6 });
      slot += members.length;
    }
    this.figures.count = slot;
    this.donkeys = new Herd('donkey', caravans, shadows);
    this.donkeys.count = caravans;
  }

  get objects() {
    return [...this.figures.objects, ...this.donkeys.objects];
  }

  /** Families on the way now (for the tests). */
  get walking() {
    return this.list.length;
  }

  update(time: number) {
    for (const w of this.list) {
      const lead = familyLead(w.from, w.last, time, FAMILY_SPEED, FAMILY_REST, w.length);
      w.slots.forEach((slot, j) => {
        const isDonkey = j >= w.slots.length - (w.donkey >= 0 ? 1 : 0);
        const step = memberAt(lead, slot.back, w.from, w.last);
        const i = isDonkey ? w.donkey : w.first + j;
        if (step === null) {
          if (isDonkey) this.donkeys.hide(i);
          else this.figures.hide(i);
          return;
        }
        const p = along(w.path, step);
        const len = Math.hypot(p.dx, p.dz) || 1;
        const x = p.x - (p.dz / len) * slot.side;
        const z = p.z + (p.dx / len) * slot.side;
        const yaw = Math.atan2(p.dx, p.dz);
        // Two steps per cell: a light bob and sway.
        const ph = step * Math.PI * 4 + w.phase + j;
        const y = this.ground.height(x, z) + 0.04;
        if (isDonkey) this.donkeys.place(i, x, y + Math.abs(Math.sin(ph)) * 0.015, z, yaw, Math.sin(ph) * 0.04);
        else this.figures.place(i, x, y + Math.abs(Math.sin(ph)) * 0.022, z, yaw, 0.04, Math.sin(ph) * 0.06);
      });
    }
    this.figures.commit();
    this.donkeys.commit();
  }
}
