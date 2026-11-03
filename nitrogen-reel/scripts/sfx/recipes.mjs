// One recipe per sound effect in the script. Each returns a stereo buffer.
// `cat` sets the loudness group used by the mix (see TARGETS).
import {
  SR,
  n as len,
  exp,
  lin,
  curve,
  perc,
  swell,
  asr,
  osc,
  noise,
  crackle,
  biquad,
  gain,
  drive,
  sum,
  pan,
  mixInto,
  reverse,
  reverb,
  fadeOut,
  mulberry32,
} from './dsp.mjs';

const TAU = Math.PI * 2;

// Loudest 400 ms of each group, in LUFS, before the final master.
// Bass impacts loudest, whooshes medium, pops and dings a little lower.
export const TARGETS = {
  impact: -17,
  hit: -19.5,
  whoosh: -20.5,
  screech: -21,
  texture: -22.5,
  ui: -22,
  bell: -23,
  tiny: -27,
  tail: -19,
};

// Highest sample peak per group (dBFS) so spiky sounds can't poke out of the mix.
export const PEAKS = { impact: -2, hit: -3, whoosh: -4, screech: -5, texture: -6, ui: -6, bell: -5, tiny: -8, tail: -3 };

function whooshCore({ dur, peakAt, f0, f1, f2, q = 0.9, p0 = 0, p1 = 0, body = 0.9, seed = 1, rise = 2, fall = 1.6 }) {
  const env = swell(peakAt, dur, rise, fall);
  const band = (t) => (t < peakAt ? f0 * Math.pow(f1 / f0, t / peakAt) : f1 * Math.pow(f2 / f1, (t - peakAt) / (dur - peakAt)));
  const air = gain(biquad(noise(dur, seed), 'bandpass', band, q), env);
  const bodyF = (t) => (t < peakAt ? 220 * Math.pow(5, t / peakAt) : 1100 * Math.pow(160 / 1100, (t - peakAt) / (dur - peakAt)));
  const low = gain(biquad(noise(dur, seed + 7), 'lowpass', bodyF, 0.8), env);
  return pan(sum(len(dur), [air, 1], [low, body]), lin(p0, p1, dur));
}

const BELL = [
  [1, 1, 1.2],
  [2.01, 0.38, 0.8],
  [2.76, 0.26, 0.55],
  [5.4, 0.09, 0.25],
  [0.5, 0.14, 0.8],
];
function bell(f, dur, partials = BELL) {
  return sum(len(dur), ...partials.map(([r, a, d]) => [gain(osc('sine', f * r, dur), perc(0.002, d)), a]));
}

function click(dur, f, q, decay, seed) {
  return gain(biquad(noise(dur, seed), 'bandpass', f, q), perc(0.0005, decay));
}

