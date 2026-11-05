/**
 * Checks that the production build is an installable app (PWA): Chrome reports no installability
 * errors, the service worker takes control, and the game still opens offline; the 3D view, opened
 * once online, opens offline too (its chunk and models are cached on first use).
 *
 *   npm run build && npm run test:pwa
 */
import { chromium } from 'playwright';
import { preview } from 'vite';

const PORT = 5197;
const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'error' });
// WebGL through SwiftShader, as in the visual tests (the 3D view needs it).
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
let failed = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) failed++;
};

const url = `http://localhost:${PORT}/`;
await page.goto(url);
await page.waitForFunction(() => navigator.serviceWorker?.controller || navigator.serviceWorker?.ready, null, { timeout: 15000 });
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload(); // the worker now controls the page and caches what it loads
await page.waitForTimeout(1500);

const cdp = await context.newCDPSession(page);
const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
check(installabilityErrors.length === 0, `installable (${JSON.stringify(installabilityErrors)})`);
const manifest = await cdp.send('Page.getAppManifest');
check(manifest.errors.length === 0, `manifest without errors (${JSON.stringify(manifest.errors)})`);
check(await page.evaluate(() => !!navigator.serviceWorker.controller), 'service worker controls the page');

/**
 * Leaves the title, taps the 3D button of the left column (its place on an 844x390 phone, in real
 * px: under the level badge and three side buttons) and waits for the 3D canvas; then Voltar.
 */
async function open3d() {
  await page.waitForTimeout(800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);
  await page.touchscreen.tap(30, 8 + 56 + 12 + 3 * (44 + 10) + 22);
  const ok = await page.waitForSelector('.v3d canvas', { timeout: 60000 }).then(() => true, () => false);
  if (ok) {
    await page.waitForTimeout(1500);
    await page.click('.v3d-back');
    await page.waitForTimeout(300);
  }
  return ok;
}
await page.evaluate(() => localStorage.setItem('jerusalem.tutorialDone', '1'));
await page.reload();
check(await open3d(), 'the 3D view opens online');

await context.setOffline(true);
await page.reload();
await page.waitForFunction(() => document.querySelector('canvas'), null, { timeout: 10000 }).catch(() => {});
check(await page.evaluate(() => !!document.querySelector('canvas')), 'the game opens offline');
check(await open3d(), 'the 3D view opens offline');
const models = await page.evaluate(async () => {
  const m = await (await fetch('./models/meshy/manifest.json')).json();
  const hits = await Promise.all(Object.values(m).map((e) => caches.match(new URL(`./models/meshy/${e.file}`, location.href).href)));
  return hits.filter(Boolean).length === Object.keys(m).length;
}).catch(() => false);
check(models, 'the 3D models are cached for offline');
check(errors.length === 0, `no page errors (${errors.join(' | ')})`);

await browser.close();
await new Promise((r) => server.httpServer.close(r));
console.log(failed ? `\n${failed} check(s) failed` : '\nInstallable app OK');
process.exit(failed ? 1 : 0);
