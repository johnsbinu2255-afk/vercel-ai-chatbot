"""Sound for the brand reveal (35-40 s of the ad), synthesised so it lands exactly on the picture.
Usage: python3 brand_sting.py out.wav [offset]   (offset = ad time at which the file starts, default 35)
"""
import sys, wave
import numpy as np
SR = 48000
off = float(sys.argv[2]) if len(sys.argv) > 2 else 35.0
DUR = 40.0 - off
N = int(SR * DUR)
rng = np.random.default_rng(11)
L = np.zeros(N); R = np.zeros(N)

def tt(d): return np.arange(int(d * SR)) / SR
def lp(x, a):
    y = np.empty_like(x); s = 0.0; a = np.broadcast_to(a, x.shape)
    for i in range(len(x)): s += a[i] * (x[i] - s); y[i] = s
    return y
def add(sig, at, g=1.0, pan=0.0):
    i = int((at - off) * SR)
    if i < 0: sig = sig[-i:]; i = 0
    j = min(N, i + len(sig)); sig = sig[:j - i] * g
    L[i:j] += sig * np.sqrt((1 - pan) / 2) * 1.414; R[i:j] += sig * np.sqrt((1 + pan) / 2) * 1.414

def whoosh(d, up=True):
    t = tt(d); k = t / d; sh = np.sin(np.pi * (k if up else 1 - k) ** .7) ** 2
    return lp(rng.standard_normal(len(t)), .02 + .22 * sh) * sh * 2
def roll(d):          # tyres rolling in fast, then slowing to a stop
    t = tt(d); k = t / d; speed = (1 - k) ** 2
    rumble = lp(rng.standard_normal(len(t)), .04 + .1 * speed) * (0.6 + .4 * np.sin(2 * np.pi * np.cumsum(4 + 14 * speed) / SR))
    return rumble * (0.3 + speed) * np.minimum(1, t / .08) * 1.6
def impact(d=2.5, f0=62):
    t = tt(d); f = f0 * np.exp(-t * 3) + 30
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    click = rng.standard_normal(len(t)) * np.exp(-t * 70) * .6
    tail = lp(rng.standard_normal(len(t)), .03) * np.exp(-t * 1.6) * 1.5
    return np.tanh((body * 1.3 + click + tail) * 1.3)
def thump():
    t = tt(.5); f = 110 * np.exp(-t * 18) + 50
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 10)
def shimmer(d):       # glassy light sweep
    t = tt(d); k = t / d; out = np.zeros(len(t))
    for f in (2093, 2637, 3136, 4186):
        out += np.sin(2 * np.pi * f * t + 3 * np.sin(2 * np.pi * 5 * t)) * .12
    return out * np.sin(np.pi * k) ** 2
def pad(d):
    t = tt(d)
    s = sum(np.sin(2 * np.pi * f * t + np.sin(t * .7 + f)) * a for f, a in ((55, .5), (82.4, .35), (110, .25), (164.8, .12)))
    return s * np.minimum(1, t / 1.0) * np.minimum(1, (d - t) / .8) * .35

add(pad(2.6), 35.0, .8)
add(whoosh(.7), 35.25, .4, -.2)
add(whoosh(.7), 35.75, .3, .2)
add(whoosh(.55), 37.2, .9, -.6)
add(roll(.95), 37.3, .9)
add(thump(), 38.0, .7); add(thump(), 38.08, .6)
add(impact(), 38.25, 1.1)
add(shimmer(.9), 38.55, .55)
add(shimmer(1.1), 38.8, .35, .3)
t = np.arange(N) / SR + off
fade = np.clip((40.0 - t) / .35, 0, 1)
mix = np.tanh(np.stack([L, R], 1) * 1.05) * fade[:, None]
mix /= np.max(np.abs(mix)) / .89
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype('<i2').tobytes())
print('wrote', sys.argv[1])
