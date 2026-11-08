import { Pasture } from './pasture';
import * as THREE from 'three';
import { mainRoadCells, type GameState } from '../core';
import VISUAL from '../data/visual.json';
import { Instancer } from './instancer';
import { Families } from './figures';
import { DoorLights, FieldHands, Flames, Haulers, NightFires, Smoke, Walkers } from './life';
import LOOK from './look3d.json';
import type { ModelKey, Prototype } from './models';
import { cityPlan, CLOSED_AT, hash, houseSmokeKey, KILN, panesOf, residentsOf, walkerCount, YARD_AT } from './plan';
import { SKIRT, Terrain, Water, WATER_Y } from './terrain';
import type { Placed } from './street';
import { Idlers, Leavers } from './townsfolk';
import { groundDetail } from './detail';
import { standMap, wearMap } from './wear';
import { COURT, templeBuilt } from './works';
import type { CityLayer } from './diff';

/** Most people working one field at the harvest (see fieldHands). */
export const MAX_HANDS = 2;

/** Props that lie flat on the ground (roads), sunk a little into it. */
const FLAT_PROPS = new Set<ModelKey>(['road', 'road-edge', 'ruts', 'road-stones', 'flags', 'trail', 'trail-arm', 'kerb', 'loose', 'loose-arm']);

export type { CityLayer };

/**
 * The drawn city, live. Three parts built apart:
 * - the land (ground, river, the skirt's trees), built once; its flat city ground follows the
 *   roads and buildings by moving the mesh's heights (`Terrain.reshape`);
 * - the city (every building, road and tree, instanced from `cityPlan`, with smoke, fire spots,
 *   field hands and puddles), drawn again when buildings or ground props change;
 * - the people, in three parts drawn again apart (the walkers when the network or the population
 *   changes, the families when one sets out or arrives, the workers when a job starts or ends); each
 *   new part takes over the old one's people, so who stays keeps its place and way (life.ts, figures.ts).
 * Everything per frame lives in the parts' `update`.
 */
export class World {
  readonly group = new THREE.Group();
  readonly ground: Terrain;
  readonly water: Water;
  walkers!: Walkers;
  families!: Families;
  haulers!: Haulers;
  smoke!: Smoke;
  /** Dust over the working quarries (by day, see the stage). */
  dust!: Smoke;
  fires!: NightFires;
  hands!: FieldHands;
  pasture!: Pasture;
  puddles!: THREE.InstancedMesh;
  flames!: Flames;
  /** Warm light before the doors of the lived-in houses at night. */
  doors!: DoorLights;
  /** The still life of the streets (neighbours, buyers, pickers), drawn again with the city and the people. */
  idlers!: Idlers;
  /** Families walking out of town after leaving (kept across rebuilds). */
  readonly leavers: Leavers;
  /** The idle figures cast shadows (the highest quality only; set before a rebuild). */
  idleShadows = true;
  houses = 0;
  fields = 0;
  private land = new THREE.Group();
  private city = new THREE.Group();
  private walking = new THREE.Group();
  private homing = new THREE.Group();
  private working = new THREE.Group();
  private idle = new THREE.Group();
  private leaving = new THREE.Group();
  /** Tufts and pebbles on the open ground (the stage hides them from far away and at the minimum quality). */
  readonly detail = new THREE.Group();
  /** Where the last city build drew each building (the still life stands by them). */
  private placed: Placed[] = [];
  /** The city's instances, and each building's copies in them (its hop, see `lift`). */
  private inst: Instancer | null = null;
  /** Each building's instances (model, index, and how high above the ground it stands). */
  private copies = new Map<number, [ModelKey, number, number?][]>();
  /** The models' own geometries and textures: shared by every build (and the preview ghost), never freed here. */
  private shared = new WeakSet<object>();

