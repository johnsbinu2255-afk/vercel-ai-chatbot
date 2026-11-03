import React from 'react';
import { AbsoluteFill, random } from 'remotion';
import { At, Divider } from '../components/Layout';
import { Shake, SpeedLines } from '../components/Fx';
import { Sfx } from '../components/Sfx';
import { Tyre } from '../components/Tyre';
import { clamp, ease, pop, slam, tween } from '../lib/anim';
import { useSceneFrame } from '../lib/scene-clock';
import { C, FONT, H, W, s } from '../lib/theme';

// 0:00 - 0:03. Tyre rolls in from the right, skids to a stop and spins in place
// inside a swirl of nitrogen. "NORMAL AIR or NITROGEN?" slams in.
export const HOOK = {
  screech: s(1.0),
  textLand: s(2.0),
  smallText: s(2.55),
  sliceBeat: s(2.93),
  splitStart: s(2.95),
  splitEnd: s(3.3),
};

const SIZE = 560;
const RADIUS = SIZE * 0.4; // tyre radius in px (100 of 250 svg units)
const CY = 1110;
const V0 = 1000; // px/s on entry
const T_BRAKE = 0.2; // starts braking...
const T_LOCK = 0.85; // ...the wheel locks and skids...
const T_STOP = 1.45; // ...to a stop at the centre
const X1 = W / 2;
const X0 = X1 + V0 * (T_BRAKE + (T_STOP - T_BRAKE) / 3); // already nosing in on frame 0

const tyreX = (t: number) => {
  if (t <= T_BRAKE) return X0 - V0 * t;
  if (t < T_STOP) {
    const u = (t - T_BRAKE) / (T_STOP - T_BRAKE);
    return X0 - V0 * T_BRAKE - (V0 * (T_STOP - T_BRAKE) * (1 - Math.pow(1 - u, 3))) / 3;
  }
  const u = t - T_STOP;
  return X1 - 10 * Math.exp(-9 * u) * Math.sin(u * 16);
};
const tyreSpeed = (t: number) => (t <= T_BRAKE ? V0 : t < T_STOP ? V0 * Math.pow(1 - (t - T_BRAKE) / (T_STOP - T_BRAKE), 2) : 0);

// Rotation in degrees: rolling (counter-clockwise), locked while skidding, then spinning in place.
const tyreAngle = (t: number) => {
  const rolled = X0 - tyreX(Math.min(t, T_LOCK));
  let a = -((rolled / RADIUS) * 180) / Math.PI;
  // Spin-up after the stop: speed ramps from 0 to 1100 deg/s over 0.5 s.
  const u = t - (T_STOP + 0.05);
  if (u > 0) a -= u < 0.5 ? 1100 * u * u : 1100 * 0.25 + 1100 * (u - 0.5);
  return a;
};
const spinRate = (t: number) => {
  if (t <= T_LOCK) return (tyreSpeed(t) / RADIUS) * (180 / Math.PI);
  if (t < T_STOP + 0.05) return 0;
  return 1100 * Math.min(1, (t - T_STOP - 0.05) / 0.5);
};

const Storm: React.FC<{ t: number }> = ({ t }) => {
  const k = clamp((t - 1.0) / 0.45);
  if (k <= 0) return null;
  const arcs: React.ReactNode[] = [];
  for (let i = 0; i < 70; i++) {
    const r0 = 270 + random(`sr${i}`) * 170;
    const speed = 2.4 + random(`sv${i}`) * 2.8;
    const a = random(`sa${i}`) * Math.PI * 2 - speed * (t - 1.0);
    const rr = r0 + Math.sin(t * 3 + i) * 18;
    const tail = 0.18 + speed * 0.05;
    const x1 = W / 2 + Math.cos(a) * rr;
    const y1 = CY + Math.sin(a) * rr;
    const x2 = W / 2 + Math.cos(a + tail) * rr;
    const y2 = CY + Math.sin(a + tail) * rr;
    arcs.push(
      <g key={i} opacity={k * (0.45 + 0.55 * random(`so${i}`))}>
        <path d={`M${x2},${y2} A${rr},${rr} 0 0 0 ${x1},${y1}`} fill="none" stroke={C.blue} strokeWidth={3 + random(`sw${i}`) * 3} strokeLinecap="round" opacity={0.55} />
        <circle cx={x1} cy={y1} r={4 + random(`sc${i}`) * 4} fill="#bfeeff" />
      </g>,
    );
  }
  return (
    <AbsoluteFill style={{ filter: `drop-shadow(0 0 10px ${C.blue})` }}>
      <svg width={W} height={H}>{arcs}</svg>
    </AbsoluteFill>
  );
};

