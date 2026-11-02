#!/usr/bin/env node
// Renders the reel to MP4: Chromium draws each frame, ffmpeg encodes.
//
//   node scripts/render.cjs                          -> video/rodo-tyres-reel.mp4
//   node scripts/render.cjs --contacts=merged        -> shared tyre number end card
//   node scripts/render.cjs --stills=1.3,4.9 --outdir=stills   (PNG frames for checking)
//
// Needs: Node 18+, Playwright with Chromium, ffmpeg on PATH.
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] === undefined ? '1' : m[2]] : [a, '1'];
  }),
);
const contacts = args.contacts === 'merged' ? 'merged' : 'three';
const outFile = path.resolve(args.out || path.join(ROOT, 'video', contacts === 'merged' ? 'rodo-tyres-reel-shared-number.mp4' : 'rodo-tyres-reel.mp4'));
const workers = Math.max(1, Number(args.workers || Math.max(1, os.cpus().length - 1)));
const tmpRoot = path.resolve(args.tmp || os.tmpdir());

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

function serve() {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(ROOT, p === '/' ? 'index.html' : p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function run(cmd, argv, opts = {}) {
  const r = spawnSync(cmd, argv, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
  if (r.status !== 0) {
    process.stderr.write(r.stderr || '');
    throw new Error(`${cmd} failed with code ${r.status}`);
  }
  return r;
}

async function openPage(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`${base}/index.html?render=1&contacts=${contacts}${args.logos === '0' ? '&logos=0' : ''}`);
  const info = await page.evaluate(() => window.REEL.ready);
  return { page, info };
}

const toBuffer = (dataUrl) => Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');

async function main() {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  try {
    const first = await openPage(browser, base);
    console.log('end card:', contacts, JSON.stringify(first.info));
    const { duration, fps } = await first.page.evaluate(() => ({ duration: window.REEL.duration, fps: window.REEL.fps }));

    if (args.stills) {
      const dir = path.resolve(args.outdir || 'stills');
      fs.mkdirSync(dir, { recursive: true });
      for (const s of args.stills.split(',')) {
        const t = Number(s);
        const png = await first.page.evaluate((tt) => window.REEL.frame(tt), t);
        const f = path.join(dir, `${contacts}-${t.toFixed(2).padStart(5, '0')}.png`);
        fs.writeFileSync(f, toBuffer(png));
        console.log('wrote', f);
      }
      return;
    }

    const tmp = fs.mkdtempSync(path.join(tmpRoot, 'rodo-reel-'));
    const framesDir = path.join(tmp, 'frames');
    fs.mkdirSync(framesDir);

    // Sound.
    const wav = await first.page.evaluate(() => window.REEL.audioWavBase64());
    const rawWav = path.join(tmp, 'sfx.wav');
    fs.writeFileSync(rawWav, Buffer.from(wav, 'base64'));
    const target = 'I=-14:TP=-1.5:LRA=11';
    const pass1 = run('ffmpeg', ['-hide_banner', '-i', rawWav, '-af', `loudnorm=${target}:print_format=json`, '-f', 'null', '-']);
    const m = JSON.parse(pass1.stderr.slice(pass1.stderr.lastIndexOf('{'), pass1.stderr.lastIndexOf('}') + 1));
    const normWav = path.join(tmp, 'sfx-norm.wav');
    run('ffmpeg', [
      '-hide_banner', '-y', '-i', rawWav, '-af',
      `loudnorm=${target}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`,
      '-ar', '48000', normWav,
    ]);
    console.log(`audio: ${m.input_i} LUFS -> -14 LUFS`);

    // Pictures, split across pages.
    const total = Math.round(duration * fps);
    const pages = [first.page];
    for (let i = 1; i < workers; i++) pages.push((await openPage(browser, base)).page);
    let next = 0;
    let done = 0;
    const started = Date.now();
    await Promise.all(
      pages.map(async (page) => {
        while (next < total) {
          const i = next++;
          const png = await page.evaluate((tt) => window.REEL.frame(tt), i / fps);
          fs.writeFileSync(path.join(framesDir, String(i).padStart(5, '0') + '.png'), toBuffer(png));
          done++;
          if (done % 60 === 0 || done === total) {
            const s = (Date.now() - started) / 1000;
            console.log(`frames ${done}/${total} (${s.toFixed(0)}s)`);
          }
        }
      }),
    );

    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    run('ffmpeg', [
      '-hide_banner', '-y',
      '-framerate', String(fps), '-i', path.join(framesDir, '%05d.png'),
      '-i', normWav,
      '-vf', 'scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', String(args.crf || 17),
      '-profile:v', 'high', '-level', '4.2', '-g', String(fps), '-bf', '2',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
      '-shortest', '-movflags', '+faststart',
      outFile,
    ]);
    console.log('wrote', outFile, (fs.statSync(outFile).size / 1e6).toFixed(1) + ' MB');
    if (args.keep !== '1') fs.rmSync(tmp, { recursive: true, force: true });
    else console.log('kept frames in', tmp);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
