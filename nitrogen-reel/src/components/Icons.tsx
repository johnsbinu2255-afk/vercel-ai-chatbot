import React from 'react';
import { C, FONT } from '../lib/theme';

type IconProps = { size: number; style?: React.CSSProperties };

export const WarningIcon: React.FC<IconProps> = ({ size, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: 'visible', filter: `drop-shadow(0 0 14px ${C.red})`, ...style }}>
    <path d="M50 6 L96 88 Q98 94 92 94 L8 94 Q2 94 4 88 Z" fill={C.red} stroke="#ffffff" strokeWidth={5} strokeLinejoin="round" />
    <rect x={44} y={34} width={12} height={34} rx={5} fill="#fff" />
    <circle cx={50} cy={80} r={6.5} fill="#fff" />
  </svg>
);

export const TickBadge: React.FC<IconProps> = ({ size, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: 'visible', filter: `drop-shadow(0 0 14px ${C.green})`, ...style }}>
    <circle cx={50} cy={50} r={46} fill={C.green} stroke="#ffffff" strokeWidth={4} />
    <path d="M28 52 L44 68 L74 34" fill="none" stroke="#ffffff" strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const CrossBadge: React.FC<IconProps> = ({ size, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: 'visible', filter: `drop-shadow(0 0 14px ${C.red})`, ...style }}>
    <circle cx={50} cy={50} r={46} fill={C.red} stroke="#ffffff" strokeWidth={4} />
    <path d="M33 33 L67 67 M67 33 L33 67" fill="none" stroke="#ffffff" strokeWidth={11} strokeLinecap="round" />
  </svg>
);

// Hand pump with hose.
export const PumpIcon: React.FC<IconProps & { press?: number }> = ({ size, press = 0, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: 'visible', ...style }}>
    <g transform={`translate(0 ${press * 10})`}>
      <rect x={30} y={8} width={40} height={8} rx={4} fill="#e8e8ec" />
      <rect x={47} y={14} width={6} height={20} fill="#c8c8d0" />
    </g>
    <rect x={38} y={30} width={24} height={56} rx={6} fill={C.grey} stroke="#ffffff" strokeWidth={3} />
    <rect x={30} y={84} width={40} height={8} rx={3} fill="#e8e8ec" />
    <path d="M62 74 Q86 76 84 56 Q82 40 92 34" fill="none" stroke="#e8e8ec" strokeWidth={5} strokeLinecap="round" />
  </svg>
);

// Calendar page showing `label`; `flip` 0..1 turns the top page over.
export const CalendarIcon: React.FC<IconProps & { label: string; next?: string; flip?: number }> = ({ size, label, next, flip = 0, style }) => {
  const page = (text: string) => (
    <>
      <rect x={6} y={18} width={88} height={76} rx={10} fill="#f4f6fa" />
      <rect x={6} y={18} width={88} height={22} rx={10} fill={C.blue} />
      <rect x={6} y={30} width={88} height={10} fill={C.blue} />
      <text x={50} y={78} textAnchor="middle" fontFamily={FONT.head} fontSize={30} fill="#111827">
        {text}
      </text>
    </>
  );
  return (
    <div style={{ width: size, height: size, position: 'relative', perspective: 400, ...style }}>
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute', overflow: 'visible', filter: `drop-shadow(0 0 12px ${C.blue})` }}>
        {page(next ?? label)}
        <rect x={24} y={8} width={8} height={20} rx={4} fill="#d1d5db" />
        <rect x={68} y={8} width={8} height={20} rx={4} fill="#d1d5db" />
      </svg>
      {flip < 1 && (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          style={{ position: 'absolute', overflow: 'visible', transformOrigin: '50% 18%', transform: `rotateX(${flip * 180}deg)`, backfaceVisibility: 'hidden' }}
        >
          {page(label)}
        </svg>
      )}
    </div>
  );
};

export const FastForwardIcon: React.FC<IconProps & { color?: string }> = ({ size, color = '#ffffff', style }) => (
  <svg width={size} height={size} viewBox="0 0 100 60" style={{ overflow: 'visible', ...style }}>
    <path d="M6 6 L46 30 L6 54 Z M50 6 L90 30 L50 54 Z" fill={color} />
  </svg>
);

export const PinIcon: React.FC<IconProps> = ({ size, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: 'visible', ...style }}>
    <path d="M50 96 C30 66 18 52 18 36 A32 32 0 0 1 82 36 C82 52 70 66 50 96 Z" fill={C.red} stroke="#fff" strokeWidth={4} />
    <circle cx={50} cy={36} r={12} fill="#fff" />
  </svg>
);

export const PhoneIcon: React.FC<IconProps> = ({ size, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: 'visible', ...style }}>
    <path
      d="M30 8 L44 30 Q46 35 42 39 L36 45 Q44 60 55 64 L61 58 Q65 54 70 56 L92 70 Q96 74 93 79 L86 90 Q81 96 72 94 Q40 86 14 52 Q4 34 8 22 L14 12 Q20 4 30 8 Z"
      fill={C.yellow}
    />
  </svg>
);
