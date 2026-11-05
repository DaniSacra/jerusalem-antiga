import * as THREE from 'three';
import type { Building, Cell, GameState, Rect } from '../core';
import VISUAL from '../data/visual.json';
import type { GameOut } from '../game/events';
import { C } from '../render/palette';
import { CameraRig } from './camera';
import { changedLayers, cityKeys, type CityKeys } from './diff';
import { WorldFx } from './fx';
import { ringRadiusFor } from './fxMath';
import LOOK from './look3d.json';
import { marksOf, type Marks, type MarksInput } from './marks';
import { Overlay } from './overlay';
import { cellOfPoint, pickBox, rayToGround, type PickBox } from './picking';
import { yawOfRotation } from './plan';
import { codeModels, loadModelPack, type ModelKey, type Prototype } from './models';
import { canRun3D, PACK, Stage, type Level } from './stage';
import { advanceDay, dayTime, nightness } from './time/day';

export interface Scene3DOptions {
  /** Where the camera starts: a grid cell and the 2D view's quarter turns (default the altar, turn 0). */
  start?: { focus: Cell; rotation: number };
  /** Time of day to start at (0..1). */
  dayT?: number;
  /** Model pack manifest (null: code models only). */
  pack?: string | null;
}

/** Rough height of each building's box for picking (a tap on a roof picks the building). */
const PICK_TOP = 1.4;
const TEMPLE_TOP = 3;
/** Midday (the day and night option off). */
const NOON = (LOOK.day.sunrise + LOOK.day.sunset) / 2;

/**
 * The city in 3D, with no page around it: the stage (scene, light, weather, the world), the camera,
 * the ground marks and the world effects. The app owns the page, the interface and the input, and
 * asks this for cells under the pointer, screen points over cells and a frame.
 */
export class Scene3D {
  readonly stage: Stage;
  readonly rig: CameraRig;
  private overlay: Overlay;
  /** Moments of the world: rings, dust, sparks, hops and falling trees. */
  private fx: WorldFx;
  /** The quality the effects were last limited to. */
  private fxLevel: Level = 'high';
  private keys: CityKeys;
  private dayT: number;
  private glide: THREE.Vector3 | null = null;
  /** The canvas on the page, measured on resize (screen points need it every frame). */
  private box = { left: 0, top: 0, width: 1, height: 1 };

  private constructor(
    private s: GameState,
    stage: Stage,
    opts: Scene3DOptions,
    models: Record<ModelKey, Prototype>,
  ) {
    this.stage = stage;
    this.dayT = dayTime(opts.dayT ?? LOOK.day.start);
    const altar = s.buildings.find((b) => b.kind === 'altar');
    const f = opts.start?.focus;
    const centre = f ? new THREE.Vector3(f.x + 0.5, 0, f.y + 0.5) : new THREE.Vector3((altar?.x ?? s.cols / 2) + (altar?.w ?? 0) / 2, 0, (altar?.y ?? s.rows / 2) + (altar?.h ?? 0) / 2);
    this.rig = new CameraRig(stage.el, centre, { min: new THREE.Vector2(-4, -4), max: new THREE.Vector2(s.cols + 4, s.rows + 4) }, false);
    this.rig.set({ yaw: yawOfRotation(opts.start?.rotation ?? 0) });
    const height = (x: number, z: number) => this.stage.world.ground.height(x, z);
    this.overlay = new Overlay(height, models);
    this.fx = new WorldFx(height, (x, y, dy, st) => this.stage.world.lift(x, y, dy, st));
    stage.scene.add(this.overlay.group, this.fx.group);
    this.keys = cityKeys(s);
  }

  /** True once the model pack arrived, failed or was not asked for (the city has its final look). */
  ready = false;
  private disposed = false;

  /**
   * Builds the scene for a game with the code models at once; the .glb pack (when asked) replaces
   * them when it arrives, so the first frame never waits for the download. Throws when the device
   * cannot draw WebGL 2.
   */
  static create(s: GameState, seed: number, opts: Scene3DOptions): Scene3D {
    if (!canRun3D()) throw new Error('no WebGL 2');
    const models = codeModels();
    const stage = new Stage(s, seed, models, new THREE.Vector3(s.cols / 2, 0, s.rows / 2));
    let scene: Scene3D;
    try {
      scene = new Scene3D(s, stage, opts, models);
    } catch (e) {
      stage.dispose();
      throw e;
    }
    const pack = opts.pack === undefined ? PACK : opts.pack;
    if (!pack) scene.ready = true;
    else
      loadModelPack(pack, models)
        .then((m) => scene.setModels(m))
        .catch(() => {})
        .finally(() => (scene.ready = true));
    return scene;
  }

  private setModels(m: Record<ModelKey, Prototype>) {
    if (this.disposed) return;
    this.stage.setModels(m);
    this.overlay.models = m;
  }

  get el() {
    return this.stage.el;
  }

  resize(w: number, h: number) {
    this.stage.resize(w, h, this.rig);
    const b = this.stage.el.getBoundingClientRect();
    this.box = { left: b.left, top: b.top, width: b.width || w, height: b.height || h };
  }

  // ---------------------------------------------------------------- pointer and camera

