// Procedural, physically plausible car-speaker models.
// Every model is built with its acoustic axis on +Y (front = +Y).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { lathe, arc, planarUV, weaveTextures, brushedTexture, ridgeTexture, noiseTexture } from './lib.js';

export const BLUE = 0x1f8fff;

export function makeMaterials() {
  const weave = weaveTextures(7);
  const brushed = brushedTexture(3);
  const ridges = ridgeTexture(46);
  const grain = noiseTexture(11, 256, 110, 200, [6, 6]);
  const P = THREE.MeshPhysicalMaterial;
  const D = THREE.DoubleSide;
  const M = {
    aluminum: new P({ color: 0xcfd4dc, metalness: 1, roughness: 0.46, roughnessMap: brushed, side: D }),
    polished: new P({ color: 0xe6e9ee, metalness: 1, roughness: 0.12, side: D }),
    blackAnod: new P({ color: 0x16181c, metalness: 1, roughness: 0.5, roughnessMap: brushed, side: D }),
    steel: new P({ color: 0x1b1d21, metalness: 0.85, roughness: 0.42, side: D }),
    zinc: new P({ color: 0xb4bac3, metalness: 1, roughness: 0.34, side: D }),
    zincBrushed: new P({ color: 0x8f96a0, metalness: 1, roughness: 0.66, roughnessMap: brushed, side: D }),
    rubber: new P({ color: 0x0b0b0d, metalness: 0, roughness: 0.58, sheen: 0.4, sheenRoughness: 0.5, sheenColor: 0x3a3f48, side: D }),
    cone: new P({ color: 0xffffff, map: weave.map, bumpMap: weave.bump, bumpScale: 0.6, metalness: 0.25, roughness: 0.48, clearcoat: 0.9, clearcoatRoughness: 0.16, side: D }),
    dustcap: new P({ color: 0x0c0d10, metalness: 0.2, roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.25, side: D }),
    spider: new P({ color: 0xa27b2c, metalness: 0, roughness: 0.9, sheen: 0.6, sheenColor: 0xd9b86a, side: D }),
    former: new P({ color: 0x33230f, metalness: 0.1, roughness: 0.45, side: D }),
    copper: new P({ color: 0xc87f3f, metalness: 1, roughness: 0.34, bumpMap: ridges, bumpScale: 0.5, side: D }),
    ferrite: new P({ color: 0x1c1d21, metalness: 0.15, roughness: 0.82, bumpMap: grain, bumpScale: 0.15, side: D }),
    plastic: new P({ color: 0x101114, metalness: 0, roughness: 0.52, side: D }),
    softTouch: new P({ color: 0x15171b, metalness: 0, roughness: 0.78, bumpMap: grain, bumpScale: 0.25, side: D }),
    doorSkin: new P({ color: 0x343840, metalness: 0, roughness: 0.66, bumpMap: grain, bumpScale: 0.3, sheen: 0.5, sheenColor: 0x8fa3c0, sheenRoughness: 0.6, side: D }),
    doorTrim: new P({ color: 0x1c1e23, metalness: 0, roughness: 0.5, side: D }),
    dome: new P({ color: 0xaeb9c9, metalness: 1, roughness: 0.3, side: D }),
    gold: new P({ color: 0xd8a94a, metalness: 1, roughness: 0.28, side: D }),
    capBlue: new P({ color: 0x1565d8, metalness: 0.55, roughness: 0.28, clearcoat: 0.6, side: D }),
    ceramic: new P({ color: 0xdfe2e6, metalness: 0, roughness: 0.6, side: D }),
    pcb: new P({ color: 0x0a1712, metalness: 0.2, roughness: 0.55, side: D }),
    lid: new P({ color: 0x9fb4cc, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.16, depthWrite: false, envMapIntensity: 1.6, side: THREE.FrontSide }),
    glowBlue: new THREE.MeshBasicMaterial({ color: BLUE, toneMapped: false }),
  };
  M.copper.bumpMap.repeat.set(1, 1);
  return M;
}

