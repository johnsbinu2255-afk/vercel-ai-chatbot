import React from 'react';
import { Audio, Sequence, staticFile } from 'remotion';
import { sfx } from '../lib/assets';
import { useSceneOffset } from '../lib/scene-clock';
import { FPS } from '../lib/theme';

// Plays one sound effect so that its beat lands on scene frame `at`.
// Whooshes and hits line up on their loudest moment, other sounds on their start.
export const Sfx: React.FC<{
  name: string;
  at: number;
  volume?: number;
  pitch?: number;
  align?: 'beat' | 'start';
}> = ({ name, at, volume = 1, pitch, align = 'beat' }) => {
  const offset = useSceneOffset();
  const info = sfx[name];
  if (!info) throw new Error(`Unknown sound effect "${name}". Run npm run prepare-assets.`);
  const lead = align === 'start' ? 0 : Math.round(info.offset * FPS);
  const from = offset + at - lead;
  const trim = Math.max(0, -from);
  const frames = Math.ceil(info.duration * FPS) + 1 - trim;
  if (frames <= 0) return null;
  return (
    <Sequence name={`sfx ${name}`} from={from + trim} durationInFrames={frames} layout="none">
      <Audio src={staticFile(info.file)} volume={volume} toneFrequency={pitch} trimBefore={trim || undefined} />
    </Sequence>
  );
};
