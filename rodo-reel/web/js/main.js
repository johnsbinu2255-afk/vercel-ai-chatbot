// RODO ACCESSORIES — "Your tyres are trying to tell you something."
// Deterministic motion-graphics timeline: window.renderFrame(t) draws the exact frame for time t (seconds).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildTyre, buildRim } from './tyre.js';
import { HUD } from './hud.js';
import { Texts } from './texts.js';
import { clamp, lerp, prog, ease, smooth, pulse } from './util.js';

const W = 1080, H = 1920;
// 3D layer renders below output size (software GL is slow); typography + HUD stay at full 1080x1920.
const GL_SCALE = parseFloat(new URLSearchParams(location.search).get('gl') || '0.75');
const GW = Math.round(W * GL_SCALE), GH = Math.round(H * GL_SCALE);
const TL = await (await fetch('./timeline.json')).json();

// ---------------------------------------------------------------- renderer
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(GW, GH, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(36, W / H, 0.05, 200);
scene.add(camera);

const rt = new THREE.WebGLRenderTarget(GW, GH, { type: THREE.HalfFloatType, samples: 0 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(GW / 2, GH / 2), 0.55, 0.55, 0.86);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------- environments (softbox studio reflections)
const pmrem = new THREE.PMREMGenerator(renderer);
function softboxEnv(workshop) {
  const s = new THREE.Scene();
  s.background = new THREE.Color(workshop ? 0x2a2c30 : 0x000000);
  const box = (w, h, color, intensity, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(...look); s.add(m);
  };
  box(14, 4, 0xffffff, workshop ? 3.2 : 2.4, [0, 9, 0], [0, 0, 0]);          // overhead softbox
  box(1.0, 9, 0xffffff, workshop ? 4 : 3.2, [8, 1, 3], [0, 0, 0]);           // strip right-front
  box(1.0, 9, 0xffffff, workshop ? 3 : 1.6, [-6, 1, -6], [0, 0, 0]);         // strip back-left
  box(6, 0.6, 0xff2020, workshop ? 0.6 : 2.2, [3, -1.5, -8], [0, 0, 0]);      // red kicker
  if (workshop) {
    box(20, 6, 0x9aa0a8, 1.0, [0, 2, -10], [0, 0, 0]);
    box(20, 6, 0x8a9098, 0.8, [0, 2, 10], [0, 0, 0]);
    box(30, 30, 0x55585e, 0.6, [0, -5, 0], [0, 0, 0]);
    for (let i = -2; i <= 2; i++) box(2.4, 0.25, 0xffffff, 6, [i * 2.8, 7.5, 4], [i * 2.8, 0, 4]);
  }
  return pmrem.fromScene(s, 0.035).texture;
}
const T0 = performance.now(); const log = (m) => console.log(`[init ${((performance.now() - T0) / 1000).toFixed(1)}s] ${m}`);
const envDark = softboxEnv(false);
log('env dark');
const envShop = softboxEnv(true);
scene.environment = envDark;

// ---------------------------------------------------------------- backdrop (camera-attached)
function shopBackdrop() {
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 1920);
  gr.addColorStop(0, '#2b2e33'); gr.addColorStop(0.45, '#4a4e55'); gr.addColorStop(0.62, '#5d6168'); gr.addColorStop(1, '#1d1f22');
  g.fillStyle = gr; g.fillRect(0, 0, 1080, 1920);
  // hexagon light grid (out of focus)
  g.filter = 'blur(5px)';
  g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 9;
  const R = 120, hx = R * Math.sqrt(3);
  for (let row = -1; row < 6; row++) {
    for (let col = -1; col < 6; col++) {
      const cx = col * hx + (row % 2 ? hx / 2 : 0) + 20, cy = row * R * 1.5 + 80;
      if (cy > 820) continue;
      g.beginPath();
      for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; g.lineTo(cx + R * 0.82 * Math.cos(a), cy + R * 0.82 * Math.sin(a) * 0.55); }
      g.closePath(); g.stroke();
    }
  }
  // wall panels + soft floor line glow
  g.filter = 'blur(14px)';
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 1060, 1080, 40);
  g.fillStyle = 'rgba(227,32,42,0.35)'; g.fillRect(0, 1110, 1080, 10);
  g.filter = 'none';
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const backdropMat = new THREE.ShaderMaterial({
  depthWrite: false, depthTest: false,
  uniforms: { uShop: { value: 0 }, uShopTex: { value: shopBackdrop() }, uGlow: { value: new THREE.Vector3(0.0, 0.0, 0.0) }, uGlowPos: { value: new THREE.Vector2(0.5, 0.62) }, uRed: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `varying vec2 vUv; uniform float uShop, uRed; uniform sampler2D uShopTex; uniform vec3 uGlow; uniform vec2 uGlowPos;
    void main(){
      vec2 p = (vUv - uGlowPos) * vec2(1.0, 1.78);
      float d = length(p);
      vec3 dark = uGlow * exp(-d*d*3.2) + vec3(0.012,0.012,0.014);
      dark += vec3(0.55,0.02,0.02) * uRed * exp(-pow((d-0.36)*7.0, 2.0));
      vec3 shop = texture2D(uShopTex, vUv).rgb * 0.62;
      gl_FragColor = vec4(mix(dark, shop, uShop), 1.0);
      #include <colorspace_fragment>
    }`,
});
const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), backdropMat);
backdrop.renderOrder = -10; backdrop.frustumCulled = false;
camera.add(backdrop);
function fitBackdrop() {
  const d = 60; backdrop.position.set(0, 0, -d);
  const h = 2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.02;
  backdrop.scale.set(h * camera.aspect, h, 1);
}

