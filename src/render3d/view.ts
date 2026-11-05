import * as THREE from 'three';
import { calendar, type GameState } from '../core';
import { NOVA_CSS, NOVA_FONT } from '../render/palette';
import { SeasonClock } from '../render/Seasons';
import { T } from '../render/strings';
import { Atmosphere } from './atmosphere';
import { CameraRig } from './camera';
import LOOK from './look3d.json';
import { codeModels, COLORS, CROPS, loadModelPack, materialOf, type ModelKey, type Prototype } from './models';
import { Particles } from './particles';
import { setColor, U } from './shaders';
import { mixColor } from './time/color';
import { advanceDay, dayTime, DAY_SECONDS } from './time/day';
import { fieldHands, frameLight, streetShare } from './time/light';
import { cropLook, isHarvest, isPlowing, season3d } from './time/season';
import { WeatherClock, type WeatherNow } from './time/weather';
import { yawOfRotation } from './plan';
import { MAX_HANDS, World } from './world';

/** The Meshy model pack (public/models/meshy); keys it lacks keep the code models. */
const PACK = './models/meshy/manifest.json';

type Level = 'high' | 'low' | 'min';

export interface Open3DOptions {
  /** Fraction of the current week (the 2D clock), so the season blend matches the 2D. */
  weekFrac?: number;
  /** Time of day to start at (0..1, 0 = dawn, the 2D day cycle's scale); default the morning. */
  dayT?: number;
  /** Model pack manifest (null: code models only). */
  pack?: string | null;
  /**
   * Where the 3D starts, to match the 2D the player was looking at: the grid cell at the centre of
   * the 2D screen and the 2D view's quarter turns (`iso.getRotation()`). Default: the altar, turn 0.
   */
  start?: { focus: { x: number; y: number }; rotation: number };
}

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

export interface View3D {
  /** Closes the view: stops drawing, frees the GPU, removes the overlay and calls `onClose`. */
  close(): void;
}

