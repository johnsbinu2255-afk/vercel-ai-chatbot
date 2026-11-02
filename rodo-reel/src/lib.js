// Shared helpers: maths, easing, colour, glossy 3D text and light effects.
// Everything is a pure function of its inputs so any frame can be rendered on its own.
(function () {
  const R = (window.R = window.R || {});
  const W = (R.W = 1080);
  const H = (R.H = 1920);
  const TAU = (R.TAU = Math.PI * 2);

  R.YELLOW = '#ffd400';
  R.AMBER = '#ffae00';
  R.RED = '#e3120b';
  R.RED_HOT = '#ff2a14';

  R.clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  R.lerp = (a, b, t) => a + (b - a) * t;
  // Progress of x through [a, b], clamped to 0..1.
  R.prog = (x, a, b) => R.clamp((x - a) / (b - a));
  R.fract = (x) => x - Math.floor(x);
  // Deterministic pseudo random in [0, 1) for any number.
  R.rnd = (n) => R.fract(Math.sin(n * 127.1 + 311.7) * 43758.5453123);
  R.rndRange = (n, a, b) => a + (b - a) * R.rnd(n);

  const E = (R.ease = {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    inCubic: (t) => t * t * t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    inQuart: (t) => t * t * t * t,
    outQuart: (t) => 1 - Math.pow(1 - t, 4),
    outQuint: (t) => 1 - Math.pow(1 - t, 5),
    inExpo: (t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
    outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inOutExpo: (t) =>
      t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
    outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
    outElastic: (t) =>
      t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  });

  // Eased progress helper: ep(t, start, end, easing)
  R.ep = (t, a, b, ease = E.outCubic) => ease(R.prog(t, a, b));

  // Pop-in scale: 0 -> overshoot -> 1.
  R.popScale = (t, t0, dur = 0.32, s = 2.4) => {
    if (t < t0) return 0;
    return E.outBack(R.prog(t, t0, t0 + dur), s);
  };

  // ---------- colour ----------
  const hexCache = {};
  R.hex = (h) => {
    if (hexCache[h]) return hexCache[h];
    const v = h.replace('#', '');
    const n = parseInt(v.length === 3 ? v.replace(/./g, (c) => c + c) : v, 16);
    return (hexCache[h] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
  };
  R.mix = (a, b, t) => {
    const A = R.hex(a);
    const B = R.hex(b);
    return `rgb(${Math.round(R.lerp(A[0], B[0], t))},${Math.round(R.lerp(A[1], B[1], t))},${Math.round(
      R.lerp(A[2], B[2], t),
    )})`;
  };
  R.rgba = (h, a) => {
    const c = R.hex(h);
    return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  };

  // ---------- fonts ----------
  R.font = (size, family = 'Anton', weight = 400, italic = false) =>
    family === 'Anton' ? `${size}px Anton` : `${italic ? 'italic ' : ''}${weight} ${size}px "${family}"`;

  // ---------- camera shake ----------
  // impacts: [{t, a (px), d (seconds)}]
  R.shake = (t, impacts) => {
    let dx = 0;
    let dy = 0;
    let rot = 0;
    for (const im of impacts) {
      const u = t - im.t;
      if (u < 0 || u > im.d) continue;
      const k = Math.pow(1 - u / im.d, 2) * im.a;
      const ph = im.t * 13.37;
      dx += k * Math.sin(u * 71 + ph);
      dy += k * 0.8 * Math.sin(u * 59 + ph * 1.7 + 1.3);
      rot += k * 0.00045 * Math.sin(u * 47 + ph * 0.7 + 2.1);
    }
    return { dx, dy, rot };
  };

  // ---------- face gradients for glossy text ----------
  R.FACE = {
    gold: [
      [0, '#fff6b8'],
      [0.2, '#ffe83d'],
      [0.46, '#ffd200'],
      [0.5, '#ffaa00'],
      [0.8, '#ff8f00'],
      [1, '#ffc42e'],
    ],
    white: [
      [0, '#ffffff'],
      [0.44, '#f0f0f0'],
      [0.5, '#c4c4c8'],
      [0.82, '#a9a9ae'],
      [1, '#e4e4e8'],
    ],
    red: [
      [0, '#ff9b8a'],
      [0.44, '#ff3418'],
      [0.5, '#d40c00'],
      [0.85, '#b30800'],
      [1, '#ff4a2a'],
    ],
  };
  R.SIDE = {
    gold: ['#c24f00', '#3a0b00'],
    white: ['#77777d', '#141416'],
    red: ['#7a0800', '#1c0200'],
  };

  // Glossy, extruded 3D text drawn with layered fills so it stays sharp at any scale.
  // o: {family, weight, italic, align, spacing, style ('gold'|'white'|'red'), depth,
  //     glow (css colour), glowBlur, glowAlpha, shine (0..1 sweep position), skew, stroke}
  R.glossyText = function (ctx, text, x, y, size, o = {}) {
    const style = o.style || 'gold';
    ctx.save();
    ctx.font = R.font(size, o.family || 'Anton', o.weight || 400, o.italic);
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.letterSpacing = (o.spacing || 0) + 'px';
    const m = ctx.measureText(text);
    const asc = m.actualBoundingBoxAscent;
    const desc = m.actualBoundingBoxDescent;
    const top = y - asc;
    const bot = y + desc;
    const w = m.width;
    const left = ctx.textAlign === 'center' ? x - w / 2 : ctx.textAlign === 'right' ? x - w : x;
    if (o.skew) {
      ctx.translate(x, y);
      ctx.transform(1, 0, -o.skew, 1, 0, 0);
      ctx.translate(-x, -y);
    }
    const depth = o.depth != null ? o.depth : Math.max(2, Math.round(size * 0.065));
    const ex = o.ex != null ? o.ex : 0.55;
    const ey = o.ey != null ? o.ey : 1;

    if (o.glow) {
      ctx.save();
      ctx.globalAlpha *= o.glowAlpha != null ? o.glowAlpha : 1;
      ctx.shadowColor = o.glow;
      ctx.shadowBlur = o.glowBlur || size * 0.3;
      ctx.fillStyle = o.glow;
      ctx.fillText(text, x + depth * ex * 0.5, y + depth * ey * 0.5);
      ctx.shadowBlur = (o.glowBlur || size * 0.3) * 0.4;
      ctx.fillText(text, x + depth * ex * 0.5, y + depth * ey * 0.5);
      ctx.restore();
    }

    // Extrusion, back to front.
    const [sideNear, sideFar] = o.side || R.SIDE[style];
    const step = depth > 24 ? 2 : 1;
    for (let i = depth; i >= 1; i -= step) {
      ctx.fillStyle = R.mix(sideNear, sideFar, i / depth);
      ctx.fillText(text, x + i * ex, y + i * ey);
    }
    // Dark outline gives the face a crisp edge on any background.
    ctx.lineJoin = 'round';
    ctx.lineWidth = o.stroke != null ? o.stroke : Math.max(2, size * 0.035);
    ctx.strokeStyle = o.strokeColor || 'rgba(20,6,0,0.95)';
    if (ctx.lineWidth > 0) ctx.strokeText(text, x, y);

    const g = ctx.createLinearGradient(0, top, 0, bot);
    for (const [p, c] of o.face || R.FACE[style]) g.addColorStop(p, c);
    ctx.fillStyle = g;
    ctx.fillText(text, x, y);

    // Upper gloss.
    const gg = ctx.createLinearGradient(0, top, 0, bot);
    gg.addColorStop(0, 'rgba(255,255,255,0.38)');
    gg.addColorStop(0.42, 'rgba(255,255,255,0.06)');
    gg.addColorStop(0.44, 'rgba(255,255,255,0)');
    gg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gg;
    ctx.fillText(text, x, y);

    // Moving shine band.
    if (o.shine != null && o.shine > -0.2 && o.shine < 1.2) {
      const band = size * 0.45;
      const sx = left - band + o.shine * (w + band * 2);
      const sg = ctx.createLinearGradient(sx - band, top, sx + band * 0.4, bot);
      sg.addColorStop(0, 'rgba(255,255,255,0)');
      sg.addColorStop(0.45, 'rgba(255,255,255,0.0)');
      sg.addColorStop(0.55, 'rgba(255,255,255,0.95)');
      sg.addColorStop(0.65, 'rgba(255,255,255,0.0)');
      sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg;
      ctx.fillText(text, x, y);
    }
    ctx.restore();
    return { width: w, asc, desc, left };
  };

  // Flat text with optional shadow, used for labels.
  R.text = function (ctx, text, x, y, size, o = {}) {
    ctx.save();
    ctx.font = R.font(size, o.family || 'Barlow Condensed', o.weight || 800, o.italic);
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = o.baseline || 'alphabetic';
    ctx.letterSpacing = (o.spacing || 0) + 'px';
    if (o.shadow) {
      ctx.shadowColor = o.shadow;
      ctx.shadowBlur = o.shadowBlur || 12;
      ctx.shadowOffsetY = o.shadowY || 0;
    }
    if (o.stroke) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = o.stroke;
      ctx.strokeStyle = o.strokeColor || '#000';
      ctx.strokeText(text, x, y);
    }
    ctx.fillStyle = o.color || '#fff';
    ctx.fillText(text, x, y);
    const w = ctx.measureText(text).width;
    ctx.restore();
    return w;
  };

  R.measure = function (ctx, text, size, o = {}) {
    ctx.save();
    ctx.font = R.font(size, o.family || 'Anton', o.weight || 400, o.italic);
    ctx.letterSpacing = (o.spacing || 0) + 'px';
    const m = ctx.measureText(text);
    ctx.restore();
    return m;
  };

  // Largest font size (<= max) at which text fits in maxWidth.
  R.fitSize = function (ctx, text, max, maxWidth, o = {}) {
    let s = max;
    while (s > 10 && R.measure(ctx, text, s, o).width > maxWidth) s -= 2;
    return s;
  };

  // ---------- light ----------
  R.glow = function (ctx, x, y, r, color, alpha = 1, mode = 'lighter') {
    if (alpha <= 0 || r <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = mode;
    ctx.globalAlpha *= R.clamp(alpha);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(0.35, R.rgba(color, 0.35));
    g.addColorStop(1, R.rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  };

  // Anamorphic light streak (horizontal lens flare).
  R.streak = function (ctx, x, y, len, thick, color, alpha = 1) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= R.clamp(alpha);
    ctx.translate(x, y);
    ctx.scale(len, thick);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.08, R.rgba(color, 0.9));
    g.addColorStop(0.4, R.rgba(color, 0.25));
    g.addColorStop(1, R.rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, TAU);
    ctx.fill();
    ctx.restore();
  };

  // A streak that sweeps across the frame between t0 and t0 + dur.
  R.sweepStreak = function (ctx, t, t0, dur, y, color = '#ffd400', o = {}) {
    const p = R.prog(t, t0, t0 + dur);
    if (p <= 0 || p >= 1) return;
    const dir = o.dir || 1;
    const x = dir > 0 ? R.lerp(-300, W + 300, E.inOutQuad(p)) : R.lerp(W + 300, -300, E.inOutQuad(p));
    const a = Math.sin(p * Math.PI);
    R.streak(ctx, x, y, o.len || 900, o.thick || 10, color, a * (o.alpha || 1));
    R.streak(ctx, x, y, (o.len || 900) * 0.35, (o.thick || 10) * 3, '#ffffff', a * 0.35 * (o.alpha || 1));
  };

  // Horizontal speed lines.
  R.speedLines = function (ctx, t, o = {}) {
    const n = o.count || 40;
    const dir = o.dir || -1;
    const y0 = o.y0 != null ? o.y0 : 0;
    const y1 = o.y1 != null ? o.y1 : H;
    const alpha = o.alpha != null ? o.alpha : 0.5;
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const s = (o.seed || 1) * 100 + i;
      const y = y0 + R.rnd(s) * (y1 - y0);
      const len = (o.len || 500) * (0.4 + R.rnd(s + 0.3));
      const speed = (o.speed || 2400) * (0.6 + R.rnd(s + 0.7) * 0.8);
      const span = W + len * 2 + 200;
      const x = ((((R.rnd(s + 0.9) * span + speed * t * dir) % span) + span) % span) - len - 100;
      const th = (o.thick || 3) * (0.5 + R.rnd(s + 0.5));
      const col = o.colors ? o.colors[i % o.colors.length] : '#ffffff';
      const g = ctx.createLinearGradient(x, 0, x + len, 0);
      const head = dir < 0 ? 0 : 1;
      g.addColorStop(head, R.rgba(col, alpha * (0.4 + 0.6 * R.rnd(s + 1.1))));
      g.addColorStop(1 - head, R.rgba(col, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x, y - th / 2, len, th);
    }
    ctx.restore();
  };

  // Radial speed lines flying out from (cx, cy).
  R.radialLines = function (ctx, t, cx, cy, o = {}) {
    const n = o.count || 60;
    const alpha = o.alpha != null ? o.alpha : 0.5;
    if (alpha <= 0) return;
    const maxR = o.maxR || 1400;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const s = (o.seed || 7) * 100 + i;
      const ang = R.rnd(s) * TAU;
      const speed = (o.speed || 1800) * (0.5 + R.rnd(s + 0.2));
      const len = (o.len || 260) * (0.5 + R.rnd(s + 0.4));
      const r = (((R.rnd(s + 0.6) * maxR + speed * t) % maxR) + maxR) % maxR;
      const r0 = (o.inner || 120) + r;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const col = o.colors ? o.colors[i % o.colors.length] : '#ffffff';
      const g = ctx.createLinearGradient(cx + ca * r0, cy + sa * r0, cx + ca * (r0 + len), cy + sa * (r0 + len));
      g.addColorStop(0, R.rgba(col, 0));
      g.addColorStop(1, R.rgba(col, alpha * (0.3 + 0.7 * R.rnd(s + 0.8))));
      ctx.strokeStyle = g;
      ctx.lineWidth = (o.thick || 3) * (0.5 + R.rnd(s + 0.9));
      ctx.beginPath();
      ctx.moveTo(cx + ca * r0, cy + sa * r0);
      ctx.lineTo(cx + ca * (r0 + len), cy + sa * (r0 + len));
      ctx.stroke();
    }
    ctx.restore();
  };

  // Light rays bursting from a point (used on impacts).
  R.burst = function (ctx, x, y, p, o = {}) {
    if (p <= 0 || p >= 1) return;
    const n = o.count || 18;
    const r0 = (o.r0 || 80) + E.outCubic(p) * (o.grow || 500);
    const len = (o.len || 380) * (1 - p);
    const a = (1 - p) * (o.alpha || 0.9);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * TAU + (o.seed || 0) + R.rnd(i + (o.seed || 0)) * 0.2;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const col = i % 3 === 0 ? o.c2 || R.RED_HOT : o.c1 || R.YELLOW;
      ctx.strokeStyle = R.rgba(col, a);
      ctx.lineWidth = (o.thick || 7) * (0.6 + R.rnd(i * 3.3));
      ctx.beginPath();
      ctx.moveTo(x + ca * r0, y + sa * r0 * (o.squash || 1));
      ctx.lineTo(x + ca * (r0 + len), y + sa * (r0 + len) * (o.squash || 1));
      ctx.stroke();
    }
    ctx.restore();
  };

  // Expanding ring (shockwave).
  R.ring = function (ctx, x, y, p, o = {}) {
    if (p <= 0 || p >= 1) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = R.rgba(o.color || R.YELLOW, (1 - p) * (o.alpha || 0.9));
    ctx.lineWidth = (o.width || 10) * (1 - p) + 1;
    ctx.beginPath();
    ctx.ellipse(x, y, (o.r0 || 40) + E.outCubic(p) * (o.grow || 400), ((o.r0 || 40) + E.outCubic(p) * (o.grow || 400)) * (o.squash || 1), 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  };

  // Glowing embers drifting upwards.
  R.embers = function (ctx, t, o = {}) {
    const n = o.count || 40;
    const alpha = o.alpha != null ? o.alpha : 0.8;
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const span = H + 200;
    for (let i = 0; i < n; i++) {
      const s = (o.seed || 5) * 50 + i;
      const sp = (o.speed || 120) * (0.5 + R.rnd(s + 0.1));
      const x = R.rnd(s) * W + Math.sin(t * (0.8 + R.rnd(s + 0.2)) + i) * 30;
      const y = H + 100 - ((R.rnd(s + 0.3) * span + sp * t) % span);
      const r = (o.size || 4) * (0.4 + R.rnd(s + 0.4));
      const tw = 0.5 + 0.5 * Math.sin(t * 6 + i * 1.7);
      const col = R.rnd(s + 0.5) < 0.6 ? '#ffd400' : '#ff4a1a';
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
      g.addColorStop(0, R.rgba(col, alpha * tw));
      g.addColorStop(1, R.rgba(col, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
    }
    ctx.restore();
  };

  R.flash = function (ctx, a, color = '#ffffff') {
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha *= R.clamp(a);
    ctx.fillStyle = color;
    ctx.fillRect(-50, -50, W + 100, H + 100);
    ctx.restore();
  };

  R.vignette = function (ctx, strength = 0.75) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.22, W / 2, H / 2, H * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.fillStyle = g;
    ctx.fillRect(-50, -50, W + 100, H + 100);
  };

  // Dark studio background with coloured haze.
  R.background = function (ctx, t, o = {}) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, o.top || '#0c0b0f');
    g.addColorStop(0.55, o.mid || '#141117');
    g.addColorStop(1, o.bottom || '#050505');
    ctx.fillStyle = g;
    ctx.fillRect(-60, -60, W + 120, H + 120);
    const hazeY = o.hazeY != null ? o.hazeY : H * 0.42;
    R.glow(ctx, W * 0.5 + Math.sin(t * 0.7) * 60, hazeY, o.hazeR || 900, o.haze || '#3a0800', o.hazeA != null ? o.hazeA : 0.7, 'source-over');
    if (o.haze2 !== false)
      R.glow(ctx, W * 0.15 + Math.sin(t * 0.9 + 1) * 40, H * 0.16, 520, '#4a3400', 0.35, 'lighter');
  };

  // Carbon-fibre texture pattern (cached).
  let carbon = null;
  R.carbonPattern = function (ctx) {
    if (carbon) return carbon;
    const c = document.createElement('canvas');
    c.width = c.height = 24;
    const x = c.getContext('2d');
    x.fillStyle = '#0d0d0f';
    x.fillRect(0, 0, 24, 24);
    const cell = (px, py, horiz) => {
      const g = horiz ? x.createLinearGradient(px, py, px, py + 12) : x.createLinearGradient(px, py, px + 12, py);
      g.addColorStop(0, '#1b1b1f');
      g.addColorStop(0.5, '#2a2a30');
      g.addColorStop(1, '#141417');
      x.fillStyle = g;
      x.fillRect(px + 1, py + 1, 10, 10);
    };
    cell(0, 0, true);
    cell(12, 0, false);
    cell(0, 12, false);
    cell(12, 12, true);
    carbon = ctx.createPattern(c, 'repeat');
    return carbon;
  };

  // Rounded rectangle path.
  R.rrect = function (ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  };

  // Format a 10 digit Indian mobile number as "97476 91237".
  R.formatPhone = (p) => {
    const d = String(p).replace(/\D/g, '');
    return d.length === 10 ? d.slice(0, 5) + ' ' + d.slice(5) : p;
  };

  // Offscreen canvas pool keyed by name.
  const pool = {};
  R.buffer = function (name, w = W, h = H) {
    let c = pool[name];
    if (!c || c.width !== w || c.height !== h) {
      c = pool[name] = document.createElement('canvas');
      c.width = w;
      c.height = h;
    }
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.clearRect(0, 0, w, h);
    return c;
  };
})();
