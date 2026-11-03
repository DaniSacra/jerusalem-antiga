/**
 * Draws the app icons (PWA and home screen) from the game's own art: the temple over a warm sky
 * and a sandy hill. Writes public/icons/*.png. Run once after changing the temple art:
 *
 *   node tools/icons/make-icons.mjs
 */
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const PORT = 5198;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:${PORT}/`);
// Start a game (dev builds expose it as window.game) so every texture exists.
await page.addInitScript(() => localStorage.setItem('jerusalem.tutorialDone', '1'));
await page.reload();
await page.waitForTimeout(1000);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.game?.textures?.exists('temple'), null, { timeout: 20000 });

/** [file, size, maskable]: maskable icons keep the art inside the central 80% safe circle. */
const ICONS = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, true],
];
for (const [file, size, maskable] of ICONS) {
  const data = await page.evaluate(
    async ([size, maskable]) => {
      const src = window.game.textures.get('temple').getSourceImage();
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d');
      const r = maskable ? 0 : size * 0.18;
      g.beginPath();
      g.roundRect(0, 0, size, size, r);
      g.clip();
      const sky = g.createLinearGradient(0, 0, 0, size);
      sky.addColorStop(0, '#7fb2d4');
      sky.addColorStop(0.55, '#f2cf8e');
      sky.addColorStop(1, '#e0b46c');
      g.fillStyle = sky;
      g.fillRect(0, 0, size, size);
      // Sandy hill under the temple.
      g.fillStyle = '#c99a5a';
      g.beginPath();
      g.ellipse(size / 2, size * 0.98, size * 0.75, size * 0.3, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ddb877';
      g.beginPath();
      g.ellipse(size / 2, size * 1.02, size * 0.7, size * 0.28, 0, 0, Math.PI * 2);
      g.fill();
      const box = size * (maskable ? 0.62 : 0.82);
      const k = Math.min(box / src.width, box / src.height);
      const w = src.width * k;
      const h = src.height * k;
      g.imageSmoothingQuality = 'high';
      g.drawImage(src, (size - w) / 2, size * (maskable ? 0.8 : 0.86) - h, w, h);
      return c.toDataURL('image/png').split(',')[1];
    },
    [size, maskable],
  );
  await writeFile(`public/icons/${file}`, Buffer.from(data, 'base64'));
  console.log(`public/icons/${file}`);
}
await browser.close();
await server.close();
