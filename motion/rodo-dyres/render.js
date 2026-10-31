// Renders logo-animation.html frame-by-frame and encodes an MP4 with ffmpeg.
// Usage: node render.js [fps]
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

(async () => {
  const fps = Number(process.argv[2] || 30);
  const dir = __dirname;
  const frames = fs.mkdtempSync(path.join(os.tmpdir(), 'rodo-frames-'));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.addInitScript(() => { window.__RECORDING__ = true; });
  await page.goto('file://' + path.join(dir, 'logo-animation.html'));
  await page.evaluate(() => window.__ready);
  const duration = await page.evaluate(() => window.DURATION);
  const canvas = await page.$('canvas');
  const n = Math.round(duration * fps);
  for (let i = 0; i < n; i++) {
    await page.evaluate(t => window.render(t), i / fps);
    await canvas.screenshot({ path: path.join(frames, `f${String(i).padStart(4, '0')}.png`) });
  }
  await browser.close();
  const out = path.join(dir, 'rodo-dyres-logo.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps),
    '-i', path.join(frames, 'f%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    '-crf', '18', '-movflags', '+faststart', out]);
  fs.rmSync(frames, { recursive: true, force: true });
  console.log('wrote', out, n, 'frames');
})();