// ---------------------------------------------------------------- floor (workshop)
const floorMat = new THREE.MeshPhysicalMaterial({ color: 0x232528, metalness: 0.2, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.18, transparent: true, opacity: 0 });
const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), floorMat);
floor.rotation.x = -Math.PI / 2; floor.position.y = -1.0;
scene.add(floor);
const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 128); r.addColorStop(0, 'rgba(0,0,0,0.9)'); r.addColorStop(0.5, 'rgba(0,0,0,0.45)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); })();
const contact = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0 }));
contact.rotation.x = -Math.PI / 2; contact.position.y = -0.995;
scene.add(contact);

// ---------------------------------------------------------------- wheel
const envMats = [];
log('pre tyre');
const tyre = buildTyre();
log('tyre');
envMats.push(tyre.mat);
const rim = buildRim(envMats);
const wheelRoot = new THREE.Group();   // position / wobble
const spin = new THREE.Group();        // rolling rotation about X
const tyreSlot = new THREE.Group();    // tyre offset for fitting
const rimSlot = new THREE.Group();
tyre.mesh.rotation.z = -Math.PI / 2;   // lathe Y axis -> world X axle
tyreSlot.add(tyre.mesh);
rimSlot.add(rim.group);
spin.add(tyreSlot, rimSlot);
wheelRoot.add(spin);
wheelRoot.add(rim.caliper); // caliper does not spin
scene.add(wheelRoot);

// Spin angle that places the damage (lathe angle phi = 2*pi*u) at angle beta (from +Y toward +Z) on the visible face.
const damagePhi = tyre.crackU * Math.PI * 2;
const spinForDamage = (beta) => beta - Math.PI / 2 - damagePhi;
// valve sits at local (y=0, z=-0.6): beta0 = 270deg
const spinForValve = (beta) => beta - 1.5 * Math.PI;

