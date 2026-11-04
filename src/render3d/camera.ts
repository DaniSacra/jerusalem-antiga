import * as THREE from 'three';

/**
 * City-builder camera: looks down at a target point on the ground from a tilted angle.
 * Mouse: left drag moves, right drag (or Shift + drag) turns and tilts, wheel zooms.
 * Touch: one finger moves, two fingers pinch to zoom, twist to turn and slide up/down to tilt.
 * Keys: WASD / arrows move, Q/E turn.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private target = new THREE.Vector3();
  private yaw = -Math.PI / 4;
  private pitch = 0.9;
  private dist = 34;
  private pointers = new Map<number, { x: number; y: number }>();
  private gesture: { d: number; a: number; y: number } | null = null;
  private keys = new Set<string>();
  private turning = false;

  constructor(private el: HTMLElement, centre: THREE.Vector3, private bounds: { min: THREE.Vector2; max: THREE.Vector2 }) {
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.5, 400);
    this.target.copy(centre);
    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    for (const t of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(t, (e) => this.up(e as PointerEvent));
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom(Math.exp(e.deltaY * 0.0012));
    }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('keydown', (e) => el.isConnected && el.offsetParent && this.keys.add(e.key.toLowerCase()));
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    this.apply();
  }

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
    this.target.x = THREE.MathUtils.clamp(this.target.x, this.bounds.min.x, this.bounds.max.x);
    this.target.z = THREE.MathUtils.clamp(this.target.z, this.bounds.min.y, this.bounds.max.y);
  }

  private zoom(k: number) {
    this.dist = THREE.MathUtils.clamp(this.dist * k, 7, 70);
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
      this.zoom(this.gesture.d / Math.max(g.d, 1));
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
    const k = this.keys;
    const step = 600 * dt;
    if (k.has('a') || k.has('arrowleft')) this.pan(step, 0);
    if (k.has('d') || k.has('arrowright')) this.pan(-step, 0);
    if (k.has('w') || k.has('arrowup')) this.pan(0, step);
    if (k.has('s') || k.has('arrowdown')) this.pan(0, -step);
    if (k.has('q')) this.yaw += 1.6 * dt;
    if (k.has('e')) this.yaw -= 1.6 * dt;
    this.apply();
  }

  /** The ground point the camera looks at. */
  get focus(): THREE.Vector3 {
    return this.target;
  }

  /** Turns the view around its focus (the demonstration's slow orbit). */
  orbit(angle: number) {
    this.yaw += angle;
    this.apply();
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
