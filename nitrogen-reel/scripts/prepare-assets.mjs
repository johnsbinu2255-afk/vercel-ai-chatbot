#!/usr/bin/env node
// Gets everything the composition needs into public/ and writes src/generated/assets.json:
//  - logos from assets/logos (rodo, jk, apollo, bridgestone, yokohama, continental, michelin)
//  - sound effects: assets/sfx/<name>.(wav|mp3|...) if you added one, otherwise synthesised
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { PEAKS, RECIPES, TARGETS } from './sfx/recipes.mjs';
import { SR, wav16, level } from './sfx/dsp.mjs';
import { decodeAudio, remotionBin } from './wav.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
// assets/ inside this project first, then the repository root's assets/.
const searchDirs = (kind) => [path.join(ROOT, 'assets', kind), path.join(ROOT, '..', 'assets', kind)];
const LOGOS = ['rodo', 'jk', 'apollo', 'bridgestone', 'yokohama', 'continental', 'michelin'];
const LOGO_EXT = ['.png', '.webp', '.jpg', '.jpeg', '.svg'];
const SFX_EXT = ['.wav', '.mp3', '.ogg', '.m4a', '.aac', '.flac'];

function find(kind, name, exts) {
  for (const dir of searchDirs(kind)) {
    for (const e of exts) {
      const f = path.join(dir, name + e);
      if (fs.existsSync(f)) return f;
    }
  }
  return null;
}

function resetDir(d) {
  fs.rmSync(d, { recursive: true, force: true });
  fs.mkdirSync(d, { recursive: true });
}

// A logo on a solid background gets a cut-out copy (used for the white watermark).
function cutout(png) {
  const { width: w, height: h, data } = png;
  const at = (x, y) => (y * w + x) * 4;
  const corners = [at(2, 2), at(w - 3, 2), at(2, h - 3), at(w - 3, h - 3)];
  if (corners.some((i) => data[i + 3] < 200)) return { opaque: false, cut: null };
  const bg = [0, 1, 2].map((c) => corners.map((i) => data[i + c]).sort((a, b) => a - b)[1]);
  const out = new PNG({ width: w, height: h });
  for (let i = 0; i < data.length; i += 4) {
    const d = Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]);
    const a = Math.min(1, Math.max(0, (d - 28) / 52));
    for (let c = 0; c < 3; c++) {
      // Remove the background colour from soft edges.
      const v = a > 0.01 ? (data[i + c] - (1 - a) * bg[c]) / a : 0;
      out.data[i + c] = Math.max(0, Math.min(255, Math.round(v)));
    }
    out.data[i + 3] = Math.round(a * 255);
  }
  return { opaque: true, cut: out };
}

// Time of the loudest moment (50 ms windows), used to line up whooshes and hits.
function peakTime(st) {
  const win = Math.round(0.05 * SR);
  let best = -1;
  let bestAt = 0;
  for (let s = 0; s + win <= st[0].length; s += Math.round(win / 2)) {
    let e = 0;
    for (let i = s; i < s + win; i++) e += st[0][i] * st[0][i] + st[1][i] * st[1][i];
    if (e > best) {
      best = e;
      bestAt = s + win / 2;
    }
  }
  return bestAt / SR;
}

// ---------- logos ----------
resetDir(path.join(PUBLIC, 'logos'));
const logos = {};
for (const name of LOGOS) {
  const src = find('logos', name, LOGO_EXT);
  if (!src) {
    logos[name] = null;
    continue;
  }
  const ext = path.extname(src).toLowerCase();
  const file = `logos/${name}${ext}`;
  fs.copyFileSync(src, path.join(PUBLIC, file));
  const entry = { file, cutout: null, opaque: false, width: 0, height: 0 };
  if (ext === '.png') {
    const png = PNG.sync.read(fs.readFileSync(src));
    entry.width = png.width;
    entry.height = png.height;
    const { opaque, cut } = cutout(png);
    entry.opaque = opaque;
    if (cut) {
      entry.cutout = `logos/${name}-cutout.png`;
      fs.writeFileSync(path.join(PUBLIC, entry.cutout), PNG.sync.write(cut));
    } else {
      entry.cutout = file;
    }
  }
  logos[name] = entry;
}

// ---------- sound effects ----------
resetDir(path.join(PUBLIC, 'sfx'));
const sfx = {};
for (const [name, recipe] of Object.entries(RECIPES)) {
  const user = find('sfx', name, SFX_EXT);
  const st = user ? decodeAudio(remotionBin(ROOT), user, SR).map((ch) => Float32Array.from(ch)) : recipe.make();
  level(st, TARGETS[recipe.cat], recipe.peak ?? PEAKS[recipe.cat]);
  const file = `sfx/${name}.wav`;
  fs.writeFileSync(path.join(PUBLIC, file), wav16(st));
  sfx[name] = {
    file,
    source: user ? path.relative(ROOT, user) : 'synthesised',
    duration: +(st[0].length / SR).toFixed(4),
    // Where the beat is: whooshes and hits land on their loudest moment.
    offset: recipe.align === 'peak' ? +peakTime(st).toFixed(4) : 0,
  };
}

fs.mkdirSync(path.join(ROOT, 'src', 'generated'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'src', 'generated', 'assets.json'), JSON.stringify({ logos, sfx }, null, 2) + '\n');

const provided = Object.entries(sfx).filter(([, v]) => v.source !== 'synthesised').map(([k]) => k);
console.log(`logos: ${LOGOS.map((l) => `${l}${logos[l] ? '' : ' (text)'}`).join(', ')}`);
console.log(`sound effects: ${Object.keys(sfx).length} (${provided.length ? 'yours: ' + provided.join(', ') : 'all synthesised'})`);
