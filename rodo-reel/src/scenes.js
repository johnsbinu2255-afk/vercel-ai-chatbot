// The six scenes. Each draws a full frame for absolute time t.
(function () {
  const R = window.R;
  const TL = window.TL;
  const { W, H, TAU } = R;
  const E = R.ease;
  const S = (R.scenes = {});

  // Slam-in scale: big -> 1 just before ts, then a small rebound.
  function slam(t, ts, from = 3, lead = 0.12) {
    if (t < ts - lead) return null;
    if (t < ts) {
      const p = R.prog(t, ts - lead, ts);
      return { s: R.lerp(from, 1, E.inQuad(p)), a: E.outQuad(p), moving: true };
    }
    const u = t - ts;
    return { s: 1 - 0.06 * Math.exp(-11 * u) * Math.cos(u * 26), a: 1, moving: false };
  }

  function withScale(ctx, x, y, s, fn) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.translate(-x, -y);
    fn();
    ctx.restore();
  }

  // Zoom trail behind a slamming element.
  function slamDraw(ctx, x, y, st, fn) {
    if (!st) return;
    if (st.moving && st.s > 1.05) {
      for (let k = 3; k >= 1; k--) {
        ctx.save();
        ctx.globalAlpha = st.a * 0.12;
        withScale(ctx, x, y, st.s * (1 + k * 0.07), fn);
        ctx.restore();
      }
    }
    ctx.save();
    ctx.globalAlpha = st.a;
    withScale(ctx, x, y, st.s, fn);
    ctx.restore();
  }

  function impactFx(ctx, t, ts, x, y, o = {}) {
    const p = R.prog(t, ts, ts + (o.dur || 0.45));
    R.burst(ctx, x, y, p, { count: o.count || 20, grow: o.grow || 600, len: o.len || 380, r0: o.r0 || 90, squash: o.squash || 1 });
    R.ring(ctx, x, y, R.prog(t, ts, ts + 0.5), { grow: o.ringGrow || 800, width: 16, r0: o.r0 || 90, squash: o.squash || 1 });
    if (o.flash && t >= ts) R.flash(ctx, o.flash * (1 - R.prog(t, ts, ts + 0.14)));
  }

  // =====================================================================
  // Scene 1: hook. A tyre rolls in, skids to a stop, RODO TYRES slams in.
  // =====================================================================
  const TYRE_R = 250;
  const FLOOR_Y = 1470;
  const TYRE_Y = FLOOR_Y - TYRE_R;
  // The tyre is already entering on frame one, then brakes hard to a stop at centre.
  const X0 = -170;
  const X_END = 540;
  const T_BRAKE = 0.32;
  const BRAKE_DUR = TL.tyreStop - T_BRAKE;
  const V0 = (X_END - X0) / (T_BRAKE + BRAKE_DUR / 3);

  function tyreV(t) {
    if (t <= T_BRAKE) return V0;
    if (t < TL.tyreStop) {
      const u = (t - T_BRAKE) / BRAKE_DUR;
      return V0 * (1 - u) * (1 - u);
    }
    return 0;
  }
  function tyreX(t) {
    if (t <= T_BRAKE) return X0 + V0 * t;
    if (t < TL.tyreStop) {
      const u = (t - T_BRAKE) / BRAKE_DUR;
      return X0 + V0 * T_BRAKE + (V0 * BRAKE_DUR * (1 - Math.pow(1 - u, 3))) / 3;
    }
    const u = t - TL.tyreStop;
    return X_END + 14 * Math.exp(-9 * u) * Math.sin(u * 16);
  }
  // The wheel locks while braking, so it skids (and screeches) to a stop.
  const lockAt = (t) => 1 - R.prog(t, 0.56, 0.8);
  const ANG = [];
  (function () {
    let a = 0;
    for (let i = 0; i <= 4000; i++) {
      ANG.push(a);
      const t = i / 1000;
      a += ((tyreV(t) / TYRE_R) * lockAt(t)) / 1000;
    }
  })();
  function tyreAng(t) {
    const i = R.clamp(t * 1000, 0, 3999);
    const i0 = Math.floor(i);
    return R.lerp(ANG[i0], ANG[i0 + 1], i - i0);
  }
  R.tyreAng = tyreAng;

  function floor(ctx, y0) {
    const g = ctx.createLinearGradient(0, y0, 0, H);
    g.addColorStop(0, '#17120a');
    g.addColorStop(1, '#030303');
    ctx.fillStyle = g;
    ctx.fillRect(-60, y0, W + 120, H - y0 + 60);
    ctx.save();
    ctx.beginPath();
    ctx.rect(-60, y0, W + 120, H - y0 + 60);
    ctx.clip();
    const vx = W / 2;
    const vy = y0 - 300;
    ctx.strokeStyle = 'rgba(255,212,0,0.09)';
    ctx.lineWidth = 2;
    for (let i = -12; i <= 12; i++) {
      ctx.beginPath();
      ctx.moveTo(vx, vy);
      ctx.lineTo(vx + i * 300, H + 400);
      ctx.stroke();
    }
    for (let k = 1; k < 10; k++) {
      const yy = y0 + Math.pow(k / 9, 2) * (H - y0 + 40);
      ctx.strokeStyle = `rgba(255,212,0,${0.05 + k * 0.012})`;
      ctx.beginPath();
      ctx.moveTo(-60, yy);
      ctx.lineTo(W + 60, yy);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const hg = ctx.createLinearGradient(0, 0, W, 0);
    hg.addColorStop(0, 'rgba(255,212,0,0)');
    hg.addColorStop(0.5, 'rgba(255,212,0,0.7)');
    hg.addColorStop(1, 'rgba(255,212,0,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, y0 - 1.5, W, 3);
    ctx.restore();
  }

  function smoke(ctx, t, front) {
    for (let i = 0; i < 30; i++) {
      if ((i % 2 === 0) !== front) continue;
      const te = 0.6 + i * 0.022;
      if (te > 1.24) break;
      const age = t - te;
      if (age < 0 || age > 1.6) continue;
      const p = age / 1.6;
      const r = 40 + 260 * E.outCubic(p) * (0.7 + R.rnd(i) * 0.6);
      const x = tyreX(te) - 30 - 90 * age - R.rnd(i + 3) * 60 + (front ? 40 : -20);
      const y = FLOOR_Y - 30 - 190 * E.outQuad(p) * (0.6 + R.rnd(i + 5) * 0.8);
      const a = 0.24 * (1 - p) * Math.min(1, age * 10);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(215,205,195,${a})`);
      g.addColorStop(0.6, `rgba(160,150,140,${a * 0.45})`);
      g.addColorStop(1, 'rgba(120,110,100,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  S.hook = function (ctx, t, env) {
    const cfg = env.cfg.hook;
    R.background(ctx, t, { haze: '#3a0700', hazeY: 700, hazeR: 950 });

    const v = tyreV(t);
    const speedK = v / V0;
    // Ambient streaks: fast while the tyre rolls, calmer once it stops.
    R.speedLines(ctx, t, { dir: -1, count: 36, len: 520, speed: 2600, alpha: 0.12 + 0.3 * speedK, y0: 120, y1: 1450, colors: ['#ffffff', '#ffd400', '#ff3a1a'], seed: 3 });

    // Slow camera push on the text after the slam.
    const push = 1 + 0.11 * E.inOutQuad(R.prog(t, TL.hookSlam + 0.05, 2.95));
    ctx.save();
    ctx.translate(540, 820);
    ctx.scale(push, push);
    ctx.translate(-540, -820);

    floor(ctx, FLOOR_Y);

    const x = tyreX(t);
    const ang = tyreAng(t);
    const omega = (v / TYRE_R) * lockAt(t);

    // Skid mark.
    if (t > 0.62) {
      const xs = tyreX(0.62);
      const g = ctx.createLinearGradient(xs, 0, x, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.75)');
      ctx.fillStyle = g;
      ctx.fillRect(xs, FLOOR_Y + 1, x - xs, 12);
    }

    smoke(ctx, t, false);

    // Tyre sprite (drawn once, composited for blur and reflection).
    const pad = 30;
    const size = TYRE_R * 2 + pad * 2;
    const spr = R.buffer('tyreSprite', size, size);
    R.drawTyre(spr.getContext('2d'), size / 2, size / 2, TYRE_R, ang, { blur: omega / 30 });

    // Reflection on the glossy floor.
    ctx.save();
    ctx.beginPath();
    ctx.rect(-60, FLOOR_Y, W + 120, 600);
    ctx.clip();
    ctx.globalAlpha = 0.2;
    ctx.translate(x, FLOOR_Y + TYRE_R);
    ctx.scale(1, -1);
    ctx.drawImage(spr, -size / 2, -size / 2);
    ctx.restore();
    const fg = ctx.createLinearGradient(0, FLOOR_Y, 0, FLOOR_Y + 420);
    fg.addColorStop(0, 'rgba(10,8,5,0)');
    fg.addColorStop(1, 'rgba(5,4,3,0.95)');
    ctx.fillStyle = fg;
    ctx.fillRect(-60, FLOOR_Y, W + 120, 430);

    // Contact shadow.
    ctx.save();
    const sg = ctx.createRadialGradient(x, FLOOR_Y, 0, x, FLOOR_Y, TYRE_R * 1.1);
    sg.addColorStop(0, 'rgba(0,0,0,0.85)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.translate(x, FLOOR_Y);
    ctx.scale(1, 0.12);
    ctx.translate(-x, -FLOOR_Y);
    ctx.fillRect(x - TYRE_R * 1.2, FLOOR_Y - TYRE_R * 1.2, TYRE_R * 2.4, TYRE_R * 2.4);
    ctx.restore();

    // Motion trails behind the tyre.
    if (speedK > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) {
        const yy = TYRE_Y + (R.rnd(i * 2.7) - 0.5) * TYRE_R * 1.7;
        const len = (300 + R.rnd(i * 1.3) * 500) * speedK;
        const x1 = x - TYRE_R * (0.3 + 0.6 * R.rnd(i * 4.1));
        const g = ctx.createLinearGradient(x1 - len, 0, x1, 0);
        const col = i % 4 === 0 ? '255,60,20' : '255,212,0';
        g.addColorStop(0, `rgba(${col},0)`);
        g.addColorStop(1, `rgba(${col},${0.55 * speedK})`);
        ctx.fillStyle = g;
        ctx.fillRect(x1 - len, yy - 3, len, 6 * (0.5 + R.rnd(i)));
      }
      ctx.restore();
    }

    // Tyre with translational motion blur.
    const blurPx = (v / 30) * 0.9;
    const copies = R.clamp(Math.ceil(blurPx / 12), 1, 8);
    for (let c = 0; c < copies; c++) {
      ctx.save();
      ctx.globalAlpha = 1 / (c + 1);
      const off = copies > 1 ? -(blurPx * c) / (copies - 1) : 0;
      ctx.drawImage(spr, x - size / 2 + off, TYRE_Y - size / 2);
      ctx.restore();
    }
    // Rim light on the tyre.
    R.glow(ctx, x - TYRE_R * 0.45, TYRE_Y - TYRE_R * 0.55, TYRE_R * 0.6, '#ffd400', 0.12);

    smoke(ctx, t, true);

    // Text.
    const ts = TL.hookSlam;
    R.embers(ctx, t, { count: 36, alpha: 0.7 * R.prog(t, ts, ts + 0.3), speed: 160, seed: 2 });
    const glowA = R.prog(t, ts - 0.05, ts + 0.1);
    if (glowA > 0) {
      R.glow(ctx, 540, 600, 620, '#ff2200', (0.55 + 0.12 * Math.sin(t * 7)) * glowA);
      R.glow(ctx, 540, 600, 320, '#ffd400', 0.25 * glowA);
    }
    const shine1 = R.prog(t, ts + 0.25, ts + 0.75);
    const shine2 = R.prog(t, 2.2, 2.7);
    const shine = shine1 > 0 && shine1 < 1 ? shine1 : shine2 > 0 && shine2 < 1 ? shine2 : null;
    const st1 = slam(t, ts, 3.2);
    slamDraw(ctx, 540, 520, st1, () =>
      R.glossyText(ctx, cfg.top, 540, 650, 350, { style: 'gold', glow: 'rgba(255,30,0,0.95)', glowBlur: 90, depth: 24, shine, skew: 0.1 }),
    );
    const st2 = slam(t, ts + 0.06, 2.6);
    slamDraw(ctx, 540, 820, st2, () =>
      R.glossyText(ctx, cfg.bottom, 540, 880, 196, { style: 'gold', glow: 'rgba(255,30,0,0.9)', glowBlur: 60, depth: 14, spacing: 26, shine, skew: 0.1 }),
    );
    ctx.restore();

    impactFx(ctx, t, ts, 540, 640, { flash: 0.55, grow: 700, ringGrow: 950 });
    R.sweepStreak(ctx, t, -0.12, 0.5, TYRE_Y, '#ffd400', { len: 1100, thick: 10 });
    R.sweepStreak(ctx, t, ts - 0.02, 0.45, 560, '#ffd400', { len: 1000, thick: 9 });
    R.sweepStreak(ctx, t, ts + 0.5, 0.55, 860, '#ff3a14', { len: 800, thick: 7, dir: -1 });
    R.vignette(ctx, 0.7);
  };

  // =====================================================================
  // Scene 2: India -> Kerala -> Ernakulam, two pins drop.
  // =====================================================================
  const MD = window.MAP_DATA;
  const merc = (lon, lat) => [(lon * Math.PI) / 180, Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))];
  const K0 = { c: merc(80.6, 22.4), s: 1850, a: [540, 980] };
  const K1 = { c: merc(76.25, 10.5), s: 13000, a: [540, 1000] };
  const K1b = { c: K1.c, s: K1.s * 1.12, a: K1.a };
  const K2 = { c: merc(76.433, 9.93), s: 92000, a: [540, 1000] };

  function zoomTo(A, B, u) {
    const s = Math.exp(R.lerp(Math.log(A.s), Math.log(B.s), u));
    const ax = R.lerp(A.a[0], B.a[0], u);
    const ay = R.lerp(A.a[1], B.a[1], u);
    const sx0 = (B.c[0] - A.c[0]) * A.s + A.a[0];
    const sy0 = -(B.c[1] - A.c[1]) * A.s + A.a[1];
    const tx = R.lerp(sx0, B.a[0], u);
    const ty = R.lerp(sy0, B.a[1], u);
    return { c: [B.c[0] - (tx - ax) / s, B.c[1] + (ty - ay) / s], s, a: [ax, ay] };
  }
  function mapCam(t) {
    const z1 = TL.zoom1;
    const z2 = TL.zoom2;
    if (t < z1[1]) return zoomTo(K0, K1, E.inOutCubic(R.prog(t, z1[0], z1[1])));
    if (t < z2[0]) return { c: K1.c, s: K1.s * (1 + 0.12 * R.prog(t, z1[1], z2[0])), a: K1.a };
    if (t < z2[1]) return zoomTo(K1b, K2, E.inOutCubic(R.prog(t, z2[0], z2[1])));
    return { c: K2.c, s: K2.s * (1 + 0.05 * E.outQuad(R.prog(t, z2[1], 6))), a: K2.a };
  }
  const project = (cam, x, y) => [(x - cam.c[0]) * cam.s + cam.a[0], -(y - cam.c[1]) * cam.s + cam.a[1]];

  // Bounding boxes per ring for culling.
  const boxes = new Map();
  function ringBox(r) {
    let b = boxes.get(r);
    if (!b) {
      b = [Infinity, Infinity, -Infinity, -Infinity];
      for (let i = 0; i < r.length; i += 2) {
        b[0] = Math.min(b[0], r[i]);
        b[1] = Math.min(b[1], r[i + 1]);
        b[2] = Math.max(b[2], r[i]);
        b[3] = Math.max(b[3], r[i + 1]);
      }
      boxes.set(r, b);
    }
    return b;
  }
  function layerPath(ctx, rings, cam) {
    ctx.beginPath();
    for (const r of rings) {
      const b = ringBox(r);
      const p0 = project(cam, b[0], b[3]);
      const p1 = project(cam, b[2], b[1]);
      if (p1[0] < -100 || p0[0] > W + 100 || p1[1] < -100 || p0[1] > H + 100) continue;
      const pw = p1[0] - p0[0];
      if (pw < 0.6 && p1[1] - p0[1] < 0.6) {
        // Tiny island: draw as a dot so it stays visible.
        ctx.moveTo(p0[0] + 1.6, p0[1]);
        ctx.arc(p0[0], p0[1], 1.6, 0, TAU);
        continue;
      }
      for (let i = 0; i < r.length; i += 2) {
        const x = (r[i] - cam.c[0]) * cam.s + cam.a[0];
        const y = -(r[i + 1] - cam.c[1]) * cam.s + cam.a[1];
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
  }

  function graticule(ctx, cam, alpha) {
    const ppd = (cam.s * Math.PI) / 180;
    const inv = (sx, sy) => {
      const X = (sx - cam.a[0]) / cam.s + cam.c[0];
      const Y = -(sy - cam.a[1]) / cam.s + cam.c[1];
      return [(X * 180) / Math.PI, ((2 * Math.atan(Math.exp(Y)) - Math.PI / 2) * 180) / Math.PI];
    };
    const [lonA, latB] = inv(0, H);
    const [lonB, latA] = inv(W, 0);
    ctx.save();
    ctx.lineWidth = 1.5;
    for (const sp of [10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02]) {
      const px = sp * ppd;
      const a = R.prog(px, 60, 150) * (1 - R.prog(px, 300, 520));
      if (a <= 0) continue;
      ctx.strokeStyle = `rgba(255,212,0,${0.08 * a * alpha})`;
      ctx.beginPath();
      for (let lon = Math.ceil(lonA / sp) * sp; lon <= lonB; lon += sp) {
        const [x] = project(cam, (lon * Math.PI) / 180, 0);
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
      }
      for (let lat = Math.ceil(latB / sp) * sp; lat <= latA; lat += sp) {
        const [, y] = project(cam, 0, merc(0, lat)[1]);
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function label(ctx, text, x, y, size, a, o = {}) {
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    R.text(ctx, text, x, y, size, { family: 'Anton', spacing: o.spacing || 8, color: o.color || '#ffffff', shadow: 'rgba(0,0,0,0.9)', shadowBlur: 18, align: o.align || 'center' });
    ctx.restore();
  }

  function pinChip(ctx, x, y, pin, p) {
    if (p <= 0) return;
    const hy = y - 84;
    const tw = R.measure(ctx, pin.label, 50, { family: 'Barlow Condensed', weight: 800, spacing: 1 }).width;
    const nw = R.measure(ctx, pin.note, 30, { family: 'Barlow Condensed', weight: 700, spacing: 2 }).width;
    const w = Math.max(tw, nw) + 52;
    const h = 108;
    const left = pin.side === 'left';
    const gap = 46;
    const cx = left ? x - gap - w : x + gap;
    const ox = left ? cx + w : cx;
    const k = E.outBack(R.clamp(p), 2);
    ctx.save();
    ctx.globalAlpha = R.clamp(p * 2);
    ctx.translate(ox, hy);
    ctx.scale(k, k);
    ctx.translate(-ox, -hy);
    ctx.strokeStyle = 'rgba(255,212,0,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + (left ? -24 : 24), hy);
    ctx.lineTo(left ? cx + w : cx, hy);
    ctx.stroke();
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 20;
    R.rrect(ctx, cx, hy - h / 2, w, h, 14);
    ctx.fillStyle = 'rgba(12,12,14,0.92)';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,212,0,0.85)';
    ctx.stroke();
    ctx.fillStyle = R.RED;
    ctx.fillRect(left ? cx + w - 10 : cx, hy - h / 2 + 12, 10, h - 24);
    const tx = left ? cx + w - 28 : cx + 28;
    const align = left ? 'right' : 'left';
    R.text(ctx, pin.label, tx, hy + 4, 50, { family: 'Barlow Condensed', weight: 800, spacing: 1, align, color: '#ffffff' });
    R.text(ctx, pin.note, tx, hy + 40, 30, { family: 'Barlow Condensed', weight: 700, spacing: 2, align, color: R.YELLOW });
    ctx.restore();
  }

  S.map = function (ctx, t, env) {
    const cam = mapCam(t);
    const z = R.clamp(Math.log(cam.s / K0.s) / Math.log(K2.s / K0.s));

    // Ocean.
    ctx.fillStyle = '#03060b';
    ctx.fillRect(-60, -60, W + 120, H + 120);
    R.glow(ctx, 540, 1000, 1000, '#0d2238', 0.9, 'source-over');
    R.glow(ctx, 540, 1000, 700, '#3a0a00', 0.35, 'lighter');
    graticule(ctx, cam, 1);

    // India (official composite boundary).
    const aI = 1 - R.prog(z, 0.38, 0.56);
    if (aI > 0) {
      ctx.save();
      ctx.globalAlpha = aI;
      layerPath(ctx, MD.india, cam);
      const lg = ctx.createLinearGradient(0, 300, 0, 1700);
      lg.addColorStop(0, '#202128');
      lg.addColorStop(1, '#121318');
      ctx.fillStyle = lg;
      ctx.fill();
      ctx.shadowColor = 'rgba(255,212,0,0.9)';
      ctx.shadowBlur = 16;
      ctx.strokeStyle = R.YELLOW;
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    }

    // South India detail.
    const aM = R.prog(z, 0.3, 0.46);
    if (aM > 0) {
      ctx.save();
      ctx.globalAlpha = aM;
      layerPath(ctx, MD.neighbours, cam);
      ctx.fillStyle = '#16171d';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 2;
      ctx.stroke();
      layerPath(ctx, MD.districts, cam);
      ctx.fillStyle = '#221f16';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,212,0,0.28)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Kerala highlight (pulses in the India view so the eye finds it).
    {
      const pulse = 0.5 + 0.5 * Math.sin((t - 3) * 9);
      const fillA = R.lerp(0.55 + 0.25 * pulse, 0.1, R.prog(z, 0.45, 0.75)) * R.prog(t, 3.02, 3.2);
      ctx.save();
      layerPath(ctx, MD.kerala, cam);
      ctx.fillStyle = `rgba(255,190,0,${fillA})`;
      ctx.fill();
      ctx.shadowColor = 'rgba(255,212,0,1)';
      ctx.shadowBlur = 22;
      ctx.strokeStyle = R.YELLOW;
      ctx.lineWidth = R.lerp(2.5, 5, R.prog(z, 0.2, 0.5));
      ctx.lineJoin = 'round';
      ctx.globalAlpha = R.prog(t, 3.02, 3.2);
      ctx.stroke();
      ctx.restore();
    }

    // Ernakulam district.
    const aE = R.prog(z, 0.6, 0.88);
    if (aE > 0) {
      ctx.save();
      layerPath(ctx, MD.ernakulam, cam);
      ctx.fillStyle = `rgba(227,18,11,${0.32 * aE})`;
      ctx.fill();
      ctx.globalAlpha = aE;
      ctx.shadowColor = 'rgba(255,40,0,1)';
      ctx.shadowBlur = 28;
      ctx.strokeStyle = '#ff3a14';
      ctx.lineWidth = 6;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = R.YELLOW;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Place labels.
    {
      const [ix, iy] = project(cam, merc(78.6, 23.2)[0], merc(78.6, 23.2)[1]);
      label(ctx, 'INDIA', ix, iy + 40, 120, (1 - R.prog(z, 0.05, 0.25)) * R.prog(t, 3.05, 3.2) * 0.9, { spacing: 24 });
      const kp = merc(75.15, 9.45);
      const [kx, ky] = project(cam, kp[0], kp[1]);
      const aK = R.prog(z, 0.2, 0.35) * (1 - R.prog(z, 0.62, 0.75));
      label(ctx, 'KERALA', kx, ky, 110, aK, { spacing: 14, color: R.YELLOW });
      const ep = merc(76.56, 10.16);
      const [ex, ey] = project(cam, ep[0], ep[1]);
      label(ctx, 'ERNAKULAM', ex, ey, 64, R.prog(z, 0.82, 0.95) * (1 - R.prog(t, TL.mapText - 0.12, TL.mapText)), { spacing: 10 });
    }

    // Pins.
    const pins = env.cfg.map.pins;
    // Drop Piravom first, then Mulanthuruthy (order from the brief).
    const order = ['piravom', 'mulanthuruthy'];
    for (const pin of pins) {
      const idx = order.indexOf(pin.place);
      const tl = TL.pins[idx < 0 ? 0 : idx];
      if (t < tl - 0.22) continue;
      const wp = MD.places[pin.place];
      const [px, py] = project(cam, wp[0], wp[1]);
      const dp = R.prog(t, tl - 0.22, tl);
      const yOff = -460 * (1 - E.inQuad(dp));
      const u = Math.max(0, t - tl);
      const sx = t >= tl ? 1 + 0.2 * Math.exp(-12 * u) * Math.cos(u * 30) : 0.92;
      const sy = t >= tl ? 1 - 0.24 * Math.exp(-12 * u) * Math.cos(u * 30) : 1.12;
      // Shadow.
      ctx.save();
      ctx.globalAlpha = 0.6 * dp;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(px, py, 34 * (0.4 + 0.6 * dp), 11 * (0.4 + 0.6 * dp), 0, 0, TAU);
      ctx.fill();
      ctx.restore();
      R.ring(ctx, px, py, R.prog(t, tl, tl + 0.7), { squash: 0.38, grow: 190, r0: 18, width: 9 });
      R.ring(ctx, px, py, R.prog(t, tl + 0.15, tl + 0.95), { squash: 0.38, grow: 260, r0: 18, width: 6, color: R.RED_HOT });
      const pulse = R.fract((t - tl) / 1.1);
      if (t > tl + 0.9) R.ring(ctx, px, py, pulse, { squash: 0.38, grow: 200, r0: 18, width: 5, alpha: 0.6 });
      ctx.save();
      ctx.globalAlpha = R.prog(dp, 0, 0.25);
      R.drawPin(ctx, px, py + yOff, 64, { sx, sy });
      ctx.restore();
      pinChip(ctx, px, py, pin, R.prog(t, tl + 0.06, tl + 0.3));
    }

    // Headline.
    const tm = TL.mapText;
    if (t > tm - 0.15) {
      const bandA = R.prog(t, tm - 0.15, tm);
      const bg = ctx.createLinearGradient(0, 0, 0, 760);
      bg.addColorStop(0, `rgba(0,0,0,${0.85 * bandA})`);
      bg.addColorStop(0.7, `rgba(0,0,0,${0.55 * bandA})`);
      bg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(-60, -60, W + 120, 820);
      const shine = R.prog(t, tm + 0.25, tm + 0.8);
      slamDraw(ctx, 540, 380, slam(t, tm, 2.4), () => {
        R.glossyText(ctx, env.cfg.map.headline, 540, 470, 220, { style: 'gold', glow: 'rgba(255,30,0,0.9)', glowBlur: 70, depth: 16, shine: shine < 1 ? shine : null, skew: 0.08 });
      });
      slamDraw(ctx, 540, 560, slam(t, tm + 0.07, 2), () => {
        R.glossyText(ctx, env.cfg.map.subline, 540, 600, 104, { style: 'white', glow: 'rgba(0,0,0,0.9)', glowBlur: 30, depth: 8, spacing: 6, skew: 0.08 });
      });
      impactFx(ctx, t, tm, 540, 420, { flash: 0.35, grow: 500, count: 16, ringGrow: 700 });
    }

    // Attribution required by the map data licence.
    R.text(ctx, 'MAP: DATAMEET (CC BY)', 40, 1530, 22, { family: 'Barlow Condensed', weight: 600, align: 'left', color: 'rgba(255,255,255,0.45)', spacing: 1 });
    R.vignette(ctx, 0.65);
  };

  // =====================================================================
  // Scene 3: brand plates slam in, then the dealer / warranty lines.
  // =====================================================================
  const PLATE = { w: 880, h: 190, ys: [380, 600, 820, 1040] };

  function brandPlate(ctx, t, i, brand, img) {
    const th = TL.brandHits[i];
    if (t < th - 0.14) return;
    const cy = PLATE.ys[i];
    let s;
    let a = 1;
    if (t < th) {
      const p = R.prog(t, th - 0.14, th);
      s = R.lerp(0.2, 1.22, E.inQuad(p));
      a = R.prog(p, 0, 0.4);
    } else {
      s = R.lerp(1.22, 1, E.outBack(R.prog(t, th + 0.04, th + 0.42), 2.2));
    }
    const u = t - th;
    let jx = 0;
    let jy = 0;
    if (u > 0 && u < 0.24) {
      const k = 1 - u / 0.24;
      jx = 16 * k * Math.sin(u * 95);
      jy = 7 * k * Math.cos(u * 80);
    }
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(540 + jx, cy + jy);
    ctx.scale(s, s);
    R.drawPlate(ctx, 0, 0, PLATE.w, PLATE.h, { radius: 34, glowBlur: 40 });
    // Red chevrons.
    ctx.fillStyle = R.RED;
    for (const side of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        const bx = side * (PLATE.w / 2 - 52 - k * 26);
        ctx.beginPath();
        ctx.moveTo(bx - 9, -PLATE.h * 0.3);
        ctx.lineTo(bx + 9, -PLATE.h * 0.3);
        ctx.lineTo(bx + 9 - side * 20, PLATE.h * 0.3);
        ctx.lineTo(bx - 9 - side * 20, PLATE.h * 0.3);
        ctx.closePath();
        ctx.globalAlpha = a * (k === 0 ? 1 : 0.5);
        ctx.fill();
      }
    }
    ctx.globalAlpha = a;
    if (img) {
      const pw = PLATE.w - 220;
      const ph = PLATE.h - 40;
      R.rrect(ctx, -pw / 2, -ph / 2, pw, ph, 18);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      const k = Math.min((pw - 40) / img.width, (ph - 30) / img.height);
      ctx.drawImage(img, (-img.width * k) / 2, (-img.height * k) / 2, img.width * k, img.height * k);
    } else {
      const size = R.fitSize(ctx, brand.name, 120, PLATE.w - 260, { family: 'Anton', spacing: 8 });
      const m = R.measure(ctx, brand.name, size, { spacing: 8 });
      const sh = R.prog(t, 9.45 + i * 0.12, 9.95 + i * 0.12);
      R.glossyText(ctx, brand.name, 4, m.actualBoundingBoxAscent / 2, size, { style: 'white', spacing: 8, depth: 7, shine: sh > 0 && sh < 1 ? sh : null });
    }
    // Impact flash on the plate.
    const fl = 1 - R.prog(t, th, th + 0.16);
    if (t >= th && fl > 0) {
      R.rrect(ctx, -PLATE.w / 2, -PLATE.h / 2, PLATE.w, PLATE.h, 34);
      ctx.fillStyle = `rgba(255,255,255,${0.55 * fl})`;
      ctx.fill();
    }
    ctx.restore();
    if (t >= th) {
      R.burst(ctx, 540, cy, R.prog(t, th, th + 0.35), { count: 16, r0: 200, grow: 380, len: 200, squash: 0.35, thick: 5 });
      R.sweepStreak(ctx, t, th - 0.03, 0.3, cy, i % 2 ? '#ff3a14' : '#ffd400', { len: 800, thick: 8, dir: i % 2 ? -1 : 1 });
    }
  }

  function brandLine(ctx, t, t0, text, y, style, dir) {
    if (t < t0 - 0.14) return;
    const p = R.prog(t, t0 - 0.14, t0);
    const u = Math.max(0, t - t0);
    const off = dir * 760 * (1 - E.outCubic(p)) - dir * 18 * Math.exp(-12 * u) * Math.sin(u * 26);
    const size = 100;
    const m = R.measure(ctx, text, size, { spacing: 4 });
    const iconR = 40;
    const total = iconR * 2 + 26 + m.width;
    const x0 = 540 - total / 2;
    ctx.save();
    ctx.globalAlpha = R.prog(p, 0, 0.5);
    ctx.translate(off, 0);
    if (p < 1) {
      ctx.globalAlpha *= 0.25;
      ctx.translate(dir * 60, 0);
      R.glossyText(ctx, text, x0 + iconR * 2 + 26, y, size, { style, align: 'left', spacing: 4, depth: 7 });
      ctx.translate(-dir * 60, 0);
      ctx.globalAlpha /= 0.25;
    }
    const pop = t >= t0 ? 1 + 0.25 * Math.exp(-10 * u) * Math.cos(u * 20) : 1;
    R.iconCheck(ctx, x0 + iconR, y - m.actualBoundingBoxAscent / 2, iconR, pop);
    const sh = R.prog(t, t0 + 0.2, t0 + 0.7);
    R.glossyText(ctx, text, x0 + iconR * 2 + 26, y, size, { style, align: 'left', spacing: 4, depth: 7, glow: style === 'gold' ? 'rgba(255,30,0,0.8)' : null, glowBlur: 40, shine: sh > 0 && sh < 1 ? sh : null });
    ctx.restore();
  }

  S.brands = function (ctx, t, env) {
    ctx.fillStyle = R.carbonPattern(ctx);
    ctx.fillRect(-60, -60, W + 120, H + 120);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.25)');
    g.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = g;
    ctx.fillRect(-60, -60, W + 120, H + 120);
    R.glow(ctx, 540, 700, 900, '#5a0c00', 0.55, 'lighter');
    R.glow(ctx, 540, 1300, 600, '#4a3500', 0.4, 'lighter');
    ctx.save();
    ctx.translate(540, 960);
    ctx.rotate(-0.42);
    ctx.translate(-540, -960);
    R.speedLines(ctx, t, { dir: 1, count: 28, len: 600, speed: 1800, alpha: 0.18, y0: -300, y1: H + 300, colors: ['#ffd400', '#ffffff', '#ff3a14'], seed: 11 });
    ctx.restore();

    R.embers(ctx, t, { count: 30, alpha: 0.45, speed: 140, seed: 9 });
    env.cfg.brands.forEach((b, i) => brandPlate(ctx, t, i, b, env.assets.brands[i]));
    brandLine(ctx, t, TL.dealerLine, env.cfg.brandLines[0], 1262, 'gold', -1);
    brandLine(ctx, t, TL.warrantyLine, env.cfg.brandLines[1], 1392, 'white', 1);
    if (t >= TL.warrantyLine) {
      // Sparkle with the ding.
      const p = R.prog(t, TL.warrantyLine, TL.warrantyLine + 0.5);
      R.streak(ctx, 540, 1350, 520 * (1 - p) + 60, 6, '#ffffff', 1 - p);
      R.streak(ctx, 540, 1350, 6, 120 * (1 - p) + 10, '#ffffff', 1 - p);
    }
    R.sweepStreak(ctx, t, 10.1, 0.5, 700, '#ffd400', { len: 1000, thick: 9 });
    R.vignette(ctx, 0.7);
  };

  // =====================================================================
  // Scene 4: 15 years counter, trust lines, EMI badge.
  // =====================================================================
  function gauge(ctx, t, years) {
    const cx = 540;
    const cy = 560;
    const r = 300;
    const intro = R.ep(t, 11.0, 11.3, E.outCubic);
    if (intro <= 0) return;
    const a0 = Math.PI * 0.75;
    const sweep = Math.PI * 1.5;
    const val = TL.counterValue(t, years);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = 34;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a0 + sweep * intro);
    ctx.stroke();
    for (let k = 0; k <= 30; k++) {
      const f = k / 30;
      if (f > intro + 1e-6) break;
      const a = a0 + sweep * f;
      const major = k % 6 === 0;
      const r1 = r - 44;
      const r2 = r - (major ? 84 : 64);
      const lit = f * years <= val + 1e-6 && val > 0;
      ctx.strokeStyle = lit ? (f > 0.79 ? '#ff2a14' : R.YELLOW) : 'rgba(255,255,255,0.3)';
      ctx.lineWidth = major ? 7 : 3;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.stroke();
      if (major) {
        R.text(ctx, String(Math.round(f * years)), cx + Math.cos(a) * (r - 108), cy + Math.sin(a) * (r - 108) + 12, 32, {
          family: 'Barlow Condensed',
          weight: 700,
          color: lit ? '#ffffff' : 'rgba(255,255,255,0.45)',
        });
      }
    }
    const f = val / years;
    if (f > 0) {
      const grad = ctx.createConicGradient(a0, cx, cy);
      grad.addColorStop(0, R.YELLOW);
      grad.addColorStop(0.45, R.AMBER);
      grad.addColorStop(0.7, '#ff2a14');
      grad.addColorStop(1, '#ff2a14');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 34;
      ctx.shadowColor = 'rgba(255,110,0,0.9)';
      ctx.shadowBlur = 34;
      ctx.beginPath();
      ctx.arc(cx, cy, r, a0, a0 + sweep * f);
      ctx.stroke();
      ctx.shadowBlur = 0;
      const ha = a0 + sweep * f;
      R.glow(ctx, cx + Math.cos(ha) * r, cy + Math.sin(ha) * r, 70, '#ffffff', 0.9);
    }
    ctx.restore();
    if (t >= TL.yearsPop) {
      const p = R.prog(t, TL.yearsPop, TL.yearsPop + 0.5);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - p)})`;
      ctx.lineWidth = 40 * (1 - p);
      ctx.beginPath();
      ctx.arc(cx, cy, r, a0, a0 + sweep);
      ctx.stroke();
      ctx.restore();
    }
    const n = Math.min(years, Math.floor(val + 1e-6));
    const u = t - TL.yearsPop;
    const pop = u >= 0 ? 1 + 0.16 * Math.exp(-9 * u) * Math.cos(u * 24) : 1;
    const size = 290;
    const m = R.measure(ctx, String(years), size);
    const sh = R.prog(t, TL.yearsPop + 0.2, TL.yearsPop + 0.7);
    withScale(ctx, cx, cy, pop * E.outBack(intro), () => {
      R.glossyText(ctx, String(n), cx, cy + m.actualBoundingBoxAscent / 2 + 6, size, {
        style: 'gold',
        glow: 'rgba(255,30,0,0.9)',
        glowBlur: 80,
        depth: 22,
        shine: sh > 0 && sh < 1 ? sh : null,
      });
    });
  }

  S.trust = function (ctx, t, env) {
    const cfg = env.cfg.trust;
    R.background(ctx, t, { haze: '#420a00', hazeY: 560, hazeR: 850 });
    const counting = 1 - R.prog(t, 12.15, 12.8);
    R.radialLines(ctx, t, 540, 560, { alpha: 0.12 + 0.3 * counting, colors: ['#ffd400', '#ffffff', '#ff2a14'], count: 56, inner: 360, speed: 1400 + 1400 * counting, len: 220 });
    R.embers(ctx, t, { count: 30, alpha: 0.45, speed: 140, seed: 13 });
    gauge(ctx, t, cfg.years);
    impactFx(ctx, t, TL.yearsPop, 540, 560, { grow: 650, r0: 320, count: 24, ringGrow: 600, flash: 0.25 });

    // YEARS sits in the opening at the bottom of the gauge.
    const yp = R.popScale(t, TL.yearsPop, 0.35, 2.6);
    if (yp > 0) {
      withScale(ctx, 540, 840, yp, () => {
        R.glossyText(ctx, cfg.yearsLabel, 540, 880, 124, { style: 'white', spacing: 14, depth: 9, glow: 'rgba(0,0,0,0.8)', glowBlur: 30 });
      });
    }

    const lines = [
      { text: cfg.lines[0], y: 1068, size: 106, style: 'white', t0: TL.trustLines[0] },
      { text: cfg.lines[1], y: 1250, size: 138, style: 'gold', t0: TL.trustLines[1] },
    ];
    for (const L of lines) {
      const sp = R.popScale(t, L.t0, 0.32, 2.4);
      if (sp <= 0) continue;
      const m = R.measure(ctx, L.text, L.size, { spacing: 4 });
      R.drawSlash(ctx, 540 - m.width / 2 - 30, L.y + 34, m.width + 60, 32, R.ep(t, L.t0 + 0.04, L.t0 + 0.26, E.outCubic));
      const sh = R.prog(t, L.t0 + 0.3, L.t0 + 0.8);
      withScale(ctx, 540, L.y - L.size * 0.35, sp, () => {
        R.glossyText(ctx, L.text, 540, L.y, L.size, {
          style: L.style,
          spacing: 4,
          depth: 9,
          glow: L.style === 'gold' ? 'rgba(255,30,0,0.85)' : 'rgba(0,0,0,0.9)',
          glowBlur: 40,
          shine: sh > 0 && sh < 1 ? sh : null,
          skew: 0.06,
        });
      });
    }

    // Bajaj Finance EMI badge.
    const bp = R.popScale(t, TL.badgePop, 0.36, 2.2);
    if (bp > 0) {
      const bw = 600;
      const bh = 124;
      const by = 1400;
      withScale(ctx, 540, by, bp, () => {
        ctx.save();
        ctx.shadowColor = 'rgba(255,190,0,0.6)';
        ctx.shadowBlur = 40;
        R.rrect(ctx, 540 - bw / 2, by - bh / 2, bw, bh, bh / 2);
        const g = ctx.createLinearGradient(0, by - bh / 2, 0, by + bh / 2);
        g.addColorStop(0, '#fff27a');
        g.addColorStop(0.5, R.YELLOW);
        g.addColorStop(1, '#ffaa00');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#1a1000';
        ctx.stroke();
        // Card icon.
        const ix = 540 - bw / 2 + 74;
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(ix, by, 44, 0, TAU);
        ctx.fill();
        R.rrect(ctx, ix - 26, by - 17, 52, 34, 6);
        ctx.fillStyle = R.YELLOW;
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.fillRect(ix - 26, by - 9, 52, 7);
        ctx.fillRect(ix - 18, by + 6, 14, 4);
        R.text(ctx, cfg.badgeTop, 540 + 40, by - 14, 36, { family: 'Barlow Condensed', weight: 800, spacing: 5, color: '#3a2200' });
        R.text(ctx, cfg.badge, 540 + 40, by + 44, 56, { family: 'Anton', spacing: 3, color: '#111111' });
        // Shine.
        const sh = R.prog(t, TL.badgePop + 0.35, TL.badgePop + 0.9);
        if (sh > 0 && sh < 1) {
          ctx.save();
          R.rrect(ctx, 540 - bw / 2, by - bh / 2, bw, bh, bh / 2);
          ctx.clip();
          const sx = 540 - bw / 2 - 100 + sh * (bw + 200);
          const sg = ctx.createLinearGradient(sx - 60, 0, sx + 60, 0);
          sg.addColorStop(0, 'rgba(255,255,255,0)');
          sg.addColorStop(0.5, 'rgba(255,255,255,0.75)');
          sg.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = sg;
          ctx.fillRect(sx - 60, by - bh / 2, 120, bh);
          ctx.restore();
        }
        ctx.restore();
      });
    }
    R.sweepStreak(ctx, t, 14.1, 0.5, 1250, '#ff3a14', { len: 900, thick: 8 });
    R.vignette(ctx, 0.7);
  };

  // =====================================================================
  // Scene 5: accessories, quick flash cuts.
  // =====================================================================
  function brackets(ctx, t, f) {
    const k = f != null ? 1 + 0.08 * (1 - E.outCubic(R.prog(t, f, f + 0.2))) : 1;
    const x0 = 100;
    const y0 = 560;
    const x1 = 980;
    const y1 = 1230;
    const cx = 540;
    const cy = (y0 + y1) / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(k, k);
    ctx.translate(-cx, -cy);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'square';
    const L = 70;
    for (const [x, y, sx, sy] of [
      [x0, y0, 1, 1],
      [x1, y0, -1, 1],
      [x0, y1, 1, -1],
      [x1, y1, -1, -1],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x, y + sy * L);
      ctx.lineTo(x, y);
      ctx.lineTo(x + sx * L, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#ff2a14';
    ctx.beginPath();
    ctx.arc(x0 + 40, y0 + 40, 10, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function itemTag(ctx, t, f, text) {
    const p = R.ep(t, f, f + 0.16, E.outCubic);
    const size = 72;
    const m = R.measure(ctx, text, size, { spacing: 6 });
    const w = m.width + 110;
    const h = 108;
    const y = 1330;
    const x = 540 - w / 2 - (1 - p) * 700;
    ctx.save();
    ctx.globalAlpha = p;
    ctx.beginPath();
    ctx.moveTo(x + 30, y - h / 2);
    ctx.lineTo(x + w, y - h / 2);
    ctx.lineTo(x + w - 30, y + h / 2);
    ctx.lineTo(x, y + h / 2);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
    g.addColorStop(0, '#ff4a2a');
    g.addColorStop(0.5, R.RED);
    g.addColorStop(1, '#990800');
    ctx.fillStyle = g;
    ctx.shadowColor = 'rgba(255,30,0,0.7)';
    ctx.shadowBlur = 30;
    ctx.fill();
    ctx.shadowBlur = 0;
    R.text(ctx, text, x + w / 2, y + m.actualBoundingBoxAscent / 2, size, { family: 'Anton', spacing: 6, color: '#ffffff' });
    ctx.restore();
  }

  S.accessories = function (ctx, t, env) {
    const cfg = env.cfg.accessories;
    R.background(ctx, t, { haze: '#300a00', hazeY: 900, hazeR: 900 });
    // Spotlight.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const sg = ctx.createLinearGradient(0, 0, 0, 1300);
    sg.addColorStop(0, 'rgba(255,212,0,0.0)');
    sg.addColorStop(0.5, 'rgba(255,212,0,0.07)');
    sg.addColorStop(1, 'rgba(255,212,0,0.0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(440, -50);
    ctx.lineTo(640, -50);
    ctx.lineTo(1000, 1300);
    ctx.lineTo(80, 1300);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    R.speedLines(ctx, t, { dir: -1, count: 30, len: 500, speed: 3000, alpha: 0.2, y0: 560, y1: 1240, colors: ['#ffffff', '#ffd400'], seed: 21 });

    const fl = TL.flashes;
    let k = -1;
    for (let i = 0; i < fl.length; i++) if (t >= fl[i]) k = i;
    if (k >= 0) {
      const f = fl[k];
      const u = t - f;
      const s = 1.14 - 0.14 * E.outCubic(R.prog(u, 0, 0.28)) + 0.04 * u;
      ctx.save();
      ctx.translate(540, 900);
      ctx.scale(s, s);
      ctx.rotate(0.03 * (1 - E.outCubic(R.prog(u, 0, 0.3))) * (k % 2 ? 1 : -1));
      ctx.translate(-540, -900);
      if (k === 0) R.drawHeadUnit(ctx, 540, 900, 880, t);
      if (k === 1) R.drawSubwoofer(ctx, 540, 895, 262, t, Math.pow(Math.max(0, Math.sin(u * TAU * 4.5)), 2));
      if (k === 2) {
        const on = u < 0.04 ? 0.5 : u < 0.07 ? 0.05 : 1;
        R.drawHeadlight(ctx, 620, 900, 720, t, on);
      }
      if (k === 3) {
        R.drawSpeaker(ctx, 315, 900, 182, t, Math.pow(Math.max(0, Math.sin(u * TAU * 5)), 2));
        R.drawSpeaker(ctx, 765, 900, 182, t, Math.pow(Math.max(0, Math.sin(u * TAU * 5 + 1.6)), 2));
      }
      ctx.restore();
      itemTag(ctx, t, f, cfg.items[k]);
    } else {
      R.glow(ctx, 540, 900, 380, '#ffd400', 0.18);
    }
    brackets(ctx, t, k >= 0 ? fl[k] : null);

    // Title stays up for the whole scene.
    const tp = R.ep(t, 14.8, 15.1, E.outCubic);
    const bump = k >= 0 ? 1 + 0.05 * Math.exp(-14 * (t - fl[k])) : 1;
    const sh = R.prog(t, 15.5, 16.1);
    withScale(ctx, 540, 400, bump, () => {
      ctx.save();
      ctx.globalAlpha = tp;
      ctx.translate(0, -60 * (1 - tp));
      R.glossyText(ctx, cfg.title, 540, 380, 124, { style: 'gold', glow: 'rgba(255,30,0,0.85)', glowBlur: 50, depth: 10, spacing: 2, skew: 0.08, shine: sh > 0 && sh < 1 ? sh : null });
      R.glossyText(ctx, cfg.subtitle, 540, 492, 90, { style: 'white', depth: 7, spacing: 4, skew: 0.08, glow: 'rgba(0,0,0,0.9)', glowBlur: 30 });
      ctx.restore();
    });

    if (k >= 0) R.flash(ctx, 0.92 * (1 - R.prog(t, fl[k], fl[k] + 0.11)));
    R.vignette(ctx, 0.7);
  };

  // =====================================================================
  // Scene 6: logo, contact cards, VISIT TODAY.
  // =====================================================================
  function contactLayout(n) {
    if (n === 2) return { h: 224, tops: [680, 930], cta: 1350 };
    return { h: 198, tops: [640, 858, 1076], cta: 1446 };
  }

  function contactCard(ctx, t, i, c, top, h, tland, pulseK) {
    const p = R.prog(t, tland - 0.24, tland);
    if (p <= 0) return;
    const u = Math.max(0, t - tland);
    const off = (1 - E.outCubic(p)) * 1100 - 22 * Math.exp(-12 * u) * Math.sin(u * 28) * (t >= tland ? 1 : 0);
    const x0 = 64;
    const w = 952;
    const cy = top + h / 2;
    ctx.save();
    ctx.translate(off, 0);
    if (p < 1) {
      for (let k = 1; k <= 3; k++) {
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.translate(k * 70 * (1 - p), 0);
        R.drawPlate(ctx, x0 + w / 2, cy, w, h, { radius: 28, glowBlur: 0 });
        ctx.restore();
      }
    }
    R.drawPlate(ctx, x0 + w / 2, cy, w, h, { radius: 28, glowBlur: 30 + 30 * pulseK });
    ctx.fillStyle = R.RED;
    R.rrect(ctx, x0 + 14, top + 22, 12, h - 44, 6);
    ctx.fill();
    // Icon.
    const ix = x0 + 112;
    const ir = Math.min(66, h * 0.36);
    ctx.save();
    ctx.shadowColor = 'rgba(255,212,0,0.8)';
    ctx.shadowBlur = 24;
    ctx.fillStyle = R.YELLOW;
    ctx.beginPath();
    ctx.arc(ix, cy, ir, 0, TAU);
    ctx.fill();
    ctx.restore();
    if (c.icon === 'tyre') R.iconTyre(ctx, ix, cy, ir * 0.82, t * 2.5);
    else R.iconSpeaker(ctx, ix, cy, ir * 0.78, '#111111', t);
    // Text.
    const tx = x0 + 212;
    const maxW = w - 212 - 40;
    const ls = R.fitSize(ctx, c.label, h > 210 ? 44 : 40, maxW, { family: 'Barlow Condensed', weight: 800, spacing: 2 });
    R.text(ctx, c.label, tx, top + (h > 210 ? 66 : 58), ls, { family: 'Barlow Condensed', weight: 800, spacing: 2, align: 'left', color: '#d6d6dc' });
    const num = R.formatPhone(c.phone);
    const ns = h > 210 ? 112 : 100;
    const s = 1 + 0.05 * pulseK;
    const ny = top + h - (h > 210 ? 38 : 30);
    withScale(ctx, tx, ny - ns * 0.36, s, () => {
      R.glossyText(ctx, num, tx, ny, ns, {
        style: 'gold',
        align: 'left',
        spacing: 3,
        depth: 6,
        glow: pulseK > 0 ? `rgba(255,140,0,${0.9 * pulseK})` : null,
        glowBlur: 36,
      });
    });
    ctx.restore();
  }

  S.contact = function (ctx, t, env) {
    const cfg = env.cfg;
    ctx.fillStyle = '#000';
    ctx.fillRect(-60, -60, W + 120, H + 120);
    const intro = R.prog(t, 17.0, 17.5);
    const breathe = 0.5 + 0.5 * Math.sin(t * 3.2);
    R.glow(ctx, 540, 450, 150 + 520 * E.outCubic(intro), '#ffd400', (0.5 + 0.12 * breathe) * intro);
    R.glow(ctx, 540, 450, 900, '#5a1400', 0.5 * intro, 'lighter');
    // Big faint tyre turning in the background.
    ctx.save();
    ctx.globalAlpha = 0.045 * intro;
    R.drawTyre(ctx, 540, 1000, 760, t * 0.35, { noText: true });
    ctx.restore();
    R.radialLines(ctx, t, 540, 450, { alpha: 0.18 * intro, colors: ['#ffd400', '#ffffff'], count: 40, inner: 300, speed: 900, len: 200 });
    R.embers(ctx, t, { count: 40, alpha: 0.6 * intro, speed: 150, seed: 17 });

    // Logo.
    const lp = R.prog(t, TL.logoIn, TL.logoIn + 0.42);
    if (lp > 0) {
      const s = R.lerp(0.25, 1, E.outBack(lp, 1.8));
      ctx.save();
      ctx.globalAlpha = R.clamp(lp * 2.5);
      withScale(ctx, 540, 470, s, () => {
        const img = env.assets.logo;
        if (img) {
          const k = Math.min(820 / img.width, 300 / img.height);
          ctx.drawImage(img, 540 - (img.width * k) / 2, 470 - (img.height * k) / 2, img.width * k, img.height * k);
        } else {
          const sh = R.prog(t, 17.6, 18.2);
          R.glossyText(ctx, cfg.logo.word, 540, 520, 250, { style: 'gold', glow: 'rgba(255,40,0,0.95)', glowBlur: 80, depth: 18, skew: 0.1, shine: sh > 0 && sh < 1 ? sh : null });
          const m = R.measure(ctx, cfg.logo.tagline, 52, { family: 'Barlow Condensed', weight: 800, italic: true, spacing: 6 });
          R.text(ctx, cfg.logo.tagline, 540, 600, 52, { family: 'Barlow Condensed', weight: 800, italic: true, spacing: 6, color: '#ffffff', shadow: 'rgba(0,0,0,0.9)', shadowBlur: 12 });
          ctx.fillStyle = R.RED;
          ctx.fillRect(540 - m.width / 2 - 90, 582, 64, 8);
          ctx.fillRect(540 + m.width / 2 + 26, 582, 64, 8);
        }
      });
      ctx.restore();
    }

    // Cards.
    const cards = env.contacts;
    const lay = contactLayout(cards.length);
    const times = TL.cardTimes(cards.length);
    cards.forEach((c, i) => {
      const pk = t > TL.cta + 0.15 ? Math.max(0, Math.sin(TAU * 1.4 * (t - TL.cta - 0.15) - i * 0.8)) : 0;
      contactCard(ctx, t, i, c, lay.tops[i], lay.h, times[i], pk);
    });

    // VISIT TODAY!
    const st = slam(t, TL.cta, 2.8);
    if (st) {
      const br = t > TL.cta + 0.3 ? 1 + 0.035 * Math.sin((t - TL.cta) * 6) : 1;
      const sh = R.prog(t, TL.cta + 0.6, TL.cta + 1.1);
      const sh2 = R.prog(t, 21.0, 21.5);
      slamDraw(ctx, 540, lay.cta - 60, { ...st, s: st.s * br }, () =>
        R.glossyText(ctx, cfg.cta, 540, lay.cta, 156, {
          style: 'gold',
          glow: 'rgba(255,30,0,0.95)',
          glowBlur: 80,
          depth: 14,
          spacing: 4,
          skew: 0.1,
          shine: sh > 0 && sh < 1 ? sh : sh2 > 0 && sh2 < 1 ? sh2 : null,
        }),
      );
      impactFx(ctx, t, TL.cta, 540, lay.cta - 60, { flash: 0.5, grow: 800, count: 26, ringGrow: 1000, len: 460 });
    }
    R.sweepStreak(ctx, t, 20.25, 0.6, lay.tops[0] + lay.h / 2, '#ffd400', { len: 1000, thick: 8 });
    R.sweepStreak(ctx, t, 20.95, 0.6, lay.cta - 50, '#ff5a00', { len: 1000, thick: 8, dir: -1 });
    R.vignette(ctx, 0.6);
  };
})();
