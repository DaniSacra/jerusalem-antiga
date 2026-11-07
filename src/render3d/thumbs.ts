import * as THREE from 'three';
import type { BuildableKind } from '../core';
import type { ModelKey, Prototype } from './models';
import { thumbKey } from './plan';
import { U } from './shaders';

/** The shared uniforms set for the thumbnails (a clear summer day, crops grown, no wind) and put back after. */
const CLEAR_DAY = { uSnow: 0, uWet: 0, uCloud: 0, uWindows: 0, uGrow: 1, uWind: 0, uHeat: 0, uDrought: 0 } as const;

/** Side of a thumbnail (px): twice the phone's 46 px disc, sharp on a dense screen. */
export const THUMB_PX = 96;

/**
 * Thumbnails of the buildings for the interface (the build column, the balloon's main action): each
 * model of the map drawn once from the opening view's side, in a warm afternoon light, on a clear
 * background, as an image URL. Drawn with the game's own renderer, in a corner of its canvas, and
 * copied out at once (before the frame is shown), so no second WebGL context is opened; the next
 * frame of the game draws over that corner. Always a clear summer day (crops grown), whatever the season.
 */
export function renderThumbs(renderer: THREE.WebGLRenderer, models: Record<ModelKey, Prototype>, kinds: readonly BuildableKind[]): Partial<Record<BuildableKind, string>> {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff2dc, 0x6a5040, 1.6));
  const sun = new THREE.DirectionalLight(0xffe2b8, 2.6);
  sun.position.set(3, 6, 4);
  scene.add(sun);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const view = new THREE.Vector3(1, 0.95, 1.15).normalize();

  const pr = renderer.getPixelRatio();
  const css = THUMB_PX / pr;
  const gl = renderer.domElement;
  const out = document.createElement('canvas');
  out.width = out.height = THUMB_PX;
  const ctx = out.getContext('2d')!;

  const old = { target: renderer.getRenderTarget(), shadows: renderer.shadowMap.enabled, clear: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(), autoClear: renderer.autoClear };
  const viewport = renderer.getViewport(new THREE.Vector4());
  const scissor = renderer.getScissor(new THREE.Vector4());
  const scissorTest = renderer.getScissorTest();
  const kept = Object.fromEntries(Object.keys(CLEAR_DAY).map((k) => [k, U[k as keyof typeof CLEAR_DAY].value]));
  for (const [k, v] of Object.entries(CLEAR_DAY)) U[k as keyof typeof CLEAR_DAY].value = v;
  renderer.setRenderTarget(null);
  renderer.shadowMap.enabled = false;
  renderer.autoClear = true;
  renderer.setClearColor(0x000000, 0);
  renderer.setViewport(0, 0, css, css);
  renderer.setScissor(0, 0, css, css);
  renderer.setScissorTest(true);

  const result: Partial<Record<BuildableKind, string>> = {};
  const box = new THREE.Box3();
  const corner = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  for (const kind of kinds) {
    const proto = models[thumbKey(kind)];
    if (!proto) continue;
    const group = new THREE.Group();
    for (const p of proto.parts) group.add(new THREE.Mesh(p.geometry, p.material));
    scene.add(group);
    box.setFromObject(group);
    const centre = box.getCenter(new THREE.Vector3());
    // Fit the model's box seen from the view's side (orthographic: no perspective to allow for).
    camera.position.copy(centre).addScaledVector(view, 20);
    camera.lookAt(centre);
    camera.updateMatrixWorld();
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    up.setFromMatrixColumn(camera.matrixWorld, 1);
    let half = 0;
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(centre);
      half = Math.max(half, Math.abs(corner.dot(right)), Math.abs(corner.dot(up)));
    }
    half *= 1.06;
    camera.left = camera.bottom = -half;
    camera.right = camera.top = half;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    // The corner is at the bottom left of the drawing buffer; copied while it is still there.
    ctx.clearRect(0, 0, THUMB_PX, THUMB_PX);
    ctx.drawImage(gl, 0, gl.height - THUMB_PX, THUMB_PX, THUMB_PX, 0, 0, THUMB_PX, THUMB_PX);
    result[kind] = out.toDataURL('image/png');
    scene.remove(group);
  }

  renderer.setScissorTest(scissorTest);
  renderer.setScissor(scissor);
  renderer.setViewport(viewport);
  renderer.setRenderTarget(old.target);
  renderer.shadowMap.enabled = old.shadows;
  renderer.autoClear = old.autoClear;
  renderer.setClearColor(old.clear, old.alpha);
  for (const [k, v] of Object.entries(kept)) U[k as keyof typeof CLEAR_DAY].value = v;
  return result;
}
