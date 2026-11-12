#!/usr/bin/env python3
"""Builds the 40 s soundtrack: dialogue, music bed, sound design and logo sting.

Everything is synthesized here (no samples, no licences to clear).

  python3 scripts/build_audio.py motion   # all-motion-graphics cut (default)
  python3 scripts/build_audio.py live     # cut with live-action car scenes: adds road/cabin
                                          # ambience and plays the music "through the car stereo"

Outputs audio/mix_<mode>.wav and audio/stems_<mode>/{dialogue,music,sfx}.wav (48 kHz stereo).
Needs: numpy scipy soundfile, and audio/vo_raw/*.wav from scripts/tts.py
"""
import json, os, sys
import numpy as np, soundfile as sf
from scipy import signal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.load(open(os.path.join(ROOT, "timeline.json")))
SR = 48000
DUR = TL["duration"]
N = int(SR * DUR)
MODE = sys.argv[1] if len(sys.argv) > 1 else "motion"
LIVE = MODE == "live"
BPM = 96.0
BEAT = 60.0 / BPM          # 0.625 s
BAR = 4 * BEAT             # 2.5 s  -> 16 bars = 40 s
rs = np.random.RandomState(7)


# ----------------------------------------------------------------- helpers
def db(x): return 10 ** (x / 20.0)
def midi(m): return 440.0 * 2 ** ((m - 69) / 12.0)
def stereo(x): return np.stack([x, x], axis=1) if x.ndim == 1 else x
def tr(): return np.zeros((N, 2))

def put(track, x, start, gain=1.0, pan=0.0):
    """Add mono/stereo buffer x at time start (s). pan -1..1 (equal power)."""
    i = int(round(start * SR))
    if i >= N: return
    x = stereo(x)
    if pan:
        a = (pan + 1) * np.pi / 4
        x = x * np.array([np.cos(a), np.sin(a)]) * np.sqrt(2)
    if i < 0: x = x[-i:]; i = 0
    n = min(len(x), N - i)
    track[i:i + n] += x[:n] * gain

def butter(x, kind, fc, order=2):
    sos = signal.butter(order, fc, kind, fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=0)

def peaking(x, f0, gain_db, q=1.0):
    a = 10 ** (gain_db / 40); w = 2 * np.pi * f0 / SR; al = np.sin(w) / (2 * q)
    b = [1 + al * a, -2 * np.cos(w), 1 - al * a]; aa = [1 + al / a, -2 * np.cos(w), 1 - al / a]
    return signal.lfilter(np.array(b) / aa[0], np.array(aa) / aa[0], x, axis=0)

def adsr(n, a, d, s, r):
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    e = np.full(n, s, dtype=float)
    a = min(a, n); e[:a] = np.linspace(0, 1, a, endpoint=False)
    d2 = min(d, max(0, n - a)); e[a:a + d2] = np.linspace(1, s, d2, endpoint=False)
    r = min(r, n); e[n - r:] *= np.linspace(1, 0, r)
    return e

def saw(f, n, detune=0.0, phase=0.0):
    """Band-limited saw (additive)."""
    t = np.arange(n) / SR
    f = f * 2 ** (detune / 1200.0)
    out = np.zeros(n)
    for k in range(1, int(min(28, 0.45 * SR / f)) + 1):
        out += np.sin(2 * np.pi * k * f * t + phase * k) / k * (1 if k % 2 else -1)
    return out * (2 / np.pi)

def noise(n): return rs.randn(n)

def sweep_filter(x, f_start, f_end, kind="lowpass", q=0.9):
    """Time-varying 2-pole filter (state-variable), exponential sweep."""
    n = len(x); out = np.zeros(n); lp = bp = 0.0
    fs = np.geomspace(f_start, f_end, n)
    for i in range(n):
        f = 2 * np.sin(np.pi * min(fs[i], SR * 0.22) / SR)
        hp = x[i] - lp - q * bp
        bp += f * hp; lp += f * bp
        out[i] = lp if kind == "lowpass" else bp if kind == "bandpass" else hp
    return out

def make_ir(seconds, decay, lp=7000, seed=1):
    r = np.random.RandomState(seed); n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = np.stack([r.randn(n), r.randn(n)], axis=1) * np.exp(-t / decay)[:, None]
    ir = butter(ir, "lowpass", lp); ir[: int(0.004 * SR)] *= 0.2
    return ir / np.sqrt((ir ** 2).sum(axis=0)).max()

