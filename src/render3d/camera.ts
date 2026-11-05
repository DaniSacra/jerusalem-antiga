import * as THREE from 'three';
import { snapTurn } from '../game/gestures';

/** Opening distance, and how close and far the camera may go. */
const DIST0 = 34;
const DIST_MIN = 7;
const DIST_MAX = 70;
const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

/** The playable view's tilt follows the zoom: low over the roofs up close, steep from far. */
export function pitchFor(dist: number): number {
  const t = THREE.MathUtils.clamp((dist - DIST_MIN) / (DIST_MAX - DIST_MIN), 0, 1);
  return 0.62 + (1.22 - 0.62) * Math.sqrt(t);
}

/**
 * City-builder camera: looks down at a target point on the ground from a tilted angle that follows
 * the zoom. It reads no input itself: the game drives it through `panBy`, `zoomAt`, `turnBy` and
 * `turn` (the gestures and keys in `src/game`).
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private target = new THREE.Vector3();
  private yaw = -Math.PI / 4;
  private pitch = 0.9;
  private dist = DIST0;

  /** Yaw the view is turning to (the turn buttons), approached smoothly in `update`. */
  private yawGoal: number | null = null;

  constructor(private el: HTMLElement, centre: THREE.Vector3, private bounds: { min: THREE.Vector2; max: THREE.Vector2 }) {
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.5, 400);
    this.target.copy(centre);
    this.pitch = pitchFor(this.dist);
    this.apply();
  }

  /** Turns the view a quarter around its focus to the next standard view, smoothly (the turn buttons). */
  turn(dir: 1 | -1) {
    this.yawGoal = snapTurn(this.yawGoal ?? this.yaw, dir);
  }

  /** Moves the view by screen pixels (the ground follows the finger). */
  panBy(dx: number, dy: number) {
    this.pan(dx, dy);
    this.apply();
  }

  /** How far the camera is from the point it looks at (world units). */
  get distance(): number {
    return this.dist;
  }

  /** The view's scale: 1 at the opening distance, larger when closer. */
  get zoom(): number {
    return DIST0 / this.dist;
  }

  /** Zooms to `zoom` keeping the ground under the screen point (sx, sy) in place. */
  zoomAt(sx: number, sy: number, zoom: number) {
    const before = this.groundAt(sx, sy);
    this.dist = THREE.MathUtils.clamp(DIST0 / zoom, DIST_MIN, DIST_MAX);
    this.pitch = pitchFor(this.dist);
    this.apply();
    const after = this.groundAt(sx, sy);
    if (before && after) {
      this.target.x += before.x - after.x;
      this.target.z += before.z - after.z;
      this.clampTarget();
      this.apply();
    }
  }

  /** Turns the view right away by `radians` (a two-finger twist). */
  turnBy(radians: number) {
    this.yaw += radians;
    this.yawGoal = null;
    this.apply();
  }

  /** The ground point (y = 0) under a screen point, or null when the ray misses it. */
  groundAt(sx: number, sy: number): THREE.Vector3 | null {
    const r = this.el.getBoundingClientRect();
    const ndc = new THREE.Vector2(((sx - r.left) / r.width) * 2 - 1, -((sy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    return this.ray.ray.intersectPlane(GROUND, new THREE.Vector3());
  }

  /** The ray under a screen point (picking). */
  rayAt(sx: number, sy: number): THREE.Ray {
    const r = this.el.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((sx - r.left) / r.width) * 2 - 1, -((sy - r.top) / r.height) * 2 + 1), this.camera);
    return this.ray.ray;
  }

  private ray = new THREE.Raycaster();

  resize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** World units per screen pixel at the target distance. */
  private get unitsPerPixel() {
    return (2 * this.dist * Math.tan((this.camera.fov * Math.PI) / 360)) / this.el.clientHeight;
  }

  private pan(dx: number, dy: number) {
    const k = this.unitsPerPixel;
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.target.addScaledVector(right, -dx * k).addScaledVector(fwd, (-dy * k) / Math.sin(this.pitch));
    this.clampTarget();
  }

  private clampTarget() {
    this.target.x = THREE.MathUtils.clamp(this.target.x, this.bounds.min.x, this.bounds.max.x);
    this.target.z = THREE.MathUtils.clamp(this.target.z, this.bounds.min.y, this.bounds.max.y);
  }

  update(dt: number) {
    if (this.yawGoal !== null) {
      const d = this.yawGoal - this.yaw;
      this.yaw += d * Math.min(1, dt * 8);
      if (Math.abs(d) < 1e-3) {
        this.yaw = this.yawGoal;
        this.yawGoal = null;
      }
    }
    this.apply();
  }

  /** A quarter turn is still on its way. */
  get turningNow(): boolean {
    return this.yawGoal !== null;
  }

  /** The ground point the camera looks at. */
  get focus(): THREE.Vector3 {
    return this.target;
  }

  /** Camera turn about y (radians), for the tests. */
  get heading(): number {
    return this.yawGoal ?? this.yaw;
  }

  /** Test hook: sets the view. */
  set(view: { yaw?: number; pitch?: number; dist?: number; x?: number; z?: number }) {
    if (view.yaw !== undefined) this.yaw = view.yaw;
    if (view.pitch !== undefined) this.pitch = view.pitch;
    if (view.dist !== undefined) this.dist = view.dist;
    if (view.x !== undefined) this.target.x = view.x;
    if (view.z !== undefined) this.target.z = view.z;
    this.apply();
  }

  private apply() {
    const c = this.camera;
    const h = Math.sin(this.pitch) * this.dist;
    const r = Math.cos(this.pitch) * this.dist;
    c.position.set(this.target.x + Math.sin(this.yaw) * r, this.target.y + h, this.target.z + Math.cos(this.yaw) * r);
    c.lookAt(this.target);
  }
}
