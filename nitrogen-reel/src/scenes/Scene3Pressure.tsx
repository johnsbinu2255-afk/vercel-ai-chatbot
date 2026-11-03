import React from 'react';
import { AbsoluteFill } from 'remotion';
import { At, Divider, Pill, SplitTint } from '../components/Layout';
import { Shake, SpeedLines } from '../components/Fx';
import { CalendarIcon, PumpIcon, TickBadge, WarningIcon } from '../components/Icons';
import { Gauge } from '../components/Instruments';
import { Sfx } from '../components/Sfx';
import { TitleCard } from '../components/TitleCard';
import { Tyre } from '../components/Tyre';
import { WallZoom } from '../components/WallZoom';
import { ease, pop, slam, tween } from '../lib/anim';
import { useSceneFrame } from '../lib/scene-clock';
import { C, FONT, H, W, s } from '../lib/theme';

// 0:06 - 0:14. Difference 1: holds pressure longer.
// Frames are counted from the start of this scene (0:06).
const T = {
  title: 3,
  titleExit: 26,
  split: 30, // 0:07
  leftText: s(1.5),
  needle: s(1.9), // 0:07.9, needle drops 32 -> 26
  warn: s(2.4),
  pumps: [s(3.0), s(3.27), s(3.5)], // 0:09
  hum: s(4.0), // 0:10
  calendar: [s(3.85), s(4.0), s(4.15)],
  tick: s(4.27), // 0:10.27, green tick + chime
  merge: s(6.0), // 0:12
  message: s(6.5), // 0:12.5, bass impact
  note: s(7.0),
  out: s(7.87),
};

const L = 270;
const R = 810;
const Y = { head: 292, lens: 555, tyre: 885, gauge: 1125, icons: 1292, text: 1397 };

const SideText: React.FC<{ x: number; at: number; lines: string[] }> = ({ x, at, lines }) => {
  const f = useSceneFrame();
  const p = tween(f, [at, at + 8], [0, 1]);
  return (
    <At x={x} y={Y.text + (1 - p) * 30} opacity={p}>
      <div style={{ width: 500, textAlign: 'center', fontFamily: FONT.body, fontWeight: 600, fontSize: 37, lineHeight: 1.22, color: C.white, textShadow: '0 2px 10px #000' }}>
        {lines.map((l) => (
          <div key={l}>{l}</div>
        ))}
      </div>
    </At>
  );
};

// Dashed lines from the tyre wall up to the close-up.
const ZoomLines: React.FC<{ x: number; color: string }> = ({ x, color }) => (
  <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0 }}>
    <rect x={x + 40} y={Y.tyre - 122} width={38} height={32} fill="none" stroke={color} strokeWidth={3} />
    <line x1={x + 40} y1={Y.tyre - 122} x2={x - 80} y2={Y.lens + 142} stroke={color} strokeWidth={2.5} strokeDasharray="8 7" opacity={0.7} />
    <line x1={x + 78} y1={Y.tyre - 122} x2={x + 80} y2={Y.lens + 142} stroke={color} strokeWidth={2.5} strokeDasharray="8 7" opacity={0.7} />
  </svg>
);

