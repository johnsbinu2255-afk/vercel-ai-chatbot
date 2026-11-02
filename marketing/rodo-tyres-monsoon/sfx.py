"""Procedural sound effects for the Rodo Tyres "Monsoon Grip Test" reel.

Everything is synthesised with numpy (no music, no external samples):
rain bed, thunder, rumble, skid, splash, beeps, screech, glass crack,
glitch, whooshes, grip thud, bass impacts and dings.
"""
import math
import wave

import numpy as np

SR = 44100
DUR = 20.0
N = int(SR * DUR)
RNG = np.random.default_rng(2026)


# ----------------------------------------------------------------- helpers
def noise(n):
    return RNG.standard_normal(n)


def fft_filter(x, lo=None, hi=None, order=2):
    """Zero-phase Butterworth-shaped band filter done in the frequency domain."""
    n = len(x)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    g = np.ones_like(f)
    if hi is not None:
        g *= 1 / np.sqrt(1 + (f / hi) ** (2 * order))
    if lo is not None:
        with np.errstate(divide="ignore"):
            g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-6)) ** (2 * order))
    return np.fft.irfft(X * g, n)


def tvec(dur):
    return np.arange(int(dur * SR)) / SR


def norm(x):
    m = np.max(np.abs(x))
    return x / m if m > 0 else x


def place(buf, sig, t0, gain=1.0, pan=0.0):
    """Mix a mono (or stereo) signal into the stereo buffer at time t0."""
    i0 = int(t0 * SR)
    if i0 >= N:
        return
    if sig.ndim == 1:
        l = sig * math.cos((pan + 1) * math.pi / 4)
        r = sig * math.sin((pan + 1) * math.pi / 4)
        sig = np.stack([l, r], 1) * math.sqrt(2)
    j0 = max(0, -i0)
    i0 = max(0, i0)
    seg = sig[j0:j0 + N - i0]
    buf[i0:i0 + len(seg)] += seg * gain


def sweep_sine(f0, f1, dur, curve=2.0):
    t = tvec(dur)
    k = (t / dur) ** (1 / curve)
    f = f0 + (f1 - f0) * k
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def onepole_sweep(x, fc_start, fc_end):
    """Time-varying one-pole lowpass (for whooshes)."""
    n = len(x)
    fc = np.geomspace(fc_start, fc_end, n)
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty(n)
    s = 0.0
    for i in range(n):
        s = (1 - a[i]) * x[i] + a[i] * s
        y[i] = s
    return y


# ----------------------------------------------------------------- sounds
def rain_bed():
    out = np.zeros((N, 2))
    for ch in range(2):
        hiss = fft_filter(noise(N), lo=500, hi=7000)
        body = fft_filter(noise(N), lo=120, hi=900) * 0.6
        # individual droplets: sparse clicks
        clicks = np.zeros(N)
        idx = RNG.integers(0, N, 9000)
        clicks[idx] = RNG.uniform(-1, 1, len(idx))
        clicks = fft_filter(clicks, lo=1800, hi=9000) * 6
        out[:, ch] = norm(hiss) * 0.55 + norm(body) * 0.35 + norm(clicks) * 0.25
    # loudness curve across the reel
    t = np.arange(N) / SR
    env = np.interp(
        t,
        [0, 0.4, 3, 3.2, 12, 12.3, 14, 14.2, 17, 17.3, 19, 20],
        [0.0, 0.62, 0.6, 0.42, 0.40, 0.20, 0.20, 0.32, 0.30, 0.18, 0.12, 0.0],
    )
    return out * env[:, None]


def thunder(dur=4.0, crack=True, seed=0):
    r = np.random.default_rng(seed)
    t = tvec(dur)
    n = len(t)
    rumble = fft_filter(r.standard_normal(n), lo=25, hi=180, order=3)
    mod = np.abs(fft_filter(r.standard_normal(n), hi=6))
    mod = mod / mod.max()
    env = (1 - np.exp(-t / 0.05)) * np.exp(-t / (dur * 0.33))
    sig = norm(rumble) * env * (0.45 + 0.55 * mod)
    if crack:
        c = fft_filter(r.standard_normal(n), lo=700, hi=9000)
        cenv = np.exp(-t / 0.07) + 0.35 * np.exp(-np.maximum(t - 0.09, 0) / 0.12) * (t > 0.09)
        sig = sig + norm(c) * cenv * 0.9
    return np.tanh(sig * 1.4)


def low_rumble(dur):
    t = tvec(dur)
    s = np.sin(2 * np.pi * 38 * t) * 0.5 + norm(fft_filter(noise(len(t)), hi=90, order=3)) * 0.6
    env = np.minimum(1, t / 0.8) * np.minimum(1, (dur - t) / 0.4)
    return s * env


