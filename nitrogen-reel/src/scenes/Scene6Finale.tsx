import React from 'react';
import { AbsoluteFill } from 'remotion';
import { At, BrandTile, Ribbon, RodoLogo, Seal } from '../components/Layout';
import { Shake, Shockwave, SpeedLines } from '../components/Fx';
import { PhoneIcon, PinIcon } from '../components/Icons';
import { Sfx } from '../components/Sfx';
import { ease, pop, tween } from '../lib/anim';
import { LogoName, logos } from '../lib/assets';
import { useSceneFrame } from '../lib/scene-clock';
import { C, FONT, W, s } from '../lib/theme';

// 0:26 - 0:33. Logo and slogan, authorized dealers, contact.
const SLOGAN = 'RODO TYRES: Grip You Can Trust';
const BRANDS: { name: string; logo: LogoName }[] = [
  { name: 'JK TYRE', logo: 'jk' },
  { name: 'APOLLO', logo: 'apollo' },
  { name: 'BRIDGESTONE', logo: 'bridgestone' },
  { name: 'YOKOHAMA', logo: 'yokohama' },
  { name: 'CONTINENTAL', logo: 'continental' },
  { name: 'MICHELIN', logo: 'michelin' },
];
const T = {
  land: 12, // 0:26.4 logo lands: shockwave boom
  typeStart: 16,
  glow: 50,
  moveUp: 54,
  ribbon: 66, // 0:28.2
  logos: [74, 83, 92, 101, 110, 119], // 0:28.47 .. 0:29.97
  seal: 131, // 0:30.37
  exit: 146,
  lines: [150, 159, 168], // 0:31, 31.3, 31.6
  pulses: [177, 189, 222],
  end: s(8), // 0:34 final ding + bass tail, zoom-out (after the voice-over ends)
};
const LOGO_W = 760;
const TILE = { w: 290, h: 150, gap: 30 };

const Rays: React.FC<{ k: number; spin: number }> = ({ k, spin }) => (
  <At x={W / 2} y={720} opacity={k}>
    <div
      style={{
        width: 1500,
        height: 1500,
        borderRadius: '50%',
        background: `repeating-conic-gradient(from ${spin}deg, rgba(255,196,0,0.38) 0deg 7deg, rgba(255,196,0,0) 7deg 22deg)`,
        WebkitMaskImage: 'radial-gradient(circle, black 18%, transparent 62%)',
        maskImage: 'radial-gradient(circle, black 18%, transparent 62%)',
      }}
    />
  </At>
);

const Slogan: React.FC = () => {
  const f = useSceneFrame();
  const shown = Math.max(0, Math.min(SLOGAN.length, f - T.typeStart + 1));
  if (shown <= 0) return null;
  const glow = tween(f, [T.glow, T.glow + 8], [0, 1]);
  const typed = SLOGAN.slice(0, shown);
  const split = SLOGAN.indexOf(':') + 1;
  const cursor = shown < SLOGAN.length || Math.floor(f / 8) % 2 === 0;
  return (
    <div
      style={{
        fontFamily: FONT.body,
        fontWeight: 800,
        fontSize: 54,
        whiteSpace: 'nowrap',
        color: C.white,
        textShadow: `0 3px 10px #000, 0 0 ${28 * glow}px rgba(255,196,0,${0.9 * glow})`,
      }}
    >
      <span style={{ color: C.yellow }}>{typed.slice(0, split)}</span>
      {typed.slice(split)}
      <span style={{ display: 'inline-block', width: 6, height: 54, marginLeft: 6, background: C.yellow, verticalAlign: -6, opacity: cursor ? 1 : 0 }} />
    </div>
  );
};

const Dealers: React.FC = () => {
  const f = useSceneFrame();
  const ribbon = tween(f, [T.ribbon - 6, T.ribbon + 6], [0, 1], ease.out);
  const exit = tween(f, [T.exit, T.exit + 8], [0, 1], ease.in);
  if (ribbon <= 0 || exit >= 1) return null;
  const sealIn = f < T.seal - 4 ? 0 : f < T.seal ? tween(f, [T.seal - 4, T.seal], [2.4, 1], ease.in) : 1 + 0.06 * Math.exp(-(f - T.seal) / 3);
  return (
    <AbsoluteFill style={{ transform: `translateY(${-exit * 80}px)`, opacity: 1 - exit }}>
      <At x={W / 2} y={715}>
        <Ribbon text="AUTHORIZED DEALERS OF" width={900} progress={ribbon} />
      </At>
      {BRANDS.map((b, i) => {
        const at = T.logos[i];
        const k = pop(f, at - 3, 1.5);
        if (k <= 0) return null;
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = W / 2 + (col - 1) * (TILE.w + TILE.gap);
        const y = 880 + row * (TILE.h + TILE.gap);
        return (
          <At key={b.name} x={x} y={y} scale={k}>
            <BrandTile name={b.name} logo={logos[b.logo]} w={TILE.w} h={TILE.h} shine={tween(f, [at + 2, at + 14], [0, 1], ease.linear)} />
          </At>
        );
      })}
      {sealIn > 0 && (
        <At x={860} y={1262} scale={sealIn} rotate={-14}>
          <Seal size={200} />
        </At>
      )}
      <Shockwave at={T.seal} x={860} y={1262} size={260} dur={12} />
    </AbsoluteFill>
  );
};