// ---------------------------------------------------------------- lights
const key = new THREE.SpotLight(0xfff4ea, 0, 30, 0.42, 0.7, 1.2); key.position.set(4, 5, 5);
const fill = new THREE.DirectionalLight(0xcfd8ff, 0); fill.position.set(-3, 1, 4);
const rimW = new THREE.SpotLight(0xffffff, 0, 30, 0.5, 0.6, 1.0); rimW.position.set(-5.0, 3.2, -1.5);
const rimR = new THREE.SpotLight(0xff1e1e, 0, 30, 0.5, 0.6, 1.0); rimR.position.set(-2.0, 0.6, -5.5);
const top = new THREE.SpotLight(0xffffff, 0, 30, 0.35, 0.8, 1.2); top.position.set(0.3, 6, 0.8);
const amb = new THREE.HemisphereLight(0xffffff, 0x202020, 0);
for (const l of [key, rimW, rimR, top]) { l.target.position.set(0, 0, 0); scene.add(l.target); }
scene.add(key, fill, rimW, rimR, top, amb);

// ---------------------------------------------------------------- pulse rings (scene 1)
const rings = [];
for (let i = 0; i < 4; i++) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.012, 12, 200), new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.rotation.y = Math.PI / 2; m.position.x = 0.32; scene.add(m); rings.push(m);
}

// ---------------------------------------------------------------- dust particles + rain
function rand(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
const dustN = 1400, r1 = rand(11);
const dustGeo = new THREE.BufferGeometry();
const dp = new Float32Array(dustN * 3), ds = new Float32Array(dustN);
for (let i = 0; i < dustN; i++) { dp[i * 3] = (r1() - 0.5) * 7; dp[i * 3 + 1] = (r1() - 0.5) * 7; dp[i * 3 + 2] = (r1() - 0.5) * 7; ds[i] = r1(); }
dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
dustGeo.setAttribute('seed', new THREE.BufferAttribute(ds, 1));
const dustMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: { value: 0 }, uAlpha: { value: 0.6 }, uColor: { value: new THREE.Color(1, 0.93, 0.85) } },
  vertexShader: `attribute float seed; uniform float uTime; varying float vS;
    void main(){ vec3 p = position;
      p.y = mod(p.y + uTime * (0.03 + seed * 0.05) + 3.5, 7.0) - 3.5;
      p.x += sin(uTime * 0.3 + seed * 40.0) * 0.15; p.z += cos(uTime * 0.25 + seed * 30.0) * 0.15;
      vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
      gl_PointSize = (2.0 + seed * 5.0) * (6.0 / -mv.z); vS = seed; }`,
  fragmentShader: `uniform float uAlpha; uniform vec3 uColor; varying float vS;
    void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * uAlpha * (0.25 + 0.75 * vS); gl_FragColor = vec4(uColor * a, a); }`,
});
const dust = new THREE.Points(dustGeo, dustMat); scene.add(dust);

