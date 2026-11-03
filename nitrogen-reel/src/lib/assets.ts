import manifest from '../generated/assets.json';

export type LogoName = 'rodo' | 'jk' | 'apollo' | 'bridgestone' | 'yokohama' | 'continental' | 'michelin';

export type LogoInfo = {
  file: string;
  cutout: string | null;
  opaque: boolean;
  width: number;
  height: number;
};

export type SfxInfo = {
  file: string;
  source: string;
  duration: number;
  offset: number;
};

export const logos = manifest.logos as Record<LogoName, LogoInfo | null>;
export const voiceover = (manifest as { voiceover?: { file: string; duration: number } | null }).voiceover ?? null;
export const sfx = manifest.sfx as Record<string, SfxInfo>;
