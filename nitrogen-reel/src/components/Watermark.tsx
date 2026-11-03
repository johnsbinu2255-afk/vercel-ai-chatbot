import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { tween } from '../lib/anim';
import { logos } from '../lib/assets';
import { C, FONT, H, W, s } from '../lib/theme';
import { RodoLogo } from './Layout';

const END = s(30);
const BOTTOM = 400; // px from the bottom edge
const RIGHT = 110; // clear of Instagram's like/comment buttons

const Mark: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
    {logos.rodo && <RodoLogo logo={logos.rodo} width={96} white />}
    <div style={{ fontFamily: FONT.head, fontSize: 60, letterSpacing: 4, color: '#ffffff', lineHeight: 1, paddingTop: 6 }}>RODO TYRES</div>
  </div>
);

// "RODO TYRES" + logo, bottom right, white at 25%, with a light sweep every 5 seconds.
export const Watermark: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame >= END) return null;
  const fade = tween(frame, [0, 8], [0, 1]) * tween(frame, [END - 9, END], [1, 0]);
  const cycle = frame % s(5);
  const sweep = (cycle - s(1)) / s(1.4); // slow sweep, starting 1 s into each 5 s
  const width = 440;
  const band = sweep * (width + 240) - 120;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', right: RIGHT, bottom: BOTTOM, opacity: fade }}>
        <div style={{ opacity: 0.25, filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.9))' }}>
          <Mark />
        </div>
        {sweep > 0 && sweep < 1 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.85,
              WebkitMaskImage: `linear-gradient(105deg, transparent ${band - 70}px, black ${band}px, transparent ${band + 70}px)`,
              maskImage: `linear-gradient(105deg, transparent ${band - 70}px, black ${band}px, transparent ${band + 70}px)`,
            }}
          >
            <Mark />
          </div>
        )}
        <div style={{ height: 3, marginTop: 6, background: C.yellow, opacity: 0.55, boxShadow: `0 0 10px ${C.yellow}` }} />
      </div>
    </AbsoluteFill>
  );
};

export const WATERMARK_BOX = { right: W - RIGHT, bottom: H - BOTTOM };