def reverb(x, ir, wet=0.2):
    x = stereo(x)
    w = np.stack([signal.fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], axis=1)
    return x + w * wet

HALL = make_ir(2.6, 0.55, 6500, 3)
PLATE = make_ir(1.2, 0.22, 8000, 5)
CABIN = make_ir(0.22, 0.045, 5200, 9)


# ----------------------------------------------------------------- dialogue
def tighten(a, sr, cap_short=0.12, cap_long=0.22, long_thr=0.30, thr_db=-38, minlen=0.09):
    """Shorten long pauses so the lines fit their slots without sounding sped-up."""
    hop, w = int(0.005 * sr), int(0.02 * sr)
    n = (len(a) - w) // hop
    rms = np.array([np.sqrt(np.mean(a[i * hop:i * hop + w] ** 2) + 1e-12) for i in range(n)])
    quiet = 20 * np.log10(rms / (rms.max() + 1e-9)) < thr_db
    gaps, i = [], 0
    while i < n:
        if quiet[i]:
            j = i
            while j < n and quiet[j]: j += 1
            if (j - i) * hop / sr >= minlen: gaps.append((i * hop / sr, (j * hop + w) / sr))
            i = j
        else: i += 1
    keep, pos = [], 0
    for s, e in gaps:
        d = e - s; cap = cap_long if d >= long_thr else cap_short
        if d > cap:
            cs = int((s + cap / 2) * sr); ce = int((s + cap / 2 + d - cap) * sr)
            keep.append(a[pos:cs]); pos = ce
    keep.append(a[pos:])
    xf = int(0.006 * sr); out = keep[0]
    for seg in keep[1:]:
        ww = np.linspace(0, 1, xf)
        out = np.concatenate([out[:-xf], out[-xf:] * (1 - ww) + seg[:xf] * ww, seg[xf:]])
    return out

def compress(x, thr_db=-22, ratio=3.0, att=0.004, rel=0.09):
    env = np.zeros(len(x)); e = 0.0
    ca, cr = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR))
    ax = np.abs(x)
    for i in range(len(x)):
        c = ca if ax[i] > e else cr
        e = c * e + (1 - c) * ax[i]; env[i] = e
    lvl = 20 * np.log10(env + 1e-9)
    gr = np.where(lvl > thr_db, (thr_db - lvl) * (1 - 1 / ratio), 0.0)
    return x * db(gr)

def build_dialogue():
    track = tr(); spans = []
    for line in TL["dialogue"]:
        a, sr = sf.read(os.path.join(ROOT, "audio", "vo_raw", f"{line['id']}.wav"))
        a = tighten(a, sr)
        a = signal.resample_poly(a, SR, sr)
        a = butter(a, "highpass", 75)
        a = peaking(a, 220, -1.5, 1.0); a = peaking(a, 3800, 2.5, 0.9); a = peaking(a, 9500, 1.0, 0.7)
        a = compress(a)
        a = a / (np.sqrt(np.mean(a ** 2)) + 1e-9) * db(-19.5)
        a[: int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR)); a[-int(0.03 * SR):] *= np.linspace(1, 0, int(0.03 * SR))
        dur = len(a) / SR
        pad = np.concatenate([a, np.zeros(int(0.8 * SR))])
        if line["in_car"] and LIVE:
            # sitting in the cabin: short reflections, slightly softer top end; driver left, passenger right
            x = reverb(butter(pad, "lowpass", 9500), CABIN, 0.5)
            put(track, x, line["start"], db(-2.5), pan=0.18 if line["speaker"] == "passenger" else -0.18)
        else:
            put(track, reverb(pad, PLATE, 0.06), line["start"], 1.0)
        spans.append((line["id"], line["start"], line["start"] + dur))
        print(f"  {line['id']}: {line['start']:.2f} -> {line['start'] + dur:.2f}  ({dur:.2f}s)")
    return track, spans


