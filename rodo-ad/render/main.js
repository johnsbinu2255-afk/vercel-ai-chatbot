// RODO Accessories - "Component vs Coaxial" 40 s vertical ad.
// Deterministic renderer: window.renderAt(t) draws the frame for time t (seconds).
//   ?layer=main  -> motion graphics with alpha (3D scenes 4-6, sound-wave FX, logo ending)
//   ?layer=base  -> opaque motion-graphics open that stands in for the live-action scenes 1-3
//   ?layer=main&variant=solo -> comparison holds until the logo (no cut back to the car)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makeMaterials, makeWoofer, makeTweeter, makeCrossover, makeDoor, BLUE } from './speakers.js';
import { clamp, lerp, prog, ease, win, rng } from './lib.js';

const W = 1080, H = 1920;
const params = new URLSearchParams(location.search);
const LAYER = params.get('layer') || 'main';
const SOLO = params.get('variant') === 'solo';
const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------------ timeline
export const TL = {
  fxIn: 12.6,            // sound waves start building over the driver shot
  irisOpen: [14.45, 15.1],
  s4: 15, s5: 24, s6: 31, s7: 36,
  toCoax: [23.35, 24.15],
  toSplit: [30.35, 31.15],
  irisClose: [35.6, 36.0],
  logoIn: [37.2, 37.5],
  end: 40,
};

// piecewise eased keyframes: [[t, v], ...]
function kf(t, frames, fn = ease.inOut) {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 0; i < frames.length - 1; i++) {
    const [t0, v0] = frames[i], [t1, v1] = frames[i + 1];
    if (t <= t1) return lerp(v0, v1, fn(prog(t, t0, t1)));
  }
  return frames[frames.length - 1][1];
}
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
function kf3(t, frames, fn = ease.inOut) {
  return v3(kf(t, frames.map((f) => [f[0], f[1][0]]), fn), kf(t, frames.map((f) => [f[0], f[1][1]]), fn), kf(t, frames.map((f) => [f[0], f[1][2]]), fn));
}

// ------------------------------------------------------------------ three stage
let renderer, composer, scene, camera, M;
let comp, coax, door, dust, ringsA, ringsB, ringsC, clickRing, glowTrim, xGlow;

function softbox(w, h, color, intensity, pos, look = [0, 0, 0]) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
  m.position.set(...pos); m.lookAt(...look); return m;
}

function rig(model, innerRotX = Math.PI / 2) {
  const holder = new THREE.Group(); holder.rotation.order = 'YXZ';
  const inner = new THREE.Group(); inner.rotation.x = innerRotX;
  inner.add(model.group); holder.add(inner); scene.add(holder);
  return { holder, inner, ...model };
}

function makeRings(n, color = BLUE) {
  const g = new THREE.Group(); g.userData.rings = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.985, 1.0, 128), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    g.add(m); g.userData.rings.push(m);
  }
  return g;
}
function animRings(g, t, amp, { speed = 0.55, travel = 1.15, grow = 0.5, base = 0.55 } = {}) {
  const rs = g.userData.rings; g.visible = amp > 0.001;
  rs.forEach((m, i) => {
    const ph = (t * speed + i / rs.length) % 1;
    m.position.z = 0.12 + ph * travel;
    m.scale.setScalar(base + ph * grow);
    m.material.opacity = Math.sin(Math.PI * ph) * 0.5 * amp;
  });
}

