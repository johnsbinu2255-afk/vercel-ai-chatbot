"""Synthesize the RODO ACCESSORIES soundscape (music bed + SFX) and mix in the voice-over.

All sounds are generated procedurally with numpy — no samples or licensed music needed.
Event timings come from web/timeline.json so audio stays locked to the picture.

Usage:  python3 scripts/soundtrack.py            -> audio/mix.wav (48 kHz stereo)
Requires: numpy, soundfile, ffmpeg on PATH (used to deepen + polish the VO).
"""
import json, os, subprocess, tempfile
import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.load(open(os.path.join(ROOT, "web", "timeline.json")))
SR = 48000
DUR = TL["duration"]
N = int(SR * DUR)
rng = np.random.default_rng(7)

music = np.zeros((N, 2))
sfx = np.zeros((N, 2))
verb_send = np.zeros((N, 2))


# ------------------------------------------------------------------ dsp helpers
def tvec(d):
    return np.arange(int(d * SR)) / SR


def fft_filter(x, resp):
    n = len(x)
    X = np.fft.rfft(x, n)
    f = np.fft.rfftfreq(n, 1 / SR)
    return np.fft.irfft(X * resp(f), n)


def lowpass(x, fc, order=4):
    return fft_filter(x, lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order)))


def highpass(x, fc, order=4):
    return fft_filter(x, lambda f: 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** (2 * order)))


def bandpass(x, lo, hi):
    return highpass(lowpass(x, hi), lo)


def sweep_band(x, f0, f1, q=0.35, block=1024):
    """time-varying band-pass via overlapping FFT blocks (for whooshes/risers)."""
    out = np.zeros(len(x) + block)
    win = np.hanning(block)
    hop = block // 4
    nb = max(1, (len(x) - block) // hop + 1)
    f = np.fft.rfftfreq(block, 1 / SR)
    for i in range(nb):
        s = i * hop
        seg = x[s:s + block]
        if len(seg) < block:
            seg = np.pad(seg, (0, block - len(seg)))
        p = i / max(1, nb - 1)
        fc = f0 * (f1 / f0) ** p
        g = np.exp(-0.5 * (np.log(np.maximum(f, 1) / fc) / q) ** 2)
        out[s:s + block] += np.fft.irfft(np.fft.rfft(seg * win) * g, block) * win
    return out[: len(x)] / 1.5


def env_adsr(n, a, d, s_level, r):
    e = np.ones(n) * s_level
    A, D, R = int(a * SR), int(d * SR), int(r * SR)
    A = min(A, n)
    e[:A] = np.linspace(0, 1, A)
    D2 = min(D, n - A)
    e[A:A + D2] = np.linspace(1, s_level, D2)
    if R > 0:
        e[-min(R, n):] *= np.linspace(1, 0, min(R, n))
    return e


def place(buf, sig, t, gain=1.0, pan=0.0, send=0.0):
    i = int(t * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        sig = np.stack([sig * l * 1.414, sig * r * 1.414], 1)
    buf[i:i + len(sig)] += sig * gain
    if send:
        verb_send[i:i + len(sig)] += sig * gain * send


def saw(freq, t, harmonics=12):
    return sum(np.sin(2 * np.pi * freq * k * t) / k for k in range(1, harmonics + 1))


def fftconv(x, h):
    n = len(x) + len(h)
    nf = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, nf) * np.fft.rfft(h, nf), nf)[: len(x)]


# ------------------------------------------------------------------ sound designs
def s_impact(big=1.0):
    t = tvec(2.6)
    f = 32 + 48 * np.exp(-t * 9)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    noise = lowpass(rng.standard_normal(len(t)), 900) * np.exp(-t * 18) * 0.6
    crack = highpass(rng.standard_normal(len(t)), 2500) * np.exp(-t * 40) * 0.25
    return (boom * 1.2 + noise + crack) * big


