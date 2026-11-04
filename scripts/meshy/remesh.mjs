// Makes light versions of finished Meshy models with the Remesh API (triangle decimation,
// texture kept), so the city stays cheap on the phone. 5 credits per model.
// The API key is read from ../jerusalem-antiga/.env.local and is never printed or written.
//
//   node scripts/meshy/remesh.mjs <rawDir> house-1:1800 temple:4000 ...   (key:target triangles)
//
// The source is the refine task of each key in scripts/meshy/tasks.json; the remesh task id and
// credits are saved there too. Raw .glb files go to <rawDir> (then run pack.mjs on them).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ENV = '/home/dani/projects/jerusalem-antiga/.env.local';
const API = 'https://api.meshy.ai/openapi';
const TASKS = join(here, 'tasks.json');

const line = readFileSync(ENV, 'utf8').split('\n').find((l) => l.startsWith('MESHY_API_KEY='));
if (!line) throw new Error('MESHY_API_KEY missing in .env.local');
const KEY = line.slice('MESHY_API_KEY='.length).trim().replace(/^["']|["']$/g, '');

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
const loadTasks = () => JSON.parse(readFileSync(TASKS, 'utf8'));
function saveTask(key, data) {
  const all = loadTasks();
  all[key] = { ...all[key], ...data };
  writeFileSync(TASKS, JSON.stringify(all, null, 2) + '\n');
}

async function remesh(key, target, rawDir) {
  const source = loadTasks()[key]?.refineId;
  if (!source) throw new Error(`${key}: no refine task`);
  const id = (await call('POST', '/v1/remesh', {
    input_task_id: source, topology: 'triangle', target_polycount: target, target_formats: ['glb'],
  })).result;
  saveTask(key, { remeshId: id, remeshTarget: target });
  console.log(`${key}: remesh ${id}`);
  let t;
  for (;;) {
    t = await call('GET', `/v1/remesh/${id}`);
    if (t.status === 'SUCCEEDED') break;
    if (t.status === 'FAILED' || t.status === 'CANCELED') throw new Error(`${key} ${t.status}: ${JSON.stringify(t.task_error)}`);
    await sleep(8000);
  }
  const glb = Buffer.from(await (await fetch(t.model_urls.glb)).arrayBuffer());
  writeFileSync(join(rawDir, `${key}.glb`), glb);
  saveTask(key, { remeshCredits: t.consumed_credits });
  console.log(`${key}: done (${t.consumed_credits} credits, ${glb.length} bytes, textures ${t.texture_urls?.length ?? 0})`);
}

const [rawDir, ...pairs] = process.argv.slice(2);
mkdirSync(rawDir, { recursive: true });
const jobs = pairs.map((p) => p.split(':')).map(([k, n]) => [k, Number(n)]);
const results = await Promise.allSettled(jobs.map(([k, n]) => remesh(k, n, rawDir)));
results.forEach((r, i) => r.status === 'rejected' && console.log(`${jobs[i][0]}: FAILED ${r.reason.message}`));
