import * as THREE from 'three';
import { calendar, createRng } from '../core';
import { SeasonClock } from '../render/Seasons';
import { T } from '../render/strings';
import { PROFILES, SurvivalBot } from '../../tools/sim/survival';
import { Atmosphere } from './atmosphere';
import { CameraRig } from './camera';
import { buildCity } from './city';
import { growCity } from './grow';
import LOOK from './look3d.json';
import { codeModels, COLORS, CROPS, loadModelPack, materialOf } from './models';
import { Particles } from './particles';
import { setColor, U } from './shaders';
import { T3 } from './strings';
import { mixColor } from './time/color';
import { dayAmplitude, dayPhase, dayTime, follow, shownTime } from './time/day';
import { fieldHands, frameLight, streetShare } from './time/light';
import { cropLook, isHarvest, isPlowing, season3d } from './time/season';
import { demoForce, SimDriver, SPEEDS, type Speed3D } from './time/sim';
import { WeatherClock, type WeatherNow } from './time/weather';
import type { TwoD } from './twod';
import { citySignature, MAX_HANDS, World } from './world';

/**
 * Proof of concept: the city of the real simulation drawn in 3D with Three.js, with the passing of
 * time (day cycle, seasons, weather) and the simulation running.
 * URL options: ?seed=3&weeks=156&b=150&bot=off&quality=auto|high|low&shadows=off&models=<manifest>
 */
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? 3);
const weeks = Number(params.get('weeks') ?? 156);
const target = Number(params.get('b') ?? 0);
const shadows = params.get('shadows') !== 'off';
type Level = 'high' | 'low' | 'min';
const qualityParam = (params.get('quality') ?? 'auto') as 'auto' | 'high' | 'low';

/** Look-only overrides for tests and screenshots: the time shown and the weather (the game state is untouched). */
interface ViewOverride {
  pos?: number;
  weather?: Partial<WeatherNow>;
}