def s_whoosh(d=0.75, up=True):
    n = rng.standard_normal(int(d * SR))
    w = sweep_band(n, 250, 4500, 0.5) if up else sweep_band(n, 4500, 250, 0.5)
    e = np.sin(np.linspace(0, np.pi, len(w))) ** 2
    return w * e * 2.2


def s_riser(d):
    t = tvec(d)
    n = sweep_band(rng.standard_normal(len(t)), 200, 7000, 0.45)
    tone = np.sin(2 * np.pi * np.cumsum(110 * 2 ** (2.5 * t / d)) / SR) * 0.25
    e = (t / d) ** 2.2
    return (n * 1.8 + tone) * e


def s_tick():
    t = tvec(0.12)
    s = sum(a * np.sin(2 * np.pi * f * t) for f, a in [(2900, 1), (5150, 0.6), (7300, 0.35)])
    return (s * np.exp(-t * 85) + highpass(rng.standard_normal(len(t)), 4000) * np.exp(-t * 300) * 0.4) * 0.5


def s_beep():
    t = tvec(0.45)
    s = np.sin(2 * np.pi * 1318.5 * t) + 0.35 * np.sin(2 * np.pi * 2637 * t) + 0.15 * np.sin(2 * np.pi * 3955 * t)
    return s * np.exp(-t * 9) * np.minimum(1, t * 400) * 0.45


def s_pulse():
    t = tvec(0.6)
    f = 40 + 30 * np.exp(-t * 25)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) * 1.1


def s_scan(d):
    t = tvec(d)
    f = 500 + 1300 * (t / d)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.6 + 0.4 * np.sin(2 * np.pi * 14 * t))
    return s * np.sin(np.pi * t / d) ** 0.5 * 0.12


def s_hiss(d):
    n = bandpass(rng.standard_normal(int(d * SR)), 2500, 9000)
    return n * env_adsr(len(n), 0.05, 0.2, 0.7, 0.4) * 0.35


def s_clunk():
    t = tvec(0.9)
    low = np.sin(2 * np.pi * np.cumsum(55 + 60 * np.exp(-t * 30)) / SR) * np.exp(-t * 10)
    metal = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, a, d in [(420, 0.5, 14), (1130, 0.35, 18), (2210, 0.25, 26), (3480, 0.15, 32)])
    return (low + metal + highpass(rng.standard_normal(len(t)), 1500) * np.exp(-t * 60) * 0.3) * 0.9


def s_whirr(d):
    t = tvec(d)
    spd = np.minimum(1, t / 0.5) * (1 - np.clip((t - d + 0.6) / 0.6, 0, 1) * 0.6)
    f = 30 + 70 * spd
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = sum(np.sin(k * ph) / k for k in range(1, 9))
    s = lowpass(s, 1600) + bandpass(rng.standard_normal(len(t)), 800, 3000) * 0.15
    return s * env_adsr(len(t), 0.2, 0.1, 1, 0.5) * 0.22


def s_shimmer(d):
    out = np.zeros(int(d * SR) + SR)
    for _ in range(int(d * 14)):
        f = rng.uniform(2500, 8000)
        t = tvec(0.5)
        p = np.sin(2 * np.pi * f * t) * np.exp(-t * rng.uniform(8, 20)) * rng.uniform(0.05, 0.14)
        i = int(rng.uniform(0, d) * SR)
        out[i:i + len(p)] += p
    return out


def s_rain(d):
    n = rng.standard_normal(int(d * SR))
    n = highpass(lowpass(n, 9000), 900)
    drops = (rng.random(len(n)) > 0.9993) * rng.uniform(0.2, 1, len(n))
    drops = highpass(np.convolve(drops, np.exp(-np.arange(200) / 25), "same"), 2000)
    return (n * 0.12 + drops * 0.25) * env_adsr(len(n), 1.0, 0.1, 1, 1.2)


