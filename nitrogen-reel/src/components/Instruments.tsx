import React from 'react';
import { interpolateColors } from 'remotion';
import { C, FONT } from '../lib/theme';

const rad = (d: number) => (d * Math.PI) / 180;
const pt = (d: number, r: number) => [Math.cos(rad(d)) * r, Math.sin(rad(d)) * r];
const arc = (r: number, d0: number, d1: number) => {
  const [x0, y0] = pt(d0, r);
  const [x1, y1] = pt(d1, r);
  return `M${x0},${y0} A${r},${r} 0 ${d1 - d0 > 180 ? 1 : 0} 1 ${x1},${y1}`;
};

// Tyre pressure gauge, 0-40 PSI.
export const Gauge: React.FC<{ id: string; value: number; size: number; tone: 'grey' | 'blue' }> = ({ id, value, size, tone }) => {
  const a0 = 150;
  const a1 = 390;
  const ang = (v: number) => a0 + ((a1 - a0) * v) / 40;
  const low = value < 28.5;
  const readout = low ? C.red : C.green;
  return (
    <svg width={size} height={size} viewBox="-112 -112 224 224" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id={`${id}-face`} gradientUnits="userSpaceOnUse" cx={-20} cy={-30} r={140}>
          <stop offset="0" stopColor="#2a2a30" />
          <stop offset="1" stopColor="#0c0c0e" />
        </radialGradient>
      </defs>
      <circle r={106} fill="#0d0d0f" stroke={tone === 'blue' ? C.blue : C.grey} strokeWidth={4} opacity={0.95} />
      <circle r={99} fill={`url(#${id}-face)`} />
      <path d={arc(84, ang(0), ang(28))} stroke={C.red} strokeWidth={9} fill="none" opacity={0.8} />
      <path d={arc(84, ang(30), ang(36))} stroke={C.green} strokeWidth={9} fill="none" />
      {Array.from({ length: 21 }, (_, i) => {
        const v = i * 2;
        const major = v % 10 === 0;
        const [x0, y0] = pt(ang(v), major ? 66 : 72);
        const [x1, y1] = pt(ang(v), 78);
        return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#e8e8ec" strokeWidth={major ? 3 : 1.5} />;
      })}
      {[0, 10, 20, 30, 40].map((v) => {
        const [x, y] = pt(ang(v), 52);
        return (
          <text key={v} x={x} y={y + 5} textAnchor="middle" fontFamily={FONT.head} fontSize={16} fill="#cfcfd6">
            {v}
          </text>
        );
      })}
      <g transform={`rotate(${ang(value)})`}>
        <path d="M -14,-4 L 80,-1.5 L 80,1.5 L -14,4 Z" fill={low ? C.red : '#ffffff'} style={{ filter: `drop-shadow(0 0 6px ${low ? C.red : '#ffffff'})` }} />
      </g>
      <circle r={10} fill="#d8d8de" />
      <circle r={4} fill="#333" />
      <text y={50} textAnchor="middle" fontFamily={FONT.head} fontSize={34} fill={readout} style={{ filter: `drop-shadow(0 0 8px ${readout})` }}>
        {Math.round(value)}
        <tspan fontSize={18} dx={4}>
          PSI
        </tspan>
      </text>
    </svg>
  );
};

// Thermometer; level 0 (cool) .. 1 (hot).
export const Thermometer: React.FC<{ id: string; level: number; height: number }> = ({ id, level, height }) => {
  const l = Math.max(0, Math.min(1, level));
  const col = interpolateColors(l, [0, 0.45, 0.7, 1], [C.green, C.green, '#ffb020', C.red]);
  const top = 20;
  const bottom = 300;
  const y = bottom - (bottom - top) * l;
  return (
    <svg width={(height * 90) / 370} height={height} viewBox="0 0 90 370" style={{ overflow: 'visible', filter: `drop-shadow(0 0 ${10 + 18 * l}px ${col})` }}>
      <defs>
        <clipPath id={`${id}-tube`}>
          <rect x={31} y={top - 6} width={28} height={bottom - top + 40} rx={14} />
        </clipPath>
      </defs>
      <rect x={27} y={top - 10} width={36} height={bottom - top + 44} rx={18} fill="#0e0e10" stroke="#d8d8de" strokeWidth={3} />
      <rect x={66} y={top} width={6} height={(bottom - top) * 0.3} fill={C.red} opacity={0.8} rx={2} />
      <rect x={66} y={top + (bottom - top) * 0.55} width={6} height={(bottom - top) * 0.45} fill={C.green} opacity={0.8} rx={2} />
      {Array.from({ length: 8 }, (_, i) => (
        <line key={i} x1={18} x2={27} y1={top + ((bottom - top) * i) / 7} y2={top + ((bottom - top) * i) / 7} stroke="#bdbdc4" strokeWidth={2} />
      ))}
      <g clipPath={`url(#${id}-tube)`}>
        <rect x={31} y={y} width={28} height={bottom - y + 40} fill={col} />
        <rect x={35} y={y} width={6} height={bottom - y + 30} fill="rgba(255,255,255,0.35)" />
      </g>
      <circle cx={45} cy={330} r={32} fill="#0e0e10" stroke="#d8d8de" strokeWidth={3} />
      <circle cx={45} cy={330} r={25} fill={col} />
      <circle cx={37} cy={321} r={7} fill="rgba(255,255,255,0.45)" />
    </svg>
  );
};
