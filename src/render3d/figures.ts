import * as THREE from 'three';
import { ageBand, type Cell, type GameState } from '../core';
import { familyLead, figureLook, groupLength, groupSlots, memberAt, type FigureLook, type Slot } from './crowd';
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

  constructor(capacity: number, shadows: boolean) {
    const n = Math.max(1, capacity);
    const mat = () => new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
    this.body = new THREE.InstancedMesh(bodyGeometry(), mat(), n);
    this.head = new THREE.InstancedMesh(headGeometry(), mat(), n);
    this.cap = new THREE.InstancedMesh(capGeometry(), mat(), n);
    this.mantle = new THREE.InstancedMesh(mantleGeometry(), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true, side: THREE.DoubleSide }), n);
    this.objects = [this.body, this.head, this.cap, this.mantle];
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

  look(i: number): FigureLook {
    return this.looks[i];
  }

  /** Number of slots drawn (the first `n`). */
  set count(n: number) {
    for (const o of this.objects) o.count = n;
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

/** A small grey donkey with two packs (the caravans'). Feet on y = 0, facing +z. */
export class Donkeys {
  readonly objects: THREE.InstancedMesh[];
  private tmp = new THREE.Object3D();

  constructor(capacity: number, shadows: boolean) {
    const n = Math.max(1, capacity);
    const parts: THREE.BufferGeometry[] = [];
    const box = (sx: number, sy: number, sz: number, x: number, y: number, z: number, rx = 0) => {
      const g = new THREE.BoxGeometry(sx, sy, sz);
      g.rotateX(rx);
      g.translate(x, y, z);
      parts.push(g);
    };
    box(0.14, 0.13, 0.32, 0, 0.22, 0);
    for (const [x, z] of [[-0.05, 0.12], [0.05, 0.12], [-0.05, -0.12], [0.05, -0.12]]) box(0.04, 0.16, 0.04, x, 0.08, z);
    box(0.08, 0.16, 0.08, 0, 0.32, 0.17, -0.5);
    box(0.07, 0.07, 0.13, 0, 0.38, 0.24);
    box(0.02, 0.08, 0.02, -0.025, 0.44, 0.19);
    box(0.02, 0.08, 0.02, 0.025, 0.44, 0.19);
    const packs = [new THREE.BoxGeometry(0.06, 0.12, 0.16), new THREE.BoxGeometry(0.06, 0.12, 0.16), new THREE.BoxGeometry(0.16, 0.06, 0.18)];
    packs[0].translate(-0.1, 0.24, -0.02);
    packs[1].translate(0.1, 0.24, -0.02);
    packs[2].translate(0, 0.31, -0.02);
    const donkey = new THREE.InstancedMesh(merge(parts), new THREE.MeshStandardMaterial({ color: 0x8a7e72, roughness: 0.95, flatShading: true }), n);
    const load = new THREE.InstancedMesh(merge(packs), new THREE.MeshStandardMaterial({ color: 0xb5462f, roughness: 0.95, flatShading: true }), n);
    this.objects = [donkey, load];
    for (const o of this.objects) {
      o.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      o.castShadow = shadows;
      o.frustumCulled = false;
      o.count = 0;
    }
  }

  set count(n: number) {
    for (const o of this.objects) o.count = n;
  }

  place(i: number, x: number, y: number, z: number, yaw: number, roll: number) {
    this.tmp.position.set(x, y, z);
    this.tmp.rotation.set(0, yaw, roll);
    this.tmp.scale.setScalar(1);
    this.tmp.updateMatrix();
    for (const o of this.objects) o.setMatrixAt(i, this.tmp.matrix);
  }

  hide(i: number) {
    this.tmp.scale.setScalar(0);
    this.tmp.updateMatrix();
    for (const o of this.objects) o.setMatrixAt(i, this.tmp.matrix);
  }

  commit() {
    for (const o of this.objects) o.instanceMatrix.needsUpdate = true;
  }
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
 * family (someone not yet housed). The game is paused meanwhile, so each group walks the rest of its
 * way, goes in and walks it again.
 */
export class Families {
  readonly figures: Figures;
  readonly donkeys: Donkeys;
  private list: Walking[] = [];

  constructor(s: GameState, private ground: Terrain, shadows: boolean) {
    const fams = s.families.filter((f) => f.path.length > 1 && f.step < f.path.length - 1);
    const people = new Map(s.people.map((p) => [p.id, p]));
    const total = fams.reduce((n, f) => n + f.members.length, 0);
    this.figures = new Figures(total, shadows);
    let caravans = 0;
    let slot = 0;
    for (const f of fams) {
      const members = f.members.map((id) => people.get(id)).filter((p) => p !== undefined);
      const caravan = members.some((p) => p.houseId === null);
      const slots = groupSlots(
        members.map((p) => ageBand(p, s.week)),
        caravan,
      );
      members.forEach((p, j) => this.figures.dress(slot + j, figureLook(p.sex, ageBand(p, s.week), hash(p.id, 3))));
      this.list.push({ path: f.path, from: f.step, last: f.path.length - 1, first: slot, slots, length: groupLength(slots), donkey: caravan ? caravans++ : -1, phase: hash(f.id, 5) * 6 });
      slot += members.length;
    }
    this.figures.count = slot;
    this.donkeys = new Donkeys(caravans, shadows);
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
