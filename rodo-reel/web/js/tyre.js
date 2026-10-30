// Procedural tyre + alloy wheel models for the RODO ACCESSORIES reel.
// Everything is generated in code (no external 3D assets) so renders are reproducible.
import * as THREE from 'three';

export const TYRE = { R: 1.0, RB: 0.665, HW: 0.31, SH: 0.085 };

// ---------------------------------------------------------------------------
// Tyre cross-section profile, resampled so texture v follows arc length.
// Returns { pts: Vector2[] (x = radius, y = axial), v: number[], crown: [v0, v1] }
function tyreProfile() {
  const { R, RB, HW, SH } = TYRE;
  const raw = [];
  const side = (sgn, reverse) => {
    const seg = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const r = RB + (R - SH - RB) * t;
      const bulge = 0.10 * Math.sin(Math.PI * Math.pow(t, 0.8));
      seg.push(new THREE.Vector2(r, sgn * HW * (0.86 + bulge)));
    }
    return reverse ? seg.reverse() : seg;
  };
  const shoulder = (sgn, reverse) => {
    const seg = [];
    const cx = R - SH, cy = sgn * (HW - SH);
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI / 2;
      seg.push(new THREE.Vector2(cx + SH * Math.sin(a), cy + sgn * SH * Math.cos(a)));
    }
    return reverse ? seg.reverse() : seg;
  };
  const crown = [];
  for (let i = 0; i <= 60; i++) {
    const y = -(HW - SH) + (2 * (HW - SH)) * (i / 60);
    crown.push(new THREE.Vector2(R - 0.012 * Math.pow(y / HW, 2), y));
  }
  raw.push(...side(-1, false), ...shoulder(-1, false), ...crown, ...shoulder(1, true), ...side(1, true));
  // de-duplicate + arc length
  const pts = [raw[0]];
  for (const p of raw) if (p.distanceTo(pts[pts.length - 1]) > 1e-5) pts.push(p);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const L = cum[cum.length - 1];
  // crown region (incl. shoulders) for the tread pattern
  const sideLen = cum[40];
  const crownEnd = L - sideLen;
  // resample: dense across the tread, lighter on sidewalls
  const out = [], vs = [];
  const sample = (s) => {
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const t = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    out.push(pts[i - 1].clone().lerp(pts[i], t));
    vs.push(s / L);
  };
  for (let i = 0; i < 44; i++) sample(sideLen * i / 44);
  for (let i = 0; i < 190; i++) sample(sideLen + (crownEnd - sideLen) * i / 190);
  for (let i = 0; i <= 44; i++) sample(crownEnd + sideLen * i / 44);
  return { pts: out, v: vs, crown: [sideLen / L, crownEnd / L], length: L };
}

// ---------------------------------------------------------------------------
// Canvas textures: height (tread + sidewall lettering), normal, roughness, crack mask.
const TW = 4096, TH = 1024;

