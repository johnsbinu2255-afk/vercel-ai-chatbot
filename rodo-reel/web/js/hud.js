// Technical HUD layer (SVG): warning icon, cutaway gauge, inspection callouts, wear pills, service cards, logo ring.
import { clamp, prog, ease, lerp, env } from './util.js';

const NS = 'http://www.w3.org/2000/svg';
const RED = '#e3202a';

export class HUD {
  constructor(svg) {
    this.svg = svg;
    svg.innerHTML = `
    <defs>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="softglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <linearGradient id="scanG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${RED}" stop-opacity="0"/><stop offset="1" stop-color="${RED}" stop-opacity="0.35"/></linearGradient>
      <pattern id="hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="10" stroke="${RED}" stroke-width="3" stroke-opacity="0.6"/></pattern>
    </defs>
    <g id="tpms" opacity="0">
      <g filter="url(#glow)" stroke="#ff2b2b" fill="none" stroke-width="13" stroke-linecap="round" stroke-linejoin="round">
        <path d="M -78 -62 C -112 -18 -110 40 -70 70 L 70 70 C 110 40 112 -18 78 -62"/>
        <path d="M -60 88 L -60 102 M -30 88 L -30 102 M 0 88 L 0 102 M 30 88 L 30 102 M 60 88 L 60 102" stroke-width="10"/>
        <path d="M 0 -42 L 0 18" stroke-width="16"/>
        <circle cx="0" cy="46" r="3" stroke-width="16"/>
      </g>
    </g>

    <g id="s2" opacity="0">
      <rect x="90" y="1112" width="900" height="226" rx="14" fill="rgba(8,9,11,0.62)" stroke="rgba(255,255,255,0.14)"/>
      <text x="120" y="1156" font-size="22" fill="#9aa0a8" letter-spacing="5">TREAD DEPTH · CUTAWAY</text>
      <text id="s2val" x="960" y="1162" font-size="52" text-anchor="end" fill="#fff" font-family="Inter Display" font-weight="800">8.0 MM</text>
      <g id="s2ghost" fill="none" stroke="rgba(255,255,255,0.45)" stroke-dasharray="6 6" stroke-width="2"></g>
      <g id="s2blocks"></g>
      <g id="s2meas" stroke="#fff" stroke-width="2.5"></g>
      <g id="s2pill"><rect id="s2pillr" x="120" y="1176" width="168" height="38" rx="19" fill="none" stroke="#fff" stroke-width="2"/><text id="s2pillt" x="204" y="1202" font-size="20" text-anchor="middle" fill="#fff" letter-spacing="3">HEALTHY</text></g>
    </g>

    <g id="s3" opacity="0">
      <g id="s3br" stroke="rgba(255,255,255,0.75)" stroke-width="3" fill="none"></g>
      <rect id="s3trail" x="100" width="880" height="180" fill="url(#scanG)"/>
      <line id="s3line" x1="100" x2="980" stroke="${RED}" stroke-width="3" filter="url(#softglow)"/>
      <text id="s3scan" x="104" y="540" font-size="22" fill="#e9ecef" letter-spacing="4">SCANNING SIDEWALL</text>
      <g id="s3crack"><circle r="64" fill="none" stroke="${RED}" stroke-width="3.5" filter="url(#softglow)"/><path fill="none" stroke="${RED}" stroke-width="2.5"/>
        <text font-family="Inter Display" font-weight="800" font-size="40" fill="#fff">CRACK</text><text class="s" font-size="19" fill="${RED}" letter-spacing="4">DETECTED</text></g>
      <g id="s3bulge"><ellipse rx="86" ry="62" fill="none" stroke="${RED}" stroke-width="3.5" stroke-dasharray="10 8" filter="url(#softglow)"/><path fill="none" stroke="${RED}" stroke-width="2.5"/>
        <text font-family="Inter Display" font-weight="800" font-size="40" fill="#fff">BULGE</text><text class="s" font-size="19" fill="${RED}" letter-spacing="4">DETECTED</text></g>
    </g>

    <g id="s4" opacity="0">
      <g id="s4zones"></g>
      <g id="s4pills"></g>
      <text id="s4desc" x="510" y="1378" font-size="22" text-anchor="middle" fill="#c9ced6" letter-spacing="4"></text>
    </g>

    <g id="s5" opacity="0">
      <path id="s5lead" fill="none" stroke="${RED}" stroke-width="2.5"/>
      <circle id="s5dot" r="9" fill="${RED}" filter="url(#softglow)"/>
      <g id="s5card">
        <rect x="88" y="1196" width="520" height="236" rx="16" fill="rgba(10,11,13,0.78)" stroke="rgba(255,255,255,0.16)"/>
        <rect x="88" y="1196" width="6" height="236" rx="3" fill="${RED}"/>
        <text id="s5step" x="122" y="1244" font-size="20" fill="${RED}" letter-spacing="4"></text>
        <text id="s5lab" x="122" y="1282" font-size="24" fill="#c9ced6" letter-spacing="4"></text>
        <text id="s5val" x="120" y="1360" font-size="74" fill="#fff" font-family="Inter Display" font-weight="800"></text>
        <rect x="122" y="1388" width="452" height="8" rx="4" fill="rgba(255,255,255,0.12)"/>
        <rect id="s5bar" x="122" y="1388" width="0" height="8" rx="4" fill="#fff"/>
        <text id="s5ok" x="574" y="1360" font-size="22" text-anchor="end" fill="#33d17a" letter-spacing="3"></text>
      </g>
    </g>

    <g id="s6" opacity="0">
      <circle id="s6ring" fill="none" stroke="rgba(214,219,226,0.85)" stroke-width="2.5"/>
      <g id="s6ticks"></g>
      <circle id="s6mark" r="7" fill="${RED}" filter="url(#softglow)"/>
    </g>`;
    this.$ = (id) => svg.querySelector('#' + id);
    // scene 3 brackets
    const br = this.$('s3br');
    const L = 60, x0 = 100, y0 = 560, x1 = 980, y1 = 1340;
    br.innerHTML = [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]
      .map(([x, y, sx, sy]) => `<path d="M ${x} ${y + sy * L} L ${x} ${y} L ${x + sx * L} ${y}"/>`).join('');
    // scene 4 pills
    const pills = ['ALIGNMENT', 'INFLATION', 'SUSPENSION'];
    this.$('s4pills').innerHTML = pills.map((p, i) => {
      const x = 510 + (i - 1) * 286;
      return `<g class="pill" transform="translate(${x},1310)"><rect x="-132" y="-30" width="264" height="60" rx="30" stroke-width="2.5"/><text y="9" font-size="23" text-anchor="middle" letter-spacing="4" font-weight="700">${p}</text></g>`;
    }).join('');
    // scene 6 ticks
    this.$('s6ticks').innerHTML = Array.from({ length: 72 }, (_, i) => `<line data-a="${(i / 72) * Math.PI * 2}" stroke="rgba(214,219,226,0.7)" stroke-width="${i % 6 === 0 ? 3 : 1.5}"/>`).join('');
  }

