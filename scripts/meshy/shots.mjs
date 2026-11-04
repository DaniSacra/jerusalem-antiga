// Screenshots of the 3D proof with the Meshy model pack and with the code-built models, by day,
// for the same city: an overview and close-ups of the temple, houses and market.
//
//   node scripts/meshy/shots.mjs [port] [city query, default weeks=156]   (screenshots in screenshots/meshy/)
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = Number(process.argv[2] ?? 5191);
const BASE = `http://localhost:${PORT}`;
const CITY = process.argv[3] ?? 'weeks=156';
const OUT = 'screenshots/meshy';
mkdirSync(OUT, { recursive: true });

const server = spawn('node_modules/.bin/vite', ['--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'inherit'] });
server.stdout.resume();
for (let k = 0; k < 60; k++) {
  if (await fetch(BASE).then(() => true, () => false)) break;
  await new Promise((r) => setTimeout(r, 500));
}

const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.error('page error:', e.message));
page.on('console', (m) => m.type() === 'error' && console.error('console:', m.text()));

/** Camera on the first building of a kind (or the city centre), at a distance and turn. */
const look = (kind, dist, yaw) => page.evaluate(({ kind, dist, yaw }) => {
  const { rig, state } = window.poc;
  const b = kind && state.buildings.find((b) => (typeof kind === 'string' ? b.kind === kind : b.kind === kind[0] && b.level === kind[1]));
  if (kind && !b) return false;
  if (b) rig.target.set(b.x + b.w / 2, 0, b.y + b.h / 2);
  rig.dist = dist;
  if (yaw !== undefined) rig.yaw = yaw;
  return true;
}, { kind, dist, yaw });

const VIEWS = {
  longe: [null, 70],
  geral: [null, 30],
  templo: ['temple', 13],
  mercado: ['market', 9],
  praca: ['plaza', 8],
  'casa-1': [['house', 1], 7],
  'casa-2': [['house', 2], 7],
  'casa-3': [['house', 3], 7],
  'casa-4': [['house', 4], 7],
};

try {
  for (const [tag, q] of [['meshy', '&models=./models/meshy/manifest.json'], ['codigo', '']]) {
    await page.goto(`${BASE}/poc.html?${CITY}&bot=off&quality=high${q}`);
    await page.waitForFunction(() => window.poc?.ready, null, { timeout: 180000 });
    const pos = await page.evaluate(() => window.poc.driver.pos);
    await page.evaluate((p) => window.poc.view({ pos: Math.floor(p) + 0.3, weather: { rain: 0, overcast: 0, wet: 0, puddles: 0, snowing: false } }), pos);
    for (const [name, [kind, dist]] of Object.entries(VIEWS)) {
      if (!(await look(kind, dist))) { console.log(`${tag} ${name}: none in this city`); continue; }
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/${tag}-${CITY.replace('=', '')}-${name}.png` });
    }
    console.log(tag, JSON.stringify(await page.evaluate(() => window.poc.info())));
  }
} finally {
  await browser.close();
  server.kill();
}