def s_engine(d):
    t = tvec(d)
    rpm = 1 + 0.55 * np.exp(-((t - 1.75) / 0.35) ** 2) + 0.15 * np.exp(-((t - 3.7) / 0.3) ** 2)
    f0 = 26 * rpm * (1 + 0.01 * np.sin(2 * np.pi * 0.7 * t))
    ph = 2 * np.pi * np.cumsum(f0) / SR
    body = sum(np.sin(k * ph + rng.uniform(0, 6)) * (1 / k ** 0.8) for k in range(1, 14))
    am = 0.75 + 0.25 * np.sin(ph * 0.5)
    rumble = lowpass(rng.standard_normal(len(t)), 180) * 1.8
    s = lowpass(body * am, 420) + rumble * 0.4
    e = np.minimum(1, t / 1.2) * np.clip((d - t) / 2.5, 0, 1)
    return s * e * 0.35


# ------------------------------------------------------------------ music
BPM = 92
BEAT = 60 / BPM
T0 = 2.0                                   # music downbeat = hook impact
D2, BB1, F2, C2, A1 = 73.42, 58.27, 87.31, 65.41, 55.0
PROG = [D2, BB1, F2, C2]                   # Dm  Bb  F  C
CHORDS = {D2: [293.7, 349.2, 440.0], BB1: [233.1, 293.7, 349.2], F2: [261.6, 349.2, 440.0], C2: [261.6, 329.6, 392.0]}


def bar_root(t):
    k = int(max(0, t - T0) / (4 * BEAT))
    return PROG[k % 4]


def scene_level(t):
    """overall music intensity by scene (0..1)"""
    pts = [(0, 0.0), (1.9, 0.0), (2.0, 0.75), (6.3, 0.75), (6.5, 0.8), (16, 0.85), (26, 0.9), (35.9, 0.9),
           (36.1, 1.0), (48.8, 1.0), (49.0, 0.7), (53.3, 0.7), (53.45, 1.0), (59.0, 0.8), (60, 0.0)]
    xs, ys = zip(*pts)
    return np.interp(t, xs, ys)


tt = np.arange(N) / SR

# drone: low D with fifth, slow swell
drone = (np.sin(2 * np.pi * 36.71 * tt) + 0.5 * np.sin(2 * np.pi * 55.0 * tt + 1) + 0.25 * np.sin(2 * np.pi * 73.42 * tt * 1.002))
drone *= np.clip(tt / 2.0, 0, 1) * (0.55 + 0.15 * np.sin(2 * np.pi * 0.11 * tt))
music += np.stack([drone, drone], 1) * 0.22

# pulse bass (8ths) from the hook impact to the brand reveal tail
k = 0
while True:
    t0 = T0 + k * BEAT / 2
    if t0 > 58.5:
        break
    k += 1
    if 52.7 < t0 < 53.45 or 35.6 < t0 < 36.05:
        continue                            # breaths before big moments
    root = bar_root(t0)
    n = int(BEAT / 2 * SR)
    tb = np.arange(n) / SR
    note = saw(root, tb, 10)
    note = lowpass(note, 260 + 900 * scene_level(t0) * (1.4 if 36 < t0 < 49 else 1.0)) * np.exp(-tb * 6.5)
    place(music, note, t0, 0.22 * scene_level(t0) * (1.0 if k % 2 else 0.8))

# pads per bar
for b in range(int((DUR - T0) / (4 * BEAT)) + 1):
    t0 = 6.4 + b * 4 * BEAT
    if t0 > 58:
        break
    root = bar_root(t0)
    d = 4 * BEAT + 0.6
    tp = tvec(d)
    pad = np.zeros(len(tp))
    bright = 36 < t0 < 49
    for f in CHORDS[root] + ([CHORDS[root][0] * 2] if bright else []):
        for det in (-0.12, 0.0, 0.13):
            pad += saw(f * 2 ** (det / 12), tp, 6)
    pad = lowpass(pad, 1700 if bright else 900) * env_adsr(len(tp), 1.1, 0.5, 0.85, 1.0)
    L = pad * (1 + 0.1 * np.sin(2 * np.pi * 0.3 * tp)); R = pad * (1 - 0.1 * np.sin(2 * np.pi * 0.3 * tp))
    place(music, np.stack([L, R], 1), t0, 0.03 * scene_level(t0), send=0.4)