/** WebGL 2 is there (Three.js needs it). */
export function canRun3D(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

/**
 * Opens the city in 3D: a full-screen overlay with its own canvas over the game, drawing the LIVE
 * GameState read-only (the game is paused while it is open). Day and night run on their own clock;
 * the season of the current week and the weather come from the same seeded clocks as the 2D.
 * Drag to move, pinch or wheel to zoom, two fingers or the buttons (Q/E on PC) to turn; "Voltar" or
 * Esc closes it. Throws when the device cannot draw WebGL 2.
 */
export async function open3D(state: GameState, seed: number, onClose: () => void, opts: Open3DOptions = {}): Promise<View3D> {
  if (!canRun3D()) throw new Error('no WebGL 2');
  const s = state;
  const pack = opts.pack === undefined ? PACK : opts.pack;
  let models: Record<ModelKey, Prototype> = codeModels();
  if (pack) models = await loadModelPack(pack, models).catch(() => models);

  // ---------------------------------------------------------------- overlay
  const root = document.createElement('div');
  root.className = 'v3d';
  root.innerHTML = `<style>${CSS}</style>
    <button class="v3d-back" type="button">${T.view3d.back}</button>
    <div class="v3d-label"></div>
    <div class="v3d-turn">
      <button type="button" data-turn="1" aria-label="${T.view3d.turnLeft}">${ARROW(false)}</button>
      <button type="button" data-turn="-1" aria-label="${T.view3d.turnRight}">${ARROW(true)}</button>
    </div>
    <div class="v3d-note"></div>`;
  document.body.appendChild(root);
  const label = root.querySelector<HTMLElement>('.v3d-label')!;
  const note = root.querySelector<HTMLElement>('.v3d-note')!;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    root.remove();
    throw e;
  }
  let level: Level = 'high';
  const pixelRatio = (l: Level) => Math.min(devicePixelRatio, l === 'high' ? 2 : l === 'low' ? 1.25 : 0.9);
  renderer.setPixelRatio(pixelRatio(level));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const el = renderer.domElement;
  el.className = 'v3d-canvas';
  root.prepend(el);

  // Anything failing while the scene is set up leaves no overlay or GPU context behind.
  let built = false;
  try {
    // ---------------------------------------------------------------- scene
    const scene = new THREE.Scene();
    const altar = s.buildings.find((b) => b.kind === 'altar');
    const focus = opts.start?.focus;
    const centre = focus
      ? new THREE.Vector3(Math.min(s.cols, Math.max(0, focus.x + 0.5)), 0, Math.min(s.rows, Math.max(0, focus.y + 0.5)))
      : new THREE.Vector3((altar?.x ?? s.cols / 2) + (altar?.w ?? 0) / 2, 0, (altar?.y ?? s.rows / 2) + (altar?.h ?? 0) / 2);
    const atmo = new Atmosphere(scene, centre, true, 2048);
    const world = new World(s, seed, models, true);
    scene.add(world.group);

    // Seasons and weather: the 2D game's clock (snowy years, drought, rain chances, crop phases).
    const seasons = new SeasonClock(seed);
    const climate = new SeasonClock(seed);
    const weather = new WeatherClock(seed, (week) => {
      const l = climate.at(week, 0, s);
      return { rain: l.rain, levels: l.levels, snow: l.snow, season: l.season };
    });

    const box: [number, number, number] = [44, 22, 44];
    const fx = {
      rain: new Particles({ count: 1600, shape: 'streak', size: [0.025, 0.7], box, fall: 22, drift: 1, sway: 0, colors: [0xc8d4e4], opacity: 0.55 }, seed + 1),
      splash: new Particles({ count: 260, shape: 'ring', size: [0.35, 0.35], box: [36, 1, 36], fall: 0, drift: 0, sway: 0, colors: [0xdfe8f2], opacity: 0.7 }, seed + 2),
      snow: new Particles({ count: 1000, shape: 'dot', size: [0.11, 0.11], box, fall: 1.4, drift: 0.6, sway: 0.35, colors: [0xffffff, 0xf2f6fa], opacity: 0.95 }, seed + 3),
      leaves: new Particles({ count: 260, shape: 'leaf', size: [0.16, 0.1], box: [44, 10, 44], fall: 0.9, drift: 1.2, sway: 0.6, colors: [0xc8862c, 0xa8541e, 0xd8b040, 0x8a6a24], opacity: 1 }, seed + 4),
      petals: new Particles({ count: 220, shape: 'leaf', size: [0.08, 0.06], box: [40, 8, 40], fall: 0.45, drift: 1, sway: 0.5, colors: [0xffffff, 0xf6d4e4, 0xf0c0d4, 0xfff4f8], opacity: 0.95 }, seed + 5),
      dust: new Particles({ count: 700, shape: 'dot', size: [0.16, 0.16], box: [44, 6, 44], fall: 0.05, drift: 3, sway: 0.4, colors: [0xe2c896, 0xd4b47e, 0xead8b0], opacity: 0.35 }, seed + 6),
    };
    for (const p of Object.values(fx)) scene.add(p.mesh);

    const rig = new CameraRig(el, centre.clone(), { min: new THREE.Vector2(-4, -4), max: new THREE.Vector2(s.cols + 4, s.rows + 4) });
    rig.set({ dist: 30, yaw: yawOfRotation(opts.start?.rotation ?? 0) });
    const resize = () => {
      const w = root.clientWidth || innerWidth;
      const h = root.clientHeight || innerHeight;
      renderer.setSize(w, h);
      rig.resize(w, h);
    };
    resize();

    // ---------------------------------------------------------------- quality
    // Automatic: one step down when the frame rate stays under 30 for two windows in a row.
    const setLevel = (l: Level) => {
      level = l;
      renderer.setPixelRatio(pixelRatio(l));
      renderer.shadowMap.type = l === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
      atmo.sun.shadow.mapSize.setScalar(l === 'high' ? 2048 : l === 'low' ? 1024 : 512);
      atmo.sun.shadow.map?.dispose();
      atmo.sun.shadow.map = null;
      const share = l === 'high' ? 1 : l === 'low' ? 0.45 : 0.25;
      for (const p of Object.values(fx)) p.limit(share);
      resize();
    };

    // ---------------------------------------------------------------- one frame
    const weekFrac = opts.weekFrac ?? 0;
    let dayT = dayTime(opts.dayT ?? LOOK.day.start);
    let override: ViewOverride | null = null;
    const cloudOffset = new THREE.Vector2();
    const waterTint = new THREE.Color();
    const sunTint = new THREE.Color();
    let frame = 0;
    let labelText = '';

    const frameUpdate = (dt: number, time: number) => {
      const pos = override?.pos ?? s.week + weekFrac;
      const week = Math.floor(pos);
      const look = seasons.at(week, pos - week, s);
      const s3 = season3d(pos, look);
      const crop = cropLook(pos, look.drought);
      const w: WeatherNow = { ...weather.at(pos), ...override?.weather };
      // The game is paused, but the day goes on (its own clock, as in the 2D).
      dayT = advanceDay(dayT, dt, override?.day === undefined, DAY_SECONDS);
      const t = override?.day ?? dayT;
      const L = frameLight(t, t, 1, s3, w, look.clouds);

      atmo.apply(L, time, w.wind, s3.heat * (1 - w.rain), rig.camera);
      // Shadows: re-rendered while they show; every other or third frame at lower quality.
      renderer.shadowMap.autoUpdate = atmo.shadowLive && (level === 'high' || frame % (level === 'low' ? 2 : 3) === 0);

      U.uTime.value = time;
      U.uSnow.value = s3.snow;
      U.uWet.value = w.wet;
      cloudOffset.x += dt * (0.02 + 0.08 * w.wind);
      U.uCloudOffset.value.copy(cloudOffset);
      U.uCloud.value = L.clouds * (1 - L.night) * (1 - w.rain * 0.6);
      U.uWindows.value = L.windows;
      U.uWindowColor.value.setHex(0xffa850).multiplyScalar(1.6);
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
      materialOf(COLORS.grass).color.setHex(s3.grass);
      for (const c of CROPS) materialOf(c).color.setHex(mixColor(crop.color, c, 0.2));
      materialOf(COLORS.soil).color.setHex(crop.soil);
      waterTint.setHex(mixColor(mixColor(0x3f8594, 0x6a7a84, w.rain * 0.6 + s3.snow * 0.3), 0x8a8a6a, s3.drought * 0.4));
      world.water.update(time, dt, w.rain, w.wind, s3.drought * LOOK.drought.river, waterTint);

      world.walkers.setShare(streetShare(L.night, w.rain));
      world.walkers.update(dt, time);
      world.families.update(time);
      world.hands.update(time, fieldHands(isHarvest(crop.stage), isPlowing(crop.stage), L.night, w.rain), MAX_HANDS);
      world.smoke.update(time, Math.max(look.smoke, L.night * 0.35), w.wind, 0.26 * (1 - 0.5 * w.rain));
      world.fires.update(time, L.night, w.rain, renderer.getPixelRatio());
      world.altarFire?.update(time);
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
      fx.dust.update(time, c, Math.max(s3.dust * 0.3, w.wind * (0.3 + s3.dust)) * (1 - w.wet), windX + 1, lum * sunTint.setHex(L.sunColor).r);

      const cal = calendar(week);
      const text = T.view3d.label(cal.season, cal.year);
      if (text !== labelText) label.textContent = labelText = text;
      frame++;
    };

    // ---------------------------------------------------------------- loop
    const stamps: number[] = [];
    const fps = () => (stamps.length > 1 ? ((stamps.length - 1) * 1000) / (stamps[stamps.length - 1] - stamps[0]) : 0);
    // The first seconds (shaders compiling) do not count.
    let checkedAt = performance.now() + 4000;
    let slow = 0;
    const clock = new THREE.Clock();
    const loop = () => {
      const dt = Math.min(clock.getDelta(), 0.1);
      rig.update(dt);
      frameUpdate(dt, clock.elapsedTime);
      renderer.render(scene, rig.camera);
      const now = performance.now();
      stamps.push(now);
      while (stamps.length && stamps[0] < now - 2000) stamps.shift();
      if (level !== 'min' && now - checkedAt > 2500) {
        checkedAt = now;
        slow = fps() < 30 ? slow + 1 : 0;
        if (slow >= 2) {
          slow = 0;
          setLevel(level === 'high' ? 'low' : 'min');
          note.textContent = T.view3d.lowered;
          note.classList.remove('show');
          void note.offsetWidth;
          note.classList.add('show');
        }
      }
    };

    // ---------------------------------------------------------------- controls and closing
    let closed = false;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        view.close();
      }
    };
    const turns = [...root.querySelectorAll<HTMLButtonElement>('[data-turn]')];
    const onTurn = (e: Event) => rig.turn((Number((e.currentTarget as HTMLElement).dataset.turn) * Math.PI) / 4);
    const back = root.querySelector<HTMLButtonElement>('.v3d-back')!;
    const onBack = () => view.close();
    addEventListener('keydown', onKey);
    addEventListener('resize', resize);
    back.addEventListener('click', onBack);
    for (const b of turns) b.addEventListener('click', onTurn);

    const view: View3D = {
      close() {
        if (closed) return;
        closed = true;
        renderer.setAnimationLoop(null);
        removeEventListener('keydown', onKey);
        removeEventListener('resize', resize);
        back.removeEventListener('click', onBack);
        for (const b of turns) b.removeEventListener('click', onTurn);
        rig.dispose();
        // The model prototypes are kept for the next opening; dispose only frees their GPU copies.
        disposeScene(scene);
        renderer.dispose();
        renderer.forceContextLoss();
        root.remove();
        if (import.meta.env.DEV) delete (window as { view3d?: unknown }).view3d;
        onClose();
      },
    };

    renderer.setAnimationLoop(loop);

    // Hooks for the visual tests and the performance script (dev builds).
    if (import.meta.env.DEV)
      Object.assign(window, {
        view3d: {
          get frames() {
            return frame;
          },
          fps,
          rig,
          view: (o: ViewOverride | null) => {
            override = o;
            seasons.force(o?.force ?? null);
            climate.force(o?.force ?? null);
            weather.reset();
          },
          quality: (l: Level) => setLevel(l),
          info: () => ({ fps: fps(), level, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, pixelRatio: renderer.getPixelRatio(), canvas: [el.width, el.height], walkers: world.walkers.count, families: world.families.walking, yaw: rig.heading, focus: { x: rig.focus.x, z: rig.focus.z }, label: labelText }),
          close: () => view.close(),
        },
      });
    built = true;
    return view;
  } finally {
    if (!built) {
      renderer.setAnimationLoop(null);
      renderer.dispose();
      renderer.forceContextLoss();
      root.remove();
    }
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

/** Round turn arrow (mirrored for the other way). */
const ARROW = (flip: boolean) =>
  `<svg viewBox="0 0 24 24" width="26" height="26"${flip ? ' style="transform:scaleX(-1)"' : ''}><path d="M5 12a7 7 0 1 0 2.1-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M3.5 3.5v5h5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** The overlay: the Nova look (dark translucent round buttons, parchment text), thumb-sized. */
const CSS = `
.v3d { position: fixed; inset: 0; z-index: 5; background: #6b5236; overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none; font-family: ${NOVA_FONT}; }
.v3d-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
.v3d button { font: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.v3d-back { position: absolute; left: max(10px, env(safe-area-inset-left)); top: 10px; min-width: 112px; height: 52px; padding: 0 22px; border-radius: 26px;
  background: rgba(36, 25, 14, 0.8); color: ${NOVA_CSS.text}; border: 1.5px solid rgba(255, 244, 220, 0.25); font-size: 19px; font-weight: 700; box-shadow: 0 2px 6px rgba(0,0,0,0.3); }
.v3d-back:active, .v3d-turn button:active { transform: scale(0.94); }
.v3d-label { position: absolute; left: 50%; top: 14px; transform: translateX(-50%); padding: 6px 16px; border-radius: 18px; background: rgba(36, 25, 14, 0.7);
  color: ${NOVA_CSS.text}; font-size: 15px; font-weight: 700; white-space: nowrap; pointer-events: none; }
.v3d-turn { position: absolute; right: max(12px, env(safe-area-inset-right)); bottom: 12px; display: flex; gap: 12px; }
.v3d-turn button { width: 52px; height: 52px; border-radius: 50%; background: rgba(36, 25, 14, 0.8); color: ${NOVA_CSS.text}; border: 1.5px solid rgba(255, 244, 220, 0.25);
  display: flex; align-items: center; justify-content: center; padding: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.3); }
.v3d-note { position: absolute; left: 50%; bottom: 16px; transform: translateX(-50%); padding: 6px 14px; border-radius: 16px; background: rgba(36, 25, 14, 0.75);
  color: ${NOVA_CSS.muted}; font-size: 13px; opacity: 0; pointer-events: none; white-space: nowrap; }
.v3d-note.show { animation: v3d-note 4s ease forwards; }
@keyframes v3d-note { 0%, 80% { opacity: 1; } 100% { opacity: 0; } }
`;