const rainN = 900, r2 = rand(23);
const rainPos = new Float32Array(rainN * 6), rainSeed = new Float32Array(rainN * 2), rainEnd = new Float32Array(rainN * 2);
for (let i = 0; i < rainN; i++) {
  const x = (r2() - 0.5) * 5, y = r2() * 6, z = (r2() - 0.5) * 5, s = r2();
  rainPos.set([x, y, z, x, y, z], i * 6); rainSeed.set([s, s], i * 2); rainEnd.set([0, 1], i * 2);
}
const rainGeo = new THREE.BufferGeometry();
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
rainGeo.setAttribute('seed', new THREE.BufferAttribute(rainSeed, 1));
rainGeo.setAttribute('endp', new THREE.BufferAttribute(rainEnd, 1));
const rainMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 } },
  vertexShader: `attribute float seed; attribute float endp; uniform float uTime; varying float vA;
    void main(){ vec3 p = position; float sp = 7.0 + seed * 4.0;
      p.y = mod(p.y - uTime * sp, 6.0) - 2.0 + endp * 0.22; p.x -= endp * 0.05;
      vA = endp; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
  fragmentShader: `uniform float uAlpha; varying float vA; void main(){ float a = uAlpha * (0.15 + 0.5 * vA); gl_FragColor = vec4(vec3(0.75,0.85,1.0) * a, a); }`,
});
const rain = new THREE.LineSegments(rainGeo, rainMat); rain.frustumCulled = false; scene.add(rain);

// ---------------------------------------------------------------- tread depth probe (scene 5)
const probe = new THREE.Group();
{
  const sil = rim.materials.silver, dk = rim.materials.dark;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.36, 0.07), dk);
  body.position.y = 0.42; probe.add(body);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.12), new THREE.MeshBasicMaterial({ color: 0x15ff7a }));
  screen.position.set(0, 0.47, 0.036); probe.add(screen);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.025, 0.06), sil); foot.position.y = 0.06; probe.add(foot);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 16), sil); shaft.position.y = 0.2; probe.add(shaft);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.12, 12), sil); pin.position.y = 0.0; probe.add(pin);
  probe.userData.screen = screen;
}
probe.visible = false; scene.add(probe);

// balancing weight
const weight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.12), rim.materials.silver);
weight.position.set(-0.15, 0.6, 0); weight.visible = false; spin.add(weight);

// ---------------------------------------------------------------- overlays
const hud = new HUD(document.getElementById('hud'));
const texts = new Texts(document.getElementById('texts'));
const $ = (id) => document.getElementById(id);
const flash = $('flash'), streak = $('streak'), textshade = $('textshade'), topshade = $('topshade');
const grain = $('grain'), gctx = grain.getContext('2d'), gimg = gctx.createImageData(270, 480);

function drawGrain(f) {
  let s = (f * 7919 + 13) % 2147483647 || 1;
  const d = gimg.data;
  for (let i = 0; i < d.length; i += 4) { s = (s * 16807) % 2147483647; const v = (s & 255); d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  gctx.putImageData(gimg, 0, 0);
}

const v3 = new THREE.Vector3();
function toScreen(x, y, z, obj) {
  v3.set(x, y, z);
  if (obj) obj.localToWorld(v3);
  v3.project(camera);
  return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * H, behind: v3.z > 1 };
}

// ---------------------------------------------------------------- camera helpers
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function setCam(pos, look, fov = 36, roll = 0, up = null) {
  camera.position.copy(pos);
  camera.up.copy(up || V(0, 1, 0));
  camera.lookAt(look);
  if (roll) camera.rotateZ(roll);
  if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  fitBackdrop();
}
const vl = (a, b, t) => a.clone().lerp(b, t);
// orbit around Y: radius, angle(rad), height
const orbit = (r, a, h, c = V(0, 0, 0)) => V(c.x + r * Math.cos(a), c.y + h, c.z + r * Math.sin(a));

// ---------------------------------------------------------------- per-frame state
function resetState() {
  wheelRoot.position.set(0, 0, 0); wheelRoot.rotation.set(0, 0, 0);
  tyreSlot.position.set(0, 0, 0); rimSlot.position.set(0, 0, 0);
  const U = tyre.U;
  U.uWear.value = 0; U.uWearL.value = 0; U.uWearC.value = 0; U.uWearR.value = 0; U.uCup.value = 0; U.uHeat.value = 0;
  U.uCrack.value = 0; U.uCrackGlow.value = 0;
  tyre.setBulge(0);
  for (const l of [key, fill, rimW, rimR, top, amb]) l.intensity = 0;
  key.color.set(0xfff4ea); fill.color.set(0xcfd8ff);
  for (const r of rings) r.material.opacity = 0;
  rainMat.uniforms.uAlpha.value = 0;
  dustMat.uniforms.uAlpha.value = 0.55;
  floorMat.opacity = 0; contact.material.opacity = 0;
  backdropMat.uniforms.uShop.value = 0; backdropMat.uniforms.uRed.value = 0;
  backdropMat.uniforms.uGlow.value.set(0.05, 0.05, 0.06); backdropMat.uniforms.uGlowPos.value.set(0.5, 0.62);
  probe.visible = false; weight.visible = false;
  renderer.toneMappingExposure = 1.0;
  bloom.strength = 0.5; bloom.threshold = 0.86;
  setEnv(envDark, 0.6);
  canvas.style.filter = ''; canvas.style.transform = '';
  flash.style.opacity = 0; streak.style.opacity = 0; textshade.style.opacity = 0; topshade.style.opacity = 0;
}
let currentEnv = null;
function setEnv(env, intensity) {
  if (currentEnv !== env) { scene.environment = env; currentEnv = env; }
  for (const m of envMats) m.envMapIntensity = intensity;
}

// whip transition: blur + slide around a cut at time tc
function whip(t, tc, dir = 1, len = 0.22) {
  const a = 1 - clamp(Math.abs(t - tc) / len);
  if (a <= 0) return;
  const e = a * a;
  canvas.style.filter = `blur(${(e * 26).toFixed(1)}px) brightness(${(1 + e * 0.6).toFixed(2)})`;
  canvas.style.transform = `translateY(${(dir * (t < tc ? -1 : 1) * e * 140).toFixed(1)}px) scale(${1 + e * 0.06})`;
  streak.style.opacity = (e * 0.6).toFixed(3);
  streak.style.transform = `translateX(${((t - tc) / len * 600).toFixed(0)}px)`;
}

// ================================================================ SCENES
const S = TL.scenes;

function scene1(t) {
  // 0.25 TPMS warning flickers on; 1.4 push through; tyre emerges from rim light; 2.0 hero text.
  const reveal = ease.inOut(prog(t, 0.9, 2.0));
  rimR.intensity = 260 * ease.out(prog(t, 0.55, 1.4));
  rimW.intensity = 180 * ease.out(prog(t, 1.05, 1.9));
  key.intensity = 110 * reveal + 25 * pulse(t, 2.0, 0.5);
  top.intensity = 40 * reveal;
  fill.intensity = 0.25 * reveal;
  setEnv(envDark, 0.15 + 0.55 * reveal);
  backdropMat.uniforms.uGlow.value.set(0.06, 0.06, 0.07).multiplyScalar(reveal);
  backdropMat.uniforms.uGlowPos.value.set(0.5, 0.66);
  backdropMat.uniforms.uRed.value = 0.3 * ease.out(prog(t, 0.6, 1.5)) * (1 - 0.6 * prog(t, 2.0, 4));
  dustMat.uniforms.uAlpha.value = 0.65 * reveal;
  const p = ease.out(prog(t, 0, 6.4));
  const pos = vl(V(6.6, 0.9, 5.4), V(4.7, 0.45, 3.9), p);
  setCam(pos, V(0, -0.75 + 0.1 * p, 0), 38, -0.05 + 0.04 * p);
  spin.rotation.x = -0.15 * t - 0.4;
  for (let i = 0; i < rings.length; i++) {
    const t0 = TL.sfx.pulse[i]; const q = prog(t, t0, t0 + 1.0);
    rings[i].material.opacity = q > 0 && q < 1 ? 0.95 * (1 - q) * (1 - q) : 0;
    const s = 1.02 + 0.85 * ease.out(q); rings[i].scale.set(s, s, s);
  }
  bloom.strength = 0.45 + 0.35 * pulse(t, 2.0, 0.6) + 0.25 * pulse(t, 3.7, 0.6);
  flash.style.opacity = (0.55 * pulse(t, 2.0, 0.25) + 0.25 * pulse(t, 3.7, 0.25)).toFixed(3);
  textshade.style.opacity = (0.9 * prog(t, 1.8, 2.4)).toFixed(3);
  whip(t, S.s1_hook[1], 1);
}

function scene2(t) {
  const wear = ease.inOut(prog(t, 8.4, 12.9));
  tyre.U.uWear.value = 0.85 * wear;
  const wet = ease.inOut(prog(t, 11.0, 12.2));
  key.intensity = 140 - 40 * wet; top.intensity = 90; rimW.intensity = 160; rimR.intensity = 70 + 60 * pulse(t, 7.0, 0.8);
  fill.intensity = 0.25;
  key.color.setRGB(1, 0.96 - 0.08 * wet, 0.92 + 0.08 * wet);
  setEnv(envDark, 0.75);
  rainMat.uniforms.uAlpha.value = 0.55 * wet;
  dustMat.uniforms.uAlpha.value = 0.5 * (1 - wet);
  backdropMat.uniforms.uGlow.value.set(0.05, 0.055, 0.07 + 0.03 * wet);
  backdropMat.uniforms.uGlowPos.value.set(0.5, 0.5);
  const p = ease.inOut(prog(t, S.s2_tread[0], S.s2_tread[1]));
  const pos = vl(V(0.62, 1.78, 1.92), V(0.18, 1.5, 1.62), p);
  const shake = wet * 0.004 * Math.sin(t * 37.0);
  setCam(pos.add(V(shake, shake * 0.5, 0)), V(0, 0.80, 0.55), 34, 0.03 - 0.05 * p);
  spin.rotation.x = 0.28 * (t - 6.4) + 0.3; // rolls toward camera
  textshade.style.opacity = 0.75; topshade.style.opacity = 0.9;
  whip(t, S.s2_tread[0], 1);
  whip(t, S.s2_tread[1], -1);
}

function scene3(t) {
  tyre.U.uCrack.value = 1;
  tyre.setBulge(1);
  const det = prog(t, 19.3, 19.6);
  tyre.U.uCrackGlow.value = det * (0.35 + 0.25 * Math.sin(t * 6.0));
  key.intensity = 130; top.intensity = 30; rimW.intensity = 160; rimR.intensity = 90; fill.intensity = 0.3;
  key.position.set(5, 3.5, 2.5);
  setEnv(envDark, 0.7);
  backdropMat.uniforms.uGlow.value.set(0.05, 0.05, 0.06);
  backdropMat.uniforms.uGlowPos.value.set(0.5, 0.52);
  const target = spinForDamage(THREE.MathUtils.degToRad(42));
  const q = prog(t, S.s3_sidewall[0], 19.4);
  spin.rotation.x = target - 1.9 * Math.pow(1 - q, 2);
  const p1 = ease.inOut(prog(t, 16.0, 21.0)), p2 = ease.inOut(prog(t, 21.0, 25.8));
  // damage point in world (spin applied): sidewall face ~x 0.31, radius ~0.84 at beta=42deg
  spin.updateMatrixWorld(true);
  const crackW = tyre.mesh.localToWorld(tyre.crackPoint());
  const bulgeW = tyre.mesh.localToWorld(tyre.bulgePoint());
  const dmg = crackW.clone().lerp(bulgeW, 0.5);
  const pos = vl(vl(V(4.4, 0.9, 2.6), V(3.9, 0.55, 1.7), p1), V(2.25, 0.85, 1.05), p2);
  const look = vl(vl(V(0, -0.35, 0.1), V(0.1, -0.2, 0.15), p1), dmg.clone().add(V(0, -0.3, 0)), p2);
  setCam(pos, look, 36, -0.02);
  textshade.style.opacity = 0.7; topshade.style.opacity = 0.9;
  whip(t, S.s3_sidewall[0], -1);
  whip(t, S.s3_sidewall[1], 1);
  return { crack: crackW, bulge: bulgeW };
}

function scene4(t) {
  const U = tyre.U;
  const m = (a, b) => ease.inOut(prog(t, a, a + 0.5)) * (1 - ease.inOut(prog(t, b, b + 0.5)));
  U.uWearL.value = 0.95 * m(27.4, 30.2) + 0.85 * m(30.4, 33.2);
  U.uWearR.value = 0.85 * m(30.4, 33.2);
  U.uCup.value = 0.9 * m(33.4, 40);
  U.uWear.value = 0.0;
  U.uHeat.value = ease.out(prog(t, 27.0, 27.8));
  key.intensity = 0; top.intensity = 120; rimW.intensity = 80; rimR.intensity = 15; fill.intensity = 0.2; amb.intensity = 0.1;
  top.position.set(-0.6, 5, -1.2);
  key.intensity = 60; key.position.set(-3, 4, 1);
  setEnv(envDark, 0.6);
  backdropMat.uniforms.uGlow.value.set(0.03, 0.03, 0.035);
  const p = ease.inOut(prog(t, S.s4_uneven[0], S.s4_uneven[1]));
  const h = lerp(3.55, 3.2, p);
  setCam(V(0.0, h, 0.35 - 0.1 * p), V(0, 1, 0.12), 32, 0, V(0, 0, -1));
  camera.rotateZ(lerp(-0.1, 0.02, p));
  spin.rotation.x = -0.18 * (t - 26) + 1.0;
  topshade.style.opacity = 0.9; textshade.style.opacity = 0.85;
  whip(t, S.s4_uneven[0], 1);
  whip(t, S.s4_uneven[1], -1, 0.3);
}

function scene5(t) {
  // bright workshop
  const shopIn = ease.inOut(prog(t, 35.9, 36.5));
  backdropMat.uniforms.uShop.value = shopIn;
  setEnv(envShop, 1.0);
  renderer.toneMappingExposure = 1.05;
  key.intensity = 150; key.position.set(4, 5, 5); top.intensity = 110; top.position.set(0.3, 6, 0.8);
  rimW.intensity = 90; rimR.intensity = 25; fill.intensity = 0.7; amb.intensity = 0.55;
  dustMat.uniforms.uAlpha.value = 0.25;
  floorMat.opacity = 1; contact.material.opacity = 0.85;
  bloom.strength = 0.35; bloom.threshold = 0.92;
  flash.style.opacity = (0.95 * pulse(t, 36.0, 0.5)).toFixed(3);
  topshade.style.opacity = 0.55; textshade.style.opacity = 0.35;

  let out = {};
  if (t < 39.0) { // a) pressure check
    const p = ease.inOut(prog(t, 36.0, 39.0));
    spin.rotation.x = spinForValve(THREE.MathUtils.degToRad(205));
    setCam(vl(V(3.6, 0.5, 2.4), V(3.0, 0.15, 1.65), p), V(0.15, -0.4, -0.05), 34);
    out.valve = () => toScreen(0.205, 0.0, -0.61, rimSlot);
  } else if (t < 41.3) { // b) tread depth gauge
    const p = ease.inOut(prog(t, 39.0, 41.3));
    spin.rotation.x = 0.4;
    setCam(vl(V(0.95, 1.55, 1.75), V(0.7, 1.42, 1.5), p), V(0.0, 0.92, 0.42), 34, 0.02);
    probe.visible = true;
    const d = ease.outBack(prog(t, 39.3, 39.95));
    const a = Math.PI * 0.25; // probe sits at 45deg on the crown
    probe.position.set(-0.13, Math.cos(a) * (1.0 + 0.45 * (1 - d)), Math.sin(a) * (1.0 + 0.45 * (1 - d)));
    probe.rotation.set(a, 0, 0);
    out.probe = () => toScreen(0, 0.5, 0.0, probe);
  } else if (t < 43.8) { // c) fitting: rim slides into the tyre
    const p = ease.inOut(prog(t, 41.3, 43.8));
    spin.rotation.x = 0.2;
    const f = ease.inOut(prog(t, 41.5, 43.1));
    rimSlot.position.x = -1.9 * (1 - f);
    wheelRoot.position.y = 0.0;
    setCam(vl(V(3.0, 0.9, -2.8), V(3.3, 0.6, -2.3), p), V(-0.55, -0.35, 0), 36);
    flash.style.opacity = (0.25 * pulse(t, 43.1, 0.3)).toFixed(3);
  } else if (t < 46.2) { // d) balancing
    const p = ease.inOut(prog(t, 43.8, 46.2));
    const sp = prog(t, 43.8, 44.4);
    spin.rotation.x = -(t - 43.8) * 9.0 * ease.inOut(sp) - 0.3;
    const wob = Math.exp(-3.0 * Math.max(0, t - 44.6)) * (t > 44.2 ? 1 : prog(t, 43.8, 44.2));
    wheelRoot.rotation.z = 0.035 * wob * Math.sin(t * 50);
    wheelRoot.rotation.y = 0.02 * wob * Math.cos(t * 50);
    weight.visible = t > 44.9;
    setCam(vl(V(4.0, 0.25, 0.6), V(3.6, 0.1, 0.25), p), V(0, -0.35, 0), 34);
    out.balance = { wob: wob };
  } else { // e) hero
    const p = ease.inOut(prog(t, 46.2, 49.0));
    spin.rotation.x = -0.6 * (t - 46.2);
    setCam(orbit(4.0, lerp(0.35, 0.75, p), lerp(-0.45, -0.2, p)), V(0, -0.55, 0), 36);
    rimR.intensity = 140; key.intensity = 190;
  }
  for (const c of [39.0, 41.3, 43.8, 46.2]) whip(t, c, 1, 0.16);
  whip(t, S.s5_solution[1], -1, 0.25);
  return out;
}

function scene6(t) {
  const lift = ease.inOut(prog(t, 52.9, 54.2));
  key.intensity = 70 + 80 * (1 - prog(t, 49, 50)); rimW.intensity = 220; rimR.intensity = 260 + 120 * pulse(t, 53.45, 1.0);
  top.intensity = 30; fill.intensity = 0.15;
  setEnv(envDark, 0.55);
  backdropMat.uniforms.uRed.value = 0.4 + 0.4 * lift;
  backdropMat.uniforms.uGlow.value.set(0.045, 0.045, 0.05);
  backdropMat.uniforms.uGlowPos.value.set(0.5, lerp(0.58, 0.72, lift));
  dustMat.uniforms.uAlpha.value = 0.7;
  floorMat.opacity = 0.0; contact.material.opacity = 0;
  spin.rotation.x = -0.35 * (t - 49);
  const p = ease.out(prog(t, 49.0, 53.0));
  // before lift: wheel framed upper-centre; after: smaller, high in frame for the logo lockup
  const pos0 = vl(V(4.3, 0.4, 2.2), V(3.6, 0.2, 1.55), p);
  const pos1 = V(5.8, 0.2, 1.05);
  setCam(vl(pos0, pos1, lift), vl(V(0, -0.85, 0), V(0, -1.35, 0), lift), 36, 0);
  bloom.strength = 0.55 + 0.9 * pulse(t, 53.45, 0.8);
  flash.style.opacity = (0.65 * pulse(t, 53.45, 0.3) + 0.25 * pulse(t, 49.0, 0.25)).toFixed(3);
  textshade.style.opacity = 0.9; topshade.style.opacity = 0.0;
  whip(t, S.s6_brand[0], 1);
}

// ================================================================ frame
const LIGHT_SCALE = 0.3;
window.renderFrame = (t) => {
  resetState();
  dustMat.uniforms.uTime.value = t; rainMat.uniforms.uTime.value = t;
  let info = null;
  if (t < S.s1_hook[1]) scene1(t);
  else if (t < S.s2_tread[1]) scene2(t);
  else if (t < S.s3_sidewall[1]) info = scene3(t);
  else if (t < S.s4_uneven[1]) scene4(t);
  else if (t < S.s5_solution[1]) info = scene5(t);
  else scene6(t);
  for (const l of [key, rimW, rimR, top]) l.intensity *= LIGHT_SCALE;
  camera.updateMatrixWorld(true);
  scene.updateMatrixWorld(true);
  if (info) for (const k in info) if (typeof info[k] === 'function') info[k] = info[k]();

  window.LAST_INFO = info;
  composer.render();
  hud.update(t, { toScreen, info, tyre, spin, camera, W, H, tyreSlot });
  texts.update(t);
  drawGrain(Math.round(t * 30));
};

window.__dbg = { renderer, composer, rt, bloom, tyre, scene, envMats };
log('scene built');
await document.fonts.ready;
await document.fonts.load('900 100px "Inter Display"');
await document.fonts.load('600 24px "JetBrains Mono"');
log('fonts');
window.renderFrame(0);
log('first frame');
window.READY = true;
