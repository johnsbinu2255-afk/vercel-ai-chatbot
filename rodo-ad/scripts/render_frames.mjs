// Renders frames with headless Chromium (software WebGL).
//   node scripts/render_frames.mjs --layer main --from 12.6 --to 40 --out <dir>   (add --variant solo for the no-car ending)
//   node scripts/render_frames.mjs --still 16.8 --out <file.png>
import { createRequire } from 'node:module';
// playwright is resolved CommonJS-style so a globally installed copy (NODE_PATH) works too
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';
import path from 'node:path';
import { startServer } from './serve.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const FPS = 30;
const layer = arg('layer', 'main');
const still = arg('still', null);
const out = arg('out', 'frames');

const server = await startServer(0);
const variant = arg('variant', '');
const url = `http://127.0.0.1:${server.address().port}/render/index.html?layer=${layer}${variant ? `&variant=${variant}` : ''}`;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-vsync', '--force-color-profile=srgb'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[page ${m.type()}]`, m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(url);
await page.waitForFunction(() => window.rendererReady || window.rendererError, null, { timeout: 120000 });
const err = await page.evaluate(() => window.rendererError);
if (err) { console.error(err); process.exit(1); }

const shot = async (t, file) => {
  await page.evaluate((tt) => window.renderAt(tt), t);
  await page.screenshot({ path: file, omitBackground: layer === 'main', type: 'png' });
};

if (still !== null) {
  const times = still.split(',').map(Number);
  for (const t of times) {
    const file = times.length === 1 ? out : path.join(out, `still_${t.toFixed(2)}.png`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const t0 = Date.now(); await shot(t, file); console.log(`t=${t} -> ${file} (${Date.now() - t0} ms)`);
  }
} else {
  const f0 = Math.round(parseFloat(arg('from', '0')) * FPS), f1 = Math.round(parseFloat(arg('to', '40')) * FPS);
  fs.mkdirSync(out, { recursive: true });
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    const file = path.join(out, `f_${String(f).padStart(5, '0')}.png`);
    if (fs.existsSync(file) && !process.argv.includes('--force')) continue;
    await shot(f / FPS, file);
    if ((f - f0) % 30 === 0) console.log(`frame ${f} (${f1 - f} left, ${((Date.now() - t0) / 1000).toFixed(0)} s elapsed)`);
  }
}
await browser.close(); server.close();
