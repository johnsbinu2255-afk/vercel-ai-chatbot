import React from 'react';
import { AbsoluteFill } from 'remotion';
import { At, Divider, Pill, Shine, SplitTint } from '../components/Layout';
import { Shake, SpeedLines } from '../components/Fx';
import { FastForwardIcon, TickBadge } from '../components/Icons';
import { Thermometer } from '../components/Instruments';
import { Sfx } from '../components/Sfx';
import { TitleCard } from '../components/TitleCard';
import { Tyre } from '../components/Tyre';
import { ease, pop, slam, tween } from '../lib/anim';
import { useSceneFrame } from '../lib/scene-clock';
import { C, FONT, H, W, s } from '../lib/theme';

// 0:14 - 0:23. Difference 2: less heat, longer tyre life.
// Frames are counted from the start of this scene (0:14).
const T = {
  title: 3,
  titleExit: 26,
  split: 30, // 0:15 rolling on the road
  heat: s(2.0), // 0:16 sizzle + thermometer rising
  red: s(3.0), // 0:17 thermometer in the red, warning beep
  wearStart: s(2.2),
  wearEnd: s(4.2),
  cool: s(4.0), // 0:18 cool airy whoosh on the right
  chime: s(5.0), // 0:19
  merge: s(6.0), // 0:20
  barsFull: s(7.1), // 0:21.1 rising whoosh peaks as the bars fill
  helps: s(7.5),
  shine: s(8.0), // 0:22 sparkle on the shine sweep
  last: s(8.5), // 0:22.5 bass impact on LAST LONGER
};

const L = 300;
const R = 780;
const Y = { head: 290, thermo: 610, tyre: 870, road: 1015, tread: 1150, text: 1370 };
const TYRE = 300;
const ROLL = 7; // degrees per frame
const ROAD_SPEED = ((2 * Math.PI * TYRE * 0.4) / 360) * ROLL;

const Road: React.FC<{ x0: number; hot: number }> = ({ x0, hot }) => {
  const f = useSceneFrame();
  const shift = (f * ROAD_SPEED) % 120;
  return (
    <div style={{ position: 'absolute', left: x0, top: Y.road - 22, width: W / 2, height: 52, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #2a2a2e, #141416)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(255,90,20,0.55), rgba(255,140,0,0.1))', opacity: hot }} />
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} style={{ position: 'absolute', top: 23, left: i * 120 - shift, width: 60, height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.75)' }} />
      ))}
    </div>
  );
};

const HeatWaves: React.FC<{ x: number; k: number }> = ({ x, k }) => {
  const f = useSceneFrame();
  if (k <= 0) return null;
  return (
    <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, opacity: k }}>
      {Array.from({ length: 5 }, (_, i) => {
        const rise = ((f * 4 + i * 60) % 300) / 300;
        const y = Y.tyre - 140 - rise * 260;
        const xx = x - 90 + i * 45;
        const d = Array.from({ length: 9 }, (_, j) => `${j ? 'L' : 'M'}${xx + Math.sin(j * 1.3 + f / 4 + i) * 12},${y - j * 14}`).join(' ');
        return <path key={i} d={d} fill="none" stroke="#ff7a2a" strokeWidth={6} strokeLinecap="round" opacity={(1 - rise) * 0.8} style={{ filter: 'blur(1px)' }} />;
      })}
    </svg>
  );
};

const Tread: React.FC<{ x: number; depth: number; color: string; ff: boolean }> = ({ x, depth, color, ff }) => {
  const f = useSceneFrame();
  return (
    <At x={x} y={Y.tread}>
      <div style={{ position: 'relative', width: 380, height: 120, borderRadius: 20, background: 'rgba(10,10,10,0.85)', border: `3px solid ${color}`, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 16, top: 10, fontFamily: FONT.body, fontWeight: 700, fontSize: 22, letterSpacing: 2, color: 'rgba(255,255,255,0.8)' }}>TREAD</div>
        {ff && Math.floor(f / 4) % 2 === 0 && (
          <div style={{ position: 'absolute', right: 16, top: 12 }}>
            <FastForwardIcon size={38} color={C.yellow} />
          </div>
        )}
        <div style={{ position: 'absolute', left: 20, right: 20, bottom: 12, height: 64, display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          {Array.from({ length: 7 }, (_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${18 + 82 * depth}%`,
                borderRadius: '6px 6px 2px 2px',
                background: `linear-gradient(180deg, ${depth > 0.5 ? '#4a4a52' : '#5e5e66'}, #1b1b1f)`,
                boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.15)',
              }}
            />
          ))}
        </div>
      </div>
    </At>
  );
};

