// Minimal .glb reading and writing for the Meshy scripts (one BIN chunk, no extensions).

export function readGlb(buf) {
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const binStart = 20 + jsonLen + 8;
  const bin = buf.subarray(binStart, binStart + buf.readUInt32LE(20 + jsonLen));
  return { json, bin };
}

export function writeGlb(json, views) {
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

/** Triangles of every primitive in a glTF json. */
export function triangles(json) {
  let tris = 0;
  for (const m of json.meshes) for (const p of m.primitives) {
    tris += (p.indices !== undefined ? json.accessors[p.indices].count : json.accessors[p.attributes.POSITION].count) / 3;
  }
  return tris;
}
