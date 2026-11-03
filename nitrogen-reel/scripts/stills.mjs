#!/usr/bin/env node
// Renders single frames as PNGs for checking a scene: node scripts/stills.mjs 2.0 12.5 30.4
// Times are in seconds. Output goes to out/stills/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { openBrowser, renderStill, selectComposition } from '@remotion/renderer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const times = process.argv.slice(2).map(Number).filter((n) => !Number.isNaN(n));
const outDir = path.resolve(process.env.STILLS_DIR || path.join(ROOT, 'out', 'stills'));
fs.mkdirSync(outDir, { recursive: true });

const serveUrl = await bundle({ entryPoint: path.join(ROOT, 'src', 'index.ts'), publicDir: path.join(ROOT, 'public') });
const browserExecutable = process.env.REMOTION_BROWSER || null;
const puppeteerInstance = await openBrowser('chrome', { browserExecutable, logLevel: 'error' });
const composition = await selectComposition({ serveUrl, id: 'NitrogenReel', puppeteerInstance, logLevel: 'error' });
for (const t of times) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(t * composition.fps));
  const output = path.join(outDir, `frame-${String(frame).padStart(4, '0')}.png`);
  await renderStill({ serveUrl, composition, frame, output, puppeteerInstance, logLevel: 'error' });
  console.log(output);
}
await puppeteerInstance.close({ silent: true });
