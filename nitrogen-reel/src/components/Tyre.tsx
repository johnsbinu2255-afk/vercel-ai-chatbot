import React from 'react';
import { C } from '../lib/theme';

export type TyreTone = 'neutral' | 'grey' | 'blue';

// Outer outline; `sag` (0..1) flattens the bottom and bulges the sidewalls like a soft tyre.
const outline = (sag: number) => {
  const flat = 100 * (1 - 0.14 * sag);
  const pts: string[] = [];
  for (let i = 0; i <= 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    let x = Math.cos(a) * 100;
    let y = Math.sin(a) * 100;
    const low = Math.max(0, y / 100);
    x *= 1 + 0.08 * sag * Math.pow(low, 1.4);
    if (y > flat) y = flat;
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
};

const spokes = (id: string) =>
  Array.from({ length: 10 }, (_, i) => (
    <path key={i} transform={`rotate(${i * 36})`} d="M14,-3.2 L56,-5.2 L56,5.2 L14,3.2 Z" fill={`url(#${id}-spoke)`} stroke="#3a3a40" strokeWidth={0.6} />
  ));

export const Tyre: React.FC<{
  id: string;
  size: number;
  rotation?: number; // degrees
  tone?: TyreTone;
  sag?: number; // 0..1
  heat?: number; // 0..1 orange-red glow
  glow?: number; // 0..1 tone-coloured glow
  tread?: number; // 1 = new, 0 = bald
  spin?: number; // 0..1 rotational blur
  blurX?: number; // horizontal motion blur (svg units)
  sidewallText?: string;
  style?: React.CSSProperties;
}> = ({ id, size, rotation = 0, tone = 'neutral', sag = 0, heat = 0, glow = 0, tread = 1, spin = 0, blurX = 0, sidewallText = 'RODO TYRES', style }) => {
  const path = outline(sag);
  const drop = sag * 6;
  const accent = tone === 'blue' ? C.blue : tone === 'grey' ? C.grey : C.yellow;
  const depth = 3 + 13 * Math.max(0, Math.min(1, tread));
  const filters = [
    glow > 0 ? `drop-shadow(0 0 ${Math.round(34 * glow)}px ${tone === 'blue' ? 'rgba(0,180,255,0.95)' : 'rgba(255,196,0,0.75)'})` : '',
    heat > 0 ? `drop-shadow(0 0 ${Math.round(60 * heat)}px rgba(255,80,20,${(0.95 * heat).toFixed(2)}))` : '',
    tone === 'grey' ? 'saturate(0.2)' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const copies = Math.max(1, Math.round(1 + spin * 8));
  return (
    <svg width={size} height={size} viewBox="-125 -125 250 250" style={{ overflow: 'visible', filter: filters || undefined, ...style }}>
      <defs>
        <radialGradient id={`${id}-rubber`} gradientUnits="userSpaceOnUse" cx={-22} cy={-28} r={135}>
          <stop offset="0" stopColor={tone === 'grey' ? '#3a3b40' : '#2e2e33'} />
          <stop offset="0.6" stopColor="#1a1a1e" />
          <stop offset="1" stopColor="#060607" />
        </radialGradient>
        <radialGradient id={`${id}-side`} gradientUnits="userSpaceOnUse" cx={0} cy={0} r={86}>
          <stop offset="0.7" stopColor="#141417" />
          <stop offset="0.92" stopColor="#1f1f24" />
          <stop offset="1" stopColor="#0b0b0d" />
        </radialGradient>
        <linearGradient id={`${id}-lip`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="#a3a3ab" />
          <stop offset="0.7" stopColor="#5d5d64" />
          <stop offset="1" stopColor="#dcdce2" />
        </linearGradient>
        <radialGradient id={`${id}-barrel`} gradientUnits="userSpaceOnUse" cx={0} cy={0} r={58}>
          <stop offset="0" stopColor="#3a3a40" />
          <stop offset="0.8" stopColor="#141418" />
          <stop offset="1" stopColor="#050506" />
        </radialGradient>
        <linearGradient id={`${id}-spoke`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#c4c4cc" />
          <stop offset="1" stopColor="#6a6a72" />
        </linearGradient>
        <radialGradient id={`${id}-heat`} gradientUnits="userSpaceOnUse" cx={0} cy={0} r={104}>
          <stop offset="0.55" stopColor="#ff5a1f" stopOpacity="0" />
          <stop offset="0.85" stopColor="#ff5a1f" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffb02e" stopOpacity="0.9" />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          <path d={path} />
        </clipPath>
        <path id={`${id}-textpath`} d="M -74 0 A 74 74 0 1 1 74 0 A 74 74 0 1 1 -74 0" />
        {blurX > 0.3 && (
          <filter id={`${id}-mb`} x="-60%" y="-10%" width="220%" height="120%">
            <feGaussianBlur stdDeviation={`${blurX} 0`} />
          </filter>
        )}
      </defs>
      <g filter={blurX > 0.3 ? `url(#${id}-mb)` : undefined}>
        <path d={path} fill={`url(#${id}-rubber)`} />
        <g clipPath={`url(#${id}-clip)`}>
          <g transform={`rotate(${rotation})`}>
            {Array.from({ length: 44 }, (_, i) => (
              <rect key={i} transform={`rotate(${(i * 360) / 44})`} x={101 - depth} y={-1.9} width={depth + 4} height={3.8} fill="#030303" />
            ))}
          </g>
          <circle r={86} cy={drop * 0.6} fill={`url(#${id}-side)`} />
          <circle r={86} cy={drop * 0.6} fill="none" stroke="#000" strokeWidth={1.4} />
          <path d="M -70 -30 A 76 76 0 0 1 -20 -73" cy={drop} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth={9} strokeLinecap="round" />
          {sidewallText && spin < 0.4 && (
            <g transform={`translate(0 ${drop * 0.6}) rotate(${rotation})`} opacity={1 - spin * 2.5}>
              <text fontFamily="Bebas Neue" fontSize={14} letterSpacing={2} fill="#55555d">
                <textPath href={`#${id}-textpath`} startOffset="12%">
                  {sidewallText}
                </textPath>
              </text>
              <text fontFamily="Bebas Neue" fontSize={14} letterSpacing={2} fill="#55555d">
                <textPath href={`#${id}-textpath`} startOffset="62%">
                  {sidewallText}
                </textPath>
              </text>
            </g>
          )}
          {heat > 0 && <circle r={104} fill={`url(#${id}-heat)`} opacity={heat} />}
        </g>
        <g transform={`translate(0 ${drop})`}>
          <circle r={63} fill={`url(#${id}-lip)`} />
          <circle r={58} fill={`url(#${id}-barrel)`} />
          <circle r={56} fill="none" stroke={accent} strokeWidth={2.2} opacity={0.95} />
          {Array.from({ length: copies }, (_, k) => (
            <g key={k} transform={`rotate(${rotation - k * 4.5})`} opacity={copies > 1 ? Math.min(1, 1.9 / copies) : 1}>
              {spokes(id)}
            </g>
          ))}
          <circle r={15} fill={`url(#${id}-lip)`} />
          <g transform={`rotate(${rotation})`}>
            {Array.from({ length: 5 }, (_, i) => {
              const a = (i / 5) * Math.PI * 2;
              return <circle key={i} cx={Math.cos(a) * 9.5} cy={Math.sin(a) * 9.5} r={1.8} fill="#2a2a30" />;
            })}
          </g>
          <circle r={5.5} fill={accent} />
          <path d="M -46 -30 A 56 56 0 0 1 -8 -55" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={3} strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
};