  constructor(
    private s: GameState,
    seed: number,
    private models: Record<ModelKey, Prototype>,
    private shadows: boolean,
  ) {
    this.share(models);
    this.ground = new Terrain(s, seed);
    this.land.add(this.ground.mesh());
    this.water = new Water(s);
    this.land.add(this.water.mesh);
    // Trees and bushes on the skirt around the map, so the haze has a countryside to fade.
    const skirt = new Instancer(models);
    for (let k = 0; k < 900; k++) {
      const x = -SKIRT + hash(k, 1) * (s.cols + SKIRT * 2);
      const z = -SKIRT + hash(k, 2) * (s.rows + SKIRT * 2);
      if (x > -1 && z > -1 && x < s.cols + 1 && z < s.rows + 1) continue;
      if (this.ground.isRiver(x, z)) continue;
      const kind: ModelKey = hash(k, 3) < 0.45 ? 'olive' : hash(k, 3) < 0.6 ? 'palm' : hash(k, 3) < 0.75 ? 'rock' : 'shrub';
      skirt.add(kind, x, this.ground.height(x, z), z, hash(k, 4) * 6.28, 0.8 + hash(k, 5) * 0.5);
    }
    this.land.add(skirt.build(shadows));
    this.leavers = new Leavers(s, this.ground, shadows);
    this.leaving.add(...this.leavers.objects);
    this.group.add(this.land, this.city, this.detail, this.walking, this.homing, this.working, this.idle, this.leaving);
    this.buildCity();
    this.buildPeople(['walkers', 'families', 'haulers']);
  }

  /** The family of the house on cell (x, y) left the city: they walk out of town. */
  leave(x: number, y: number) {
    this.leavers.leave(x, y);
  }

  /** Other models for the city (the .glb pack arrived): its buildings and props are drawn again. */
  setModels(models: Record<ModelKey, Prototype>) {
    this.models = models;
    this.share(models);
    this.buildCity();
  }

  private share(models: Record<ModelKey, Prototype>) {
    for (const { parts } of Object.values(models))
      for (const { geometry, material } of parts) {
        this.shared.add(geometry);
        for (const v of Object.values(material)) if (v instanceof THREE.Texture) this.shared.add(v);
      }
  }

  /**
   * Lifts the building on cell (x, y) by `dy` and stretches it upward (its hop, see `WorldFx.hop`);
   * (0, 1) puts it back. A building drawn again meanwhile simply stands still.
   */
  lift(x: number, y: number, dy: number, stretch: number) {
    const s = this.s;
    const b = x >= 0 && y >= 0 && x < s.cols && y < s.rows ? s.grid[y * s.cols + x] : null;
    // A piece up on the roof rides up with the stretched house.
    for (const [key, i, up = 0] of (b && this.copies.get(b.id)) ?? []) this.inst?.lift(key, i, dy + up * (stretch - 1), stretch);
  }

  /**
   * Draws again the layers that changed: the city part for buildings or props (with the ground under
   * it), each part of the people for its own layer. Walkers read the ground height live, so a city change alone
   * leaves them walking (the stage rebuilds them once the city is quiet, see `Stage.rebuild`).
   */
  sync(layers: readonly CityLayer[]) {
    if (layers.includes('buildings') || layers.includes('props')) {
      this.ground.reshape();
      this.buildCity();
    }
    this.buildPeople(layers);
  }

