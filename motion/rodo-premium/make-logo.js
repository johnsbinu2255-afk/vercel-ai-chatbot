// Builds the RODO lockup geometry (stand-in logo) and writes logo-geometry.json.
// All coordinates are final-frame pixels (1920x1080, y down). The scene converts them to 3D.
//
// Lockup:  [R emblem: black R + red swoosh]  R  (tyre)  D  (tyre)
// Wordmark R and D are Montserrat Black Italic (OFL); the O's are tyres with alloy wheels.
const opentype = require('opentype.js');
const fs = require('fs');
const path = require('path');

const W = 1920, H = 1080;
const CAP = 190;                 // wordmark cap height (px)
const EMBLEM_H = 285;            // emblem height (px)
const WHEEL_R = 101;             // tyre radius (px) — the O's
const GAP = 16;                  // gap between wordmark items
const EMBLEM_GAP = 46;           // gap between emblem and wordmark
const SHEAR = Math.tan(10 * Math.PI / 180);

const font = opentype.loadSync(path.join(__dirname, 'fonts/Montserrat-BlackItalic.ttf'));
const capUnits = font.tables.os2.sCapHeight || 700;
const fontSize = CAP * font.unitsPerEm / capUnits;

// ---------- emblem (upright design, y up, origin bottom-left of stem) ----------
const arcPts = (cx, cy, r, a0, a1, n = 40) =>
  Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
const E = EMBLEM_H, SW = 72;                       // stem width
const stem = { outer: [[0, 0], [SW, 0], [SW, E], [0, E]], holes: [] };
const bowlTop = E, bowlBot = 135, bowlCy = (bowlTop + bowlBot) / 2, bowlR = (bowlTop - bowlBot) / 2, bowlCx = 120;
const t = 52;                                      // bowl stroke
const bowl = {
  outer: [[36, bowlTop], ...arcPts(bowlCx, bowlCy, bowlR, Math.PI / 2, -Math.PI / 2), [36, bowlBot]],
  holes: [[[SW, bowlTop - t], [SW, bowlBot + t], ...arcPts(bowlCx - 2, bowlCy, bowlR - t, -Math.PI / 2, Math.PI / 2)]],
};
const leg = { outer: [[80, 150], [152, 150], [224, 0], [150, 0]], holes: [] };

// swoosh: crescent between two quadratic curves sharing end points (already italic space)
const P0 = [-74, 54], P1 = [304, 238], COUT = [96, -30], CIN = [118, 46];
const quad = (a, c, b, s) => [(1 - s) ** 2 * a[0] + 2 * s * (1 - s) * c[0] + s * s * b[0], (1 - s) ** 2 * a[1] + 2 * s * (1 - s) * c[1] + s * s * b[1]];
const N = 64;
const outerCurve = Array.from({ length: N + 1 }, (_, i) => quad(P0, COUT, P1, i / N));
const innerCurve = Array.from({ length: N + 1 }, (_, i) => quad(P0, CIN, P1, i / N));
const swoosh = { outer: [...outerCurve, ...innerCurve.slice(1, -1).reverse()], holes: [] };
const CMID = [(COUT[0] + CIN[0]) / 2, (COUT[1] + CIN[1]) / 2];
const swooshLine = Array.from({ length: N + 1 }, (_, i) => quad(P0, CMID, P1, i / N));

const shear = p => [p[0] + p[1] * SHEAR, p[1]];
const shearPart = part => ({ outer: part.outer.map(shear), holes: part.holes.map(h => h.map(shear)) });
const emblemUp = { stem: shearPart(stem), bowl: shearPart(bowl), leg: shearPart(leg) };

// emblem bbox (upright space, y up)
const allPts = [...Object.values(emblemUp).flatMap(p => p.outer), ...swoosh.outer];
const ex0 = Math.min(...allPts.map(p => p[0])), ex1 = Math.max(...allPts.map(p => p[0]));
const emblemW = ex1 - ex0;

// ---------- wordmark ----------
const glyph = ch => {
  const p = font.getPath(ch, 0, 0, fontSize);
  const bb = p.getBoundingBox();
  return { cmds: p.commands, bb };
};
const gR = glyph('R'), gD = glyph('D');
const items = [
  { kind: 'glyph', ch: 'R', g: gR, w: gR.bb.x2 - gR.bb.x1 },
  { kind: 'wheel', w: WHEEL_R * 2 },
  { kind: 'glyph', ch: 'D', g: gD, w: gD.bb.x2 - gD.bb.x1 },
  { kind: 'wheel', w: WHEEL_R * 2 },
];
const wordW = items.reduce((a, it) => a + it.w, 0) + GAP * (items.length - 1);
const totalW = emblemW + EMBLEM_GAP + wordW;
const left = (W - totalW) / 2;
const baseline = H / 2 + EMBLEM_H / 2;          // lockup is vertically centred on the emblem height

// emblem to final px (y down)
const toPx = p => [left + (p[0] - ex0), baseline - p[1]];
const partPx = part => ({ outer: part.outer.map(toPx), holes: part.holes.map(h => h.map(toPx)) });
const emblem = {
  stem: partPx(emblemUp.stem), bowl: partPx(emblemUp.bowl), leg: partPx(emblemUp.leg),
  swoosh: partPx(swoosh), swooshLine: swooshLine.map(toPx),
  bbox: { x: left, y: baseline - EMBLEM_H, w: emblemW, h: EMBLEM_H },
};

// wordmark positions
let x = left + emblemW + EMBLEM_GAP;
const letters = {}, wheels = [];
for (const it of items) {
  if (it.kind === 'glyph') {
    const dx = x - it.g.bb.x1, dy = baseline;
    const cmds = it.g.cmds.map(c => {
      const o = { type: c.type };
      for (const k of ['x', 'y', 'x1', 'y1', 'x2', 'y2']) if (c[k] !== undefined) o[k] = +(c[k] + (k[0] === 'x' ? dx : dy)).toFixed(2);
      return o;
    });
    letters[it.ch] = { cmds, bbox: { x, y: baseline + it.g.bb.y1, w: it.w, h: it.g.bb.y2 - it.g.bb.y1 } };
  } else {
    wheels.push({ cx: x + WHEEL_R, cy: baseline - WHEEL_R, r: WHEEL_R });
  }
  x += it.w + GAP;
}

const out = {
  W, H, baseline, cap: CAP, wheelR: WHEEL_R,
  colors: { yellow: '#FFCC00', red: '#E10613', black: '#0B0B0C' },
  emblem, letters, wheels,
  lockup: { x: left, w: totalW, top: baseline - EMBLEM_H, bottom: baseline },
};
fs.writeFileSync(path.join(__dirname, 'logo-geometry.json'), JSON.stringify(out));
console.log('lockup', Math.round(left), Math.round(totalW), 'baseline', baseline, 'fontSize', fontSize.toFixed(1),
  'wheels', wheels.map(w => Math.round(w.cx)).join(','));