const Contact: React.FC = () => {
  const f = useSceneFrame();
  const line = (i: number) => tween(f, [T.lines[i], T.lines[i] + 8], [0, 1], ease.out);
  const pulse = T.pulses.reduce((acc, p) => acc + (f >= p ? Math.sin(Math.min(1, (f - p) / 10) * Math.PI) : 0), 0);
  if (line(0) <= 0) return null;
  return (
    <AbsoluteFill>
      <At x={W / 2} y={870 + (1 - line(0)) * 60} opacity={line(0)}>
        <div style={{ textAlign: 'center', fontFamily: FONT.head, fontSize: 118, lineHeight: 0.95, letterSpacing: 3, color: C.white, whiteSpace: 'nowrap', textShadow: '0 6px 0 #000' }}>
          GET NITROGEN FILLING
          <br />
          AT <span style={{ color: C.yellow }}>RODO TYRES!</span>
        </div>
      </At>
      <At x={W / 2} y={1050 + (1 - line(1)) * 60} opacity={line(1)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontFamily: FONT.body, fontWeight: 600, fontSize: 52, color: C.white, whiteSpace: 'nowrap', textShadow: '0 3px 10px #000' }}>
          <PinIcon size={58} />
          Piravom &amp; Mulanthuruthy
        </div>
      </At>
      <At x={W / 2} y={1205 + (1 - line(2)) * 60} opacity={line(2)} scale={1 + 0.09 * pulse}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 22,
            padding: '14px 40px 4px',
            borderRadius: 28,
            background: 'rgba(10,10,10,0.85)',
            border: `4px solid ${C.yellow}`,
            boxShadow: `0 0 ${30 + 50 * pulse}px rgba(255,196,0,${0.5 + 0.4 * pulse})`,
            fontFamily: FONT.head,
            fontSize: 132,
            letterSpacing: 3,
            color: C.yellow,
            whiteSpace: 'nowrap',
            textShadow: `0 0 ${20 + 30 * pulse}px rgba(255,196,0,0.9)`,
          }}
        >
          <PhoneIcon size={92} />
          Call: 9747691237
        </div>
      </At>
    </AbsoluteFill>
  );
};

export const Scene6Finale: React.FC = () => {
  const f = useSceneFrame();
  const approach = f < T.land ? Math.exp(Math.log(0.04) * (1 - f / T.land)) : 1 + 0.12 * Math.exp(-(f - T.land) / 4) * Math.cos((f - T.land) * 0.8);
  const up = tween(f, [T.moveUp, T.moveUp + 12], [0, 1], ease.inOut);
  const logoY = 720 - 300 * up;
  const logoScale = approach * (1 - 0.45 * up);
  const sloganY = 1075 - 465 * up;
  const sloganScale = 1 - 0.22 * up;
  const rays = f < T.land ? 0 : tween(f, [T.land, T.land + 6], [0, 1]) * (1 - 0.6 * up);
  const zoomOut = tween(f, [T.end, s(9)], [1, 0.92], ease.inOut);
  const spark = tween(f, [0, 8], [1, 0]);
  return (
    <AbsoluteFill style={{ transform: `scale(${zoomOut})` }}>
      <Shake
        hits={[
          { at: T.land, amp: 24, dur: 12 },
          ...T.logos.map((at) => ({ at, amp: 6, dur: 6 })),
          { at: T.seal, amp: 12, dur: 9 },
        ]}
      >
        {rays > 0 && <Rays k={rays} spin={f * 0.6} />}
        <Shockwave at={T.land} x={W / 2} y={720} size={900} dur={20} />
        <At x={W / 2} y={logoY} scale={logoScale}>
          <RodoLogo logo={logos.rodo} width={LOGO_W} />
        </At>
        <At x={W / 2} y={sloganY} scale={sloganScale}>
          <Slogan />
        </At>
        <Dealers />
        <Contact />
      </Shake>
      {spark > 0 && (
        <At x={W / 2} y={960}>
          <div style={{ width: 200, height: 200, borderRadius: '50%', opacity: spark, background: 'radial-gradient(circle, #ffffff 0%, rgba(255,220,120,0.9) 25%, rgba(255,196,0,0) 70%)' }} />
        </At>
      )}
      <SpeedLines at={T.land} mode="radial-out" before={10} after={6} cx={W / 2} cy={720} count={40} seed="logo" />
      <SpeedLines at={T.ribbon} mode="right" before={6} after={8} count={18} seed="ribbon" />

      <Sfx name="rising-whoosh" at={T.land} />
      <Sfx name="boom" at={T.land} />
      {[...SLOGAN].map((ch, i) => (ch === ' ' ? null : <Sfx key={i} name="type-click" at={T.typeStart + i} align="start" pitch={0.95 + (i % 5) * 0.03} />))}
      <Sfx name="shimmer" at={T.glow} align="start" />
      <Sfx name="ribbon" at={T.ribbon} />
      {T.logos.map((at, i) => (
        <Sfx key={at} name="hit" at={at} pitch={1 + i * 0.07} />
      ))}
      <Sfx name="stamp" at={T.seal} />
      {T.lines.map((at) => (
        <Sfx key={at} name="pop" at={at} />
      ))}
      <Sfx name="ding" at={T.end + 8} align="start" />
      <Sfx name="bass-tail" at={T.end} align="start" />
    </AbsoluteFill>
  );
};