  private buildCity() {
    free(this.city, this.shared);
    const s = this.s;
    const ground = this.ground;
    const inst = (this.inst = new Instancer(this.models));
    this.copies.clear();
    // Smoke sources: x, y, z and a key (altar and workshops 0: always; houses by hash).
    const smoke: THREE.Vector4[] = [];
    const dust: THREE.Vector4[] = [];
    const fires: THREE.Vector3[] = [];
    // Which fire spots are a tent's (out in a winter without firewood) or the altar's, and the tent fires.
    const fireKind: ('tent' | 'altar' | undefined)[] = [];
    const tents: THREE.Vector3[] = [];
    const fields: THREE.Vector3[] = [];
    const puddles: THREE.Vector3[] = [];
    const doors: THREE.Vector4[] = [];

    const plan = cityPlan(s);
    const wear = wearMap(s);
    ground.setWear(wear);
    ground.setStand(standMap(s));
    free(this.detail, this.shared);
    const detail = new Instancer(this.models);
    for (const d of groundDetail(s, wear)) detail.add(d.key, d.x, ground.height(d.x, d.z) - 0.01, d.z, d.rot, d.scale);
    this.detail.add(detail.build(false));
    this.placed = plan.buildings;
    for (const p of plan.props) inst.add(p.key, p.x, ground.height(p.x, p.z) - (FLAT_PROPS.has(p.key) ? 0.02 : 0), p.z, p.rot, p.scale, p.tint, p.sy);
    for (const { x, y } of plan.roads)
      if (hash(x, y, 20) < VISUAL.seasons.weather.puddleShare) {
        const px = x + 0.5 + (hash(x, y, 21) - 0.5) * 0.4;
        const pz = y + 0.5 + (hash(x, y, 22) - 0.5) * 0.4;
        puddles.push(new THREE.Vector3(px, ground.height(px, pz) + 0.025, pz));
      }

    let altar: THREE.Vector3 | null = null;
    // The altar burns once restored (works.ts); a map without a stage state keeps it burning.
    let altarFire = 1;
    for (const { b, look, stock, site, x: cx, z: cz, rot, scale, sy, tint } of plan.buildings) {
      const y = ground.height(cx, cz);
      const copies: [ModelKey, number, number?][] = [[look.key, inst.add(look.key, cx, y, cz, rot, scale, tint, sy)]];
      if (look.extra) copies.push([look.extra, inst.add(look.extra, cx, y, cz, rot, scale, 1, sy)]);
      if (stock) copies.push([stock, inst.add(stock, cx, y, cz, rot, scale)]);
      if (look.craft) copies.push([look.craft, inst.add(look.craft, cx, y, cz, rot, scale)]);
      this.copies.set(b.id, copies);
      // A point of the model (local x, z, front +z) in the world; a mirrored house mirrors x.
      const m = look.mirror;
      const at = (lx: number, ly: number, lz: number) => new THREE.Vector3(cx + m * lx * Math.cos(rot) + lz * Math.sin(rot), y + ly, cz - m * lx * Math.sin(rot) + lz * Math.cos(rot));
      for (const k of look.kit) {
        const p = at(k.x, k.y, k.z);
        copies.push([k.key, inst.add(k.key, p.x, p.y, p.z, rot + m * k.rot, k.s, tint), k.y]);
      }
      if (look.closed) {
        const [gx, gz] = CLOSED_AT[look.houseLevel as 2 | 3 | 4];
        const g = at(gx, 0, gz);
        inst.add('closed', g.x, g.y, g.z, rot);
      }
      if (look.yard) {
        const g = at(YARD_AT[0], 0, YARD_AT[1]);
        copies.push([look.yard, inst.add(look.yard, g.x, g.y, g.z, rot)]);
      }
      const lv = look.vacant ? 0 : look.houseLevel;
      // Light on the ground before the door of a lived-in house (a tent has its fire's), and in the
      // yards of the market and the workshop on the road.
      if (lv >= 2) {
        const d = at(CLOSED_AT[lv as 2 | 3 | 4][0], 0, 1.0);
        doors.push(new THREE.Vector4(d.x, d.y, d.z, LOOK.night.doorRadius[lv]));
      }
      if ((b.kind === 'market' || b.kind === 'workshop') && b.connected) {
        const d = at(0, 0, b.kind === 'market' ? 0 : 0.6);
        doors.push(new THREE.Vector4(d.x, d.y, d.z, LOOK.night.workRadius));
      }
      if (lv >= 2) {
        // The code houses' chimney; a .glb house smokes from its roof top (the chimney would be inside it).
        const p = at(lv >= 3 ? -0.5 : -0.4, Math.max(lv >= 4 ? 1.6 : lv === 3 ? 1.3 : 1.05, (this.models[look.key].top ?? 0) + 0.02), lv >= 3 ? -0.55 : -0.4);
        smoke.push(new THREE.Vector4(p.x, p.y, p.z, houseSmokeKey(b.x, b.y)));
      }
      if (lv === 1) {
        const p = at(-0.55, 0.06, 0.6);
        fires.push(p);
        fireKind[fires.length - 1] = 'tent';
        tents.push(p);
        smoke.push(new THREE.Vector4(p.x, p.y + 0.2, p.z, houseSmokeKey(b.x, b.y)));
      }
      // The .glb houses light their windows at night with panes before them (the code houses glow in their dark).
      if (this.models[look.key].glb)
        for (const [px, py, pz, prot] of panesOf(look)) {
          const p = at(px, py, pz);
          copies.push(['pane', inst.add('pane', p.x, p.y, p.z, rot + m * prot)]);
        }
      if (b.kind === 'workshop') {
        // The level-3 kiln has a tall chimney: the smoke leaves from its top.
        const p = at(KILN[0], look.extra === 'up-workshop-3' ? 1.8 : 0.95, KILN[1]);
        smoke.push(new THREE.Vector4(p.x, p.y, p.z, 0));
        fires.push(at(KILN[0], 0.05, KILN[1] + 0.35));
      }
      if (b.kind === 'field') fields.push(new THREE.Vector3(cx, y, cz));
      // Stone being cut: dust over the cut face while the quarry works (connected).
      if (b.kind === 'quarry' && b.connected) for (const [lx, lz] of [[0.35, 0.45], [-0.1, 0.75]]) dust.push(new THREE.Vector4(...at(lx, 0.2, lz).toArray(), 0));
      if (site) {
        // The Temple's stages: the stage rising, its works and the tools left (works.ts).
        for (const a of site.adds) copies.push([a.key, inst.add(a.key, cx, y + a.y, cz, rot, scale, 1, a.sy), a.y]);
        const floor = b.kind === 'temple' && templeBuilt(s) >= 1 ? COURT : 0;
        if (site.dust) for (const [lx, lz] of b.kind === 'altar' ? LOOK.works.altarDustAt : LOOK.works.dustAt) dust.push(new THREE.Vector4(...at(lx, floor + 0.2, lz).toArray(), 0));
        if (site.smokes) {
          // The consecrated Temple's altar in its court burns and smokes.
          smoke.push(new THREE.Vector4(...at(-1.55, COURT + 1.0, 1.15).toArray(), 0));
          fires.push(at(-1.55, COURT + 0.72, 1.15));
        }
        if (b.kind === 'altar') altarFire = site.fire;
      }
      if (b.kind === 'altar' && altarFire > 0) {
        altar = new THREE.Vector3(cx, y + 1.2, cz - 0.2);
        smoke.push(new THREE.Vector4(cx, y + 1.8, cz - 0.2, 0));
        fires.push(new THREE.Vector3(cx, y + 1.25, cz - 0.2));
        fireKind[fires.length - 1] = 'altar';
      }
    }
    // Braziers along the main streets (junctions), one in every few, as the 2D lamps.
    for (const c of mainRoadCells(s)) if (hash(c.x, c.y, 30) * VISUAL.lights.lampEvery < 1) fires.push(new THREE.Vector3(c.x + 0.5, ground.height(c.x + 0.5, c.y + 0.5) + 0.02, c.y + 0.5));
    this.city.add(inst.build(this.shadows));

    this.houses = s.buildings.filter((b) => b.kind === 'house' && b.level > 0).length;
    this.fields = fields.length;
    // Keep the puddles' look (the stage sets it per frame) across rebuilds.
    const old = this.puddles?.material as THREE.MeshStandardMaterial | undefined;
    this.smoke = new Smoke(smoke);
    this.dust = new Smoke(dust, { color: Number(LOOK.fx.quarryDust.color), rise: LOOK.fx.quarryDust.rise, size: LOOK.fx.quarryDust.size });
    this.fires = new NightFires(fires, fireKind);
    this.flames = new Flames(altar, tents, altarFire);
    this.hands = new FieldHands(fields, MAX_HANDS, this.shadows);
    this.pasture = new Pasture(s, ground, () => WATER_Y + this.water.mesh.position.y, this.shadows);
    this.puddles = puddleMesh(puddles, old);
    this.doors = new DoorLights(doors);
    this.city.add(this.doors.mesh, this.smoke.mesh, this.dust.mesh, this.flames.mesh, ...this.fires.objects, ...this.hands.objects, ...this.pasture.objects, this.puddles);
    this.buildIdle();
  }