  show(id, o) { this.$(id).setAttribute('opacity', o.toFixed(3)); }

  update(t, ctx) {
    for (const id of ['tpms', 's2', 's3', 's4', 's5', 's6']) this.show(id, 0);
    if (t < 1.9) this.tpms(t);
    else if (t >= 8.4 && t < 16.1) this.tread(t, ctx);
    else if (t >= 16.8 && t < 26.1) this.sidewall(t, ctx);
    else if (t >= 27.0 && t < 36.1) this.uneven(t, ctx);
    else if (t >= 36.9 && t < 46.2) this.service(t, ctx);
    else if (t >= 53.4) this.logo(t, ctx);
  }

  tpms(t) {
    if (t < 0.25) return;
    const fl = [[0.25, 1], [0.29, 0.1], [0.33, 1], [0.38, 0.35], [0.43, 1]];
    let o = 0; for (const [tt, v] of fl) if (t >= tt) o = v;
    const push = ease.in(prog(t, 1.38, 1.85));
    const s = 1.0 + 0.1 * prog(t, 0.25, 1.4) + 7 * push;
    o *= 1 - push;
    const g = this.$('tpms');
    g.setAttribute('transform', `translate(510 820) scale(${s.toFixed(3)})`);
    this.show('tpms', o);
  }