const PsiChip: React.FC<{ x: number; value: number; good: boolean }> = ({ x, value, good }) => (
  <At x={x} y={Y.tyre - 150}>
    <div
      style={{
        padding: '6px 16px 2px',
        borderRadius: 14,
        background: 'rgba(10,10,10,0.85)',
        border: `3px solid ${good ? C.green : C.red}`,
        fontFamily: FONT.head,
        fontSize: 44,
        color: good ? C.green : C.red,
        whiteSpace: 'nowrap',
      }}
    >
      {Math.round(value)} PSI
    </div>
  </At>
);

const SideText: React.FC<{ x: number; at: number; lines: string[] }> = ({ x, at, lines }) => {
  const f = useSceneFrame();
  const p = tween(f, [at, at + 8], [0, 1]);
  return (
    <At x={x} y={Y.text + (1 - p) * 30} opacity={p}>
      <div style={{ width: 500, textAlign: 'center', fontFamily: FONT.body, fontWeight: 600, fontSize: 36, lineHeight: 1.2, color: C.white, textShadow: '0 2px 10px #000' }}>
        {lines.map((l) => (
          <div key={l}>{l}</div>
        ))}
      </div>
    </At>
  );
};

const Split: React.FC = () => {
  const f = useSceneFrame();
  const open = tween(f, [T.split - 2, T.split + 8], [0, 1], ease.outBack);
  const merge = tween(f, [T.merge, T.merge + 10], [0, 1], ease.in);
  if (f < T.split - 2 || merge >= 1) return null;
  const psi = tween(f, [T.split, T.split + 30], [32, 26]);
  const sag = tween(f, [T.split, T.split + 30], [0.2, 0.85]) + (f > T.split + 15 ? 0.07 * Math.sin(f * 0.9) : 0);
  const thermoL = tween(f, [T.heat, T.red], [0.32, 0.96], ease.inOut);
  const heat = tween(f, [T.heat + 6, T.red + 6], [0, 1]);
  const wearL = tween(f, [T.wearStart, T.wearEnd], [1, 0.22], ease.linear);
  const wearR = tween(f, [T.wearStart, T.wearEnd], [1, 0.93], ease.linear);
  const coolPulse = f >= T.cool ? Math.exp(-(f - T.cool) / 10) : 0;
  const tick = pop(f, T.chime, 1.2);
  const side = (dir: number) => ({
    transform: `translateX(${dir * (1 - open) * 420 + dir * merge * -260}px) scale(${1 - merge * 0.35})`,
    opacity: open * (1 - merge),
  });
  return (
    <AbsoluteFill>
      <SplitTint opacity={open * (1 - merge)} />
      <AbsoluteFill style={side(-1)}>
        <At x={W / 4} y={Y.head}>
          <Pill text="NORMAL AIR" color={C.grey} fontSize={60} />
        </At>
        <At x={70} y={Y.thermo}>
          <Thermometer id="th-left" level={thermoL} height={400} />
        </At>
        <HeatWaves x={L} k={heat} />
        <Road x0={0} hot={heat * 0.8} />
        <At x={L} y={Y.tyre}>
          <Tyre id="h-left" size={TYRE} rotation={f * ROLL} tone="grey" sag={sag} heat={heat} tread={wearL} />
        </At>
        <PsiChip x={L + 120} value={psi} good={false} />
        <Tread x={W / 4} depth={wearL} color={heat > 0.5 ? C.red : C.grey} ff={f >= T.wearStart && f < T.wearEnd} />
        <SideText x={W / 4} at={T.heat} lines={['Low pressure', '= More heat', '= Faster wear']} />
      </AbsoluteFill>
      <AbsoluteFill style={side(1)}>
        <At x={(3 * W) / 4} y={Y.head}>
          <Pill text="NITROGEN" color={C.blue} fontSize={60} />
        </At>
        <At x={1010} y={Y.thermo}>
          <Thermometer id="th-right" level={0.3 + 0.02 * Math.sin(f / 8)} height={400} />
        </At>
        {tick > 0 && (
          <At x={1010} y={Y.thermo + 250} scale={tick}>
            <TickBadge size={70} />
          </At>
        )}
        <Road x0={W / 2} hot={0} />
        <At x={R} y={Y.tyre}>
          <Tyre id="h-right" size={TYRE} rotation={f * ROLL} tone="blue" sag={0.08} glow={0.6 + 0.6 * coolPulse} tread={wearR} />
        </At>
        <PsiChip x={R - 120} value={32} good />
        <Tread x={(3 * W) / 4} depth={wearR} color={C.blue} ff={false} />
        <SideText x={(3 * W) / 4} at={T.cool} lines={['Stable pressure', '= Less heat', '= Longer life']} />
      </AbsoluteFill>
      <Divider progress={open * (1 - merge)} />
    </AbsoluteFill>
  );
};