function heightCanvas(prof) {
  const c = document.createElement('canvas');
  c.width = TW; c.height = TH;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff'; g.fillRect(0, 0, TW, TH);
  // canvas y (top=0) maps to v = 1 - y/TH  (texture flipY)
  const vy = (v) => (1 - v) * TH;
  const [c0, c1] = prof.crown;
  const latY = (lat) => vy(c0 + (c1 - c0) * lat);
  const P = 64, pw = TW / P;
  g.fillStyle = '#000';
  g.strokeStyle = '#000';
  // circumferential grooves
  for (const [lat, w] of [[0.235, 0.040], [0.415, 0.034], [0.585, 0.034], [0.765, 0.040]]) {
    const y0 = latY(lat + w / 2), y1 = latY(lat - w / 2);
    g.fillRect(0, Math.min(y0, y1), TW, Math.abs(y1 - y0));
  }
  for (let k = -1; k <= P; k++) {
    const x = k * pw;
    // shoulder lateral grooves (both sides), slanted + tapered
    for (const s of [0, 1]) {
      const a = s ? latY(0.785) : latY(0.215);
      const b = s ? latY(1.02) : latY(-0.02);
      const slant = s ? 0.22 * pw : -0.22 * pw;
      g.beginPath();
      g.moveTo(x, a); g.lineTo(x + 0.20 * pw, a);
      g.lineTo(x + 0.30 * pw + slant, b); g.lineTo(x + 0.04 * pw + slant, b);
      g.closePath(); g.fill();
    }
    // middle rib slanted slots
    for (const [la, lb, off] of [[0.255, 0.395, 0.5], [0.605, 0.745, 0.0]]) {
      g.beginPath();
      g.moveTo(x + off * pw, latY(la)); g.lineTo(x + (off + 0.12) * pw, latY(la));
      g.lineTo(x + (off + 0.42) * pw, latY(lb)); g.lineTo(x + (off + 0.34) * pw, latY(lb));
      g.closePath(); g.fill();
    }
    // centre rib sipes
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x + 0.25 * pw, latY(0.435)); g.lineTo(x + 0.45 * pw, latY(0.565));
    g.stroke();
  }
  // soften groove edges in one pass
  const tmp = document.createElement('canvas'); tmp.width = TW; tmp.height = TH;
  const tg = tmp.getContext('2d', { willReadFrequently: true });
  tg.filter = 'blur(1.2px)'; tg.drawImage(c, 0, 0);
  g.clearRect(0, 0, TW, TH); g.drawImage(tmp, 0, 0);
  // Sidewall lettering on the visible face (v in [c1, 1]); radial "up" = canvas down.
  const drawSidewallText = (txt, u, v, size, weight = 800, spacing = 0.12) => {
    g.save();
    g.translate(u * TW, vy(v));
    g.scale(-1, -1);
    g.font = `${weight} ${size}px "Inter Display", Inter, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if ('letterSpacing' in g) g.letterSpacing = `${size * spacing}px`;
    g.fillStyle = '#000';
    g.fillText(txt, 0, 0);
    g.restore();
  };
  const sv = (f) => c1 + (1 - c1) * f; // 0 = outer edge, 1 = bead
  for (const base of [0.0, 0.5]) {
    drawSidewallText('225/45 R18 95W', base + 0.13, sv(0.40), 66);
    drawSidewallText('TUBELESS', base + 0.29, sv(0.36), 40, 700, 0.3);
    drawSidewallText('RADIAL', base + 0.36, sv(0.36), 40, 700, 0.3);
    drawSidewallText('MAX LOAD 690 KG  ·  MAX PRESS 350 KPA', base + 0.24, sv(0.66), 22, 600, 0.2);
  }
  // fine concentric ribs near the bead
  g.globalAlpha = 0.35;
  for (let i = 0; i < 6; i++) g.fillRect(0, vy(sv(0.80 + i * 0.03)), TW, 2);
  // protector ring
  g.globalAlpha = 0.6;
  g.fillRect(0, vy(sv(0.06)), TW, 3);
  g.globalAlpha = 1;
  return c;
}

function normalFromHeight(src, strength) {
  const w = src.width, h = src.height;
  const s = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const og = out.getContext('2d', { willReadFrequently: true });
  const img = og.createImageData(w, h);
  const d = img.data;
  const H = (x, y) => s[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      let nx = -dx, ny = dy, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const i = (y * w + x) * 4;
      d[i] = (nx / l * 0.5 + 0.5) * 255;
      d[i + 1] = (ny / l * 0.5 + 0.5) * 255;
      d[i + 2] = (nz / l * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  og.putImageData(img, 0, 0);
  return out;
}

function roughCanvas(height, prof) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const g = c.getContext('2d', { willReadFrequently: true });
  // three.js reads roughness from the G channel
  g.fillStyle = 'rgb(0,190,0)'; g.fillRect(0, 0, 1024, 256);
  const [c0, c1] = prof.crown;
  g.fillStyle = 'rgb(0,225,0)';
  g.fillRect(0, (1 - c1) * 256, 1024, (c1 - c0) * 256);
  // lettering slightly glossier
  g.globalAlpha = 0.5; g.globalCompositeOperation = 'darken';
  g.drawImage(height, 0, 0, 1024, (1 - c1) * 256, 0, 0, 1024, (1 - c1) * 256);
  return c;
}

function colorCanvas(height) {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 512;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#1b1c1e'; g.fillRect(0, 0, 2048, 512);
  // grooves and lettering darker -> fake cavity occlusion
  g.globalCompositeOperation = 'multiply';
  g.filter = 'blur(2px)';
  g.globalAlpha = 0.75;
  g.drawImage(height, 0, 0, 2048, 512);
  g.filter = 'none';
  // subtle rubber mottling
  g.globalCompositeOperation = 'source-over';
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(${rnd() > 0.5 ? 255 : 0},${rnd() > 0.5 ? 255 : 0},255,0.015)`;
    g.globalAlpha = 1;
    g.fillRect(rnd() * 2048, rnd() * 512, 2 + rnd() * 6, 1 + rnd() * 3);
  }
  return c;
}