def splash(dur=0.7, seed=1):
    r = np.random.default_rng(seed)
    t = tvec(dur)
    n = len(t)
    s = norm(fft_filter(r.standard_normal(n), lo=250, hi=5000)) * np.exp(-t / 0.16) * (1 - np.exp(-t / 0.004))
    # bubbles
    for _ in range(10):
        t0 = r.uniform(0.02, dur * 0.6)
        f0 = r.uniform(500, 1400)
        bt = t - t0
        m = bt > 0
        s[m] += 0.18 * np.sin(2 * np.pi * (f0 * bt[m] + 2500 * bt[m] ** 2)) * np.exp(-bt[m] / 0.03)
    return s


def water_skid(dur):
    t = tvec(dur)
    n = len(t)
    hiss = norm(fft_filter(noise(n), lo=1200, hi=7000)) * (0.6 + 0.4 * np.sin(2 * np.pi * 7 * t))
    slosh = norm(fft_filter(noise(n), lo=80, hi=500)) * 0.7
    f = 820 + 60 * np.sin(2 * np.pi * 5.5 * t) - 140 * t / dur
    squeal = np.sin(2 * np.pi * np.cumsum(f) / SR)
    squeal = squeal + 0.35 * np.sin(2 * 2 * np.pi * np.cumsum(f) / SR)
    env = np.minimum(1, t / 0.15) * np.minimum(1, (dur - t) / 0.3)
    return (hiss * 0.55 + slosh * 0.5 + squeal * 0.22 * np.minimum(1, t / 0.6)) * env


def beep(f=980, dur=0.13):
    t = tvec(dur)
    s = np.sign(np.sin(2 * np.pi * f * t)) * 0.35 + np.sin(2 * np.pi * f * t) * 0.65
    env = np.minimum(1, t / 0.004) * np.minimum(1, (dur - t) / 0.01)
    return fft_filter(s * env, hi=6000)


def screech(dur, slow_from, slow_to):
    t = tvec(dur)
    n = len(t)
    # pitch drops during the slow-motion window
    slow = np.clip((t - slow_from) / 0.12, 0, 1) * np.clip((slow_to - t) / 0.12, 0, 1)
    f = (2100 - 300 * t / dur) * (1 - 0.42 * slow) + 70 * np.sin(2 * np.pi * 9 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) + 0.5 * np.sin(2 * ph + 0.3) + 0.25 * np.sin(3 * ph)
    s += norm(fft_filter(noise(n), lo=1500, hi=6000)) * 0.6
    am = 0.75 + 0.25 * np.sin(2 * np.pi * 23 * t)
    env = np.minimum(1, t / 0.08) * np.minimum(1, (dur - t) / 0.08)
    return np.tanh(s * am * env * 0.9)


def glass_crack(dur=0.9, seed=5):
    r = np.random.default_rng(seed)
    t = tvec(dur)
    n = len(t)
    s = np.zeros(n)
    # sharp crack transient
    s += norm(fft_filter(r.standard_normal(n), lo=2000, hi=12000)) * np.exp(-t / 0.03) * 1.2
    # crackle ticks
    for _ in range(40):
        i = int(r.uniform(0, 0.35) * SR)
        s[i:i + 60] += r.uniform(-1, 1) * np.exp(-np.arange(min(60, n - i)) / 8)
    # tinkles
    for _ in range(14):
        t0 = r.uniform(0.03, 0.6)
        f0 = r.uniform(3200, 7800)
        bt = t - t0
        m = bt > 0
        s[m] += 0.12 * np.sin(2 * np.pi * f0 * bt[m]) * np.exp(-bt[m] / 0.06)
    return fft_filter(s, lo=900)


def glitch(dur=0.45, seed=9):
    r = np.random.default_rng(seed)
    t = tvec(dur)
    n = len(t)
    s = np.zeros(n)
    step = int(SR / 30)
    for i in range(0, n, step):
        kind = r.integers(0, 3)
        seg = np.arange(min(step, n - i)) / SR
        if kind == 0:
            s[i:i + len(seg)] = np.sign(np.sin(2 * np.pi * r.uniform(150, 1800) * seg)) * 0.6
        elif kind == 1:
            s[i:i + len(seg)] = r.uniform(-1, 1, len(seg)) * 0.8
        else:
            s[i:i + len(seg)] = np.sin(2 * np.pi * r.uniform(60, 120) * seg)
    s = np.round(s * 6) / 6  # bitcrush
    return s * np.minimum(1, (dur - t) / 0.05)


def whoosh(dur=0.45, up=True):
    t = tvec(dur)
    x = noise(len(t))
    y = onepole_sweep(x, 300, 6000) if up else onepole_sweep(x, 6000, 300)
    y = norm(y - fft_filter(y, hi=120))
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5
    return y * env


def grip_thud():
    t = tvec(0.6)
    body = sweep_sine(110, 38, 0.6, curve=0.5) * np.exp(-t / 0.13)
    click = norm(fft_filter(noise(len(t)), lo=1500, hi=6000)) * np.exp(-t / 0.008) * 0.4
    rub = norm(fft_filter(noise(len(t)), lo=100, hi=800)) * np.exp(-t / 0.05) * 0.5
    return np.tanh((body + click + rub) * 1.6)


