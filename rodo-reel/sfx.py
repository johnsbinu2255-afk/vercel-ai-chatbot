"""Synthesised sound design + music bed for the RODO reel (30 s, 48 kHz stereo)."""
import numpy as np, wave, sys
SR = 48000; DUR = 30.0; N = int(SR * DUR)
rng = np.random.default_rng(7)
L = np.zeros(N); R = np.zeros(N)

def t_(d): return np.arange(int(d * SR)) / SR
def add(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR); j = min(N, i + len(sig)); sig = sig[:j - i] * gain
    L[i:j] += sig * np.sqrt((1 - pan) / 2) * 1.414; R[i:j] += sig * np.sqrt((1 + pan) / 2) * 1.414
def lp(x, a):  # one-pole low-pass, a in (0,1) (smaller = darker); a may be an array
    y = np.empty_like(x); s = 0.0; a = np.broadcast_to(a, x.shape)
    for k in range(len(x)): s += a[k] * (x[k] - s); y[k] = s
    return y
def env(n, att, rel):
    e = np.ones(n); a = int(att * SR); r = int(rel * SR)
    if a: e[:a] = np.linspace(0, 1, a)
    if r: e[-r:] *= np.linspace(1, 0, r) ** 2
    return e

def impact(d=1.6, f0=70):
    t = t_(d); f = f0 * np.exp(-t * 3) + 32
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.6)
    click = rng.standard_normal(len(t)) * np.exp(-t * 60) * .5
    tail = lp(rng.standard_normal(len(t)), .02) * np.exp(-t * 2) * 2
    return np.tanh((body * 1.2 + click + tail) * 1.4)
def whoosh(d=.6, up=True):
    t = t_(d); n = rng.standard_normal(len(t))
    k = t / d; shape = np.sin(np.pi * (k if up else 1 - k) ** .7) ** 2
    a = .02 + .25 * shape
    return lp(n, a) * shape * 2.2
def riser(d=.8):
    t = t_(d); k = t / d; n = rng.standard_normal(len(t))
    return lp(n, .01 + .3 * k ** 2) * k ** 2 * 1.6 + np.sin(2 * np.pi * np.cumsum(200 + 1400 * k ** 2) / SR) * k ** 3 * .15
def beep(d=.12, f=1050):
    t = t_(d); return (np.sign(np.sin(2 * np.pi * f * t)) * .3 + np.sin(2 * np.pi * f * t) * .5) * env(len(t), .005, .04)
def laser(d=.9, f0=2400, f1=500):
    t = t_(d); f = np.geomspace(f0, f1, len(t))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * .4 + np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * .15
    return s * (0.6 + .4 * np.sin(2 * np.pi * 38 * t)) * env(len(t), .02, .3)
def engine(d=2.6):
    t = t_(d); k = t / d
    rpm = 38 + 70 * np.clip((k - .15) / .45, 0, 1) ** 1.5 * (1 - .35 * np.clip((k - .7) / .3, 0, 1))
    ph = 2 * np.pi * np.cumsum(rpm) / SR
    s = sum(np.sin(ph * h + h) / h ** .8 for h in range(1, 9)) + lp(rng.standard_normal(len(t)), .05) * .6
    return np.tanh(s * 1.3) * env(len(t), .15, .6) * .7
def click():
    t = t_(.08); return rng.standard_normal(len(t)) * np.exp(-t * 120) + np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 80) * .5
def chime():
    t = t_(1.0); out = np.zeros(len(t))
    for f, dl in [(880, 0), (1318.5, .09), (1760, .18)]:
        i = int(dl * SR); tt = t[:len(t) - i]
        out[i:] += np.sin(2 * np.pi * f * tt) * np.exp(-tt * 4) * .35
    return out
def vibration(d=5.6):
    t = t_(d); k = t / d
    inten = np.clip(k / .25, .4, 1) * env(len(t), .2, .6)
    rumble = np.sin(2 * np.pi * 34 * t) * (0.6 + .4 * np.sin(2 * np.pi * 9 * t))
    rattle = lp(rng.standard_normal(len(t)), .15) * (np.sin(2 * np.pi * 14 * t) > .3) * .5
    return (rumble * .6 + rattle) * inten
