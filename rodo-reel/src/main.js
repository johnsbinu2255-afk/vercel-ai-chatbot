// Compositor: picks the scene for time t, applies the transition at each cut,
// then the impact camera shake. Exposes window.REEL for the renderer and a preview player.
(function () {
  const R = window.R;
  const TL = window.TL;
  const CFG = window.REEL_CONFIG;
  const { W, H } = R;
  const E = R.ease;

  const params = new URLSearchParams(location.search);
  const variant = params.get('contacts') === 'merged' ? 'merged' : 'three';
  const env = { cfg: CFG, variant, contacts: CFG.contacts[variant], assets: { brands: [], logo: null } };
  const impacts = TL.impacts(env.contacts.length);

  const canvas = document.getElementById('reel');
  canvas.width = W;
  canvas.height = H;
  const out = canvas.getContext('2d');

  function sceneIndexAt(t) {
    for (let i = TL.scenes.length - 1; i >= 0; i--) if (t >= TL.scenes[i].start) return i;
    return 0;
  }

  function drawScene(i, t, name) {
    const buf = R.buffer(name);
    const ctx = buf.getContext('2d');
    ctx.save();
    R.scenes[TL.scenes[i].id](ctx, t, env);
    ctx.restore();
    return buf;
  }

  // Progressive averaging of scaled copies = radial zoom blur.
  function zoomBlur(ctx, img, fx, fy, scale, amount, rot = 0, alpha = 1) {
    const n = amount > 0.004 ? 8 : 1;
    for (let i = 0; i < n; i++) {
      const s = scale * (1 + (amount * i) / Math.max(1, n - 1));
      ctx.save();
      ctx.globalAlpha = alpha / (i + 1);
      ctx.translate(fx, fy);
      ctx.rotate(rot);
      ctx.scale(s, s);
      ctx.translate(-fx, -fy);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    }
  }

  // Horizontal motion blur.
  function dirBlur(ctx, img, dx, spread) {
    const n = spread > 2 ? 10 : 1;
    for (let i = 0; i < n; i++) {
      const o = n > 1 ? dx - spread / 2 + (spread * i) / (n - 1) : dx;
      ctx.save();
      ctx.globalAlpha = 1 / (i + 1);
      ctx.drawImage(img, o, 0);
      ctx.restore();
    }
  }

  function glitch(ctx, img, amt, seed) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const d = Math.round(4 + amt * 38);
    const red = R.buffer('glitchR');
    const rc = red.getContext('2d');
    rc.drawImage(img, 0, 0);
    rc.globalCompositeOperation = 'multiply';
    rc.fillStyle = '#ff0000';
    rc.fillRect(0, 0, W, H);
    const cyan = R.buffer('glitchC');
    const cc = cyan.getContext('2d');
    cc.drawImage(img, 0, 0);
    cc.globalCompositeOperation = 'multiply';
    cc.fillStyle = '#00ffff';
    cc.fillRect(0, 0, W, H);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(red, -d, 0);
    ctx.drawImage(cyan, d, 0);
    ctx.restore();
    const n = Math.round(3 + amt * 16);
    for (let i = 0; i < n; i++) {
      const y = Math.floor(R.rnd(seed * 13.1 + i * 7.3) * H);
      const h = Math.floor(8 + R.rnd(seed * 5.7 + i * 3.1) * 160 * amt);
      const dx = (R.rnd(seed * 2.9 + i * 11.7) - 0.5) * 2 * 190 * amt;
      ctx.drawImage(img, 0, y, W, h, dx, y, W, h);
    }
    const cols = ['rgba(255,212,0,0.6)', 'rgba(255,40,20,0.6)', 'rgba(255,255,255,0.55)', 'rgba(0,255,255,0.35)'];
    const nb = Math.round(amt * 9);
    for (let i = 0; i < nb; i++) {
      ctx.fillStyle = cols[i % 4];
      ctx.fillRect(
        R.rnd(seed * 3.3 + i) * W - 100,
        R.rnd(seed * 4.4 + i * 2) * H,
        80 + R.rnd(seed + i * 5) * 460,
        6 + R.rnd(seed * 7 + i) * 44,
      );
    }
    ctx.fillStyle = `rgba(0,0,0,${0.28 * amt})`;
    for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 2);
  }

  // A giant tyre rolls across; the new scene is revealed behind it.
  const WIPE_R = 1030;
  function tyreWipe(ctx, A, B, t, cut) {
    const t0 = cut.t - cut.out;
    const t1 = cut.t + cut.in;
    const p = R.prog(t, t0, t1);
    const X = R.lerp(-WIPE_R - 60, W + WIPE_R + 60, p);
    ctx.drawImage(B, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(X, -10, W + 20 - X, H + 20);
    ctx.clip();
    ctx.drawImage(A, 0, 0);
    ctx.restore();
    if (X < -WIPE_R - 40 || X > W + WIPE_R + 40) return;
    const v = (W + 2 * WIPE_R + 120) / (t1 - t0);
    const size = 2 * WIPE_R + 40;
    const spr = R.buffer('wipeTyre', size, size);
    R.drawTyre(spr.getContext('2d'), size / 2, size / 2, WIPE_R, X / WIPE_R, { blur: v / WIPE_R / 30 });
    const blurPx = (v / 30) * 0.8;
    const n = 6;
    for (let i = 0; i < n; i++) {
      ctx.save();
      ctx.globalAlpha = 1 / (i + 1);
      ctx.drawImage(spr, X - size / 2 - (blurPx * i) / (n - 1), H / 2 - size / 2);
      ctx.restore();
    }
    R.speedLines(ctx, t, { dir: 1, count: 30, len: 700, speed: 4000, alpha: 0.5, colors: ['#ffd400', '#ffffff', '#ff3a14'], seed: 31 });
  }

  // Everything shrinks away into the glow where the logo appears.
  const LOGO_FOCUS = [540, 470];
  function zoomOut(ctx, A, t, cut) {
    const p = R.prog(t, cut.t - cut.out, cut.t);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const s = 1 - 0.95 * E.inCubic(p);
    const alpha = 1 - E.inQuad(R.prog(p, 0.55, 1));
    // Move the frame centre onto the logo position while shrinking.
    ctx.save();
    ctx.translate((LOGO_FOCUS[0] - W / 2) * E.inQuad(p), (LOGO_FOCUS[1] - H / 2) * E.inQuad(p));
    zoomBlur(ctx, A, W / 2, H / 2, s, 0.3 * p, -0.35 * E.inQuad(p), alpha);
    ctx.restore();
    R.glow(ctx, LOGO_FOCUS[0], LOGO_FOCUS[1], 80 + 420 * E.inQuad(p), '#ffd400', 0.9 * E.inQuad(p));
  }

  function composite(t, c) {
    const cut = TL.cuts.find((k) => t >= k.t - k.out && t < k.t + k.in);
    if (!cut) {
      c.drawImage(drawScene(sceneIndexAt(t), t, 'A'), 0, 0);
      return;
    }
    const ia = sceneIndexAt(cut.t - 1e-4);
    const ib = ia + 1;
    const before = t < cut.t;
    const p = R.prog(t, cut.t - cut.out, cut.t);
    const q = R.prog(t, cut.t, cut.t + cut.in);
    const seed = Math.round(t * TL.fps);
    switch (cut.type) {
      case 'zoomPunch':
        if (before) {
          zoomBlur(c, drawScene(ia, t, 'A'), 540, 700, 1 + 1.4 * E.inCubic(p), 0.24 * p);
          R.flash(c, 0.9 * E.inQuad(p));
        } else {
          zoomBlur(c, drawScene(ib, t, 'B'), 540, 980, 1 + 0.6 * (1 - E.outCubic(q)), 0.2 * (1 - q));
          R.flash(c, 0.9 * Math.pow(1 - q, 2));
        }
        break;
      case 'whip': {
        // One continuous pan: the old scene slides out left as the new one follows it in.
        const u = R.prog(t, cut.t - cut.out, cut.t + cut.in);
        const off = -W * E.inOutCubic(u);
        const speed = Math.abs(-W * (E.inOutCubic(Math.min(1, u + 0.01)) - E.inOutCubic(Math.max(0, u - 0.01))) / 0.02);
        const spread = Math.min(320, (0.9 * speed) / (cut.out + cut.in) / TL.fps);
        c.fillStyle = '#000';
        c.fillRect(0, 0, W, H);
        dirBlur(c, drawScene(ia, t, 'A'), off, spread);
        c.save();
        c.beginPath();
        c.rect(off + W - spread / 2, 0, W * 2, H);
        c.clip();
        dirBlur(c, drawScene(ib, t, 'B'), off + W, spread);
        c.restore();
        break;
      }
      case 'glitch':
        if (before) {
          const useB = p > 0.55 && R.rnd(seed * 1.7) < 0.35;
          glitch(c, useB ? drawScene(ib, t, 'B') : drawScene(ia, t, 'A'), E.inQuad(p), seed);
        } else {
          const useA = q < 0.35 && R.rnd(seed * 2.3) < 0.3;
          glitch(c, useA ? drawScene(ia, t, 'A') : drawScene(ib, t, 'B'), Math.pow(1 - q, 2), seed);
        }
        break;
      case 'tyreWipe':
        tyreWipe(c, drawScene(ia, t, 'A'), drawScene(ib, t, 'B'), t, cut);
        break;
      case 'zoomOut':
        if (before) zoomOut(c, drawScene(ia, t, 'A'), t, cut);
        else c.drawImage(drawScene(ib, t, 'B'), 0, 0);
        break;
      default:
        c.drawImage(drawScene(before ? ia : ib, t, 'A'), 0, 0);
    }
  }

  function renderFrame(t) {
    t = R.clamp(t, 0, TL.duration - 1e-6);
    const comp = R.buffer('comp');
    composite(t, comp.getContext('2d'));
    const sk = R.shake(t, impacts);
    const mag = Math.abs(sk.dx) + Math.abs(sk.dy);
    const s = mag > 0.01 ? 1 + (mag * 2.4) / W + 0.004 : 1;
    out.save();
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.fillStyle = '#000';
    out.fillRect(0, 0, W, H);
    out.translate(W / 2 + sk.dx, H / 2 + sk.dy);
    out.rotate(sk.rot);
    out.scale(s, s);
    out.translate(-W / 2, -H / 2);
    out.drawImage(comp, 0, 0);
    out.restore();
  }

  function loadImage(src) {
    if (!src) return Promise.resolve(null);
    return new Promise((resolve) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = src;
    });
  }

  const ready = (async () => {
    const faces = ['100px Anton', '600 40px "Barlow Condensed"', '700 40px "Barlow Condensed"', '800 40px "Barlow Condensed"', 'italic 800 40px "Barlow Condensed"'];
    await Promise.all(faces.map((f) => document.fonts.load(f)));
    await document.fonts.ready;
    if (params.get('logos') !== '0') {
      env.assets.brands = await Promise.all(CFG.brands.map((b) => loadImage(b.image)));
      env.assets.logo = await loadImage(CFG.logo.image);
    }
    renderFrame(Number(params.get('t') || 0));
    return {
      variant,
      contacts: env.contacts.length,
      brandLogos: env.assets.brands.map((b) => !!b),
      logo: !!env.assets.logo,
    };
  })();

  function renderAudio() {
    return R.renderAudio(TL.sfx(env.contacts.length, CFG.trust.years), TL.duration);
  }

  window.REEL = {
    ready,
    duration: TL.duration,
    fps: TL.fps,
    renderFrame,
    frame(t, type = 'image/png', quality) {
      renderFrame(t);
      return canvas.toDataURL(type, quality);
    },
    async audioWavBase64() {
      return R.wavBase64(await renderAudio());
    },
  };

  // ---------- preview player ----------
  if (params.get('render') === '1') {
    document.body.classList.add('render');
    return;
  }
  const playBtn = document.getElementById('play');
  const scrub = document.getElementById('scrub');
  const timeEl = document.getElementById('time');
  const variantSel = document.getElementById('variant');
  variantSel.value = variant;
  variantSel.addEventListener('change', () => {
    const u = new URL(location.href);
    u.searchParams.set('contacts', variantSel.value);
    location.href = u.toString();
  });
  scrub.max = String(TL.duration);
  let audioCtx = null;
  let audioBuf = null;
  let source = null;
  let playing = false;
  let startAt = 0;
  let pos = 0;
  const show = (t) => {
    renderFrame(t);
    scrub.value = String(t);
    timeEl.textContent = t.toFixed(2) + 's';
  };
  scrub.addEventListener('input', () => {
    pos = Number(scrub.value);
    if (playing) stop();
    show(pos);
  });
  function stop() {
    playing = false;
    playBtn.textContent = 'Play';
    if (source) source.stop();
    source = null;
  }
  async function play() {
    if (!audioCtx) audioCtx = new AudioContext({ sampleRate: 48000 });
    playBtn.textContent = '…';
    if (!audioBuf) audioBuf = await renderAudio();
    if (pos >= TL.duration - 0.05) pos = 0;
    source = audioCtx.createBufferSource();
    source.buffer = audioBuf;
    source.connect(audioCtx.destination);
    startAt = audioCtx.currentTime - pos;
    source.start(0, pos);
    playing = true;
    playBtn.textContent = 'Pause';
    const tick = () => {
      if (!playing) return;
      pos = audioCtx.currentTime - startAt;
      if (pos >= TL.duration) {
        pos = TL.duration;
        stop();
      }
      show(Math.min(pos, TL.duration - 1e-3));
      if (playing) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  playBtn.addEventListener('click', () => (playing ? stop() : play()));
  ready.then(() => show(pos));
})();
