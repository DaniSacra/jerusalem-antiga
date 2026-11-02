import Phaser from 'phaser';
import { WORLD } from './iso';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const PAD = 320;

/** Pan and zoom helpers for the main camera (zoom keeps the point under the finger/cursor fixed). */
export class CameraRig {
  constructor(private cam: Phaser.Cameras.Scene2D.Camera) {
    cam.setBounds(WORLD.left - PAD, WORLD.top - PAD, WORLD.right - WORLD.left + PAD * 2, WORLD.bottom - WORLD.top + PAD * 2);
  }

  get zoom() {
    return this.cam.zoom;
  }

  /** Screen point to world point, independent of the camera's cached matrix. */
  toWorld(sx: number, sy: number) {
    const { cam } = this;
    const cx = cam.width / 2;
    const cy = cam.height / 2;
    return { x: cam.scrollX + cx + (sx - cx) / cam.zoom, y: cam.scrollY + cy + (sy - cy) / cam.zoom };
  }

  panBy(dxScreen: number, dyScreen: number) {
    this.cam.scrollX -= dxScreen / this.cam.zoom;
    this.cam.scrollY -= dyScreen / this.cam.zoom;
  }

  zoomAt(sx: number, sy: number, zoom: number) {
    const { cam } = this;
    const before = this.toWorld(sx, sy);
    cam.setZoom(Phaser.Math.Clamp(zoom, MIN_ZOOM, MAX_ZOOM));
    const cx = cam.width / 2;
    const cy = cam.height / 2;
    cam.scrollX = before.x - cx - (sx - cx) / cam.zoom;
    cam.scrollY = before.y - cy - (sy - cy) / cam.zoom;
  }

  /** Centers a world point at a given screen position. */
  centerAt(wx: number, wy: number, sx: number, sy: number) {
    const { cam } = this;
    const cx = cam.width / 2;
    const cy = cam.height / 2;
    cam.scrollX = wx - cx - (sx - cx) / cam.zoom;
    cam.scrollY = wy - cy - (sy - cy) / cam.zoom;
  }
}
