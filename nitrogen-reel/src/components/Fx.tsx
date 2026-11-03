import React from 'react';
import { AbsoluteFill, random } from 'remotion';
import { clamp, Hit, shakeAt } from '../lib/anim';
import { useSceneFrame } from '../lib/scene-clock';
import { C, H, W } from '../lib/theme';

// Shakes its children on every impact frame (scene frames).
export const Shake: React.FC<{ hits: Hit[]; children: React.ReactNode }> = ({ hits, children }) => {
  const f = useSceneFrame();
  const { x, y, r } = shakeAt(f, hits);
  return <AbsoluteFill style={{ transform: `translate(${x}px, ${y}px) rotate(${r}deg)` }}>{children}</AbsoluteFill>;
};

export type LinesMode = 'left' | 'right' | 'down' | 'radial-out' | 'radial-in' | 'swirl';

// Speed lines that go with a whoosh. `at` is the whoosh's beat (scene frames).
export const SpeedLines: React.FC<{
  at: number;
  mode: LinesMode;
  before?: number;
  after?: number;
  count?: number;
  color?: string;
  cx?: number;
  cy?: number;
  clip?: [number, number, number, number];
  seed?: string;
}> = ({ at, mode, before = 8, after = 8, count = 34, color = '#ffffff', cx = W / 2, cy = H / 2, clip, seed = 'l' }) => {
  const f = useSceneFrame();
  const start = at - before;
  const end = at + after;
  if (f < start || f > end) return null;
  const p = (f - start) / (end - start);
  const env = Math.sin(p * Math.PI);
  const lines: React.ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const r1 = random(`${seed}a${i}`);
    const r2 = random(`${seed}b${i}`);
    const r3 = random(`${seed}c${i}`);
    const col = i % 5 === 0 ? C.yellow : i % 7 === 0 ? C.blue : color;
    const width = 2 + r3 * 4;
    const op = env * (0.35 + 0.65 * r2);
    if (mode === 'left' || mode === 'right') {
      const y = clip ? clip[1] + r1 * (clip[3] - clip[1]) : r1 * H;
      const len = 220 + r2 * 520;
      const dir = mode === 'right' ? 1 : -1;
      const x0 = (clip ? clip[0] : 0) - 600 + ((r3 * 1.4 + p * 2.2) % 1.6) * ((clip ? clip[2] - clip[0] : W) + 1200);
      const x = dir > 0 ? x0 : W - x0;
      lines.push(<line key={i} x1={x} y1={y} x2={x - dir * len} y2={y} stroke={col} strokeWidth={width} strokeLinecap="round" opacity={op} />);
    } else if (mode === 'down') {
      const x = clip ? clip[0] + r1 * (clip[2] - clip[0]) : r1 * W;
      const len = 300 + r2 * 600;
      const y = -700 + ((r3 * 1.3 + p * 2.4) % 1.7) * (H + 1400);
      lines.push(<line key={i} x1={x} y1={y} x2={x} y2={y - len} stroke={col} strokeWidth={width} strokeLinecap="round" opacity={op} />);
    } else if (mode === 'swirl') {
      const a0 = r1 * Math.PI * 2 + p * (4 + r2 * 3);
      const rad = 300 + r2 * 260;
      const sweep = 0.5 + r3 * 0.7;
      const x1 = cx + Math.cos(a0) * rad;
      const y1 = cy + Math.sin(a0) * rad;
      const x2 = cx + Math.cos(a0 + sweep) * rad;
      const y2 = cy + Math.sin(a0 + sweep) * rad;
      lines.push(
        <path key={i} d={`M${x1},${y1} A${rad},${rad} 0 0 1 ${x2},${y2}`} fill="none" stroke={col} strokeWidth={width} strokeLinecap="round" opacity={op} />,
      );
    } else {
      const a = r1 * Math.PI * 2;
      const travel = mode === 'radial-out' ? p : 1 - p;
      const r0 = 120 + ((r3 + travel * 1.6) % 1) * 900;
      const len = 120 + r2 * 360;
      const x1 = cx + Math.cos(a) * r0;
      const y1 = cy + Math.sin(a) * r0;
      const x2 = cx + Math.cos(a) * (r0 + len);
      const y2 = cy + Math.sin(a) * (r0 + len);
      lines.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={col} strokeWidth={width} strokeLinecap="round" opacity={op} />);
    }
  }
  const clipId = `clip-${seed}`;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen' }}>
      <svg width={W} height={H}>
        {clip && (
          <defs>
            <clipPath id={clipId}>
              <rect x={clip[0]} y={0} width={clip[2] - clip[0]} height={H} />
            </clipPath>
          </defs>
        )}
        <g clipPath={clip ? `url(#${clipId})` : undefined}>{lines}</g>
      </svg>
    </AbsoluteFill>
  );
};

// Expanding glow ring.
export const Shockwave: React.FC<{ at: number; x: number; y: number; size?: number; color?: string; dur?: number }> = ({
  at,
  x,
  y,
  size = 900,
  color = C.yellow,
  dur = 18,
}) => {
  const f = useSceneFrame();
  const p = clamp((f - at) / dur);
  if (f < at || p >= 1) return null;
  const r = 60 + (1 - Math.pow(1 - p, 3)) * size;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <svg width={W} height={H}>
        <circle cx={x} cy={y} r={r} fill="none" stroke={color} strokeWidth={26 * (1 - p) + 2} opacity={1 - p} style={{ filter: `drop-shadow(0 0 24px ${color})` }} />
        <circle cx={x} cy={y} r={r * 0.82} fill="none" stroke="#ffffff" strokeWidth={8 * (1 - p)} opacity={0.6 * (1 - p)} />
      </svg>
    </AbsoluteFill>
  );
};

// Full-screen flash.
export const Flash: React.FC<{ opacity: number; color?: string }> = ({ opacity, color = '#ffffff' }) =>
  opacity > 0 ? <AbsoluteFill style={{ backgroundColor: color, opacity: clamp(opacity) }} /> : null;
