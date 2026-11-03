#!/usr/bin/env node
// Full render: prepare assets -> Remotion render -> level the sound -> MP4.
//   npm run render
// Output: video/rodo-nitrogen-vs-normal-air.mp4
// Set REMOTION_BROWSER=/path/to/chrome to use a browser you already have.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { master } from './master.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'video', 'rodo-nitrogen-vs-normal-air.mp4');
const TMP = path.join(ROOT, 'out');
const RAW = path.join(TMP, 'raw.mkv');
const bin = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'remotion.cmd' : 'remotion');

const RAW_SOUND = path.join(TMP, 'sound.wav');
// --sound-only re-renders just the sound (fast) and reuses the last video render.
// --master-only re-does just the final levelling and MP4 step.
const haveVideo = fs.existsSync(RAW);
const soundOnly = process.argv.includes('--sound-only') && haveVideo;
const masterOnly = process.argv.includes('--master-only') && haveVideo;
fs.mkdirSync(TMP, { recursive: true });
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const started = Date.now();
if (!masterOnly) await render(soundOnly);

async function render(sound) {
execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'prepare-assets.mjs')], { stdio: 'inherit' });
const serveUrl = await bundle({ entryPoint: path.join(ROOT, 'src', 'index.ts'), publicDir: path.join(ROOT, 'public') });
const browserExecutable = process.env.REMOTION_BROWSER || null;
const composition = await selectComposition({ serveUrl, id: 'NitrogenReel', browserExecutable, logLevel: 'error' });
let last = -1;
await renderMedia({
  serveUrl,
  composition,
  // The sound stays lossless (PCM) until the final AAC encode.
  ...(sound
    ? { codec: 'wav', outputLocation: RAW_SOUND }
    : {
        codec: 'h264-mkv',
        audioCodec: 'pcm-16',
        outputLocation: RAW,
        crf: 17,
        x264Preset: 'slow',
        imageFormat: 'jpeg',
        jpegQuality: 95,
        colorSpace: 'bt709',
        pixelFormat: 'yuv420p',
      }),
  concurrency: Number(process.env.REMOTION_CONCURRENCY) || os.cpus().length,
  browserExecutable,
  logLevel: 'error',
  onProgress: ({ progress }) => {
    const pct = Math.floor(progress * 10) * 10;
    if (pct !== last) {
      last = pct;
      console.log(`render ${pct}% (${Math.round((Date.now() - started) / 1000)} s)`);
    }
  },
});
}

// Sound: level to -16 LUFS with a look-ahead true-peak limiter (ceiling -3 dB) so nothing clips,
// and fade the final bass tail to silence by the last frame.
const audio = soundOnly || (masterOnly && fs.existsSync(RAW_SOUND) && fs.statSync(RAW_SOUND).mtimeMs > fs.statSync(RAW).mtimeMs) ? RAW_SOUND : RAW;
const result = master({ bin, raw: RAW, audio, wav: path.join(TMP, 'master.wav'), out: OUT });
console.log(
  `sound: ${result.before.toFixed(1)} LUFS -> ${result.after.toFixed(1)} LUFS (gain ${result.gainDb.toFixed(1)} dB, limiter at most ${result.limiterDb.toFixed(1)} dB)`,
);
console.log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB) in ${Math.round((Date.now() - started) / 1000)} s`);
