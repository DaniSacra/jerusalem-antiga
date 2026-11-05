// Shrinks the raw Meshy .glb files for the phone: textures down to 1024 px (JPEG), then writes
// them to public/models/meshy/<key>.glb (or PACK_OUT) and prints triangles, size and bounds of each.
// Remeshed models come with baked normal and metallic-roughness maps: the metallic-roughness map
// is dropped (matte, like the first pack) and the normal map is kept at NORMAL px (0 drops it).
//
//   [NORMAL=512] [PACK_OUT=dir] node scripts/meshy/pack.mjs <rawDir> house-1 house-2 ...
//
// Textures are resized in headless Chromium (Playwright), so no image library is needed.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { readGlb, writeGlb, triangles } from './glb.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.PACK_OUT ?? join(here, '../../public/models/meshy');
const MAX = 1024;
const NORMAL = Number(process.env.NORMAL ?? 512);

/** Drops textures and images no material uses, renumbering the references. */
function pruneTextures(json) {
  if (!json.textures) return;
  const refs = [];
  for (const m of json.materials ?? []) {
    for (const r of [m.normalTexture, m.occlusionTexture, m.emissiveTexture, m.pbrMetallicRoughness?.baseColorTexture]) if (r) refs.push(r);
  }
  const usedTex = [...new Set(refs.map((r) => r.index))].sort((a, b) => a - b);
  for (const r of refs) r.index = usedTex.indexOf(r.index);
  json.textures = usedTex.map((i) => json.textures[i]);
  const usedImg = [...new Set(json.textures.map((t) => t.source))].sort((a, b) => a - b);
  for (const t of json.textures) t.source = usedImg.indexOf(t.source);
  json.images = usedImg.map((i) => json.images[i]);
}

/** Drops buffer views nothing points at (the removed images), renumbering the references. */
function pruneViews(json, views) {
  const holders = [...(json.accessors ?? []), ...(json.images ?? [])].filter((o) => o.bufferView !== undefined);
  const used = [...new Set(holders.map((o) => o.bufferView))].sort((a, b) => a - b);
  for (const o of holders) o.bufferView = used.indexOf(o.bufferView);
  json.bufferViews = used.map((i) => json.bufferViews[i]);
  return used.map((i) => views[i]);
}

const [rawDir, ...keys] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage();
async function shrink(data, mime, max) {
  const b64 = await page.evaluate(async ({ src, max }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85).split(',')[1];
  }, { src: `data:${mime};base64,${data.toString('base64')}`, max });
  return Buffer.from(b64, 'base64');
}

for (const key of keys) {
  const { json, bin } = readGlb(readFileSync(join(rawDir, `${key}.glb`)));
  let views = json.bufferViews.map((v) => bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength));
  // Matte material: no metallic-roughness map, optional normal map.
  for (const m of json.materials ?? []) {
    const pbr = (m.pbrMetallicRoughness ??= {});
    delete pbr.metallicRoughnessTexture;
    pbr.metallicFactor = 0;
    pbr.roughnessFactor = 0.8;
    if (!NORMAL) delete m.normalTexture;
  }
  pruneTextures(json);
  const normals = new Set((json.materials ?? []).filter((m) => m.normalTexture).map((m) => json.textures[m.normalTexture.index].source));
  for (const [i, image] of (json.images ?? []).entries()) {
    views[image.bufferView] = await shrink(views[image.bufferView], image.mimeType, normals.has(i) ? NORMAL : MAX);
    image.mimeType = 'image/jpeg';
  }
  views = pruneViews(json, views);
  const glb = writeGlb(json, views);
  writeFileSync(join(OUT, `${key}.glb`), glb);
  const tris = triangles(json);
  const pos = json.accessors[json.meshes[0].primitives[0].attributes.POSITION];
  const size = pos.max.map((v, i) => (v - pos.min[i]).toFixed(2)).join(' x ');
  console.log(`${key}: ${tris} tris, ${(glb.length / 1024).toFixed(0)} KB, size ${size}, images ${json.images?.length ?? 0}`);
}
await browser.close();
