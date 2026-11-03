import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Background, Particles } from './components/Backdrop';
import { Watermark } from './components/Watermark';
import { SceneSlot } from './lib/scene-clock';
import { C, s } from './lib/theme';
import { Scene1Hook } from './scenes/Scene1Hook';
import { Scene2Setup } from './scenes/Scene2Setup';
import { Scene3Pressure } from './scenes/Scene3Pressure';
import { Scene4Heat } from './scenes/Scene4Heat';
import { Scene5Summary } from './scenes/Scene5Summary';
import { Scene6Finale } from './scenes/Scene6Finale';
import { NumberZoom, WhiteFlash } from './transitions/Transitions';

// The whole 33 s reel. Each scene keeps its own pictures and sounds;
// change a scene's start here and everything in it moves together.
export const Reel: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: C.bg }}>
    <Background />
    <Particles />

    <SceneSlot name="2 Split setup (0:03)" start={s(3)} duration={96} zIndex={1}>
      <Scene2Setup />
    </SceneSlot>
    <SceneSlot name="1 Hook (0:00)" start={0} duration={s(3.3) + 1} zIndex={2}>
      <Scene1Hook />
    </SceneSlot>
    <SceneSlot name="3 Holds pressure longer (0:06)" start={s(6)} duration={s(8) + 6} zIndex={3}>
      <Scene3Pressure />
    </SceneSlot>
    <SceneSlot name="4 Less heat, longer life (0:14)" start={s(14)} duration={s(9) + 3} zIndex={4}>
      <Scene4Heat />
    </SceneSlot>
    <SceneSlot name="5 Quick summary (0:23)" start={s(23)} duration={s(3)} zIndex={5}>
      <Scene5Summary />
    </SceneSlot>
    <SceneSlot name="6 Finale (0:26)" start={s(26)} duration={s(7)} zIndex={6}>
      <Scene6Finale />
    </SceneSlot>

    <SceneSlot name="Transition: 1 zooms through" start={s(6) - 8} duration={16} zIndex={10}>
      <NumberZoom digit="1" />
    </SceneSlot>
    <SceneSlot name="Transition: 2 zooms through" start={s(14) - 8} duration={16} zIndex={10}>
      <NumberZoom digit="2" />
    </SceneSlot>
    <SceneSlot name="Transition: white flash" start={s(23) - 3} duration={13} zIndex={10}>
      <WhiteFlash />
    </SceneSlot>

    <AbsoluteFill style={{ zIndex: 20 }}>
      <Watermark />
    </AbsoluteFill>
  </AbsoluteFill>
);