# ----------------------------------------------------------------- music
CHORDS = {  # pad voicing, bass note, arp tones
    "Dm": ([50, 57, 62, 65, 69], 38, [62, 65, 69, 74, 77]),
    "Bb": ([46, 53, 58, 62, 65], 34, [58, 62, 65, 70, 74]),
    "F":  ([53, 57, 60, 65, 69], 41, [60, 65, 69, 72, 77]),
    "C":  ([48, 55, 60, 64, 67], 36, [60, 64, 67, 72, 76]),
    "D2": ([50, 57, 62, 64, 69], 38, [62, 64, 69, 74, 76]),   # Dsus2 - open, modern resolve
}
PROG = ["Dm", "Bb", "F", "C"] * 3 + ["Dm", "Bb", "C", "D2"]
ARP = [0, 2, 1, 2, 3, 2, 1, 2, 0, 2, 1, 2, 3, 2, 4, 2]

def kick():
    n = int(0.32 * SR); t = np.arange(n) / SR
    f = 46 + 95 * np.exp(-t / 0.035)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.11)
    x += butter(noise(n), "highpass", 3000) * np.exp(-t / 0.004) * 0.25
    return np.tanh(x * 1.6) * 0.9

def hat(open_=False):
    n = int((0.16 if open_ else 0.05) * SR); t = np.arange(n) / SR
    return butter(noise(n), "highpass", 7500, 4) * np.exp(-t / (0.05 if open_ else 0.012))

def clap():
    n = int(0.22 * SR); t = np.arange(n) / SR
    e = sum(np.exp(-np.maximum(t - d, 0) / 0.012) * (t >= d) for d in (0.0, 0.011, 0.023)) + np.exp(-t / 0.07) * 0.6
    return butter(butter(noise(n), "highpass", 900), "lowpass", 5500) * e * 0.5

def pad_note(m, n, bright):
    x = sum(saw(midi(m), n, dt, ph) for dt, ph in ((-9, 0.0), (0, 1.3), (8, 2.1))) / 3
    return butter(x, "lowpass", bright, 2) * adsr(n, 0.5, 0.4, 0.85, 0.9)

def pluck(m, n, cutoff=2600):
    t = np.arange(n) / SR
    x = (saw(midi(m), n, -5) + saw(midi(m), n, 6, 0.7)) * 0.5
    x = sweep_filter(x, cutoff * 2.2, cutoff * 0.35)
    return x * np.exp(-t / 0.16) * adsr(n, 0.003, 0.05, 1.0, 0.02)

def bass_note(m, n):
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * midi(m) * t) * 0.9 + butter(saw(midi(m + 12), n), "lowpass", 420) * 0.35
    return np.tanh(x * 1.4) * adsr(n, 0.008, 0.12, 0.7, 0.05)

def bell(m, n):
    t = np.arange(n) / SR; f = midi(m)
    x = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / d) for r, a, d in ((1, 1.0, 0.9), (2.76, 0.45, 0.35), (5.4, 0.22, 0.16), (8.9, 0.1, 0.08)))
    return x * adsr(n, 0.002, 0.1, 1.0, 0.1)

def build_music():
    pad, arp, bass, drums, lead = tr(), tr(), tr(), tr(), tr()
    kicks = []
    for b, name in enumerate(PROG):
        t0 = b * BAR
        voicing, root, tones = CHORDS[name]
        full = 6 <= b < 15          # the 3D explainer (bars 7-15) carries the full groove
        car = 2 <= b < 6            # bars 3-6: "music playing in the car"
        # pad
        n = int((BAR + 0.9) * SR)
        bright = 900 if b < 2 else 1500 if car else 2100
        for i, m in enumerate(voicing):
            put(pad, pad_note(m, n, bright), t0, 0.16, pan=(-0.5, 0.4, -0.2, 0.5, 0.1)[i])
        if b == 15: continue  # final bar is handled by the sting
        # bass: 8th-note pulse
        for s in range(8):
            if b < 2 and s % 2: continue
            put(bass, bass_note(root + 12 if (s % 4 == 3 and full) else root, int(BEAT * 0.5 * 0.92 * SR)), t0 + s * BEAT / 2, 0.34 if full else 0.24)
        # arp: 16ths (sparser before the groove comes in)
        for s in range(16):
            if b < 2 and s % 4: continue
            if car and s % 2: continue
            vel = (1.0, 0.55, 0.75, 0.55)[s % 4]
            put(arp, pluck(tones[ARP[s]], int(0.3 * SR), 2400 if full else 1700), t0 + s * BEAT / 4, 0.2 * vel, pan=0.55 if s % 2 else -0.55)
        # drums
        if b >= 2:
            for q in range(4):
                tk = t0 + q * BEAT
                put(drums, kick(), tk, 0.85 if full else 0.6); kicks.append(tk)
                put(drums, hat(), tk + BEAT / 2, 0.16 if full else 0.1, pan=0.25)
                if full:
                    put(drums, hat(), tk + BEAT / 4, 0.06, pan=-0.3); put(drums, hat(), tk + 3 * BEAT / 4, 0.07, pan=-0.3)
                    if q in (1, 3): put(drums, clap(), tk, 0.4)
            if full and b % 2 == 1: put(drums, hat(True), t0 + 3.5 * BEAT, 0.12, pan=0.2)
    # sidechain pump on pad/bass/arp
    pump = np.ones(N)
    for tk in kicks:
        i = int(tk * SR); n = min(int(0.3 * SR), N - i)
        pump[i:i + n] = np.minimum(pump[i:i + n], 1 - 0.55 * np.exp(-np.arange(n) / SR / 0.09))
    pad *= pump[:, None]; bass *= pump[:, None]; arp *= (0.5 + 0.5 * pump)[:, None]
    arp = arp + reverb(arp, HALL, 1.0) * 0.22
    # ping-pong delay on the arp
    d = int(BEAT * 0.75 * SR); dl = np.zeros_like(arp)
    dl[d:, 0] += arp[:-d, 1] * 0.32; dl[2 * d:, 1] += arp[:-2 * d, 0] * 0.18
    arp += dl
    music = reverb(pad, HALL, 0.35) + bass + arp + drums
    return music


