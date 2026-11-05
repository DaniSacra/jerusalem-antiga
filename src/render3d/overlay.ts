import * as THREE from 'three';
import { C } from '../render/palette';
import type { Rect } from '../core';
import type { Marks } from './marks';
import type { ModelKey, Prototype } from './models';
import { lookOf } from './plan';

/** Lift over the ground so the marks do not flicker with it, and the outline's width (cells). */
const LIFT = 0.05;
const EDGE = 0.07;

/**
 * Draws the ground marks (`marksOf`) on the 3D map: painted cells and outlines in one mesh that
 * follows the terrain, the translucent building at the cursor and the red of the one to demolish.
 * Drawn again only when the marks change (the hovered cell, the tool, the city).
 */
export class Overlay {
  readonly group = new THREE.Group();
  private mesh: THREE.Mesh;
  private ghost = new THREE.Group();
  private ghostMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false });
  private ghostKey = '';
  private pos: number[] = [];
  private col: number[] = [];
  private tmp = new THREE.Color();

  constructor(
    private height: (x: number, z: number) => number,
    public models: Record<ModelKey, Prototype>,
  ) {
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), m);
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = false;
    this.ghost.renderOrder = 3;
    this.group.add(this.mesh, this.ghost);
  }

  /** The terrain changed (the city was drawn again). */
  setHeight(height: (x: number, z: number) => number) {
    this.height = height;
  }

  draw(m: Marks) {
    this.pos = [];
    this.col = [];
    for (const f of m.fills) for (const c of f.cells) this.quad(c.x, c.y, c.x + 1, c.y + 1, f.color, f.alpha);
    for (const o of m.outlines) this.outline(o.rect, o.color, o.alpha);
    if (m.doomed) {
      const r = { x: m.doomed.x, y: m.doomed.y, w: m.doomed.w, h: m.doomed.h };
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) this.quad(x, y, x + 1, y + 1, C.famine, 0.55);
      this.outline(r, C.famine, 1);
    }
    const g = this.mesh.geometry;
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 4));
    g.computeBoundingSphere();
    this.drawGhost(m.ghost);
  }

  /** A flat patch from (x0, z0) to (x1, z1) laid on the ground (corner heights). */
  private quad(x0: number, z0: number, x1: number, z1: number, color: number, alpha: number) {
    const h = this.height;
    const p = [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ].map(([x, z]) => [x, h(x, z) + LIFT, z]);
    for (const k of [0, 2, 1, 0, 3, 2]) this.pos.push(...p[k]);
    this.tmp.setHex(color);
    for (let k = 0; k < 6; k++) this.col.push(this.tmp.r, this.tmp.g, this.tmp.b, alpha);
  }

  /** A rectangle's border, one cell-long strip at a time so it follows the ground. */
  private outline(r: Rect, color: number, alpha: number) {
    const e = EDGE;
    for (let x = r.x; x < r.x + r.w; x++) {
      this.quad(x, r.y, x + 1, r.y + e, color, alpha);
      this.quad(x, r.y + r.h - e, x + 1, r.y + r.h, color, alpha);
    }
    for (let y = r.y; y < r.y + r.h; y++) {
      this.quad(r.x, y, r.x + e, y + 1, color, alpha);
      this.quad(r.x + r.w - e, y, r.x + r.w, y + 1, color, alpha);
    }
  }

  private drawGhost(gh: Marks['ghost']) {
    if (!gh) {
      this.ghost.visible = false;
      return;
    }
    this.ghost.visible = true;
    const look = lookOf({ kind: gh.kind, level: 1, emptyLevel: 0, variant: 0, w: gh.rect.w, h: gh.rect.h });
    const key = `${look.key}:${gh.rotated}`;
    if (key !== this.ghostKey) {
      this.ghostKey = key;
      this.ghost.clear();
      for (const part of this.models[look.key].parts) this.ghost.add(new THREE.Mesh(part.geometry, this.ghostMat));
    }
    this.ghostMat.color.setHex(gh.color);
    const cx = gh.rect.x + gh.rect.w / 2;
    const cz = gh.rect.y + gh.rect.h / 2;
    this.ghost.position.set(cx, this.height(cx, cz) + 0.02, cz);
    // Long buildings placed across turn their long side along x (as `facing`).
    this.ghost.rotation.y = gh.rect.w > gh.rect.h ? Math.PI / 2 : 0;
    this.ghost.scale.set(1, look.sy, 1);
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.ghostMat.dispose();
    this.group.removeFromParent();
  }
}
