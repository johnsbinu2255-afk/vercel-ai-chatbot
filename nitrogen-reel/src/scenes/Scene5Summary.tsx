import React from 'react';
import { AbsoluteFill } from 'remotion';
import { At } from '../components/Layout';
import { SpeedLines } from '../components/Fx';
import { CrossBadge, TickBadge } from '../components/Icons';
import { Sfx } from '../components/Sfx';
import { ease, pop, tween } from '../lib/anim';
import { useSceneFrame } from '../lib/scene-clock';
import { C, FONT, W } from '../lib/theme';

// 0:23 - 0:26. Comparison table, row by row. Each red X shakes in, each green tick pops in.
const ROWS = [
  { label: 'Pressure', air: 'Drops faster', n2: 'Stays stable' },
  { label: 'Refills', air: 'More often', n2: 'Less often' },
  { label: 'Heat', air: 'More', n2: 'Less' },
  { label: 'Tyre life', air: 'Shorter', n2: 'Longer' },
];
const T = {
  slide: 5,
  cross: [30, 44, 57, 71], // 0:24.0, 24.47, 24.9, 25.37
  tick: [36, 50, 63, 77],
  shrink: 84,
  point: 90, // 0:26
};

const X = { label: 40, air: 330, n2: 685, end: 1040 };
const TOP = 470;
const HEAD = 110;
const ROW = 170;

const Cell: React.FC<{ x: number; w: number; text: string; icon: 'x' | 'tick'; at: number }> = ({ x, w, text, icon, at }) => {
  const f = useSceneFrame();
  const u = f - at;
  const k = icon === 'tick' ? pop(f, at, 1.4) : f < at ? 0 : 1;
  const shake = icon === 'x' && u >= 0 ? 16 * Math.exp(-u / 3) * Math.sin(u * 2.6) : 0;
  return (
    <div style={{ position: 'absolute', left: x + 22, width: w - 30, top: 0, bottom: 0, display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 62, height: 62, transform: `translateX(${shake}px) scale(${icon === 'x' ? (u >= 0 ? 1 + 0.4 * Math.exp(-u / 2) : 0) : k})` }}>
        {icon === 'x' ? <CrossBadge size={62} /> : <TickBadge size={62} />}
      </div>
      <div style={{ fontFamily: FONT.body, fontWeight: 600, fontSize: 38, color: C.white, whiteSpace: 'nowrap', opacity: u >= 0 ? 1 : 0.85 }}>{text}</div>
    </div>
  );
};

export const Scene5Summary: React.FC = () => {
  const f = useSceneFrame();
  const slide = tween(f, [T.slide - 4, T.slide + 4], [W, 0], ease.out);
  const shrink = tween(f, [T.shrink, T.point], [1, 0], ease.in);
  const point = tween(f, [T.shrink, T.point], [0, 1], ease.in);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${shrink})`, opacity: shrink > 0.02 ? 1 : 0 }}>
        <AbsoluteFill style={{ transform: `translateX(${slide}px)` }}>
          <At x={W / 2} y={370}>
            <div style={{ fontFamily: FONT.head, fontSize: 124, letterSpacing: 6, color: C.yellow, textShadow: '0 0 30px rgba(255,196,0,0.7), 0 6px 0 #000', whiteSpace: 'nowrap' }}>QUICK SUMMARY</div>
          </At>
          <div
            style={{
              position: 'absolute',
              left: X.label,
              top: TOP,
              width: X.end - X.label,
              height: HEAD + ROW * ROWS.length,
              borderRadius: 30,
              background: 'rgba(12,12,14,0.88)',
              border: '2px solid rgba(255,255,255,0.14)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', left: X.air - X.label, top: 0, width: X.n2 - X.air, height: HEAD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.head, fontSize: 66, letterSpacing: 3, color: C.grey }}>
              NORMAL AIR
            </div>
            <div
              style={{
                position: 'absolute',
                left: X.n2 - X.label,
                top: 0,
                width: X.end - X.n2,
                height: HEAD,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: FONT.head,
                fontSize: 66,
                letterSpacing: 3,
                color: C.blue,
                textShadow: `0 0 20px ${C.blue}`,
              }}
            >
              NITROGEN
            </div>
            {ROWS.map((r, i) => {
              const at = T.cross[i] - 10;
              const p = tween(f, [at, at + 7], [0, 1], ease.out);
              return (
                <div
                  key={r.label}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: HEAD + i * ROW,
                    height: ROW,
                    background: i % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.07)',
                    borderTop: '2px solid rgba(255,255,255,0.08)',
                    transform: `translateX(${(1 - p) * 700}px)`,
                    opacity: p,
                  }}
                >
                  <div style={{ position: 'absolute', left: 30, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontFamily: FONT.body, fontWeight: 800, fontSize: 42, color: C.white }}>{r.label}</div>
                  <Cell x={X.air - X.label} w={X.n2 - X.air} text={r.air} icon="x" at={T.cross[i]} />
                  <Cell x={X.n2 - X.label} w={X.end - X.n2} text={r.n2} icon="tick" at={T.tick[i]} />
                </div>
              );
            })}
            <div style={{ position: 'absolute', left: X.n2 - X.label - 3, top: 14, width: 6, bottom: 14, background: C.yellow, boxShadow: `0 0 16px ${C.yellow}, 0 0 40px rgba(255,196,0,0.7)` }} />
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
      {point > 0 && (
        <At x={W / 2} y={960}>
          <div style={{ width: 40 + 160 * point, height: 40 + 160 * point, borderRadius: '50%', background: 'radial-gradient(circle, #ffffff 0%, rgba(255,220,120,0.9) 25%, rgba(255,196,0,0) 70%)' }} />
        </At>
      )}
      <SpeedLines at={T.slide} mode="left" before={6} after={8} count={20} seed="table" />
      <SpeedLines at={T.point} mode="radial-in" before={8} after={2} count={36} seed="collapse" />

      <Sfx name="whoosh" at={T.slide} />
      {ROWS.map((r, i) => (
        <React.Fragment key={r.label}>
          <Sfx name="buzz" at={T.cross[i]} align="start" />
          <Sfx name="ding" at={T.tick[i]} align="start" pitch={1 + i * 0.06} />
        </React.Fragment>
      ))}
      <Sfx name="reverse-whoosh" at={T.point} />
    </AbsoluteFill>
  );
};