  /** The cell under a screen point: with `boxes`, a building's box first (Mover, Demolir), else the ground. */
  cellAt(sx: number, sy: number, boxes: boolean): Cell | null {
    const ray = this.rig.rayAt(sx, sy);
    if (boxes) {
      const hit = pickBox(ray.origin, ray.direction, this.boxes());
      if (hit) return { x: hit.b.x, y: hit.b.y };
    }
    // The ground is not flat: meet the plane at the height found under the last guess.
    let h = 0;
    let p = rayToGround(ray.origin, ray.direction, h);
    for (let k = 0; k < 3 && p; k++) {
      h = this.stage.world.ground.height(p.x, p.z);
      p = rayToGround(ray.origin, ray.direction, h);
    }
    return cellOfPoint(p, this.s.cols, this.s.rows);
  }

  private boxes(): (PickBox & { b: Building })[] {
    return this.s.buildings.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h, top: b.kind === 'temple' ? TEMPLE_TOP : b.kind === 'field' ? 0.2 : PICK_TOP, b }));
  }

  private v = new THREE.Vector3();

  /** Screen point over the centre of a footprint, `top` units above the ground (null behind the camera). */
  screenOf(r: Rect, top = 0): { x: number; y: number } | null {
    const cx = r.x + r.w / 2;
    const cz = r.y + r.h / 2;
    const v = this.v.set(cx, this.stage.world.ground.height(cx, cz) + top, cz).project(this.rig.camera);
    if (v.z > 1) return null;
    const b = this.box;
    return { x: b.left + ((v.x + 1) / 2) * b.width, y: b.top + ((1 - v.y) / 2) * b.height };
  }

  /** A quarter turn of the map (Q/E and the buttons). */
  turn(dir: 1 | -1) {
    this.rig.turn((dir * Math.PI) / 2);
  }

  /** The camera slides to a footprint (null: stops sliding). */
  glideTo(r: Rect | null) {
    this.glide = r && new THREE.Vector3(r.x + r.w / 2, 0, r.y + r.h / 2);
  }

  /** The camera is not sliding nor turning on its own. */
  get still(): boolean {
    return !this.glide && !this.rig.turningNow;
  }

  // ---------------------------------------------------------------- the game's changes

  /** The city may have changed: the layers that did are drawn again soon. */
  cityChanged() {
    const keys = cityKeys(this.s);
    const layers = changedLayers(this.keys, keys);
    if (layers.length) this.stage.cityChanged(layers);
    this.keys = keys;
  }

  /** Draws the ground marks (preview, ghost, spots); returns them for the interface's tag. */
  drawMarks(input: MarksInput): Marks {
    const marks = marksOf(this.s, input);
    this.overlay.draw(marks);
    return marks;
  }

  /** The world's part of a game output (rings, dust, sparks, hops, falling trees). */
  effect(o: GameOut) {
    const fx = this.fx;
    switch (o.do) {
      case 'cheer':
        fx.ring({ x: o.x, y: o.y, w: 1, h: 1 });
        fx.hop(o.x, o.y);
        break;
      case 'placed':
        if (o.temple) fx.celebrate(o);
        else fx.ring(o);
        break;
      case 'dust':
        fx.dust(o);
        break;
      case 'upgraded':
        fx.ring(o.building, C.ui.goldLight);
        fx.hop(o.building.x, o.building.y);
        break;
      case 'harvestRing':
        fx.ring(o.building, C.grain, ringRadiusFor(o.building) * 1.2);
        break;
      case 'spoil':
        fx.spoil(o.building);
        break;
      case 'milestone':
        fx.milestone(o.building);
        break;
      case 'fell': {
        const s = this.s;
        fx.fell(o.x, o.y, s.stumps.find((t) => t.i === o.y * s.cols + o.x)?.kind === 'palm');
        break;
      }
      default:
        break;
    }
  }

  // ---------------------------------------------------------------- frame

  /**
   * One frame: `week` is the game time (with the fraction), `speed` how fast it runs (the day keeps
   * pace), `dayNight` the option, `pressing` true while a finger or button holds the map.
   */
  frame(dt: number, time: number, week: number, speed: number, dayNight: boolean, pressing: boolean) {
    this.dayT = advanceDay(this.dayT, dt * speed, dayNight, VISUAL.dayNight.cycleSeconds);
    if (this.glide) {
      if (pressing) this.glide = null;
      else {
        const f = this.rig.focus;
        const k = Math.min(1, dt * 4);
        this.rig.set({ x: f.x + (this.glide.x - f.x) * k, z: f.z + (this.glide.z - f.z) * k });
        if (Math.hypot(this.glide.x - f.x, this.glide.z - f.z) < 0.05) this.glide = null;
      }
    }
    this.rig.update(dt);
    const dayT = dayNight ? this.dayT : NOON;
    this.stage.frame(dt, time, week, dayT, this.rig);
    if (this.stage.level !== this.fxLevel) {
      this.fxLevel = this.stage.level;
      this.fx.limit(this.fxLevel === 'high' ? 1 : this.fxLevel === 'low' ? 0.5 : 0.3);
    }
    // Dust and flies darken at night; what shines does not.
    this.fx.update(dt, time, 1 - 0.65 * nightness(dayT));
  }

  dispose() {
    this.disposed = true;
    this.overlay.dispose();
    this.fx.dispose();
    this.stage.dispose();
  }
}
