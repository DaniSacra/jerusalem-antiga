import * as THREE from 'three';
import { borderCells, indexOf, type Building, type GameState } from '../core';
import { CameraRig } from './camera';
import { buildCity } from './city';
import { Instancer } from './instancer';
import { Fire, Smoke, Walkers } from './life';
import { codeModels, loadModelPack, type ModelKey } from './models';
import { SKIRT, Terrain, Water } from './terrain';

/**
 * Proof of concept: the city of the real simulation drawn in 3D with Three.js.
 * URL options: ?seed=3&months=100&bot=eficiente&quality=high|low&models=<pack manifest url>
 */
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? 3);
const months = Number(params.get('months') ?? 100);
const low = params.get('quality') === 'low';
const shadows = params.get('shadows') !== 'off';

const HAZE = 0xe9cfa6;

async function start() {
  const s = buildCity(seed, months, params.get('bot') ?? 'eficiente');
  const models = params.get('models') ? await loadModelPack(params.get('models')!, codeModels()) : codeModels();

  const renderer = new THREE.WebGLRenderer({ antialias: !low, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1.25 : 2));
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  document.getElementById('view')!.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(HAZE);
  scene.fog = new THREE.Fog(HAZE, 45, 125);

  // Late-afternoon sun from the south-west, warm and low; sky and ground bounce light.
  scene.add(new THREE.HemisphereLight(0xc9dcef, 0x9a7a52, 1.1));
  const sun = new THREE.DirectionalLight(0xffc488, 3.1);
  const centre = new THREE.Vector3(s.cols / 2, 0, s.rows / 2);
  sun.position.copy(centre).add(new THREE.Vector3(-30, 20, 24));
  sun.target.position.copy(centre);
  sun.castShadow = shadows;
  sun.shadow.mapSize.setScalar(low ? 1024 : 2048);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -36;
  sc.right = sc.top = 36;
  sc.near = 1;
  sc.far = 120;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  const ground = new Terrain(s, seed);
  scene.add(ground.mesh());
  const water = new Water(s);
  scene.add(water.mesh);

  const inst = new Instancer(models);
  const smokeFrom: THREE.Vector3[] = [];
  let fire: Fire | null = null;
  const hash = (x: number, y: number, k = 0) => {
    const h = Math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453;
    return h - Math.floor(h);
  };

  for (let y = 0; y < s.rows; y++)
    for (let x = 0; x < s.cols; x++) {
      const i = indexOf(s, x, y);
      const cx = x + 0.5;
      const cz = y + 0.5;
      if (s.roads[i] && !s.grid[i]) inst.add('road', cx, ground.height(cx, cz) - 0.02, cz, 0, 1, 0.92 + hash(x, y) * 0.12);
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
    if (x > s.cols - 6 && x < s.cols + 3) continue; // the river runs on
    const kind: ModelKey = hash(k, 3) < 0.45 ? 'olive' : hash(k, 3) < 0.6 ? 'palm' : hash(k, 3) < 0.75 ? 'rock' : 'shrub';
    inst.add(kind, x, ground.height(x, z), z, hash(k, 4) * 6.28, 0.8 + hash(k, 5) * 0.5);
  }

  for (const b of s.buildings) {
    if (s.grid[indexOf(s, b.x, b.y)] !== b) continue;
    const cx = b.x + b.w / 2;
    const cz = b.y + b.h / 2;
    const y = ground.height(cx, cz);
    const rot = facing(s, b);
    const tint = 0.93 + hash(b.x, b.y, 11) * 0.12;
    inst.add(keyOf(b), cx, y, cz, rot, 1, tint);
    if (b.kind === 'house' && b.level >= 2 && hash(b.x, b.y, 12) < 0.5) smokeFrom.push(new THREE.Vector3(cx - 0.4, y + (b.level >= 4 ? 1.6 : b.level === 3 ? 1.25 : 1.0), cz - 0.4));
    if (b.kind === 'workshop') smokeFrom.push(new THREE.Vector3(cx - 0.9, y + 0.6, cz + 0.75));
    if (b.kind === 'altar') {
      fire = new Fire(new THREE.Vector3(cx, y + 1.2, cz - 0.2));
      smokeFrom.push(new THREE.Vector3(cx, y + 1.8, cz - 0.2));
      scene.add(fire.group);
    }
  }
  scene.add(inst.build(shadows));

  const houses = s.buildings.filter((b) => b.kind === 'house' && b.level > 0).length;
  const walkers = new Walkers(s, ground, Math.min(160, 12 + houses * 2), shadows);
  scene.add(...walkers.objects);
  const smoke = new Smoke(smokeFrom);
  scene.add(smoke.mesh);

  const el = renderer.domElement;
  const rig = new CameraRig(el, new THREE.Vector3(s.altar.x + 2, 0, s.altar.y + 2), { min: new THREE.Vector2(-4, -4), max: new THREE.Vector2(s.cols + 4, s.rows + 4) });
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight);
    rig.resize(innerWidth, innerHeight);
  };
  addEventListener('resize', resize);
  resize();

  // Frame-rate meter: frames over the last two seconds.
  const stamps: number[] = [];
  const hud = document.getElementById('stats')!;
  const clock = new THREE.Clock();
  let last = 0;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;
    rig.update(dt);
    water.update(t);
    walkers.update(dt, t);
    smoke.update(t);
    fire?.update(t);
    renderer.render(scene, rig.camera);
    const now = performance.now();
    stamps.push(now);
    while (stamps.length && stamps[0] < now - 2000) stamps.shift();
    if (now - last > 500) {
      last = now;
      const info = renderer.info.render;
      hud.textContent = `${fps().toFixed(0)} qps · ${s.buildings.length} construções · ${houses} casas · ${info.calls} chamadas · ${(info.triangles / 1000).toFixed(0)} mil triângulos`;
    }
  });
  const fps = () => (stamps.length > 1 ? ((stamps.length - 1) * 1000) / (stamps[stamps.length - 1] - stamps[0]) : 0);

  // Hooks for the performance script and for debugging.
  Object.assign(window, {
    poc: {
      ready: true,
      fps,
      rig,
      info: () => ({ fps: fps(), buildings: s.buildings.length, houses, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, walkers: walkers.objects[0].count, pixelRatio: renderer.getPixelRatio(), canvas: [el.width, el.height] }),
    },
  });
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

start().catch((e) => {
  document.getElementById('stats')!.textContent = `Erro: ${e}`;
  throw e;
});
