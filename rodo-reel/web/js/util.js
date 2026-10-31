export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);
export const ease = {
  in: (t) => t * t * t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
// 1 at t0, decaying to 0 at t0 + dur
export const pulse = (t, t0, dur) => (t < t0 ? 0 : Math.pow(1 - clamp((t - t0) / dur), 2));
// in/out window envelope
export const env = (t, a, b, fi = 0.4, fo = 0.4) => ease.out(prog(t, a, a + fi)) * (1 - ease.in(prog(t, b - fo, b)));
