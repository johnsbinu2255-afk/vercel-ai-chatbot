import React, { createContext, useContext } from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';

// Every scene is mounted a little early (PRE frames) so a whoosh can build up
// before the scene's first frame. Scenes use scene-local frames: 0 = scene start.
export const PRE = 24;

const Offset = createContext(0);

export const useSceneFrame = () => useCurrentFrame() - useContext(Offset);
export const useSceneOffset = () => useContext(Offset);

export const SceneSlot: React.FC<{
  name: string;
  start: number;
  duration: number;
  zIndex?: number;
  children: React.ReactNode;
}> = ({ name, start, duration, zIndex, children }) => (
  <Sequence name={name} from={start - PRE} durationInFrames={duration + PRE} style={{ zIndex }}>
    <Offset.Provider value={PRE}>
      <Hidden>{children}</Hidden>
    </Offset.Provider>
  </Sequence>
);

// Pictures stay hidden during the lead-in; sounds still play.
const Hidden: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useSceneFrame();
  return <AbsoluteFill style={{ visibility: f < 0 ? 'hidden' : 'visible' }}>{children}</AbsoluteFill>;
};
