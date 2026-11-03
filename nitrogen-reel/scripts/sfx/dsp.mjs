// Small, dependency-free DSP toolkit for synthesising sound effects.
// Buffers are Float32Array (mono) or [left, right] pairs at 48 kHz.
export const SR = 48000;
const TAU = Math.PI * 2;

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const n = (sec) => Math.max(1, Math.round(sec * SR));
const val = (p, t) => (typeof p === 'function' ? p(t) : p);

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- parameter curves (functions of time in seconds) ----------
export const exp = (a, b, dur, t0 = 0) => (t) => a * Math.pow(b / a, clamp((t - t0) / dur, 0, 1));
export const lin = (a, b, dur, t0 = 0) => (t) => a + (b - a) * clamp((t - t0) / dur, 0, 1);
// Piecewise exponential curve through [time, value] points.
export const curve = (pts) => (t) => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [t1, v1] = pts[i];
    const [t0, v0] = pts[i - 1];
    if (t <= t1) return v0 * Math.pow(v1 / v0, (t - t0) / (t1 - t0));
  }
  return pts[pts.length - 1][1];
};

// ---------- envelopes (gain as a function of time) ----------
// Percussive: linear attack, exponential decay reaching -60 dB at `decay`.
export const perc = (attack, decay) => (t) => (t < 0 ? 0 : t < attack ? t / attack : Math.exp((-6.9 * (t - attack)) / decay));
// Swell: rises to 1 at `peak`, falls to 0 at `end`.
export const swell = (peak, end, rise = 2, fall = 1.6) => (t) => {
  if (t <= 0 || t >= end) return 0;
  if (t < peak) return Math.pow(t / peak, rise);
  return Math.pow(1 - (t - peak) / (end - peak), fall);
};
// Attack / sustain / release.
export const asr = (attack, releaseStart, end) => (t) => {
  if (t <= 0 || t >= end) return 0;
  if (t < attack) return Math.sin(((t / attack) * Math.PI) / 2);
  if (t < releaseStart) return 1;
  return Math.cos((((t - releaseStart) / (end - releaseStart)) * Math.PI) / 2);
};

// ---------- sources ----------
function polyblep(t, dt) {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}

// Band-limited oscillator. type: sine | saw | square | tri
export function osc(type, freq, sec, phase = 0) {
  const len = n(sec);
  const out = new Float32Array(len);
  let ph = phase;
  for (let i = 0; i < len; i++) {
    const f = val(freq, i / SR);
    const dt = Math.min(0.49, f / SR);
    let v;
    if (type === 'sine') v = Math.sin(TAU * ph);
    else if (type === 'saw') v = 2 * ph - 1 - polyblep(ph, dt);
    else if (type === 'tri') v = 4 * Math.abs(ph - 0.5) - 1;
    else v = (ph < 0.5 ? 1 : -1) + polyblep(ph, dt) - polyblep((ph + 0.5) % 1, dt);
    out[i] = v;
    ph += f / SR;
    ph -= Math.floor(ph);
  }
  return out;
}

export function noise(sec, seed = 1) {
  const rnd = mulberry32(seed);
  const out = new Float32Array(n(sec));
  for (let i = 0; i < out.length; i++) out[i] = rnd() * 2 - 1;
  return out;
}

// Sparse random clicks (crackle). density = clicks per second.
export function crackle(sec, density, seed = 1) {
  const rnd = mulberry32(seed);
  const out = new Float32Array(n(sec));
  for (let i = 0; i < out.length; i++) {
    if (rnd() < density / SR) {
      const amp = 0.3 + rnd() * 0.7;
      const sign = rnd() < 0.5 ? -1 : 1;
      const l = 40 + Math.floor(rnd() * 160);
      for (let k = 0; k < l && i + k < out.length; k++) out[i + k] += sign * amp * Math.exp(-k / (l * 0.25)) * (rnd() * 2 - 1);
    }
  }
  return out;
}