def build_sting(t0=37.5):
    """Logo sting: impact + open Dsus2 chord + rising three-note bell motif."""
    s = tr()
    n = int(2.6 * SR); t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-t / 0.05)) / SR) * np.exp(-t / 0.5)
    put(s, np.tanh(boom * 1.5), t0, 0.75)
    put(s, butter(noise(n), "lowpass", 2500) * np.exp(-t / 0.18), t0, 0.22)
    for i, m in enumerate([38, 50, 57, 62, 64, 69, 74]):
        x = sum(saw(midi(m), n, dt, ph) for dt, ph in ((-8, 0.0), (0, 1.1), (9, 2.3))) / 3
        x = sweep_filter(x, 5200, 900) * adsr(n, 0.012, 0.5, 0.55, 1.6)
        put(s, x, t0, 0.13, pan=(0, -0.5, 0.5, -0.3, 0.3, -0.6, 0.6)[i])
    for i, (m, dt) in enumerate([(81, 0.0), (86, 0.21), (93, 0.42)]):   # A5 - D6 - A6
        put(s, bell(m, int(2.2 * SR)), t0 + dt, 0.2, pan=(-0.3, 0.3, 0.0)[i])
    # shimmer tail
    sh = butter(noise(n), "highpass", 6000) * np.exp(-((t - 0.25) / 0.5) ** 2) * 0.05
    put(s, sh, t0, 1.0)
    return reverb(s, HALL, 0.55)


# ----------------------------------------------------------------- sound design
def whoosh(dur, f0, f1, peak=0.55):
    n = int(dur * SR); t = np.arange(n) / n
    x = sweep_filter(noise(n), f0, f1, "bandpass", q=0.6)
    e = np.where(t < peak, (t / peak) ** 2.2, ((1 - t) / (1 - peak)) ** 1.5)
    return x * e

def riser(dur, f0=200, f1=6000):
    n = int(dur * SR); t = np.arange(n) / n
    x = sweep_filter(noise(n), f0, f1, "bandpass", q=0.35) * t ** 2.5
    tone = np.sin(2 * np.pi * np.cumsum(np.geomspace(180, 720, n)) / SR) * t ** 3 * 0.12
    return x + tone

def impact(dur=1.6):
    n = int(dur * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * np.cumsum(40 + 70 * np.exp(-t / 0.04)) / SR) * np.exp(-t / 0.32)
    return np.tanh(x * 1.6) + butter(noise(n), "lowpass", 1800) * np.exp(-t / 0.09) * 0.3

def tick(f=2100):
    n = int(0.09 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 1.5 * t)) * np.exp(-t / 0.018)

def clunk():
    n = int(0.3 * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * np.cumsum(70 + 110 * np.exp(-t / 0.02)) / SR) * np.exp(-t / 0.06)
    return x + butter(noise(n), "bandpass", [1500, 4500]) * np.exp(-t / 0.008) * 0.5

