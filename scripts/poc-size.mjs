// Download size of the 3D proof against the 2D game: builds both and sums the gzip size of what
// each page loads first (the 3D page loads Phaser only when the 2D view is opened).
// Usage: node scripts/poc-size.mjs
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const build = (args) => execSync(`node_modules/.bin/vite build ${args}`, { stdio: 'pipe' });
build('-c vite.poc.config.ts');
build('--outDir dist-2d-size --emptyOutDir');

const files = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));
const gz = (f) => gzipSync(readFileSync(f)).length;
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

const sum = (dir, pick) => files(dir).filter(pick).reduce((a, f) => ({ raw: a.raw + statSync(f).size, gzip: a.gzip + gz(f) }), { raw: 0, gzip: 0 });
const isCode = (f) => /\.(js|css|html)$/.test(f);
// Loaded on demand: the 2D game with Phaser (toggle) and the .glb loader (model packs only).
const lazy = (f) => /(twod|GLTFLoader)-.*\.js$/.test(f);
const poc = sum('dist-poc', isCode);
const pocLazy = sum('dist-poc', lazy);
const twoD = sum('dist-2d-size', isCode);
const out = {
  '3D (first load, no Phaser)': kb(poc.gzip - pocLazy.gzip),
  '3D + opening the 2D view (Phaser on demand)': kb(poc.gzip),
  '2D game (code)': kb(twoD.gzip),
  raw: { '3D first load': kb(poc.raw - pocLazy.raw), '2D game': kb(twoD.raw) },
};
console.log(JSON.stringify(out, null, 2));
