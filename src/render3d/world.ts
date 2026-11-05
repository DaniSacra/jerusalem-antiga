import * as THREE from 'three';
import { mainRoadCells, type GameState } from '../core';
import VISUAL from '../data/visual.json';
import { Instancer } from './instancer';
import { Families } from './figures';
import { FieldHands, Fire, NightFires, Smoke, Walkers } from './life';
import type { ModelKey, Prototype } from './models';
import { cityPlan, CLOSED_AT, hash, residentsOf, walkerCount } from './plan';
import { SKIRT, Terrain, Water } from './terrain';

/** Most people working one field at the harvest (see fieldHands). */
export const MAX_HANDS = 2;

/**
 * The drawn city at one moment of the GameState: ground, river, every building, road and tree
 * (instanced, from `cityPlan`), smoke sources, fire spots, field hands, walkers and the families walking home. Built when
 * the view opens and again when the city changes (`Stage.cityChanged`); everything per frame lives in `update`.
 */
export class World {
  readonly group = new THREE.Group();
  readonly ground: Terrain;
  readonly water: Water;
  readonly walkers: Walkers;
  readonly families: Families;
  readonly smoke: Smoke;
  readonly fires: NightFires;
  readonly hands: FieldHands;
  readonly puddles: THREE.InstancedMesh;
  readonly altarFire: Fire | null = null;
  readonly houses: number;
  readonly fields: number;

  constructor(s: GameState, seed: number, models: Record<ModelKey, Prototype>, shadows: boolean) {
    this.ground = new Terrain(s, seed);
    const ground = this.ground;
    this.group.add(ground.mesh());
    this.water = new Water(s);
    this.group.add(this.water.mesh);

    const inst = new Instancer(models);
    // Smoke sources: x, y, z and a key (altar and workshops 0: always; houses by hash).
    const smoke: THREE.Vector4[] = [];
    const fires: THREE.Vector3[] = [];
    const fields: THREE.Vector3[] = [];
    const puddles: THREE.Vector3[] = [];

    const plan = cityPlan(s);
    for (const p of plan.props) inst.add(p.key, p.x, ground.height(p.x, p.z) - (p.key === 'road' ? 0.02 : 0), p.z, p.rot, p.scale, p.tint, p.sy);
    for (const { x, y } of plan.roads)
      if (hash(x, y, 20) < VISUAL.seasons.weather.puddleShare) {
        const px = x + 0.5 + (hash(x, y, 21) - 0.5) * 0.4;
        const pz = y + 0.5 + (hash(x, y, 22) - 0.5) * 0.4;
        puddles.push(new THREE.Vector3(px, ground.height(px, pz) + 0.025, pz));
      }
    // Trees and bushes on the skirt around the map, so the haze has a countryside to fade.
    for (let k = 0; k < 900; k++) {
      const x = -SKIRT + hash(k, 1) * (s.cols + SKIRT * 2);
      const z = -SKIRT + hash(k, 2) * (s.rows + SKIRT * 2);
      if (x > -1 && z > -1 && x < s.cols + 1 && z < s.rows + 1) continue;
      if (ground.isRiver(x, z)) continue;
      const kind: ModelKey = hash(k, 3) < 0.45 ? 'olive' : hash(k, 3) < 0.6 ? 'palm' : hash(k, 3) < 0.75 ? 'rock' : 'shrub';
      inst.add(kind, x, ground.height(x, z), z, hash(k, 4) * 6.28, 0.8 + hash(k, 5) * 0.5);
    }

    let altarFire: Fire | null = null;
    for (const { b, look, x: cx, z: cz, rot, scale, sy, tint } of plan.buildings) {
      const y = ground.height(cx, cz);
      inst.add(look.key, cx, y, cz, rot, scale, tint, sy);
      if (look.extra) inst.add(look.extra, cx, y, cz, rot, scale, 1, sy);
      // A point of the model (local x, z, front +z) in the world.
      const at = (lx: number, ly: number, lz: number) => new THREE.Vector3(cx + lx * Math.cos(rot) + lz * Math.sin(rot), y + ly, cz - lx * Math.sin(rot) + lz * Math.cos(rot));
      if (look.closed) {
        const [gx, gz] = CLOSED_AT[look.houseLevel as 2 | 3 | 4];
        const g = at(gx, 0, gz);
        inst.add('closed', g.x, g.y, g.z, rot);
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
        const p = at(-0.9, look.extra === 'up-workshop-3' ? 1.45 : 0.6, 0.75);
        smoke.push(new THREE.Vector4(p.x, p.y, p.z, 0));
        fires.push(at(-0.9, 0.05, 1.2));
      }
      if (b.kind === 'field') fields.push(new THREE.Vector3(cx, y, cz));
      if (b.kind === 'altar') {
        altarFire = new Fire(new THREE.Vector3(cx, y + 1.2, cz - 0.2));
        smoke.push(new THREE.Vector4(cx, y + 1.8, cz - 0.2, 0));
        fires.push(new THREE.Vector3(cx, y + 1.25, cz - 0.2));
        this.group.add(altarFire.group);
      }
    }
    this.altarFire = altarFire;
    // Braziers along the main streets (junctions), one in every few, as the 2D lamps.
    for (const c of mainRoadCells(s)) if (hash(c.x, c.y, 30) * VISUAL.lights.lampEvery < 1) fires.push(new THREE.Vector3(c.x + 0.5, ground.height(c.x + 0.5, c.y + 0.5) + 0.02, c.y + 0.5));
    this.group.add(inst.build(shadows));

    this.houses = s.buildings.filter((b) => b.kind === 'house' && b.level > 0).length;
    this.fields = fields.length;
    this.walkers = new Walkers(s, ground, walkerCount(residentsOf(s)), shadows);
    this.families = new Families(s, ground, shadows);
    this.smoke = new Smoke(smoke);
    this.fires = new NightFires(fires);
    this.hands = new FieldHands(fields, MAX_HANDS, shadows);
    this.puddles = puddleMesh(puddles);
    this.group.add(...this.walkers.objects, ...this.families.objects, this.smoke.mesh, ...this.fires.objects, ...this.hands.objects, this.puddles);
  }

  /**
   * Frees the instance buffers, geometries and textures (the city is drawn again). Materials are
   * kept: their shader programs are shared with the next build, which would compile them again.
   */
  dispose() {
    const done = new Set<object>();
    const free = (o: { dispose(): void } | null | undefined) => {
      if (!o || done.has(o)) return;
      done.add(o);
      o.dispose();
    };
    this.group.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) free(o);
      const m = o as THREE.Mesh;
      if (m.geometry) free(m.geometry);
      for (const mat of m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [])
        for (const v of Object.values(mat)) if (v instanceof THREE.Texture) free(v);
    });
    this.group.removeFromParent();
  }
}

/** Puddles on a share of the road cells: flat, glossy discs that show as the ground soaks. */
function puddleMesh(at: THREE.Vector3[]): THREE.InstancedMesh {
  const disc = new THREE.CircleGeometry(0.28, 10);
  disc.rotateX(-Math.PI / 2);
  const m = new THREE.MeshStandardMaterial({ color: 0x5d6c7a, roughness: 0.04, metalness: 0.4, transparent: true, opacity: 0, depthWrite: false });
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
