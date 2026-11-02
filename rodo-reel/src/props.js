// Drawn props: tyre, map pin, icons, brand plates and the accessory illustrations.
(function () {
  const R = window.R;
  const { TAU } = R;

  // ---------- tyre ----------
  function spokes(ctx, rad) {
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.rotate((i * TAU) / 5);
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.rotate(side * 0.12);
        ctx.beginPath();
        ctx.moveTo(rad * 0.16, -rad * 0.03);
        ctx.lineTo(rad * 0.6, -rad * 0.058);
        ctx.lineTo(rad * 0.6, rad * 0.058);
        ctx.lineTo(rad * 0.16, rad * 0.03);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, -rad * 0.06, 0, rad * 0.06);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.45, '#c9c9cf');
        g.addColorStop(1, '#55555c');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }
  }

  function sidewallText(ctx, rad, text, startAng) {
    const size = rad * 0.105;
    ctx.font = R.font(size, 'Anton');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const r = rad * 0.76;
    let total = 0;
    const widths = [...text].map((ch) => {
      const w = ctx.measureText(ch).width + size * 0.12;
      total += w;
      return w;
    });
    let a = startAng - total / r / 2;
    [...text].forEach((ch, i) => {
      const w = widths[i];
      a += w / r / 2;
      ctx.save();
      ctx.rotate(a);
      ctx.translate(0, -r);
      ctx.fillStyle = '#4a4a52';
      ctx.fillText(ch, 0, 0);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillText(ch, -1, -1.5);
      ctx.restore();
      a += w / r / 2;
    });
  }

  // Tyre with alloy rim. ang = rotation (radians), blur = rotational smear (radians).
  R.drawTyre = function (ctx, x, y, rad, ang, o = {}) {
    const blur = o.blur || 0;
    const baseA = ctx.globalAlpha;
    ctx.save();
    ctx.translate(x, y);

    // Tread silhouette.
    ctx.fillStyle = '#121214';
    ctx.beginPath();
    if (blur < 0.35) {
      const n = 46;
      for (let i = 0; i < n; i++) {
        const a0 = ang + (i / n) * TAU;
        const a1 = a0 + (TAU / n) * 0.7;
        const a2 = a0 + TAU / n;
        ctx.arc(0, 0, rad, a0, a1);
        ctx.arc(0, 0, rad * 0.968, a1 + 0.012, a2 - 0.012);
      }
      ctx.closePath();
    } else {
      ctx.arc(0, 0, rad * 0.985, 0, TAU);
    }
    ctx.fill();

    // Rubber body.
    let g = ctx.createRadialGradient(-rad * 0.2, -rad * 0.25, rad * 0.3, 0, 0, rad * 0.95);
    g.addColorStop(0, '#2c2c31');
    g.addColorStop(0.7, '#1b1b1f');
    g.addColorStop(0.92, '#101012');
    g.addColorStop(1, '#0a0a0b');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rad * 0.9, 0, TAU);
    ctx.fill();

    // Tread grooves on the shoulder.
    if (blur < 0.35) {
      ctx.save();
      ctx.rotate(ang);
      ctx.strokeStyle = '#050506';
      ctx.lineWidth = Math.max(1, rad * 0.018);
      const n = 46;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + (TAU / n) * 0.85;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        ctx.beginPath();
        ctx.moveTo(ca * rad * 0.9, sa * rad * 0.9);
        ctx.lineTo(ca * rad * 0.975, sa * rad * 0.975);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.lineWidth = Math.max(1, rad * 0.012);
    ctx.beginPath();
    ctx.arc(0, 0, rad * 0.9, 0, TAU);
    ctx.stroke();

    // Sidewall lettering.
    if (!o.noText && blur < 0.3 && rad > 60) {
      ctx.save();
      ctx.rotate(ang);
      ctx.globalAlpha = baseA * (1 - R.prog(blur, 0.1, 0.3));
      sidewallText(ctx, rad, o.sidewall || 'RODO TYRES', 0);
      sidewallText(ctx, rad, o.sidewall || 'RODO TYRES', Math.PI);
      ctx.restore();
    }

    // Static light on the sidewall.
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = rad * 0.12;
    ctx.beginPath();
    ctx.arc(0, 0, rad * 0.76, Math.PI * 1.05, Math.PI * 1.62);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,212,0,0.10)';
    ctx.lineWidth = rad * 0.04;
    ctx.beginPath();
    ctx.arc(0, 0, rad * 0.95, Math.PI * 0.05, Math.PI * 0.42);
    ctx.stroke();
    ctx.restore();

    // Rim lip.
    g = ctx.createLinearGradient(-rad * 0.6, -rad * 0.6, rad * 0.6, rad * 0.6);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, '#9b9ba3');
    g.addColorStop(0.7, '#5a5a61');
    g.addColorStop(1, '#d8d8de');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rad * 0.645, 0, TAU);
    ctx.fill();
    // Barrel.
    g = ctx.createRadialGradient(0, 0, rad * 0.1, 0, 0, rad * 0.6);
    g.addColorStop(0, '#333338');
    g.addColorStop(0.75, '#16161a');
    g.addColorStop(1, '#050506');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rad * 0.605, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = R.YELLOW;
    ctx.lineWidth = Math.max(1, rad * 0.014);
    ctx.beginPath();
    ctx.arc(0, 0, rad * 0.585, 0, TAU);
    ctx.stroke();

    // Spokes with rotational blur.
    const copies = R.clamp(Math.ceil(blur / 0.05), 1, 12);
    for (let c = 0; c < copies; c++) {
      ctx.save();
      ctx.globalAlpha = baseA * (copies > 1 ? Math.min(1, 2.2 / copies) : 1);
      ctx.rotate(ang - (blur * c) / copies);
      spokes(ctx, rad);
      ctx.restore();
    }
    if (blur > 0.6) {
      ctx.save();
      ctx.globalAlpha = baseA * R.prog(blur, 0.6, 1.6) * 0.6;
      g = ctx.createRadialGradient(0, 0, rad * 0.16, 0, 0, rad * 0.6);
      g.addColorStop(0, '#9a9aa2');
      g.addColorStop(1, '#3a3a40');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, rad * 0.6, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // Hub.
    g = ctx.createLinearGradient(-rad * 0.18, -rad * 0.18, rad * 0.18, rad * 0.18);
    g.addColorStop(0, '#f6f6f8');
    g.addColorStop(1, '#6b6b72');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rad * 0.18, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.rotate(ang);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.6;
      ctx.fillStyle = '#2a2a2f';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * rad * 0.137, Math.sin(a) * rad * 0.137, rad * 0.022, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = R.YELLOW;
    ctx.beginPath();
    ctx.arc(0, 0, rad * 0.095, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = R.font(rad * 0.12, 'Anton');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('R', 0, rad * 0.006);
    ctx.restore();

    // Gloss over the rim.
    g = ctx.createLinearGradient(-rad * 0.5, -rad * 0.6, rad * 0.3, rad * 0.4);
    g.addColorStop(0, 'rgba(255,255,255,0.22)');
    g.addColorStop(0.5, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rad * 0.62, 0, TAU);
    ctx.fill();
    ctx.restore();
  };

  // ---------- map pin ----------
  // (x, y) is the tip. sx/sy squash for landing.
  R.drawPin = function (ctx, x, y, size, o = {}) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(o.sx || 1, o.sy || 1);
    const r = size * 0.62;
    const cy = -size * 1.32;
    const d = -cy;
    const a = Math.acos(r / d);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, cy, r, Math.PI / 2 + a, Math.PI * 2 + Math.PI / 2 - a);
    ctx.closePath();
    const g = ctx.createLinearGradient(-r, cy - r, r, 0);
    g.addColorStop(0, '#ff6a50');
    g.addColorStop(0.5, '#e3120b');
    g.addColorStop(1, '#8a0600');
    ctx.fillStyle = g;
    ctx.shadowColor = 'rgba(255,40,0,0.8)';
    ctx.shadowBlur = size * 0.5;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = size * 0.07;
    ctx.strokeStyle = '#ffd400';
    ctx.stroke();
    ctx.fillStyle = '#ffd400';
    ctx.beginPath();
    ctx.arc(0, cy, r * 0.48, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(0, cy, r * 0.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.35, cy - r * 0.45, r * 0.28, r * 0.16, -0.6, 0, TAU);
    ctx.fill();
    ctx.restore();
  };

  // ---------- icons ----------
  R.iconTyre = function (ctx, x, y, r, ang = 0) {
    R.drawTyre(ctx, x, y, r, ang, { noText: true });
  };

  R.iconSpeaker = function (ctx, x, y, r, color = '#111', t = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(-r * 0.62, -r * 0.24);
    ctx.lineTo(-r * 0.3, -r * 0.24);
    ctx.lineTo(r * 0.06, -r * 0.56);
    ctx.lineTo(r * 0.06, r * 0.56);
    ctx.lineTo(-r * 0.3, r * 0.24);
    ctx.lineTo(-r * 0.62, r * 0.24);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = r * 0.1;
    ctx.lineCap = 'round';
    const baseA = ctx.globalAlpha;
    for (let i = 0; i < 3; i++) {
      const pulse = 0.55 + 0.45 * Math.max(0, Math.sin(t * 9 - i * 0.9));
      ctx.globalAlpha = baseA * pulse;
      ctx.beginPath();
      ctx.arc(r * 0.1, 0, r * (0.28 + i * 0.2), -0.75, 0.75);
      ctx.stroke();
    }
    ctx.restore();
  };

  R.iconCheck = function (ctx, x, y, r, p = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(p, p);
    ctx.fillStyle = R.YELLOW;
    ctx.shadowColor = 'rgba(255,200,0,0.7)';
    ctx.shadowBlur = r * 0.6;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#111';
    ctx.lineWidth = r * 0.24;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, r * 0.02);
    ctx.lineTo(-r * 0.12, r * 0.34);
    ctx.lineTo(r * 0.48, -r * 0.32);
    ctx.stroke();
    ctx.restore();
  };

  // Red brush slash, revealed left to right (p 0..1).
  R.drawSlash = function (ctx, x, y, w, h, p) {
    if (p <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 20, y - h * 2, (w + 40) * R.clamp(p), h * 4);
    ctx.clip();
    ctx.translate(x, y);
    ctx.rotate(-0.035);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.35);
    ctx.quadraticCurveTo(w * 0.05, -h * 0.25, w * 0.18, -h * 0.45);
    ctx.lineTo(w * 1.02, -h * 0.62);
    ctx.quadraticCurveTo(w * 0.98, h * 0.05, w * 0.93, h * 0.3);
    ctx.lineTo(w * 0.15, h * 0.58);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -h * 0.6, 0, h * 0.6);
    g.addColorStop(0, '#ff5a3c');
    g.addColorStop(0.5, '#e3120b');
    g.addColorStop(1, '#8f0700');
    ctx.fillStyle = g;
    ctx.shadowColor = 'rgba(255,30,0,0.75)';
    ctx.shadowBlur = h * 0.8;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(w * 0.2, -h * 0.43, w * 0.7, h * 0.12);
    ctx.restore();
  };

  // Glossy dark plate with a yellow rim.
  R.drawPlate = function (ctx, cx, cy, w, h, o = {}) {
    const x = cx - w / 2;
    const y = cy - h / 2;
    const r = o.radius != null ? o.radius : h * 0.22;
    ctx.save();
    ctx.shadowColor = o.glow || 'rgba(255,200,0,0.45)';
    ctx.shadowBlur = o.glowBlur != null ? o.glowBlur : 36;
    R.rrect(ctx, x, y, w, h, r);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, o.top || '#26262b');
    g.addColorStop(0.5, o.mid || '#121215');
    g.addColorStop(1, o.bottom || '#060607');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = o.border || 4;
    const bg = ctx.createLinearGradient(x, y, x + w, y + h);
    bg.addColorStop(0, '#fff1a0');
    bg.addColorStop(0.3, R.YELLOW);
    bg.addColorStop(1, '#ff9a00');
    ctx.strokeStyle = o.borderColor || bg;
    ctx.stroke();
    // Top gloss.
    ctx.save();
    R.rrect(ctx, x + 4, y + 4, w - 8, h * 0.46, [r * 0.8, r * 0.8, 6, 6]);
    const gg = ctx.createLinearGradient(0, y, 0, y + h * 0.5);
    gg.addColorStop(0, 'rgba(255,255,255,0.16)');
    gg.addColorStop(1, 'rgba(255,255,255,0.02)');
    ctx.fillStyle = gg;
    ctx.fill();
    ctx.restore();
    ctx.restore();
  };

  // ---------- accessories ----------

  // Android head unit with a generic home screen.
  R.drawHeadUnit = function (ctx, cx, cy, w, t) {
    const h = w * 0.6;
    const x = cx - w / 2;
    const y = cy - h / 2;
    ctx.save();
    // Bezel.
    ctx.shadowColor = 'rgba(255,212,0,0.35)';
    ctx.shadowBlur = 60;
    R.rrect(ctx, x, y, w, h, 34);
    let g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#3a3a40');
    g.addColorStop(0.08, '#1c1c20');
    g.addColorStop(1, '#09090a');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.stroke();
    // Side buttons.
    for (let i = 0; i < 4; i++) {
      const by = y + h * 0.2 + i * h * 0.17;
      ctx.fillStyle = i === 0 ? '#ff2a14' : '#5c5c66';
      ctx.beginPath();
      ctx.arc(x + w * 0.045, by, w * 0.012, 0, R.TAU);
      ctx.fill();
    }
    // Screen.
    const sx = x + w * 0.085;
    const sy = y + h * 0.07;
    const sw = w * 0.875;
    const sh = h * 0.86;
    ctx.save();
    R.rrect(ctx, sx, sy, sw, sh, 14);
    ctx.clip();
    g = ctx.createLinearGradient(sx, sy, sx + sw, sy + sh);
    g.addColorStop(0, '#0f1b2e');
    g.addColorStop(1, '#05070c');
    ctx.fillStyle = g;
    ctx.fillRect(sx, sy, sw, sh);
    // Status bar.
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = R.font(sh * 0.07, 'Barlow Condensed', 700);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText('10:24', sx + sw * 0.03, sy + sh * 0.065);
    ctx.textAlign = 'right';
    ctx.fillText('28°C', sx + sw * 0.97, sy + sh * 0.065);
    // Map card.
    const mx = sx + sw * 0.03;
    const my = sy + sh * 0.14;
    const mw = sw * 0.55;
    const mh = sh * 0.58;
    R.rrect(ctx, mx, my, mw, mh, 12);
    ctx.fillStyle = '#16263d';
    ctx.fill();
    ctx.save();
    R.rrect(ctx, mx, my, mw, mh, 12);
    ctx.clip();
    ctx.strokeStyle = 'rgba(140,170,210,0.35)';
    ctx.lineWidth = 6;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(mx - 20, my + mh * (0.15 + i * 0.17));
      ctx.bezierCurveTo(mx + mw * 0.3, my + mh * (0.05 + i * 0.2), mx + mw * 0.6, my + mh * (0.35 + i * 0.1), mx + mw + 20, my + mh * (0.1 + i * 0.16));
      ctx.stroke();
    }
    ctx.strokeStyle = R.YELLOW;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const routeP = R.fract(t * 0.8);
    ctx.setLineDash([mw * 2, mw * 2]);
    ctx.lineDashOffset = mw * 2 * (1 - Math.min(1, 0.4 + routeP));
    ctx.beginPath();
    ctx.moveTo(mx + mw * 0.15, my + mh * 0.85);
    ctx.lineTo(mx + mw * 0.35, my + mh * 0.6);
    ctx.lineTo(mx + mw * 0.55, my + mh * 0.62);
    ctx.lineTo(mx + mw * 0.8, my + mh * 0.25);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    R.drawPin(ctx, mx + mw * 0.8, my + mh * 0.25, mh * 0.09);
    // Media card.
    const ax = sx + sw * 0.61;
    const ay = my;
    const aw = sw * 0.36;
    const ah = mh;
    R.rrect(ctx, ax, ay, aw, ah, 12);
    ctx.fillStyle = '#1c1c24';
    ctx.fill();
    g = ctx.createLinearGradient(ax, ay, ax + aw, ay + aw * 0.6);
    g.addColorStop(0, '#ff2a14');
    g.addColorStop(1, '#ffd400');
    R.rrect(ctx, ax + aw * 0.1, ay + ah * 0.08, aw * 0.8, ah * 0.46, 10);
    ctx.fillStyle = g;
    ctx.fill();
    R.iconSpeaker(ctx, ax + aw * 0.5, ay + ah * 0.31, ah * 0.14, '#111', t);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    R.rrect(ctx, ax + aw * 0.1, ay + ah * 0.62, aw * 0.65, ah * 0.05, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    R.rrect(ctx, ax + aw * 0.1, ay + ah * 0.71, aw * 0.45, ah * 0.04, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    R.rrect(ctx, ax + aw * 0.1, ay + ah * 0.84, aw * 0.8, ah * 0.025, 3);
    ctx.fill();
    ctx.fillStyle = R.YELLOW;
    R.rrect(ctx, ax + aw * 0.1, ay + ah * 0.84, aw * 0.8 * (0.35 + 0.2 * R.fract(t * 0.5)), ah * 0.025, 3);
    ctx.fill();
    // App dock.
    const cols = ['#ff2a14', '#ffd400', '#2f8bff', '#21c45d', '#ffffff', '#ff8a00'];
    const dy = sy + sh * 0.79;
    const ds = sh * 0.15;
    for (let i = 0; i < cols.length; i++) {
      const dx = sx + sw * 0.06 + i * (sw * 0.15);
      R.rrect(ctx, dx, dy, ds, ds, ds * 0.26);
      ctx.fillStyle = cols[i];
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.arc(dx + ds / 2, dy + ds / 2, ds * 0.22, 0, R.TAU);
      ctx.fill();
    }
    // Glass reflection.
    g = ctx.createLinearGradient(sx, sy, sx + sw * 0.6, sy + sh);
    g.addColorStop(0, 'rgba(255,255,255,0.18)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.04)');
    g.addColorStop(0.36, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(sx, sy, sw, sh);
    ctx.restore();
    ctx.restore();
  };

  // Subwoofer in a box. pump 0..1 pushes the cone out.
  R.drawSubwoofer = function (ctx, cx, cy, r, t, pump = 0) {
    ctx.save();
    // Box.
    const bw = r * 2.5;
    ctx.shadowColor = 'rgba(255,40,0,0.35)';
    ctx.shadowBlur = 70;
    R.rrect(ctx, cx - bw / 2, cy - bw / 2, bw, bw, 30);
    let g = ctx.createLinearGradient(0, cy - bw / 2, 0, cy + bw / 2);
    g.addColorStop(0, '#2a2a2f');
    g.addColorStop(1, '#0b0b0d');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.stroke();
    // Frame ring with screws.
    g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    g.addColorStop(0, '#d9d9df');
    g.addColorStop(0.5, '#55555c');
    g.addColorStop(1, '#a5a5ad');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.12, 0, R.TAU);
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * R.TAU + 0.39;
      ctx.fillStyle = '#1a1a1e';
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r * 1.06, cy + Math.sin(a) * r * 1.06, r * 0.025, 0, R.TAU);
      ctx.fill();
    }
    const s = 1 + pump * 0.045;
    // Surround.
    g = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.25, r * 0.8, cx, cy, r);
    g.addColorStop(0, '#3c3c43');
    g.addColorStop(0.5, '#1a1a1e');
    g.addColorStop(1, '#050506');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, R.TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.12 + pump * 0.1) + ')';
    ctx.lineWidth = r * 0.05;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.93, Math.PI * 1.05, Math.PI * 1.7);
    ctx.stroke();
    // Cone.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    g = ctx.createRadialGradient(-r * 0.15, -r * 0.2, r * 0.1, 0, 0, r * 0.86);
    g.addColorStop(0, '#5a5a62');
    g.addColorStop(0.55, '#202025');
    g.addColorStop(1, '#0c0c0e');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.86, 0, R.TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, r * (0.4 + i * 0.08), 0, R.TAU);
      ctx.stroke();
    }
    ctx.strokeStyle = R.YELLOW;
    ctx.lineWidth = r * 0.035;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.86, 0, R.TAU);
    ctx.stroke();
    // Dust cap.
    g = ctx.createRadialGradient(-r * 0.12, -r * 0.14, r * 0.02, 0, 0, r * 0.38);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.18, '#9c9ca5');
    g.addColorStop(0.6, '#2b2b31');
    g.addColorStop(1, '#0d0d10');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.38, 0, R.TAU);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  };

  // Modern LED headlamp. on 0..1 = brightness.
  R.drawHeadlight = function (ctx, cx, cy, w, t, on = 1) {
    const h = w * 0.42;
    ctx.save();
    ctx.translate(cx, cy);
    // Beam.
    if (on > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const bg = ctx.createRadialGradient(-w * 0.18, 0, 10, -w * 0.18, 0, w * 1.1);
      bg.addColorStop(0, `rgba(235,245,255,${0.55 * on})`);
      bg.addColorStop(0.4, `rgba(160,200,255,${0.18 * on})`);
      bg.addColorStop(1, 'rgba(120,160,255,0)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(-w * 0.2, -h * 0.25);
      ctx.lineTo(-w * 1.4, -h * 1.6);
      ctx.lineTo(-w * 1.4, h * 1.8);
      ctx.lineTo(-w * 0.2, h * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // Housing.
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, -h * 0.1);
    ctx.quadraticCurveTo(-w * 0.48, -h * 0.5, -w * 0.25, -h * 0.5);
    ctx.lineTo(w * 0.42, -h * 0.42);
    ctx.quadraticCurveTo(w * 0.52, -h * 0.4, w * 0.5, -h * 0.2);
    ctx.lineTo(w * 0.36, h * 0.42);
    ctx.quadraticCurveTo(w * 0.33, h * 0.5, w * 0.22, h * 0.5);
    ctx.lineTo(-w * 0.32, h * 0.5);
    ctx.quadraticCurveTo(-w * 0.5, h * 0.48, -w * 0.5, h * 0.2);
    ctx.closePath();
    ctx.save();
    ctx.shadowColor = 'rgba(150,200,255,' + 0.6 * on + ')';
    ctx.shadowBlur = 50;
    let g = ctx.createLinearGradient(0, -h * 0.5, 0, h * 0.5);
    g.addColorStop(0, '#3d4048');
    g.addColorStop(0.5, '#121318');
    g.addColorStop(1, '#050507');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(220,230,255,0.5)';
    ctx.stroke();
    // Chrome reflector bowls.
    for (const [px, pr] of [
      [-w * 0.22, h * 0.28],
      [w * 0.12, h * 0.22],
    ]) {
      g = ctx.createRadialGradient(px - pr * 0.3, -pr * 0.3, pr * 0.1, px, 0, pr);
      g.addColorStop(0, '#f0f3ff');
      g.addColorStop(0.5, '#7b8090');
      g.addColorStop(1, '#1c1e25');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, 0, pr, 0, R.TAU);
      ctx.fill();
      // Projector lens.
      g = ctx.createRadialGradient(px, 0, 0, px, 0, pr * 0.62);
      g.addColorStop(0, `rgba(255,255,255,${0.5 + 0.5 * on})`);
      g.addColorStop(0.5, `rgba(190,220,255,${0.3 + 0.6 * on})`);
      g.addColorStop(1, 'rgba(40,60,100,0.9)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, 0, pr * 0.62, 0, R.TAU);
      ctx.fill();
    }
    // LED daytime strip.
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(255,255,255,${0.4 + 0.6 * on})`;
    ctx.shadowColor = 'rgba(170,215,255,1)';
    ctx.shadowBlur = 30 * on + 4;
    ctx.lineWidth = h * 0.07;
    ctx.beginPath();
    ctx.moveTo(-w * 0.42, h * 0.36);
    ctx.lineTo(w * 0.26, h * 0.36);
    ctx.lineTo(w * 0.42, -h * 0.3);
    ctx.stroke();
    ctx.restore();
    if (on > 0) {
      R.streak(ctx, -w * 0.22, 0, w * 0.9, h * 0.06, '#9fd0ff', on * (0.75 + 0.25 * Math.sin(t * 30)));
      R.glow(ctx, -w * 0.22, 0, h * 0.7, '#cfe6ff', on * 0.8);
      R.glow(ctx, w * 0.12, 0, h * 0.55, '#cfe6ff', on * 0.6);
    }
    ctx.restore();
  };

  // Coaxial car speaker.
  R.drawSpeaker = function (ctx, cx, cy, r, t, pump = 0) {
    ctx.save();
    ctx.translate(cx, cy);
    // Frame with tabs.
    let g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, '#4a4a52');
    g.addColorStop(1, '#141417');
    ctx.fillStyle = g;
    ctx.shadowColor = 'rgba(255,212,0,0.35)';
    ctx.shadowBlur = 40;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.12, 0, R.TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * R.TAU + Math.PI / 4;
      ctx.fillStyle = '#2b2b31';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 1.12, Math.sin(a) * r * 1.12, r * 0.13, 0, R.TAU);
      ctx.fill();
      ctx.fillStyle = '#0a0a0b';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15, r * 0.04, 0, R.TAU);
      ctx.fill();
    }
    ctx.strokeStyle = R.YELLOW;
    ctx.lineWidth = r * 0.04;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.02, 0, R.TAU);
    ctx.stroke();
    // Surround.
    g = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.75, 0, 0, r);
    g.addColorStop(0, '#45454c');
    g.addColorStop(1, '#0b0b0d');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.98, 0, R.TAU);
    ctx.fill();
    const s = 1 + pump * 0.05;
    ctx.scale(s, s);
    // Cone (light grey, polypropylene).
    g = ctx.createRadialGradient(-r * 0.2, -r * 0.25, r * 0.1, 0, 0, r * 0.84);
    g.addColorStop(0, '#9a9aa3');
    g.addColorStop(0.6, '#4a4a52');
    g.addColorStop(1, '#1c1c21');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.84, 0, R.TAU);
    ctx.fill();
    // Tweeter bridge.
    ctx.strokeStyle = '#2a2a30';
    ctx.lineWidth = r * 0.08;
    ctx.beginPath();
    ctx.moveTo(-r * 0.78, 0);
    ctx.lineTo(r * 0.78, 0);
    ctx.stroke();
    g = ctx.createRadialGradient(-r * 0.06, -r * 0.08, r * 0.01, 0, 0, r * 0.26);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.3, '#ffe766');
    g.addColorStop(1, '#b37a00');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.26, 0, R.TAU);
    ctx.fill();
    ctx.restore();
  };
})();
