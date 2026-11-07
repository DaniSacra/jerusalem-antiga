import * as THREE from 'three';
import { calendar, storageFull, type GameState } from '../core';
import { SeasonClock, type TreeState } from '../game/seasons';
import { T } from '../game/strings';
import { Atmosphere } from './atmosphere';
import type { CameraRig } from './camera';
import { COLORS, CROPS, crownMaterial, materialOf, type ModelKey, type Prototype } from './models';
import { Particles } from './particles';
import { Finish } from './finish';
import { setColor, U } from './shaders';
import { mixColor } from './time/color';
import { fieldHands, frameLight, streetShare } from './time/light';
import { cropLook, isHarvest, isPlowing, season3d } from './time/season';
import { nightness } from './time/day';
import { WeatherClock, type WeatherNow } from './time/weather';
import LOOK from './look3d.json';
import { MAX_HANDS, World, type CityLayer } from './world';
import { smokeShare } from './plan';
import { SMOKE_OPACITY } from './life';
import { WATER_Y } from './terrain';

/** The Meshy model pack (public/models/meshy); keys it lacks keep the code models. */
export const PACK = './models/meshy/manifest.json';

export type Level = 'high' | 'low' | 'min';

/** Look-only overrides for tests and screenshots (the game state is untouched). */
export interface ViewOverride {
  /** Game position in weeks (week + fraction): the season shown. */
  pos?: number;
  /** Time of day (0..1). */
  day?: number;
  weather?: Partial<WeatherNow>;
  /** Forces a snowy winter and / or a dry year on the season clock. */
  force?: { snow?: boolean; drought?: boolean } | null;
}

