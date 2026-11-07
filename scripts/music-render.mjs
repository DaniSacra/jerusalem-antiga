// Renders samples of the background music to WAV files for listening (the real test of the music):
// one per season (the four pieces), by day, `SECONDS` each, in music-samples/ (kept between visual runs).
// Usage: node scripts/music-render.mjs [seconds]   (default 90)
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const SECONDS = Number(process.argv[2] ?? 90);
const PORT = Number(process.env.MUSIC_PORT ?? 5198);
const OUT = 'music-samples';
const SAMPLES = [
  ['primavera', { season: 'spring', night: false, rain: false }],
  ['verao', { season: 'summer', night: false, rain: false }],
  ['outono', { season: 'autumn', night: false, rain: false }],
  ['inverno', { season: 'winter', night: false, rain: false }],
];

const server = await createServer({ server: { port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}/`, { timeout: 90000 });
  await mkdir(OUT, { recursive: true });
  for (const [name, input] of SAMPLES) {
    const b64 = await page.evaluate(
      async ([input, seconds]) => {
        const { renderOffline } = await import('/src/app/music.ts');
        const buf = await renderOffline(input, seconds, 11, 8);
        // 16-bit stereo WAV.
        const [l, r] = [buf.getChannelData(0), buf.getChannelData(1)];
        const n = l.length;
        const view = new DataView(new ArrayBuffer(44 + n * 4));
        const str = (o, s) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
        str(0, 'RIFF');
        view.setUint32(4, 36 + n * 4, true);
        str(8, 'WAVEfmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 2, true);
        view.setUint32(24, buf.sampleRate, true);
        view.setUint32(28, buf.sampleRate * 4, true);
        view.setUint16(32, 4, true);
        view.setUint16(34, 16, true);
        str(36, 'data');
        view.setUint32(40, n * 4, true);
        for (let i = 0; i < n; i++) {
          view.setInt16(44 + i * 4, Math.max(-1, Math.min(1, l[i])) * 32767, true);
          view.setInt16(46 + i * 4, Math.max(-1, Math.min(1, r[i])) * 32767, true);
        }
        const bytes = new Uint8Array(view.buffer);
        let s = '';
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(s);
      },
      [input, SECONDS],
    );
    await writeFile(`${OUT}/${name}.wav`, Buffer.from(b64, 'base64'));
    console.log(`${OUT}/${name}.wav`);
  }
} finally {
  await browser.close();
  await server.close();
}
