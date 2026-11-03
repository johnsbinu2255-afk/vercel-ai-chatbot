import React from 'react';
import { AbsoluteFill } from 'remotion';
import { At } from '../components/Layout';
import { Flash, SpeedLines } from '../components/Fx';
import { Sfx } from '../components/Sfx';
import { tween } from '../lib/anim';
import { useSceneFrame } from '../lib/scene-clock';
import { C, FONT, W } from '../lib/theme';

// A big yellow number flies through the screen (deep whoosh).
// Mounted 8 frames before the cut; it passes the camera on frame 8.
export const NumberZoom: React.FC<{ digit: string }> = ({ digit }) => {
  const f = useSceneFrame();
  const through = 8;
  const scale = Math.exp(Math.log(0.35) + (Math.log(18) - Math.log(0.35)) * Math.min(1.2, f / through));
  const opacity = tween(f, [through - 1, through + 3], [1, 0]);
  const flash = f < through - 2 ? 0 : tween(f, [through - 2, through], [0, 0.9]) * tween(f, [through, through + 5], [1, 0]);
  return (
    <AbsoluteFill>
      {opacity > 0 && (
        <At x={W / 2} y={960} scale={scale} opacity={opacity}>
          <div style={{ fontFamily: FONT.head, fontSize: 600, lineHeight: 0.8, color: C.yellow, textShadow: '0 0 60px rgba(255,196,0,0.9)' }}>{digit}</div>
        </At>
      )}
      <Flash opacity={flash} color={C.yellow} />
      <SpeedLines at={through} mode="radial-out" before={8} after={6} count={44} seed={`zoom${digit}`} />
      <Sfx name="deep-whoosh" at={through} />
    </AbsoluteFill>
  );
};

// White flash frame with a camera flash sound. Peaks on frame 3.
export const WhiteFlash: React.FC = () => {
  const f = useSceneFrame();
  const o = f < 3 ? tween(f, [0, 3], [0, 1]) : tween(f, [4, 13], [1, 0]);
  return (
    <AbsoluteFill>
      <Flash opacity={o} />
      <Sfx name="camera-flash" at={2} align="start" />
    </AbsoluteFill>
  );
};