  tread(t, { tyre }) {
    const o = env(t, 8.6, 15.75, 0.45, 0.35);
    this.show('s2', o);
    const wear = tyre.U.uWear.value / 0.85;
    const d = 8.0 - 6.4 * wear;
    const val = this.$('s2val');
    val.textContent = `${d.toFixed(1)} MM`;
    const worn = d < 3.0;
    val.setAttribute('fill', worn ? RED : '#fff');
    this.$('s2pillt').textContent = worn ? 'WORN' : d < 5 ? 'WEARING' : 'HEALTHY';
    this.$('s2pillr').setAttribute('stroke', worn ? RED : '#fff');
    this.$('s2pillr').setAttribute('fill', worn ? 'rgba(227,32,42,0.25)' : 'none');
    this.$('s2pillt').setAttribute('fill', worn ? '#fff' : '#fff');
    // cutaway profile: 5 blocks, 4 grooves
    const floorY = 1312, k = 11.5;
    const xs = [[120, 268], [308, 468], [508, 672], [712, 872], [912, 960]];
    let blocks = '', ghost = '';
    xs.forEach(([a, b], i) => {
      const top = floorY - 8 - d * k, gtop = floorY - 8 - 8 * k;
      // worn block = flattened, rounded shoulders gone
      blocks += `<rect x="${a}" y="${top.toFixed(1)}" width="${b - a}" height="${(floorY - top).toFixed(1)}" fill="${worn ? 'url(#hatch)' : 'rgba(200,205,212,0.18)'}" stroke="${worn ? RED : '#d8dce2'}" stroke-width="2.5"/>`;
      ghost += `<path d="M ${a} ${floorY} L ${a} ${gtop} L ${b} ${gtop} L ${b} ${floorY}"/>`;
    });
    this.$('s2blocks').innerHTML = blocks + `<line x1="110" x2="970" y1="${floorY}" y2="${floorY}" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>`;
    this.$('s2ghost').innerHTML = ghost;
    const top = floorY - 8 - d * k, mx = 488;
    this.$('s2meas').innerHTML = `<line x1="${mx}" x2="${mx}" y1="${floorY - 8}" y2="${top}"/><path d="M ${mx - 8} ${top + 10} L ${mx} ${top} L ${mx + 8} ${top + 10} M ${mx - 8} ${floorY - 18} L ${mx} ${floorY - 8} L ${mx + 8} ${floorY - 18}" fill="none"/>`;
  }

  sidewall(t, { info, toScreen }) {
    this.show('s3', env(t, 16.9, 25.75, 0.4, 0.35));
    // brackets
    const bo = ease.outExpo(prog(t, 16.9, 17.6));
    this.$('s3br').setAttribute('opacity', bo.toFixed(3));
    this.$('s3br').setAttribute('transform', `translate(540 950) scale(${(1.08 - 0.08 * bo).toFixed(3)}) translate(-540 -950)`);
    // scan
    const sp = ease.inOut(prog(t, 17.5, 19.2));
    const scanning = t >= 17.5 && t < 19.35;
    const y = lerp(560, 1340, sp);
    this.$('s3line').setAttribute('y1', y); this.$('s3line').setAttribute('y2', y);
    this.$('s3line').setAttribute('opacity', scanning ? 1 : 0);
    this.$('s3trail').setAttribute('y', y - 180);
    this.$('s3trail').setAttribute('opacity', scanning ? 1 : 0);
    const label = this.$('s3scan');
    label.textContent = t < 17.5 ? 'INSPECTION MODE' : scanning ? `SCANNING SIDEWALL  ${Math.round(sp * 100)}%` : 'SCAN COMPLETE · 2 ISSUES';
    label.setAttribute('fill', scanning || t < 17.5 ? '#e9ecef' : RED);
    // callouts
    const callout = (id, p3, t0, side, dy) => {
      const g = this.$(id);
      const a = ease.outExpo(prog(t, t0, t0 + 0.6));
      g.setAttribute('opacity', t >= t0 ? '1' : '0');
      if (t < t0) return;
      const s = toScreen(p3.x, p3.y, p3.z);
      const shape = g.firstElementChild;
      shape.setAttribute('cx', s.x); shape.setAttribute('cy', s.y);
      const circ = 2 * Math.PI * 80;
      shape.setAttribute('stroke-dashoffset', id === 's3crack' ? (circ * (1 - a)).toFixed(1) : '0');
      if (id === 's3crack') shape.setAttribute('stroke-dasharray', `${circ}`);
      shape.setAttribute('transform', `rotate(${-90 + 30 * a} ${s.x} ${s.y})`);
      if (id === 's3bulge') shape.setAttribute('opacity', a.toFixed(3));
      const lx = side > 0 ? 700 : 130, ly = clamp(s.y + dy, 700, 1260);
      const ex = s.x + side * 72, ey = s.y + dy * 0.35;
      const path = g.children[1];
      const lp = clamp(prog(t, t0 + 0.2, t0 + 0.6));
      const kx = lerp(ex, side > 0 ? lx - 16 : lx + 290, lp), ky = lerp(ey, ly, lp);
      path.setAttribute('d', `M ${ex} ${ey} L ${ex + (kx - ex) * 0.4} ${ky} L ${kx} ${ky}`);
      const [tx, ts] = [g.children[2], g.children[3]];
      const tp = ease.out(prog(t, t0 + 0.45, t0 + 0.8));
      tx.setAttribute('x', lx); tx.setAttribute('y', ly - 14); tx.setAttribute('opacity', tp);
      ts.setAttribute('x', lx + 2); ts.setAttribute('y', ly + 22); ts.setAttribute('opacity', tp);
    };
    if (info) {
      callout('s3crack', info.crack, 19.3, -1, -110);
      callout('s3bulge', info.bulge, 20.5, 1, -150);
    }
  }

