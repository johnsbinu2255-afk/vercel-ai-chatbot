// Kinetic typography layer. Every element is driven purely by the timeline time t.
import { clamp, prog, ease } from './util.js';

const SAFE_W = 880;     // keep clear of Reels UI on the right edge
const CX = 510;         // optical centre (shifted left of the right-hand button column)

function mk(parent, cls, html, css) {
  const d = document.createElement('div');
  d.className = cls;
  d.innerHTML = html;
  Object.assign(d.style, css);
  parent.appendChild(d);
  return d;
}

// split into masked characters; words kept together; *word* -> <b>, _word_ -> <em>
function split(el, text, byWord) {
  el.innerHTML = '';
  const units = [];
  text.split(' ').forEach((raw, wi, arr) => {
    let w = raw, tag = null;
    if (/^\*.*\*$/.test(w)) { tag = 'b'; w = w.slice(1, -1); }
    else if (/^_.*_$/.test(w)) { tag = 'em'; w = w.slice(1, -1); }
    const word = document.createElement(tag || 'span');
    word.style.display = 'inline-block';
    word.style.whiteSpace = 'nowrap';
    const parts = byWord ? [w] : [...w];
    for (const ch of parts) {
      const m = document.createElement('span'); m.className = 'm';
      const c = document.createElement('span'); c.className = 'c'; c.textContent = ch;
      m.appendChild(c); word.appendChild(m); units.push(c);
    }
    el.appendChild(word);
    if (wi < arr.length - 1) el.appendChild(document.createTextNode(' '));
  });
  return units;
}

function fit(el, maxW) {
  const cs = parseFloat(el.style.fontSize);
  el.style.width = 'auto'; el.style.display = 'inline-block';
  const w = el.getBoundingClientRect().width;
  if (w > maxW) el.style.fontSize = `${(cs * maxW / w).toFixed(1)}px`;
  el.style.display = ''; el.style.width = el.dataset.w || '1080px';
}

