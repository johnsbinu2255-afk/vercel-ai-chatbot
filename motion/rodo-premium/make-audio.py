#!/usr/bin/env python3
"""Synthesises the 8 s sound design for the RODO logo sting -> audio.wav (48 kHz, stereo, 16-bit).

Everything is generated from scratch (no samples) and timed from timeline.json:
  engine  - V8-style firing pulses through exhaust resonances, rpm/throttle automation,
            exhaust crackle on lift-off
  fx      - light-streak whoosh, part fly-ins, metallic clanks, wheel pass-bys, tyre
            screech, spark crackle, metal scrapes, heavy impacts, riser, final brand hit
  space   - synthetic stereo reverb on an fx send
"""
import json
import os
import numpy as np
from scipy import signal as sg
from scipy.io import wavfile
from scipy.interpolate import PchipInterpolator

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
TL = json.load(open(os.path.join(HERE, 'timeline.json')))
DUR = TL['duration']
N = int(round(SR * DUR))
T = np.arange(N) / SR
rng = np.random.default_rng(2026)


# ---------------------------------------------------------------- helpers
def band(lo, hi, order=2):
    return sg.butter(order, [lo, hi], btype='band', fs=SR, output='sos')


def lowp(fc, order=2):
    return sg.butter(order, fc, btype='low', fs=SR, output='sos')


def highp(fc, order=2):
    return sg.butter(order, fc, btype='high', fs=SR, output='sos')


def filt(sos, x):
    return sg.sosfilt(sos, x)


