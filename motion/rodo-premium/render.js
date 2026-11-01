// Renders scene.html in headless Chromium (WebGL via SwiftShader).
//   node render.js stills 0.8,1.9,3.2 <outDir> [samples]   -> still PNGs for checking
//   node render.js frames [from] [to]                      -> frames/f0000.png ... (skips frames already done)
//   node render.js encode                                  -> rodo-logo-8s.mp4 (adds audio.wav if present)
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = __dirname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf' };
const serve = () => new Promise(res => {
  const srv = http.createServer((q, s) => {
    const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
    if (!f.startsWith(root)) { s.writeHead(403); return s.end(); }
    fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); });
  });
  srv.listen(0, () => res(srv));
});
const writeDataUrl = (file, url) => fs.writeFileSync(file, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));

async function openScene() {
  const srv = await serve();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.type(), m.text()); });
  await page.addInitScript(() => { window.__RECORDING__ = true; });
  await page.goto(`http://localhost:${srv.address().port}/scene.html`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 300000 });
  return { srv, browser, page };
}

(async () => {
  const mode = process.argv[2] || 'frames';
  if (mode === 'encode') {
    const out = path.join(root, 'rodo-logo-8s.mp4');
    const audio = path.join(root, 'audio.wav');
    const args = ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(root, 'frames', 'f%04d.png')];
    if (fs.existsSync(audio)) args.push('-i', audio);
    args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart');
    if (fs.existsSync(audio)) args.push('-c:a', 'aac', '-b:a', '256k', '-shortest');
    args.push(out);
    execFileSync('ffmpeg', args, { stdio: 'inherit' });
    console.log('wrote', out);
    return;
  }
  const { srv, browser, page } = await openScene();
  console.log('scene info', JSON.stringify(await page.evaluate(() => window.__info)));
  if (mode === 'stills') {
    const times = process.argv[3].split(',').map(Number);
    const outDir = process.argv[4] || root;
    const K = Number(process.argv[5] || 1);
    fs.mkdirSync(outDir, { recursive: true });
    for (const t of times) {
      const t0 = Date.now();
      const url = await page.evaluate(([t, K]) => window.renderStill(t, K), [t, K]);
      writeDataUrl(path.join(outDir, `still_${t.toFixed(2)}.png`), url);
      console.log('still', t, (Date.now() - t0) + 'ms');
    }
  } else {
    const fps = await page.evaluate(() => window.FPS), dur = await page.evaluate(() => window.DURATION);
    const n = Math.round(fps * dur);
    const from = Number(process.argv[3] || 0), to = Math.min(n, Number(process.argv[4] || n));
    const dir = path.join(root, 'frames');
    fs.mkdirSync(dir, { recursive: true });
    const t0 = Date.now();
    for (let f = from; f < to; f++) {
      const file = path.join(dir, `f${String(f).padStart(4, '0')}.png`);
      if (fs.existsSync(file)) continue;
      writeDataUrl(file, await page.evaluate(f => window.renderFrame(f), f));
      if (f % 10 === 0) console.log(`frame ${f}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    console.log('frames done', from, to);
  }
  await browser.close(); srv.close();
})();
