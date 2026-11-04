import * as THREE from 'three';
import { borderCells, indexOf, mainRoadCells, type Building, type GameState } from '../core';
import VISUAL from '../data/visual.json';
import { Instancer } from './instancer';
import { FieldHands, Fire, NightFires, Smoke, Walkers } from './life';
import type { ModelKey, Prototype } from './models';
import { SKIRT, Terrain, Water } from './terrain';

/** Most people working one field at the harvest (see fieldHands). */
export const MAX_HANDS = 2;

const hash = (x: number, y: number, k = 0) => {
  const h = Math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453;
  return h - Math.floor(h);
};

/** What changes the drawn city: buildings (kind, level, look), roads and trees. */
export function citySignature(s: GameState): string {
  let roads = 0;
  for (const r of s.roads) if (r) roads++;
  let trees = 0;
  for (const f of s.feature) if (f) trees++;
  return `${roads}|${trees}|${s.buildings.map((b) => `${b.id}:${b.level}:${b.connected ? 1 : 0}`).join(',')}`;
}

/**
 * The drawn city at one moment of the GameState: ground, river, every building, road and tree
 * (instanced), smoke sources, fire spots, field hands and walkers. Rebuilt as a whole when the
 * city changes (a few milliseconds), everything per frame lives in `update`.
 */
export class World {
  readonly group = new THREE.Group();
  readonly ground: Terrain;
  readonly water: Water;
  readonly walkers: Walkers;
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

    for (let y = 0; y < s.rows; y++)
      for (let x = 0; x < s.cols; x++) {
        const i = indexOf(s, x, y);
        const cx = x + 0.5;
        const cz = y + 0.5;
        if (s.roads[i] && !s.grid[i]) {
          inst.add('road', cx, ground.height(cx, cz) - 0.02, cz, 0, 1, 0.92 + hash(x, y) * 0.12);
          if (hash(x, y, 20) < VISUAL.seasons.weather.puddleShare) puddles.push(new THREE.Vector3(cx + (hash(x, y, 21) - 0.5) * 0.4, ground.height(cx, cz) + 0.025, cz + (hash(x, y, 22) - 0.5) * 0.4));
        }
        const f = s.feature[i];
        if (f && !s.grid[i]) {
          const jx = cx + (hash(x, y, 1) - 0.5) * 0.4;
          const jz = cz + (hash(x, y, 2) - 0.5) * 0.4;
          inst.add(f, jx, ground.height(jx, jz), jz, hash(x, y, 3) * 6.28, 0.85 + hash(x, y, 4) * 0.4, 0.9 + hash(x, y, 5) * 0.2);
        } else if (!s.grid[i] && !s.roads[i] && s.ground[i] === 'grass' && hash(x, y, 6) < 0.35) {
          const jx = cx + (hash(x, y, 7) - 0.5) * 0.7;
          const jz = cz + (hash(x, y, 8) - 0.5) * 0.7;
          inst.add('shrub', jx, ground.height(jx, jz), jz, 0, 0.7 + hash(x, y, 9) * 0.8, 0.85 + hash(x, y, 10) * 0.3);
        }
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
    for (const b of s.buildings) {
      if (s.grid[indexOf(s, b.x, b.y)] !== b) continue;
      const cx = b.x + b.w / 2;
      const cz = b.y + b.h / 2;
      const y = ground.height(cx, cz);
      const rot = facing(s, b);
      inst.add(keyOf(b), cx, y, cz, rot, 1, 0.93 + hash(b.x, b.y, 11) * 0.12);
      // A point of the model (local x, z, front +z) in the world.
      const at = (lx: number, ly: number, lz: number) => new THREE.Vector3(cx + lx * Math.cos(rot) + lz * Math.sin(rot), y + ly, cz - lx * Math.sin(rot) + lz * Math.cos(rot));
      if (b.kind === 'house' && b.level >= 2) {
        const p = at(b.level >= 3 ? -0.5 : -0.4, b.level >= 4 ? 1.6 : b.level === 3 ? 1.3 : 1.05, b.level >= 3 ? -0.55 : -0.4);
        smoke.push(new THREE.Vector4(p.x, p.y, p.z, 0.05 + hash(b.x, b.y, 12) * 0.95));
      }
      if (b.kind === 'house' && b.level === 1) {
        const p = at(-0.55, 0.06, 0.6);
        fires.push(p);
        smoke.push(new THREE.Vector4(p.x, p.y + 0.2, p.z, 0.05 + hash(b.x, b.y, 12) * 0.95));
      }
      if (b.kind === 'workshop') {
        const p = at(-0.9, 0.6, 0.75);
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
    this.walkers = new Walkers(s, ground, Math.min(160, 12 + this.houses * 2), shadows);
    this.smoke = new Smoke(smoke);
    this.fires = new NightFires(fires);
    this.hands = new FieldHands(fields, MAX_HANDS, shadows);
    this.puddles = puddleMesh(puddles);
    this.group.add(...this.walkers.objects, this.smoke.mesh, ...this.fires.objects, ...this.hands.objects, this.puddles);
  }

  dispose() {
    this.group.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) o.dispose();
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

/** Model of a building: houses by level, fields by crop, the rest by kind. */
function keyOf(b: Building): ModelKey {
  if (b.kind === 'house') return `house-${b.level}` as ModelKey;
  if (b.kind === 'field') return `field-${b.variant % 4}` as ModelKey;
  return b.kind as ModelKey;
}

/** Turn so the front (+z) faces a road next to the building; fixed for the big and long ones. */
function facing(s: GameState, b: Building): number {
  if (b.kind === 'altar' || b.kind === 'temple') return 0;
  // Long buildings placed across (the market 4x2) turn their long side along x.
  if (b.w > b.h) return Math.PI / 2;
  const sides: [number, (c: { x: number; y: number }) => boolean][] = [
    [0, (c) => c.y === b.y + b.h],
    [Math.PI / 2, (c) => c.x === b.x + b.w],
    [-Math.PI / 2, (c) => c.x === b.x - 1],
    [Math.PI, (c) => c.y === b.y - 1],
  ];
  const road = borderCells(s, b).filter((c) => s.roads[indexOf(s, c.x, c.y)]);
  for (const [rot, on] of sides) {
    if (b.w !== b.h && Math.abs(rot) === Math.PI / 2) continue;
    if (road.some(on)) return rot;
  }
  return 0;
}