def build_sfx():
    s = tr()
    if LIVE:
        # scene 1: open road - wind/road bed and the car passing the camera
        n = int(5.3 * SR); t = np.arange(n) / SR
        road = butter(noise(n), "lowpass", 500) * 0.5 + butter(noise(n), "bandpass", [900, 3200]) * 0.08
        road *= (0.45 + 0.55 * np.exp(-((t - 3.1) / 1.1) ** 2)) * np.minimum(1, t / 0.6) * np.clip((5.3 - t) / 0.35, 0, 1)
        put(s, road, 0.0, 0.2)
        f = 150 - 38 / (1 + np.exp(-(t - 3.1) / 0.18))            # doppler-ish pitch drop as it passes
        eng = butter(np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.5 * np.sin(4 * np.pi * np.cumsum(f) / SR), "lowpass", 700)
        put(s, eng * np.exp(-((t - 3.1) / 0.9) ** 2), 0.0, 0.1)
        put(s, whoosh(1.6, 300, 2600, 0.6), 2.3, 0.3, pan=-0.3)
        # into the cabin
        put(s, whoosh(0.9, 500, 5000, 0.7), 4.45, 0.4)
        n = int(10.4 * SR); t = np.arange(n) / SR
        cab = butter(noise(n), "lowpass", 170) * np.minimum(1, t / 0.4) * np.clip((10.4 - t) / 0.6, 0, 1)
        put(s, cab, 4.95, 0.3)
    else:
        # motion-graphics open: macro shot, reveal, question and answer beats
        put(s, riser(2.3, 150, 3000), 0.2, 0.2); put(s, impact(1.4), 2.5, 0.5); put(s, whoosh(0.7, 3500, 500, 0.3), 2.3, 0.3)
        put(s, whoosh(0.6, 600, 3000, 0.6), 5.0, 0.2); put(s, tick(1800), 6.1, 0.1)
        put(s, tick(2400), 7.5, 0.08, pan=-0.5); put(s, tick(2400), 8.8, 0.08, pan=0.5)
        put(s, whoosh(0.5, 600, 3000, 0.6), 10.0, 0.16); put(s, tick(1800), 11.0, 0.1); put(s, tick(1800), 12.35, 0.1); put(s, tick(1800), 13.2, 0.1)
    # hand-over into the 3D world
    put(s, riser(2.1), 12.9, 0.3)
    put(s, impact(), 15.0, 0.6); put(s, whoosh(0.8, 4000, 400, 0.25), 14.75, 0.3)
    # scene 4 moves
    put(s, whoosh(0.8, 500, 3200, 0.6), 15.85, 0.16, pan=-0.2); put(s, whoosh(0.7, 3000, 500, 0.4), 17.0, 0.14, pan=0.2)
    put(s, whoosh(1.0, 900, 300, 0.5), 18.75, 0.14)
    for tt, p in ((16.0, -0.2), (17.4, -0.2), (20.55, -0.2), (24.75, -0.2), (27.1, -0.2), (28.55, -0.2)):
        put(s, tick(), tt, 0.1, pan=p)
    for tt in (16.05, 16.35, 17.35, 19.95, 20.25):
        put(s, tick(3100), tt, 0.045, pan=0.3)
    # coaxial
    put(s, whoosh(0.95, 400, 4200, 0.55), 23.3, 0.4)
    put(s, impact(1.0), 24.1, 0.3)
    put(s, tick(1400), 25.5, 0.14); put(s, whoosh(0.5, 2500, 6000, 0.7), 25.1, 0.1)
    put(s, whoosh(2.0, 500, 1800, 0.5), 26.45, 0.16)
    put(s, whoosh(0.7, 600, 2500, 0.6), 28.3, 0.2, pan=0.4); put(s, whoosh(0.6, 1500, 400, 0.6), 29.0, 0.16)
    put(s, clunk(), 29.58, 0.5)
    # split screen
    put(s, whoosh(0.9, 500, 4500, 0.55), 30.3, 0.36); put(s, impact(1.0), 31.05, 0.3)
    for tt, p in ((31.35, 0.0), (31.9, 0.0)): put(s, tick(1800), tt, 0.09, pan=p)
    put(s, tick(2400), 32.4, 0.08, pan=-0.5); put(s, tick(2400), 34.0, 0.08, pan=0.5)
    # back to the car (live cut only), then the logo
    if LIVE:
        put(s, whoosh(0.55, 3500, 500, 0.3), 35.55, 0.3)
        n = int(1.7 * SR); t = np.arange(n) / SR
        put(s, butter(noise(n), "lowpass", 170) * np.minimum(1, t / 0.2) * np.clip((1.7 - t) / 0.3, 0, 1), 35.9, 0.3)
    put(s, riser(0.75, 400, 7000), 36.78, 0.28)
    return reverb(s, HALL, 0.12)