// ---------- processing ----------
// RBJ biquad with time-varying cutoff. type: lowpass | highpass | bandpass | peak
export function biquad(input, type, freq, q = 0.707, gainDb = 0) {
  const out = new Float32Array(input.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let a1 = 0;
  let a2 = 0;
  const set = (f) => {
    const w = (TAU * clamp(f, 10, SR * 0.45)) / SR;
    const c = Math.cos(w);
    const s = Math.sin(w);
    const al = s / (2 * q);
    let a0;
    if (type === 'lowpass') {
      b0 = (1 - c) / 2;
      b1 = 1 - c;
      b2 = (1 - c) / 2;
      a0 = 1 + al;
      a1 = -2 * c;
      a2 = 1 - al;
    } else if (type === 'highpass') {
      b0 = (1 + c) / 2;
      b1 = -(1 + c);
      b2 = (1 + c) / 2;
      a0 = 1 + al;
      a1 = -2 * c;
      a2 = 1 - al;
    } else if (type === 'bandpass') {
      b0 = al;
      b1 = 0;
      b2 = -al;
      a0 = 1 + al;
      a1 = -2 * c;
      a2 = 1 - al;
    } else {
      const A = Math.pow(10, gainDb / 40);
      b0 = 1 + al * A;
      b1 = -2 * c;
      b2 = 1 - al * A;
      a0 = 1 + al / A;
      a1 = -2 * c;
      a2 = 1 - al / A;
    }
    b0 /= a0;
    b1 /= a0;
    b2 /= a0;
    a1 /= a0;
    a2 /= a0;
  };
  const dynamic = typeof freq === 'function';
  if (!dynamic) set(freq);
  for (let i = 0; i < input.length; i++) {
    if (dynamic && i % 16 === 0) set(freq(i / SR));
    const x = input[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    out[i] = y;
  }
  return out;
}

// Multiply by a gain curve (function of time or number). Returns the same array.
export function gain(arr, g) {
  for (let i = 0; i < arr.length; i++) arr[i] *= val(g, i / SR);
  return arr;
}

export function drive(arr, k) {
  const norm = Math.tanh(k);
  for (let i = 0; i < arr.length; i++) arr[i] = Math.tanh(k * arr[i]) / norm;
  return arr;
}

// Sum mono arrays (each optionally with a gain) into a new mono array.
export function sum(len, ...parts) {
  const out = new Float32Array(len);
  for (const p of parts) {
    const [arr, g = 1, offset = 0] = Array.isArray(p) ? p : [p];
    const o = Math.round(offset * SR);
    for (let i = 0; i < arr.length && i + o < len; i++) if (i + o >= 0) out[i + o] += arr[i] * g;
  }
  return out;
}

// Equal-power pan of a mono array. p: -1 (left) .. 1 (right), number or curve.
export function pan(mono, p = 0) {
  const L = new Float32Array(mono.length);
  const R = new Float32Array(mono.length);
  for (let i = 0; i < mono.length; i++) {
    const a = ((clamp(val(p, i / SR), -1, 1) + 1) * Math.PI) / 4;
    L[i] = mono[i] * Math.cos(a) * Math.SQRT2;
    R[i] = mono[i] * Math.sin(a) * Math.SQRT2;
  }
  return [L, R];
}

export function stereo(sec) {
  return [new Float32Array(n(sec)), new Float32Array(n(sec))];
}

// Mix a stereo (or mono, panned centre) buffer into dest at offset seconds.
export function mixInto(dest, src, offset = 0, g = 1) {
  const [sl, sr] = Array.isArray(src) ? src : [src, src];
  const o = Math.round(offset * SR);
  for (let i = 0; i < sl.length; i++) {
    const j = i + o;
    if (j < 0 || j >= dest[0].length) continue;
    dest[0][j] += sl[i] * g;
    dest[1][j] += sr[i] * g;
  }
  return dest;
}

export function reverse(st) {
  return st.map((ch) => Float32Array.from(ch).reverse());
}

// Freeverb-style stereo reverb; returns a new buffer that includes the tail.
export function reverb(st, { room = 0.72, damp = 0.35, wet = 0.25, tail = 1.0 } = {}) {
  const len = st[0].length + n(tail);
  const scale = SR / 44100;
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const apT = [556, 441, 341, 225];
  const out = [new Float32Array(len), new Float32Array(len)];
  for (let ch = 0; ch < 2; ch++) {
    const spread = ch ? 23 : 0;
    const combs = combT.map((d) => ({ buf: new Float32Array(Math.round((d + spread) * scale)), i: 0, store: 0 }));
    const aps = apT.map((d) => ({ buf: new Float32Array(Math.round((d + spread) * scale)), i: 0 }));
    const src = st[ch];
    for (let k = 0; k < len; k++) {
      const x = (k < src.length ? src[k] : 0) * 0.015;
      let y = 0;
      for (const c of combs) {
        const o = c.buf[c.i];
        c.store = o * (1 - damp) + c.store * damp;
        c.buf[c.i] = x + c.store * room;
        c.i = (c.i + 1) % c.buf.length;
        y += o;
      }
      for (const a of aps) {
        const b = a.buf[a.i];
        a.buf[a.i] = y + b * 0.5;
        a.i = (a.i + 1) % a.buf.length;
        y = b - y;
      }
      out[ch][k] = (k < src.length ? src[k] : 0) + y * wet * 3;
    }
  }
  return out;
}

export function fadeOut(st, sec) {
  const f = n(sec);
  for (const ch of st) {
    const L = ch.length;
    for (let i = 0; i < f && i < L; i++) ch[L - 1 - i] *= Math.sin(((i / f) * Math.PI) / 2);
  }
  return st;
}

export function trim(st, sec) {
  const L = Math.min(st[0].length, n(sec));
  return st.map((ch) => ch.slice(0, L));
}

export function peak(st) {
  let p = 0;
  for (const ch of st) for (let i = 0; i < ch.length; i++) p = Math.max(p, Math.abs(ch[i]));
  return p;
}

// ---------- loudness ----------
// BS.1770 K-weighting, then the loudest 400 ms window (momentary max, LUFS).
export function momentaryMax(st) {
  const kw = (ch) => {
    // High shelf +4 dB around 1.7 kHz, then a 38 Hz high-pass (the BS.1770 pre-filter).
    const shelf = biquad(ch, 'peak', 3000, 0.4, 4);
    return biquad(shelf, 'highpass', 38, 0.5);
  };
  const L = kw(st[0]);
  const R = kw(st[1]);
  const win = n(0.4);
  const hop = n(0.05);
  let best = 1e-12;
  if (L.length <= win) {
    let s = 0;
    for (let i = 0; i < L.length; i++) s += L[i] * L[i] + R[i] * R[i];
    best = s / win;
  } else {
    let s = 0;
    for (let i = 0; i < win; i++) s += L[i] * L[i] + R[i] * R[i];
    best = s / win;
    for (let start = hop; start + win <= L.length; start += hop) {
      for (let i = start - hop; i < start; i++) s -= L[i] * L[i] + R[i] * R[i];
      for (let i = start + win - hop; i < start + win; i++) s += L[i] * L[i] + R[i] * R[i];
      best = Math.max(best, s / win);
    }
  }
  return -0.691 + 10 * Math.log10(Math.max(best, 1e-12));
}

// Scale to a loudness target without letting the peak go above maxPeakDb.
export function level(st, targetLufs, maxPeakDb = -1) {
  const lufs = momentaryMax(st);
  let g = Math.pow(10, (targetLufs - lufs) / 20);
  const pk = peak(st) * g;
  const maxPk = Math.pow(10, maxPeakDb / 20);
  if (pk > maxPk) g *= maxPk / pk;
  for (const ch of st) for (let i = 0; i < ch.length; i++) ch[i] *= g;
  return st;
}

// ---------- output ----------
export function wav16(st) {
  const len = st[0].length;
  const buf = Buffer.alloc(44 + len * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + len * 4, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(len * 4, 40);
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < 2; c++) {
      const s = clamp(st[c][i], -1, 1);
      buf.writeInt16LE(Math.round(s < 0 ? s * 32768 : s * 32767), o);
      o += 2;
    }
  }
  return buf;
}
