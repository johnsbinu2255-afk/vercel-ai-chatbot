// Render the reel frame-by-frame with headless Chromium and pipe JPEG frames into ffmpeg.
//
//   node scripts/render.mjs                         # full video -> out/video_silent.mp4
//   node scripts/render.mjs --stills 0.5,2.4,9       # PNG stills -> out/stills/
//   node scripts/render.mjs --from 10 --to 20 --out out/part.mp4
//   node scripts/render.mjs --workers 3              # split into parallel chunks, then concat
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(ROOT, 'web');
const TL = JSON.parse(await readFile(join(WEB, 'timeline.json'), 'utf8'));

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]] : a), []));
const FPS = TL.fps;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  try {
    const p = join(WEB, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
    if (!p.startsWith(WEB)) throw new Error('bad path');
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(await readFile(p));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${server.address().port}/`;

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: TL.width, height: TL.height }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[page]', e.message));
  page.on('console', (m) => m.type() === 'error' && console.error('[console]', m.text()));
  await page.goto(URL_);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 180000 });
  return page;
}

async function renderRange(browser, f0, f1, outFile, tag = '') {
  const page = await openPage(browser);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', outFile], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    await page.evaluate((t) => window.renderFrame(t), f / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((f - f0) % 30 === 0) {
      const el = (Date.now() - t0) / 1000, done = f - f0 + 1;
      console.log(`${tag} frame ${f}/${f1}  ${(el / done).toFixed(2)}s/frame  eta ${((f1 - f) * el / done / 60).toFixed(1)} min`);
    }
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await page.close();
}

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  if (args.stills) {
    const dir = join(ROOT, 'out', 'stills');
    await mkdir(dir, { recursive: true });
    const page = await openPage(browser);
    for (const s of String(args.stills).split(',')) {
      const t = parseFloat(s);
      await page.evaluate((tt) => window.renderFrame(tt), t);
      await page.screenshot({ path: join(dir, `still_${t.toFixed(2).padStart(6, '0')}.png`) });
      console.log('still', t);
    }
  } else {
    const from = Math.round(parseFloat(args.from ?? 0) * FPS);
    const to = Math.round(parseFloat(args.to ?? TL.duration) * FPS);
    const out = resolve(ROOT, args.out ?? 'out/video_silent.mp4');
    await mkdir(dirname(out), { recursive: true });
    const workers = parseInt(args.workers ?? 1, 10);
    if (workers <= 1) await renderRange(browser, from, to, out);
    else {
      const n = to - from, chunk = Math.ceil(n / workers), parts = [];
      await Promise.all(Array.from({ length: workers }, (_, i) => {
        const a = from + i * chunk, b = Math.min(to, a + chunk);
        const p = join(dirname(out), `.part_${i}.mp4`); parts.push(p);
        return renderRange(browser, a, b, p, `[w${i}]`);
      }));
      const list = join(dirname(out), '.parts.txt');
      await writeFile(list, parts.map((p) => `file '${p}'`).join('\n'));
      await new Promise((r) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out], { stdio: 'inherit' }).on('close', r));
      for (const p of [...parts, list]) await rm(p, { force: true });
    }
    console.log('wrote', out);
  }
} finally {
  await browser.close();
  server.close();
}
