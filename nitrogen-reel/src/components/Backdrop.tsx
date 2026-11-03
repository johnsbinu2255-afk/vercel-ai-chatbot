import React from 'react';
import { AbsoluteFill, random, useCurrentFrame } from 'remotion';
import { C, H, W } from '../lib/theme';

// Carbon-fibre weave (one 20 px tile), kept very dark.
const CARBON = [
  'linear-gradient(27deg, #0d0d0d 5px, transparent 5px) 0 5px',
  'linear-gradient(207deg, #0d0d0d 5px, transparent 5px) 10px 0px',
  'linear-gradient(27deg, #181818 5px, transparent 5px) 0px 10px',
  'linear-gradient(207deg, #181818 5px, transparent 5px) 10px 5px',
  'linear-gradient(90deg, #131313 10px, transparent 10px)',
  'linear-gradient(#151515 25%, #111111 25%, #111111 50%, transparent 50%, transparent 75%, #1b1b1b 75%, #1b1b1b)',
].join(',');

export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = (frame * 0.35) % 20;
  const gx = 540 + Math.sin(frame / 95) * 280;
  const gy = 900 + Math.cos(frame / 130) * 420;
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: -20,
          top: -20,
          width: W + 40,
          height: H + 40,
          background: CARBON,
          backgroundColor: '#0c0c0c',
          backgroundSize: '20px 20px',
          transform: `translate(${drift}px, ${drift * 0.6}px)`,
          opacity: 0.6,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${gx}px ${gy}px, rgba(255,196,0,0.17) 0px, rgba(255,196,0,0.06) 300px, rgba(255,196,0,0) 620px)`,
        }}
      />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.72) 100%)' }} />
    </AbsoluteFill>
  );
};

// Small blue particles floating slowly upwards all through the video.
export const Particles: React.FC<{ count?: number }> = ({ count = 46 }) => {
  const frame = useCurrentFrame();
  const span = H + 60;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <svg width={W} height={H}>
        <defs>
          <radialGradient id="particle">
            <stop offset="0" stopColor="#bfeeff" stopOpacity="1" />
            <stop offset="0.35" stopColor={C.blue} stopOpacity="0.85" />
            <stop offset="1" stopColor={C.blue} stopOpacity="0" />
          </radialGradient>
        </defs>
        {Array.from({ length: count }, (_, i) => {
          const r = 2 + random(`r${i}`) * 4;
          const speed = 0.35 + random(`s${i}`) * 0.8;
          const y = ((((random(`y${i}`) * span - frame * speed) % span) + span) % span) - 30;
          const x = random(`x${i}`) * W + Math.sin(frame / (38 + random(`w${i}`) * 40) + i) * 26;
          const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(frame / 9 + i * 1.7));
          return <circle key={i} cx={x} cy={y} r={r * 3} fill="url(#particle)" opacity={0.55 * twinkle} />;
        })}
      </svg>
    </AbsoluteFill>
  );
};