/** WebGL 2 is there (Three.js needs it). */
export function canRun3D(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

/** Rebuilding the city waits at least this long after the last one (a road drag changes it per cell). */
const REBUILD_MS = 250;
/** People are drawn again only after the city has been still this long (ms): not on every road of a drag. */
const PEOPLE_QUIET_MS = 600;

/**
 * The drawn world and everything around it: renderer, sky and sun, the city (`World`), seasons,
 * weather, the particles and the automatic quality. A view puts `el` in the page, moves a camera
 * and calls `frame` once per animation frame.
 */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly el: HTMLCanvasElement;
  readonly scene = new THREE.Scene();
  readonly atmo: Atmosphere;
  world: World;
  level: Level = 'high';
  /** What the music listens to, set each frame: how dark it is (0..1) and the rain falling (0..1). */
  readonly ambience = { night: 0, rain: 0 };
  override: ViewOverride | null = null;
  frames = 0;
  /** The week of the last frame (its season and year read in `info()`). */
  private week = 0;
  private seasons: SeasonClock;
  private climate: SeasonClock;
  private weather: WeatherClock;
  /** The maquete finish (tilt-shift and grading), above the minimum quality. */
  private finish = new Finish();
  /** Draw calls and triangles of the scene alone in the last frame (the finish adds one call). */
  private drawn = { calls: 0, triangles: 0 };
  private fx: Record<'rain' | 'splash' | 'snow' | 'leaves' | 'petals' | 'dust', Particles>;
  private cloudOffset = new THREE.Vector2();
  private waterTint = new THREE.Color();
  private sunTint = new THREE.Color();
  private stamps: number[] = [];
  /** The first seconds (shaders compiling) do not count for the quality. */
  private checkedAt = performance.now() + 4000;
  private slow = 0;
  private pending = new Set<CityLayer>();
  private builtAt = 0;
  private size = { w: 1, h: 1 };

  constructor(
    private s: GameState,
    seed: number,
    models: Record<ModelKey, Prototype>,
    centre: THREE.Vector3,
  ) {
    const renderer = (this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }));
    renderer.setPixelRatio(this.pixelRatio(this.level));
    U.uGrain.value = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    this.el = renderer.domElement;
    try {
      this.atmo = new Atmosphere(this.scene, centre, true, 2048);
      this.world = new World(s, seed, models, true);
      this.scene.add(this.world.group);
      // Seasons and weather: the 2D game's clock (snowy years, drought, rain chances, crop phases).
      this.seasons = new SeasonClock(seed);
      this.climate = new SeasonClock(seed);
      this.weather = new WeatherClock(seed, (week) => {
        const l = this.climate.at(week, 0, this.s);
        return { rain: l.rain, levels: l.levels, snow: l.snow, season: l.season };
      });
      const box: [number, number, number] = [44, 22, 44];
      this.fx = {
        rain: new Particles({ count: 1600, shape: 'streak', size: [0.025, 0.7], box, fall: 22, drift: 1, sway: 0, colors: [0xc8d4e4], opacity: 0.55 }, seed + 1),
        splash: new Particles({ count: 260, shape: 'ring', size: [0.35, 0.35], box: [36, 1, 36], fall: 0, drift: 0, sway: 0, colors: [0xdfe8f2], opacity: 0.7 }, seed + 2),
        snow: new Particles({ count: 1000, shape: 'dot', size: [0.11, 0.11], box, fall: 1.4, drift: 0.6, sway: 0.35, colors: [0xffffff, 0xf2f6fa], opacity: 0.95 }, seed + 3),
        leaves: new Particles({ count: 260, shape: 'leaf', size: [0.16, 0.1], box: [44, 10, 44], fall: 0.9, drift: 1.2, sway: 0.6, colors: [0xc8862c, 0xa8541e, 0xd8b040, 0x8a6a24], opacity: 1 }, seed + 4),
        petals: new Particles({ count: 220, shape: 'leaf', size: [0.08, 0.06], box: [40, 8, 40], fall: 0.45, drift: 1, sway: 0.5, colors: [0xffffff, 0xf6d4e4, 0xf0c0d4, 0xfff4f8], opacity: 0.95 }, seed + 5),
        dust: new Particles({ count: 700, shape: 'dot', size: [0.16, 0.16], box: [44, 6, 44], fall: 0.05, drift: 3, sway: 0.4, colors: [0xe2c896, 0xd4b47e, 0xead8b0], opacity: 0.35 }, seed + 6),
      };
      for (const p of Object.values(this.fx)) this.scene.add(p.mesh);
    } catch (e) {
      this.dispose();
      throw e;
    }
    this.builtAt = performance.now();
  }

  private pixelRatio(l: Level) {
    return Math.min(devicePixelRatio, l === 'high' ? 2 : l === 'low' ? 1.25 : 0.9);
  }

  resize(w: number, h: number, rig: CameraRig) {
    this.size = { w, h };
    this.renderer.setSize(w, h);
    this.finish.setSize(this.renderer);
    rig.resize(w, h);
  }

  setLevel(l: Level) {
    this.level = l;
    this.renderer.setPixelRatio(this.pixelRatio(l));
    this.finish.setSize(this.renderer);
    this.renderer.shadowMap.type = l === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    const sun = this.atmo.sun.shadow;
    sun.mapSize.setScalar(l === 'high' ? 2048 : l === 'low' ? 1024 : 512);
    sun.map?.dispose();
    sun.map = null;
    const share = l === 'high' ? 1 : l === 'low' ? 0.45 : 0.25;
    // The ground's grain and patches are skipped at the minimum quality.
    U.uGrain.value = l === 'min' ? 0 : 1;
    // The idle figures cast shadows only at the highest quality.
    this.world.idleShadows = l === 'high';
    for (const o of this.world.idlers.objects) o.castShadow = l === 'high';
    for (const p of Object.values(this.fx)) p.limit(share);
    this.renderer.setSize(this.size.w, this.size.h);
  }

  /** Looks only (tests): the season, time of day and weather shown. */
  view(o: ViewOverride | null) {
    this.override = o;
    this.seasons.force(o?.force ?? null);
    this.climate.force(o?.force ?? null);
    this.weather.reset();
  }

  /** Other models arrived (the .glb pack after the code ones): the city is drawn again with them. */
  setModels(models: Record<ModelKey, Prototype>) {
    this.world.setModels(models);
  }

  /** Layers of the city changed: they are drawn again soon (at most every REBUILD_MS). */
  cityChanged(layers: readonly CityLayer[]) {
    for (const l of layers) this.pending.add(l);
  }

  /**
   * Draws again the layers that changed, when it is time: the city at most every REBUILD_MS, the
   * people (who walks the roads) only once the city has been still for PEOPLE_QUIET_MS, so a road
   * dragged across the town redraws the city alone.
   */
  private rebuild(now: number) {
    const p = this.pending;
    const city = p.has('buildings') || p.has('props');
    if (city && now - this.builtAt >= REBUILD_MS) {
      const t0 = performance.now();
      this.world.sync([...p].filter((l) => l !== 'people'));
      p.delete('buildings');
      p.delete('props');
      this.builtAt = now;
      this.lastRebuildMs = performance.now() - t0;
    } else if (!city && p.has('people') && now - this.builtAt >= PEOPLE_QUIET_MS) {
      const t0 = performance.now();
      this.world.sync(['people']);
      p.delete('people');
      this.lastRebuildMs = performance.now() - t0;
    }
  }

  /** How long the last redraw of city layers took (ms; the performance script reads it). */
  lastRebuildMs = 0;

  fps() {
    const st = this.stamps;
    return st.length > 1 ? ((st.length - 1) * 1000) / (st[st.length - 1] - st[0]) : 0;
  }

  /** The game speed (0 paused): the food workers stop with it. */
  speed = 1;

  /** Tests (dev hook): the walkers stand where they are, so a click lands on the one just found. */
  holdWalkers = false;

  /** No layer of the city waits to be drawn again (the walkers on screen are the ones that stay). */
  get settled() {
    return this.pending.size === 0;
  }

  /** The season and year shown (for tests and the dev hooks). */
  private label() {
    const cal = calendar(this.week);
    return T.view3d.label(cal.season, cal.year);
  }

  /**
   * One frame: light, season, weather, people and particles at game position `pos` (weeks) and time
   * of day `dayT`, then the picture. Returns true when the quality was just lowered.
   */

  frame(dt: number, time: number, pos: number, dayT: number, rig: CameraRig): boolean {
    const now = performance.now();
    this.rebuild(now);
    const { world, fx, atmo, renderer } = this;
    const o = this.override;
    pos = o?.pos ?? pos;
    const week = Math.floor(pos);
    const look = this.seasons.at(week, pos - week, this.s);
    const s3 = season3d(pos, look);
    // The crops' drought is per field in the shader (dry away from the river, see fields.ts); the soil dries everywhere.
    const crop = { ...cropLook(pos), soil: cropLook(pos, look.drought).soil };
    const w: WeatherNow = { ...this.weather.at(pos), ...o?.weather };
    const t = o?.day ?? dayT;
    const L = frameLight(t, t, 1, s3, w, look.clouds);
    this.ambience.night = nightness(t);
    this.ambience.rain = w.rain;

    atmo.apply(L, time, w.wind, s3.heat * (1 - w.rain), rig.camera, rig.distance);
    // Shadows: re-rendered while they show; every other or third frame at lower quality.
    renderer.shadowMap.autoUpdate = atmo.shadowLive && (this.level === 'high' || this.frames % (this.level === 'low' ? 2 : 3) === 0);

    U.uTime.value = time;
    U.uSnow.value = s3.snow;
    U.uWet.value = w.wet;
    this.cloudOffset.x += dt * (0.02 + 0.08 * w.wind);
    U.uCloudOffset.value.copy(this.cloudOffset);
    U.uCloud.value = L.clouds * (1 - L.night) * (1 - w.rain * 0.6);
    U.uWindows.value = L.windows;
    U.uWindowColor.value.setHex(0xffa850).multiplyScalar(LOOK.night.window);
    U.uGrow.value = Math.max(0.02, crop.height);
    U.uHeat.value = s3.heat * (1 - w.rain) * (1 - L.night);
    setColor(U.uSand, s3.sand);
    setColor(U.uSandDark, s3.sandDark);
    setColor(U.uGrass, s3.grass);
    setColor(U.uGrassDark, s3.grassDark);
    U.uFlowers.value = s3.flowers;
    U.uDrought.value = s3.drought;
    // Plants and crops of the season.
    materialOf(COLORS.leaf).color.setHex(s3.leaf);
    materialOf(COLORS.leafDark).color.setHex(s3.leafDark);
    materialOf(COLORS.hedge).color.setHex(s3.leafDark);
    materialOf(COLORS.palm).color.setHex(mixColor(COLORS.palm, s3.leaf, 0.35));
    // The olive crowns (two shades in one part) follow the season's leaves; almonds bloom white-pink
    // at the end of winter, figs turn yellow in autumn, both stand bare in winter.
    crownMaterial(COLORS.leaf).color.setHex(s3.leaf);
    crownOf(COLORS.almondCrown, look.almond, 0xf2dde3, s3.leaf);
    crownOf(COLORS.figCrown, look.fig, 0xf2dde3, mixColor(0x5e8a36, s3.leaf, 0.3));
    materialOf(COLORS.grass).color.setHex(s3.grass);
    materialOf(COLORS.tuft).color.setHex(s3.grass);
    materialOf(COLORS.tuftDark).color.setHex(s3.grassDark);
    for (const c of CROPS) materialOf(c).color.setHex(mixColor(crop.color, c, 0.2));
    materialOf(COLORS.soil).color.setHex(crop.soil);
    this.waterTint.setHex(mixColor(mixColor(0x3f8594, 0x6a7a84, w.rain * 0.6 + s3.snow * 0.3), 0x8a8a6a, s3.drought * 0.4));
    world.water.update(time, dt, w.rain, w.wind, s3.drought * LOOK.drought.river, this.waterTint);
    // Glints on the river: a clear sky and a low sun, most in the afternoon.
    // Contact shadow at the foot of the buildings: light in the sun, darker when the sun is weak.
    const sunny = (1 - L.night) * (1 - L.clouds) * (1 - w.rain);
    U.uContact.value = LOOK.finish.contactSun + (LOOK.finish.contactDim - LOOK.finish.contactSun) * (1 - sunny);
    const low = 1 - 0.75 * Math.min(1, Math.max(0, (L.sunDir.y - 0.45) / 0.45));
    world.water.sun(L.sunDir, rig.camera, (1 - L.night) * (1 - L.clouds) * (1 - w.rain) * low * (t > LOOK.day.noon ? 1 : 0.35));
    U.uWaterY.value = WATER_Y + world.water.mesh.position.y;
    U.uWind.value = LOOK.wind.calm + (1 - LOOK.wind.calm) * w.wind;

    world.walkers.setShare(streetShare(L.night, w.rain));
    world.walkers.update(this.holdWalkers ? 0 : dt, time);
    world.families.update(time);
    // The still life: like the walkers, fewer at night and in the rain; half at the low quality, none at
    // the minimum or from far away (specks there); the olive pickers in autumn.
    const idle = this.level === 'high' ? 1 : this.level === 'low' ? LOOK.street.lowShare : 0;
    world.idlers.update(time, rig.distance > LOOK.street.farDist ? 0 : streetShare(L.night, w.rain) * idle, calendar(week).season === 'autumn');
    world.leavers.update(time);
    // Tufts and pebbles: specks from far away, and skipped at the minimum quality.
    world.detail.visible = this.level !== 'min' && rig.distance <= LOOK.detail.farDist;
    world.pasture.update(time);
    world.haulers.update(dt, time, this.speed);
    world.hands.update(time, fieldHands(isHarvest(crop.stage), isPlowing(crop.stage), L.night, w.rain), MAX_HANDS);
    // A winter without firewood: no house smokes and the tent fires are out (the altar burns on).
    const cold = this.s.cold;
    world.smoke.update(time, smokeShare(look.smoke, L.night, cold), w.wind, SMOKE_OPACITY * (1 - 0.5 * w.rain), 1 - 0.7 * L.night);
    // The quarries cut by day: dust, none at night, in the rain (wet stone) or with the stone store full (they stop).
    world.dust.update(time, storageFull(this.s, 'stone') ? 0 : 1, w.wind, LOOK.fx.quarryDust.opacity * (1 - L.night) * (1 - w.wet), 1);
    world.fires.update(time, L.night, w.rain, renderer.getPixelRatio(), cold);
    world.flames.update(time, L.night, w.rain, cold);
    world.doors.update(L.night, L.windows, w.rain);
    // Puddles on bare roads only (none on the snow).
    const puddles = w.puddles * (1 - s3.snow);
    world.puddles.visible = puddles > 0.01;
    (world.puddles.material as THREE.MeshStandardMaterial).opacity = puddles * 0.85;

    // Particles around the view centre; dimmer at night.
    const c = rig.focus;
    const lum = 1 - 0.65 * L.night;
    const windX = w.wind * 6;
    fx.rain.update(time, c, w.snowing ? 0 : w.rain, windX, lum);
    fx.splash.update(time, c, w.snowing ? 0 : w.rain, 0, lum, world.ground.height(c.x, c.z));
    fx.snow.update(time, c, w.snowing ? w.rain : 0, windX * 0.5, lum);
    fx.leaves.update(time, c, s3.leaves * (0.3 + 0.7 * w.wind) * (1 - w.rain), windX, lum);
    fx.petals.update(time, c, look.drift === 'petals' ? 0.35 + 0.65 * w.wind : 0, windX, lum);
    fx.dust.update(time, c, Math.max(s3.dust * 0.3, w.wind * (0.3 + s3.dust)) * (1 - w.wet), windX + 1, lum * this.sunTint.setHex(L.sunColor).r);

    this.week = week;
    this.frames++;
    if (this.level === 'min') {
      renderer.render(this.scene, rig.camera);
      this.drawn = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    } else this.drawn = this.finish.render(renderer, this.scene, rig.camera);
    return this.checkQuality(now);
  }

  /** Frames are being skipped on purpose (paused and still): the frame rate says nothing about the device now. */
  holdQuality() {
    this.stamps.length = 0;
    this.checkedAt = performance.now() + 1000;
    this.slow = 0;
  }

  /** Automatic quality: one step down when the frame rate stays under 30 for two windows in a row. */
  private checkQuality(now: number): boolean {
    const st = this.stamps;
    st.push(now);
    while (st.length && st[0] < now - 2000) st.shift();
    if (this.level === 'min' || now - this.checkedAt <= 2500) return false;
    this.checkedAt = now;
    this.slow = this.fps() < 30 ? this.slow + 1 : 0;
    if (this.slow < 2) return false;
    this.slow = 0;
    this.setLevel(this.level === 'high' ? 'low' : 'min');
    return true;
  }

  info() {
    const r = this.renderer;
    return { fps: this.fps(), level: this.level, calls: this.drawn.calls, finish: this.level !== 'min', triangles: this.drawn.triangles, pixelRatio: r.getPixelRatio(), canvas: [this.el.width, this.el.height], walkers: this.world?.walkers.count ?? 0, families: this.world?.families.walking ?? 0, haulers: this.world?.haulers.count ?? 0, ambient: this.world?.pasture.count ?? 0, idle: this.world?.idlers.shown ?? 0, idlePlanned: this.world?.idlers.planned ?? 0, leaving: this.world?.leavers.walking ?? 0, label: this.label(), rebuildMs: this.lastRebuildMs };
  }

  /** Stops drawing and frees the GPU (the model prototypes are kept for the next opening). */
  dispose() {
    this.renderer.setAnimationLoop(null);
    disposeScene(this.scene);
    this.finish.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.el.remove();
  }
}

/** Frees the GPU side of everything in the scene (geometries, materials and their textures). */
function disposeScene(scene: THREE.Scene) {
  const done = new Set<object>();
  const free = (o: { dispose(): void }) => {
    if (done.has(o)) return;
    done.add(o);
    o.dispose();
  };
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) free(m.geometry);
    if (o instanceof THREE.InstancedMesh) free(o);
    const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
    for (const mat of mats) {
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) free(v);
      if (mat instanceof THREE.ShaderMaterial) for (const u of Object.values(mat.uniforms)) if (u.value instanceof THREE.Texture) free(u.value);
      free(mat);
    }
  });
  const shadow = scene.children.find((o): o is THREE.DirectionalLight => o instanceof THREE.DirectionalLight)?.shadow;
  shadow?.dispose();
}

/** A fig's crown in autumn. */
const YELLOW = 0xc9a43a;

/** Recolours a tree's crown for its state of the year (bare: the crown is hidden, the branches show). */
function crownOf(color: number, state: TreeState, bloom: number, leaf: number) {
  const m = crownMaterial(color);
  m.visible = state !== 'bare';
  m.color.setHex(state === 'bloom' ? bloom : state === 'yellow' ? YELLOW : leaf);
}