export function crackCanvas(prof, u0) {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 512;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#000'; g.fillRect(0, 0, 2048, 512);
  const [, c1] = prof.crown;
  const vy = (v) => (1 - v) * 512;
  const sv = (f) => c1 + (1 - c1) * f;
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.strokeStyle = '#fff'; g.lineCap = 'round';
  const branch = (x, y, ang, len, w, depth) => {
    g.lineWidth = w;
    g.beginPath(); g.moveTo(x, y);
    for (let i = 0; i < len; i++) {
      ang += (rnd() - 0.5) * 0.9;
      x += Math.cos(ang) * 4; y += Math.sin(ang) * 2.2;
      g.lineTo(x, y);
      if (depth < 2 && rnd() < 0.05) { g.stroke(); branch(x, y, ang + (rnd() - 0.5) * 2, len * 0.35, w * 0.6, depth + 1); g.lineWidth = w; g.beginPath(); g.moveTo(x, y); }
    }
    g.stroke();
  };
  const x0 = u0 * 2048, y0 = vy(sv(0.22));
  branch(x0, y0, 0.15, 34, 3.2, 0);
  branch(x0, y0, Math.PI + 0.1, 26, 2.8, 0);
  return c;
}

const tex = (canvas, srgb) => {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

// ---------------------------------------------------------------------------
export function buildTyre() {
  const prof = tyreProfile();
  const SEG = 768;
  const geo = new THREE.LatheGeometry(prof.pts, SEG);
  // overwrite v with arc-length v; add custom attributes for the wear shader
  const uv = geo.attributes.uv;
  const n = prof.pts.length;
  const aProf = new Float32Array(uv.count), aU = new Float32Array(uv.count);
  for (let i = 0; i <= SEG; i++) {
    for (let j = 0; j < n; j++) {
      const k = i * n + j;
      uv.setY(k, prof.v[j]);
      aProf[k] = prof.v[j];
      aU[k] = uv.getX(k);
    }
  }
  geo.setAttribute('aProf', new THREE.BufferAttribute(aProf, 1));
  geo.setAttribute('aU', new THREE.BufferAttribute(aU, 1));

  const L = (m) => console.log('[tyre] ' + m + ' ' + performance.now().toFixed(0));
  L('lathe');
  const hC = heightCanvas(prof);
  L('height');
  const nC = normalFromHeight(hC, 5.5);
  L('normal');
  const crackU = 0.875; // lathe angle of the damage (see main.js for orientation)
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: tex(colorCanvas(hC), true),
    roughness: 1.0,
    roughnessMap: tex(roughCanvas(hC, prof)),
    normalMap: tex(nC),
    normalScale: new THREE.Vector2(1.0, 1.0),
    displacementMap: tex(hC),
    displacementScale: 0.03,
    metalness: 0.0,
  });
  L('mat');
  const crackTex = tex(crackCanvas(prof, crackU));
  L('crack');
  const U = {
    uWear: { value: 0 }, uWearL: { value: 0 }, uWearC: { value: 0 }, uWearR: { value: 0 }, uCup: { value: 0 },
    uHeat: { value: 0 }, uCrown0: { value: prof.crown[0] }, uCrown1: { value: prof.crown[1] },
    uCrack: { value: 0 }, uCrackGlow: { value: 0 }, crackMap: { value: crackTex },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aProf; attribute float aU;
        uniform float uWear, uWearL, uWearC, uWearR, uCup, uCrown0, uCrown1;
        varying float vWear; varying float vCrown; varying float vLat;`)
      .replace('#include <displacementmap_vertex>', `
        float lat = clamp((aProf - uCrown0) / (uCrown1 - uCrown0), 0.0, 1.0);
        float onCrown = smoothstep(uCrown0 - 0.004, uCrown0 + 0.004, aProf) * (1.0 - smoothstep(uCrown1 - 0.004, uCrown1 + 0.004, aProf));
        float cup = uCup * smoothstep(0.2, 0.9, sin(aU * 6.2831853 * 14.0 + lat * 1.5)) * (0.55 + 0.45 * sin(aU * 6.2831853 * 3.0));
        float w = uWear + uWearL * (1.0 - smoothstep(0.08, 0.48, lat)) + uWearC * (1.0 - smoothstep(0.08, 0.30, abs(lat - 0.5)))
                + uWearR * smoothstep(0.52, 0.92, lat) + cup;
        w = clamp(w, 0.0, 1.0);
        float hgt = texture2D(displacementMap, vDisplacementMapUv).x;
        // grooves sink in; worn areas: blocks shave down to the groove floor
        transformed += normalize(objectNormal) * onCrown * displacementScale * ((hgt - 1.0) * (1.0 - w) - w * 0.9);
        vWear = w * onCrown; vCrown = onCrown; vLat = lat;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uHeat, uCrack, uCrackGlow; uniform sampler2D crackMap;
        varying float vWear; varying float vCrown; varying float vLat;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize(mix(normal, nonPerturbedNormal, vWear * 0.92));`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float ck = texture2D(crackMap, vMapUv).r * uCrack;
        diffuseColor.rgb *= 1.0 - 0.95 * ck;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.045), vWear * 0.5); // scuffed, polished-smooth rubber`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1.0, 0.06, 0.04) * (uHeat * pow(vWear, 1.4) * 1.6 + ck * uCrackGlow * 3.0);
        totalEmissiveRadiance += vec3(1.0, 1.0, 1.0) * uHeat * 0.035 * vCrown * (1.0 - vWear);`);
  };
  mat.customProgramCacheKey = () => 'rodo-tyre';
  const mesh = new THREE.Mesh(geo, mat);

  // bulge morph (CPU): gaussian outward push on the visible sidewall
  const pos = geo.attributes.position;
  const base = Float32Array.from(pos.array);
  const bulgeU = crackU + 0.045, bulgeV = prof.crown[1] + (1 - prof.crown[1]) * 0.42;
  const off = new Float32Array(pos.count * 3);
  for (let i = 0; i <= SEG; i++) {
    for (let j = 0; j < n; j++) {
      const k = i * n + j;
      let du = Math.abs(i / SEG - bulgeU); du = Math.min(du, 1 - du);
      const dv = prof.v[j] - bulgeV;
      const g = Math.exp(-(du * du) / (2 * 0.016 * 0.016) - (dv * dv) / (2 * 0.035 * 0.035));
      off[k * 3 + 1] = g * 0.055; // push along +axial (out of the sidewall face)
    }
  }
  let lastBulge = -1;
  const setBulge = (a) => {
    if (Math.abs(a - lastBulge) < 1e-4) return;
    lastBulge = a;
    for (let i = 0; i < base.length; i++) pos.array[i] = base[i] + off[i] * a;
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  };
  geo.computeVertexNormals();
  // local-space surface point at lathe coords (u, v)
  const pointAt = (u, v) => {
    const i = Math.round(((u % 1) + 1) % 1 * SEG);
    let j = 0; for (let k = 0; k < n; k++) if (Math.abs(prof.v[k] - v) < Math.abs(prof.v[j] - v)) j = k;
    const idx = (i * n + j) * 3;
    return new THREE.Vector3(pos.array[idx], pos.array[idx + 1], pos.array[idx + 2]);
  };
  const crackV = prof.crown[1] + (1 - prof.crown[1]) * 0.22;
  return { mesh, mat, U, setBulge, prof, crackU, bulgeU, bulgeV, crackPoint: () => pointAt(crackU, crackV), bulgePoint: () => pointAt(bulgeU, bulgeV) };
}

// ---------------------------------------------------------------------------
export function buildRim(envMats) {
  const group = new THREE.Group();
  const silver = new THREE.MeshPhysicalMaterial({ color: 0xb9bec6, metalness: 1, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06 });
  const gun = new THREE.MeshPhysicalMaterial({ color: 0x2b2e33, metalness: 1, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0c0d0f, metalness: 0.6, roughness: 0.55 });
  const disc = new THREE.MeshStandardMaterial({ color: 0x6d7075, metalness: 1, roughness: 0.42 });
  const red = new THREE.MeshPhysicalMaterial({ color: 0xc8141c, metalness: 0.3, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 });
  envMats.push(silver, gun, dark, disc, red);

  // --- face with twin-spoke windows (built in XY plane, extruded along +Z, then turned to face +X)
  const RO = 0.655;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, RO, 0, Math.PI * 2, false);
  const window_ = (a0, a1, b0, b1, rIn, rOut) => {
    const p = new THREE.Path();
    const pt = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
    p.moveTo(...pt(rIn, b0));
    p.lineTo(...pt(rOut, a0));
    p.absarc(0, 0, rOut, a0, a1, false);
    p.lineTo(...pt(rIn, b1));
    p.absarc(0, 0, rIn, b1, b0, true);
    return p;
  };
  const d2r = Math.PI / 180;
  for (let k = 0; k < 5; k++) {
    const c = k * 72 * d2r + Math.PI / 2;
    // wide window between spoke pairs
    shape.holes.push(window_(c + 13 * d2r, c + 59 * d2r, c + 22 * d2r, c + 50 * d2r, 0.25, 0.575));
    // slim slot between twins
    shape.holes.push(window_(c - 3.2 * d2r, c + 3.2 * d2r, c - 0.6 * d2r, c + 0.6 * d2r, 0.36, 0.575));
  }
  const face = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.012, bevelSegments: 3, curveSegments: 96 });
  const fp = face.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    const x = fp.getX(i), y = fp.getY(i);
    const r = Math.hypot(x, y) / RO;
    fp.setZ(i, fp.getZ(i) - 0.16 * Math.pow(1 - Math.min(r, 1), 1.6)); // concave dish
  }
  face.computeVertexNormals();
  const faceMesh = new THREE.Mesh(face, silver);
  faceMesh.rotation.y = Math.PI / 2; // +Z -> +X
  faceMesh.position.x = 0.13;
  group.add(faceMesh);

  // barrel + lips
  const barrelPts = [[0.62, -0.30], [0.645, -0.28], [0.60, -0.24], [0.585, 0.0], [0.60, 0.17], [0.65, 0.2], [0.68, 0.215], [0.675, 0.23]].map(([r, y]) => new THREE.Vector2(r, y));
  const barrel = new THREE.Mesh(new THREE.LatheGeometry(barrelPts, 128), gun);
  barrel.material.side = THREE.DoubleSide;
  barrel.rotation.z = -Math.PI / 2;
  group.add(barrel);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.672, 0.014, 16, 160), silver);
  lip.rotation.y = Math.PI / 2; lip.position.x = 0.215;
  group.add(lip);

  // hub, centre cap, lug nuts
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.11, 0.05, 64), gun);
  cap.rotation.z = -Math.PI / 2; cap.position.x = 0.12;
  group.add(cap);
  const capRing = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.008, 12, 64), silver);
  capRing.rotation.y = Math.PI / 2; capRing.position.x = 0.147;
  group.add(capRing);
  for (let k = 0; k < 5; k++) {
    const a = k * 72 * d2r + Math.PI / 2 + 36 * d2r;
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.05, 6), silver);
    nut.rotation.z = -Math.PI / 2;
    nut.position.set(0.105, Math.sin(a) * 0.165, Math.cos(a) * 0.165);
    group.add(nut);
  }
  // valve stem
  const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.014, 0.07, 16), dark);
  valve.rotation.z = -Math.PI / 2 + 0.35;
  valve.position.set(0.17, 0.0, -0.6);
  group.add(valve);
  const valveCap = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.03, 16), silver);
  valveCap.rotation.copy(valve.rotation);
  valveCap.position.set(0.205, 0.0, -0.61);
  group.add(valveCap);

  // brake disc (spins) — drilled pattern via ring of dark dots
  const discMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.03, 96, 1, false), disc);
  discMesh.rotation.z = -Math.PI / 2; discMesh.position.x = -0.06;
  group.add(discMesh);
  for (let k = 0; k < 36; k++) {
    const a = (k / 36) * Math.PI * 2, r = 0.33 + (k % 3) * 0.045;
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.034, 10), dark);
    h.rotation.z = -Math.PI / 2;
    h.position.set(-0.06, Math.sin(a) * r, Math.cos(a) * r);
    group.add(h);
  }

  // caliper (static, red accent) — returned separately so it doesn't spin
  const caliperShape = new THREE.Shape();
  caliperShape.absarc(0, 0, 0.53, 1.95, 2.95, false);
  caliperShape.absarc(0, 0, 0.36, 2.95, 1.95, true);
  const caliper = new THREE.Mesh(new THREE.ExtrudeGeometry(caliperShape, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 3, curveSegments: 32 }), red);
  caliper.rotation.y = Math.PI / 2;
  caliper.position.x = -0.03;
  return { group, caliper, materials: { silver, gun, dark, disc, red } };
}