# percussion grid: kick on 1 & 3, hats on 8ths (scenes 2-5), claps on 2 & 4 in the bright section
for k in range(int((49 - 6.4) / (BEAT / 2)) + 1):
    t0 = 6.4 + k * BEAT / 2
    if t0 >= 48.8 or 35.6 < t0 < 36.05:
        continue
    beat = k // 2
    if k % 2 == 0 and beat % 2 == 0:
        tk = tvec(0.4)
        kick = np.sin(2 * np.pi * np.cumsum(45 + 90 * np.exp(-tk * 35)) / SR) * np.exp(-tk * 9)
        place(music, kick, t0, 0.5)
    hat = highpass(rng.standard_normal(int(0.06 * SR)), 7000) * np.exp(-np.arange(int(0.06 * SR)) / SR * 70)
    place(music, hat, t0, (0.05 if k % 2 else 0.08) * (1.3 if t0 > 36 else 1.0), pan=0.25 if k % 2 else -0.15)
    if t0 > 36 and k % 2 == 0 and beat % 2 == 1:
        cl = bandpass(rng.standard_normal(int(0.25 * SR)), 900, 5000) * np.exp(-np.arange(int(0.25 * SR)) / SR * 22)
        place(music, cl, t0, 0.14, send=0.5)

# final resolve chord (D major lift) under the brand reveal
tp = tvec(DUR - 53.45)
chord = sum(saw(f, tp, 6) for f in [146.8, 220.0, 293.7, 370.0, 440.0])
chord = lowpass(chord, 1400) * env_adsr(len(tp), 0.6, 1.0, 0.7, 2.5)
place(music, chord, 53.45, 0.035, send=0.6)

# ------------------------------------------------------------------ SFX placement
S = TL["sfx"]
for a, b in S["engine"]:
    place(sfx, s_engine(b - a), a, 0.6)
for t0 in S["beep"]:
    place(sfx, s_beep(), t0, 0.7, send=0.5)
for a, b in S["riser"]:
    place(sfx, s_riser(b - a), a, 0.55, send=0.3)
for i, t0 in enumerate(S["whoosh"]):
    w = s_whoosh(0.75, up=i % 2 == 0)
    place(sfx, np.stack([w * (1 - 0.3 * (i % 2)), w * (0.7 + 0.3 * (i % 2))], 1), t0 - 0.35, 0.6, send=0.2)
for i, t0 in enumerate(S["impact"]):
    place(sfx, s_impact(1.25 if t0 > 50 else 1.0), t0, 0.95, send=0.35)
for t0 in S["tick"]:
    place(sfx, s_tick(), t0, 0.5, pan=0.2, send=0.2)
for a, b in S["scan"]:
    place(sfx, s_scan(b - a), a, 1.0, send=0.3)
for t0 in S["pulse"]:
    place(sfx, s_pulse(), t0, 0.75)
for a, b in S["hiss"]:
    place(sfx, s_hiss(b - a), a, 0.6, pan=0.3)
for t0 in S["clunk"]:
    place(sfx, s_clunk(), t0, 0.8, send=0.25)
for a, b in S["whirr"]:
    place(sfx, s_whirr(b - a), a, 1.0)
for a, b in S["shimmer"]:
    sh = s_shimmer(b - a)
    place(sfx, np.stack([sh, np.roll(sh, 900)], 1), a, 1.0, send=0.8)
for a, b in S["rain"]:
    r = s_rain(b - a)
    place(sfx, np.stack([r, np.roll(r, 2400)], 1), a, 0.5)
for t0 in S["final"]:
    place(sfx, s_impact(0.5), t0, 0.5, send=0.6)