const mesh = (g, m, shadow = true) => {
  const o = new THREE.Mesh(g, m); o.castShadow = shadow; o.receiveShadow = shadow; return o;
};

// cone profile helper: y on the cone surface at radius r
const CONE_R0 = 0.70, CONE_R1 = 0.185, CONE_D = 0.30;
const coneY = (r) => -CONE_D * Math.pow((CONE_R0 - r) / (CONE_R0 - CONE_R1), 1.35);

/**
 * Mid-bass woofer. With { coaxial: true } the dust cap is replaced by a
 * pole-mounted tweeter (returned as parts.tweeter so it can be animated).
 */
export function makeWoofer(M, { coaxial = false } = {}) {
  const group = new THREE.Group();
  const parts = {};
  const add = (name, explode) => { const g = new THREE.Group(); g.userData.explode = explode; parts[name] = g; group.add(g); return g; };

  // --- trim ring + screws
  const trim = add('trim', 0.5);
  trim.add(mesh(lathe([[0.862, 0], [1.0, 0], [1.0, 0.04], [0.985, 0.058], [0.89, 0.058], [0.862, 0.04], [0.862, 0]]), M.aluminum));
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const s = mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.02, 24), M.zinc);
    s.position.set(0.935 * Math.cos(a), 0.066, 0.935 * Math.sin(a)); trim.add(s);
    const h = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.006, 6), M.steel, false);
    h.position.set(0.935 * Math.cos(a), 0.0765, 0.935 * Math.sin(a)); trim.add(h);
  }

  // --- moving assembly: surround + cone (+ dust cap)
  const coneAsm = add('cone', 0.28);
  const surroundPts = [[0.88, -0.004], ...arc(0.781, 0, 0.081, 0, Math.PI, 22), [0.68, -0.006]];
  coneAsm.add(mesh(lathe(surroundPts, { smoothDeg: 50 }), M.rubber));
  const conePts = [];
  for (let i = 0; i <= 26; i++) { const r = CONE_R0 - (CONE_R0 - CONE_R1) * (i / 26); conePts.push([r, coneY(r)]); }
  coneAsm.add(mesh(planarUV(lathe(conePts, { smoothDeg: 60 }), 1), M.cone));
  if (!coaxial) {
    const a = 0.215, h = 0.075, yb = coneY(a), Rs = (a * a + h * h) / (2 * h), cy = yb + h - Rs;
    const th = Math.asin(a / Rs); const pts = [];
    for (let i = 0; i <= 18; i++) { const t = th * (1 - i / 18); pts.push([Rs * Math.sin(t), cy + Rs * Math.cos(t)]); }
    coneAsm.add(mesh(lathe(pts, { smoothDeg: 60 }), M.dustcap));
    // thin accent ring where the cap meets the cone
    const ring = mesh(new THREE.TorusGeometry(a + 0.004, 0.006, 10, 96), M.polished, false);
    ring.rotation.x = Math.PI / 2; ring.position.y = yb + 0.004; coneAsm.add(ring);
  }

  // --- voice coil
  const coil = add('coil', 0.10);
  coil.add(mesh(lathe([[0.186, -0.60], [0.186, -0.275]]), M.former));
  coil.add(mesh(lathe([[0.194, -0.59], [0.194, -0.47]]), M.copper));

  // --- spider (damper)
  const spider = add('spider', -0.22);
  const sp = [];
  for (let i = 0; i <= 60; i++) { const r = 0.50 - (0.50 - 0.19) * (i / 60); sp.push([r, -0.372 + 0.017 * Math.sin((i / 60) * Math.PI * 11)]); }
  spider.add(mesh(lathe(sp, { smoothDeg: 80, segs: 120 }), M.spider));

  // --- basket
  const basket = add('basket', -0.40);
  basket.add(mesh(lathe([[0.84, -0.03], [0.995, -0.03], [0.995, -0.002], [0.84, -0.002], [0.84, -0.03]]), M.steel));
  basket.add(mesh(lathe([[0.80, -0.13], [0.815, -0.13], [0.875, -0.03], [0.86, -0.03], [0.80, -0.13]]), M.steel));
  const spoke = [[0.56, -0.40], [0.70, -0.285], [0.815, -0.13], [0.80, -0.13], [0.685, -0.285], [0.545, -0.40], [0.56, -0.40]];
  for (let k = 0; k < 6; k++) {
    basket.add(mesh(lathe(spoke, { segs: 12, phiStart: (k * Math.PI) / 3 - 0.2, phiLength: 0.4, smoothDeg: 40 }), M.steel));
  }
  basket.add(mesh(lathe([[0.30, -0.44], [0.585, -0.44], [0.585, -0.395], [0.30, -0.395], [0.30, -0.44]]), M.steel));
  // terminal block
  const tb = new THREE.Group();
  tb.add(mesh(new RoundedBoxGeometry(0.2, 0.09, 0.07, 3, 0.012), M.plastic));
  for (const dx of [-0.05, 0.05]) { const tab = mesh(new THREE.BoxGeometry(0.035, 0.012, 0.09), M.gold); tab.position.set(dx, -0.02, 0.05); tb.add(tab); }
  const ta = Math.PI / 6; tb.position.set(0.78 * Math.cos(ta), -0.24, 0.78 * Math.sin(ta)); tb.rotation.y = Math.PI / 2 - ta; basket.add(tb);

  // --- motor
  const plate = add('plate', -0.62);
  plate.add(mesh(lathe([[0.215, -0.478], [0.50, -0.478], [0.50, -0.44], [0.215, -0.44], [0.215, -0.478]]), M.zinc));
  const magnet = add('magnet', -0.84);
  magnet.add(mesh(lathe([[0.25, -0.64], [0.55, -0.64], [0.565, -0.625], [0.565, -0.493], [0.55, -0.478], [0.25, -0.478], [0.25, -0.64]]), M.ferrite));
  const yoke = add('yoke', -1.12);
  if (!coaxial) {
    yoke.add(mesh(lathe([[0.05, -0.685], [0.50, -0.685], [0.50, -0.64], [0.168, -0.64], [0.168, -0.445], [0.05, -0.445], [0.05, -0.685]]), M.zincBrushed));
  } else {
    yoke.add(mesh(lathe([[0.0, -0.685], [0.50, -0.685], [0.50, -0.64], [0.168, -0.64], [0.168, -0.445], [0.075, -0.43], [0.075, -0.12], [0.0, -0.12]]), M.zincBrushed));
    // pole-mounted tweeter pod sits on the post, covering the cone neck
    const tw = makeTweeter(M, { pod: true });
    tw.group.scale.setScalar(0.78);
    tw.group.position.y = -0.085;
    const holder = new THREE.Group(); holder.add(tw.group); holder.userData.explode = 0.9;
    parts.tweeter = holder; parts.tweeterParts = tw; group.add(holder);
  }

  // rear-plate details, seen when the speaker turns around: centre boss, accent ring, rivets
  yoke.add(mesh(lathe([[coaxial ? 0.0 : 0.05, -0.703], [0.13, -0.703], [0.155, -0.685]]), M.steel));
  const accent = mesh(new THREE.TorusGeometry(0.31, 0.009, 10, 120), M.capBlue, false); accent.rotation.x = Math.PI / 2; accent.position.y = -0.687; yoke.add(accent);
  const edge = mesh(new THREE.TorusGeometry(0.472, 0.007, 10, 120), M.polished, false); edge.rotation.x = Math.PI / 2; edge.position.y = -0.686; yoke.add(edge);
  for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2; const rv = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.01, 16), M.steel, false); rv.position.set(0.4 * Math.cos(a), -0.689, 0.4 * Math.sin(a)); yoke.add(rv); }

  const setExplode = (e) => { for (const k in parts) if (parts[k].userData && parts[k].userData.explode !== undefined) parts[k].position.y = parts[k].userData.explode * e; };
  return { group, parts, setExplode };
}

