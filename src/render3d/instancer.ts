import * as THREE from 'three';
import type { ModelKey, Prototype } from './models';

/** Flat or glowing models that cast no shadow. */
const NO_SHADOW = new Set<ModelKey>(['road', 'stump', 'loose', 'loose-arm', 'pane', 'kit-figs', 'kit-rug', 'kit-stripes', 'road-edge', 'ruts', 'road-stones', 'flags', 'tuft', 'pebbles']);

/**
 * Collects every copy of every model, then draws each model part as one InstancedMesh: a city of
 * 150 buildings and 300 trees costs a few dozen draw calls instead of thousands.
 */
export class Instancer {
  private items = new Map<ModelKey, { m: THREE.Matrix4; tint: THREE.Color }[]>();
  private meshes = new Map<ModelKey, THREE.InstancedMesh[]>();
  private tmp = new THREE.Object3D();
  private lifted = new THREE.Matrix4();
  private squash = new THREE.Matrix4();

  constructor(private models: Record<ModelKey, Prototype>) {}

  /** One copy of `key`; `sy` stretches it upward on top of `scale`. Returns its index (see `lift`). */
  add(key: ModelKey, x: number, y: number, z: number, rotY = 0, scale = 1, tint = 1, sy = 1): number {
    this.tmp.position.set(x, y, z);
    this.tmp.rotation.set(0, rotY, 0);
    this.tmp.scale.set(scale, scale * sy, scale);
    this.tmp.updateMatrix();
    const list = this.items.get(key) ?? [];
    list.push({ m: this.tmp.matrix.clone(), tint: new THREE.Color(tint, tint, tint) });
    this.items.set(key, list);
    return list.length - 1;
  }

  build(shadows: boolean): THREE.Group {
    const group = new THREE.Group();
    for (const [key, list] of this.items) {
      for (const part of this.models[key].parts) {
        const mesh = new THREE.InstancedMesh(part.geometry, part.material, list.length);
        list.forEach((it, i) => {
          mesh.setMatrixAt(i, it.m);
          mesh.setColorAt(i, it.tint);
        });
        mesh.castShadow = shadows && !NO_SHADOW.has(key);
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        mesh.name = key;
        group.add(mesh);
        this.meshes.set(key, [...(this.meshes.get(key) ?? []), mesh]);
      }
    }
    return group;
  }

  /**
   * Lifts copy `i` of `key` by `dy` and stretches it upward by `stretch` (as much thinner), from
   * its place at `add` (a building's hop); (0, 1) puts it back. After `build` only.
   */
  lift(key: ModelKey, i: number, dy: number, stretch: number) {
    const it = this.items.get(key)?.[i];
    if (!it) return;
    const w = 1 / Math.sqrt(stretch);
    this.lifted.makeTranslation(0, dy, 0).multiply(it.m).multiply(this.squash.makeScale(w, stretch, w));
    for (const mesh of this.meshes.get(key) ?? []) {
      mesh.setMatrixAt(i, this.lifted);
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  count(key: ModelKey) {
    return this.items.get(key)?.length ?? 0;
  }
}