export class Texts {
  constructor(root) {
    this.root = root;
    this.items = [];
    const center = (y, size, extra = {}) => ({ top: `${y}px`, left: `${CX - 540}px`, fontSize: `${size}px`, ...extra });
    const add = (o) => {
      const el = mk(root, `t ${o.cls || ''}`, '', o.css);
      if (o.mode === 'rise' || o.mode === 'words') {
        o.units = split(el, o.text, o.mode === 'words');
      } else {
        el.innerHTML = o.html ?? o.text;
      }
      if (o.fit !== false && !o.css.width) fit(el, o.maxW || SAFE_W);
      o.el = el;
      if (o.mode === 'type') o.full = o.text;
      this.items.push(o);
      return o;
    };
    this.add = add;

    // ---------------- SCENE 1 — hook
    add({ text: '⚠  SYSTEM ALERT  ·  CHECK TYRES', mode: 'type', cls: 'mono', in: 0.45, out: 1.45, outMode: 'fade', css: center(1085, 24, { color: '#ff4a4a' }) });
    add({ text: 'YOUR TYRES', mode: 'slam', cls: 'hero', in: 2.0, out: 5.95, css: center(860, 132) });
    add({ text: 'ARE TRYING TO', mode: 'rise', cls: 'hero', in: 2.55, out: 6.02, css: center(1028, 92, { fontWeight: 800, color: '#d8dce2' }) });
    add({ text: 'TELL YOU', mode: 'rise', cls: 'hero', in: 3.05, out: 6.09, css: center(1135, 132) });
    add({ text: 'SOMETHING.', mode: 'slam', cls: 'hero red', in: 3.7, out: 6.16, css: center(1300, 140) });

    // ---------------- scene titles (01/02/03)
    const title = (num, l1, l2, tin, tout) => {
      const n = mk(root, 'num', `<span class="o">${num}</span><span class="f">${num}</span>`, { left: '84px', top: '262px' });
      const lab = mk(root, 'label', `<div class="l1"></div><div class="l2"></div>`, { left: '400px', top: '300px' });
      const u1 = split(lab.querySelector('.l1'), l1), u2 = split(lab.querySelector('.l2'), l2);
      const rule = mk(root, 'rule', '', { left: '404px', top: '450px', width: '150px' });
      this.items.push({ kind: 'title', n, lab, u1, u2, rule, in: tin, out: tout });
    };
    title('01', 'WORN-OUT', 'TREAD', 6.75, 15.75);
    title('02', 'SIDEWALL', 'DAMAGE', 16.55, 25.75);
    title('03', 'UNEVEN', 'TYRE WEAR', 26.55, 35.75);

    const sub = (text, y, tin, tout) => add({ text, mode: 'words', cls: 'sub', in: tin, out: tout, stagger: 0.07, fit: false, css: { top: `${y}px`, left: `${CX - 540}px`, width: '1080px' } });
    sub('Less tread can mean *less* *grip,* especially on _wet_ _roads._', 1392, 10.6, 15.7);
    sub('*Cracks,* *cuts* and *bulges* should _never_ _be_ _ignored._', 1392, 21.3, 25.7);
    sub('Check your *alignment,* *inflation* and *suspension.*', 1430, 28.0, 35.7);

    // ---------------- SCENE 5 — solution (left-aligned two-line heroes)
    const duo = (a, b, tin, tout) => {
      add({ text: a, mode: 'rise', cls: 'hero', in: tin, out: tout, fit: false, css: { top: '262px', left: '88px', width: 'auto', fontSize: '112px', textAlign: 'left' } });
      add({ text: b, mode: 'rise', cls: 'hero chrome', in: tin + 0.18, out: tout + 0.05, fit: false, css: { top: '380px', left: '88px', width: 'auto', fontSize: '112px', textAlign: 'left' } });
    };
    duo('REGULAR', 'INSPECTION', 36.55, 41.15);
    duo('PROPER', 'MAINTENANCE', 41.45, 46.05);
    duo('THE RIGHT', 'TYRES', 46.3, 48.85);
    add({ text: 'TYRES FROM', mode: 'type', cls: 'mono', in: 46.9, out: 48.85, css: center(1350, 22, { color: '#e3202a' }) });
    add({ text: 'APOLLO · YOKOHAMA · BRIDGESTONE', mode: 'words', cls: 'hero', in: 47.0, out: 48.85, stagger: 0.12, css: center(1392, 38, { fontWeight: 700, letterSpacing: '0.08em' }) });
    add({ text: 'CONTINENTAL · JK TYRE', mode: 'words', cls: 'hero', in: 47.35, out: 48.85, stagger: 0.12, css: center(1446, 38, { fontWeight: 700, letterSpacing: '0.08em' }) });

    // ---------------- SCENE 6 — brand
    add({ text: 'YOUR JOURNEY', mode: 'rise', cls: 'hero', in: 49.6, out: 52.85, css: center(1112, 108) });
    add({ text: 'DESERVES', mode: 'rise', cls: 'hero', in: 50.25, out: 52.92, css: center(1228, 108, { color: '#cfd3da' }) });
    add({ text: 'BETTER CARE.', mode: 'rise', cls: 'hero red', in: 50.9, out: 52.99, css: center(1344, 116) });

    add({ text: 'RODO', mode: 'track', cls: 'hero metal', in: 53.45, out: 99, sheen: true, ls: 0.16, css: center(905, 226, { letterSpacing: '0.16em', fontWeight: 900 }) });
    add({ text: 'ACCESSORIES', mode: 'track', cls: 'hero', in: 53.85, out: 99, ls: 0.5, css: center(1142, 44, { letterSpacing: '0.5em', fontWeight: 600, color: '#c9ced6', textShadow: 'none' }) });
    this.brandRule = mk(root, 'rule', '', { left: `${CX - 60}px`, top: '1222px', width: '120px', transformOrigin: 'center center' });
    add({ text: 'DRIVE SAFE. DRIVE CONFIDENT.', mode: 'words', cls: 'hero', in: 55.0, out: 99, stagger: 0.13, css: center(1262, 46, { fontWeight: 800, letterSpacing: '0.06em' }) });
    add({ html: '<span class="pill">VISIT RODO ACCESSORIES</span>', text: 'VISIT', mode: 'pop', cls: '', in: 56.3, out: 99, fit: false, css: center(1352, 38) });
    add({ text: 'TYRES  ·  ACCESSORIES  ·  INFOTAINMENT  ·  AUDIO  ·  CAR CARE', mode: 'fade', cls: 'mono', in: 56.9, out: 99, css: center(1490, 21, { color: '#9aa0a8', letterSpacing: '0.16em' }) });
  }