function initStage() {
  const canvas = $('gl');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(26, W / H, 0.5, 200);
  scene.add(camera);

  // studio environment (softboxes) -> PMREM
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x010102);
  env.add(softbox(12, 12, 0xffffff, 1.5, [0, 11, 3]));
  env.add(softbox(2.6, 14, 0xdfeaff, 2.6, [-10, 2, 4]));
  env.add(softbox(1.8, 14, 0x2a86ff, 4.2, [10, 1, -1]));
  env.add(softbox(10, 3, 0xffffff, 0.5, [0, -3, 11]));
  env.add(softbox(14, 3, 0xcfe0ff, 1.4, [0, 6, -11]));
  env.add(softbox(3, 3, 0xffffff, 1.1, [4, 5, 9]));
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(env, 0.02).texture;
  scene.environmentIntensity = 1.0;

  const key = new THREE.SpotLight(0xffffff, 520, 60, 0.42, 0.85, 2);
  key.position.set(-6, 9, 13); key.target.position.set(0, 0, 0); scene.add(key, key.target);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 5;
  key.shadow.camera.near = 6; key.shadow.camera.far = 40;
  const rim = new THREE.PointLight(BLUE, 380, 60, 2); rim.position.set(7, 2.5, -5); scene.add(rim);
  const rim2 = new THREE.PointLight(0xbfd6ff, 150, 60, 2); rim2.position.set(-7, -2, -4); scene.add(rim2);

  // backdrop locked to the camera
  const bc = document.createElement('canvas'); bc.width = 540; bc.height = 960;
  const b = bc.getContext('2d');
  b.fillStyle = '#020304'; b.fillRect(0, 0, 540, 960);
  let g = b.createRadialGradient(270, 420, 0, 270, 420, 560);
  g.addColorStop(0, 'rgba(34,84,170,0.62)'); g.addColorStop(0.35, 'rgba(14,36,82,0.42)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  b.fillStyle = g; b.fillRect(0, 0, 540, 960);
  g = b.createLinearGradient(0, 0, 0, 960); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.3, 'rgba(0,0,0,0)'); g.addColorStop(0.75, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.7)');
  b.fillStyle = g; b.fillRect(0, 0, 540, 960);
  const bt = new THREE.CanvasTexture(bc); bt.colorSpace = THREE.SRGBColorSpace;
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(40, 71.1), new THREE.MeshBasicMaterial({ map: bt, depthTest: false, depthWrite: false }));
  backdrop.position.z = -150; backdrop.renderOrder = -10; camera.add(backdrop);

  // floating dust
  const N = 240, r = rng(42), pos = new Float32Array(N * 3), seed = [];
  for (let i = 0; i < N; i++) seed.push([r() * 14 - 7, r() * 16 - 8, r() * 14 - 10, 0.3 + r() * 0.9, r() * 6.28]);
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sc = document.createElement('canvas'); sc.width = sc.height = 64; const sx = sc.getContext('2d');
  const sg = sx.createRadialGradient(32, 32, 0, 32, 32, 32); sg.addColorStop(0, 'rgba(255,255,255,1)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); sx.fillStyle = sg; sx.fillRect(0, 0, 64, 64);
  dust = new THREE.Points(dg, new THREE.PointsMaterial({ size: 0.075, map: new THREE.CanvasTexture(sc), color: 0x8cc8ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  dust.userData.seed = seed; scene.add(dust);

  // models
  M = makeMaterials();
  comp = { woofer: rig(makeWoofer(M)), tweeter: rig(makeTweeter(M)), xover: rig(makeCrossover(M), 1.08) };
  coax = rig(makeWoofer(M, { coaxial: true }));
  door = rig(makeDoor(M), 0);

  // sound rings + highlight glows
  ringsA = makeRings(5); comp.woofer.holder.add(ringsA);
  ringsB = makeRings(4); comp.tweeter.holder.add(ringsB);
  ringsC = makeRings(5); coax.holder.add(ringsC);
  glowTrim = new THREE.Mesh(new THREE.TorusGeometry(1.03, 0.013, 12, 160), new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: 0, toneMapped: false }));
  coax.holder.add(glowTrim);
  clickRing = new THREE.Mesh(new THREE.RingGeometry(0.97, 1.0, 128), new THREE.MeshBasicMaterial({ color: 0x9fd2ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  scene.add(clickRing);
  // rounded-rectangle outline that hugs the crossover footprint
  const fr = (w, h, r) => { const s = new THREE.Shape(); s.moveTo(-w + r, -h); s.lineTo(w - r, -h); s.quadraticCurveTo(w, -h, w, -h + r); s.lineTo(w, h - r); s.quadraticCurveTo(w, h, w - r, h); s.lineTo(-w + r, h); s.quadraticCurveTo(-w, h, -w, h - r); s.lineTo(-w, -h + r); s.quadraticCurveTo(-w, -h, -w + r, -h); return s; };
  const outer = fr(0.6, 0.41, 0.07); outer.holes.push(fr(0.575, 0.385, 0.06));
  xGlow = new THREE.Mesh(new THREE.ShapeGeometry(outer, 24), new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  xGlow.rotation.x = -Math.PI / 2; xGlow.position.y = 0.2; comp.xover.group.add(xGlow);

  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
  composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.2, 0.5, 1.0));
  composer.addPass(new OutputPass());
}

function setCam(az, el, dist, ty, tx = 0) {
  camera.position.set(tx + dist * Math.sin(az) * Math.cos(el), ty + dist * Math.sin(el), dist * Math.cos(az) * Math.cos(el));
  camera.lookAt(tx, ty, 0); camera.updateMatrixWorld(true);
}
const _p = new THREE.Vector3();
function toScreen(x, y, z) {
  _p.set(x, y, z).project(camera);
  return { x: (_p.x * 0.5 + 0.5) * W, y: (-_p.y * 0.5 + 0.5) * H };
}
function place(r, pos, scale, yaw = 0, pitch = 0, roll = 0) {
  r.holder.position.copy(pos); r.holder.scale.setScalar(scale); r.holder.rotation.set(pitch, yaw, roll);
}

// ------------------------------------------------------------------ HUD helpers
function setVis(el, a, { x = 0, y = 0, s = 1 } = {}) {
  el.style.opacity = a.toFixed(4);
  el.style.visibility = a <= 0.001 ? 'hidden' : 'visible';
  el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${s.toFixed(4)})`;
}
function titleAnim(el, t, tin, tout) {
  const a = ease.out(prog(t, tin, tin + 0.55)) * (1 - ease.in(prog(t, tout - 0.35, tout)));
  setVis(el, a, { y: (1 - ease.out(prog(t, tin, tin + 0.55))) * 26 });
  el.querySelector('.bar').style.transform = `scaleX(${ease.out(prog(t, tin + 0.2, tin + 0.9)).toFixed(4)})`;
}
function listAnim(listEl, t, times, tout) {
  const pts = listEl.querySelectorAll('.pt');
  const out = 1 - ease.in(prog(t, tout - 0.35, tout));
  listEl.style.visibility = t >= times[0] - 0.05 && t < tout ? 'visible' : 'hidden';
  pts.forEach((pt, i) => {
    const p = ease.outQuint(prog(t, times[i], times[i] + 0.55));
    const next = times[i + 1] !== undefined ? ease.smooth(prog(t, times[i + 1], times[i + 1] + 0.4)) : 0;
    pt.style.opacity = (p * out * lerp(1, 0.5, next)).toFixed(4);
    pt.querySelector('.tx').style.clipPath = `inset(-10px ${(100 - p * 100).toFixed(2)}% -10px 0)`;
    pt.querySelector('.tx').style.transform = `translateX(${((1 - p) * -18).toFixed(2)}px)`;
    pt.querySelector('.tick').style.transform = `scaleY(${ease.outBack(prog(t, times[i], times[i] + 0.4)).toFixed(4)})`;
  });
}

const SVGNS = 'http://www.w3.org/2000/svg';
const lineEls = {};
function leader(id, pts, p, alpha) {
  let el = lineEls[id];
  if (!el) {
    el = { g: document.createElementNS(SVGNS, 'g'), path: document.createElementNS(SVGNS, 'polyline'), dot: document.createElementNS(SVGNS, 'circle'), halo: document.createElementNS(SVGNS, 'circle') };
    el.path.setAttribute('fill', 'none'); el.path.setAttribute('stroke', '#7cc4ff'); el.path.setAttribute('stroke-width', '2.5');
    el.dot.setAttribute('r', '6'); el.dot.setAttribute('fill', '#eaf3ff');
    el.halo.setAttribute('fill', 'none'); el.halo.setAttribute('stroke', '#2f9bff'); el.halo.setAttribute('stroke-width', '2');
    el.g.setAttribute('style', 'filter: drop-shadow(0 0 6px rgba(47,155,255,0.95))');
    el.g.append(el.path, el.halo, el.dot); $('lines').append(el.g); lineEls[id] = el;
  }
  if (alpha <= 0.001 || p <= 0.001) { el.g.setAttribute('visibility', 'hidden'); return; }
  el.g.setAttribute('visibility', 'visible'); el.g.setAttribute('opacity', alpha.toFixed(3));
  let len = 0; for (let i = 0; i < pts.length - 1; i++) len += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  el.path.setAttribute('points', pts.map((q) => q.map((n) => n.toFixed(1)).join(',')).join(' '));
  el.path.setAttribute('stroke-dasharray', `${(len * p).toFixed(1)} ${(len + 10).toFixed(1)}`);
  el.dot.setAttribute('cx', pts[0][0].toFixed(1)); el.dot.setAttribute('cy', pts[0][1].toFixed(1));
  el.halo.setAttribute('cx', pts[0][0].toFixed(1)); el.halo.setAttribute('cy', pts[0][1].toFixed(1));
  el.halo.setAttribute('r', (8 + 8 * p).toFixed(1)); el.halo.setAttribute('opacity', (0.9 - 0.4 * p).toFixed(2));
}
// callout with an elbow leader; side: -1 label on the left, +1 on the right
function callout(id, el, anchor, side, t, tin, tout, { dx = 70, dy = -46, w = 190 } = {}) {
  const p = ease.out(prog(t, tin, tin + 0.5));
  const a = p * (1 - ease.smooth(prog(t, tout - 0.3, tout)));
  const ex = side > 0 ? Math.min(anchor.x + dx, W - 44 - w) : Math.max(anchor.x - dx, 44 + w), ey = anchor.y + dy;
  const lx = side > 0 ? ex : ex - w;
  leader(id, [[anchor.x, anchor.y], [ex, ey], [side > 0 ? ex + w : ex - w, ey]], p, a);
  el.style.left = `${lx.toFixed(1)}px`; el.style.top = `${(ey - 112).toFixed(1)}px`;
  el.style.textAlign = side > 0 ? 'left' : 'right'; el.style.width = `${w}px`;
  setVis(el, a * ease.smooth(prog(t, tin + 0.2, tin + 0.6)), { y: (1 - p) * 10 });
}

// ------------------------------------------------------------------ blueprint car inset
function buildCar() {
  const svg = $('car');
  const mk = (tag, attrs, parent = svg) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.append(e); return e; };
  const defs = mk('defs', {});
  const f = mk('filter', { id: 'bg', x: '-30%', y: '-30%', width: '160%', height: '160%' }, defs);
  mk('feGaussianBlur', { stdDeviation: '3.2', result: 'b' }, f);
  const mg = mk('feMerge', {}, f); mk('feMergeNode', { in: 'b' }, mg); mk('feMergeNode', { in: 'SourceGraphic' }, mg);
  // grid
  const grid = mk('g', { stroke: 'rgba(124,196,255,0.08)', 'stroke-width': 1 });
  for (let x = 30; x < 900; x += 30) mk('line', { x1: x, y1: 0, x2: x, y2: 320 }, grid);
  for (let y = 20; y < 320; y += 30) mk('line', { x1: 0, y1: y, x2: 900, y2: y }, grid);
  const world = mk('g', { transform: 'translate(22,52) scale(0.82)' });
  const car = mk('g', { fill: 'none', stroke: '#7cc4ff', 'stroke-width': 2.6, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', filter: 'url(#bg)', id: 'carLines' }, world);
  // body (front of the car on the left)
  mk('path', { class: 'draw', d: 'M 96 246 Q 86 244 86 232 L 90 208 Q 92 190 112 182 L 196 162 Q 262 148 318 146 L 398 94 Q 420 82 462 80 L 566 80 Q 604 80 632 96 L 706 138 L 778 144 Q 806 148 810 172 L 814 228 Q 814 246 800 246 L 742 246 A 54 54 0 0 0 634 246 L 276 246 A 54 54 0 0 0 168 246 Z' }, car);
  // glass
  mk('path', { class: 'draw', d: 'M 334 146 L 404 102 Q 420 94 446 93 L 500 93 L 504 146 Z' }, car);
  mk('path', { class: 'draw', d: 'M 518 93 L 566 93 Q 596 94 620 106 L 678 142 L 520 146 Z' }, car);
  // doors and details
  mk('path', { class: 'draw', d: 'M 326 150 Q 318 200 334 242 M 511 148 L 513 244 M 684 146 Q 668 200 648 226' }, car);
  mk('path', { class: 'draw', d: 'M 316 150 L 300 152 Q 292 144 302 138 L 318 136' }, car);
  mk('path', { class: 'draw', d: 'M 450 170 h 34 M 620 170 h 34 M 92 206 L 128 200 M 810 180 L 786 178' }, car);
  // dashboard hint + front seat hint
  mk('path', { class: 'draw', d: 'M 340 148 Q 364 150 372 166 L 378 190', stroke: 'rgba(124,196,255,0.55)', 'stroke-width': 1.8 }, car);
  mk('path', { class: 'draw', d: 'M 430 232 L 428 190 Q 430 140 446 118 Q 458 110 462 126 L 464 200 L 500 206 L 500 232', stroke: 'rgba(124,196,255,0.45)', 'stroke-width': 1.8 }, car);
  // wheels
  for (const cx of [222, 688]) { mk('circle', { class: 'draw', cx, cy: 246, r: 44 }, car); mk('circle', { class: 'draw', cx, cy: 246, r: 24 }, car); mk('circle', { cx, cy: 246, r: 5, fill: '#7cc4ff', stroke: 'none' }, car); }
  mk('line', { x1: 30, y1: 292, x2: 870, y2: 292, stroke: 'rgba(124,196,255,0.4)', 'stroke-width': 1.5 }, svg);
  // markers
  const marks = mk('g', { id: 'marks' });
  const marker = (id, x, y, r, label, pts, lx, ly) => {
    const gq = mk('g', { id }, marks);
    mk('circle', { cx: x, cy: y, r: r + 10, fill: 'none', stroke: '#2f9bff', 'stroke-width': 2, class: 'pulse' }, gq);
    mk('circle', { cx: x, cy: y, r, fill: 'rgba(47,155,255,0.25)', stroke: '#eaf3ff', 'stroke-width': 2.5, filter: 'url(#bg)' }, gq);
    mk('circle', { cx: x, cy: y, r: r * 0.36, fill: '#eaf3ff' }, gq);
    mk('polyline', { points: pts, fill: 'none', stroke: '#7cc4ff', 'stroke-width': 1.8 }, gq);
    const tx = mk('text', { x: lx, y: ly }, gq); tx.textContent = label;
    return gq;
  };
  // marker positions are the car-space points (346,150) and (392,212) after the group transform
  marker('mk_tw', 305.7, 175, 7, 'TWEETER \u00b7 DASH', '314,172 470,120 682,120', 692, 127);
  marker('mk_wf', 343.4, 225.8, 13, 'WOOFER \u00b7 DOOR', '358,226 682,226', 692, 233);
  // sound arcs towards the listener
  const arcs = mk('g', { id: 'arcs', fill: 'none', stroke: '#2f9bff', 'stroke-width': 2, 'stroke-linecap': 'round' }, world);
  for (let i = 0; i < 3; i++) mk('path', { d: `M ${372 + i * 16} ${128 - i * 3} Q ${384 + i * 18} ${138 + i} ${376 + i * 16} ${156 + i * 4}`, class: 'a_tw' }, arcs);
  for (let i = 0; i < 3; i++) mk('path', { d: `M ${414 + i * 12} ${186 - i * 10} Q ${430 + i * 14} ${196 - i * 6} ${428 + i * 12} ${214 - i * 2}`, class: 'a_wf' }, arcs);
  svg.querySelectorAll('.draw').forEach((p) => { const L = p.getTotalLength ? p.getTotalLength() : 300; p.dataset.len = L; p.setAttribute('stroke-dasharray', `${L} ${L}`); });
}
function carAnim(t, tin, tout) {
  const a = ease.out(prog(t, tin, tin + 0.5)) * (1 - ease.in(prog(t, tout - 0.35, tout)));
  const el = $('inset');
  setVis(el, a, { y: (1 - ease.out(prog(t, tin, tin + 0.6))) * 40 });
  if (a <= 0.001) return;
  const d = ease.inOut(prog(t, tin + 0.15, tin + 1.35));
  el.querySelectorAll('.draw').forEach((p) => p.setAttribute('stroke-dashoffset', ((1 - d) * p.dataset.len).toFixed(1)));
  const m1 = ease.outBack(prog(t, tin + 1.0, tin + 1.4)), m2 = ease.outBack(prog(t, tin + 0.7, tin + 1.1));
  $('mk_tw').setAttribute('opacity', clamp(m1).toFixed(3)); $('mk_wf').setAttribute('opacity', clamp(m2).toFixed(3));
  el.querySelectorAll('.pulse').forEach((c, i) => { const ph = (t * 0.9 + i * 0.4) % 1; c.setAttribute('opacity', (0.9 * (1 - ph)).toFixed(3)); c.setAttribute('transform', ''); c.setAttribute('stroke-width', (2.5 - 1.5 * ph).toFixed(2)); c.setAttribute('r', ((i === 0 ? 12 : 18) + ph * 14).toFixed(1)); });
  el.querySelectorAll('.a_tw').forEach((p, i) => p.setAttribute('opacity', (m1 * (0.25 + 0.75 * Math.max(0, Math.sin((t * 5 - i * 0.9))))).toFixed(3)));
  el.querySelectorAll('.a_wf').forEach((p, i) => p.setAttribute('opacity', (m2 * (0.25 + 0.75 * Math.max(0, Math.sin((t * 5 - i * 0.9 + 1))))).toFixed(3)));
}

// ------------------------------------------------------------------ 3D scenes
function hideAll() {
  for (const r of [comp.woofer, comp.tweeter, comp.xover, coax, door]) r.holder.visible = false;
  comp.woofer.setExplode(0); coax.setExplode(0);
  ringsA.visible = ringsB.visible = ringsC.visible = false;
  clickRing.material.opacity = 0; glowTrim.material.opacity = 0; xGlow.material.opacity = 0;
  coax.parts.tweeterParts.glow.material.opacity = 0;
}

function driftDust(t) {
  const pa = dust.geometry.attributes.position, seed = dust.userData.seed;
  seed.forEach((s, i) => pa.setXYZ(i, s[0] + Math.sin(t * 0.25 + s[4]) * 0.25, ((s[1] + t * 0.07 * s[3] + 8) % 16) - 8, s[2]));
  pa.needsUpdate = true;
}

function update3D(t) {
  hideAll(); driftDust(t);

  const { woofer, tweeter, xover } = comp;
  const S5 = TL.toCoax, S6 = TL.toSplit;

  // ---------- camera
  let az, el, dist, ty;
  if (t < S5[1]) {
    az = kf(t, [[14.4, -0.42], [16.3, 0.2], [18.6, -0.14], [23.6, 0.16]]);
    el = kf(t, [[14.4, 0.2], [16.5, 0.1], [23.6, 0.16]]);
    dist = kf(t, [[14.4, 25], [15.7, 18.6], [18.75, 18.6], [19.65, 28.5], [23.6, 27.8]]);
    ty = kf(t, [[14.4, -0.38], [18.75, -0.38], [19.65, -1.72], [23.6, -1.68]]);
    // whip into the coaxial section
    const w = ease.inOut(prog(t, S5[0], S5[1]));
    az += w * 0.0; dist = lerp(dist, 18, w); ty = lerp(ty, -0.5, w);
  } else if (t < S6[0]) {
    az = kf(t, [[24.1, 0.18], [26.4, -0.05], [28.45, 0.0], [29.3, 0.52], [30.4, 0.6]]);
    el = kf(t, [[24.1, 0.12], [28.45, 0.1], [29.3, 0.16]]);
    dist = kf(t, [[24.1, 18], [26.4, 17.2], [28.45, 18], [29.3, 27], [30.4, 26.4]]);
    ty = kf(t, [[28.45, -0.5], [29.3, -0.52]]);
  } else {
    const w = ease.inOut(prog(t, S6[0], S6[1]));
    az = lerp(0.6, 0, w) + Math.sin((t - 31) * 0.5) * 0.03 * w;
    el = lerp(0.16, 0.06, w); dist = lerp(26.4, 18, w); ty = lerp(-0.52, -1.05, w);
  }
  setCam(az, el, dist, ty);

  // ---------- component set (scene 4, then the left half of scene 6)
  if (t < S5[1]) {
    const exit = ease.in(prog(t, S5[0], S5[1]));
    const sep = ease.inOut(prog(t, 15.35, 16.3));
    const explode = kf(t, [[15.8, 0], [16.55, 0.58], [17.0, 0.58], [17.65, 0]]);
    const wYaw = kf(t, [[14.4, 0.55], [15.8, 0.12], [16.5, -0.98], [17.0, -1.02], [17.8, -0.22], [23.6, 0.18]]) - exit * 2.2;
    const wX = kf(t, [[15.8, 0], [16.5, -0.42], [17.0, -0.42], [17.7, 0]]) - exit * 9;
    woofer.holder.visible = tweeter.holder.visible = xover.holder.visible = true;
    place(woofer, v3(wX, 0, 0), 1, wYaw, -0.06);
    woofer.setExplode(explode);
    const bob = Math.sin(t * 1.3) * 0.03;
    place(tweeter, v3(lerp(-0.62, 0, sep) - exit * 9, lerp(-0.6, 1.62, sep) + bob, lerp(1.2, 0, sep)), 1.45, kf(t, [[14.4, 0.7], [16.3, -0.3], [23.6, 0.35]]) - exit * 2.2, -0.12);
    place(xover, v3(lerp(0.6, 0, sep) - exit * 9, lerp(-0.78, -1.64, sep) - bob, lerp(1.0, 0, sep)), 1.25, kf(t, [[14.4, -0.5], [16.3, 0.25], [23.6, -0.3]]) - exit * 2.2, 0);
    // sound rings on the hero beat + crossover highlight when it is named
    animRings(ringsA, t, win(t, 14.5, 15.8, 0.4) * 0.8 + win(t, 20.6, 23.3, 0.5) * 0.45);
    animRings(ringsB, t, win(t, 20.6, 23.3, 0.5) * 0.5, { travel: 0.8, grow: 0.28, base: 0.2 });
    const xg = win(t, 17.3, 18.5, 0.25);
    xGlow.material.opacity = xg * (0.7 + 0.3 * Math.sin(t * 14));
  }

  // ---------- coaxial (scene 5, then the right half of scene 6)
  if (t >= S5[0]) {
    coax.holder.visible = true;
    const enter = ease.out(prog(t, S5[0] + 0.1, S5[1] + 0.25));
    const spin = ease.inOut(prog(t, 26.45, 28.45)) * Math.PI * 2;
    const yawBase = kf(t, [[24.0, -0.95], [26.4, -0.42], [26.45, -0.42]]);
    const yawSettle = ease.inOut(prog(t, 28.0, 28.6)) * 0.42;
    let yaw = yawBase + spin + yawSettle;
    let pitch = kf(t, [[24.0, 0.3], [26.4, 0.2], [28.5, 0.0]]);
    let pos = v3(lerp(9, 0, enter), 0.1, 0), scale = 1.45;
    // tweeter drops onto the centre post
    coax.parts.tweeter.position.y = lerp(1.25, 0, ease.out(prog(t, 24.25, 25.5)));
    const hl = win(t, 25.35, 27.1, 0.3);
    coax.parts.tweeterParts.glow.material.opacity = hl * (0.75 + 0.25 * Math.sin(t * 12));
    glowTrim.material.opacity = hl * 0.85; glowTrim.position.z = 0.03;
    // door fit
    const zDoor = -1.5;
    const fit = ease.inOut(prog(t, 29.0, 29.6));
    pos.z = lerp(0, zDoor + 0.008 * scale, fit);
    if (t >= 28.2 && t < S6[1]) {
      door.holder.visible = true;
      const din = ease.out(prog(t, 28.25, 29.0)), dout = ease.in(prog(t, S6[0], S6[0] + 0.55));
      place(door, v3(lerp(11, 0, din) + dout * 12, 0.1, zDoor - dout * 3), 1.45, 0, 0);
      const ck = prog(t, 29.58, 30.15);
      clickRing.position.set(0, 0.1, zDoor + 0.06); clickRing.scale.setScalar(1.45 * (1 + ck * 0.55));
      clickRing.material.opacity = ck > 0 && ck < 1 ? (1 - ck) * 0.9 : 0;
    }
    animRings(ringsC, t, win(t, 25.5, 26.5, 0.3) * 0.6 + win(t, 29.75, 30.45, 0.25) * 0.7);
    // split-screen slot
    if (t >= S6[0]) {
      const w = ease.inOut(prog(t, S6[0], S6[1]));
      pos = v3(lerp(0, 1.12, w), lerp(0.1, 0.05, w), lerp(pos.z, 0, w));
      scale = lerp(1.45, 0.92, w);
      yaw = lerp(0, -0.32, w) + Math.sin((t - 31) * 0.9) * 0.16 * w; pitch = lerp(0, 0.16, w);
      animRings(ringsC, t, win(t, 33.9, SOLO ? 38.5 : 35.9, 0.4) * 0.75);
    }
    place(coax, pos, scale, yaw, pitch);
  }
  if (t >= S6[0]) {
    woofer.holder.visible = tweeter.holder.visible = xover.holder.visible = true;
    const e1 = ease.out(prog(t, S6[0] + 0.1, S6[1])), e2 = ease.out(prog(t, S6[0] + 0.22, S6[1] + 0.12)), e3 = ease.out(prog(t, S6[0] + 0.34, S6[1] + 0.24));
    const sway = Math.sin((t - 31) * 0.9) * 0.16;
    place(woofer, v3(lerp(-8, -1.12, e1), 0.62, 0), 0.66, 0.3 + sway, 0.14);
    place(tweeter, v3(lerp(-8, -1.6, e2), -0.64, 0), 0.95, 0.35 + sway, 0.1);
    place(xover, v3(lerp(-8, -0.74, e3), -0.72, 0), 0.72, -0.25 + sway, 0);
    animRings(ringsA, t, win(t, 32.3, 33.9, 0.4) * 0.75);
    animRings(ringsB, t, win(t, 32.3, 33.9, 0.4) * 0.6, { travel: 0.8, grow: 0.28, base: 0.2 });
  }
  composer.render();
}

function updateHUD(t) {
  const { woofer, tweeter, xover } = comp;
  // titles
  titleAnim($('t4'), t, 15.15, TL.toCoax[0] + 0.25);
  titleAnim($('t5'), t, TL.toCoax[1] - 0.15, TL.toSplit[0] + 0.3);
  // scene 4 callouts (projected from the 3D parts)
  const wp = woofer.holder.position, tp = tweeter.holder.position, xp = xover.holder.position;
  const inS4 = t < TL.toCoax[0];
  // anchor on the trim ring itself so the pointer stays attached while the woofer turns and explodes
  const wy = woofer.holder.rotation.y, wOff = 0.03 + (woofer.parts.trim.position.y || 0), th = 2.7;
  const wa = toScreen(
    wp.x + Math.sin(wy) * wOff + 0.93 * Math.cos(th) * Math.cos(wy),
    wp.y + 0.93 * Math.sin(th),
    Math.cos(wy) * wOff - 0.93 * Math.cos(th) * Math.sin(wy));
  callout('c_woofer', $('c_woofer'), wa, -1, t, inS4 ? 16.05 : 99, 18.9, { dx: 46, dy: -92, w: 200 });
  callout('c_tweeter', $('c_tweeter'), toScreen(tp.x + 0.42, tp.y + 0.05, 0.1), 1, t, inS4 ? 16.35 : 99, 18.9, { dx: 62, dy: 44, w: 204 });
  callout('c_xover', $('c_xover'), toScreen(xp.x + 0.6, xp.y + 0.12, 0.1), 1, t, inS4 ? 17.35 : 99, 18.9, { dx: 54, dy: -34, w: 214 });
  listAnim($('list4'), t, [16.0, 17.4, 20.55], TL.toCoax[0] + 0.2);
  carAnim(t, 18.95, TL.toCoax[0] + 0.15);
  // scene 5
  listAnim($('list5'), t, [24.75, 27.1, 28.55], TL.toSplit[0] + 0.25);
  // scene 6
  const c = $('cmp');
  const on = t >= TL.toSplit[0] + 0.2;
  c.style.visibility = on ? 'visible' : 'hidden';
  if (on) {
    const t0 = TL.toSplit[0];
    $('divider').style.transform = `scaleY(${ease.inOut(prog(t, t0 + 0.3, t0 + 1.0)).toFixed(4)})`;
    setVis($('vs'), ease.outBack(prog(t, t0 + 0.75, t0 + 1.15)), { s: lerp(0.5, 1, ease.outBack(prog(t, t0 + 0.75, t0 + 1.15))) });
    setVis($('hdrL'), ease.out(prog(t, t0 + 0.45, t0 + 0.95)), { x: (1 - ease.out(prog(t, t0 + 0.45, t0 + 0.95))) * -40 });
    setVis($('hdrR'), ease.out(prog(t, t0 + 0.55, t0 + 1.05)), { x: (1 - ease.out(prog(t, t0 + 0.55, t0 + 1.05))) * 40 });
    const rows = [[$('row1'), t0 + 1.0], [$('row2'), t0 + 1.55]];
    for (const [row, ti] of rows) {
      const p = ease.out(prog(t, ti, ti + 0.5));
      row.style.opacity = p.toFixed(4);
      row.querySelectorAll('.rule').forEach((r) => (r.style.transform = `scaleX(${ease.inOut(prog(t, ti, ti + 0.7)).toFixed(4)})`));
      row.querySelector('.cell.l').style.transform = `translateX(${((1 - p) * -30).toFixed(2)}px)`;
      row.querySelector('.cell.r').style.transform = `translateX(${((1 - p) * 30).toFixed(2)}px)`;
    }
    // part tags follow the models
    const tag = (el, s, ti) => { el.style.left = `${(s.x - el.offsetWidth / 2).toFixed(1)}px`; el.style.top = `${s.y.toFixed(1)}px`; setVis(el, ease.out(prog(t, ti, ti + 0.4))); };
    tag($('pt_w'), toScreen(wp.x, wp.y - 0.74, 0), t0 + 0.95);
    tag($('pt_t'), toScreen(tp.x, tp.y - 0.38, 0), t0 + 1.05);
    tag($('pt_x'), toScreen(xp.x, xp.y - 0.35, 0), t0 + 1.15);
    tag($('pt_c'), toScreen(coax.holder.position.x, coax.holder.position.y - 1.0, 0), t0 + 1.1);
    // verdict emphasis follows the voice-over
    const L = win(t, 32.35, 33.95, 0.3), R = win(t, 33.95, SOLO ? 38.5 : 35.95, 0.3);
    $('glowL').style.opacity = (L * 0.95).toFixed(3); $('glowR').style.opacity = (R * 0.95).toFixed(3);
    const dimL = 1 - 0.45 * R, dimR = 1 - 0.45 * L;
    for (const [sel, d] of [['.l', dimL], ['.r', dimR]]) c.querySelectorAll(`.cell${sel}, .hdr${sel}`).forEach((e) => (e.style.filter = `brightness(${d.toFixed(3)})`));
  }
}

// ------------------------------------------------------------------ 2D FX: sound waves over the driver shot
function drawFx(t) {
  const cv = $('fx'), g = cv.getContext('2d');
  g.clearRect(0, 0, W, H);
  const amp = ease.smooth(prog(t, TL.fxIn, 14.3));
  if (amp <= 0) return;
  g.lineCap = 'round';
  const emit = (cx, cy, dir) => {
    for (let i = 0; i < 5; i++) {
      const ph = (t * 0.6 + i / 5) % 1;
      const r = 70 + ph * 390;
      const a = Math.sin(Math.PI * ph) * amp;
      const mid = dir > 0 ? -Math.PI * 0.25 : -Math.PI * 0.75, half = 0.6;
      g.beginPath(); g.arc(cx, cy, r, mid - half, mid + half);
      g.strokeStyle = `rgba(120,190,255,${(a * 0.85).toFixed(3)})`; g.lineWidth = 3.2 - ph * 1.4;
      g.shadowColor = 'rgba(47,155,255,0.95)'; g.shadowBlur = 16; g.stroke();
    }
    g.shadowBlur = 0;
    const core = g.createRadialGradient(cx, cy, 0, cx, cy, 150);
    core.addColorStop(0, `rgba(90,175,255,${(0.42 * amp).toFixed(3)})`); core.addColorStop(1, 'rgba(47,155,255,0)');
    g.fillStyle = core; g.fillRect(cx - 150, cy - 150, 300, 300);
  };
  emit(110, 1470, 1); emit(970, 1470, -1);
  // rising blue wash that hands over to the 3D world
  const wash = ease.in(prog(t, 13.9, TL.irisOpen[1])) * 0.5;
  if (wash > 0) { const gr = g.createRadialGradient(540, 900, 0, 540, 900, 1100); gr.addColorStop(0, `rgba(47,155,255,${wash.toFixed(3)})`); gr.addColorStop(1, 'rgba(47,155,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
}

// ------------------------------------------------------------------ logo ending
function drawLogo(t) {
  const a = prog(t, TL.logoIn[0], TL.logoIn[1]);
  const el = $('logo'); el.style.opacity = a.toFixed(4); el.style.visibility = a <= 0 ? 'hidden' : 'visible';
  if (a <= 0) return;
  const lt = t - TL.logoIn[0];
  // metallic sound waves
  const cv = $('lw'), g = cv.getContext('2d');
  g.clearRect(0, 0, W, H);
  const build = ease.out(prog(lt, 0.0, 1.1));
  const band = (cy, flip, hue) => {
    for (let i = 0; i < 11; i++) {
      const k = i / 10;
      g.beginPath();
      for (let x = -20; x <= W + 20; x += 6) {
        const u = x / W;
        const envl = Math.exp(-Math.pow((u - 0.5) / 0.3, 2)) * build;
        const y = cy + flip * (Math.sin(u * 9.5 + lt * 1.7 + k * 2.4) * 62 + Math.sin(u * 21 - lt * 2.6 + k * 5.1) * 22 + Math.sin(u * 3.2 + lt * 0.9 + k) * 74) * envl * (0.35 + 0.65 * k) + (k - 0.5) * 96 * envl;
        if (x === -20) g.moveTo(x, y); else g.lineTo(x, y);
      }
      const gr = g.createLinearGradient(0, 0, W, 0);
      const al = 0.22 + 0.7 * Math.pow(Math.sin(k * Math.PI), 1.5);
      if (hue && i === 5) { gr.addColorStop(0, 'rgba(47,155,255,0)'); gr.addColorStop(0.5, `rgba(90,175,255,${(0.9 * build).toFixed(3)})`); gr.addColorStop(1, 'rgba(47,155,255,0)'); }
      else { gr.addColorStop(0, 'rgba(120,128,140,0)'); gr.addColorStop(0.28, `rgba(150,158,170,${(al * 0.6 * build).toFixed(3)})`); gr.addColorStop(0.5, `rgba(245,247,250,${(al * build).toFixed(3)})`); gr.addColorStop(0.72, `rgba(150,158,170,${(al * 0.6 * build).toFixed(3)})`); gr.addColorStop(1, 'rgba(120,128,140,0)'); }
      g.strokeStyle = gr; g.lineWidth = i === 5 ? 3 : 2.1; g.stroke();
    }
  };
  band(480, 1, true); band(1500, -1, true);
  // soft centre glow behind the wordmark
  const gl = g.createRadialGradient(540, 900, 0, 540, 900, 620);
  gl.addColorStop(0, `rgba(40,110,220,${(0.2 * build).toFixed(3)})`); gl.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gl; g.fillRect(0, 0, W, H);

  const wp = ease.outQuint(prog(lt, 0.12, 0.95));
  const word = $('lg_word');
  word.style.opacity = ease.out(prog(lt, 0.12, 0.6)).toFixed(4);
  word.style.letterSpacing = `${lerp(0.34, 0.1, wp).toFixed(4)}em`; word.style.textIndent = `${lerp(0.34, 0.1, wp).toFixed(4)}em`;
  word.style.transform = `scale(${lerp(1.12, 1, wp).toFixed(4)})`;
  const sh = prog(lt, 0.55, 1.6), shine = $('lg_shine');
  shine.style.letterSpacing = word.style.letterSpacing; shine.style.textIndent = word.style.textIndent; shine.style.transform = word.style.transform;
  shine.style.backgroundImage = `linear-gradient(105deg, rgba(255,255,255,0) ${(sh * 150 - 40).toFixed(1)}%, rgba(255,255,255,0.95) ${(sh * 150 - 25).toFixed(1)}%, rgba(255,255,255,0) ${(sh * 150 - 10).toFixed(1)}%)`;
  shine.style.opacity = sh > 0 && sh < 1 ? '1' : '0';
  const sp = ease.out(prog(lt, 0.4, 0.9));
  setVis($('lg_sub'), sp, { y: (1 - sp) * 14 });
  $('lg_sub').style.letterSpacing = `${lerp(0.8, 0.52, sp).toFixed(4)}em`; $('lg_sub').style.textIndent = `${lerp(0.8, 0.52, sp).toFixed(4)}em`;
  $('lg_rule').style.transform = `scaleX(${ease.inOut(prog(lt, 0.6, 1.05)).toFixed(4)})`;
  const c1 = ease.out(prog(lt, 0.75, 1.15)), c2 = ease.out(prog(lt, 1.0, 1.4));
  setVis($('lg_c1'), c1, { y: (1 - c1) * 18 }); setVis($('lg_c2'), c2, { y: (1 - c2) * 14 });
}

// ------------------------------------------------------------------ motion-graphics open (base layer)
// Stands in for the live-action scenes 1-3 so the film is complete without footage:
//   0-2.5 macro product shot, 2.5-5 title reveal, 5-10 the question, 10-15 the answer.
function updateAlt(t) {
  hideAll(); driftDust(t);
  const { woofer, tweeter, xover } = comp;
  if (t < 2.5) {
    woofer.holder.visible = true;
    place(woofer, v3(0, 0, 0), 1, kf(t, [[0, -0.95], [2.5, -0.45]], ease.smooth), 0.1);
    setCam(kf(t, [[0, 0.32], [2.5, -0.02]], ease.smooth), 0.16, kf(t, [[0, 7.9], [2.5, 6.7]], ease.smooth), 0.2, 0.28);
    animRings(ringsA, t, win(t, 0.7, 2.45, 0.5) * 0.45);
  } else {
    const e = (a) => ease.outQuint(prog(t, a, a + 1.0));
    const sway = Math.sin((t - 2.5) * 0.7) * 0.14;
    setCam(Math.sin((t - 2.5) * 0.35) * 0.05, 0.06, kf(t, [[2.5, 21], [4.6, 18.4], [15.2, 17.8]], ease.out), 0.35);
    woofer.holder.visible = tweeter.holder.visible = xover.holder.visible = coax.holder.visible = true;
    place(woofer, v3(lerp(-7, -1.12, e(2.5)), 0.62, 0), 0.66, 0.3 + sway, 0.14);
    place(tweeter, v3(lerp(-7, -1.6, e(2.62)), -0.64, 0), 0.95, 0.35 + sway, 0.1);
    place(xover, v3(lerp(-7, -0.74, e(2.74)), -0.72, 0), 0.72, -0.25 + sway, 0);
    place(coax, v3(lerp(7, 1.12, e(2.56)), 0.05, 0), 0.92, -0.32 + sway, 0.16);
    const both = win(t, 12.3, 15.3, 0.5) * 0.7;
    animRings(ringsA, t, win(t, 7.35, 8.75, 0.3) * 0.75 + both);
    animRings(ringsB, t, win(t, 7.35, 8.75, 0.3) * 0.6 + both * 0.8, { travel: 0.8, grow: 0.28, base: 0.2 });
    animRings(ringsC, t, win(t, 8.75, 10.1, 0.3) * 0.75 + both);
  }
  composer.render();
}
function reveal(el, t, tin, tout, { dy = 26, clip = true } = {}) {
  const p = ease.outQuint(prog(t, tin, tin + 0.6)), o = 1 - ease.in(prog(t, tout - 0.3, tout));
  el.style.opacity = (ease.out(prog(t, tin, tin + 0.35)) * o).toFixed(4);
  el.style.visibility = t < tin || t >= tout ? 'hidden' : 'visible';
  el.style.transform = `translateY(${((1 - p) * dy).toFixed(2)}px)`;
  if (clip) el.style.clipPath = `inset(-20px ${((1 - p) * 50).toFixed(2)}% -20px ${((1 - p) * 50).toFixed(2)}%)`;
}
function updateAltHUD(t) {
  $('alt_fade').style.opacity = (1 - ease.smooth(prog(t, 0.05, 0.75))).toFixed(4);
  $('alt_flash').style.opacity = (Math.max(0, 1 - Math.abs(t - 2.5) / 0.16) * 0.6).toFixed(4);
  reveal($('alt_brand'), t, 0.5, 99, { dy: 0, clip: false });
  reveal($('alt_l1'), t, 2.7, 5.3); reveal($('alt_vs'), t, 2.95, 5.3, { clip: false }); reveal($('alt_l3'), t, 3.1, 5.3);
  const chip = $('alt_chip'), ans = t >= 10.2;
  if (chip.dataset.s !== String(ans)) { chip.dataset.s = String(ans); chip.textContent = ans ? 'The answer' : 'The question'; }
  if (!ans) reveal(chip, t, 5.5, 10.2, { dy: 10, clip: false }); else reveal(chip, t, 10.2, 99, { dy: 10, clip: false });
  reveal($('alt_q'), t, 6.05, 10.2);
  reveal($('alt_a1'), t, 10.95, 12.35);
  $('alt_a2').style.visibility = t >= 12.3 ? 'visible' : 'hidden';
  reveal($('alt_a2a'), t, 12.4, 99); reveal($('alt_a2b'), t, 13.2, 99);
  if (t >= 2.5) {
    const tag = (el, s, ti) => { el.style.left = `${(s.x - el.offsetWidth / 2).toFixed(1)}px`; el.style.top = `${s.y.toFixed(1)}px`; const a = ease.out(prog(t, ti, ti + 0.4)); el.style.opacity = a.toFixed(4); el.style.visibility = a <= 0 ? 'hidden' : 'visible'; };
    tag($('alt_tagL'), toScreen(-1.17, -1.22, 0), 7.45);
    tag($('alt_tagR'), toScreen(1.12, -1.22, 0), 8.75);
  } else { $('alt_tagL').style.visibility = $('alt_tagR').style.visibility = 'hidden'; }
}

// ------------------------------------------------------------------ frame driver
function renderAt(t) {
  if (LAYER === 'base') { updateAlt(t); updateAltHUD(t); return true; }
  // sound-wave FX layer
  const fxOn = t >= TL.fxIn && t < TL.irisOpen[1] + 0.05;
  $('wavesFx').style.visibility = fxOn ? 'visible' : 'hidden';
  if (fxOn) drawFx(t);
  // 3D stage with iris reveal / close
  const stageOn = t >= TL.irisOpen[0] && t < (SOLO ? TL.logoIn[1] : TL.irisClose[1]);
  const stage = $('stage'); stage.style.visibility = stageOn ? 'visible' : 'hidden';
  const ring = $('irisRing'); let ringA = 0, R = 2300;
  if (stageOn) {
    if (t < TL.irisOpen[1]) { const p = ease.inOut(prog(t, TL.irisOpen[0], TL.irisOpen[1])); R = p * 1500; ringA = 1 - p * p; }
    else if (!SOLO && t >= TL.irisClose[0]) { const p = ease.inOut(prog(t, TL.irisClose[0], TL.irisClose[1])); R = (1 - p) * 1500; ringA = p; }
    stage.style.clipPath = R >= 1500 ? 'none' : `circle(${R.toFixed(1)}px at 540px 900px)`;
    update3D(t); updateHUD(t);
  }
  ring.setAttribute('r', Math.max(1, R).toFixed(1)); ring.setAttribute('opacity', (stageOn && R < 1500 ? ringA : 0).toFixed(3));
  ring.setAttribute('stroke-width', (3 + 5 * ringA).toFixed(1));
  ring.style.filter = 'drop-shadow(0 0 14px rgba(47,155,255,1))';
  drawLogo(t);
  return true;
}

async function init() {
  await Promise.all(['500 20px "Saira Condensed"', '600 20px "Saira Condensed"', '700 20px "Saira Condensed"', '800 20px "Saira Condensed"', '600 20px "Saira"', '800 20px "Saira"', '500 20px "InterW"', '600 20px "InterW"'].map((f) => document.fonts.load(f)));
  await document.fonts.ready;
  initStage();
  if (LAYER === 'base') {
    document.body.classList.add('base');
    for (const id of ['wavesFx', 'iris', 'logo']) $(id).style.display = 'none';
  } else {
    for (const id of ['alt_flash', 'alt_fade']) $(id).style.display = 'none';
    buildCar();
  }
  window.renderAt = renderAt;
  window.TL = TL;
  const t = params.get('t');
  if (t !== null) renderAt(parseFloat(t));
  window.rendererReady = true;
}
init().catch((e) => { console.error(e); window.rendererError = String(e && e.stack || e); });
