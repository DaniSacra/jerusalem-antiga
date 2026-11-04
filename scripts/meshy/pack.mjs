// Shrinks the raw Meshy .glb files for the phone: textures down to 1024 px (JPEG), then writes
// them to public/models/meshy/<key>.glb and prints triangles, size and bounds of each.
//
//   node scripts/meshy/pack.mjs <rawDir> house-1 house-2 ...
//
// Textures are resized in headless Chromium (Playwright), so no image library is needed.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '../../public/models/meshy');
const MAX = 1024;

function readGlb(buf) {
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const binStart = 20 + jsonLen + 8;
  const bin = buf.subarray(binStart, binStart + buf.readUInt32LE(20 + jsonLen));
  return { json, bin };
}

function writeGlb(json, views) {
  // Re-pack every buffer view (4-byte aligned) into one BIN chunk.
  const parts = [];
  let offset = 0;
  views.forEach((data, i) => {
    json.bufferViews[i].byteOffset = offset;
    json.bufferViews[i].byteLength = data.length;
    const pad = (4 - (data.length % 4)) % 4;
    parts.push(data, Buffer.alloc(pad));
    offset += data.length + pad;
  });
  const bin = Buffer.concat(parts);
  json.buffers = [{ byteLength: bin.length }];
  let text = Buffer.from(JSON.stringify(json), 'utf8');
  text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + text.length + 8 + bin.length, 8);
  const chunk = (len, type) => { const c = Buffer.alloc(8); c.writeUInt32LE(len, 0); c.writeUInt32LE(type, 4); return c; };
  return Buffer.concat([header, chunk(text.length, 0x4e4f534a), text, chunk(bin.length, 0x004e4942), bin]);
}

const [rawDir, ...keys] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage();
async function shrink(data, mime) {
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
  }, { src: `data:${mime};base64,${data.toString('base64')}`, max: MAX });
  return Buffer.from(b64, 'base64');
}

for (const key of keys) {
  const { json, bin } = readGlb(readFileSync(join(rawDir, `${key}.glb`)));
  const views = json.bufferViews.map((v) => bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength));
  for (const image of json.images ?? []) {
    views[image.bufferView] = await shrink(views[image.bufferView], image.mimeType);
    image.mimeType = 'image/jpeg';
  }
  const glb = writeGlb(json, views);
  writeFileSync(join(OUT, `${key}.glb`), glb);
  let tris = 0;
  for (const m of json.meshes) for (const p of m.primitives) {
    tris += (p.indices !== undefined ? json.accessors[p.indices].count : json.accessors[p.attributes.POSITION].count) / 3;
  }
  const pos = json.accessors[json.meshes[0].primitives[0].attributes.POSITION];
  const size = pos.max.map((v, i) => (v - pos.min[i]).toFixed(2)).join(' x ');
  console.log(`${key}: ${tris} tris, ${(glb.length / 1024).toFixed(0)} KB, size ${size}, images ${json.images?.length ?? 0}`);
}
await browser.close();