/** Dome tweeter. Front = +Y. Faceplate radius 0.305. */
export function makeTweeter(M, { pod = false } = {}) {
  const group = new THREE.Group();
  const housing = mesh(lathe(pod
    ? [[0.0, -0.11], [0.16, -0.11], [0.27, -0.05], [0.285, -0.002], [0.0, -0.002]]
    : [[0.0, -0.21], [0.20, -0.21], [0.268, -0.14], [0.285, -0.002], [0.0, -0.002]], { smoothDeg: 40 }), M.plastic);
  group.add(housing);
  const face = mesh(lathe([[0.145, 0], [0.305, 0], [0.305, 0.045], [0.292, 0.058], [0.25, 0.058], [0.145, 0.014], [0.145, 0]]), M.blackAnod);
  group.add(face);
  const chamfer = mesh(new THREE.TorusGeometry(0.298, 0.0075, 12, 120), M.polished, false);
  chamfer.rotation.x = Math.PI / 2; chamfer.position.y = 0.052; group.add(chamfer);
  const a = 0.142, h = 0.07, Rs = (a * a + h * h) / (2 * h), cy = 0.012 + h - Rs, th = Math.asin(a / Rs), pts = [];
  for (let i = 0; i <= 18; i++) { const t = th * (1 - i / 18); pts.push([Rs * Math.sin(t), cy + Rs * Math.cos(t)]); }
  const dome = mesh(lathe(pts, { smoothDeg: 60 }), M.dome);
  group.add(dome);
  // glow ring used for the "integrated design" highlight (off by default)
  const glow = new THREE.Mesh(new THREE.TorusGeometry(0.325, 0.012, 12, 120), new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: 0, toneMapped: false }));
  glow.rotation.x = Math.PI / 2; glow.position.y = 0.03; group.add(glow);
  return { group, housing, face, dome, glow };
}

