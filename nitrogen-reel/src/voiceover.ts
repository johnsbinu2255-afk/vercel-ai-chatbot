// Malayalam voice-over (assets/voiceover/voiceover.m4a). Each line of the recording is placed
// on its scene: `from`/`to` are seconds in the recording, `at` is where it starts in the video.
// If you record a new take, update from/to (the pauses between lines) for that file.
export type VoCue = { line: string; from: number; to: number; at: number };

export const VO_CUES: VoCue[] = [
  { line: 'നിങ്ങളുടെ ടയറിൽ നോർമൽ എയറോ, നൈട്രജനോ?', from: 0.55, to: 3.68, at: 0.05 },
  { line: 'രണ്ട് പ്രധാന വ്യത്യാസങ്ങൾ.', from: 4.12, to: 5.72, at: 4.05 },
  { line: 'ഒന്ന്: പ്രഷർ കൂടുതൽ നേരം നിൽക്കും.', from: 6.05, to: 8.5, at: 6.05 },
  { line: 'നോർമൽ എയർ വേഗം ചോരും, ഇടയ്ക്കിടെ കാറ്റടിക്കേണ്ടി വരും.', from: 8.87, to: 12.3, at: 8.6 },
  { line: 'നൈട്രജനിൽ പ്രഷർ സ്റ്റേബിളായി നിൽക്കും.', from: 12.61, to: 14.93, at: 12.15 },
  { line: 'രണ്ട്: ചൂട് കുറവ്, ടയറിന് കൂടുതൽ ആയുസ്സ്.', from: 15.3, to: 18.65, at: 14.45 },
  { line: 'പ്രഷർ കുറഞ്ഞാൽ ടയർ ചൂടാകും, വേഗം തേയും.', from: 18.95, to: 21.99, at: 17.85 },
  { line: 'നൈട്രജനിൽ ടയർ കൂടുതൽ കാലം ഈടുനിൽക്കും.', from: 22.21, to: 25.09, at: 21.0 },
  { line: 'റോഡോ ടയേഴ്സ്: ഗ്രിപ്പ് യു കാൻ ട്രസ്റ്റ്!', from: 25.29, to: 27.93, at: 25.85 },
  { line: 'പ്രമുഖ ബ്രാൻഡുകളുടെ ഓതറൈസ്ഡ് ഡീലർ.', from: 28.06, to: 30.27, at: 28.55 },
  { line: 'നൈട്രജൻ ഫില്ലിംഗിന് ഇന്നുതന്നെ വരൂ,', from: 30.41, to: 32.4, at: 30.9 },
  { line: 'പിറവം, മുളന്തുരുത്തി.', from: 32.52, to: 33.91, at: 32.85 },
];

// Voice level in the mix, and how far sound effects dip while the voice speaks (0.5 = -6 dB).
export const VO_VOLUME = 0.6;
export const DUCK = 0.5;
const RAMP = 0.12; // seconds

// Sound-effect gain at a moment of the video (seconds).
export const duckAt = (t: number) => {
  let k = 0;
  for (const c of VO_CUES) {
    const start = c.at;
    const end = c.at + (c.to - c.from);
    if (t < start - RAMP || t > end + RAMP) continue;
    const inside = t < start ? 1 - (start - t) / RAMP : t > end ? 1 - (t - end) / RAMP : 1;
    k = Math.max(k, inside);
  }
  return 1 - (1 - DUCK) * k;
};