const Content: React.FC = () => {
  const f = useSceneFrame();
  const t = f / 30;
  const v = tyreSpeed(t);
  const rate = spinRate(t);
  const head = slam(f, HOOK.textLand, 2.7, 4);
  const punch =
    f < HOOK.textLand ? 1 : f < HOOK.textLand + 4 ? tween(f, [HOOK.textLand, HOOK.textLand + 4], [1, 1.15]) : 1.05 + 0.1 * Math.exp(-(f - HOOK.textLand - 4) / 5);
  const small = pop(f, HOOK.smallText);
  return (
    <AbsoluteFill style={{ transform: `scale(${punch})` }}>
      <Shake
        hits={[
          { at: s(T_STOP), amp: 6 },
          { at: HOOK.textLand, amp: 22, dur: 12 },
        ]}
      >
        <Storm t={t} />
        {v > 60 && (
          <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0 }}>
            {Array.from({ length: 12 }, (_, i) => {
              const yy = CY - RADIUS * 0.9 + (i / 11) * RADIUS * 1.8;
              const x = tyreX(t) + RADIUS * 0.6;
              const len = (180 + ((i * 97) % 220)) * (v / V0);
              return <line key={i} x1={x} y1={yy} x2={x + len} y2={yy} stroke={i % 3 ? '#ffffff' : C.yellow} strokeWidth={4} strokeLinecap="round" opacity={0.5 * (v / V0)} />;
            })}
          </svg>
        )}
        <At x={tyreX(t)} y={CY}>
          <Tyre id="hook" size={SIZE} rotation={tyreAngle(t)} tone="blue" glow={0.35 + 0.5 * clamp((t - 1.0) / 0.5)} spin={clamp(rate / 1300)} blurX={(v / 30) * 0.32 / (SIZE / 250)} />
        </At>
        {/* skid smoke streak */}
        {t > T_LOCK && t < T_STOP + 0.4 && (
          <div
            style={{
              position: 'absolute',
              left: tyreX(t) - 40,
              top: CY + RADIUS - 24,
              width: Math.max(0, tyreX(T_LOCK) - tyreX(t)) + 260,
              height: 40,
              background: 'linear-gradient(90deg, rgba(220,230,240,0.55), rgba(220,230,240,0))',
              filter: 'blur(14px)',
              opacity: 1 - clamp((t - T_STOP) / 0.4),
            }}
          />
        )}
        {head.opacity > 0 && (
          <At x={W / 2} y={505} scale={head.scale} opacity={head.opacity}>
            <div style={{ textAlign: 'center', fontFamily: FONT.head, lineHeight: 0.92, whiteSpace: 'nowrap', textShadow: '0 6px 0 #000, 0 0 30px rgba(0,0,0,0.9)' }}>
              <div style={{ fontSize: 168, color: C.white, letterSpacing: 4 }}>NORMAL AIR</div>
              <div style={{ fontSize: 100, color: C.yellow, letterSpacing: 6 }}>or</div>
              <div style={{ fontSize: 196, color: C.blue, letterSpacing: 4, textShadow: `0 6px 0 #000, 0 0 40px ${C.blue}` }}>NITROGEN?</div>
            </div>
          </At>
        )}
        {small > 0 && (
          <At x={W / 2} y={792} scale={small}>
            <div style={{ fontFamily: FONT.body, fontWeight: 600, fontSize: 50, color: C.white, whiteSpace: 'nowrap', textShadow: '0 3px 12px #000' }}>
              Know the difference!
            </div>
          </At>
        )}
      </Shake>
    </AbsoluteFill>
  );
};

export const Scene1Hook: React.FC = () => {
  const f = useSceneFrame();
  const line = tween(f, [HOOK.sliceBeat - 5, HOOK.sliceBeat], [0, 1], ease.in);
  const split = tween(f, [HOOK.splitStart, HOOK.splitEnd], [0, 1], ease.in);
  return (
    <AbsoluteFill>
      {split <= 0 ? (
        <Content />
      ) : (
        <>
          <AbsoluteFill style={{ clipPath: 'inset(0 50% 0 0)', transform: `translateX(${-split * 640}px)` }}>
            <Content />
          </AbsoluteFill>
          <AbsoluteFill style={{ clipPath: 'inset(0 0 0 50%)', transform: `translateX(${split * 640}px)` }}>
            <Content />
          </AbsoluteFill>
        </>
      )}
      {line > 0 && <Divider progress={line} from="top" />}
      <SpeedLines at={HOOK.screech + 6} mode="swirl" before={6} after={22} cx={W / 2} cy={CY} count={26} seed="swirl" />
      <SpeedLines at={HOOK.sliceBeat} mode="down" before={6} after={8} clip={[W / 2 - 160, 0, W / 2 + 160, H]} count={18} seed="slice" />

      <Sfx name="rumble" at={0} align="start" volume={0.9} />
      <Sfx name="screech" at={HOOK.screech} align="start" />
      <Sfx name="swirl" at={HOOK.screech} align="start" />
      <Sfx name="bass-impact" at={HOOK.textLand} />
      <Sfx name="pop" at={HOOK.smallText} />
      <Sfx name="slice" at={HOOK.sliceBeat} />
    </AbsoluteFill>
  );
};
