import { Easing, interpolate, spring } from 'remotion';
import { FPS } from './theme';

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));

export const ease = {
  out: Easing.out(Easing.cubic),
  in: Easing.in(Easing.cubic),
  inOut: Easing.inOut(Easing.cubic),
  outBack: Easing.out(Easing.back(1.6)),
  inExpo: Easing.in(Easing.exp),
  outExpo: Easing.out(Easing.exp),
  linear: Easing.linear,
};

// Value between frames f0 and f1, clamped outside.
export const tween = (frame: number, [f0, f1]: [number, number], [v0, v1]: [number, number], easing = ease.out) =>
  interpolate(frame, [f0, f1], [v0, v1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });

// Bouncy elastic pop-in: 0 -> overshoot -> 1.
export const pop = (frame: number, at: number, bounce = 1) =>
  frame < at
    ? 0
    : spring({ frame: frame - at, fps: FPS, config: { damping: 10 / bounce, stiffness: 200, mass: 0.7 }, durationRestThreshold: 0.001 });

// Slam: comes in big and lands at 1 on frame `at`, then a short squash.
export const slam = (frame: number, at: number, from = 2.6, lead = 4) => {
  if (frame < at - lead) return { scale: from, opacity: 0 };
  if (frame < at) {
    const p = (frame - (at - lead)) / lead;
    return { scale: from + (1 - from) * p * p, opacity: p };
  }
  const u = (frame - at) / FPS;
  return { scale: 1 - 0.07 * Math.exp(-11 * u) * Math.cos(26 * u), opacity: 1 };
};

// Drop in from above with a bounce, landing on frame `at`.
export const drop = (frame: number, at: number, height = 320) => {
  if (frame < at - 6) return { y: -height, opacity: 0 };
  if (frame < at) {
    const p = (frame - (at - 6)) / 6;
    return { y: -height * (1 - p * p), opacity: Math.min(1, p * 2) };
  }
  const u = (frame - at) / FPS;
  return { y: -26 * Math.exp(-9 * u) * Math.abs(Math.sin(14 * u)), opacity: 1 };
};

export type Hit = { at: number; amp?: number; dur?: number };

// Screen shake from a list of impacts (frames).
export const shakeAt = (frame: number, hits: Hit[]) => {
  let x = 0;
  let y = 0;
  let r = 0;
  for (const h of hits) {
    const d = h.dur ?? 9;
    const u = frame - h.at;
    if (u < 0 || u > d) continue;
    const k = Math.pow(1 - u / d, 2) * (h.amp ?? 14);
    const ph = h.at * 1.37;
    x += k * Math.sin(u * 2.4 + ph);
    y += k * 0.8 * Math.sin(u * 1.9 + ph * 1.7 + 1.3);
    r += k * 0.03 * Math.sin(u * 1.6 + 2.1);
  }
  return { x, y, r };
};
