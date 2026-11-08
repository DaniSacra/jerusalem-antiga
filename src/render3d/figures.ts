import * as THREE from 'three';
import { ageBand, familySpeed, type Cell, type GameState } from '../core';
import { BAKED, bake, Herd } from './animals';
import { betrothed, familyHome, familyLead, figureLook, groupLength, groupSlots, HOLD_SLOTS, holdLoad, LOADS, memberAt, type FigureLook, type Load, type Slot } from './crowd';
import { hash } from './plan';
import type { Terrain } from './terrain';

/**
 * Low-poly people, instanced: a robe with shoulders, a head, and a cap or mantle, all in one mesh
 * (one draw call for any number of them, plus one per thing carried). Colours come from
 * `FigureLook` (crowd.ts), per copy in the vertex shader; each slot keeps its look and is moved
 * every frame with `place`. Feet on y = 0, about 0.45 tall for an adult, facing +z.
 */
export class Figures {
  readonly objects: THREE.InstancedMesh[];
  private people: THREE.InstancedMesh;
  /** Per copy: the robe, the skin, and the cover with w 1 for a mantle (0 a cap). */
  private robe: THREE.InstancedBufferAttribute;
  private skin: THREE.InstancedBufferAttribute;
  private cover: THREE.InstancedBufferAttribute;
  private looks: FigureLook[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private c = new THREE.Color();
  private static zero = new THREE.Matrix4().makeScale(0, 0, 0);
  /** One mesh per load kind (only when the figures carry things), and the load of each slot. */
  private loadMeshes: Partial<Record<Load, THREE.InstancedMesh>> = {};
  private loads: (Load | null)[] = [];

  constructor(capacity: number, shadows: boolean, carry: readonly Load[] = []) {
    const n = Math.max(1, capacity);
    const g = personGeometry();
    this.robe = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    this.skin = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    this.cover = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
    g.setAttribute('iRobe', this.robe);
    g.setAttribute('iSkin', this.skin);
    g.setAttribute('iCover', this.cover);
    this.people = new THREE.InstancedMesh(g, PERSON, n);
    this.people.customDepthMaterial = PERSON_DEPTH;
    this.objects = [this.people];
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
    this.c.setHex(look.robe);
    this.robe.setXYZ(i, this.c.r, this.c.g, this.c.b);
    this.c.setHex(look.skin);
    this.skin.setXYZ(i, this.c.r, this.c.g, this.c.b);
    this.c.setHex(look.cover);
    this.cover.setXYZW(i, this.c.r, this.c.g, this.c.b, look.mantle ? 1 : 0);
    this.robe.needsUpdate = this.skin.needsUpdate = this.cover.needsUpdate = true;
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
    this.people.setMatrixAt(i, this.m);
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

/**
 * The person's parts in its vertices (`aPart`: 0 robe, 1 head, 2 cap, 3 mantle): the head takes
 * the copy's skin, the cap and the mantle its cover, and the one it does not wear folds to a point.
 */
const PERSON_VERTEX = `
  float part = aPart;
  if (part > 1.5 && (part > 2.5) != (iCover.w > 0.5)) transformed = vec3(0.0);`;
function personShader(m: THREE.Material, colour: boolean): THREE.Material {
  m.customProgramCacheKey = () => (colour ? 'person' : 'person-depth');
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float aPart; attribute vec3 iRobe; attribute vec3 iSkin; attribute vec4 iCover;${colour ? ' varying vec3 vPart;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>${PERSON_VERTEX}${colour ? '\n  vPart = part < 0.5 ? iRobe : part < 1.5 ? iSkin : iCover.rgb;' : ''}`);
    if (colour) sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vPart;').replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= vPart;');
  };
  return m;
}
/** Shared by every set of figures (materials are kept across builds). */
const PERSON = personShader(new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), true);
const PERSON_DEPTH = personShader(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), false);