def tyre_roll(d=2.4):
    t = t_(d); n = lp(rng.standard_normal(len(t)), .08)
    return n * (0.55 + .45 * np.sin(2 * np.pi * 6 * t)) * env(len(t), .3, .8) * 1.5
def sub_hit(d=3.0):
    t = t_(d); return np.sin(2 * np.pi * 45 * t) * np.exp(-t * .9) + np.sin(2 * np.pi * 90 * t) * np.exp(-t * 2) * .3

# ---------- music bed: dark pulse, 120 bpm ----------
bpm = 120; beat = 60 / bpm
music = np.zeros(N)
def kick():
    t = t_(.4); f = 120 * np.exp(-t * 25) + 45
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
def hat():
    t = t_(.06); x = rng.standard_normal(len(t)); return (x - lp(x, .5)) * np.exp(-t * 70) * .25
tt = np.arange(N) / SR
bassnotes = [36.71, 36.71, 43.65, 41.20]  # D, D, F, E (Hz, low)
for b in range(int(DUR / beat)):
    at = b * beat
    if at < 1.0 or 26.9 < at < 27.6: continue
    i = int(at * SR); k = kick(); j = min(N, i + len(k)); music[i:j] += k[:j - i] * .55
    hi = int((at + beat / 2) * SR); h = hat(); j = min(N, hi + len(h)); music[hi:j] += h[:j - hi]
bar = (tt // (beat * 4)).astype(int) % 4
f = np.array(bassnotes)[bar]
saw = 2 * ((tt * f) % 1) - 1
bass = lp(saw, .02) * (0.6 + .4 * np.sin(2 * np.pi * tt / beat)) * 1.4
bass *= np.clip((tt - .8) / 1.5, 0, 1)
pad = (np.sin(2 * np.pi * 73.4 * tt) + np.sin(2 * np.pi * 110 * tt) * .6 + np.sin(2 * np.pi * 146.8 * tt + np.sin(tt * .5)) * .4) * .12
music += bass * .35 + pad
fade = np.clip((DUR - tt) / 1.2, 0, 1); music *= fade
L += music * .5; R += music * .5

# ---------- SFX timeline (matches reel.html) ----------
add(laser(1.0, 3000, 600), 0.05, .6)
add(engine(2.7), 0.15, .9)
add(impact(), 1.0, .9)
add(whoosh(.45), 2.65, .9)
add(impact(1.4, 60), 3.0, .5)
add(impact(), 3.4, 1.0)               # 01 slam
add(whoosh(.5), 3.75, .35, .3)
add(tyre_roll(3.0), 4.0, .25, .4)
for k, at in enumerate([5.3, 5.65, 6.0]): add(beep(), at, .35, .5)
add(impact(1.0, 90), 6.5, .7)          # freeze
add(beep(.35, 880), 6.5, .3)
add(whoosh(.4), 8.6, 1.0, -.8)          # whip-pan
add(impact(), 9.4, 1.0)                # 02 slam
add(vibration(5.4), 9.4, .7)
add(whoosh(.7), 14.6, 1.0)              # spinning wheel
add(tyre_roll(1.0), 14.7, .6)
add(impact(), 15.4, 1.0)               # 03 slam
add(tyre_roll(2.0), 15.3, .5)
add(whoosh(.5), 16.4, .5)
add(laser(.6, 1200, 400), 17.6, .35)
add(whoosh(.6), 20.65, 1.0)             # rotation transform
add(impact(), 21.3, 1.0)               # 04 slam
add(click(), 22.9, 1.0); add(click(), 23.15, .8)
add(chime(), 23.7, .7)                 # centred
add(whoosh(.6, False), 24.65, 1.0)      # zoom out
for at in [25.3, 26.1]: add(laser(.8, 2600, 700), at, .45, -.3 if at < 26 else .3)
for i in range(4): add(click(), 25.9 + i * .15, .6)
add(chime(), 26.6, .5)
add(riser(.75), 26.6, .8)
add(impact(2.4, 55), 27.35, 1.2)        # logo reveal
add(sub_hit(), 27.35, .6)
add(laser(1.2, 4000, 2000), 27.8, .2)

mix = np.stack([L, R], 1)
mix = np.tanh(mix * 1.1)
mix /= np.max(np.abs(mix)) / 0.89
out = sys.argv[1] if len(sys.argv) > 1 else 'sfx_music.wav'
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
print('wrote', out)