const Split: React.FC = () => {
  const f = useSceneFrame();
  const open = tween(f, [T.split - 2, T.split + 8], [0, 1], ease.outBack);
  const merge = tween(f, [T.merge, T.merge + 10], [0, 1], ease.in);
  if (f < T.split - 2 || merge >= 1) return null;
  const tl = (f - T.split) / 30;
  const leftPsi = f < T.needle ? 32 : tween(f, [T.needle, T.needle + 15], [32, 26], ease.out) + (f > T.needle && f < T.needle + 18 ? Math.sin(f * 2.3) * 0.4 : 0);
  const rightPsi = tween(f, [s(2), s(4)], [32, 31], ease.inOut);
  const sag = tween(f, [T.needle, T.needle + 18], [0, 0.85], ease.out);
  const warnOn = f >= T.warn && Math.floor((f - T.warn) / 4) % 2 === 0;
  const flips = T.calendar.map((c) => tween(f, [c, c + 4], [0, 1]));
  const page = flips.filter((p) => p >= 1).length;
  const tick = pop(f, T.tick, 1.2);
  const side = (dir: number) => ({
    transform: `translateX(${dir * (1 - open) * 420 + dir * merge * -260}px) scale(${1 - merge * 0.35})`,
    opacity: open * (1 - merge),
  });
  return (
    <AbsoluteFill>
      <SplitTint opacity={open * (1 - merge)} />
      <AbsoluteFill style={side(-1)}>
        <At x={L} y={Y.head}>
          <Pill text="NORMAL AIR" color={C.grey} fontSize={60} />
        </At>
        <ZoomLines x={L} color={C.grey} />
        <At x={L} y={Y.lens}>
          <WallZoom id="leak" size={360} mode="leak" t={Math.max(0, tl)} />
        </At>
        <At x={L} y={Y.tyre}>
          <Tyre id="p-left" size={300} rotation={f * 0.8} tone="grey" sag={sag} />
        </At>
        <At x={L} y={Y.gauge}>
          <Gauge id="g-left" value={leftPsi} size={250} tone="grey" />
        </At>
        {f >= T.warn && (
          <At x={L + 150} y={Y.gauge - 95} opacity={warnOn ? 1 : 0.25} scale={pop(f, T.warn)}>
            <WarningIcon size={80} />
          </At>
        )}
        {T.pumps.map((p, i) => {
          const k = pop(f, p, 1.3);
          if (k <= 0) return null;
          const press = f - p < 6 ? Math.sin(((f - p) / 6) * Math.PI) : 0;
          return (
            <At key={i} x={L - 110 + i * 110} y={Y.icons} scale={k}>
              <PumpIcon size={82} press={press} />
            </At>
          );
        })}
        <SideText x={L} at={T.leftText} lines={['Air escapes faster.', 'Needs frequent refills.']} />
      </AbsoluteFill>
      <AbsoluteFill style={side(1)}>
        <At x={R} y={Y.head}>
          <Pill text="NITROGEN" color={C.blue} fontSize={60} />
        </At>
        <ZoomLines x={R} color={C.blue} />
        <At x={R} y={Y.lens}>
          <WallZoom id="hold" size={360} mode="hold" t={Math.max(0, tl)} />
        </At>
        <At x={R} y={Y.tyre}>
          <Tyre id="p-right" size={300} rotation={f * 0.8} tone="blue" glow={0.55 + 0.25 * Math.sin(f / 6)} />
        </At>
        <At x={R} y={Y.gauge}>
          <Gauge id="g-right" value={rightPsi} size={250} tone="blue" />
        </At>
        {tick > 0 && (
          <At x={R + 150} y={Y.gauge - 95} scale={tick}>
            <TickBadge size={80} />
            {f - T.tick < 12 && (
              <div
                style={{
                  position: 'absolute',
                  inset: -30,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.9), rgba(34,197,94,0) 65%)',
                  opacity: 1 - (f - T.tick) / 12,
                }}
              />
            )}
          </At>
        )}
        <At x={R} y={Y.icons}>
          <CalendarIcon size={104} label={`WEEK ${page + 1}`} next={`WEEK ${Math.min(4, page + 2)}`} flip={page < 3 ? flips[page] : 0} />
        </At>
        <SideText x={R} at={T.hum} lines={['Nitrogen escapes slower.', 'Pressure stays stable.']} />
      </AbsoluteFill>
      <Divider progress={open * (1 - merge)} />
    </AbsoluteFill>
  );
};

const KeyMessage: React.FC = () => {
  const f = useSceneFrame();
  const m = slam(f, T.message, 2.5, 4);
  const note = tween(f, [T.note, T.note + 8], [0, 1]);
  const tyre = pop(f, T.message + 4, 1.2);
  const out = tween(f, [T.out, T.out + 6], [1, 0]);
  if (m.opacity <= 0) return null;
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Shake hits={[{ at: T.message, amp: 22, dur: 12 }]}>
        <At x={W / 2} y={760} scale={m.scale} opacity={m.opacity}>
          <div style={{ textAlign: 'center', fontFamily: FONT.head, lineHeight: 0.95, whiteSpace: 'nowrap', textShadow: '0 6px 0 #000' }}>
            <div style={{ fontSize: 170, color: C.blue, letterSpacing: 4, textShadow: `0 6px 0 #000, 0 0 40px ${C.blue}` }}>NITROGEN =</div>
            <div style={{ fontSize: 136, color: C.white, letterSpacing: 3 }}>FEWER REFILLS,</div>
            <div style={{ fontSize: 112, color: C.white, letterSpacing: 3 }}>MORE STABLE PRESSURE</div>
          </div>
        </At>
        <At x={W / 2} y={1030} opacity={note}>
          <div style={{ fontFamily: FONT.body, fontWeight: 600, fontSize: 40, color: 'rgba(255,255,255,0.88)', whiteSpace: 'nowrap' }}>(Still check your tyres once a month!)</div>
        </At>
        {tyre > 0 && (
          <At x={W / 2} y={1255} scale={tyre}>
            <Tyre id="msg-tyre" size={300} rotation={f * 2} tone="blue" glow={0.8} />
          </At>
        )}
      </Shake>
    </AbsoluteFill>
  );
};

export const Scene3Pressure: React.FC = () => (
  <AbsoluteFill>
    <TitleCard digit="1" lines={['HOLDS PRESSURE', 'LONGER']} at={T.title} exit={T.titleExit} />
    <Split />
    <KeyMessage />
    <SpeedLines at={T.merge + 3} mode="right" before={6} after={8} clip={[0, 250, W / 2, H - 350]} count={16} seed="m1l" />
    <SpeedLines at={T.merge + 3} mode="left" before={6} after={8} clip={[W / 2, 250, W, H - 350]} count={16} seed="m1r" />

    <Sfx name="hiss" at={T.split} align="start" />
    <Sfx name="whirr" at={T.needle} align="start" />
    <Sfx name="beep" at={T.warn} align="start" />
    {T.pumps.map((p, i) => (
      <Sfx key={i} name="pump" at={p} align="start" pitch={1 + i * 0.05} />
    ))}
    <Sfx name="hum" at={T.hum} align="start" />
    <Sfx name="page-flip" at={T.calendar[0]} align="start" />
    <Sfx name="chime" at={T.tick} align="start" />
    <Sfx name="whoosh" at={T.merge + 3} />
    <Sfx name="bass-impact" at={T.message} />
  </AbsoluteFill>
);

