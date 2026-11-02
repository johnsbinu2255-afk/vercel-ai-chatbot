// Sound effects only (no music), synthesised with an OfflineAudioContext so
// every render is identical and lines up with the picture.
(function () {
  const R = window.R;
  const SR = 48000;

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeNoise(ctx, seconds, seed) {
    const len = Math.floor(seconds * ctx.sampleRate);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const rnd = mulberry32(seed * 7919 + ch * 104729);
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = rnd() * 2 - 1;
    }
    return buf;
  }

  function makeImpulse(ctx, seconds, decay) {
    const len = Math.floor(seconds * ctx.sampleRate);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const rnd = mulberry32(17 + ch * 31);
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        lp = lp * 0.6 + (rnd() * 2 - 1) * 0.4;
        d[i] = lp * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  const curves = {};
  function softClip(k) {
    if (curves[k]) return curves[k];
    const n = 2048;
    const c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      c[i] = Math.tanh(k * x) / Math.tanh(k);
    }
    return (curves[k] = c);
  }

  function crushCurve(steps) {
    const n = 2048;
    const c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      c[i] = Math.round(x * steps) / steps;
    }
    return c;
  }

  // Exponential attack/decay envelope on a fresh gain node.
  function envGain(ctx, t0, attack, decay, peak) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    return g;
  }

  function osc(ctx, type, f0, f1, t0, glide, stopAt) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + glide);
    o.start(t0);
    o.stop(stopAt);
    return o;
  }

  function filter(ctx, type, f, q = 0.7) {
    const b = ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    return b;
  }

  async function renderAudio(cues, duration) {
    const ctx = new OfflineAudioContext(2, Math.ceil(SR * duration), SR);
    const rnd = mulberry32(2024);
    const NOISE = makeNoise(ctx, 4, 3);
    const noise = (t0, stopAt) => {
      const s = ctx.createBufferSource();
      s.buffer = NOISE;
      s.start(Math.max(0, t0), rnd() * 2.5);
      s.stop(Math.max(0, stopAt));
      return s;
    };

    // Master: bus -> glue compressor -> limiter.
    const bus = ctx.createGain();
    bus.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 8;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -3;
    lim.knee.value = 0;
    lim.ratio.value = 20;
    lim.attack.value = 0.001;
    lim.release.value = 0.08;
    bus.connect(comp).connect(lim).connect(ctx.destination);

    // Short room reverb for pops, dings and hits.
    const verb = ctx.createConvolver();
    verb.buffer = makeImpulse(ctx, 1.6, 3.2);
    const verbIn = ctx.createGain();
    verbIn.gain.value = 0.22;
    verbIn.connect(verb).connect(bus);
    const send = (node, amt = 1) => {
      if (amt === 1) return node.connect(verbIn);
      const g = ctx.createGain();
      g.gain.value = amt;
      node.connect(g).connect(verbIn);
    };

    const SFX = {
      whoosh(c) {
        const dur = c.dur || 0.5;
        const peak = c.t;
        const start = Math.max(0, peak - dur * 0.62);
        const end = peak + dur * 0.38;
        const G = c.gain || 0.7;
        const [f0, f1] = c.f || [300, 3000];
        const pan = ctx.createStereoPanner();
        const [p0, p1] = c.pan || [0, 0];
        pan.pan.setValueAtTime(p0, start);
        pan.pan.linearRampToValueAtTime(p1, end);
        pan.connect(bus);
        const bp = filter(ctx, 'bandpass', f0, 0.9);
        bp.frequency.setValueAtTime(f0, start);
        bp.frequency.exponentialRampToValueAtTime(f1, peak);
        bp.frequency.exponentialRampToValueAtTime(Math.max(90, Math.min(f0, f1) * 0.9), end);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(G, peak);
        g.gain.exponentialRampToValueAtTime(0.0001, end);
        noise(start, end + 0.05).connect(bp).connect(g).connect(pan);
        const lp = filter(ctx, 'lowpass', 200, 0.8);
        lp.frequency.setValueAtTime(220, start);
        lp.frequency.exponentialRampToValueAtTime(1100, peak);
        lp.frequency.exponentialRampToValueAtTime(160, end);
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.0001, start);
        g2.gain.exponentialRampToValueAtTime(G * 0.9, peak);
        g2.gain.exponentialRampToValueAtTime(0.0001, end);
        noise(start, end + 0.05).connect(lp).connect(g2).connect(pan);
      },

      screech(c) {
        const t0 = c.t;
        const t1 = t0 + c.dur;
        const G = c.gain || 0.42;
        const out = ctx.createGain();
        out.gain.setValueAtTime(0.0001, t0);
        out.gain.exponentialRampToValueAtTime(G, t0 + 0.04);
        out.gain.setValueAtTime(G, Math.max(t0 + 0.05, t1 - 0.1));
        out.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.06);
        out.connect(bus);
        send(out, 0.5);
        const shaper = ctx.createWaveShaper();
        shaper.curve = softClip(2.2);
        // Stick-slip flutter.
        const am = ctx.createGain();
        am.gain.value = 0.65;
        const amL = osc(ctx, 'sine', 29, 29, t0, 0, t1 + 0.1);
        const amD = ctx.createGain();
        amD.gain.value = 0.35;
        amL.connect(amD).connect(am.gain);
        const bp = filter(ctx, 'bandpass', 2300, 2.2);
        shaper.connect(bp).connect(am).connect(out);
        for (const [f, type, amp] of [
          [1240, 'sawtooth', 0.45],
          [1870, 'square', 0.18],
          [2590, 'sawtooth', 0.16],
        ]) {
          const o = osc(ctx, type, f * 1.05, f * 0.9, t0, c.dur, t1 + 0.1);
          const l1 = osc(ctx, 'sine', 11 + rnd() * 4, 0, t0, 0, t1 + 0.1);
          const d1 = ctx.createGain();
          d1.gain.value = f * 0.03;
          l1.connect(d1).connect(o.frequency);
          const l2 = osc(ctx, 'triangle', 33 + rnd() * 8, 0, t0, 0, t1 + 0.1);
          const d2 = ctx.createGain();
          d2.gain.value = f * 0.012;
          l2.connect(d2).connect(o.frequency);
          const og = ctx.createGain();
          og.gain.value = amp;
          o.connect(og).connect(shaper);
        }
        const hiss = filter(ctx, 'bandpass', 4200, 1.1);
        const hg = ctx.createGain();
        hg.gain.value = 0.5;
        noise(t0, t1 + 0.1).connect(hiss).connect(hg).connect(out);
      },

      rumble(c) {
        const t0 = c.t;
        const t1 = t0 + c.dur;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.12);
        g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.6);
        g.gain.exponentialRampToValueAtTime(0.0001, t1);
        const pan = ctx.createStereoPanner();
        pan.pan.setValueAtTime(-0.7, t0);
        pan.pan.linearRampToValueAtTime(0, t0 + 1.0);
        g.connect(pan).connect(bus);
        const lp = filter(ctx, 'lowpass', 260, 0.9);
        noise(t0, t1).connect(lp).connect(g);
        // Tread hum, slowing as the wheel locks.
        const o = osc(ctx, 'sawtooth', 92, 40, t0, 0.8, t1);
        const olp = filter(ctx, 'lowpass', 420, 1);
        const og = ctx.createGain();
        og.gain.value = 0.22;
        o.connect(olp).connect(og).connect(g);
      },

      thud(c) {
        const t0 = c.t;
        const G = c.gain || 0.5;
        const o = osc(ctx, 'sine', 105, 44, t0, 0.2, t0 + 0.5);
        const g = envGain(ctx, t0, 0.004, 0.38, G);
        const sh = ctx.createWaveShaper();
        sh.curve = softClip(2);
        o.connect(sh).connect(g).connect(bus);
        const lp = filter(ctx, 'lowpass', 600, 0.7);
        const ng = envGain(ctx, t0, 0.002, 0.09, G * 0.5);
        noise(t0, t0 + 0.15).connect(lp).connect(ng).connect(bus);
      },

      bassHit(c) {
        const t0 = c.t;
        const G = c.gain || 1;
        const o = osc(ctx, 'sine', 150, 40, t0, 0.32, t0 + 1.3);
        const g = envGain(ctx, t0, 0.005, 1.1, G);
        const sh = ctx.createWaveShaper();
        sh.curve = softClip(3);
        o.connect(sh).connect(g).connect(bus);
        // Upper harmonic so phone speakers still feel it.
        const o2 = osc(ctx, 'triangle', 300, 84, t0, 0.3, t0 + 0.6);
        const g2 = envGain(ctx, t0, 0.004, 0.42, G * 0.3);
        o2.connect(g2).connect(bus);
        const hp = filter(ctx, 'highpass', 2500, 0.7);
        const cg = envGain(ctx, t0, 0.001, 0.03, G * 0.45);
        noise(t0, t0 + 0.06).connect(hp).connect(cg).connect(bus);
        send(g, 0.4);
      },

      impact(c) {
        const t0 = c.t;
        const G = c.gain || 0.8;
        const p = c.pitch || 1;
        const o = osc(ctx, 'sine', 125 * p, 48 * p, t0, 0.14, t0 + 0.6);
        const g = envGain(ctx, t0, 0.003, 0.42, G);
        const sh = ctx.createWaveShaper();
        sh.curve = softClip(2.5);
        o.connect(sh).connect(g).connect(bus);
        const bp = filter(ctx, 'bandpass', 1400 * p, 0.8);
        const ng = envGain(ctx, t0, 0.001, 0.13, G * 0.75);
        noise(t0, t0 + 0.2).connect(bp).connect(ng).connect(bus);
        for (const [f, a] of [
          [520, 0.12],
          [1340, 0.08],
          [2210, 0.05],
        ]) {
          const m = osc(ctx, 'sine', f * p, 0, t0, 0, t0 + 0.4);
          const mg = envGain(ctx, t0, 0.002, 0.25, G * a);
          m.connect(mg).connect(bus);
          send(mg, 0.6);
        }
        send(ng, 0.5);
      },

      pop(c) {
        const t0 = c.t;
        const f = c.f || 600;
        const G = c.gain || 0.7;
        const o = osc(ctx, 'sine', f * 2.2, f * 0.7, t0, 0.06, t0 + 0.2);
        const g = envGain(ctx, t0, 0.003, 0.13, G);
        o.connect(g).connect(bus);
        send(g, 0.6);
        const hp = filter(ctx, 'highpass', 3000, 0.7);
        const cg = envGain(ctx, t0, 0.001, 0.012, G * 0.3);
        noise(t0, t0 + 0.03).connect(hp).connect(cg).connect(bus);
        const b = osc(ctx, 'sine', 190, 90, t0, 0.08, t0 + 0.15);
        const bg = envGain(ctx, t0, 0.003, 0.09, G * 0.45);
        b.connect(bg).connect(bus);
      },

      ding(c) {
        const t0 = c.t;
        const f = c.f || 1568;
        const G = c.gain || 0.6;
        for (const [ratio, amp, dec] of [
          [1, 1, 1.7],
          [2.01, 0.38, 1.0],
          [2.76, 0.26, 0.65],
          [5.4, 0.09, 0.28],
          [0.5, 0.14, 0.9],
        ]) {
          const o = osc(ctx, 'sine', f * ratio, 0, t0, 0, t0 + dec + 0.1);
          const g = envGain(ctx, t0, 0.002, dec, G * amp * 0.5);
          o.connect(g).connect(bus);
          send(g, 0.8);
        }
      },

      tick(c) {
        const t0 = c.t;
        const o = osc(ctx, 'square', c.f || 2000, 0, t0, 0, t0 + 0.04);
        const hp = filter(ctx, 'highpass', 900, 0.7);
        const g = envGain(ctx, t0, 0.001, 0.028, 0.2);
        o.connect(hp).connect(g).connect(bus);
        const nh = filter(ctx, 'highpass', 4000, 0.7);
        const ng = envGain(ctx, t0, 0.0005, 0.006, 0.25);
        noise(t0, t0 + 0.02).connect(nh).connect(ng).connect(bus);
      },

      swish(c) {
        const t0 = c.t;
        const bp = filter(ctx, 'bandpass', 2000, 1.2);
        bp.frequency.setValueAtTime(1800, t0);
        bp.frequency.exponentialRampToValueAtTime(6500, t0 + 0.16);
        const g = envGain(ctx, t0, 0.03, 0.14, 0.32);
        const pan = ctx.createStereoPanner();
        pan.pan.setValueAtTime(-0.5, t0);
        pan.pan.linearRampToValueAtTime(0.5, t0 + 0.18);
        noise(t0, t0 + 0.25).connect(bp).connect(g).connect(pan).connect(bus);
      },

      shutter(c) {
        const t0 = c.t;
        const click = (t, f, q, a, d) => {
          const bp = filter(ctx, 'bandpass', f, q);
          const g = envGain(ctx, t, 0.0008, d, a);
          noise(t, t + d + 0.02).connect(bp).connect(g).connect(bus);
          send(g, 0.3);
        };
        click(t0, 3600, 1.4, 1.2, 0.012);
        const b = osc(ctx, 'square', 190, 120, t0, 0.02, t0 + 0.03);
        const bg = envGain(ctx, t0, 0.001, 0.018, 0.12);
        b.connect(filter(ctx, 'lowpass', 1500, 0.7)).connect(bg).connect(bus);
        const w = osc(ctx, 'sawtooth', 950, 640, t0 + 0.008, 0.04, t0 + 0.06);
        const wg = envGain(ctx, t0 + 0.008, 0.004, 0.04, 0.07);
        w.connect(filter(ctx, 'lowpass', 2200, 0.7)).connect(wg).connect(bus);
        click(t0 + 0.055, 2200, 1, 1.3, 0.016);
        const th = osc(ctx, 'sine', 150, 90, t0 + 0.055, 0.03, t0 + 0.12);
        const tg = envGain(ctx, t0 + 0.055, 0.002, 0.04, 0.45);
        th.connect(tg).connect(bus);
      },

      glitch(c) {
        let t = c.t;
        const end = c.t + c.dur;
        const crush = ctx.createWaveShaper();
        crush.curve = crushCurve(4);
        const out = ctx.createGain();
        out.gain.value = 0.9;
        crush.connect(out).connect(bus);
        while (t < end) {
          const d = 0.01 + rnd() * 0.025;
          const f = 120 + rnd() * 2400;
          const o = osc(ctx, rnd() < 0.5 ? 'square' : 'sawtooth', f, f * (0.6 + rnd() * 0.8), t, d, t + d + 0.01);
          const g = envGain(ctx, t, 0.001, d, 0.08 + rnd() * 0.14);
          o.connect(g).connect(crush);
          if (rnd() < 0.45) {
            const ng = envGain(ctx, t, 0.001, d, 0.12);
            noise(t, t + d + 0.01).connect(filter(ctx, 'highpass', 1500, 0.7)).connect(ng).connect(crush);
          }
          t += d + rnd() * 0.02;
        }
      },

      shimmer(c) {
        const t0 = c.t;
        const dur = c.dur || 0.5;
        const G = c.gain || 0.18;
        const bp = filter(ctx, 'bandpass', 4500, 3);
        bp.frequency.setValueAtTime(4500, t0);
        bp.frequency.exponentialRampToValueAtTime(10000, t0 + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(G, t0 + dur * 0.4);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        const pan = ctx.createStereoPanner();
        pan.pan.setValueAtTime(-0.6, t0);
        pan.pan.linearRampToValueAtTime(0.6, t0 + dur);
        noise(t0, t0 + dur + 0.05).connect(bp).connect(g).connect(pan).connect(bus);
        send(g, 0.8);
        for (let k = 0; k < 5; k++) {
          const tt = t0 + dur * (0.15 + (0.7 * k) / 5);
          const o = osc(ctx, 'sine', 3000 + rnd() * 4000, 0, tt, 0, tt + 0.2);
          const og = envGain(ctx, tt, 0.002, 0.12, G * 0.45);
          o.connect(og).connect(pan);
          send(og, 0.8);
        }
      },

      riser(c) {
        const t0 = Math.max(0, c.t);
        const t1 = t0 + c.dur;
        const bp = filter(ctx, 'bandpass', 400, 1.5);
        bp.frequency.setValueAtTime(400, t0);
        bp.frequency.exponentialRampToValueAtTime(7000, t1);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.38, t1 - 0.01);
        g.gain.linearRampToValueAtTime(0.0001, t1 + 0.01);
        noise(t0, t1 + 0.02).connect(bp).connect(g).connect(bus);
        const o = osc(ctx, 'sine', 220, 900, t0, c.dur, t1 + 0.02);
        const og = ctx.createGain();
        og.gain.setValueAtTime(0.0001, t0);
        og.gain.exponentialRampToValueAtTime(0.1, t1 - 0.01);
        og.gain.linearRampToValueAtTime(0.0001, t1 + 0.01);
        o.connect(og).connect(bus);
      },

      bassDrop(c) {
        const t0 = c.t;
        const G = c.gain || 1;
        const o = osc(ctx, 'sine', 115, 31, t0, 1.4, t0 + 2.6);
        const g = envGain(ctx, t0, 0.005, 2.4, G);
        const sh = ctx.createWaveShaper();
        sh.curve = softClip(4);
        o.connect(sh).connect(g).connect(bus);
        const s = osc(ctx, 'sawtooth', 58, 30, t0, 1.2, t0 + 1.8);
        const slp = filter(ctx, 'lowpass', 420, 2);
        slp.frequency.setValueAtTime(420, t0);
        slp.frequency.exponentialRampToValueAtTime(110, t0 + 1.4);
        const sg = envGain(ctx, t0, 0.01, 1.5, G * 0.35);
        s.connect(slp).connect(sg).connect(bus);
        const o2 = osc(ctx, 'triangle', 230, 62, t0, 0.6, t0 + 0.9);
        const g2 = envGain(ctx, t0, 0.004, 0.7, G * 0.28);
        o2.connect(g2).connect(bus);
        const lp = filter(ctx, 'lowpass', 1400, 0.7);
        const ng = envGain(ctx, t0, 0.002, 0.2, G * 0.55);
        noise(t0, t0 + 0.3).connect(lp).connect(ng).connect(bus);
        send(g, 0.35);
        send(ng, 0.6);
      },
    };

    for (const c of cues) {
      const fn = SFX[c.type];
      if (!fn) throw new Error('Unknown sound effect: ' + c.type);
      fn(c);
    }
    return ctx.startRendering();
  }

  function wavBase64(buffer) {
    const ch = buffer.numberOfChannels;
    const len = buffer.length;
    const bytes = new ArrayBuffer(44 + len * ch * 2);
    const v = new DataView(bytes);
    const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF');
    v.setUint32(4, 36 + len * ch * 2, true);
    str(8, 'WAVE');
    str(12, 'fmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, ch, true);
    v.setUint32(24, buffer.sampleRate, true);
    v.setUint32(28, buffer.sampleRate * ch * 2, true);
    v.setUint16(32, ch * 2, true);
    v.setUint16(34, 16, true);
    str(36, 'data');
    v.setUint32(40, len * ch * 2, true);
    const data = [];
    for (let c = 0; c < ch; c++) data.push(buffer.getChannelData(c));
    let o = 44;
    for (let i = 0; i < len; i++) {
      for (let c = 0; c < ch; c++) {
        const s = Math.max(-1, Math.min(1, data[c][i]));
        v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        o += 2;
      }
    }
    const u8 = new Uint8Array(bytes);
    let bin = '';
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  R.renderAudio = renderAudio;
  R.wavBase64 = wavBase64;
})();
