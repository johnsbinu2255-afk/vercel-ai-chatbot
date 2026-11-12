import * as THREE from 'three';

// ---------- timing helpers ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const ease = {
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  out: (x) => 1 - Math.pow(1 - x, 3),
  outQuint: (x) => 1 - Math.pow(1 - x, 5),
  in: (x) => x * x * x,
  outBack: (x) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  smooth: (x) => x * x * (3 - 2 * x),
};
// eased progress between a and b
export const ep = (t, a, b, fn = ease.inOut) => fn(prog(t, a, b));
// 0 -> 1 -> 0 window with eased edges
export const win = (t, a, b, fade = 0.3) => ease.smooth(prog(t, a, a + fade)) * (1 - ease.smooth(prog(t, b - fade, b)));

// deterministic pseudo random
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- geometry ----------
/**
 * Lathe with automatic sharp edges. `pts` is a list of [r, y] walked
 * counter-clockwise around the solid cross-section (outward normal on the right).
 */
export function lathe(pts, { segs = 144, phiStart = 0, phiLength = Math.PI * 2, smoothDeg = 32 } = {}) {
  const n = pts.length;
  const segN = [];
  for (let i = 0; i < n - 1; i++) {
    const dr = pts[i + 1][0] - pts[i][0];
    const dy = pts[i + 1][1] - pts[i][1];
    const l = Math.hypot(dr, dy) || 1;
    segN.push([dy / l, -dr / l]);
  }
  const cosT = Math.cos((smoothDeg * Math.PI) / 180);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const norm = (a) => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; };
  const closed = Math.hypot(pts[0][0] - pts[n - 1][0], pts[0][1] - pts[n - 1][1]) < 1e-6;
  // per segment: start normal, end normal
  const nS = [], nE = [];
  for (let i = 0; i < n - 1; i++) {
    let prev = i > 0 ? segN[i - 1] : closed ? segN[n - 2] : null;
    let next = i < n - 2 ? segN[i + 1] : closed ? segN[0] : null;
    nS.push(prev && dot(prev, segN[i]) > cosT ? norm([prev[0] + segN[i][0], prev[1] + segN[i][1]]) : segN[i]);
    nE.push(next && dot(next, segN[i]) > cosT ? norm([next[0] + segN[i][0], next[1] + segN[i][1]]) : segN[i]);
  }
  let total = 0; const cum = [0];
  for (let i = 0; i < n - 1; i++) { total += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); cum.push(total); }
  const pos = [], nor = [], uv = [], idx = [];
  for (let i = 0; i < n - 1; i++) {
    const base = pos.length / 3;
    for (let j = 0; j <= segs; j++) {
      const phi = phiStart + (j / segs) * phiLength;
      const c = Math.cos(phi), s = Math.sin(phi);
      for (const [p, nn, v] of [[pts[i], nS[i], cum[i] / total], [pts[i + 1], nE[i], cum[i + 1] / total]]) {
        pos.push(p[0] * c, p[1], p[0] * s);
        nor.push(nn[0] * c, nn[1], nn[0] * s);
        uv.push(j / segs, v);
      }
    }
    for (let j = 0; j < segs; j++) {
      const a = base + j * 2, b = a + 1, c2 = a + 2, d = a + 3;
      // winding chosen so the geometric normal agrees with the supplied normal
      idx.push(a, c2, b, b, c2, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  fixWinding(g);
  return g;
}

// Make triangle winding agree with vertex normals.
export function fixWinding(g) {
  const p = g.attributes.position, nn = g.attributes.normal, ix = g.index.array;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), fn = new THREE.Vector3(), vn = new THREE.Vector3();
  for (let i = 0; i < ix.length; i += 3) {
    a.fromBufferAttribute(p, ix[i]); b.fromBufferAttribute(p, ix[i + 1]); c.fromBufferAttribute(p, ix[i + 2]);
    fn.subVectors(b, a).cross(c.clone().sub(a));
    vn.fromBufferAttribute(nn, ix[i]).add(new THREE.Vector3().fromBufferAttribute(nn, ix[i + 1])).add(new THREE.Vector3().fromBufferAttribute(nn, ix[i + 2]));
    if (fn.dot(vn) < 0) { const tmp = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = tmp; }
  }
  g.index.needsUpdate = true;
}

// planar UVs from x/z (for woven cone textures)
export function planarUV(g, scale = 1) {
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * scale, p.getZ(i) * scale);
  uv.needsUpdate = true;
  return g;
}

export function arc(cx, cy, r, a0, a1, steps) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const a = lerp(a0, a1, i / steps);
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

// ---------- procedural textures ----------
function canvasTex(w, h, draw, { repeat = [1, 1], srgb = false } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function weaveTextures(repeat = 9) {
  const draw = (mode) => (ctx, w, h) => {
    const n = 8, s = w / n; // 2x2 twill cells
    ctx.fillStyle = mode === 'bump' ? '#404040' : '#15171a'; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const over = ((x + y) % 4) < 2; // twill
      const gx = ctx.createLinearGradient(x * s, y * s, over ? (x + 1) * s : x * s, over ? y * s : (y + 1) * s);
      if (mode === 'bump') { gx.addColorStop(0, '#2a2a2a'); gx.addColorStop(0.5, '#e8e8e8'); gx.addColorStop(1, '#2a2a2a'); }
      else if (over) { gx.addColorStop(0, '#1a1c20'); gx.addColorStop(0.5, '#4a4f58'); gx.addColorStop(1, '#1a1c20'); }
      else { gx.addColorStop(0, '#0e0f12'); gx.addColorStop(0.5, '#2b2e34'); gx.addColorStop(1, '#0e0f12'); }
      ctx.fillStyle = gx; ctx.fillRect(x * s + 0.5, y * s + 0.5, s - 1, s - 1);
    }
  };
  return {
    map: canvasTex(256, 256, draw('color'), { repeat: [repeat, repeat], srgb: true }),
    bump: canvasTex(256, 256, draw('bump'), { repeat: [repeat, repeat] }),
  };
}

// horizontal streaks -> concentric brushing on lathe parts
export function brushedTexture(seed = 3, repeat = [1, 1]) {
  return canvasTex(64, 512, (ctx, w, h) => {
    const r = rng(seed);
    for (let y = 0; y < h; y++) {
      const v = 120 + Math.floor(r() * 110);
      ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(0, y, w, 1);
    }
  }, { repeat });
}

export function ridgeTexture(lines = 40) {
  return canvasTex(8, 512, (ctx, w, h) => {
    for (let y = 0; y < h; y++) {
      const v = Math.floor(128 + 127 * Math.sin((y / h) * Math.PI * 2 * lines));
      ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(0, y, w, 1);
    }
  });
}

export function noiseTexture(seed = 7, size = 256, lo = 90, hi = 200, repeat = [4, 4]) {
  return canvasTex(size, size, (ctx, w, h) => {
    const r = rng(seed); const img = ctx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) { const v = lo + r() * (hi - lo); img.data.set([v, v, v, 255], i * 4); }
    ctx.putImageData(img, 0, 0);
  }, { repeat });
}

export function radialGlowTexture(inner = 'rgba(40,120,255,0.55)', outer = 'rgba(0,0,0,0)') {
  return canvasTex(512, 512, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, inner); g.addColorStop(1, outer);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }, { srgb: true });
}