/** Passive 2-way crossover network. Top = +Y. Footprint 1.0 x 0.62. */
export function makeCrossover(M) {
  const group = new THREE.Group();
  group.add(mesh(new RoundedBoxGeometry(1.0, 0.16, 0.62, 4, 0.03), M.blackAnod).translateY(0.08));
  // heat-sink style ribs along the long sides
  for (const z of [-0.315, 0.315]) for (let i = 0; i < 9; i++) {
    const r = mesh(new THREE.BoxGeometry(0.05, 0.11, 0.02), M.aluminum); r.position.set(-0.4 + i * 0.1, 0.08, z); group.add(r);
  }
  const pcb = mesh(new THREE.BoxGeometry(0.9, 0.012, 0.52), M.pcb); pcb.position.y = 0.166; group.add(pcb);
  // traces
  for (const [x, z, w, d] of [[-0.1, 0.19, 0.5, 0.012], [0.12, -0.21, 0.42, 0.012], [-0.33, 0.0, 0.012, 0.3], [0.33, 0.05, 0.012, 0.26], [0.0, 0.02, 0.2, 0.012]]) {
    const tr = mesh(new THREE.BoxGeometry(w, 0.003, d), M.gold, false); tr.position.set(x, 0.1735, z); group.add(tr);
  }
  const coil1 = mesh(new THREE.TorusGeometry(0.105, 0.05, 24, 72), M.copper); coil1.rotation.x = Math.PI / 2; coil1.position.set(-0.24, 0.225, -0.04); group.add(coil1);
  const core1 = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 24), M.plastic); core1.position.copy(coil1.position); group.add(core1);
  const coil2 = mesh(new THREE.TorusGeometry(0.068, 0.032, 20, 60), M.copper); coil2.rotation.x = Math.PI / 2; coil2.position.set(-0.05, 0.207, 0.16); group.add(coil2);
  for (const z of [-0.12, 0.07]) {
    const c = mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.24, 32), M.capBlue); c.rotation.z = Math.PI / 2; c.position.set(0.19, 0.23, z); group.add(c);
    for (const dx of [-0.125, 0.125]) { const e = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 24), M.zinc); e.rotation.z = Math.PI / 2; e.position.set(0.19 + dx, 0.23, z); group.add(e); }
  }
  const res = mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), M.ceramic); res.position.set(-0.08, 0.198, -0.21); group.add(res);
  for (const x of [-0.455, 0.455]) {
    const blk = mesh(new RoundedBoxGeometry(0.07, 0.09, 0.42, 2, 0.01), M.plastic); blk.position.set(x, 0.205, 0); group.add(blk);
    for (const z of [-0.13, 0, 0.13]) { const s = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 16), M.gold); s.position.set(x, 0.255, z); group.add(s); }
  }
  const lid = new THREE.Mesh(new RoundedBoxGeometry(0.96, 0.17, 0.58, 4, 0.03), M.lid); lid.position.y = 0.245; lid.renderOrder = 5; group.add(lid);
  // lid frame + screws
  for (const [x, z] of [[-0.44, -0.25], [0.44, -0.25], [-0.44, 0.25], [0.44, 0.25]]) {
    const s = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 16), M.zinc, false); s.position.set(x, 0.335, z); group.add(s);
  }
  return { group };
}

