import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import type { LogoInfo } from '../lib/assets';
import { C, FONT, H, W } from '../lib/theme';

// Centres its children on (x, y).
export const At: React.FC<{
  x: number;
  y: number;
  scale?: number;
  rotate?: number;
  opacity?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ x, y, scale = 1, rotate = 0, opacity = 1, style, children }) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotate}deg)`,
      opacity,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Pill: React.FC<{ text: string; color: string; fontSize?: number }> = ({ text, color, fontSize = 64 }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: `${fontSize * 0.14}px ${fontSize * 0.42}px ${fontSize * 0.06}px`,
      borderRadius: 999,
      border: `4px solid ${color}`,
      background: `${color}33`,
      boxShadow: `0 0 28px ${color}88`,
      fontFamily: FONT.head,
      fontSize,
      letterSpacing: 3,
      color: '#ffffff',
      whiteSpace: 'nowrap',
      lineHeight: 1,
    }}
  >
    {text}
  </div>
);

// The glowing yellow line between the two halves.
export const Divider: React.FC<{ progress?: number; from?: 'center' | 'top'; x?: number; opacity?: number }> = ({
  progress = 1,
  from = 'center',
  x = W / 2,
  opacity = 1,
}) => {
  const h = H * Math.max(0, Math.min(1, progress));
  return (
    <div
      style={{
        position: 'absolute',
        left: x - 3,
        top: from === 'top' ? 0 : H / 2 - h / 2,
        width: 6,
        height: h,
        background: C.yellow,
        boxShadow: `0 0 16px ${C.yellow}, 0 0 44px rgba(255,196,0,0.75)`,
        opacity,
      }}
    />
  );
};

// Grey tint on the Normal Air half, blue on the Nitrogen half.
export const SplitTint: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => (
  <AbsoluteFill style={{ opacity }}>
    <div style={{ position: 'absolute', left: 0, top: 0, width: W / 2, height: H, background: 'linear-gradient(180deg, rgba(156,163,175,0.13), rgba(156,163,175,0.03))' }} />
    <div style={{ position: 'absolute', left: W / 2, top: 0, width: W / 2, height: H, background: 'linear-gradient(180deg, rgba(0,180,255,0.15), rgba(0,180,255,0.03))' }} />
  </AbsoluteFill>
);

// Light sweep across a box (progress 0..1).
export const Shine: React.FC<{ progress: number; radius?: number }> = ({ progress, radius = 0 }) =>
  progress > 0 && progress < 1 ? (
    <div style={{ position: 'absolute', inset: 0, borderRadius: radius, overflow: 'hidden', pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: -20,
          bottom: -20,
          width: '45%',
          left: `${-50 + progress * 160}%`,
          background: 'linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.7) 50%, rgba(255,255,255,0) 100%)',
          transform: 'skewX(-18deg)',
        }}
      />
    </div>
  ) : null;

// A brand's logo file if you supplied one, otherwise its name as bold text.
export const BrandTile: React.FC<{ name: string; logo: LogoInfo | null; w: number; h: number; shine?: number }> = ({ name, logo, w, h, shine = 0 }) => {
  const base: React.CSSProperties = {
    width: w,
    height: h,
    borderRadius: 24,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  };
  if (logo) {
    return (
      <div style={{ ...base, background: '#ffffff', border: `4px solid ${C.yellow}`, boxShadow: '0 0 30px rgba(255,196,0,0.45)', padding: 20, boxSizing: 'border-box' }}>
        <Img src={staticFile(logo.file)} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        <Shine progress={shine} radius={24} />
      </div>
    );
  }
  const fontSize = Math.min(80, (w - 48) / (name.length * 0.42));
  return (
    <div
      style={{
        ...base,
        background: 'linear-gradient(180deg, #2a2a30 0%, #141417 55%, #0b0b0d 100%)',
        border: `4px solid ${C.yellow}`,
        boxShadow: '0 0 30px rgba(255,196,0,0.4), inset 0 2px 0 rgba(255,255,255,0.15)',
      }}
    >
      <span style={{ fontFamily: FONT.head, fontSize, letterSpacing: 3, color: '#ffffff', lineHeight: 1, paddingTop: fontSize * 0.08, textShadow: '0 3px 0 #000' }}>
        {name}
      </span>
      <Shine progress={shine} radius={24} />
    </div>
  );
};

// Golden ribbon banner. progress 0..1 unrolls it from the centre.
export const Ribbon: React.FC<{ text: string; width: number; progress: number }> = ({ text, width, progress }) => {
  const p = Math.max(0, Math.min(1, progress));
  const h = 116;
  const tails = Math.max(0, (p - 0.8) / 0.2);
  return (
    <svg width={width + 120} height={h + 30} viewBox={`-60 -15 ${width + 120} ${h + 30}`} style={{ overflow: 'visible', filter: 'drop-shadow(0 0 22px rgba(255,196,0,0.55))' }}>
      <defs>
        <linearGradient id="ribbon-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1a8" />
          <stop offset="0.45" stopColor={C.yellow} />
          <stop offset="1" stopColor="#b8860b" />
        </linearGradient>
        <clipPath id="ribbon-clip">
          <rect x={width / 2 - (width / 2) * p} y={-20} width={width * p} height={h + 40} />
        </clipPath>
      </defs>
      <g opacity={tails}>
        <path d={`M -50 14 L 30 14 L 30 ${h + 6} L -50 ${h + 6} L -26 ${(h + 20) / 2} Z`} fill="#a87700" />
        <path d={`M ${width + 50} 14 L ${width - 30} 14 L ${width - 30} ${h + 6} L ${width + 50} ${h + 6} L ${width + 26} ${(h + 20) / 2} Z`} fill="#a87700" />
      </g>
      <g clipPath="url(#ribbon-clip)">
        <rect x={0} y={0} width={width} height={h} fill="url(#ribbon-gold)" />
        <rect x={0} y={8} width={width} height={3} fill="rgba(255,255,255,0.6)" />
        <rect x={0} y={h - 11} width={width} height={3} fill="rgba(90,60,0,0.5)" />
        <text x={width / 2} y={h / 2 + 24} textAnchor="middle" fontFamily={FONT.head} fontSize={70} letterSpacing={4} fill="#1a1200">
          {text}
        </text>
      </g>
    </svg>
  );
};

// Gold "AUTHORIZED" seal with a tick.
export const Seal: React.FC<{ size: number }> = ({ size }) => {
  const pts: string[] = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const r = i % 2 ? 88 : 98;
    pts.push(`${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`);
  }
  return (
    <svg width={size} height={size} viewBox="-100 -100 200 200" style={{ overflow: 'visible', filter: 'drop-shadow(0 0 20px rgba(255,196,0,0.8))' }}>
      <defs>
        <linearGradient id="seal-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset="0.5" stopColor={C.yellow} />
          <stop offset="1" stopColor="#a87400" />
        </linearGradient>
        <path id="seal-arc" d="M -54 6 A 54 54 0 0 1 54 6" />
      </defs>
      <polygon points={pts.join(' ')} fill="url(#seal-gold)" />
      <circle r={78} fill="#1a1200" />
      <circle r={74} fill="none" stroke={C.yellow} strokeWidth={3} />
      <text fontFamily={FONT.head} fontSize={25} letterSpacing={2} fill={C.yellow}>
        <textPath href="#seal-arc" startOffset="50%" textAnchor="middle">
          AUTHORIZED
        </textPath>
      </text>
      <path d="M -24 22 L -5 40 L 28 6" fill="none" stroke={C.yellow} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// Rodo logo: the original on its own background, or a white cut-out.
export const RodoLogo: React.FC<{ logo: LogoInfo | null; width: number; white?: boolean }> = ({ logo, width, white }) => {
  if (!logo) {
    return (
      <div style={{ fontFamily: FONT.head, fontSize: width * 0.3, color: white ? '#ffffff' : C.yellow, letterSpacing: 6, lineHeight: 1 }}>RODO TYRES</div>
    );
  }
  const ratio = logo.height && logo.width ? logo.height / logo.width : 2 / 3;
  if (white) {
    return <Img src={staticFile(logo.cutout ?? logo.file)} style={{ width, height: width * ratio, filter: 'brightness(0) invert(1)' }} />;
  }
  return (
    <Img
      src={staticFile(logo.file)}
      style={{
        width,
        height: width * ratio,
        borderRadius: logo.opaque ? width * 0.05 : 0,
        boxShadow: logo.opaque ? '0 0 0 4px rgba(255,255,255,0.85), 0 0 70px rgba(255,196,0,0.75)' : undefined,
      }}
    />
  );
};