// align: where the sound's beat is. 'start' = first sample, 'peak' = loudest moment.
export const RECIPES = {
  rumble: {
    cat: 'texture',
    align: 'start',
    make() {
      const d = 1.3;
      const base = biquad(noise(d, 11), 'lowpass', 240, 0.9);
      const hum = biquad(osc('saw', exp(92, 52, 1.2), d), 'lowpass', 380, 0.8);
      const mono = gain(sum(len(d), [base, 1], [hum, 0.35]), (t) => (1 - 0.3 * (0.5 + 0.5 * Math.sin(TAU * 22 * t))) * asr(0.08, 0.85, d)(t));
      return pan(mono, lin(0.7, 0, 1.0));
    },
  },
  screech: {
    cat: 'screech',
    align: 'start',
    make() {
      const d = 0.85;
      const parts = [
        [1240, 'saw', 0.45],
        [1870, 'square', 0.18],
        [2590, 'saw', 0.16],
      ].map(([f, type, a], k) => {
        const fr = (t) => f * (1.05 - 0.15 * (t / d)) * (1 + 0.03 * Math.sin(TAU * (12 + k) * t) + 0.012 * Math.sin(TAU * (34 + 3 * k) * t));
        return [osc(type, fr, d), a];
      });
      const tone = biquad(drive(sum(len(d), ...parts), 2.2), 'bandpass', 2300, 2.2);
      gain(tone, (t) => 0.65 + 0.35 * Math.sin(TAU * 29 * t));
      const hiss = biquad(noise(d, 5), 'bandpass', 4200, 1.1);
      return pan(gain(sum(len(d), [tone, 1], [hiss, 0.5]), asr(0.04, d - 0.14, d)), lin(0.2, 0, d));
    },
  },
  swirl: {
    cat: 'whoosh',
    align: 'start',
    make() {
      const d = 1.4;
      const fc = (t) => 1300 * Math.pow(2, 1.1 * Math.sin(TAU * (1.8 * t + 0.6 * t * t)));
      const a = biquad(noise(d, 21), 'bandpass', fc, 1.6);
      const b = biquad(noise(d, 22), 'bandpass', (t) => fc(t) * 1.7, 2.0);
      const whistle = osc('sine', (t) => 1800 + 700 * Math.sin(TAU * 1.8 * t), d);
      const mono = gain(sum(len(d), [a, 1], [b, 0.6], [whistle, 0.04]), swell(0.45, d, 1.6, 1.4));
      return pan(mono, (t) => 0.8 * Math.sin(TAU * 1.6 * t));
    },
  },
  'bass-impact': {
    cat: 'impact',
    align: 'peak',
    make() {
      const d = 1.8;
      const sub = gain(drive(osc('sine', exp(150, 38, 0.35), d), 3), perc(0.005, 1.5));
      const harm = gain(osc('tri', exp(300, 84, 0.3), d), perc(0.004, 0.45));
      const clk = gain(biquad(noise(0.06, 31), 'highpass', 2500), perc(0.001, 0.03));
      const crack = gain(biquad(noise(0.3, 32), 'bandpass', 900, 0.8), perc(0.002, 0.12));
      return reverb(pan(sum(len(d), [sub, 1], [harm, 0.3], [clk, 0.45], [crack, 0.4]), 0), { wet: 0.12, room: 0.6, tail: 0.4 });
    },
  },
  pop: {
    cat: 'ui',
    align: 'peak',
    make() {
      const d = 0.25;
      const body = gain(osc('sine', exp(1300, 420, 0.06), d), perc(0.003, 0.13));
      const clk = gain(biquad(noise(0.03, 41), 'highpass', 3000), perc(0.001, 0.012));
      const thump = gain(osc('sine', exp(190, 90, 0.08), d), perc(0.003, 0.09));
      return reverb(pan(sum(len(d), [body, 1], [clk, 0.3], [thump, 0.45]), 0), { wet: 0.1, tail: 0.3 });
    },
  },
  slice: {
    cat: 'whoosh',
    align: 'peak',
    make() {
      const d = 0.5;
      const air = gain(biquad(noise(d, 51), 'bandpass', curve([[0, 2000], [0.16, 9000], [0.5, 4000]]), 1.2), swell(0.16, d, 1.2, 2));
      const shing = sum(len(d), ...[3100, 4700, 6800].map((f, k) => [gain(osc('sine', f, d), perc(0.002, 0.25 - k * 0.05)), 0.12]));
      const sw = gain(biquad(noise(d, 52), 'highpass', 6000), swell(0.12, 0.3, 1, 2));
      return pan(sum(len(d), [air, 1], [shing, 1, 0.12], [sw, 0.4]), lin(-0.3, 0.3, d));
    },
  },
  whoosh: {
    cat: 'whoosh',
    align: 'peak',
    make() {
      return whooshCore({ dur: 0.6, peakAt: 0.36, f0: 300, f1: 3000, f2: 280, p0: -0.4, p1: 0.4, seed: 61 });
    },
  },
  thud: {
    cat: 'ui',
    align: 'peak',
    make() {
      const d = 0.45;
      const sub = gain(drive(osc('sine', exp(110, 45, 0.2), d), 2), perc(0.004, 0.38));
      const nz = gain(biquad(noise(0.15, 71), 'lowpass', 600), perc(0.002, 0.09));
      const knock = gain(biquad(noise(0.1, 72), 'bandpass', 350, 2), perc(0.001, 0.05));
      return pan(sum(len(d), [sub, 1], [nz, 0.5], [knock, 0.35]), 0);
    },
  },
  'flip-click': {
    cat: 'ui',
    align: 'start',
    peak: -3,
    make() {
      const d = 0.3;
      const flaps = [
        [0, 0.5],
        [0.035, 0.6],
        [0.07, 0.75],
        [0.1, 1],
      ].map(([o, a], k) => [click(0.07, 3000 - k * 300, 1.2, 0.025, 80 + k), a, o]);
      const clack = gain(biquad(noise(0.1, 85), 'bandpass', 900, 1.5), perc(0.001, 0.045));
      const tick = gain(osc('sine', 900, 0.06), perc(0.001, 0.03));
      return pan(sum(len(d), ...flaps, [clack, 0.9, 0.1], [tick, 0.3, 0.1]), 0);
    },
  },
  'ding-ding': {
    cat: 'bell',
    align: 'start',
    make() {
      const d = 1.5;
      return reverb(pan(sum(len(d), [bell(1568, 1.2), 0.5, 0], [bell(1568, 1.2), 0.5, 0.2]), 0), { wet: 0.25, tail: 0.6 });
    },
  },
  'deep-whoosh': {
    cat: 'whoosh',
    align: 'peak',
    make() {
      const d = 0.9;
      const w = whooshCore({ dur: d, peakAt: 0.55, f0: 90, f1: 700, f2: 70, q: 0.8, body: 1.4, seed: 91 });
      const sub = gain(osc('sine', curve([[0, 45], [0.55, 70], [0.9, 35]]), d), swell(0.55, d, 2, 1.5));
      return mixInto(w, pan(sub, 0), 0, 0.5);
    },
  },
  'bass-hit': {
    cat: 'impact',
    align: 'peak',
    make() {
      const d = 1.1;
      const sub = gain(drive(osc('sine', exp(130, 45, 0.18), d), 2.5), perc(0.003, 0.9));
      const crack = gain(biquad(noise(0.25, 101), 'bandpass', 1300, 0.8), perc(0.001, 0.1));
      const clk = gain(biquad(noise(0.05, 102), 'highpass', 3000), perc(0.001, 0.02));
      return reverb(pan(sum(len(d), [sub, 1], [crack, 0.55], [clk, 0.35]), 0), { wet: 0.1, tail: 0.3 });
    },
  },
  hiss: {
    cat: 'texture',
    align: 'start',
    make() {
      const d = 1.7;
      const h = biquad(biquad(noise(d, 111), 'highpass', 3500), 'peak', 6500, 1, 6);
      const whistle = osc('sine', (t) => 5200 * (1 + 0.01 * Math.sin(TAU * 5 * t)), d);
      const mono = gain(sum(len(d), [h, 1], [whistle, 0.03]), (t) => asr(0.06, d - 0.45, d)(t) * (0.85 + 0.15 * Math.sin(TAU * 7 * t)));
      return pan(mono, -0.6);
    },
  },
  whirr: {
    cat: 'texture',
    align: 'start',
    make() {
      const d = 0.7;
      const m = gain(biquad(osc('saw', exp(420, 180, 0.6), d), 'bandpass', 900, 1.5), (t) => 0.5 + 0.5 * Math.sin(TAU * 55 * t));
      const nz = biquad(noise(d, 121), 'bandpass', 2000, 1.2);
      return pan(gain(sum(len(d), [m, 1], [nz, 0.2]), perc(0.02, 0.62)), -0.6);
    },
  },
  beep: {
    cat: 'ui',
    align: 'start',
    make() {
      const one = (o) => [gain(biquad(osc('square', 1050, 0.12), 'lowpass', 4000), asr(0.005, 0.105, 0.12)), 1, o];
      return pan(sum(len(0.4), one(0), one(0.16)), 0);
    },
  },
  pump: {
    cat: 'ui',
    align: 'start',
    make() {
      const d = 0.32;
      const air = gain(biquad(noise(d, 131), 'bandpass', exp(1800, 700, 0.15), 1), perc(0.015, 0.2));
      const thump = gain(osc('sine', exp(120, 70, 0.08), d), perc(0.003, 0.08));
      const tail = gain(biquad(noise(d, 132), 'highpass', 4000), perc(0.008, 0.2));
      return pan(drive(sum(len(d), [air, 1], [thump, 0.4], [tail, 0.2]), 1.6), -0.5);
    },
  },
  hum: {
    cat: 'texture',
    align: 'start',
    make() {
      const d = 1.8;
      const tone = sum(
        len(d),
        ...[
          [220, 1],
          [330.5, 0.6],
          [440.8, 0.4],
          [110, 0.5],
        ].map(([f, a]) => [osc('sine', f, d), a]),
      );
      const out = gain(biquad(tone, 'lowpass', 1200), (t) => asr(0.3, d - 0.5, d)(t) * (0.9 + 0.1 * Math.sin(TAU * 3 * t)));
      return pan(out, 0.5);
    },
  },
  'page-flip': {
    cat: 'ui',
    align: 'start',
    make() {
      const flip = (o, s) => [gain(biquad(noise(0.12, s), 'bandpass', exp(2500, 5500, 0.08), 0.8), perc(0.01, 0.08)), 1, o];
      const flap = (o, s) => [gain(biquad(noise(0.06, s), 'lowpass', 800), perc(0.002, 0.04)), 0.3, o + 0.06];
      return pan(sum(len(0.6), flip(0, 141), flap(0, 142), flip(0.15, 143), flap(0.15, 144), flip(0.3, 145), flap(0.3, 146)), 0.5);
    },
  },
  chime: {
    cat: 'bell',
    align: 'start',
    make() {
      const notes = [
        [1046.5, 0],
        [1318.5, 0.08],
        [1568, 0.16],
      ];
      const parts = notes.map(([f, o]) => [bell(f, 1.3, [[1, 1, 1.1], [2, 0.3, 0.6], [3, 0.12, 0.3]]), 0.45, o]);
      return reverb(pan(sum(len(1.6), ...parts), 0.3), { wet: 0.3, tail: 0.6 });
    },
  },
  'road-roll': {
    cat: 'texture',
    align: 'start',
    make() {
      const d = 1.8;
      const ch = (s) => {
        const base = gain(biquad(noise(d, s), 'lowpass', 420, 0.8), (t) => 0.75 + 0.25 * Math.sin(TAU * 30 * t));
        const grit = biquad(drive(crackle(d, 70, s + 1), 2.5), 'bandpass', 1500, 0.9);
        const hum = biquad(osc('saw', 70, d), 'lowpass', 250);
        return gain(sum(len(d), [base, 1], [grit, 0.35], [hum, 0.15]), asr(0.15, d - 0.4, d));
      };
      return [ch(151), ch(161)];
    },
  },
  sizzle: {
    cat: 'texture',
    align: 'start',
    make() {
      const d = 1.5;
      const cr = biquad(drive(crackle(d, 140, 171), 2.5), 'highpass', 2000);
      const hs = gain(biquad(noise(d, 172), 'highpass', 6000), (t) => 0.2 * (0.8 + 0.2 * Math.sin(TAU * 11 * t)));
      return pan(gain(sum(len(d), [cr, 1], [hs, 1]), asr(0.1, d - 0.4, d)), -0.5);
    },
  },
  'rise-whine': {
    cat: 'texture',
    align: 'start',
    make() {
      const d = 1.3;
      const f = (t) => exp(380, 1500, 1.1)(t) * (1 + 0.01 * Math.sin(TAU * 6 * t));
      const w = sum(len(d), [osc('sine', f, d), 1], [osc('sine', (t) => 2 * f(t), d), 0.2]);
      return pan(gain(w, asr(0.1, d - 0.2, d)), -0.5);
    },
  },
  'cool-whoosh': {
    cat: 'whoosh',
    align: 'peak',
    make() {
      const d = 0.9;
      const air = gain(
        biquad(biquad(noise(d, 181), 'highpass', 1500), 'bandpass', curve([[0, 2500], [0.4, 7000], [0.9, 3000]]), 0.7),
        swell(0.4, d, 1.6, 1.4),
      );
      const ice = sum(
        len(d),
        ...[3520, 4186, 5274].map((f, k) => [gain(osc('sine', (t) => f * (1 + 0.004 * Math.sin(TAU * (5 + k) * t)), d), swell(0.45, d, 2, 1.2)), 0.05]),
      );
      return pan(sum(len(d), [air, 1], [ice, 1]), lin(0.6, 0.3, d));
    },
  },
  'rising-whoosh': {
    cat: 'whoosh',
    align: 'peak',
    make() {
      const d = 0.9;
      const env = (t) => (t < 0.85 ? Math.pow(t / 0.85, 2) : Math.max(0, 1 - (t - 0.85) / 0.05));
      const air = gain(biquad(noise(d, 191), 'bandpass', exp(300, 6000, 0.85), 1.2), env);
      const tone = gain(osc('sine', exp(200, 900, 0.85), d), (t) => 0.08 * env(t));
      return pan(sum(len(d), [air, 1], [tone, 1]), lin(-0.5, 0.5, d));
    },
  },
  ting: {
    cat: 'bell',
    align: 'start',
    make() {
      const rnd = mulberry32(201);
      const b = bell(2637, 0.9, [[1, 1, 0.8], [2, 0.35, 0.4], [3.01, 0.15, 0.2]]);
      const sparks = [0, 1, 2, 3].map(() => [gain(osc('sine', 5000 + rnd() * 3000, 0.15), perc(0.002, 0.08)), 0.15, rnd() * 0.15]);
      return reverb(pan(sum(len(0.9), [b, 0.6], ...sparks), 0.2), { wet: 0.3, tail: 0.5 });
    },
  },
  'camera-flash': {
    cat: 'ui',
    align: 'start',
    make() {
      const d = 0.7;
      const whine = gain(osc('sine', exp(3200, 7800, 0.25), d), perc(0.01, 0.3));
      const burst = gain(biquad(noise(0.2, 213), 'highpass', 5000), perc(0.002, 0.1));
      return pan(sum(len(d), [click(0.03, 3600, 1.4, 0.012, 211), 1], [click(0.04, 2200, 1, 0.016, 212), 1, 0.05], [whine, 0.15, 0.02], [burst, 0.4, 0.02]), 0);
    },
  },
  buzz: {
    cat: 'ui',
    align: 'start',
    make() {
      const d = 0.3;
      const f = exp(150, 130, 0.25);
      const b = sum(len(d), [osc('saw', f, d), 0.6], [osc('square', (t) => f(t) / 2, d), 0.4]);
      return pan(gain(drive(biquad(b, 'lowpass', 2500), 1.5), asr(0.005, 0.22, 0.26)), 0);
    },
  },
  ding: {
    cat: 'bell',
    align: 'start',
    make() {
      const p = [
        [1, 1, 1.0],
        [2.01, 0.38, 0.6],
        [2.76, 0.26, 0.4],
        [5.4, 0.09, 0.15],
        [0.5, 0.14, 0.6],
      ];
      return reverb(pan(gain(bell(1760, 1.2, p), 0.5), 0), { wet: 0.25, tail: 0.5 });
    },
  },
  'reverse-whoosh': {
    cat: 'whoosh',
    align: 'peak',
    make() {
      const d = 0.7;
      const w = reverse(whooshCore({ dur: d, peakAt: 0.08, f0: 4000, f1: 2500, f2: 250, q: 1, seed: 221, rise: 1, fall: 2.2 }));
      const suck = gain(osc('sine', exp(900, 150, 0.6), d), (t) => 0.06 * Math.pow(t / d, 2));
      return fadeOut(mixInto(w, pan(suck, 0), 0, 1), 0.004);
    },
  },
  boom: {
    cat: 'impact',
    align: 'peak',
    make() {
      const d = 2.0;
      const sub = gain(drive(osc('sine', exp(90, 30, 0.9), d), 4), perc(0.004, 1.8));
      const blast = gain(biquad(noise(0.6, 231), 'lowpass', exp(1500, 300, 0.4), 0.7), perc(0.002, 0.35));
      const low = gain(osc('tri', 45, d), perc(0.01, 1.2));
      return reverb(pan(sum(len(d), [sub, 1], [blast, 0.6], [low, 0.3]), 0), { wet: 0.22, room: 0.82, tail: 0.8 });
    },
  },
  'type-click': {
    cat: 'tiny',
    align: 'start',
    make() {
      const d = 0.06;
      const a = click(d, 4000, 1.2, 0.008, 241);
      const b = gain(biquad(noise(d, 242), 'bandpass', 1200, 1.5), perc(0.001, 0.02));
      const c = gain(osc('sine', 2200, d), perc(0.0005, 0.01));
      return pan(sum(len(d), [a, 1], [b, 0.5], [c, 0.2]), 0);
    },
  },
  shimmer: {
    cat: 'bell',
    align: 'start',
    make() {
      const d = 1.0;
      const rnd = mulberry32(252);
      const air = gain(biquad(noise(d, 251), 'bandpass', exp(4500, 10000, 1.0), 3), swell(0.4, d, 1.5, 1.5));
      const sparks = [0, 1, 2, 3, 4, 5].map((k) => [gain(osc('sine', 3000 + rnd() * 4000, 0.2), perc(0.002, 0.12)), 0.4, 0.1 + k * 0.12]);
      return reverb(pan(sum(len(d), [air, 1], ...sparks), lin(-0.6, 0.6, d)), { wet: 0.35, tail: 0.6 });
    },
  },
  ribbon: {
    cat: 'whoosh',
    align: 'peak',
    make() {
      const d = 0.7;
      const air = biquad(noise(d, 261), 'bandpass', exp(1200, 3200, 0.6), 0.9);
      let ph = 0;
      for (let i = 0; i < air.length; i++) {
        ph += (18 - (12 * i) / air.length) / SR;
        air[i] *= 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(TAU * ph));
      }
      return pan(gain(air, swell(0.25, d, 1.5, 1.5)), lin(-0.7, 0.7, d));
    },
  },
  hit: {
    cat: 'hit',
    align: 'peak',
    make() {
      const d = 0.5;
      const sub = gain(drive(osc('sine', exp(125, 48, 0.14), d), 2.5), perc(0.003, 0.42));
      const crack = gain(biquad(noise(0.2, 271), 'bandpass', 1400, 0.8), perc(0.001, 0.13));
      const metal = sum(
        len(d),
        ...[
          [520, 0.12],
          [1340, 0.08],
          [2210, 0.05],
        ].map(([f, a]) => [gain(osc('sine', f, d), perc(0.002, 0.25)), a]),
      );
      return reverb(pan(sum(len(d), [sub, 1], [crack, 0.75], [metal, 1]), 0), { wet: 0.15, tail: 0.3 });
    },
  },
  stamp: {
    cat: 'impact',
    align: 'peak',
    make() {
      const d = 0.6;
      const sub = gain(drive(osc('sine', exp(85, 40, 0.12), d), 3), perc(0.002, 0.45));
      const slap = gain(biquad(noise(0.12, 281), 'bandpass', 700, 1), perc(0.001, 0.06));
      const knock = gain(biquad(noise(0.2, 282), 'bandpass', 250, 3), perc(0.001, 0.12));
      return reverb(pan(sum(len(d), [sub, 1], [slap, 0.8], [knock, 0.6]), 0), { wet: 0.12, tail: 0.3 });
    },
  },
  'bass-tail': {
    cat: 'tail',
    align: 'start',
    make() {
      const d = 1.0;
      const env = (t) => (t < 0.03 ? t / 0.03 : Math.pow(Math.cos((((t - 0.03) / (d - 0.03)) * Math.PI) / 2), 1.5));
      const sub = gain(drive(osc('sine', exp(52, 38, 1.0), d), 2), env);
      const h2 = gain(osc('sine', exp(104, 76, 1.0), d), (t) => 0.25 * env(t));
      return pan(sum(len(d), [sub, 1], [h2, 1]), 0);
    },
  },
};
