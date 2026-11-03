import React from 'react';
import { Composition } from 'remotion';
import './lib/fonts';
import { DURATION, FPS, H, W } from './lib/theme';
import { Reel } from './Reel';

export const RemotionRoot: React.FC = () => (
  <Composition id="NitrogenReel" component={Reel} durationInFrames={DURATION} fps={FPS} width={W} height={H} />
);
