// Light versions of the packed Meshy models, made locally with meshoptimizer (free, keeps the
// texture and UVs). The Meshy Remesh API was tried first but broke thin walls and columns at
// these low counts (see CREDITS.md).
//
//   node scripts/meshy/simplify.mjs <srcDir> <outDir> house-1:1800 temple:4000 ...   (key:triangles)
//
// <srcDir> holds packed .glb files (one indexed triangle primitive per mesh, float attributes).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MeshoptSimplifier } from 'meshoptimizer';
import { readGlb, writeGlb, triangles } from './glb.mjs';

await MeshoptSimplifier.ready;
// Highest error allowed, relative to the model size: the triangle target is what stops it.
const ERROR = Number(process.env.ERROR ?? 0.2);
// FLAGS=Prune also drops tiny loose pieces (a canopy of many separate leaves stops early otherwise).
const FLAGS = (process.env.FLAGS ?? '').split(',').filter(Boolean);
const [srcDir, outDir, ...pairs] = process.argv.slice(2);

const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const floats = (json, views, a) => {
  const v = views[json.accessors[a].bufferView];
  return new Float32Array(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength));
};

for (const [key, target] of pairs.map((p) => p.split(':')).map(([k, n]) => [k, Number(n)])) {
  const { json, bin } = readGlb(readFileSync(join(srcDir, `${key}.glb`)));
  const views = json.bufferViews.map((v) => bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength));
  const before = triangles(json);
  const ratio = Math.min(1, target / before);
  for (const mesh of json.meshes) for (const prim of mesh.primitives) {
    const idxAcc = json.accessors[prim.indices];
    const iv = views[idxAcc.bufferView];
    const src = idxAcc.componentType === 5125
      ? new Uint32Array(iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength))
      : Uint32Array.from(new Uint16Array(iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength)));
    const pos = floats(json, views, prim.attributes.POSITION);
    const want = Math.floor((src.length * ratio) / 3) * 3;
    const [simple] = MeshoptSimplifier.simplify(src, pos, 3, want, ERROR, FLAGS);
    // Keep only the vertices still used, in order, and rewrite every attribute.
    const [remap, count] = MeshoptSimplifier.compactMesh(simple);
    for (const a of Object.values(prim.attributes)) {
      const acc = json.accessors[a];
      const n = SIZE[acc.type];
      const data = floats(json, views, a);
      const out = new Float32Array(count * n);
      remap.forEach((to, from) => { if (to !== 0xffffffff) out.set(data.subarray(from * n, from * n + n), to * n); });
      views[acc.bufferView] = Buffer.from(out.buffer);
      acc.count = count;
      if (acc.min) {
        acc.min = Array.from({ length: n }, (_, c) => Math.min(...Array.from({ length: count }, (_, i) => out[i * n + c])));
        acc.max = Array.from({ length: n }, (_, c) => Math.max(...Array.from({ length: count }, (_, i) => out[i * n + c])));
      }
    }
    views[idxAcc.bufferView] = Buffer.from(simple.buffer, simple.byteOffset, simple.byteLength);
    idxAcc.componentType = 5125;
    idxAcc.count = simple.length;
    delete idxAcc.min;
    delete idxAcc.max;
  }
  const glb = writeGlb(json, views);
  writeFileSync(join(outDir, `${key}.glb`), glb);
  console.log(`${key}: ${before} -> ${triangles(json)} tris, ${(glb.length / 1024).toFixed(0)} KB`);
}