  uneven(t, { toScreen, tyre }) {
    this.show('s4', env(t, 27.0, 35.75, 0.4, 0.35));
    const modes = [[27.4, 30.4, 'ONE-SIDED EDGE WEAR'], [30.4, 33.4, 'SHOULDER WEAR · BOTH EDGES'], [33.4, 36.0, 'CUPPING · PATCHY WEAR']];
    let m = -1; modes.forEach(([a, b], i) => { if (t >= a && t < b) m = i; });
    this.$('s4pills').querySelectorAll('.pill').forEach((g, i) => {
      const on = i === m;
      const r = g.firstElementChild, tx = g.lastElementChild;
      r.setAttribute('fill', on ? RED : 'rgba(10,10,12,0.55)');
      r.setAttribute('stroke', on ? RED : 'rgba(255,255,255,0.35)');
      tx.setAttribute('fill', on ? '#fff' : '#9aa0a8');
      const k = on ? 1 + 0.06 * (1 - ease.outExpo(prog(t, modes[i][0], modes[i][0] + 0.4))) : 1;
      g.setAttribute('transform', `translate(${510 + (i - 1) * 286},1310) scale(${k.toFixed(3)})`);
    });
    this.$('s4desc').textContent = m >= 0 ? modes[m][2] : 'TREAD SCAN · TOP VIEW';
    // zone brackets projected from the tread crown
    const HW = 0.31, zTop = -0.42, zBot = 0.62;
    const sx = (x) => toScreen(x, 1.0, 0.1).x;
    const yA = Math.max(600, toScreen(0, Math.sqrt(1 - zTop * zTop), zTop).y), yB = Math.min(1225, toScreen(0, Math.sqrt(1 - zBot * zBot), zBot).y);
    const zone = (x0, x1, tag, t0) => {
      const a = ease.outExpo(prog(t, t0 + 0.3, t0 + 0.9));
      const X0 = sx(x0), X1 = sx(x1);
      const top = lerp((yA + yB) / 2, yA, a), bot = lerp((yA + yB) / 2, yB, a);
      return `<g opacity="${a.toFixed(3)}" stroke="${RED}" stroke-width="3" fill="none" filter="url(#softglow)">
        <path d="M ${X0 + 14} ${top} L ${X0} ${top} L ${X0} ${bot} L ${X0 + 14} ${bot} M ${X1 - 14} ${top} L ${X1} ${top} L ${X1} ${bot} L ${X1 - 14} ${bot}"/></g>
        <g opacity="${a.toFixed(3)}"><rect x="${(X0 + X1) / 2 - 70}" y="${top - 52}" width="140" height="36" rx="6" fill="${RED}"/>
        <text x="${(X0 + X1) / 2}" y="${top - 27}" font-size="19" text-anchor="middle" fill="#fff" letter-spacing="3" font-weight="700">${tag}</text></g>`;
    };
    let z = '';
    if (m === 0) z = zone(-HW, -0.06, 'WORN', 27.4);
    if (m === 1) z = zone(-HW, -0.14, 'WORN', 30.4) + zone(0.14, HW, 'WORN', 30.4);
    if (m === 2) z = zone(-HW, HW, 'PATCHY', 33.4);
    this.$('s4zones').innerHTML = z;
  }

