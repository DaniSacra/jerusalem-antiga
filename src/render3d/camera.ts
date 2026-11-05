import * as THREE from 'three';

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
 * City-builder camera: looks down at a target point on the ground from a tilted angle.
 * Mouse: left drag moves, right drag (or Shift + drag) turns and tilts, wheel zooms.
 * Touch: one finger moves, two fingers pinch to zoom, twist to turn and slide up/down to tilt.
 * Keys: WASD / arrows move, Q/E turn. Buttons: `turn` (a smooth quarter-ish turn).
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private target = new THREE.Vector3();
  private yaw = -Math.PI / 4;
  private pitch = 0.9;
  private dist = DIST0;
  private pointers = new Map<number, { x: number; y: number }>();
  private gesture: { d: number; a: number; y: number } | null = null;
  private keys = new Set<string>();
  private turning = false;

  /** Yaw the view is turning to (the turn buttons), approached smoothly in `update`. */
  private yawGoal: number | null = null;
  /** Removes every listener (see dispose). */
  private off: (() => void)[] = [];

  /**
   * `listen` false: the rig reads no input itself (the playable game drives it through `panBy`,
   * `zoomAt` and `turnBy` from the shared gestures) and the tilt follows the zoom.
   */
  constructor(private el: HTMLElement, centre: THREE.Vector3, private bounds: { min: THREE.Vector2; max: THREE.Vector2 }, private listen = true) {
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.5, 400);
    this.target.copy(centre);
    if (!listen) {
      this.pitch = pitchFor(this.dist);
      this.apply();
      return;
    }
    const on = (t: EventTarget, type: string, f: (e: never) => void, o?: AddEventListenerOptions) => {
      t.addEventListener(type, f as EventListener, o);
      this.off.push(() => t.removeEventListener(type, f as EventListener, o));
    };
    on(el, 'pointerdown', (e: PointerEvent) => this.down(e));
    on(el, 'pointermove', (e: PointerEvent) => this.move(e));
    for (const t of ['pointerup', 'pointercancel', 'pointerleave']) on(el, t, (e: PointerEvent) => this.up(e));
    on(el, 'wheel', (e: WheelEvent) => {
      e.preventDefault();
      this.zoomBy(Math.exp(e.deltaY * 0.0012));
      this.apply();
    }, { passive: false });
    on(el, 'contextmenu', (e: Event) => e.preventDefault());
    on(window, 'keydown', (e: KeyboardEvent) => this.keys.add(e.key.toLowerCase()));
    on(window, 'keyup', (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase()));
    on(window, 'blur', () => this.keys.clear());
    this.apply();
  }

  /** Removes the listeners (the view closes). */
  dispose() {
    for (const f of this.off) f();
    this.off = [];
    this.keys.clear();
    this.pointers.clear();
  }

  /** Turns the view by `angle` radians around its focus, smoothly (the turn buttons). */
  turn(angle: number) {
    this.yawGoal = (this.yawGoal ?? this.yaw) + angle;
  }

  /** Moves the view by screen pixels (the ground follows the finger). */
  panBy(dx: number, dy: number) {
    this.pan(dx, dy);
    this.apply();
  }

  /** The view's scale: 1 at the opening distance, larger when closer. */
  get zoom(): number {
    return DIST0 / this.dist;
  }

  /** Zooms to `zoom` keeping the ground under the screen point (sx, sy) in place. */
  zoomAt(sx: number, sy: number, zoom: number) {
    const before = this.groundAt(sx, sy);
    this.dist = THREE.MathUtils.clamp(DIST0 / zoom, DIST_MIN, DIST_MAX);
    if (!this.listen) this.pitch = pitchFor(this.dist);
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

  private zoomBy(k: number) {
    this.dist = THREE.MathUtils.clamp(this.dist * k, DIST_MIN, DIST_MAX);
  }

  private tilt(d: number) {
    this.pitch = THREE.MathUtils.clamp(this.pitch + d, 0.45, 1.35);
  }

  private down(e: PointerEvent) {
    this.el.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.turning = e.pointerType === 'mouse' && (e.button === 2 || e.shiftKey);
    this.gesture = this.pointers.size === 2 ? this.twoFinger() : null;
  }

  private twoFinger() {
    const [a, b] = [...this.pointers.values()];
    return { d: Math.hypot(b.x - a.x, b.y - a.y), a: Math.atan2(b.y - a.y, b.x - a.x), y: (a.y + b.y) / 2 };
  }

  private move(e: PointerEvent) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.pointers.size === 2 && this.gesture) {
      const g = this.twoFinger();
      this.zoomBy(this.gesture.d / Math.max(g.d, 1));
      this.yaw += g.a - this.gesture.a;
      this.tilt((g.y - this.gesture.y) * 0.004);
      this.gesture = g;
    } else if (this.pointers.size === 1) {
      if (this.turning) {
        this.yaw -= dx * 0.006;
        this.tilt(dy * 0.004);
      } else this.pan(dx, dy);
    }
    this.apply();
  }

  private up(e: PointerEvent) {
    this.pointers.delete(e.pointerId);
    this.gesture = this.pointers.size === 2 ? this.twoFinger() : null;
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
    if (this.listen) this.keyMove(dt);
    this.apply();
  }

  /** The look-only view's own keys: WASD / arrows move, Q/E turn while held. */
  private keyMove(dt: number) {
    const k = this.keys;
    const step = 600 * dt;
    if (k.has('a') || k.has('arrowleft')) this.pan(step, 0);
    if (k.has('d') || k.has('arrowright')) this.pan(-step, 0);
    if (k.has('w') || k.has('arrowup')) this.pan(0, step);
    if (k.has('s') || k.has('arrowdown')) this.pan(0, -step);
    if (k.has('q')) this.yaw += 1.6 * dt;
    if (k.has('e')) this.yaw -= 1.6 * dt;
    if (k.has('q') || k.has('e')) this.yawGoal = null;
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