async function start() {
  const botName = params.get('bot') ?? 'eficiente';
  const city = buildCity(seed, weeks, botName === 'off' ? 'eficiente' : botName);
  if (target > city.state.buildings.length) growCity(city.state, target, createRng(seed + 1));
  const s = city.state;
  // The bot keeps playing the city while it runs (not with a test city of a fixed size).
  const bot = botName !== 'off' && !target ? new SurvivalBot(PROFILES[botName] ?? PROFILES.eficiente, createRng(seed * 31 + 7)) : null;
  const driver = new SimDriver(s, city.rng, bot);
  const models = params.get('models') ? await loadModelPack(params.get('models')!, codeModels()) : codeModels();

  let level: Level = qualityParam === 'low' ? 'low' : 'high';
  const renderer = new THREE.WebGLRenderer({ antialias: level === 'high', powerPreference: 'high-performance' });
  const pixelRatio = (l: Level) => Math.min(devicePixelRatio, l === 'high' ? 2 : l === 'low' ? 1.25 : 0.9);
  renderer.setPixelRatio(pixelRatio(level));
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = level === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const view = document.getElementById('view')!;
  view.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const centre = new THREE.Vector3(s.altar.x + 2, 0, s.altar.y + 2);
  const atmo = new Atmosphere(scene, centre, shadows, level === 'high' ? 2048 : 1024);

  let world = new World(s, seed, models, shadows);
  scene.add(world.group);
  let signature = citySignature(s);
  let rebuiltAt = 0;
  /** Weeks passed since the last look at the city signature. */
  let dirty = false;

  // Seasons: the 2D game's clock (snowy years, drought, rain chances, crop phases) plus the 3D look.
  const seasons = new SeasonClock(seed);
  const climateClock = new SeasonClock(seed);
  const weather = new WeatherClock(seed, (week) => {
    const l = climateClock.at(week, 0, s);
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

  const el = renderer.domElement;
  const rig = new CameraRig(el, centre.clone(), { min: new THREE.Vector2(-4, -4), max: new THREE.Vector2(s.cols + 4, s.rows + 4) });
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight);
    rig.resize(innerWidth, innerHeight);
  };
  addEventListener('resize', resize);
  resize();

  // ---------------------------------------------------------------- quality
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
  if (level !== 'high') setLevel(level);

  // ---------------------------------------------------------------- one frame
  let amp = dayAmplitude(driver.secondsPerDay);
  let forced = '';
  let override: ViewOverride | null = null;
  const cloudOffset = new THREE.Vector2();
  const waterTint = new THREE.Color();
  const sunTint = new THREE.Color();
  let frame = 0;
  let shown: { w: WeatherNow; snow: number; drought: number } | null = null;

  const rebuild = () => {
    world.dispose();
    world = new World(s, seed, models, shadows);
    scene.add(world.group);
    signature = citySignature(s);
    rebuiltAt = performance.now();
  };

  const frameUpdate = (dt: number, time: number) => {
    const weekBefore = s.week;
    if (!override) driver.update(dt);
    if (s.week !== weekBefore) dirty = true;
    // The city changed (the bot built, a house rose): redraw it, at most every 1.5 s.
    if (dirty && performance.now() - rebuiltAt > 1500) {
      dirty = false;
      if (citySignature(s) !== signature) rebuild();
    }
    const pos = override?.pos ?? driver.pos;
    const week = Math.floor(pos);
    const frac = pos - week;
    // The demonstration shows a snowy winter and a dry summer (looks only).
    const f = driver.demo ? demoForce(pos) : null;
    const fk = JSON.stringify(f);
    if (fk !== forced) {
      forced = fk;
      seasons.force(f);
      climateClock.force(f);
      weather.reset();
    }
    const look = seasons.at(week, frac, s);
    const s3 = season3d(pos, look);
    const crop = cropLook(pos, look.drought);
    const w: WeatherNow = { ...weather.at(pos), ...override?.weather };
    amp = follow(amp, dayAmplitude(driver.secondsPerDay), dt);
    const t = dayTime(frac);
    const L = frameLight(t, shownTime(t, amp), amp, s3, w, look.clouds);
    shown = { w, snow: s3.snow, drought: s3.drought };

    atmo.apply(L, time, w.wind, s3.heat * (1 - w.rain), rig.camera);
    // Shadows: re-rendered while they show; every other or third frame at lower quality.
    renderer.shadowMap.autoUpdate = shadows && atmo.shadowLive && (level === 'high' || frame % (level === 'low' ? 2 : 3) === 0);

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

    const live = driver.rate > 0 || override ? dt : 0;
    world.walkers.setShare(streetShare(L.night, w.rain));
    world.walkers.update(live, time);
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
    frame++;
  };

  // ---------------------------------------------------------------- frame rate and HUD
  const stamps: number[] = [];
  const fps = () => (stamps.length > 1 ? ((stamps.length - 1) * 1000) / (stamps[stamps.length - 1] - stamps[0]) : 0);
  const hud = {
    stats: document.getElementById('stats')!,
    clock: document.getElementById('clock')!,
    banner: document.getElementById('banner')!,
    note: document.getElementById('note')!,
  };
  const flash = (n: HTMLElement, text: string) => {
    n.textContent = text;
    n.classList.remove('show');
    void n.offsetWidth;
    n.classList.add('show');
  };
  let hudAt = 0;
  let bannerSeason = '';
  let checkedAt = performance.now() + 4000;
  let slow = 0;

  const clock = new THREE.Clock();
  const loop = () => {
    const dt = Math.min(clock.getDelta(), 0.1);
    const time = clock.elapsedTime;
    rig.update(dt);
    if (driver.demo) rig.orbit(dt * 0.06);
    frameUpdate(dt, time);
    renderer.render(scene, rig.camera);
    const now = performance.now();
    stamps.push(now);
    while (stamps.length && stamps[0] < now - 2000) stamps.shift();
    // Automatic quality: one step down when the frame rate stays under 30 for two windows in a
    // row (the first seconds, with shaders compiling, do not count).
    if (qualityParam === 'auto' && level !== 'min' && now - checkedAt > 2500) {
      checkedAt = now;
      slow = fps() < 30 ? slow + 1 : 0;
      if (slow >= 2) {
        slow = 0;
        setLevel(level === 'high' ? 'low' : 'min');
        flash(hud.note, T3.lowered);
      }
    }
    if (now - hudAt > 250) {
      hudAt = now;
      updateHud();
    }
  };

  const updateHud = () => {
    const info = renderer.info.render;
    hud.stats.textContent = T3.stats(fps(), s.buildings.length, info.calls, Math.round(info.triangles / 1000));
    const pos = override?.pos ?? driver.pos;
    const cal = calendar(Math.floor(pos));
    const now = shown;
    const sky = !now
      ? ''
      : now.w.rain > 0.15
        ? now.w.snowing ? T3.weather.snow : T3.weather.rain
        : now.drought > 0.3 ? T3.weather.drought : now.w.wind > 0.4 ? T3.weather.wind : now.snow > 0.3 ? T3.weather.snowCover : '';
    hud.clock.textContent = [T.nova.calendar(cal.season, cal.year, cal.week, true), T3.phase[dayPhase(dayTime(pos))], sky].filter(Boolean).join(' · ');
    if (driver.demo && cal.season !== bannerSeason) {
      bannerSeason = cal.season;
      flash(hud.banner, T.nova.seasonName[cal.season]);
    }
    if (!driver.demo) bannerSeason = '';
    syncButtons();
  };

  // ---------------------------------------------------------------- controls
  const speedBar = document.getElementById('speeds')!;
  for (const v of SPEEDS) {
    const b = document.createElement('a');
    b.textContent = T3.speed[v];
    b.dataset.speed = String(v);
    b.onclick = () => {
      driver.stopDemo();
      driver.speed = v as Speed3D;
      syncButtons();
    };
    speedBar.appendChild(b);
  }
  const demoBtn = document.getElementById('demo')!;
  demoBtn.onclick = () => {
    if (driver.demo) driver.stopDemo();
    else driver.startDemo();
    syncButtons();
  };
  const syncButtons = () => {
    for (const b of speedBar.children) (b as HTMLElement).classList.toggle('on', !driver.demo && Number((b as HTMLElement).dataset.speed) === driver.speed);
    demoBtn.textContent = driver.demo ? T3.demoStop : T3.demo;
    demoBtn.classList.toggle('on', driver.demo);
  };
  renderer.setAnimationLoop(loop);

  // 3D <-> 2D: one page, one GameState. Only the visible view runs (the other sleeps), so the
  // simulation never advances twice; the week fraction is handed over each time.
  let twoD: TwoD | null = null;
  let in2d = false;
  const toggle = document.getElementById('toggle')!;
  const box2d = document.getElementById('game2d')!;
  toggle.textContent = T3.to2d;
  toggle.onclick = async () => {
    if (!in2d) {
      in2d = true;
      renderer.setAnimationLoop(null);
      driver.stopDemo();
      document.body.classList.add('in2d');
      toggle.textContent = T3.loading2d;
      if (!twoD) {
        const { TwoD } = await import('./twod');
        twoD = new TwoD(box2d, { state: s, rng: city.rng, seed }, driver.acc);
      } else twoD.wake(driver.acc);
      toggle.textContent = T3.to3d;
    } else {
      in2d = false;
      driver.acc = twoD?.clock ?? driver.acc;
      twoD?.sleep();
      document.body.classList.remove('in2d');
      toggle.textContent = T3.to2d;
      if (citySignature(s) !== signature) rebuild();
      clock.getDelta();
      renderer.setAnimationLoop(loop);
    }
  };

  // Hooks for the performance script and for debugging.
  Object.assign(window, {
    poc: {
      ready: true,
      fps,
      rig,
      driver,
      state: s,
      /** Look-only overrides: the time shown and the weather (null: back to the running game). */
      view: (o: ViewOverride | null) => (override = o),
      force: (f: { snow?: boolean; drought?: boolean } | null) => {
        seasons.force(f);
        climateClock.force(f);
        weather.reset();
        forced = JSON.stringify(f);
      },
      quality: (l: Level) => setLevel(l),
      info: () => ({ fps: fps(), level, buildings: s.buildings.length, houses: world.houses, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, pixelRatio: renderer.getPixelRatio(), canvas: [el.width, el.height], week: s.week }),
    },
  });
}

start().catch((e) => {
  document.getElementById('stats')!.textContent = T3.error(e);
  throw e;
});