const Bar: React.FC<{ y: number; label: string; color: string; fill: number; shine: number }> = ({ y, label, color, fill, shine }) => (
  <>
    <div style={{ position: 'absolute', left: 110, top: y - 92, fontFamily: FONT.body, fontWeight: 800, fontSize: 46, color, letterSpacing: 1 }}>{label}</div>
    <div style={{ position: 'absolute', left: 110, top: y - 35, width: 860, height: 70, borderRadius: 35, background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,255,255,0.2)', overflow: 'hidden' }}>
      <div
        style={{
          position: 'relative',
          width: `${fill * 100}%`,
          height: '100%',
          borderRadius: 35,
          background: `linear-gradient(180deg, ${color}, ${color}aa)`,
          boxShadow: `0 0 30px ${color}`,
          overflow: 'hidden',
        }}
      >
        <Shine progress={shine} radius={35} />
      </div>
    </div>
  </>
);

const Meter: React.FC = () => {
  const f = useSceneFrame();
  const appear = tween(f, [T.merge + 6, T.merge + 14], [0, 1]);
  if (appear <= 0) return null;
  const grey = tween(f, [T.merge + 12, T.barsFull - 6], [0, 0.55], ease.out);
  const blue = tween(f, [T.merge + 14, T.barsFull], [0, 0.9], ease.out);
  const helps = tween(f, [T.helps, T.helps + 8], [0, 1]);
  const last = slam(f, T.last, 2.6, 4);
  return (
    <AbsoluteFill style={{ opacity: appear }}>
      <Shake hits={[{ at: T.last, amp: 22, dur: 12 }]}>
        <At x={W / 2} y={420}>
          <div style={{ fontFamily: FONT.head, fontSize: 130, color: C.yellow, letterSpacing: 6, textShadow: '0 0 30px rgba(255,196,0,0.7), 0 6px 0 #000' }}>TYRE LIFE</div>
        </At>
        <Bar y={650} label="NORMAL AIR" color={C.grey} fill={grey} shine={0} />
        <Bar y={870} label="NITROGEN" color={C.blue} fill={blue} shine={tween(f, [T.shine - 3, T.shine + 9], [0, 1], ease.linear)} />
        <At x={W / 2} y={1075 + (1 - helps) * 30} opacity={helps}>
          <div style={{ fontFamily: FONT.body, fontWeight: 800, fontSize: 56, color: C.white, whiteSpace: 'nowrap', textShadow: '0 3px 12px #000' }}>Nitrogen helps your tyres</div>
        </At>
        {last.opacity > 0 && (
          <At x={W / 2} y={1245} scale={last.scale} opacity={last.opacity}>
            <div style={{ fontFamily: FONT.head, fontSize: 212, lineHeight: 0.9, color: C.yellow, letterSpacing: 6, whiteSpace: 'nowrap', textShadow: '0 0 50px rgba(255,196,0,0.85), 0 8px 0 #000' }}>
              LAST LONGER
            </div>
          </At>
        )}
      </Shake>
    </AbsoluteFill>
  );
};

export const Scene4Heat: React.FC = () => (
  <AbsoluteFill>
    <TitleCard digit="2" lines={['LESS HEAT,', 'LONGER TYRE LIFE']} at={T.title} exit={T.titleExit} />
    <Split />
    <Meter />
    <SpeedLines at={T.cool} mode="left" before={6} after={12} clip={[W / 2, 600, W, 1100]} count={18} color={C.blue} seed="cool" />
    <SpeedLines at={T.merge + 3} mode="right" before={6} after={8} clip={[0, 250, W / 2, H - 350]} count={16} seed="m2l" />
    <SpeedLines at={T.merge + 3} mode="left" before={6} after={8} clip={[W / 2, 250, W, H - 350]} count={16} seed="m2r" />
    <SpeedLines at={T.barsFull} mode="right" before={14} after={4} clip={[0, 520, W, 940]} count={20} seed="bars" />

    <Sfx name="road-roll" at={T.split} align="start" />
    <Sfx name="sizzle" at={T.heat} align="start" />
    <Sfx name="rise-whine" at={T.heat} align="start" />
    <Sfx name="beep" at={T.red} align="start" />
    <Sfx name="cool-whoosh" at={T.cool} />
    <Sfx name="chime" at={T.chime} align="start" />
    <Sfx name="whoosh" at={T.merge + 3} />
    <Sfx name="rising-whoosh" at={T.barsFull} />
    <Sfx name="ting" at={T.shine} align="start" />
    <Sfx name="bass-impact" at={T.last} />
  </AbsoluteFill>
);
