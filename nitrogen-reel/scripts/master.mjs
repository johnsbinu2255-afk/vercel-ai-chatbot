// Final sound master in plain Node: exact BS.1770 loudness, a look-ahead peak limiter
// (so nothing clips or distorts), and a smooth fade to silence at the very end.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { decodeAudio } from './wav.mjs';

const SR = 48000;

function run(bin, args, input) {
  const r = spawnSync(bin, args, { input, maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`${args[0]} failed:\n${r.stderr}`);
  return r;
}

// ITU-R BS.1770-4 integrated loudness (48 kHz K-weighting, 400 ms blocks, gated).
export function integratedLoudness([L, R]) {
  const kw = (x) => {
    const y = new Float64Array(x.length);
    let [a1, a2, b0, b1, b2] = [-1.69065929318241, 0.73248077421585, 1.53512485958697, -2.69169618940638, 1.19839281085285];
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = x[i];
      y2 = y1;
      y1 = v;
      y[i] = v;
    }
    [a1, a2, b0, b1, b2] = [-1.99004745483398, 0.99007225036621, 1, -2, 1];
    x1 = x2 = y1 = y2 = 0;
    for (let i = 0; i < y.length; i++) {
      const v = b0 * y[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = y[i];
      y2 = y1;
      y1 = v;
      y[i] = v;
    }
    return y;
  };
  const kl = kw(L);
  const kr = kw(R);
  const block = Math.round(0.4 * SR);
  const hop = Math.round(0.1 * SR);
  const powers = [];
  for (let s = 0; s + block <= kl.length; s += hop) {
    let e = 0;
    for (let i = s; i < s + block; i++) e += kl[i] * kl[i] + kr[i] * kr[i];
    powers.push(e / block);
  }
  const lufs = (p) => -0.691 + 10 * Math.log10(p);
  const abs = powers.filter((p) => lufs(p) > -70);
  const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const rel = lufs(mean(abs)) - 10;
  return lufs(mean(abs.filter((p) => lufs(p) > rel)));
}

// Look-ahead limiter: gain never lets a sample pass the ceiling; smooth attack and release.
function limit([L, R], ceilingDb, lookMs = 4, releaseMs = 150) {
  const n = L.length;
  const ceil = Math.pow(10, ceilingDb / 20);
  const look = Math.round((lookMs / 1000) * SR);
  // Peak including the waveform between samples (4x cubic interpolation), so the
  // limiter also catches inter-sample peaks that would come back after AAC encoding.
  const tp = (x, i) => {
    let p = Math.abs(x[i]);
    if (i < 1 || i + 2 >= n) return p;
    const [a, b, c, d] = [x[i - 1], x[i], x[i + 1], x[i + 2]];
    for (const u of [0.25, 0.5, 0.75]) {
      const v = b + 0.5 * u * (c - a + u * (2 * a - 5 * b + 4 * c - d + u * (3 * (b - c) + d - a)));
      p = Math.max(p, Math.abs(v));
    }
    return p;
  };
  const want = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const p = Math.max(tp(L, i), tp(R, i));
    want[i] = p > ceil ? ceil / p : 1;
  }
  // Minimum over the next `look` samples (monotonic deque).
  const minAhead = new Float64Array(n);
  const dq = [];
  let head = 0;
  for (let i = n - 1; i >= 0; i--) {
    while (dq.length > head && want[dq[dq.length - 1]] >= want[i]) dq.pop();
    dq.push(i);
    while (dq[head] > i + look) head++;
    minAhead[i] = want[dq[head]];
  }
  // Moving average over the window turns the steps into ramps that still reach the minimum in time.
  const smooth = new Float64Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += minAhead[i];
    if (i > look) acc -= minAhead[i - look - 1];
    smooth[i] = acc / Math.min(i + 1, look + 1);
  }
  const rel = Math.exp(-1 / ((releaseMs / 1000) * SR));
  let g = 1;
  let maxGr = 0;
  for (let i = 0; i < n; i++) {
    const back = g * rel + (1 - rel);
    g = Math.min(smooth[i], minAhead[i], back);
    L[i] *= g;
    R[i] *= g;
    maxGr = Math.max(maxGr, -20 * Math.log10(g));
  }
  return maxGr;
}

function wavFloat([L, R]) {
  const n = L.length;
  const buf = Buffer.alloc(44 + n * 8);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 8, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(3, 20); // IEEE float
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 8, 28);
  buf.writeUInt16LE(8, 32);
  buf.writeUInt16LE(32, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 8, 40);
  for (let i = 0; i < n; i++) {
    buf.writeFloatLE(L[i], 44 + i * 8);
    buf.writeFloatLE(R[i], 48 + i * 8);
  }
  return buf;
}

// raw: render with video + PCM audio. out: final MP4.
export function master({ bin, raw, audio = raw, wav, out, targetLufs = -14.5, ceilingDb = -3, fadeSec = 0.35 }) {
  const src = decodeAudio(bin, audio, SR);
  const before = integratedLoudness(src);
  let gainDb = targetLufs - before;
  let result;
  let gr = 0;
  for (let pass = 0; pass < 3; pass++) {
    const g = Math.pow(10, gainDb / 20);
    result = src.map((ch) => ch.map((v) => v * g));
    gr = limit(result, ceilingDb);
    const got = integratedLoudness(result);
    if (Math.abs(got - targetLufs) < 0.1) break;
    gainDb += targetLufs - got;
  }
  const n = result[0].length;
  const f = Math.round(fadeSec * SR);
  for (let i = 0; i < f; i++) {
    const k = Math.sin(((i / f) * Math.PI) / 2);
    result[0][n - 1 - i] *= k;
    result[1][n - 1 - i] *= k;
  }
  fs.writeFileSync(wav, wavFloat(result));
  const duration = (n / SR).toFixed(3);
  run(bin, ['ffmpeg', '-v', 'error', '-y', '-i', raw, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', String(SR), '-movflags', '+faststart', '-t', duration, out]);
  return { before, after: integratedLoudness(result), gainDb, limiterDb: gr };
}