  /** The still life stands by the buildings and is cast from the residents: drawn again with either. */
  private buildIdle() {
    free(this.idle, this.shared);
    this.idlers = new Idlers(this.s, this.placed, this.ground, this.idleShadows);
    this.idle.add(...this.idlers.objects);
  }

  /** The parts of the people whose layer changed, each taking over the people of the part before. */
  private buildPeople(layers: readonly CityLayer[]) {
    const s = this.s;
    if (layers.includes('walkers')) {
      const old = this.walkers;
      this.walkers = new Walkers(s, this.ground, walkerCount(residentsOf(s)), this.shadows, old);
      free(this.walking, this.shared);
      this.walking.add(...this.walkers.objects);
      // The still life is cast from the residents too.
      this.buildIdle();
    }
    if (layers.includes('families')) {
      this.families = new Families(s, this.ground, this.shadows, this.families);
      free(this.homing, this.shared);
      this.homing.add(...this.families.objects);
    }
    if (layers.includes('haulers')) {
      this.haulers = new Haulers(s, this.ground, this.shadows, this.haulers);
      free(this.working, this.shared);
      this.working.add(...this.haulers.objects);
    }
  }

  dispose() {
    for (const g of [this.land, this.city, this.detail, this.walking, this.homing, this.working, this.idle, this.leaving]) free(g, this.shared);
    this.ground.dispose();
    this.group.removeFromParent();
  }
}