# ----------------------------------------------------------------- mix
def fade_curve(points):
    """Piecewise-linear automation: [(time, value), ...] -> array of N samples."""
    ts, vs = zip(*points)
    return np.interp(np.arange(N) / SR, ts, vs)

def main():
    print("dialogue"); dialogue, spans = build_dialogue()
    print("music"); music = build_music()
    print("sting"); sting = build_sting()
    print("sfx"); sfx = build_sfx()

    if LIVE:
        # "music from the car stereo" while we are in the cabin: band-limited, narrower, with cabin reflections
        carmix = fade_curve([(0, 0), (4.8, 0), (5.1, 1), (14.7, 1), (15.0, 0), (35.75, 0), (36.0, 1), (37.3, 1), (37.5, 0), (40, 0)])
        car = butter(butter(music, "highpass", 140), "lowpass", 4200)
        car = (car + car[:, ::-1] * 0.6) / 1.6
        car = reverb(car, CABIN, 0.6) * 1.5
        music = music * (1 - carmix)[:, None] + car * carmix[:, None]
        level = fade_curve([(0, 0.0), (0.6, 0.6), (4.6, 0.85), (5.2, 0.7), (14.6, 0.7), (15.0, 1.0), (35.7, 1.0), (36.0, 0.75), (37.3, 0.7), (37.5, 0.0), (40, 0.0)])
    else:
        level = fade_curve([(0, 0.0), (0.5, 0.75), (2.5, 1.0), (14.6, 0.9), (15.0, 1.0), (37.3, 1.0), (37.5, 0.0), (40, 0.0)])
    music *= level[:, None]
    # duck music under speech (envelope follower on the dialogue stem)
    env = np.abs(dialogue).max(axis=1)
    env = signal.sosfilt(signal.butter(1, 6, "lowpass", fs=SR, output="sos"), env)
    env = np.maximum.reduce([env, np.roll(env, -int(0.08 * SR))])
    duck = 1 - 0.7 * np.clip(env / db(-30), 0, 1)
    duck = signal.sosfiltfilt(signal.butter(1, 5, "lowpass", fs=SR, output="sos"), duck)
    music *= duck[:, None]; sfx *= (0.75 + 0.25 * duck)[:, None]

    stems = {"dialogue": dialogue * db(1.5), "music": (music * db(-7.5) + sting * db(-5.0)), "sfx": sfx * db(-4.0)}
    mix = sum(stems.values())
    # final fade (let the sting ring out to the last frame) + safety limiter
    mix *= fade_curve([(0, 1), (39.2, 1), (39.97, 0.0), (40, 0)])[:, None]
    mix = butter(mix, "highpass", 28)
    peak = np.abs(mix).max(); print(f"  raw peak {20 * np.log10(peak):.1f} dBFS")
    mix = np.tanh(mix * 1.25) / np.tanh(1.25) * db(-1.0) if peak > 0.5 else mix
    mix = mix / max(1e-9, np.abs(mix).max()) * db(-1.0)

    out = os.path.join(ROOT, "audio"); os.makedirs(os.path.join(out, f"stems_{MODE}"), exist_ok=True)
    for k, v in stems.items():
        sf.write(os.path.join(out, f"stems_{MODE}", f"{k}.wav"), np.clip(v, -1, 1), SR, subtype="PCM_16")
    sf.write(os.path.join(out, f"mix_{MODE}.wav"), mix, SR, subtype="PCM_16")
    json.dump([{"id": i, "start": round(a, 3), "end": round(b, 3)} for i, a, b in spans], open(os.path.join(out, "dialogue_spans.json"), "w"), indent=1)
    print(f"wrote audio/mix_{MODE}.wav")

if __name__ == "__main__":
    main()