  update(t) {
    for (const o of this.items) {
      if (o.kind === 'title') { this.title(o, t); continue; }
      const el = o.el;
      if (t < o.in - 0.01 || t > o.out + 0.6) { el.style.opacity = 0; continue; }
      const outP = ease.in(prog(t, o.out, o.out + 0.38));
      let op = 1, tr = '', blur = 0;
      const p = prog(t, o.in, o.in + (o.dur || 0.5));
      switch (o.mode) {
        case 'slam': {
          const e = ease.outExpo(p);
          op = clamp(p * 3); tr = `scale(${1.45 - 0.45 * e})`; blur = 22 * (1 - e);
          break;
        }
        case 'rise': case 'words': {
          const st = o.stagger || 0.035;
          o.units.forEach((u, i) => {
            const q = ease.outExpo(prog(t, o.in + i * st, o.in + i * st + 0.6));
            u.style.transform = `translateY(${(108 * (1 - q)).toFixed(1)}%)`;
          });
          op = 1;
          break;
        }
        case 'track': {
          const e = ease.outExpo(prog(t, o.in, o.in + 1.1));
          el.style.letterSpacing = `${(o.ls + 0.45 * (1 - e)).toFixed(3)}em`;
          op = clamp(prog(t, o.in, o.in + 0.35)); blur = 14 * (1 - e);
          break;
        }
        case 'type': {
          const n = Math.floor(prog(t, o.in, o.in + 0.5) * o.full.length);
          el.textContent = o.full.slice(0, n) + (Math.floor(t * 8) % 2 && n < o.full.length ? '▍' : '');
          break;
        }
        case 'pop': {
          const e = ease.outBack(prog(t, o.in, o.in + 0.55));
          op = clamp(prog(t, o.in, o.in + 0.2)); tr = `scale(${(0.82 + 0.18 * e).toFixed(3)})`;
          break;
        }
        default: { // fade
          const e = ease.out(p); op = e; tr = `translateY(${(18 * (1 - e)).toFixed(1)}px)`;
        }
      }
      if (outP > 0) { op *= 1 - outP; tr += ` translateY(${(-70 * outP).toFixed(1)}px)`; blur += 12 * outP; }
      if (o.sheen) el.style.setProperty('--sheen', `${(-30 + 160 * ((t - o.in) * 0.55 % 1.6)).toFixed(1)}%`);
      el.style.opacity = op.toFixed(3);
      el.style.transform = tr;
      el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(1)}px)` : (o.cls && o.cls.includes('chrome') ? 'drop-shadow(0 4px 14px rgba(0,0,0,0.6))' : '');
    }
    // brand rule
    const r = this.brandRule, rp = ease.outExpo(prog(t, 54.2, 54.9));
    r.style.opacity = t > 54.2 ? 1 : 0; r.style.transform = `scaleX(${rp.toFixed(3)})`;
  }

  title(o, t) {
    const vis = t >= o.in - 0.01 && t <= o.out + 0.6;
    for (const el of [o.n, o.lab, o.rule]) el.style.opacity = vis ? 1 : 0;
    if (!vis) return;
    const outP = ease.in(prog(t, o.out, o.out + 0.35));
    // number: outline flies in, then fills left-to-right
    const a = ease.outExpo(prog(t, o.in, o.in + 0.7));
    const fillP = ease.inOut(prog(t, o.in + 0.35, o.in + 1.0));
    o.n.style.opacity = (clamp(prog(t, o.in, o.in + 0.25)) * (1 - outP)).toFixed(3);
    o.n.style.transform = `translateX(${(-80 * (1 - a) - 40 * outP).toFixed(1)}px) scale(${(1.25 - 0.25 * a).toFixed(3)})`;
    o.n.style.filter = a < 0.98 || outP > 0 ? `blur(${(12 * (1 - a) + 10 * outP).toFixed(1)}px)` : '';
    o.n.querySelector('.f').style.clipPath = `inset(0 ${(100 - 100 * fillP).toFixed(1)}% 0 0)`;
    // label lines rise
    const rise = (units, t0) => units.forEach((u, i) => {
      const q = ease.outExpo(prog(t, t0 + i * 0.03, t0 + i * 0.03 + 0.6));
      u.style.transform = `translateY(${(108 * (1 - q)).toFixed(1)}%)`;
    });
    rise(o.u1, o.in + 0.25); rise(o.u2, o.in + 0.4);
    o.lab.style.opacity = (1 - outP).toFixed(3);
    o.lab.style.transform = `translateY(${(-50 * outP).toFixed(1)}px)`;
    const rp = ease.outExpo(prog(t, o.in + 0.55, o.in + 1.2));
    o.rule.style.transform = `scaleX(${(rp * (1 - outP)).toFixed(3)})`;
  }
}