def tv_filter(x, fc_at, kind='band', q=1.4, block=256):
    """Time-varying 2nd-order filter, coefficients updated per block (state carried over)."""
    y = np.zeros_like(x)
    zi = np.zeros((1, 2))
    for b in range(0, len(x), block):
        fc = float(fc_at(min(len(x) - 1, b + block // 2)))
        if kind == 'band':
            lo, hi = fc / (1 + 0.5 / q), fc * (1 + 0.5 / q)
            sos = sg.butter(1, [max(25.0, lo), min(SR * 0.45, hi)], btype='band', fs=SR, output='sos')
        else:
            sos = sg.butter(2, min(fc, SR * 0.45), btype='low', fs=SR, output='sos')
        y[b:b + block], zi = sg.sosfilt(sos, x[b:b + block], zi=zi)
    return y


def norm(x):
    m = np.max(np.abs(x))
    return x / m if m > 0 else x


def pchip(keys, idx):
    return PchipInterpolator([k[0] for k in keys], [k[idx] for k in keys])


L = np.zeros(N)
R = np.zeros(N)
SL = np.zeros(N)     # reverb send
SRb = np.zeros(N)


def place(sig, t0, pan=0.0, gain=1.0, send=0.25):
    """Add a mono signal at time t0 with equal-power pan (scalar or per-sample array)."""
    i0 = int(round(t0 * SR))
    sig = np.asarray(sig, dtype=float) * gain
    pan = np.broadcast_to(np.asarray(pan, dtype=float), sig.shape)
    if i0 < 0:
        sig, pan, i0 = sig[-i0:], pan[-i0:], 0
    n = min(len(sig), N - i0)
    if n <= 0:
        return
    a = (np.clip(pan[:n], -1, 1) + 1) * np.pi / 4
    gl, gr = np.cos(a), np.sin(a)
    L[i0:i0 + n] += sig[:n] * gl
    R[i0:i0 + n] += sig[:n] * gr
    SL[i0:i0 + n] += sig[:n] * gl * send
    SRb[i0:i0 + n] += sig[:n] * gr * send


def env_swell(n, peak=0.6, p_att=1.6, p_rel=1.4):
    x = np.linspace(0, 1, n)
    a = np.where(x < peak, (x / peak) ** p_att, ((1 - x) / (1 - peak)) ** p_rel)
    return a


def whoosh(dur, f0, f1, fmid=None, q=1.3, peak=0.6):
    n = int(dur * SR)
    if fmid is None:
        fc = lambda i: f0 * (f1 / f0) ** (i / n)
    else:
        fc = lambda i: (f0 * (fmid / f0) ** ((i / n) / 0.55)) if i / n < 0.55 else (fmid * (f1 / fmid) ** ((i / n - 0.55) / 0.45))
    y = tv_filter(rng.standard_normal(n), fc, 'band', q)
    return norm(y) * env_swell(n, peak)


def clank(f0, decay=0.4, bright=1.0, modes=(1, 2.32, 4.25, 6.63, 9.38, 12.8)):
    n = int((decay * 4 + 0.06) * SR)
    tt = np.arange(n) / SR
    amps = (1, 0.72, 0.5, 0.36, 0.24, 0.16)
    y = np.zeros(n)
    for i, (r, a) in enumerate(zip(modes, amps)):
        y += a * np.exp(-tt / (decay / (1 + 0.45 * i))) * np.sin(2 * np.pi * f0 * r * tt + rng.uniform(0, 6.28))
    click = filt(highp(2500), rng.standard_normal(n)) * np.exp(-tt / 0.0025) * 0.9 * bright
    return norm(y + click)


def thump(f_start, f_end, decay, dur=None):
    dur = dur or decay * 6
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = f_end + (f_start - f_end) * np.exp(-tt / 0.045)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / decay) * np.minimum(1, tt / 0.002)


def crunch(decay=0.06, fc=1800):
    n = int(decay * 8 * SR)
    tt = np.arange(n) / SR
    return norm(filt(lowp(fc), rng.standard_normal(n)) * np.exp(-tt / decay))


def scrape(dur):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    grain = np.abs(filt(lowp(60), rng.standard_normal(n)))
    grain = 0.4 + grain / grain.max()
    y = filt(band(900, 4500), rng.standard_normal(n)) * grain
    y += 0.35 * np.sin(2 * np.pi * np.cumsum(2300 + 300 * np.sin(2 * np.pi * 11 * tt)) / SR) * grain
    return norm(y) * env_swell(n, 0.2, 1.0, 0.8)


def screech(dur):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = 1350 + 130 * np.sin(2 * np.pi * 7.3 * tt) + 70 * np.sin(2 * np.pi * 12.9 * tt + 1.0)
    ph = 2 * np.pi * np.cumsum(f) / SR
    flutter = filt(lowp(14), rng.standard_normal(n))
    flutter = 0.55 + 0.45 * flutter / np.max(np.abs(flutter))
    y = (np.sin(ph) + 0.45 * np.sin(2 * ph + 0.4) + 0.2 * np.sin(3 * ph)) * flutter * 0.55
    y += filt(band(1700, 6000), rng.standard_normal(n)) * 0.5
    return norm(y) * np.minimum(1, tt / 0.08) * np.minimum(1, (dur - tt) / 0.22)


def crackle(t0, t1, count, gain=0.2, pan_spread=0.6):
    times = t0 + (t1 - t0) * rng.uniform(0, 1, count) ** 1.6
    for tt0 in times:
        n = int(0.006 * SR)
        tt = np.arange(n) / SR
        s = filt(highp(3000), rng.standard_normal(n)) * np.exp(-tt / 0.0009)
        place(s, tt0, pan=rng.uniform(-pan_spread, pan_spread), gain=gain * rng.uniform(0.3, 1.0), send=0.15)


# ---------------------------------------------------------------- engine
# (time, rpm, throttle)
ENGINE = [
    (0.00, 800, 0.10), (0.40, 820, 0.14), (0.58, 1700, 0.75), (0.98, 5300, 1.00), (1.32, 3000, 0.40),
    (1.62, 1700, 0.24), (2.30, 1150, 0.18), (2.56, 1350, 0.55), (2.92, 5900, 1.00), (3.50, 6600, 1.00),
    (3.98, 6400, 0.95), (4.14, 2600, 0.08), (4.55, 1500, 0.14), (5.05, 950, 0.12), (5.22, 1650, 0.78),
    (5.62, 5600, 1.00), (5.86, 3300, 0.28), (6.45, 1300, 0.14), (7.25, 900, 0.10), (8.00, 840, 0.08),
]
rpm = pchip(ENGINE, 1)(T)
thr = np.clip(pchip(ENGINE, 2)(T), 0, 1)
f_fire = rpm / 60.0 * 4.0                     # V8: 4 firings per crank revolution
phase = np.cumsum(f_fire) / SR
events = np.nonzero(np.diff(np.floor(phase)) > 0)[0] + 1
cyl = np.array([1.0, 0.78, 0.93, 0.72, 1.06, 0.84, 0.9, 0.76])   # uneven cylinders -> burble
exc = np.zeros(N)
klen = int(0.03 * SR)
kt = np.arange(klen) / SR
for j, n0 in enumerate(events):
    n0 = int(n0 + rng.normal(0, 0.00022) * SR)
    if n0 < 0 or n0 >= N:
        continue
    th = thr[n0]
    a = cyl[j % 8] * (0.55 + 0.45 * th) * (1 + 0.07 * rng.standard_normal())
    k = np.exp(-kt / (0.006 + 0.005 * (1 - th))) * np.sin(2 * np.pi * 92 * kt)
    k += np.exp(-kt / 0.0012) * rng.standard_normal(klen) * (0.25 + 0.6 * th)
    m = min(klen, N - n0)
    exc[n0:n0 + m] += a * k[:m]
body = filt(lowp(170), exc) * 2.2 + filt(band(220, 760), exc) * 1.2 + filt(band(900, 3300), exc) * (0.2 + 0.8 * thr) * 0.6
cut = 450 + 4300 * thr * np.clip(rpm / 6500, 0.2, 1.0)
body = tv_filter(body, lambda i: cut[i], 'lp')
# level compensation: keep the engine's loudness on the automation curve whatever the rpm does to the filters
rms = np.sqrt(np.maximum(filt(lowp(9, 2), body ** 2), 0)) + 1e-4
body = body / rms * 0.32
drive = 1.2 + 2.6 * thr
eng = np.tanh(body * drive) / np.tanh(drive)
eng += filt(band(400, 2600), rng.standard_normal(N)) * 0.07 * thr * (rpm / 6500) ** 1.5      # intake roar
eng += np.sin(2 * np.pi * np.cumsum(rpm / 60 * 3.1) / SR) * 0.02 * (rpm / 6500) ** 2 * thr   # mechanical whine
eng_gain = (0.42 + 0.58 * thr) * (0.6 + 0.4 * rpm / 6500)
eng_gain *= np.clip(T / 0.25, 0, 1) * np.clip((7.9 - T) / 1.2, 0, 1)
eng *= eng_gain
d = int(0.00035 * SR)                          # a touch of width
L += eng * 0.95
R[d:] += eng[:-d] * 0.95
SL += eng * 0.06
SRb += eng * 0.06


def pops(t0, t1, count):
    for tt0 in t0 + (t1 - t0) * rng.uniform(0, 1, count) ** 1.7:
        n = int(0.06 * SR)
        tt = np.arange(n) / SR
        s = np.exp(-tt / 0.003) * rng.standard_normal(n) * 0.8 + np.exp(-tt / 0.014) * np.sin(2 * np.pi * rng.uniform(140, 230) * tt) * 0.7
        place(filt(band(70, 6000), s), tt0, pan=rng.uniform(-0.25, 0.25), gain=rng.uniform(0.12, 0.34), send=0.3)


pops(4.16, 4.75, 9)
pops(5.9, 6.5, 7)

# ---------------------------------------------------------------- light streak
st0, st1 = TL['streak']
n_st = int((st1 - st0 + 0.25) * SR)
place(whoosh(st1 - st0 + 0.25, 260, 1500, fmid=4300, q=1.1, peak=0.58), st0 - 0.05,
      pan=np.linspace(-0.95, 0.7, n_st), gain=1.0, send=0.35)
tt = np.arange(n_st) / SR
glide = 220 + 1050 * np.sin(np.pi * np.clip(tt / (st1 - st0), 0, 1)) ** 2
zing = np.sin(2 * np.pi * np.cumsum(glide) / SR) * env_swell(n_st, 0.55)
place(zing, st0 - 0.05, pan=np.linspace(-0.9, 0.6, n_st), gain=0.07, send=0.4)
place(clank(2100, decay=0.5, bright=0.2), st1 - 0.04, pan=0.35, gain=0.13, send=0.6)       # flare "shing"

# ---------------------------------------------------------------- emblem assembly
for name, f0, pan0 in (('stem', 520, -0.6), ('bowl', 610, 0.6), ('leg', 470, 0.5)):
    a, b = TL['parts'][name]
    n = int((b - a + 0.02) * SR)
    place(whoosh(b - a + 0.02, 500, 2400, q=1.5, peak=0.85), a, pan=np.linspace(pan0, 0.0, n), gain=0.5, send=0.2)
    place(clank(f0, decay=0.42), b, pan=pan0 * 0.15, gain=0.5, send=0.45)
    place(thump(130, 55, 0.11), b, gain=0.55, send=0.15)
    place(crunch(0.03, 3000), b, gain=0.2, send=0.2)
crackle(TL['parts']['stem'][1], TL['parts']['leg'][1] + 0.45, 60, gain=0.16)
sw0, sw1 = TL['sweep']
n_sw = int((sw1 - sw0) * SR)
place(filt(band(5000, 9500), rng.standard_normal(n_sw)) * env_swell(n_sw, 0.5), sw0, pan=np.linspace(-0.5, 0.3, n_sw), gain=0.05, send=0.4)
place(clank(2650, decay=0.7, bright=0.1), sw1 - 0.1, pan=0.2, gain=0.06, send=0.6)

# ---------------------------------------------------------------- wheels
for (a, b), pan_from, pan_to in ((TL['wheelA'], -1.0, -0.12), (TL['wheelB'], 1.0, 0.36)):
    dur = b - a + 0.15
    n = int(dur * SR)
    tt = np.arange(n) / SR
    p = np.clip(tt / (b - a), 0, 1)
    speed = 3 * (1 - p) ** 2 / 3                                   # easeOutCubic velocity, normalised
    pan = pan_from + (pan_to - pan_from) * (1 - (1 - p) ** 3)
    place(whoosh(dur, 1100, 180, q=1.0, peak=0.25), a, pan=pan, gain=0.6, send=0.25)
    roar = filt(band(70, 520), rng.standard_normal(n))
    place(norm(roar) * (0.25 + 0.75 * speed) * np.minimum(1, tt / 0.05), a, pan=pan, gain=0.32, send=0.1)
burn0, burn1 = TL['wheelA'][1] - 0.1, TL['spinStop'] - 0.02
place(screech(burn1 - burn0), burn0, pan=-0.35, gain=0.17, send=0.25)
place(screech(burn1 - burn0 - 0.08), burn0 + 0.08, pan=0.45, gain=0.15, send=0.25)
smoke_n = int((burn1 - burn0 + 0.4) * SR)
place(filt(band(300, 3000), rng.standard_normal(smoke_n)) * env_swell(smoke_n, 0.4), burn0, gain=0.06, send=0.3)
for dt, pan in ((0.0, -0.12), (0.06, 0.36)):
    place(clank(165, decay=0.16, bright=0.6), TL['lock'] + dt, pan=pan, gain=0.42, send=0.3)
    place(thump(120, 58, 0.1), TL['lock'] + dt, pan=pan, gain=0.5, send=0.1)
    place(clank(2350, decay=0.7, bright=0.1), TL['lock'] + dt + 0.01, pan=pan, gain=0.1, send=0.6)

# ---------------------------------------------------------------- R and D slide in + impacts
for name, pan_from, pan_to, f0 in (('R', -0.75, -0.22, 290), ('D', 0.75, 0.2, 250)):
    a, b = TL[name]
    n = int((b - a) * SR)
    place(scrape(b - a), a, pan=np.linspace(pan_from, pan_to, n), gain=0.28, send=0.2)
    place(whoosh(b - a, 1800, 400, q=1.2, peak=0.3), a - 0.03, pan=np.linspace(pan_from, pan_to, int((b - a) * SR)), gain=0.3, send=0.2)
    place(thump(88, 36, 0.32), b, pan=pan_to * 0.5, gain=0.9, send=0.25)
    place(clank(f0, decay=0.45), b, pan=pan_to, gain=0.5, send=0.5)
    place(crunch(0.05, 1500), b, pan=pan_to, gain=0.38, send=0.3)
    crackle(a, b + 0.35, 45, gain=0.15)

# ---------------------------------------------------------------- reveal: riser, wipe whoosh, brand hit
w0, w1 = TL['wipe']
r0 = w0 - 0.25
n_r = int((w1 - r0) * SR)
tt = np.arange(n_r) / SR
riser = tv_filter(rng.standard_normal(n_r), lambda i: 300 * (7000 / 300) ** (i / n_r), 'band', 1.6)
riser = norm(riser) * (tt / tt[-1]) ** 2.2 * np.minimum(1, (tt[-1] - tt) / 0.015 + 0.0)
place(riser, r0, gain=0.3, send=0.35)
place(np.sin(2 * np.pi * np.cumsum(150 * 4 ** (tt / tt[-1])) / SR) * (tt / tt[-1]) ** 2, r0, gain=0.06, send=0.3)
n_w = int((w1 - w0) * SR)
place(whoosh(w1 - w0, 400, 3000, q=1.0, peak=0.7), w0, pan=np.linspace(-1, 1, n_w), gain=0.6, send=0.35)
place(thump(95, 36, 0.75, dur=2.6), w1, gain=1.0, send=0.4)                                  # deep boom
place(crunch(0.12, 220), w1, gain=0.5, send=0.4)
place(clank(1180, decay=0.8, bright=0.3), w1 + 0.005, gain=0.12, send=0.7)                    # metallic shimmer
n_s = int(1.4 * SR)
place(filt(highp(6000), rng.standard_normal(n_s)) * np.exp(-np.arange(n_s) / SR / 0.35), w1, gain=0.035, send=0.6)

# ---------------------------------------------------------------- reverb + master
ir_len = int(2.4 * SR)
ti = np.arange(ir_len) / SR
ir_env = np.exp(-ti / (1.9 / 6.91)) * np.minimum(1, ti / 0.012)
irL = filt(lowp(6500), rng.standard_normal(ir_len)) * ir_env
irR = filt(lowp(6500), rng.standard_normal(ir_len)) * ir_env
pre = int(0.022 * SR)
irL = np.concatenate([np.zeros(pre), irL]); irR = np.concatenate([np.zeros(pre), irR])
irL /= np.sqrt(np.sum(irL ** 2)); irR /= np.sqrt(np.sum(irR ** 2))
wetL = sg.fftconvolve(SL, irL)[:N]
wetR = sg.fftconvolve(SRb, irR)[:N]
mixL = L + wetL * 0.9
mixR = R + wetR * 0.9
hp = highp(28, 2)
mixL, mixR = filt(hp, mixL), filt(hp, mixR)
peak = max(np.max(np.abs(mixL)), np.max(np.abs(mixR)))
mixL, mixR = mixL / peak * 1.25, mixR / peak * 1.25
mixL, mixR = np.tanh(mixL) / np.tanh(1.25), np.tanh(mixR) / np.tanh(1.25)                   # gentle soft clip
fade = np.clip((DUR - T) / 0.25, 0, 1)
mixL *= fade; mixR *= fade
peak = max(np.max(np.abs(mixL)), np.max(np.abs(mixR)))
out = np.stack([mixL, mixR], 1) / peak * 0.89                                                 # ~ -1 dBFS
wavfile.write(os.path.join(HERE, 'audio.wav'), SR, (out * 32767).astype(np.int16))
print('wrote audio.wav', out.shape, 'events', len(events))
