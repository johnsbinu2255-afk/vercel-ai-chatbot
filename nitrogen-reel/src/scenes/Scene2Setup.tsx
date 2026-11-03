import React from 'react';
import { AbsoluteFill } from 'remotion';
import { At, Divider, Pill, SplitTint } from '../components/Layout';
import { Shake, SpeedLines } from '../components/Fx';
import { Sfx } from '../components/Sfx';
import { Tyre } from '../components/Tyre';
import { drop, pop, tween } from '../lib/anim';
import { useSceneFrame } from '../lib/scene-clock';
import { C, FONT, H, W, s } from '../lib/theme';

// 0:03 - 0:06. Split screen: grey Normal Air tyre vs blue Nitrogen tyre, "2 Key Differences".
const T = {
  leftTyre: 3,
  rightTyre: 7,
  leftLabel: s(1.0),
  rightLabel: s(1.2),
  title: s(1.73),
  flip: s(2.0),
  ding: s(2.53),
  fadeOut: s(2.87),
};

export const Scene2Setup: React.FC = () => {
  const f = useSceneFrame();
  const leftIn = pop(f, T.leftTyre, 1.3);
  const rightIn = pop(f, T.rightTyre, 1.3);
  const lLabel = drop(f, T.leftLabel);
  const rLabel = drop(f, T.rightLabel);
  const titleIn = tween(f, [T.title, T.title + 7], [0, 1]);
  const flip = f < T.flip - 6 ? -100 : tween(f, [T.flip - 6, T.flip], [-100, 0]) + (f >= T.flip ? 14 * Math.exp(-(f - T.flip) / 3) * Math.sin((f - T.flip) * 1.2) : 0);
  const dingPulse = (at: number) => (f >= at ? 0.1 * Math.exp(-(f - at) / 3) : 0);
  const titleScale = 1 + dingPulse(T.ding) + dingPulse(T.ding + 6);
  const out = tween(f, [T.fadeOut, T.fadeOut + 6], [1, 0]);
  const blueGlow = 0.6 + 0.3 * Math.sin(f / 5);

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <SplitTint opacity={tween(f, [0, 6], [0, 1])} />
      <Shake
        hits={[
          { at: T.leftLabel, amp: 8 },
          { at: T.rightLabel, amp: 8 },
        ]}
      >
        <At x={270} y={930} scale={leftIn}>
          <Tyre id="setup-left" size={470} rotation={f * 1.6} tone="grey" />
        </At>
        <At x={810} y={930} scale={rightIn}>
          <Tyre id="setup-right" size={470} rotation={f * 1.6} tone="blue" glow={blueGlow} />
        </At>
        <At x={270} y={1265 + lLabel.y} opacity={lLabel.opacity}>
          <Pill text="NORMAL AIR" color={C.grey} fontSize={72} />
        </At>
        <At x={810} y={1265 + rLabel.y} opacity={rLabel.opacity}>
          <Pill text="NITROGEN" color={C.blue} fontSize={72} />
        </At>
        {titleIn > 0 && (
          <At x={W / 2} y={430} scale={titleScale} opacity={titleIn}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 34,
                padding: '18px 54px 10px',
                borderRadius: 34,
                background: 'rgba(10,10,10,0.88)',
                border: `3px solid rgba(255,196,0,0.6)`,
                boxShadow: '0 0 40px rgba(255,196,0,0.35)',
                transform: `translateX(${(1 - titleIn) * 300}px)`,
              }}
            >
              <div style={{ perspective: 700 }}>
                <div
                  style={{
                    fontFamily: FONT.head,
                    fontSize: 270,
                    lineHeight: 0.86,
                    color: C.yellow,
                    textShadow: `0 0 40px rgba(255,196,0,0.8), 0 6px 0 #000`,
                    transform: `rotateX(${flip}deg)`,
                    opacity: f >= T.flip - 6 ? 1 : 0,
                  }}
                >
                  2
                </div>
              </div>
              <div style={{ fontFamily: FONT.head, fontSize: 124, lineHeight: 0.9, color: C.white, letterSpacing: 3, textShadow: '0 5px 0 #000' }}>
                KEY
                <br />
                DIFFERENCES
              </div>
            </div>
          </At>
        )}
      </Shake>
      <Divider />
      <SpeedLines at={T.leftTyre} mode="radial-out" cx={270} cy={930} clip={[0, 0, W / 2, H]} count={22} seed="s2l" />
      <SpeedLines at={T.rightTyre} mode="radial-out" cx={810} cy={930} clip={[W / 2, 0, W, H]} count={22} seed="s2r" />

      <Sfx name="whoosh" at={T.leftTyre} volume={0.85} />
      <Sfx name="whoosh" at={T.rightTyre} volume={0.85} pitch={1.12} />
      <Sfx name="thud" at={T.leftLabel} />
      <Sfx name="thud" at={T.rightLabel} pitch={1.1} />
      <Sfx name="flip-click" at={T.flip - 2} align="start" />
      <Sfx name="ding-ding" at={T.ding} align="start" />
    </AbsoluteFill>
  );
};
