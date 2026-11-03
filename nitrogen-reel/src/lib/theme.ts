export const FPS = 30;
export const W = 1080;
export const H = 1920;
export const DURATION = 33 * FPS; // 990 frames

export const C = {
  bg: '#0A0A0A',
  yellow: '#FFC400',
  blue: '#00B4FF',
  grey: '#9CA3AF',
  red: '#E31E24',
  green: '#22C55E',
  white: '#FFFFFF',
};

export const FONT = {
  head: "'Bebas Neue', 'Montserrat', sans-serif",
  body: "'Montserrat', sans-serif",
};

// Keep text inside this band so Instagram's buttons and captions don't cover it.
export const SAFE = { top: 250, bottom: H - 350 };

// Seconds to frames.
export const s = (sec: number) => Math.round(sec * FPS);
