import React from 'react';
import { AbsoluteFill } from 'remotion';
import { slam, tween } from '../lib/anim';
import { useSceneFrame } from '../lib/scene-clock';
import { C, FONT, W } from '../lib/theme';
import { At } from './Layout';
import { Shake, SpeedLines } from './Fx';
import { Sfx } from './Sfx';

// Big yellow number with a heading. Lands on `at` (bass hit + whoosh), leaves at `exit`.
export const TitleCard: React.FC<{ digit: string; lines: string[]; at: number; exit: number }> = ({ digit, lines, at, exit }) => {
  const f = useSceneFrame();
  const num = f < at ? tween(f, [0, at], [2.4, 1.08]) : 1 + 0.08 * Math.exp(-(f - at) / 4) * Math.cos((f - at) * 0.9);
  const text = slam(f, at + 2, 2.2, 4);
  const gone = tween(f, [exit, exit + 6], [1, 0]);
  const away = tween(f, [exit, exit + 6], [1, 0.7]);
  if (gone <= 0) return null;
  return (
    <AbsoluteFill style={{ opacity: gone, transform: `scale(${away})` }}>
      <Shake hits={[{ at: at + 2, amp: 18, dur: 10 }]}>
        <At x={W / 2} y={720} scale={num}>
          <div style={{ fontFamily: FONT.head, fontSize: 600, lineHeight: 0.8, color: C.yellow, textShadow: '0 0 70px rgba(255,196,0,0.85), 0 10px 0 #000' }}>{digit}</div>
        </At>
        {text.opacity > 0 && (
          <At x={W / 2} y={1150} scale={text.scale} opacity={text.opacity}>
            <div style={{ fontFamily: FONT.head, fontSize: 132, lineHeight: 0.95, color: C.white, letterSpacing: 3, textAlign: 'center', whiteSpace: 'nowrap', textShadow: '0 6px 0 #000, 0 0 30px rgba(0,0,0,0.8)' }}>
              {lines.map((l) => (
                <div key={l}>{l}</div>
              ))}
            </div>
          </At>
        )}
      </Shake>
      <SpeedLines at={at} mode="radial-out" before={4} after={10} cx={W / 2} cy={720} count={30} seed={`title${digit}`} />
      <Sfx name="whoosh" at={at} />
      <Sfx name="bass-hit" at={at + 2} />
    </AbsoluteFill>
  );
};
