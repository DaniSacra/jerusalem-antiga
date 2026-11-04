import * as THREE from 'three';
import type { ModelKey, Prototype } from './models';

/**
 * Collects every copy of every model, then draws each model part as one InstancedMesh: a city of
 * 150 buildings and 300 trees costs a few dozen draw calls instead of thousands.
 */
export class Instancer {
  private items = new Map<ModelKey, { m: THREE.Matrix4; tint: THREE.Color }[]>();
  private tmp = new THREE.Object3D();

  constructor(private models: Record<ModelKey, Prototype>) {}

  add(key: ModelKey, x: number, y: number, z: number, rotY = 0, scale = 1, tint = 1) {
    this.tmp.position.set(x, y, z);
    this.tmp.rotation.set(0, rotY, 0);
    this.tmp.scale.setScalar(scale);
    this.tmp.updateMatrix();
    const list = this.items.get(key) ?? [];
    list.push({ m: this.tmp.matrix.clone(), tint: new THREE.Color(tint, tint, tint) });
    this.items.set(key, list);
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
        mesh.castShadow = shadows && key !== 'road';
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        mesh.name = key;
        group.add(mesh);
      }
    }
    return group;
  }

  count(key: ModelKey) {
    return this.items.get(key)?.length ?? 0;
  }
}
