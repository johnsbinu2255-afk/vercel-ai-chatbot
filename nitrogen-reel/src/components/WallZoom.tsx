import React from 'react';
import { random } from 'remotion';
import { C, FONT } from '../lib/theme';

const tri = (u: number) => 1 - Math.abs(2 * (u - Math.floor(u)) - 1);
const WALL_TOP = 12;
const WALL_BOTTOM = 44;

const Molecule: React.FC<{ x: number; y: number; a: number; color: string; opacity?: number }> = ({ x, y, a, color, opacity = 1 }) => {
  const dx = Math.cos(a) * 3.6;
  const dy = Math.sin(a) * 3.6;
  return (
    <g opacity={opacity}>
      <circle cx={x - dx} cy={y - dy} r={5.2} fill={color} />
      <circle cx={x + dx} cy={y + dy} r={5.2} fill={color} />
      <circle cx={x - dx - 1.6} cy={y - dy - 1.6} r={1.6} fill="rgba(255,255,255,0.7)" />
    </g>
  );
};

// Close-up of the tyre wall. 'leak': grey air molecules slip through the rubber.
// 'hold': blue nitrogen molecules drift slowly and stay inside. t = seconds since it started.
export const WallZoom: React.FC<{ id: string; size: number; mode: 'leak' | 'hold'; t: number }> = ({ id, size, mode, t }) => {
  const leak = mode === 'leak';
  const color = leak ? C.grey : C.blue;
  const count = leak ? 18 : 16;
  const mols: React.ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const r = (k: string) => random(`${id}${k}${i}`);
    const vx = leak ? 0.55 + r('vx') * 0.7 : 0.12 + r('vx') * 0.18;
    const vy = leak ? 0.45 + r('vy') * 0.6 : 0.1 + r('vy') * 0.15;
    const pos = (tt: number) => ({ x: -74 + 148 * tri(r('x') + tt * vx), y: -82 + (WALL_TOP - 8 + 82) * tri(r('y') + tt * vy) });
    const angle = r('a') * 6.28 + t * (leak ? 4 : 1.2) * (r('s') - 0.5);
    const escapeAt = leak && i < 12 ? 0.25 + i * 0.3 : Infinity;
    if (t < escapeAt) {
      const p = pos(t);
      mols.push(<Molecule key={i} x={p.x} y={p.y} a={angle} color={color} />);
      continue;
    }
    // Escaping: straight through the wall, then out into the air and away.
    const start = pos(escapeAt);
    const u = t - escapeAt;
    const through = Math.min(1, u / 0.45);
    const out = Math.max(0, u - 0.45);
    const x = start.x + (r('dx') - 0.5) * 40 * through + (r('ox') - 0.5) * 60 * out;
    const y = start.y + (WALL_BOTTOM + 8 - start.y) * through + out * 70;
    const fade = Math.max(0, 1 - out / 0.9);
    if (fade <= 0) continue;
    mols.push(
      <g key={i}>
        <line x1={x} y1={y - 16} x2={x} y2={y - 2} stroke={color} strokeWidth={3} strokeLinecap="round" opacity={0.35 * fade} />
        <Molecule x={x} y={y} a={angle} color={color} opacity={fade} />
      </g>,
    );
  }
  const pores = Array.from({ length: leak ? 14 : 6 }, (_, i) => (
    <ellipse
      key={i}
      cx={-86 + random(`${id}p${i}`) * 172}
      cy={WALL_TOP + 6 + random(`${id}q${i}`) * (WALL_BOTTOM - WALL_TOP - 12)}
      rx={leak ? 3.4 : 2}
      ry={leak ? 6 : 3}
      fill="#050505"
    />
  ));
  const label = (y: number, text: string, op = 0.75) => (
    <text x={0} y={y} textAnchor="middle" fontFamily={FONT.body} fontWeight={700} fontSize={13.5} letterSpacing={1.2} fill="#ffffff" opacity={op}>
      {text}
    </text>
  );
  return (
    <svg width={size} height={size} viewBox="-100 -100 200 200" style={{ overflow: 'visible', filter: `drop-shadow(0 0 22px ${leak ? 'rgba(156,163,175,0.45)' : 'rgba(0,180,255,0.6)'})` }}>
      <defs>
        <clipPath id={`${id}-lens`}>
          <circle r={92} />
        </clipPath>
        <linearGradient id={`${id}-wall`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a2a2e" />
          <stop offset="1" stopColor="#111113" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${id}-lens)`}>
        <rect x={-100} y={-100} width={200} height={WALL_TOP + 100} fill={leak ? '#1c2028' : '#06243a'} />
        <rect x={-100} y={WALL_BOTTOM} width={200} height={100 - WALL_BOTTOM} fill="#0b0d10" />
        <rect x={-100} y={WALL_TOP} width={200} height={WALL_BOTTOM - WALL_TOP} fill={`url(#${id}-wall)`} />
        {pores}
        {label(-66, 'INSIDE TYRE')}
        {label(WALL_TOP + 20, 'TYRE WALL', 0.6)}
        {label(78, 'OUTSIDE AIR', 0.6)}
        <g style={{ filter: leak ? undefined : `drop-shadow(0 0 4px ${C.blue})` }}>{mols}</g>
      </g>
      <circle r={92} fill="none" stroke={leak ? C.grey : C.blue} strokeWidth={5} />
      <circle r={86} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={2} />
    </svg>
  );
};
