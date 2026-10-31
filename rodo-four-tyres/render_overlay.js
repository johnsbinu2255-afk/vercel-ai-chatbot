// node render_overlay.js stills t1,t2,... outdir [preview]   -> JPG stills (preview backgrounds)
// node render_overlay.js frames outdir                        -> overlay_%05d.png with alpha, 1200 frames @30fps
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
if (process.argv[2] !== 'clip') (async () => {
  const [mode, a1, a2, a3] = process.argv.slice(2);
  const preview = mode === 'stills' && a3 !== 'nopreview';
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto('file://' + path.resolve(__dirname, 'overlay.html') + '?render' + (preview ? '&preview' : '') + (process.env.BRAND ? '&brand=' + process.env.BRAND : ''));
  await page.evaluate(() => document.fonts.ready); await page.evaluate(() => window.assetsReady);
  await page.waitForTimeout(300);
  const grab = (t, type) => page.evaluate(([t, type]) => { renderFrame(t); return document.getElementById('out').toDataURL(type, .92).split(',')[1]; }, [t, type]);
  if (mode === 'stills') {
    fs.mkdirSync(a2, { recursive: true });
    for (const t of a1.split(',').map(Number)) fs.writeFileSync(`${a2}/o${t.toFixed(2)}.jpg`, Buffer.from(await grab(t, 'image/jpeg'), 'base64'));
  } else {
    fs.mkdirSync(a1, { recursive: true });
    for (let f = 0; f < 1200; f++) fs.writeFileSync(`${a1}/overlay_${String(f).padStart(5, '0')}.png`, Buffer.from(await grab(f / 30, 'image/png'), 'base64'));
  }
  await browser.close();
})();
// node render_overlay.js clip START END out.mp4   -> opaque preview clip on the clean studio stand-in
if (process.argv[2] === 'clip') (async () => {
  const [, , , A, B, OUT] = process.argv; const { spawn } = require('child_process');
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto('file://' + path.resolve(__dirname, 'overlay.html') + '?render&preview&clean' + (process.env.BRAND ? '&brand=' + process.env.BRAND : ''));
  await page.evaluate(() => document.fonts.ready); await page.evaluate(() => window.assetsReady);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', OUT], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = Math.round(A * 30); f < Math.round(B * 30); f++) {
    const b64 = await page.evaluate(t => { renderFrame(t); return document.getElementById('out').toDataURL('image/jpeg', .95).split(',')[1]; }, f / 30);
    if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); await browser.close();
})();