/** Front door inner panel with a speaker cut-out centred on the origin. Faces +Z. */
export function makeDoor(M) {
  const group = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(-1.7, -1.75); s.lineTo(2.9, -1.75); s.quadraticCurveTo(3.15, -1.7, 3.15, -1.4);
  s.lineTo(3.15, 1.75); s.lineTo(-1.25, 1.95); s.quadraticCurveTo(-1.6, 1.9, -1.78, 1.5);
  s.lineTo(-2.0, -1.2); s.quadraticCurveTo(-2.02, -1.7, -1.7, -1.75);
  const hole = new THREE.Path(); hole.absarc(0, 0, 0.9, 0, Math.PI * 2, true); s.holes.push(hole);
  const panel = mesh(new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 3, curveSegments: 96 }), M.doorSkin);
  panel.position.z = -0.2; // front face ends at z = 0 (-0.2 + 0.03 + 0.14 + 0.03)
  group.add(panel);
  // raised mounting bezel around the opening (faces +Z)
  const bezel = mesh(lathe([[0.9, 0], [1.16, 0], [1.16, 0.03], [1.12, 0.05], [0.9, 0.05], [0.9, 0]]), M.plastic);
  bezel.rotation.x = Math.PI / 2; bezel.position.z = -0.045; group.add(bezel);
  // armrest, trim strip, ambient light, pocket
  const arm = mesh(new RoundedBoxGeometry(4.3, 0.36, 0.5, 4, 0.12), M.doorTrim); arm.position.set(0.75, 1.22, 0.2); arm.rotation.z = 0.03; group.add(arm);
  const strip = mesh(new THREE.BoxGeometry(4.2, 0.05, 0.03), M.aluminum); strip.position.set(0.78, 1.56, 0.02); strip.rotation.z = 0.035; group.add(strip);
  const amb = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.018, 0.02), M.glowBlue); amb.position.set(0.8, 1.02, 0.03); amb.rotation.z = 0.03; group.add(amb);
  const pocket = mesh(new RoundedBoxGeometry(1.7, 0.5, 0.32, 3, 0.08), M.doorTrim); pocket.position.set(2.15, -1.3, 0.12); group.add(pocket);
  const handle = mesh(new RoundedBoxGeometry(0.7, 0.14, 0.1, 3, 0.04), M.aluminum); handle.position.set(2.2, 0.72, 0.07); group.add(handle);
  return { group };
}