  service(t, { info, toScreen }) {
    const shots = [
      { a: 36.9, b: 39.0, step: '01 / 04', lab: 'PRESSURE CHECK', val: (p) => `${Math.round(35 * ease.out(p))} PSI`, p: [37.3, 38.6], ok: 'SET ✓', anchor: 'valve' },
      { a: 39.2, b: 41.3, step: '02 / 04', lab: 'TREAD MEASUREMENT', val: (p) => `${(7.8 * ease.out(p)).toFixed(1)} MM`, p: [39.8, 40.6], ok: 'HEALTHY ✓', anchor: 'probe' },
      { a: 41.4, b: 43.8, step: '03 / 04', lab: 'PROFESSIONAL FITTING', val: (p) => (p < 1 ? 'FITTING' : 'SEATED'), p: [41.5, 43.1], ok: 'DONE ✓' },
      { a: 43.9, b: 46.2, step: '04 / 04', lab: 'WHEEL BALANCING', val: (p) => `${Math.round(18 * (1 - ease.inOut(p)))} G`, p: [44.3, 45.4], ok: 'BALANCED ✓' },
    ];
    const s = shots.find((x) => t >= x.a && t < x.b);
    if (!s) return;
    this.show('s5', env(t, s.a, s.b, 0.3, 0.2));
    const p = prog(t, s.p[0], s.p[1]);
    const card = this.$('s5card');
    const ca = ease.outExpo(prog(t, s.a, s.a + 0.5));
    card.setAttribute('transform', `translate(${(-40 * (1 - ca)).toFixed(1)} 0)`);
    this.$('s5step').textContent = `SERVICE ${s.step}`;
    this.$('s5lab').textContent = s.lab;
    this.$('s5val').textContent = s.val(p);
    this.$('s5bar').setAttribute('width', (452 * p).toFixed(1));
    this.$('s5bar').setAttribute('fill', p >= 1 ? '#33d17a' : '#fff');
    this.$('s5ok').textContent = p >= 1 ? s.ok : '';
    const lead = this.$('s5lead'), dot = this.$('s5dot');
    const pt = s.anchor && info && info[s.anchor];
    if (pt) {
      const la = ease.out(prog(t, s.a + 0.2, s.a + 0.7));
      const ex = lerp(pt.x, 608, la), ey = lerp(pt.y, 1220, la);
      lead.setAttribute('d', `M ${pt.x} ${pt.y} L ${ex} ${ey}`);
      dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y);
      lead.setAttribute('opacity', 1); dot.setAttribute('opacity', 0.6 + 0.4 * Math.sin(t * 10));
    } else { lead.setAttribute('opacity', 0); dot.setAttribute('opacity', 0); }
  }

  logo(t, { toScreen }) {
    this.show('s6', ease.out(prog(t, 53.4, 53.7)));
    const c = toScreen(0.25, 0, 0), e = toScreen(0.25, 1.0, 0);
    const r = Math.hypot(e.x - c.x, e.y - c.y) * 1.17;
    const ring = this.$('s6ring');
    const circ = 2 * Math.PI * r;
    const a = ease.inOut(prog(t, 53.45, 54.7));
    ring.setAttribute('cx', c.x); ring.setAttribute('cy', c.y); ring.setAttribute('r', r);
    ring.setAttribute('stroke-dasharray', `${circ}`);
    ring.setAttribute('stroke-dashoffset', `${(circ * (1 - a)).toFixed(1)}`);
    ring.setAttribute('transform', `rotate(-90 ${c.x} ${c.y})`);
    const rot = (t - 53.45) * 0.12;
    this.$('s6ticks').querySelectorAll('line').forEach((l, i) => {
      const ang = +l.dataset.a + rot;
      const vis = clamp((a * 72 - i) / 3);
      const r0 = r + 10, r1 = r + (i % 6 === 0 ? 30 : 20);
      l.setAttribute('x1', c.x + Math.cos(ang - Math.PI / 2) * r0); l.setAttribute('y1', c.y + Math.sin(ang - Math.PI / 2) * r0);
      l.setAttribute('x2', c.x + Math.cos(ang - Math.PI / 2) * r1); l.setAttribute('y2', c.y + Math.sin(ang - Math.PI / 2) * r1);
      l.setAttribute('opacity', vis.toFixed(2));
    });
    const mk = this.$('s6mark');
    const ma = -Math.PI / 2 + a * Math.PI * 2;
    mk.setAttribute('cx', c.x + Math.cos(ma) * r); mk.setAttribute('cy', c.y + Math.sin(ma) * r);
  }
}
