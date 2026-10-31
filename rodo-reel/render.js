// Usage: node render.js [stills t1,t2,...] | node render.js video out.mp4
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
(async () => {
  const mode = process.argv[2] || 'video';
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto('file://' + path.resolve(__dirname, 'reel.html') + '?render');
  await page.evaluate(() => document.fonts.ready); await page.evaluate(() => window.assetsReady);
  const grab = async t => {
    const b64 = await page.evaluate(t => { renderFrame(t); return document.getElementById('out').toDataURL('image/jpeg', 0.95).split(',')[1]; }, t);
    return Buffer.from(b64, 'base64');
  };
  if (mode === 'stills') {
    const dir = process.argv[4] || 'stills'; fs.mkdirSync(dir, { recursive: true });
    for (const t of process.argv[3].split(',').map(Number)) fs.writeFileSync(`${dir}/t${t.toFixed(2)}.jpg`, await grab(t));
  } else {
    const out = process.argv[3] || 'video_silent.mp4';
    const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30', out], { stdio: ['pipe', 'ignore', 'inherit'] });
    for (let f = 0; f < 900; f++) {
      const buf = await grab(f / 30);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (f % 90 === 0) console.log('frame', f);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
  }
  await browser.close();
})();
