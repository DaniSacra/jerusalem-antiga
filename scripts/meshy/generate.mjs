// Generates 3D models in Meshy (text-to-3D: preview, then refine with texture) for the 3D proof.
// The API key is read from ../jerusalem-antiga/.env.local and is never printed or written.
//
//   node scripts/meshy/generate.mjs balance
//   node scripts/meshy/generate.mjs run <rawDir> house-1 house-2 ...   (keys from prompts.json)
//
// Uses Smart Topology (meshy-t2.5) so the mesh comes out low-poly at the target face count.
// Task ids and credits are kept in scripts/meshy/tasks.json; raw .glb files go to <rawDir>.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ENV = '/home/dani/projects/jerusalem-antiga/.env.local';
const API = 'https://api.meshy.ai/openapi';
const TASKS = join(here, 'tasks.json');

function apiKey() {
  const line = readFileSync(ENV, 'utf8').split('\n').find((l) => l.startsWith('MESHY_API_KEY='));
  if (!line) throw new Error('MESHY_API_KEY missing in .env.local');
  return line.slice('MESHY_API_KEY='.length).trim().replace(/^["']|["']$/g, '');
}
const KEY = apiKey();

async function call(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function wait(id, label) {
  for (;;) {
    const t = await call('GET', `/v2/text-to-3d/${id}`);
    if (t.status === 'SUCCEEDED') return t;
    if (t.status === 'FAILED' || t.status === 'CANCELED') throw new Error(`${label} ${t.status}: ${JSON.stringify(t.task_error)}`);
    await sleep(10000);
  }
}

const loadTasks = () => (existsSync(TASKS) ? JSON.parse(readFileSync(TASKS, 'utf8')) : {});
function saveTask(key, data) {
  const all = loadTasks();
  all[key] = { ...(all[key] ?? {}), ...data };
  writeFileSync(TASKS, JSON.stringify(all, null, 2) + '\n');
}

async function generate(key, spec, style, rawDir) {
  const prompt = `${spec.prompt} ${spec.style ?? style}`;
  if (prompt.length > 800) throw new Error(`${key}: prompt has ${prompt.length} chars`);
  const previewId = (await call('POST', '/v2/text-to-3d', {
    mode: 'preview', prompt, model_type: 'smart-topology', ai_model: 'meshy-t2.5',
    target_polycount: spec.polycount, topology: 'triangle', target_formats: ['glb'],
  })).result;
  saveTask(key, { prompt, polycount: spec.polycount, previewId, attempt: (loadTasks()[key]?.attempt ?? 0) + 1 });
  console.log(`${key}: preview ${previewId}`);
  const preview = await wait(previewId, `${key} preview`);
  const refineId = (await call('POST', '/v2/text-to-3d', {
    mode: 'refine', preview_task_id: previewId, texture_resolution: '2k', enable_pbr: false, target_formats: ['glb'],
  })).result;
  saveTask(key, { refineId, previewCredits: preview.consumed_credits });
  console.log(`${key}: refine ${refineId}`);
  const refine = await wait(refineId, `${key} refine`);
  const glb = Buffer.from(await (await fetch(refine.model_urls.glb)).arrayBuffer());
  writeFileSync(join(rawDir, `${key}.glb`), glb);
  if (refine.thumbnail_url) writeFileSync(join(rawDir, `${key}.png`), Buffer.from(await (await fetch(refine.thumbnail_url)).arrayBuffer()));
  saveTask(key, { refineCredits: refine.consumed_credits, rawBytes: glb.length });
  console.log(`${key}: done (${preview.consumed_credits}+${refine.consumed_credits} credits, ${glb.length} bytes)`);
}

const [cmd, rawDir, ...keys] = process.argv.slice(2);
if (cmd === 'balance') {
  console.log((await call('GET', '/v1/balance')).balance);
} else if (cmd === 'run') {
  const { style, models } = JSON.parse(readFileSync(join(here, 'prompts.json'), 'utf8'));
  mkdirSync(rawDir, { recursive: true });
  const results = await Promise.allSettled(keys.map((k) => generate(k, models[k], style, rawDir)));
  results.forEach((r, i) => r.status === 'rejected' && console.log(`${keys[i]}: FAILED ${r.reason.message}`));
} else {
  console.log('usage: balance | run <rawDir> <keys...>');
}