/**
 * Empties a group, freeing its instance buffers, geometries and textures, but not the models' own
 * (`shared`: every build and the preview ghost use them; a freed texture of the .glb pack came back
 * dark). Materials are kept: their shader programs are shared with the next build.
 */
function free(group: THREE.Group, shared: WeakSet<object>) {
  const done = new Set<object>();
  const once = (o: { dispose(): void } | null | undefined) => {
    if (!o || done.has(o) || shared.has(o)) return;
    done.add(o);
    o.dispose();
  };
  group.traverse((o) => {
    if (o instanceof THREE.InstancedMesh) once(o);
    const m = o as THREE.Mesh;
    // Geometries kept across builds (animals, loads) are marked `userData.shared`.
    if (m.geometry && !o.userData.shared) once(m.geometry);
    for (const mat of m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [])
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) once(v);
  });
  group.clear();
}

/** Puddles on a share of the road cells: flat, glossy discs that show as the ground soaks. */
function puddleMesh(at: THREE.Vector3[], m = new THREE.MeshStandardMaterial({ color: 0x5d6c7a, roughness: 0.04, metalness: 0.4, transparent: true, opacity: 0, depthWrite: false })): THREE.InstancedMesh {
  const disc = new THREE.CircleGeometry(0.28, 10);
  disc.rotateX(-Math.PI / 2);
  const mesh = new THREE.InstancedMesh(disc, m, Math.max(1, at.length));
  const tmp = new THREE.Object3D();
  at.forEach((p, i) => {
    tmp.position.copy(p);
    tmp.scale.set(0.7 + hash(p.x, p.z, 1) * 0.8, 1, 0.5 + hash(p.x, p.z, 2) * 0.6);
    tmp.rotation.set(0, hash(p.x, p.z, 3) * 3, 0);
    tmp.updateMatrix();
    mesh.setMatrixAt(i, tmp.matrix);
  });
  mesh.count = at.length;
  mesh.receiveShadow = true;
  mesh.visible = false;
  return mesh;
}