# ------------------------------------------------------------------ reverb (one shared hall)
ir_t = tvec(2.8)
ir = rng.standard_normal((len(ir_t), 2)) * np.exp(-ir_t * 2.6)[:, None]
ir[:, 0] = lowpass(ir[:, 0], 6000); ir[:, 1] = lowpass(ir[:, 1], 6000)
ir /= np.sqrt((ir ** 2).sum(0))
verb = np.stack([fftconv(verb_send[:, c], ir[:, c]) for c in range(2)], 1) * 0.6

# ------------------------------------------------------------------ voice-over: deepen + polish via ffmpeg
vo = np.zeros((N, 2))
vo_env = np.zeros(N)
with tempfile.TemporaryDirectory() as tmp:
    for key, t0 in TL["voiceover"].items():
        src = os.path.join(ROOT, "audio", f"{TL.get('vo_prefix', 'vo_')}{key}.wav")
        dst = os.path.join(tmp, f"{key}.wav")
        # ~1 semitone lower with duration preserved, low-mid warmth, presence, gentle compression
        src_sr = sf.info(src).samplerate
        # voice character from timeline.json: pitch shift (semitones) + low-shelf bass boost (dB)
        r = 2 ** (TL.get("vo_pitch_semitones", -1.0) / 12)
        bass = TL.get("vo_bass_db", 3)
        af = (f"asetrate={src_sr}*{r:.5f},aresample=48000,atempo={1 / r:.5f},"
              f"highpass=f=55,lowshelf=f=150:g={bass},equalizer=f=320:t=q:w=1:g=-2,equalizer=f=3000:t=q:w=1.2:g=2,"
              "acompressor=threshold=-22dB:ratio=3.5:attack=5:release=150:makeup=3")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-af", af, "-ac", "1", "-ar", str(SR), dst], check=True)
        x, _ = sf.read(dst)
        x = x / (np.abs(x).max() + 1e-9) * 0.9 * 10 ** (TL.get("vo_gain_db", 0) / 20)
        i = int(t0 * SR)
        x = x[: N - i]
        vo[i:i + len(x)] += np.stack([x, x], 1)
        vo_env[i:i + len(x)] = 1.0

# a little room on the voice
vo_verb = np.stack([fftconv(vo[:, c], ir[:, c]) for c in range(2)], 1) * 0.05

# sidechain ducking of the music bed under the voice
k = int(0.25 * SR)
duck = np.convolve(vo_env, np.ones(k) / k, "same")
music *= (1 - 0.6 * np.clip(duck, 0, 1))[:, None]
sfx *= (1 - 0.25 * np.clip(duck, 0, 1))[:, None]

bed = music * 0.45 + sfx * 1.0 + verb * 0.6
voice = vo * 1.0 + vo_verb
on = vo_env > 0
rms = lambda a: 20 * np.log10(np.sqrt((a[on] ** 2).mean()) + 1e-9)
print(f"under VO: voice {rms(voice):.1f} dB, bed {rms(bed):.1f} dB")
mix = bed + voice
# fade tail, soft clip, normalise
mix *= np.clip((DUR - np.arange(N) / SR) / 0.8, 0, 1)[:, None]
mix = np.tanh(mix / (np.abs(mix).max() + 1e-9) * 1.6) / np.tanh(1.6) * 0.95
sf.write(os.path.join(ROOT, "audio", "mix.wav"), mix.astype(np.float32), SR, subtype="PCM_24")
# stems for re-editing in a DAW / NLE
peak = np.abs(bed + voice).max() + 1e-9
sf.write(os.path.join(ROOT, "audio", "stem_music_sfx.wav"), (bed / peak * 0.95).astype(np.float32), SR, subtype="PCM_24")
sf.write(os.path.join(ROOT, "audio", "stem_voiceover.wav"), (voice / peak * 0.95).astype(np.float32), SR, subtype="PCM_24")
print("wrote audio/mix.wav", mix.shape)