/** The four parts of a person in one geometry, each vertex marked with its part. */
function personGeometry(): THREE.BufferGeometry {
  const parts = [bodyGeometry(), headGeometry(), capGeometry(), mantleGeometry()];
  const g = merge(parts);
  const tag = new Float32Array(g.attributes.position.count);
  let o = 0;
  parts.forEach((p, k) => {
    const n = (p.index ? p.index.count : p.attributes.position.count);
    tag.fill(k, o, o + n);
    o += n;
  });
  g.setAttribute('aPart', new THREE.BufferAttribute(tag, 1));
  return g;
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
  // Its inside too (the figures are drawn front-sided): the drape turned inside out.
  const inside = drape.clone();
  const ix = inside.index!.array;
  for (let i = 0; i < ix.length; i += 3) [ix[i + 1], ix[i + 2]] = [ix[i + 2], ix[i + 1]];
  return merge([cap, drape, inside]);
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

interface Walking {
  /** The family's id (`s.families`). */
  id: number;
  /** Its people's ids: once the core drops the family, they tell moved in (housed) from gone. */
  members: number[];
  path: Cell[];
  last: number;
  /** Where the leader is along the path (`familyLead`); -Infinity until the first frame. */
  lead: number;
  /** All of them are in. */
  home: boolean;
  /** Each member's look and what they hold (a betrothed couple's hands). */
  looks: FigureLook[];
  loads: (Load | null)[];
  slots: Slot[];
  length: number;
  /** A caravan family leads a pack donkey (its slot is the last one). */
  pack: boolean;
  phase: number;
}

/**
 * Families and caravans walking home along the roads (`s.families`) as a group: adults in front,
 * children in the middle, the old behind, and a pack donkey for a caravan family (someone not yet
 * housed); a betrothed couple on the way to marry walks side by side, hand in hand. They walk by the
 * core's step (`f.step`, with the week's fraction: `familyLead`), once, from the entrance into the
 * house, and the group arriving when the core moves it in walks on until the last one is in.
 * A new part (a family set out or arrived) takes over the groups of the old one where they are.
 */
export class Families {
  readonly figures: Figures;
  readonly donkeys: Herd;
  private list: Walking[] = [];
  /** The game time of the last frame (weeks), for the groups still walking in after arriving. */
  private pos = NaN;

  constructor(private s: GameState, private ground: Terrain, shadows: boolean, prev?: Families) {
    const people = new Map(s.people.map((p) => [p.id, p]));
    const old = new Map((prev?.list ?? []).map((w) => [w.id, w]));
    this.pos = prev?.pos ?? NaN;
    for (const f of s.families) {
      const kept = old.get(f.id);
      old.delete(f.id);
      if (f.path.length < 2) continue;
      if (kept) {
        this.list.push(kept);
        continue;
      }
      const members = f.members.map((id) => people.get(id)).filter((p) => p !== undefined);
      if (!members.length) continue;
      const couple = betrothed(s, members);
      const pack = !couple && members.some((p) => p.houseId === null);
      const slots = couple ? [...HOLD_SLOTS] : groupSlots(members.map((p) => ageBand(p, s.week)), pack);
      this.list.push({
        id: f.id,
        members: f.members,
        path: f.path,
        last: f.path.length - 1,
        lead: -Infinity,
        home: false,
        looks: members.map((p) => figureLook(p.sex, ageBand(p, s.week), hash(p.id, 3))),
        loads: members.map((_, j) => (couple ? holdLoad(slots[j]) : null)),
        slots,
        length: groupLength(slots),
        pack,
        phase: hash(f.id, 5) * 6,
      });
    }
    // The groups the core has moved in, still walking through the door; a family that gave up (its
    // house gone, no way there) has left the city instead and is dropped.
    const housed = (w: Walking) => w.members.some((id) => people.get(id)?.houseId != null);
    for (const w of old.values()) if (!w.home && housed(w)) this.list.push(w);
    const total = this.list.reduce((n, w) => n + w.looks.length, 0);
    const holds = this.list.some((w) => w.loads.some((l) => l !== null));
    this.figures = new Figures(total, shadows, holds ? ['hold-r', 'hold-l'] : []);
    let slot = 0;
    for (const w of this.list)
      w.looks.forEach((look, j) => {
        this.figures.dress(slot, look);
        this.figures.carry(slot++, w.loads[j]);
      });
    this.figures.count = slot;
    const packs = this.list.filter((w) => w.pack).length;
    this.donkeys = new Herd('donkey', packs, shadows);
    this.donkeys.count = packs;
  }

  get objects() {
    return [...this.figures.objects, ...this.donkeys.objects];
  }

  /** Families on the way now (for the tests). */
  get walking() {
    return this.list.filter((w) => !w.home).length;
  }

  /** `pos`: the game time in weeks (with the fraction); the families stand still in the pause. */
  update(pos: number) {
    const s = this.s;
    const frac = pos - Math.floor(pos);
    const dWeeks = Number.isNaN(this.pos) ? 0 : Math.min(1, Math.max(0, pos - this.pos));
    this.pos = pos;
    const perWeek = familySpeed();
    let slot = 0;
    let pack = 0;
    for (const w of this.list) {
      const f = s.families.find((o) => o.id === w.id);
      // A new way (the roads changed under it): the group goes on from where the core puts it.
      if (f && f.path !== w.path) [w.path, w.last, w.lead] = [f.path, f.path.length - 1, -Infinity];
      if (!w.home) {
        w.lead = familyLead(w.lead, f ? f.step : null, frac, dWeeks, perWeek);
        w.home = familyHome(w.lead, w.length, w.last);
      }
      const first = slot;
      slot += w.looks.length;
      const donkey = w.pack ? pack++ : -1;
      w.slots.forEach((place, j) => {
        const isDonkey = j >= w.looks.length;
        const i = isDonkey ? donkey : first + j;
        const step = w.home ? null : memberAt(w.lead, place.back, 0, w.last);
        if (step === null) {
          if (isDonkey) this.donkeys.hide(i);
          else this.figures.hide(i);
          return;
        }
        const p = along(w.path, step);
        const len = Math.hypot(p.dx, p.dz) || 1;
        const x = p.x - (p.dz / len) * place.side;
        const z = p.z + (p.dx / len) * place.side;
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