def ding(f=1568.0, dur=1.6):
    t = tvec(dur)
    s = (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 1.5 * t) * np.exp(-t / 0.25)
         + 0.25 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.12))
    return s * np.exp(-t / 0.45) * np.minimum(1, t / 0.002)


def bass_impact(dur=1.4, f0=95, f1=30):
    t = tvec(dur)
    body = sweep_sine(f0, f1, dur, curve=0.35) * np.exp(-t / (dur * 0.35))
    hit = norm(fft_filter(noise(len(t)), hi=2500)) * np.exp(-t / 0.025) * 0.7
    return np.tanh((body * 1.3 + hit) * 1.5)


def impact_hit():
    t = tvec(0.5)
    body = sweep_sine(150, 45, 0.5, curve=0.4) * np.exp(-t / 0.1)
    snap = norm(fft_filter(noise(len(t)), lo=800, hi=8000)) * np.exp(-t / 0.015) * 0.5
    return np.tanh((body + snap) * 1.8)


def reverb(x, secs=1.3, mix=0.18, seed=3):
    r = np.random.default_rng(seed)
    n = int(secs * SR)
    ir = r.standard_normal(n) * np.exp(-np.arange(n) / (SR * secs / 5))
    ir = fft_filter(ir, hi=5000)
    ir /= np.sqrt(np.sum(ir ** 2))
    out = np.zeros_like(x)
    L = len(x) + n
    nfft = 1 << (L - 1).bit_length()
    IR = np.fft.rfft(ir, nfft)
    for ch in range(x.shape[1]):
        wet = np.fft.irfft(np.fft.rfft(x[:, ch], nfft) * IR, nfft)[: len(x)]
        out[:, ch] = x[:, ch] + wet * mix
    return out


# ----------------------------------------------------------------- mix
def build_mix(path):
    fx = np.zeros((N, 2))

    # Scene 1 – storm opening
    place(fx, low_rumble(3.2), 0.0, 0.55)
    place(fx, thunder(4.5, seed=1), 0.33, 0.95, pan=0.25)
    place(fx, thunder(3.5, crack=True, seed=2), 1.83, 0.7, pan=-0.35)
    # lightning-cut into scene 2
    place(fx, thunder(2.5, seed=3), 2.97, 0.6)

    # Scene 2 – the danger
    place(fx, splash(0.9, seed=11), 3.05, 0.7, pan=-0.3)
    place(fx, water_skid(2.4), 3.5, 0.6)
    place(fx, splash(0.8, seed=12), 4.2, 0.55, pan=-0.4)
    for bt in (4.2, 4.6, 5.0, 5.4):
        place(fx, beep(), bt, 0.38)
    place(fx, whoosh(0.32, True), 5.82, 0.6, pan=0.6)   # whip pan

    # Scene 3 – the skid
    place(fx, screech(1.6, 0.5, 1.5), 6.0, 0.42)
    place(fx, splash(1.0, seed=13), 6.2, 0.5, pan=0.3)
    place(fx, glass_crack(), 7.55, 0.85)
    place(fx, glitch(0.5), 7.7, 0.45)

    # Scene 4 – the new tyre
    place(fx, whoosh(0.5, True), 7.95, 0.75)
    place(fx, whoosh(0.4, False), 9.25, 0.55)            # zoom into tread
    place(fx, grip_thud(), 10.4, 0.95)
    place(fx, ding(1568), 10.5, 0.42)
    place(fx, ding(2349, 1.0), 10.58, 0.18)
    place(fx, whoosh(0.3, True), 11.82, 0.6)              # zoom punch

    # Scene 5 – main message
    place(fx, impact_hit(), 12.3, 0.55)
    place(fx, bass_impact(1.6), 12.5, 1.0)
    place(fx, splash(1.4, seed=14), 12.1, 0.3)
    place(fx, whoosh(0.32, False), 13.82, 0.6, pan=-0.6)  # whip pan

    # Scene 6 – brands
    for i, bt in enumerate((14.25, 14.85, 15.45, 16.05)):
        place(fx, impact_hit(), bt, 0.75, pan=(-0.35 if i % 2 == 0 else 0.35))
        place(fx, splash(0.7, seed=20 + i), bt + 0.02, 0.5, pan=(-0.35 if i % 2 == 0 else 0.35))

    # Scene 7 – contact
    place(fx, thunder(3.0, seed=7), 16.97, 0.9)
    place(fx, bass_impact(2.6, 80, 26), 17.25, 1.0)
    place(fx, ding(1568, 1.8), 18.6, 0.4)
    place(fx, ding(2093, 1.4), 18.68, 0.2)

    fx = reverb(fx)
    mix = rain_bed() * 0.5 + fx
    # global fade out of the final thunder tail
    t = np.arange(N) / SR
    mix *= np.interp(t, [0, 19.3, 20], [1, 1, 0])[:, None]
    mix = np.tanh(mix * 1.1)
    mix = mix / np.max(np.abs(mix)) * 0.89
    pcm = (mix * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


if __name__ == "__main__":
    import sys
    build_mix(sys.argv[1] if len(sys.argv) > 1 else "sfx.wav")
