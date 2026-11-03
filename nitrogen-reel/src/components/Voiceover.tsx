import React from 'react';
import { Audio, Sequence, staticFile } from 'remotion';
import { voiceover } from '../lib/assets';
import { FPS } from '../lib/theme';
import { VO_CUES, VO_VOLUME } from '../voiceover';

// Plays each line of the voice-over at its place in the video (with tiny fades at the cuts).
export const Voiceover: React.FC = () => {
  if (!voiceover) return null;
  const src = staticFile(voiceover.file);
  return (
    <>
      {VO_CUES.map((c) => {
        const frames = Math.round((c.to - c.from) * FPS);
        return (
          <Sequence key={c.at} name={`voice: ${c.line}`} from={Math.round(c.at * FPS)} durationInFrames={frames} layout="none">
            <Audio
              src={src}
              trimBefore={Math.round(c.from * FPS)}
              volume={(f) => VO_VOLUME * Math.min(1, (f + 1) / 2, (frames - f) / 2)}
            />
          </Sequence>
        );
      })}
    </>
  );
};
