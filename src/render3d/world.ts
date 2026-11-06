import { Pasture } from './pasture';
import * as THREE from 'three';
import { mainRoadCells, type GameState } from '../core';
import VISUAL from '../data/visual.json';
import { Instancer } from './instancer';
import { Families } from './figures';
import { FieldHands, Fire, Haulers, NightFires, Smoke, Walkers } from './life';
import type { ModelKey, Prototype } from './models';
import { cityPlan, CLOSED_AT, hash, KILN, residentsOf, walkerCount, YARD_AT } from './plan';
import { SKIRT, Terrain, Water, WATER_Y } from './terrain';

/** Most people working one field at the harvest (see fieldHands). */
export const MAX_HANDS = 2;

/** Layers of the drawn city that change apart (see `diff.ts`). */
export type CityLayer = 'buildings' | 'props' | 'people';

/**
 * The drawn city, live. Three parts built apart:
 * - the land (ground, river, the skirt's trees), built once; its flat city ground follows the
 *   roads and buildings by moving the mesh's heights (`Terrain.reshape`);
 * - the city (every building, road and tree, instanced from `cityPlan`, with smoke, fire spots,
 *   field hands and puddles), drawn again when buildings or ground props change;
 * - the people (walkers and families), drawn again only when the network or the population changes,
 *   so they do not jump back to the start of their way at every road built.
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
  fires!: NightFires;
  hands!: FieldHands;
  pasture!: Pasture;
  puddles!: THREE.InstancedMesh;
  altarFire: Fire | null = null;
  houses = 0;
  fields = 0;
  private land = new THREE.Group();
  private city = new THREE.Group();
  private people = new THREE.Group();
  /** The city's instances, and each building's copies in them (its hop, see `lift`). */
  private inst: Instancer | null = null;
  private copies = new Map<number, [ModelKey, number][]>();
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
    this.group.add(this.land, this.city, this.people);
    this.buildCity();
    this.buildPeople();
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
    for (const [key, i] of (b && this.copies.get(b.id)) ?? []) this.inst?.lift(key, i, dy, stretch);
  }

  /**
   * Draws again the layers that changed: the city part for buildings or props (with the ground under
   * it), the people part for people. Walkers read the ground height live, so a city change alone
   * leaves them walking (the stage rebuilds them once the city is quiet, see `Stage.rebuild`).
   */
  sync(layers: readonly CityLayer[]) {
    if (layers.includes('buildings') || layers.includes('props')) {
      this.ground.reshape();
      this.buildCity();
    }
    if (layers.includes('people')) this.buildPeople();
  }

  private buildCity() {
    free(this.city, this.shared);
    const s = this.s;
    const ground = this.ground;
    const inst = (this.inst = new Instancer(this.models));
    this.copies.clear();
    // Smoke sources: x, y, z and a key (altar and workshops 0: always; houses by hash).
    const smoke: THREE.Vector4[] = [];
    const fires: THREE.Vector3[] = [];
    const fields: THREE.Vector3[] = [];
    const puddles: THREE.Vector3[] = [];

    const plan = cityPlan(s);
    for (const p of plan.props) inst.add(p.key, p.x, ground.height(p.x, p.z) - (p.key.startsWith('road') ? 0.02 : 0), p.z, p.rot, p.scale, p.tint, p.sy);
    for (const { x, y } of plan.roads)
      if (hash(x, y, 20) < VISUAL.seasons.weather.puddleShare) {
        const px = x + 0.5 + (hash(x, y, 21) - 0.5) * 0.4;
        const pz = y + 0.5 + (hash(x, y, 22) - 0.5) * 0.4;
        puddles.push(new THREE.Vector3(px, ground.height(px, pz) + 0.025, pz));
      }

    let altarFire: Fire | null = null;
    for (const { b, look, stock, x: cx, z: cz, rot, scale, sy, tint } of plan.buildings) {
      const y = ground.height(cx, cz);
      const copies: [ModelKey, number][] = [[look.key, inst.add(look.key, cx, y, cz, rot, scale, tint, sy)]];
      if (look.extra) copies.push([look.extra, inst.add(look.extra, cx, y, cz, rot, scale, 1, sy)]);
      if (stock) copies.push([stock, inst.add(stock, cx, y, cz, rot, scale)]);
      if (look.craft) copies.push([look.craft, inst.add(look.craft, cx, y, cz, rot, scale)]);
      this.copies.set(b.id, copies);
      // A point of the model (local x, z, front +z) in the world.
      const at = (lx: number, ly: number, lz: number) => new THREE.Vector3(cx + lx * Math.cos(rot) + lz * Math.sin(rot), y + ly, cz - lx * Math.sin(rot) + lz * Math.cos(rot));
      if (look.closed) {
        const [gx, gz] = CLOSED_AT[look.houseLevel as 2 | 3 | 4];
        const g = at(gx, 0, gz);
        inst.add('closed', g.x, g.y, g.z, rot);
      }
      if (look.yard) {
        const g = at(YARD_AT[0] * look.yard.side, 0, YARD_AT[1]);
        copies.push([look.yard.key, inst.add(look.yard.key, g.x, g.y, g.z, rot)]);
      }
      const lv = look.vacant ? 0 : look.houseLevel;
      if (lv >= 2) {
        const p = at(lv >= 3 ? -0.5 : -0.4, lv >= 4 ? 1.6 : lv === 3 ? 1.3 : 1.05, lv >= 3 ? -0.55 : -0.4);
        smoke.push(new THREE.Vector4(p.x, p.y, p.z, 0.05 + hash(b.x, b.y, 12) * 0.95));
      }
      if (lv === 1) {
        const p = at(-0.55, 0.06, 0.6);
        fires.push(p);
        smoke.push(new THREE.Vector4(p.x, p.y + 0.2, p.z, 0.05 + hash(b.x, b.y, 12) * 0.95));
      }
      if (b.kind === 'workshop') {
        // The level-3 kiln has a tall chimney: the smoke leaves from its top.
        const p = at(KILN[0], look.extra === 'up-workshop-3' ? 1.8 : 0.95, KILN[1]);
        smoke.push(new THREE.Vector4(p.x, p.y, p.z, 0));
        fires.push(at(KILN[0], 0.05, KILN[1] + 0.35));
      }
      if (b.kind === 'field') fields.push(new THREE.Vector3(cx, y, cz));
      if (b.kind === 'altar') {
        altarFire = new Fire(new THREE.Vector3(cx, y + 1.2, cz - 0.2));
        smoke.push(new THREE.Vector4(cx, y + 1.8, cz - 0.2, 0));
        fires.push(new THREE.Vector3(cx, y + 1.25, cz - 0.2));
        this.city.add(altarFire.group);
      }
    }
    this.altarFire = altarFire;
    // Braziers along the main streets (junctions), one in every few, as the 2D lamps.
    for (const c of mainRoadCells(s)) if (hash(c.x, c.y, 30) * VISUAL.lights.lampEvery < 1) fires.push(new THREE.Vector3(c.x + 0.5, ground.height(c.x + 0.5, c.y + 0.5) + 0.02, c.y + 0.5));
    this.city.add(inst.build(this.shadows));

    this.houses = s.buildings.filter((b) => b.kind === 'house' && b.level > 0).length;
    this.fields = fields.length;
    // Keep the puddles' look (the stage sets it per frame) across rebuilds.
    const old = this.puddles?.material as THREE.MeshStandardMaterial | undefined;
    this.smoke = new Smoke(smoke);
    this.fires = new NightFires(fires);
    this.hands = new FieldHands(fields, MAX_HANDS, this.shadows);
    this.pasture = new Pasture(s, ground, () => WATER_Y + this.water.mesh.position.y, this.shadows);
    this.puddles = puddleMesh(puddles, old);
    this.city.add(this.smoke.mesh, ...this.fires.objects, ...this.hands.objects, ...this.pasture.objects, this.puddles);
  }

  private buildPeople() {
    free(this.people, this.shared);
    const s = this.s;
    this.walkers = new Walkers(s, this.ground, walkerCount(residentsOf(s)), this.shadows);
    this.families = new Families(s, this.ground, this.shadows);
    this.haulers = new Haulers(s, this.ground, this.shadows);
    this.people.add(...this.walkers.objects, ...this.families.objects, ...this.haulers.objects);
  }

  dispose() {
    for (const g of [this.land, this.city, this.people]) free(g, this.shared);
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
