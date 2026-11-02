#!/usr/bin/env python3
"""Rodo Tyres – "Monsoon Grip Test" Instagram Reel (20 s, 1080x1920, 30 fps).

Fully procedural motion graphics: every frame is drawn with Pillow + numpy,
sound effects are synthesised in sfx.py, ffmpeg encodes the final MP4.

    python3 render.py                  # full render -> rodo_monsoon_grip_test.mp4
    python3 render.py --offer          # adds "FREE TYRE CHECK THIS MONSOON" badge
    python3 render.py --stills 1,4,9   # PNG stills at those seconds (for review)

Official brand logos: drop PNGs (transparent background) into assets/logos/
named apollo.png, bridgestone.png, yokohama.png, jk.png and rodo.png and
they are used instead of the built-in text badges.
"""
import argparse
import math
import multiprocessing as mp
import os
import subprocess
import sys
from functools import lru_cache

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

import sfx

W, H, FPS, DUR = 1080, 1920, 30, 20.0
NFRAMES = int(FPS * DUR)
HERE = os.path.dirname(os.path.abspath(__file__))
LOGO_DIR = os.path.join(HERE, "assets", "logos")

YEL = (255, 199, 0)
RED = (232, 26, 36)
GRN = (40, 214, 104)
WHITE = (246, 248, 255)
INK = (8, 9, 12)

F_BLACK = "/usr/share/fonts/opentype/inter/InterDisplay-Black.otf"
F_XBOLD = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"
F_SYM = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

OPTS = {"offer": False}
A = {}  # pre-built assets (shared with worker processes via fork)


# =============================================================== utilities
@lru_cache(maxsize=256)
def font(size, path=F_BLACK):
    return ImageFont.truetype(path, max(8, int(size)))


def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def lin(t, a, b):
    return clamp((t - a) / (b - a))


def ease_out(x):
    return 1 - (1 - x) ** 3


def ease_in(x):
    return x ** 3


def smooth(x):
    return x * x * (3 - 2 * x)


def back(x, s=2.2):
    x -= 1
    return x * x * ((s + 1) * x + s) + 1


def keys(t, ks):
    """Piecewise smooth interpolation over [(time, value), ...]."""
    if t <= ks[0][0]:
        return ks[0][1]
    for (t0, v0), (t1, v1) in zip(ks, ks[1:]):
        if t <= t1:
            return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0))
    return ks[-1][1]


def rgba(c, a):
    return (int(c[0]), int(c[1]), int(c[2]), int(clamp(a) * 255))


def put(base, layer, cx, cy, scale=1.0, alpha=1.0, angle=0.0):
    """Alpha-blend an RGBA layer onto an RGB frame, centred at (cx, cy)."""
    if alpha <= 0.004 or scale <= 0.01:
        return
    L = layer
    if abs(scale - 1) > 1e-3:
        L = L.resize((max(1, int(L.width * scale)), max(1, int(L.height * scale))), Image.BICUBIC)
    if angle:
        L = L.rotate(angle, resample=Image.BICUBIC, expand=True)
    m = L.getchannel("A")
    if alpha < 0.999:
        m = m.point(lambda v, a=alpha: int(v * a))
    base.paste(L.convert("RGB"), (int(round(cx - L.width / 2)), int(round(cy - L.height / 2))), m)


def soft_layer(scale=4):
    return Image.new("RGB", (W // scale, H // scale))


def screen_soft(frame, g, blur, scale=4):
    """Blur a low-res light layer, upscale it and screen-blend it onto the frame."""
    if blur:
        g = g.filter(ImageFilter.GaussianBlur(blur))
    return ImageChops.screen(frame, g.resize((W, H), Image.BILINEAR))


def zoom(frame, s, cx=W / 2, cy=H / 2):
    if abs(s - 1) < 1e-4:
        return frame
    box = (cx - cx / s, cy - cy / s, cx + (W - cx) / s, cy + (H - cy) / s)
    return frame.resize((W, H), Image.BILINEAR, box=box)


def shake(frame, dx, dy, margin=24):
    if abs(dx) < 0.3 and abs(dy) < 0.3:
        return frame
    dx, dy = clamp(dx, -margin, margin), clamp(dy, -margin, margin)
    box = (margin + dx, margin + dy, W - margin + dx, H - margin + dy)
    return frame.resize((W, H), Image.BILINEAR, box=box)


def flash(frame, a, color=(205, 218, 255)):
    if a <= 0.003:
        return frame
    return Image.blend(frame, Image.new("RGB", (W, H), color), clamp(a))


def darken(frame, k):
    return Image.blend(Image.new("RGB", (W, H)), frame, k)


def jitter(seed, amp):
    r = np.random.default_rng(seed)
    return r.normal(0, amp, 2) if amp > 0 else (0.0, 0.0)


# =============================================================== text
@lru_cache(maxsize=512)
def text_layer(segs, size, stroke=0, path=F_BLACK, shadow=True):
    """segs: tuple of (text, rgb). Returns an RGBA sprite with soft drop shadow."""
    f = font(size, path)
    widths = [f.getlength(s) for s, _ in segs]
    asc, desc = f.getmetrics()
    pad = int(size * 0.4) + stroke
    w = int(sum(widths)) + 2 * pad
    h = asc + desc + 2 * pad
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    if shadow:
        sh = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(sh)
        x = pad
        sw = stroke + max(3, size // 14)
        for (s, _), wd in zip(segs, widths):
            d.text((x, pad + size * 0.05), s, font=f, fill=(0, 0, 0, 235), stroke_width=sw, stroke_fill=(0, 0, 0, 235))
            x += wd
        sh = sh.filter(ImageFilter.GaussianBlur(size * 0.09))
        img.alpha_composite(sh)
    lay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    x = pad
    for (s, c), wd in zip(segs, widths):
        d.text((x, pad), s, font=f, fill=c + (255,), stroke_width=stroke, stroke_fill=(0, 0, 0, 255))
        x += wd
    img.alpha_composite(lay)
    return img


def fit_size(segs, size, maxw, path=F_BLACK):
    while size > 20:
        f = font(size, path)
        if sum(f.getlength(s) for s, _ in segs) <= maxw:
            return size
        size -= 2
    return size


def T(segs, size, maxw=960, stroke=0, path=F_BLACK):
    if isinstance(segs, str):
        segs = ((segs, WHITE),)
    segs = tuple((s, tuple(c)) for s, c in segs)
    return text_layer(segs, fit_size(segs, size, maxw, path), stroke, path)


def make_glow(layer, color, radius, gain=1.6):
    a = layer.getchannel("A")
    small = a.resize((max(1, layer.width // 4), max(1, layer.height // 4)), Image.BILINEAR)
    small = small.filter(ImageFilter.GaussianBlur(radius / 4))
    a = small.resize(layer.size, Image.BILINEAR).point(lambda v: min(255, int(v * gain)))
    g = Image.new("RGBA", layer.size, color + (0,))
    g.putalpha(a)
    return g


def padded(layer, pad):
    out = Image.new("RGBA", (layer.width + 2 * pad, layer.height + 2 * pad), (0, 0, 0, 0))
    out.alpha_composite(layer, (pad, pad))
    return out


def pill(text, size, fg, bg, padx=34, pady=16, path=F_BLACK, border=None, icon=None, margin=10):
    f = font(size, path)
    fi = font(size * 0.95, F_SYM)
    iw = int(fi.getlength(icon + " ")) if icon else 0
    tw = int(f.getlength(text)) + iw
    asc, desc = f.getmetrics()
    w, h = tw + 2 * padx, asc + desc + 2 * pady
    m = margin
    img = Image.new("RGBA", (w + 2 * m, h + 2 * m), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([m, m, m + w, m + h], radius=h // 2, fill=bg + (255,),
                        outline=(border + (255,)) if border else None, width=4 if border else 0)
    if icon:
        d.text((m + padx, m + pady + size * 0.08), icon, font=fi, fill=fg + (255,))
    d.text((m + padx + iw, m + pady), text, font=f, fill=fg + (255,))
    return img


# =============================================================== rain + lens
class Rain:
    def __init__(self, n, seed, lmin, lmax, wmin, wmax, vmin, vmax, amin, amax):
        r = np.random.default_rng(seed)
        self.x = r.uniform(-650, W + 150, n)
        self.y = r.uniform(0, H + 300, n)
        self.v = r.uniform(vmin, vmax, n)
        self.l = r.uniform(lmin, lmax, n)
        self.w = r.integers(wmin, wmax + 1, n)
        self.a = r.uniform(amin, amax, n)

    def draw(self, d, t, density=1.0, wind=0.22, bright=1.0, tint=(185, 205, 240)):
        n = int(len(self.x) * clamp(density))
        y = (self.y[:n] + self.v[:n] * t) % (H + 300) - 150
        x = self.x[:n] + wind * (y + 150)
        for i in range(n):
            l = self.l[i]
            a = self.a[i] * bright
            if a < 0.02:
                continue
            d.line([(x[i], y[i]), (x[i] + wind * l, y[i] + l)], fill=rgba(tint, a), width=int(self.w[i]))


def rain(frame, t, density=1.0, bright=1.0, wind=0.22, tint=(185, 205, 240)):
    d = ImageDraw.Draw(frame, "RGBA")
    A["rain_far"].draw(d, t, density, wind, bright * 0.8, tint)
    A["rain_near"].draw(d, t, density, wind, bright, tint)
    return frame


def gen_lens_drops():
    r = np.random.default_rng(77)
    drops = []
    for _ in range(95):
        drops.append(dict(
            t0=r.uniform(-1, DUR), life=r.uniform(1.6, 4.0),
            x=r.uniform(60, W - 60), y=r.uniform(60, H - 200), r=int(r.uniform(9, 30)),
            slide_at=r.uniform(0.4, 1.6), vs=r.uniform(0, 260) if r.random() < 0.55 else 0,
            wob=r.uniform(0, 6.28)))
    return drops


@lru_cache(maxsize=64)
def drop_sprites(R):
    s = 4
    m = Image.new("L", (2 * R * s, 2 * R * s), 0)
    ImageDraw.Draw(m).ellipse([0, int(R * s * 0.12), 2 * R * s - 1, 2 * R * s - 1], fill=255)
    mask = m.resize((2 * R, 2 * R), Image.LANCZOS)
    rim = Image.new("RGBA", (2 * R * s, 2 * R * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(rim)
    d.ellipse([0, int(R * s * 0.12), 2 * R * s - 1, 2 * R * s - 1], outline=(0, 0, 0, 120), width=int(R * s * 0.16))
    d.ellipse([int(R * s * 0.45), int(R * s * 0.45), int(R * s * 0.85), int(R * s * 0.75)], fill=(255, 255, 255, 170))
    d.arc([int(R * s * 0.2), int(R * s * 0.3), int(2 * R * s * 0.9), int(2 * R * s * 0.95)], 20, 160,
          fill=(220, 235, 255, 110), width=max(2, int(R * s * 0.08)))
    rim = rim.resize((2 * R, 2 * R), Image.LANCZOS)
    return mask, rim


def lens_drops(frame, t, density=1.0):
    for k, dr in enumerate(A["drops"]):
        if k > len(A["drops"]) * density:
            break
        age = t - dr["t0"]
        if age < 0 or age > dr["life"]:
            continue
        fade = min(1, age / 0.06) * (1 - lin(age, dr["life"] - 0.5, dr["life"]))
        if fade <= 0.02:
            continue
        R = dr["r"]
        slide = max(0.0, age - dr["slide_at"])
        y = int(dr["y"] + slide * dr["vs"])
        x = int(dr["x"] + 3 * math.sin(dr["wob"] + slide * 4) * (dr["vs"] > 0))
        if y + R >= H - 2:
            continue
        # refraction: shrunk + flipped view of a wider patch behind the drop
        src = frame.crop((x - 3 * R, y - 3 * R, x + 3 * R, y + 3 * R)).resize((2 * R, 2 * R), Image.BILINEAR)
        src = src.rotate(180).point(lambda v: min(255, int(v * 1.25 + 8)))
        mask, rim = drop_sprites(R)
        if fade < 1:
            mask = mask.point(lambda v, f=fade: int(v * f))
        frame.paste(src, (x - R, y - R), mask)
        put(frame, rim, x, y, alpha=fade)
        # streak trail for sliding drops
        if dr["vs"] > 0 and slide > 0:
            d = ImageDraw.Draw(frame, "RGBA")
            d.line([(x, y - R), (x, max(dr["y"], y - slide * dr["vs"]))], fill=(200, 220, 255, int(45 * fade)),
                   width=max(2, R // 3))
    return frame


# =============================================================== lightning
def bolt_pts(seed, x0, y0, x1, y1, disp=140, depth=6):
    r = np.random.default_rng(seed)
    pts = [(x0, y0), (x1, y1)]
    for _ in range(depth):
        new = [pts[0]]
        for a, b in zip(pts, pts[1:]):
            mx = (a[0] + b[0]) / 2 + r.uniform(-disp, disp)
            my = (a[1] + b[1]) / 2 + r.uniform(-disp * 0.25, disp * 0.25)
            new += [(mx, my), b]
        pts = new
        disp *= 0.55
    return pts


def flicker(a):
    if a < 0:
        return 0.0
    if a < 0.05:
        return 1.0
    if a < 0.09:
        return 0.22
    if a < 0.15:
        return 0.9
    return max(0.0, 0.9 * math.exp(-(a - 0.15) * 13))


@lru_cache(maxsize=16)
def bolt_geom(seed, x0, y0, x1, y1):
    main = bolt_pts(seed, x0, y0, x1, y1)
    r = np.random.default_rng(seed + 1)
    branches = []
    for j in r.choice(range(8, len(main) - 8), 4, replace=False):
        bx, by = main[j]
        branches.append(bolt_pts(seed * 3 + int(j), bx, by, bx + r.uniform(-320, 320), by + r.uniform(150, 380),
                                 disp=70, depth=5))
    return main, branches


def lightning(frame, t, ts, seed, x0, y0, x1, y1):
    k = flicker(t - ts)
    if k <= 0.01:
        return frame, 0.0
    main, branches = bolt_geom(seed, x0, y0, x1, y1)
    g = soft_layer()
    gd = ImageDraw.Draw(g)
    c = (int(120 * k), int(150 * k), int(255 * k))
    gd.line([(x / 4, y / 4) for x, y in main], fill=c, width=5)
    for b in branches:
        gd.line([(x / 4, y / 4) for x, y in b], fill=c, width=3)
    frame = screen_soft(frame, g, 5)
    d = ImageDraw.Draw(frame, "RGBA")
    d.line(main, fill=(240, 245, 255, int(255 * k)), width=6, joint="curve")
    for b in branches:
        d.line(b, fill=(220, 230, 255, int(200 * k)), width=2)
    return frame, k


# =============================================================== icons
def icon_warning(size=230):
    s = 4
    S = size * s
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pts = [(S / 2, S * 0.08), (S * 0.95, S * 0.88), (S * 0.05, S * 0.88)]
    d.polygon(pts, fill=YEL + (255,))
    d.line(pts + [pts[0]], fill=YEL + (255,), width=int(S * 0.09), joint="curve")
    d.line(pts + [pts[0]], fill=INK + (255,), width=int(S * 0.025), joint="curve")
    d.rounded_rectangle([S * 0.455, S * 0.34, S * 0.545, S * 0.66], radius=S * 0.04, fill=INK + (255,))
    d.ellipse([S * 0.45, S * 0.71, S * 0.55, S * 0.81], fill=INK + (255,))
    return padded(img.resize((size, size), Image.LANCZOS), 40)


def icon_tick(size=230):
    s = 4
    S = size * s
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=S * 0.22, fill=(30, 190, 90, 255))
    d.rounded_rectangle([S * 0.04, S * 0.04, S * 0.96, S * 0.5], radius=S * 0.2, fill=(70, 220, 120, 255))
    d.rounded_rectangle([S * 0.04, S * 0.3, S * 0.96, S * 0.96], radius=S * 0.2, fill=(34, 196, 96, 255))
    d.line([(S * 0.24, S * 0.52), (S * 0.43, S * 0.71), (S * 0.78, S * 0.3)], fill=(255, 255, 255, 255),
           width=int(S * 0.13), joint="curve")
    for p in [(S * 0.24, S * 0.52), (S * 0.78, S * 0.3)]:
        r = S * 0.065
        d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=(255, 255, 255, 255))
    return padded(img.resize((size, size), Image.LANCZOS), 40)


def icon_cloud(size=150):
    s = 4
    S = size * s
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = (215, 225, 245, 255)
    for (x, y, r) in [(0.33, 0.42, 0.2), (0.55, 0.33, 0.25), (0.75, 0.47, 0.17), (0.22, 0.52, 0.14)]:
        d.ellipse([S * (x - r), S * (y - r), S * (x + r), S * (y + r)], fill=c)
    d.rounded_rectangle([S * 0.1, S * 0.42, S * 0.92, S * 0.64], radius=S * 0.11, fill=c)
    for x in (0.3, 0.5, 0.7):
        d.line([(S * x, S * 0.74), (S * (x - 0.06), S * 0.94)], fill=(80, 170, 255, 255), width=int(S * 0.06))
    return padded(img.resize((size, size), Image.LANCZOS), 20)


def draw_tyre_icon(d, cx, cy, R, color, hole=INK, spokes=True, notches=24):
    d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=color)
    for i in range(notches):
        a = 2 * math.pi * i / notches
        a2 = a + math.pi / notches
        p = [(cx + R * math.cos(a), cy + R * math.sin(a)),
             (cx + R * 0.86 * math.cos(a + 0.05), cy + R * 0.86 * math.sin(a + 0.05)),
             (cx + R * 0.86 * math.cos(a2 - 0.05), cy + R * 0.86 * math.sin(a2 - 0.05)),
             (cx + R * math.cos(a2), cy + R * math.sin(a2))]
        d.polygon(p, fill=hole)
    d.ellipse([cx - R * 0.7, cy - R * 0.7, cx + R * 0.7, cy + R * 0.7], fill=hole)
    d.ellipse([cx - R * 0.56, cy - R * 0.56, cx + R * 0.56, cy + R * 0.56], fill=color)
    d.ellipse([cx - R * 0.44, cy - R * 0.44, cx + R * 0.44, cy + R * 0.44], fill=hole)
    if spokes:
        for i in range(5):
            a = 2 * math.pi * i / 5 - math.pi / 2
            d.line([(cx, cy), (cx + R * 0.46 * math.cos(a), cy + R * 0.46 * math.sin(a))], fill=color,
                   width=max(2, int(R * 0.13)))
    d.ellipse([cx - R * 0.14, cy - R * 0.14, cx + R * 0.14, cy + R * 0.14], fill=color)


def icon_small_tyre(size=70, color=YEL):
    S = size * 4
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw_tyre_icon(ImageDraw.Draw(img), S / 2, S / 2, S * 0.48, color + (255,), (0, 0, 0, 0), notches=16)
    return img.resize((size, size), Image.LANCZOS)


# =============================================================== road world
HZ = 790
CX = 540
FOC = 1160 * 1.6
RW = 1.15


def proj(X, Y, d):
    s = FOC / d
    return CX + X * s, HZ + (1 - Y) * s


def noise_tex(w, h, seed, octaves=((8, 1.0), (24, 0.5), (70, 0.25))):
    r = np.random.default_rng(seed)
    acc = np.zeros((h, w))
    tot = 0
    for cells, amp in octaves:
        small = r.random((max(2, int(cells * h / w)), cells))
        im = Image.fromarray((small * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        acc += np.asarray(im, dtype=np.float32) / 255 * amp
        tot += amp
    return acc / tot


def palm(d, x, base_y, h, lean, color, r):
    top = (x + lean, base_y - h)
    pts = [(x + lean * (u ** 2), base_y - h * u) for u in np.linspace(0, 1, 12)]
    d.line(pts, fill=color, width=max(2, int(h * 0.035)))
    for k in range(9):
        a = math.radians(-170 + k * 20 + r.uniform(-8, 8))
        L = h * r.uniform(0.32, 0.48)
        fr = []
        for u in np.linspace(0, 1, 10):
            fx = top[0] + math.cos(a) * L * u
            fy = top[1] + math.sin(a) * L * u * 0.7 + (L * 0.55) * u * u
            fr.append((fx, fy))
        d.line(fr, fill=color, width=max(2, int(h * 0.028)))
        # leaflets
        for j, (fx, fy) in enumerate(fr[2::2]):
            d.line([(fx, fy), (fx + r.uniform(-1, 1) * h * 0.05, fy + h * 0.06)], fill=color, width=max(1, int(h * 0.012)))


def build_road_bg():
    y = np.arange(H, dtype=np.float32)[:, None]
    img = np.zeros((H, W, 3), np.float32)
    # sky
    k = np.clip(y / HZ, 0, 1)
    top, hz = np.array([3, 6, 16]), np.array([24, 44, 82])
    sky = top + (hz - top) * k ** 1.6
    clouds = noise_tex(W, HZ, 3, ((5, 1.0), (14, 0.6), (40, 0.3)))[:, :, None]
    sky_img = sky[:HZ, None, :] * (0.55 + 0.9 * clouds ** 1.5)
    img[:HZ] = sky_img
    # ground
    gk = np.clip((y[HZ:] - HZ) / (H - HZ), 0, 1)
    ground = (np.array([10, 16, 22]) * (1 - gk) + np.array([4, 7, 9]) * gk)[:, None, :]
    img[HZ:] = ground
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im, "RGBA")
    # distant hills + treeline
    r = np.random.default_rng(5)
    hills = [(0, HZ)] + [(x, HZ - 25 - 30 * math.sin(x / 140) - r.uniform(0, 12)) for x in range(0, W + 40, 40)] + [(W, HZ)]
    d.polygon(hills, fill=(9, 14, 26, 255))
    for x in range(-20, W + 20, 18):
        rr = r.uniform(10, 28)
        d.ellipse([x - rr, HZ - rr * 0.9 - 8, x + rr, HZ + 4], fill=(6, 10, 18, 255))
    # road
    road = [proj(-RW, 0, 1.3), proj(-RW, 0, 400), proj(RW, 0, 400), proj(RW, 0, 1.3)]
    d.polygon(road, fill=(17, 20, 29, 255))
    # road sheen: sky reflection near the horizon
    sheen = Image.new("L", (W, H), 0)
    sd = ImageDraw.Draw(sheen)
    sd.polygon(road, fill=255)
    grad = np.clip(1 - (np.arange(H) - HZ) / 520, 0, 1) ** 2
    grad[:HZ] = 0
    g = (np.asarray(sheen, np.float32) / 255) * grad[:, None]
    tex = noise_tex(W, H, 9, ((30, 1.0), (120, 0.6)))
    arr = np.asarray(im, np.float32)
    arr += (g * (0.6 + 0.6 * tex))[:, :, None] * np.array([30, 48, 85])
    # asphalt grain on road
    arr += (np.asarray(sheen, np.float32)[:, :, None] / 255) * (tex[:, :, None] - 0.5) * 10
    im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im, "RGBA")
    # edge lines
    for side in (-1, 1):
        x0, x1 = side * RW * 0.9, side * RW * 0.86
        d.polygon([proj(x0, 0, 1.3), proj(x0, 0, 300), proj(x1, 0, 300), proj(x1, 0, 1.3)], fill=(190, 195, 205, 150))
    # palms
    r = np.random.default_rng(12)
    for x, h in [(40, 300), (130, 230), (210, 170), (300, 110), (380, 70), (690, 75), (760, 120), (850, 190),
                 (950, 260), (1050, 330)]:
        palm(d, x, HZ + 6, h, r.uniform(-40, 40), (4, 7, 13, 255), r)
    return im


def ripples(frame, t, slots=55, seed=4, region=None, top_view=False, color=(160, 185, 230)):
    d = ImageDraw.Draw(frame, "RGBA")
    period = 0.5
    for i in range(slots):
        ph = (i * 0.6180339) % 1 * period
        c = math.floor((t + ph) / period)
        age = (t + ph) % period
        r = np.random.default_rng(seed * 100003 + i * 1009 + c)
        a = 1 - age / period
        if top_view:
            x, y = r.uniform(*region[0]), r.uniform(*region[1])
            rad = 6 + 40 * age / period
            d.ellipse([x - rad, y - rad, x + rad, y + rad], outline=rgba(color, 0.45 * a), width=2)
        else:
            X, dd = r.uniform(-RW, RW), r.uniform(1.8, 22)
            x, y = proj(X, 0, dd)
            s = FOC / dd
            rad = (0.02 + 0.09 * age / period) * s
            d.ellipse([x - rad, y - rad * 0.22, x + rad, y + rad * 0.22], outline=rgba(color, 0.5 * a),
                      width=max(1, int(s / 400)))


def road_frame(t, z, lamps=True, dash=True):
    f = A["road_bg"].copy()
    d = ImageDraw.Draw(f, "RGBA")
    if dash:
        n0 = int(z // 3)
        for n in range(n0, n0 + 45):
            da = 3 * n - z
            db = da + 1.3
            if db < 1.35:
                continue
            da = max(da, 1.35)
            fog = math.exp(-da / 50)
            poly = [proj(-.04, 0, da), proj(.04, 0, da), proj(.04, 0, db), proj(-.04, 0, db)]
            d.polygon(poly, fill=rgba(YEL, 0.85 * fog))
    g = soft_layer()
    gd = ImageDraw.Draw(g)
    if lamps:
        period = 7
        m0 = int(z // period)
        for n in range(m0 + 13, m0 - 1, -1):
            dd = period * n - z + 2.5
            if dd < 1.5:
                continue
            side = 1 if n % 2 == 0 else -1
            fog = math.exp(-dd / 38)
            s = FOC / dd
            bx, by = proj(side * 1.85, 0, dd)
            tx, ty = proj(side * 1.85, 3.3, dd)
            hx, hy = proj(side * 1.35, 3.2, dd)
            pc = (8, 11, 17, 255)
            d.line([(bx, by), (tx, ty)], fill=pc, width=max(1, int(s * 0.045)))
            d.line([(tx, ty), (hx, hy)], fill=pc, width=max(1, int(s * 0.03)))
            hr = max(1.5, s * 0.06)
            d.ellipse([hx - hr * 1.6, hy - hr * 0.6, hx + hr * 1.6, hy + hr * 0.6], fill=(255, 236, 190, int(255 * (0.4 + 0.6 * fog))))
            c = (int(255 * fog), int(150 * fog), int(55 * fog))
            gr = min(s * 0.5, 70) / 4
            gd.ellipse([hx / 4 - gr, hy / 4 - gr, hx / 4 + gr, hy / 4 + gr], fill=c)
            # light pool + wobbly reflection streak on the wet road
            px, py = proj(side * 1.1, 0, dd)
            pr = s * 0.9 / 4
            gd.ellipse([px / 4 - pr, py / 4 - pr * 0.25, px / 4 + pr, py / 4 + pr * 0.25],
                       fill=(int(70 * fog), int(45 * fog), int(20 * fog)))
            my = HZ + (1 + 3.2) * s * 0.55
            y = by
            step = max(3.0, s * 0.08)
            while y < min(my, H + 40):
                u = (y - by) / max(1, my - by)
                wob = math.sin(y * 0.045 + t * 7 + n) * s * 0.04
                ww = max(1.0, s * 0.05 * (1 - 0.6 * u)) / 4
                cc = (int(200 * fog * (1 - u)), int(120 * fog * (1 - u)), int(45 * fog * (1 - u)))
                gd.ellipse([(hx + wob) / 4 - ww, y / 4 - step / 8, (hx + wob) / 4 + ww, y / 4 + step / 8], fill=cc)
                y += step
    f = screen_soft(f, g, 3)
    ripples(f, t)
    return f


# =============================================================== tyres
def tyre_rot(R, worn):
    """Rotating part of a side-view tyre (rubber, tread, rim, spokes)."""
    s = 2
    S = (2 * R + 20) * s
    c = S / 2
    Rs = R * s
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rubber = (44, 42, 41) if worn else (20, 20, 23)
    d.ellipse([c - Rs, c - Rs, c + Rs, c + Rs], fill=rubber + (255,))
    if worn:
        # smooth, shallow tread: faint short scuffs only
        for i in range(60):
            a = 2 * math.pi * i / 60
            r0, r1 = Rs * 0.985, Rs * 0.955
            d.line([(c + r0 * math.cos(a), c + r0 * math.sin(a)), (c + r1 * math.cos(a + 0.01), c + r1 * math.sin(a + 0.01))],
                   fill=(58, 56, 54, 255), width=int(2 * s))
        for i in range(9):  # cracks
            a = 2 * math.pi * (i + 0.37) / 9
            r0 = Rs * 0.9
            d.line([(c + r0 * math.cos(a), c + r0 * math.sin(a)),
                    (c + r0 * 0.96 * math.cos(a + 0.03), c + r0 * 0.96 * math.sin(a + 0.03)),
                    (c + r0 * 0.93 * math.cos(a + 0.01), c + r0 * 0.93 * math.sin(a + 0.01))], fill=(26, 25, 25, 255), width=s * 2)
    else:
        # deep sharp tread blocks
        n = 44
        for i in range(n):
            a = 2 * math.pi * i / n
            a2 = a + 2 * math.pi / n * 0.42
            p = [(c + Rs * 1.01 * math.cos(a), c + Rs * 1.01 * math.sin(a)),
                 (c + Rs * 0.9 * math.cos(a + 0.02), c + Rs * 0.9 * math.sin(a + 0.02)),
                 (c + Rs * 0.9 * math.cos(a2 + 0.03), c + Rs * 0.9 * math.sin(a2 + 0.03)),
                 (c + Rs * 1.01 * math.cos(a2 + 0.05), c + Rs * 1.01 * math.sin(a2 + 0.05))]
            d.polygon(p, fill=(0, 0, 0, 0))
            d.line([p[1], p[2]], fill=(6, 6, 8, 255), width=3 * s)
        for i in range(n):  # block highlight edge
            a = 2 * math.pi * (i + 0.5) / n
            d.arc([c - Rs * 0.995, c - Rs * 0.995, c + Rs * 0.995, c + Rs * 0.995], math.degrees(a) + 2,
                  math.degrees(a) + 5, fill=(70, 74, 84, 255), width=2 * s)
    # sidewall
    sw = Rs * 0.86
    d.ellipse([c - sw, c - sw, c + sw, c + sw], fill=(rubber[0] + 8, rubber[1] + 8, rubber[2] + 10, 255))
    for rr, col in [(0.82, (rubber[0] + 22,) * 3), (0.69, (rubber[0] + 18,) * 3)]:
        d.ellipse([c - Rs * rr, c - Rs * rr, c + Rs * rr, c + Rs * rr], outline=col + (255,), width=2 * s)
    # sidewall lettering blocks (stylised)
    for i in range(18):
        a = 2 * math.pi * i / 18
        if i % 9 in (0, 1, 2, 3):
            r0 = Rs * 0.755
            d.line([(c + r0 * math.cos(a), c + r0 * math.sin(a)), (c + r0 * math.cos(a + 0.12), c + r0 * math.sin(a + 0.12))],
                   fill=(rubber[0] + 30,) * 3 + (255,), width=int(Rs * 0.04))
    # rim
    rim = Rs * 0.62
    metal = (120, 122, 128) if worn else (175, 182, 195)
    d.ellipse([c - rim, c - rim, c + rim, c + rim], fill=metal + (255,))
    d.ellipse([c - rim * 0.93, c - rim * 0.93, c + rim * 0.93, c + rim * 0.93], fill=(14, 15, 18, 255))
    for i in range(5):
        a = 2 * math.pi * i / 5
        for off in (-0.13, 0.13):
            p0 = (c + rim * 0.2 * math.cos(a), c + rim * 0.2 * math.sin(a))
            p1 = (c + rim * 0.92 * math.cos(a + off), c + rim * 0.92 * math.sin(a + off))
            d.line([p0, p1], fill=metal + (255,), width=int(rim * 0.12))
    d.ellipse([c - rim * 0.27, c - rim * 0.27, c + rim * 0.27, c + rim * 0.27], fill=metal + (255,))
    for i in range(5):
        a = 2 * math.pi * (i + 0.5) / 5
        x, y = c + rim * 0.17 * math.cos(a), c + rim * 0.17 * math.sin(a)
        d.ellipse([x - rim * 0.035, y - rim * 0.035, x + rim * 0.035, y + rim * 0.035], fill=(60, 62, 70, 255))
    d.ellipse([c - rim * 0.08, c - rim * 0.08, c + rim * 0.08, c + rim * 0.08], fill=YEL + (255,) if not worn else (80, 80, 84, 255))
    return img.resize((S // s, S // s), Image.LANCZOS)


def tyre_light(R):
    """Static lighting overlay (doesn't rotate with the wheel)."""
    S = 2 * R + 20
    y, x = np.mgrid[0:S, 0:S].astype(np.float32)
    c = S / 2
    nx, ny = (x - c) / R, (y - c) / R
    r = np.sqrt(nx ** 2 + ny ** 2)
    inside = (r <= 1.0).astype(np.float32)
    hl = np.clip(1 - np.sqrt((nx + 0.45) ** 2 + (ny + 0.5) ** 2) / 0.9, 0, 1) ** 2
    rimhl = np.exp(-((r - 0.97) / 0.03) ** 2) * np.clip(-ny * 0.8 + 0.4, 0, 1)
    sh = np.clip((nx * 0.5 + ny * 0.8), 0, 1)
    out = np.zeros((S, S, 4), np.float32)
    white = (hl * 0.28 + rimhl * 0.55)
    out[..., :3] = 255 * (white[..., None] > 0)
    a_white = white * inside
    a_dark = sh * 0.55 * inside
    # combine: dark first then white highlights (approximate single layer)
    col = np.where(a_white[..., None] > a_dark[..., None], np.array([200, 215, 255]), np.array([0, 0, 0]))
    out[..., :3] = col
    out[..., 3] = np.maximum(a_white, a_dark) * 255
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def glow_ring(R, color=YEL, width=10, blur=26):
    S = 2 * R + 200
    c = S / 2
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([c - R - 6, c - R - 6, c + R + 6, c + R + 6], outline=color + (255,), width=width)
    g = make_glow(img, color, blur * 2, 2.2)
    g.alpha_composite(img)
    return g


def particles(st, rate, life, seed, origin, vx, vy, grav=0.0, drag=0.0, size=(2, 6)):
    """Deterministic emitter: returns list of (x, y, r, alpha) for particles alive at st."""
    out = []
    k1 = int(math.floor(st * rate))
    k0 = max(0, int(math.floor((st - life) * rate)))
    R = A["prand"]
    for k in range(k0, k1 + 1):
        tb = k / rate
        age = st - tb
        if age < 0 or age > life:
            continue
        j = (k * 7 + seed * 131) % len(R)
        r1, r2, r3, r4 = R[j], R[(j + 1) % len(R)], R[(j + 2) % len(R)], R[(j + 3) % len(R)]
        ox, oy = origin(tb) if callable(origin) else origin
        ux = vx[0] + (vx[1] - vx[0]) * r1
        uy = vy[0] + (vy[1] - vy[0]) * r2
        if drag > 0:
            fdx = (1 - math.exp(-drag * age)) / drag
        else:
            fdx = age
        x = ox + ux * fdx + (r4 - 0.5) * 30
        y = oy + uy * fdx + 0.5 * grav * age * age
        out.append((x, y, size[0] + (size[1] - size[0]) * r3, 1 - age / life))
    return out


def draw_particles(frame, ps, color=(215, 232, 255), alpha=0.8, glow=None, stretch=1.0):
    d = ImageDraw.Draw(frame, "RGBA")
    for x, y, r, a in ps:
        d.ellipse([x - r, y - r * stretch, x + r, y + r * stretch], fill=rgba(color, a * alpha))
    if glow:
        g = soft_layer()
        gd = ImageDraw.Draw(g)
        for x, y, r, a in ps:
            rr = r * 2.2 / 4
            cc = tuple(int(v * a * glow) for v in (60, 90, 140))
            gd.ellipse([x / 4 - rr, y / 4 - rr, x / 4 + rr, y / 4 + rr], fill=cc)
        frame = screen_soft(frame, g, 2)
    return frame


# =============================================================== cars
def car_top_sprite():
    w, h = 300, 600
    s = 2
    img = Image.new("RGBA", ((w + 300) * s, (h + 500) * s), (0, 0, 0, 0))
    ox, oy = 150 * s, 400 * s
    d = ImageDraw.Draw(img)
    # headlight beams on the road (ahead = up)
    beam = Image.new("RGBA", img.size, (0, 0, 0, 0))
    bd = ImageDraw.Draw(beam)
    for bx in (60, 240):
        bd.polygon([(ox + bx * s, oy + 10 * s), (ox + (bx - 110) * s, oy - 380 * s), (ox + (bx + 110) * s, oy - 380 * s)],
                   fill=(255, 240, 200, 70))
    beam = beam.filter(ImageFilter.GaussianBlur(30))
    img.alpha_composite(beam)
    d = ImageDraw.Draw(img)
    # shadow
    d.rounded_rectangle([ox - 8 * s, oy + 8 * s, ox + (w + 8) * s, oy + (h + 16) * s], radius=70 * s, fill=(0, 0, 0, 150))
    # tyres
    for tx, ty in [(-12, 90), (w - 22, 90), (-12, h - 170), (w - 22, h - 170)]:
        d.rounded_rectangle([ox + tx * s, oy + ty * s, ox + (tx + 34) * s, oy + (ty + 95) * s], radius=8 * s, fill=(8, 8, 10, 255))
    # body
    d.rounded_rectangle([ox, oy, ox + w * s, oy + h * s], radius=75 * s, fill=(176, 18, 26, 255))
    d.rounded_rectangle([ox + 16 * s, oy + 14 * s, ox + (w - 16) * s, oy + (h - 14) * s], radius=65 * s, fill=(214, 30, 40, 255))
    # windscreen, roof, rear glass
    d.rounded_rectangle([ox + 34 * s, oy + 150 * s, ox + (w - 34) * s, oy + 250 * s], radius=26 * s, fill=(18, 26, 44, 255))
    d.rounded_rectangle([ox + 44 * s, oy + 255 * s, ox + (w - 44) * s, oy + 430 * s], radius=26 * s, fill=(150, 14, 22, 255))
    d.rounded_rectangle([ox + 40 * s, oy + 435 * s, ox + (w - 40) * s, oy + 505 * s], radius=22 * s, fill=(18, 26, 44, 255))
    d.line([(ox + 60 * s, oy + 165 * s), (ox + 120 * s, oy + 235 * s)], fill=(120, 150, 200, 160), width=6 * s)
    # stripes (brand yellow)
    d.rectangle([ox + (w / 2 - 18) * s, oy + 16 * s, ox + (w / 2 - 6) * s, oy + 148 * s], fill=YEL + (255,))
    d.rectangle([ox + (w / 2 + 6) * s, oy + 16 * s, ox + (w / 2 + 18) * s, oy + 148 * s], fill=YEL + (255,))
    # lights
    for lx in (40, w - 80):
        d.rounded_rectangle([ox + lx * s, oy + 8 * s, ox + (lx + 40) * s, oy + 24 * s], radius=6 * s, fill=(255, 250, 225, 255))
        d.rounded_rectangle([ox + lx * s, oy + (h - 22) * s, ox + (lx + 40) * s, oy + (h - 8) * s], radius=6 * s, fill=(255, 40, 40, 255))
    # mirrors
    for mx in (-18, w):
        d.rounded_rectangle([ox + mx * s, oy + 150 * s, ox + (mx + 18) * s, oy + 180 * s], radius=6 * s, fill=(150, 14, 22, 255))
    img = img.resize((img.width // s, img.height // s), Image.LANCZOS)
    # body pivot is the car centre
    return img, (150 + w / 2, 400 + h / 2)


def car_front_sprite():
    w, h = 860, 560
    s = 2
    img = Image.new("RGBA", (w * s, h * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    S = lambda pts: [(x * s, y * s) for x, y in pts]
    # tyres
    for x0 in (95, 625):
        d.rounded_rectangle([x0 * s, 390 * s, (x0 + 140) * s, 555 * s], radius=26 * s, fill=(8, 8, 10, 255))
        for k in range(5):  # visible tread lugs
            yy = 410 + k * 28
            d.line([((x0 + 18) * s, yy * s), ((x0 + 122) * s, (yy + 10) * s)], fill=(30, 30, 34, 255), width=6 * s)
    # cabin
    d.polygon(S([(215, 70), (645, 70), (735, 240), (125, 240)]), fill=(24, 26, 32, 255))
    d.polygon(S([(240, 92), (620, 92), (695, 232), (165, 232)]), fill=(16, 28, 52, 255))
    d.polygon(S([(300, 100), (380, 100), (250, 228), (190, 228)]), fill=(46, 66, 104, 255))
    # mirrors
    d.polygon(S([(110, 215), (165, 215), (160, 255), (95, 250)]), fill=(28, 30, 36, 255))
    d.polygon(S([(695, 215), (750, 215), (765, 250), (700, 255)]), fill=(28, 30, 36, 255))
    # hood + body
    d.polygon(S([(120, 238), (740, 238), (815, 330), (45, 330)]), fill=(34, 36, 44, 255))
    d.rounded_rectangle([30 * s, 320 * s, 830 * s, 470 * s], radius=50 * s, fill=(30, 32, 40, 255))
    d.line(S([(120, 240), (740, 240)]), fill=(90, 110, 150, 255), width=3 * s)
    d.line(S([(48, 332), (812, 332)]), fill=(70, 90, 130, 255), width=3 * s)
    # grille
    d.rounded_rectangle([300 * s, 352 * s, 560 * s, 430 * s], radius=22 * s, fill=(10, 11, 14, 255))
    for k in range(4):
        d.line([(312 * s, (366 + k * 18) * s), (548 * s, (366 + k * 18) * s)], fill=(46, 48, 56, 255), width=3 * s)
    d.ellipse([410 * s, 370 * s, 450 * s, 410 * s], fill=YEL + (255,))
    # headlights
    d.polygon(S([(70, 340), (265, 350), (250, 395), (85, 385)]), fill=(255, 252, 238, 255))
    d.polygon(S([(790, 340), (595, 350), (610, 395), (775, 385)]), fill=(255, 252, 238, 255))
    # fog lamps + bumper
    for x0 in (120, 690):
        d.ellipse([x0 * s, 425 * s, (x0 + 50) * s, 452 * s], fill=(255, 220, 140, 255))
    d.rounded_rectangle([260 * s, 445 * s, 600 * s, 470 * s], radius=10 * s, fill=(14, 15, 18, 255))
    return img.resize((w, h), Image.LANCZOS)


def build_beams(car_cx, car_bottom):
    w, h = 860, 560
    hx = [car_cx - w / 2 + 165, car_cx - w / 2 + 695]
    hy = car_bottom - h + 368
    g = Image.new("RGB", (W // 4, H // 4))
    d = ImageDraw.Draw(g)
    q = lambda v: v / 4
    # light pool on the road in front of the car
    d.ellipse([q(-100), q(hy + 220), q(W + 100), q(H + 260)], fill=(40, 42, 50))
    for x, side in zip(hx, (-1, 1)):
        d.polygon([(q(x - 30), q(hy)), (q(x + 30), q(hy)), (q(x + side * 520 + 380), q(H)), (q(x + side * 520 - 380), q(H))],
                  fill=(42, 46, 60))
        # reflection on wet road
        d.rectangle([q(x - 40), q(car_bottom), q(x + 40), q(H)], fill=(120, 115, 100))
    beams = g.filter(ImageFilter.GaussianBlur(14)).resize((W, H), Image.BILINEAR)
    # glare / bloom / anamorphic streak
    g2 = Image.new("RGB", (W // 4, H // 4))
    d2 = ImageDraw.Draw(g2)
    for x in hx:
        d2.ellipse([q(x - 230), q(hy - 200), q(x + 230), q(hy + 200)], fill=(55, 65, 95))
        d2.ellipse([q(x - 90), q(hy - 70), q(x + 90), q(hy + 70)], fill=(200, 205, 220))
    d2.ellipse([q(-200), q(hy - 18), q(W + 200), q(hy + 18)], fill=(70, 100, 170))
    glare = g2.filter(ImageFilter.GaussianBlur(9)).resize((W, H), Image.BILINEAR)
    mask = ImageChops.screen(beams, glare).convert("L").point(lambda v: min(255, v * 3))
    return beams, glare, mask, hx, hy


# =============================================================== other assets
def asphalt_tex():
    P = 600
    tex = noise_tex(W, H + P, 31, ((40, 1.0), (160, 0.7), (400, 0.5)))
    wet = noise_tex(W, H + P, 32, ((6, 1.0), (16, 0.5)))
    base = np.array([20, 23, 30], np.float32)
    arr = base + (tex[..., None] - 0.5) * 26 + (np.clip(wet - 0.55, 0, 1)[..., None] * np.array([40, 60, 100]) * 1.4)
    im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im, "RGBA")
    # shoulders
    d.rectangle([0, 0, 70, H + P], fill=(8, 14, 12, 255))
    d.rectangle([W - 70, 0, W, H + P], fill=(8, 14, 12, 255))
    # lane markings (period P so the strip scrolls seamlessly)
    d.rectangle([92, 0, 104, H + P], fill=YEL + (230,))
    d.rectangle([W - 104, 0, W - 92, H + P], fill=YEL + (230,))
    for x in (380, 700):
        for y in range(0, H + P, 300):
            d.rectangle([x - 6, y, x + 6, y + 160], fill=(225, 228, 235, 210))
    return im


def crack_layer(cx=600, cy=780):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = np.random.default_rng(44)
    rays = []
    n = 15
    for i in range(n):
        a = 2 * math.pi * i / n + r.uniform(-0.15, 0.15)
        L = r.uniform(500, 1500)
        pts = [(cx, cy)]
        x, y = cx, cy
        steps = 9
        for k in range(steps):
            a += r.uniform(-0.22, 0.22)
            x += math.cos(a) * L / steps
            y += math.sin(a) * L / steps
            pts.append((x, y))
        rays.append(pts)
    for pts in rays:
        d.line([(x + 3, y + 3) for x, y in pts], fill=(0, 0, 0, 170), width=6)
        d.line(pts, fill=(235, 242, 255, 235), width=3)
    for ring in (1, 2, 4):
        pts = [rays[i][ring] for i in range(n)] + [rays[0][ring]]
        d.line(pts, fill=(220, 232, 255, 170), width=2)
    for i in range(n):
        p = [(cx, cy), rays[i][1], rays[(i + 1) % n][1]]
        d.polygon(p, fill=(255, 255, 255, int(r.uniform(15, 60))))
    return img


def tread_strip():
    """Top-down tread strip (680 px wide), tall enough to scroll seamlessly."""
    TW, P = 680, 260
    Ht = H + P
    img = Image.new("RGBA", (TW, Ht), (38, 38, 43, 255))
    d = ImageDraw.Draw(img)
    groove = (5, 5, 7, 255)
    c = TW / 2
    for k in range(-1, Ht // P + 2):
        yc = k * P + 40
        for side in (-1, 1):
            pts = [(c + side * 22, yc), (c + side * TW * 0.27, yc + 70), (c + side * TW * 0.52, yc + 150)]
            d.line(pts, fill=groove, width=40, joint="curve")
            d.line([(x, y - 14) for x, y in pts], fill=(48, 50, 58, 255), width=3)
            # sipes in the blocks
            for j in range(3):
                sy = yc + 105 + j * 34
                d.line([(c + side * 60, sy), (c + side * 150, sy + 30)], fill=(10, 10, 12, 255), width=4)
    for gx in (c - 120, c + 120):
        d.rectangle([gx - 22, 0, gx + 22, Ht], fill=groove)
        d.rectangle([gx - 22, 0, gx - 17, Ht], fill=(52, 54, 62, 255))
    # cylindrical shading (x-dependent only, so it can be baked in)
    x = np.arange(TW, dtype=np.float32)
    shade = 0.45 + 0.75 * np.sin(np.pi * (x + 20) / (TW + 40)) ** 0.8
    arr = np.asarray(img, np.float32)
    arr[..., :3] *= shade[None, :, None]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA"), P


def tread_geom(TW=680):
    c = TW / 2
    left = [(c - 22, 0), (c - TW * 0.27, 70), (c - TW * 0.52, 150)]
    right = [(c + 22, 0), (c + TW * 0.27, 70), (c + TW * 0.52, 150)]
    return left, right


def brand_card(name, key, w=440, h=230):
    img = Image.new("RGBA", (w + 40, h + 40), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([20, 20, 20 + w, 20 + h], radius=30, fill=(14, 16, 22, 245), outline=YEL + (255,), width=5)
    d.rounded_rectangle([32, 32, 8 + w, 20 + h * 0.48], radius=22, fill=(30, 34, 46, 200))
    path = os.path.join(LOGO_DIR, key + ".png")
    if os.path.exists(path):
        lg = Image.open(path).convert("RGBA")
        lg.thumbnail((w - 60, h - 60), Image.LANCZOS)
        img.alpha_composite(lg, (20 + (w - lg.width) // 2, 20 + (h - lg.height) // 2))
    else:
        segs = ((name, WHITE),)
        size = fit_size(segs, 96, w - 70)
        f = font(size)
        tw = f.getlength(name)
        asc, desc = f.getmetrics()
        d.text((20 + (w - tw) / 2, 20 + (h - asc - desc) / 2 - 14), name, font=f, fill=WHITE + (255,))
        sf = font(30, F_XBOLD)
        sub = "TYRES"
        d.text((20 + (w - sf.getlength(sub)) / 2, 20 + h - 62), sub, font=sf, fill=YEL + (255,))
    return img


def rodo_logo():
    path = os.path.join(LOGO_DIR, "rodo.png")
    if os.path.exists(path):
        lg = Image.open(path).convert("RGBA")
        lg.thumbnail((880, 560), Image.LANCZOS)
        return padded(lg, 160)
    s = 2
    w, h = 940, 560
    img = Image.new("RGBA", (w * s, h * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    draw_tyre_icon(d, w / 2 * s, 150 * s, 135 * s, YEL + (255,), (0, 0, 0, 0))
    f = font(170 * s)
    t1, t2 = "RODO", " TYRES"
    f2 = font(118 * s)
    w1, w2 = f.getlength(t1), f2.getlength(t2)
    x0 = (w * s - w1 - w2) / 2
    d.text((x0, 300 * s), t1, font=f, fill=YEL + (255,))
    d.text((x0 + w1, 345 * s), t2, font=f2, fill=WHITE + (255,))
    d.rounded_rectangle([x0, 500 * s, x0 + w1 + w2, 516 * s], radius=8 * s, fill=RED + (255,))
    img = img.resize((w, h), Image.LANCZOS)
    return padded(img, 160)


def band(y0, y1, strength=0.8):
    """Dark gradient band to keep captions readable."""
    a = np.zeros(H, np.float32)
    mid = (y0 + y1) / 2
    half = (y1 - y0) / 2
    yy = np.arange(H)
    a = np.clip(1 - np.abs(yy - mid) / half, 0, 1) ** 0.7 * strength
    m = Image.fromarray((np.repeat(a[:, None], W, 1) * 255).astype(np.uint8))
    return m


def build_assets():
    A["rain_far"] = Rain(520, 1, 30, 70, 1, 2, 1600, 2300, 0.12, 0.35)
    A["rain_near"] = Rain(150, 2, 80, 170, 2, 4, 2400, 3200, 0.25, 0.55)
    A["drops"] = gen_lens_drops()
    A["prand"] = np.random.default_rng(99).random(20011)
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    nx, ny = (x - W / 2) / (W / 2), (y - H / 2) / (H / 2)
    r2 = nx ** 2 * 0.95 + ny ** 2 * 0.8
    v = np.clip(1.12 - 0.5 * r2, 0.32, 1)
    v8 = (v * 255).astype(np.uint8)
    A["vig"] = Image.fromarray(np.dstack([v8, v8, v8]))
    A["edge"] = Image.fromarray((np.clip((np.sqrt(r2) - 0.55) / 0.65, 0, 1) ** 1.3 * 255).astype(np.uint8))
    g = np.random.default_rng(3)
    A["grain"] = [Image.fromarray(g.integers(0, 15, (H, W), dtype=np.uint8)).convert("RGB") for _ in range(6)]
    A["road_bg"] = build_road_bg()
    A["tyre_worn"] = (tyre_rot(330, True), tyre_light(330))
    A["tyre_new"] = (tyre_rot(330, False), tyre_light(330))
    A["ring"] = glow_ring(330)
    A["car_top"] = car_top_sprite()
    A["car_front"] = car_front_sprite()
    A["beams"] = build_beams(540, 1360)
    A["asphalt"] = asphalt_tex()
    A["crack"] = crack_layer()
    A["tread"] = tread_strip()
    A["tread_geom"] = tread_geom()
    A["warn"] = icon_warning()
    A["warn_glow"] = make_glow(A["warn"], RED, 60, 2.2)
    A["tick"] = icon_tick()
    A["tick_glow"] = make_glow(A["tick"], GRN, 60, 2.0)
    A["cloud"] = icon_cloud()
    A["small_tyre"] = icon_small_tyre()
    A["brands"] = [brand_card(n, k) for n, k in
                   [("APOLLO", "apollo"), ("BRIDGESTONE", "bridgestone"), ("YOKOHAMA", "yokohama"), ("JK TYRE", "jk")]]
    A["logo"] = rodo_logo()
    A["logo_glow"] = make_glow(A["logo"], YEL, 70, 1.8)
    A["band_low"] = band(1150, 1580, 0.85)
    A["band_top"] = band(140, 620, 0.75)
    # scene-2 backdrop: low-angle wet night road
    yy = np.arange(H, dtype=np.float32)[:, None]
    WY = 1120
    bg = np.zeros((H, W, 3), np.float32)
    k = np.clip(yy / WY, 0, 1)
    bg[:] = (np.array([3, 6, 14]) + np.array([20, 34, 64]) * k ** 2.2)[:, None, :]
    bg[WY:] = (np.array([7, 15, 32]) * np.clip(1.3 - (yy[WY:] - WY) / 900, 0.35, 1.3))[:, None, :]
    A["s2_bg"] = Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8))
    r = np.random.default_rng(8)
    A["bokeh"] = [(r.uniform(0, W + 600), r.uniform(560, 1080), r.uniform(10, 34),
                   [(255, 170, 70), (255, 60, 50), (120, 170, 255), (255, 220, 150)][r.integers(0, 4)],
                   r.uniform(0.5, 1.4)) for _ in range(22)]
    A["dark_road"] = darken(A["road_bg"], 0.55)


# =============================================================== scenes
def caption(f, segs, size, y, alpha=1.0, scale=1.0, dx=0.0, dy=0.0, maxw=960, stroke=0):
    put(f, T(segs, size, maxw, stroke), 540 + dx, y + dy, scale=scale, alpha=alpha)


def scene1(t):
    """0-3 s  Storm opening."""
    f = road_frame(t, 3.2 * t)
    k = 0.0
    for ts, seed, x0, x1 in ((0.33, 11, 760, 860), (1.83, 23, 260, 160)):
        f, kk = lightning(f, t, ts, seed, x0, -20, x1, HZ - 30)
        k = max(k, kk)
    f = flash(f, k * 0.42)
    f = rain(f, t, 1.0, 1.0 + k)
    f = zoom(f, 1 + 0.12 * smooth(t / 3), CX, HZ - 40)
    f.paste((0, 0, 0), (0, 0, W, H), A["band_top"])
    a = ease_out(lin(t, 0.75, 1.35))
    dx, dy = jitter(int(t * FPS) + 7, 2.5 + 14 * k)
    caption(f, (("Kerala Monsoon", WHITE),), 118, 370, a, 1 + 0.06 * (1 - a), dx, dy)
    a2 = ease_out(lin(t, 1.05, 1.65))
    lay = T((("is here…", YEL),), 118)
    cx = 540 - 70
    put(f, lay, cx + dx, 510 + dy, alpha=a2)
    put(f, A["cloud"], cx + lay.width / 2 + 30 + dx, 505 + dy + 4 * math.sin(t * 5), alpha=a2)
    return f


def scene2(t):
    """3-6 s  The danger – worn tyre aquaplaning."""
    st = t - 3
    f = A["s2_bg"].copy()
    WY = 1120
    slide = lin(st, 1.2, 1.7)
    # moving bokeh lights (sense of speed)
    g = soft_layer()
    gd = ImageDraw.Draw(g)
    for x0, y0, rr, col, sp in A["bokeh"]:
        x = (x0 + 1300 * sp * st) % (W + 600) - 300
        q = [v / 4 for v in (x - rr * 3, y0 - rr, x + rr * 3, y0 + rr)]
        gd.ellipse(q, fill=tuple(int(c * 0.8) for c in col))
        q = [v / 4 for v in (x - rr * 2, 2 * WY - y0 - rr * 0.5, x + rr * 2, 2 * WY - y0 + rr * 2.5)]
        gd.ellipse(q, fill=tuple(int(c * 0.35) for c in col))
    f = screen_soft(f, g, 4)
    # tyre dynamics: rolls, then locks and slides
    u = slide
    ang = 330 * (min(st, 1.2) + 0.5 * (u - u * u / 2))
    sx = -150 * smooth(lin(st, 1.2, 3.0)) + (np.random.default_rng(int(st * 60)).normal(0, 7) if st > 1.2 else 0)
    tilt = 5 * math.sin(st * 11) * slide
    cx, cy = 540 + sx, 845
    rot, light = A["tyre_worn"]
    spr = rot.rotate(ang, resample=Image.BICUBIC)
    spr.alpha_composite(light)
    # wavy reflection in the water
    refl = spr.transpose(Image.FLIP_TOP_BOTTOM).point(lambda v: int(v * 0.5))
    rh = refl.height
    for yy in range(0, rh, 10):
        strip = refl.crop((0, yy, refl.width, yy + 10))
        off = 10 * math.sin(yy * 0.05 + st * 9)
        put(f, strip, cx + off, 2 * WY - cy + yy - rh / 2 + 5 + 30, alpha=0.32)
    put(f, spr, cx, cy, angle=tilt)
    # water body over the bottom of the tyre
    d = ImageDraw.Draw(f, "RGBA")
    surf = [(x, WY + 7 * math.sin(x * 0.018 + st * 8) + 4 * math.sin(x * 0.05 - st * 5)) for x in range(0, W + 20, 20)]
    d.polygon(surf + [(W, H), (0, H)], fill=(10, 30, 62, 150))
    d.line(surf, fill=(130, 170, 230, 170), width=3)
    # water that can't escape: bulging wedge in front of the tyre
    bx = cx - 330 * 0.78
    bulge = 30 + 30 * slide + 6 * math.sin(st * 14)
    d.ellipse([bx - 120, WY - bulge, bx + 160, WY + bulge * 0.7], fill=(80, 130, 200, 110))
    d.ellipse([bx - 70, WY - bulge * 0.7, bx + 90, WY + bulge * 0.2], fill=(170, 205, 255, 70))
    # bow-wave spray
    ps = particles(st, 260, 0.75, 1, (bx - 40, WY - 10), (-950, -250), (-950, -300), grav=2200, size=(2, 7))
    ps += particles(st, 90, 0.5, 2, (cx + 260, WY - 5), (100, 350), (-450, -150), grav=2000, size=(2, 5))
    f = draw_particles(f, ps, alpha=0.75, glow=0.9)
    f = rain(f, t, 0.9, 1.0)
    # callout
    ca = ease_out(lin(st, 0.25, 0.5)) * (1 - lin(st, 1.15, 1.3))
    if ca > 0:
        d = ImageDraw.Draw(f, "RGBA")
        px, py = cx + 330 * 0.71, cy - 330 * 0.71
        d.line([(px, py), (px + 90, py - 120), (px + 130, py - 120)], fill=rgba(RED, ca), width=5)
        d.ellipse([px - 12, py - 12, px + 12, py + 12], fill=rgba(RED, ca))
        put(f, pill("BALD TREAD", 46, WHITE, RED), min(px + 150, 880), py - 120, alpha=ca)
    # red warning pulse
    if st > 1.15:
        ph = (st - 1.2) / 0.4
        pulse = 0.5 + 0.5 * math.cos(2 * math.pi * ph)
        m = A["edge"].point(lambda v, p=pulse: int(v * (0.35 + 0.6 * p)))
        f.paste(RED, (0, 0, W, H), m)
        f = flash(f, 0.12 * pulse * (1 - lin(st, 1.2, 3)), RED)
        pop = back(lin(st, 1.2, 1.45))
        sc = pop * (1 + 0.1 * pulse)
        put(f, A["warn_glow"], 540, 300, sc, 0.9 * pulse)
        put(f, A["warn"], 540, 300, sc)
    f.paste((0, 0, 0), (0, 0, W, H), A["band_low"])
    a = ease_out(lin(st, 0.45, 0.8))
    caption(f, (("Worn tyres =", WHITE),), 112, 1290, a, dy=20 * (1 - a))
    a2 = lin(st, 1.2, 1.32)
    if a2 > 0:
        sc = 1 + 1.2 * (1 - ease_out(a2))
        caption(f, (("NO GRIP", RED),), 170, 1430, a2, sc, stroke=5)
    # camera shake grows when it starts sliding
    amp = 3 + 11 * slide
    dx, dy = jitter(int(t * FPS) * 3 + 1, amp)
    return shake(f, dx, dy)


def s3_story(st):
    if st < 0.5:
        return st
    if st < 1.5:
        return 0.5 + (st - 0.5) * 0.25
    return 0.75 + (st - 1.5)


def glitch(f, t, strength):
    if strength <= 0:
        return f
    r = np.random.default_rng(int(t * 240))
    arr = np.asarray(f).copy()
    sh = int(30 * strength) + 4
    arr[..., 0] = np.roll(arr[..., 0], sh, 1)
    arr[..., 2] = np.roll(arr[..., 2], -sh, 1)
    for _ in range(int(16 * strength) + 3):
        y0 = r.integers(0, H - 20)
        hh = r.integers(8, 120)
        arr[y0:y0 + hh] = np.roll(arr[y0:y0 + hh], r.integers(-260, 260), 1)
    for _ in range(int(8 * strength)):
        x0, y0 = r.integers(0, W - 100), r.integers(0, H - 60)
        bw, bh = r.integers(40, 320), r.integers(10, 60)
        col = [YEL, RED, (40, 70, 140), (255, 255, 255)][r.integers(0, 4)]
        arr[y0:y0 + bh, x0:x0 + bw] = (arr[y0:y0 + bh, x0:x0 + bw] * 0.3 + np.array(col) * 0.7).astype(np.uint8)
    arr[::4] = (arr[::4] * 0.6).astype(np.uint8)
    return Image.fromarray(arr)


def scene3(t):
    """6-8 s  Top view skid with slow motion + screen crack."""
    st = t - 6
    s = s3_story(st)
    P = 600
    off = int((1900 * s) % P)
    f = A["asphalt"].crop((0, P - off, W, P - off + H))
    ripples(f, s * 1.5, slots=40, seed=9, region=((80, W - 80), (0, H)), top_view=True)
    ang = -38 * smooth(lin(s, 0.1, 1.05)) + 4 * math.sin(s * 12) * lin(s, 0.15, 0.5)
    cx = 540 + 110 * smooth(lin(s, 0.1, 1.2))
    cy = 1010 - 80 * s
    spr, (px, py) = A["car_top"]
    a = math.radians(ang)

    def wheel(lx, ly):
        x, y = lx - 150, ly - 300
        return (cx + x * math.cos(a) + y * math.sin(a), cy - x * math.sin(a) + y * math.cos(a))

    nx, ny = math.cos(a), -math.sin(a)  # car's right-hand normal on screen
    ps = []
    for i, (lx, ly) in enumerate([(5, 140), (295, 140), (5, 470), (295, 470)]):
        side = -1 if lx < 150 else 1
        o = wheel(lx, ly)
        vx = (side * nx * 300 - 250, side * nx * 1100 + 150)
        vy = (side * ny * 300 + 300, side * ny * 900 + 900)
        ps += particles(s, 200, 0.55, 10 + i, o, (min(vx), max(vx)), (min(vy), max(vy)), drag=2.5, size=(2, 8))
    # mist
    g = soft_layer()
    gd = ImageDraw.Draw(g)
    for x, y, r, al in ps[::3]:
        rr = (r * 6) / 4
        cc = int(55 * al)
        gd.ellipse([x / 4 - rr, y / 4 - rr, x / 4 + rr, y / 4 + rr], fill=(cc, cc + 8, cc + 20))
    f = screen_soft(f, g, 6)
    # car (rotated around its centre)
    rimg = spr.rotate(ang, resample=Image.BICUBIC, expand=True)
    vx, vy = px - spr.width / 2, py - spr.height / 2
    rx = vx * math.cos(a) + vy * math.sin(a)
    ry = -vx * math.sin(a) + vy * math.cos(a)
    put(f, rimg, cx - rx, cy - ry)
    f = draw_particles(f, ps, alpha=0.85)
    f = rain(f, 6 + s, 0.55, 0.8, wind=0.05)
    sm = lin(st, 0.45, 0.55) * (1 - lin(st, 1.45, 1.55))  # slow-mo look: cooler + darker edges
    if sm > 0:
        f.paste((10, 20, 50), (0, 0, W, H), A["edge"].point(lambda v, k=sm: int(v * 0.6 * k)))
    f = zoom(f, 1 + 0.05 * st, 540, 1000)
    dx, dy = jitter(int(t * FPS) * 5 + 3, 6 * (1 - sm) + 2)
    f = shake(f, dx, dy)
    if st >= 1.55:
        put(f, A["crack"], W / 2, H / 2)
        f = flash(f, 0.8 * (1 - lin(st, 1.55, 1.63)), (255, 255, 255))
    if st >= 1.7:
        f = glitch(f, t, lin(st, 1.7, 1.95))
    return f


def scene4(t):
    """8-12 s  The new tyre – deep tread, water evacuates, firm grip."""
    st = t - 8
    if st < 1.45:
        f = A["s2_bg"].copy()
        WY = 1120
        d = ImageDraw.Draw(f, "RGBA")
        d.rectangle([0, WY, W, H], fill=(10, 18, 34, 255))
        g = soft_layer()
        gd = ImageDraw.Draw(g)
        for x0, y0, rr, col, sp in A["bokeh"]:
            x = (x0 + 1500 * sp * st) % (W + 600) - 300
            gd.ellipse([v / 4 for v in (x - rr * 3, y0 - rr, x + rr * 3, y0 + rr)], fill=tuple(int(c * 0.6) for c in col))
            gd.ellipse([v / 4 for v in (x - rr * 2, 2 * WY - y0, x + rr * 2, 2 * WY - y0 + rr * 3)],
                       fill=tuple(int(c * 0.3) for c in col))
        f = screen_soft(f, g, 4)
        cx, cy = 540, 790
        rot, light = A["tyre_new"]
        spr = rot.rotate(560 * st, resample=Image.BICUBIC)
        spr.alpha_composite(light)
        refl = spr.transpose(Image.FLIP_TOP_BOTTOM)
        put(f, refl, cx, 2 * WY - cy, alpha=0.18)
        ga = ease_out(lin(st, 0.08, 0.45))
        put(f, A["ring"], cx, cy, 1.0, ga * (0.85 + 0.15 * math.sin(st * 9)))
        put(f, spr, cx, cy)
        # clean rooster-tail spray: water thrown out cleanly behind the tyre
        ps = particles(st, 300, 0.7, 30, (cx + 250, WY - 20), (250, 900), (-1300, -500), grav=2600, size=(2, 6))
        ps += particles(st, 140, 0.5, 31, (cx - 230, WY - 5), (-500, -150), (-300, -80), grav=1800, size=(2, 4))
        f = draw_particles(f, ps, alpha=0.8, glow=1.0)
        f = rain(f, t, 0.6, 0.8)
        ca = ease_out(lin(st, 0.35, 0.6))
        if ca > 0:
            d = ImageDraw.Draw(f, "RGBA")
            px, py = cx + 330 * 0.71, cy - 330 * 0.71
            d.line([(px, py), (px + 90, py - 120), (px + 130, py - 120)], fill=rgba(YEL, ca), width=5)
            d.ellipse([px - 12, py - 12, px + 12, py + 12], fill=rgba(YEL, ca))
            put(f, pill("DEEP TREAD", 46, INK, YEL), min(px + 150, 880), py - 120, alpha=ca)
        # zoom punch into the tread (top of the tyre)
        zp = lin(st, 1.15, 1.45)
        if zp > 0:
            f = zoom(f, 1 + 5 * ease_in(zp), cx, cy - 330)
            f = f.filter(ImageFilter.BoxBlur(int(12 * zp)))
    else:
        f = tread_scene(t, st)
    # caption (persists across both views)
    f.paste((0, 0, 0), (0, 0, W, H), A["band_low"])
    a = ease_out(lin(st, 0.3, 0.65))
    caption(f, (("New tyres =", WHITE),), 112, 1290, a, dy=20 * (1 - a))
    a2 = lin(st, 2.4, 2.55)
    if a2 > 0:
        caption(f, (("STRONG GRIP", GRN),), 160, 1430, a2, 1 + 0.9 * (1 - ease_out(a2)), stroke=5)
    if st < 0.12:  # tail of the glitch transition
        f = glitch(f, t, 1 - st / 0.12)
    # grip thud shake
    k = math.exp(-(st - 2.4) * 14) if st >= 2.4 else 0
    dx, dy = jitter(int(t * FPS) * 7 + 5, 14 * k)
    return shake(f, dx, dy)


def tread_scene(t, st):
    tst = st - 1.45
    f = A["dark_road"].copy()
    strip, P = A["tread"]
    TW = strip.width
    x0 = (W - TW) // 2
    scroll = 820 * st
    off = int(scroll % P)
    f.paste(strip.crop((0, P - off, TW, P - off + H)).convert("RGB"), (x0, 0))
    # water flowing through the grooves and spraying out the sides
    left, right = A["tread_geom"]
    ps = []
    for k in range(-1, H // P + 2):
        base_y = k * P + 40 + off - P
        for arm, side in ((left, -1), (right, 1)):
            for j in range(7):
                u = ((j / 7) + tst * 0.9) % 1.0 * 1.7
                if u <= 1:
                    seg = 0 if u < 0.5 else 1
                    v = u / 0.5 if seg == 0 else (u - 0.5) / 0.5
                    (ax, ay), (bx, by) = arm[seg], arm[seg + 1]
                    x, y = ax + (bx - ax) * v, ay + (by - ay) * v
                    ps.append((x0 + x, base_y + y, 7, 0.95))
                else:
                    e = u - 1
                    ex, ey = arm[2]
                    rr = A["prand"][(k * 31 + j * 7 + (side > 0) * 3) % 20011]
                    x = x0 + ex + side * e * 520
                    y = base_y + ey + e * 140 + (rr - 0.5) * 120 * e
                    ps.append((x, y, 5 + 10 * e, 1 - e / 0.7))
    for gx in (TW / 2 - 120, TW / 2 + 120):
        for j in range(16):
            y = ((j / 16) * (H + 200) + (scroll + 900 * tst)) % (H + 200) - 100
            ps.append((x0 + gx, y, 9, 0.9))
    g = soft_layer()
    gd = ImageDraw.Draw(g)
    for x, y, r, a in ps:
        rr = r * 2.4 / 4
        c = (int(40 * a), int(120 * a), int(230 * a))
        gd.ellipse([x / 4 - rr, y / 4 - rr * 1.6, x / 4 + rr, y / 4 + rr * 1.6], fill=c)
    f = screen_soft(f, g, 3)
    d = ImageDraw.Draw(f, "RGBA")
    for x, y, r, a in ps:
        d.ellipse([x - r * 0.55, y - r, x + r * 0.55, y + r], fill=(200, 235, 255, int(230 * clamp(a))))
    # yellow glow edges
    g = soft_layer()
    gd = ImageDraw.Draw(g)
    for ex in (x0 - 4, x0 + TW + 4):
        gd.rectangle([ex / 4 - 2, 0, ex / 4 + 2, H / 4], fill=(160, 120, 0))
    f = screen_soft(f, g, 6)
    d = ImageDraw.Draw(f, "RGBA")
    for ex in (x0 - 4, x0 + TW + 4):
        d.rectangle([ex - 3, 0, ex + 3, H], fill=YEL + (220,))
    f = rain(f, t, 0.45, 0.7, wind=0.1)
    # grip moment: ring burst + tick
    if st >= 2.4:
        e = st - 2.4
        rr = 120 + 900 * ease_out(clamp(e / 0.6))
        d.ellipse([540 - rr, 820 - rr * 0.6, 540 + rr, 820 + rr * 0.6], outline=rgba(YEL, 0.8 * (1 - clamp(e / 0.6))), width=8)
        f.paste((0, 0, 0), (0, 0, W, H), A["band_top"].point(lambda v: int(v * 0.6)))
        sc = back(lin(st, 2.45, 2.75), 2.6)
        put(f, A["tick_glow"], 540, 330, sc * (1 + 0.05 * math.sin(e * 6)), 0.8)
        put(f, A["tick"], 540, 330, sc)
    zin = 1 + 0.35 * (1 - ease_out(lin(st, 1.45, 1.75)))
    press = 1 + 0.035 * math.exp(-(st - 2.4) * 10) if st >= 2.4 else 1
    return zoom(f, zin * press, 540, 900)


def scene5(t):
    """12-14 s  Car drives confidently through the rain – main message."""
    st = t - 12
    slow = 0.35
    f = road_frame(12 + st * slow, 10 + 7 * st * slow)
    beams, glare, mask, hx, hy = A["beams"]
    f = ImageChops.screen(f, beams)
    bob = 3 * math.sin(st * 9)
    put(f, A["car_front"], 540, 1360 - 280 + bob)
    f = ImageChops.screen(f, glare)
    # slow-motion splashes from the front tyres
    ps = []
    for i, (ox, side) in enumerate(((540 - 430 + 165, -1), (540 - 430 + 695, 1))):
        vx = (side * 300, side * 1100)
        ps += particles(st * slow * 2.2, 220, 0.9, 40 + i, (ox, 1350), (min(vx), max(vx)), (-900, -350), grav=1900,
                        size=(2, 8))
    f = draw_particles(f, ps, alpha=0.85, glow=1.2)
    f = rain(f, 12 + st * slow, 0.9, 0.8)
    # rain lit by the headlights
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    A["rain_near"].draw(ImageDraw.Draw(lay), 12.3 + st * slow, 1.0, 0.22, 1.8, (255, 250, 235))
    lay.putalpha(ImageChops.multiply(lay.getchannel("A"), mask))
    f.paste(lay.convert("RGB"), (0, 0), lay.getchannel("A"))
    f = zoom(f, 1 + 0.06 * st, 540, 1100)
    f.paste((0, 0, 0), (0, 0, W, H), A["band_top"])
    # slam text
    p1 = lin(st, 0.3, 0.44)
    if p1 > 0:
        caption(f, (("Kerala rain needs the", WHITE),), 88, 320, p1, 1 + 1.6 * (1 - ease_out(p1)))
    p2 = lin(st, 0.5, 0.64)
    if p2 > 0:
        caption(f, (("RIGHT", YEL), (" tyres.", WHITE)), 168, 470, p2, 1 + 2.0 * (1 - ease_out(p2)), stroke=4)
    f = flash(f, 0.35 * (1 - lin(st, 0.64, 0.8)) if st >= 0.64 else 0, (255, 245, 210))
    k = math.exp(-(st - 0.64) * 9) if st >= 0.64 else 0
    k += 0.5 * math.exp(-(st - 0.44) * 12) if 0.44 <= st < 0.64 else 0
    dx, dy = jitter(int(t * FPS) * 11 + 2, 22 * k + 1.5)
    return shake(f, dx, dy)


BRAND_POS = [(300, 650), (780, 650), (300, 930), (780, 930)]
BRAND_T = [0.25, 0.85, 1.45, 2.05]


def scene6(t):
    """14-17 s  Brand logos slam in on the wet road."""
    st = t - 14
    f = road_frame(t, 30 + 2 * st)
    f = darken(f, 0.5)
    f = rain(f, t, 0.8, 0.8)
    d = ImageDraw.Draw(f, "RGBA")
    allps = []
    for i, ((x, y), ts) in enumerate(zip(BRAND_POS, BRAND_T)):
        e = st - ts
        if e < 0:
            continue
        sc = keys(e, [(0, 2.2), (0.09, 0.86), (0.18, 1.08), (0.28, 0.97), (0.36, 1.0)])
        a = clamp(e / 0.06)
        card = A["brands"][i]
        # reflection
        refl = card.transpose(Image.FLIP_TOP_BOTTOM).resize((card.width, card.height // 2))
        put(f, refl, x, y + card.height * 0.5 * sc + 40, sc, 0.22 * a)
        # splash ring on the "road"
        if e < 0.7:
            rr = 60 + 330 * ease_out(e / 0.7)
            d = ImageDraw.Draw(f, "RGBA")
            d.ellipse([x - rr, y + 110 - rr * 0.22, x + rr, y + 110 + rr * 0.22], outline=rgba((170, 200, 255), 0.8 * (1 - e / 0.7)),
                      width=5)
        if e < 0.9:
            ps = particles(e, 400, 0.65, 50 + i, (x, y + 100), (-800, 800), (-1100, -300), grav=2600, size=(2, 7))
            ps = [p for p in ps if p[3] > 0 and (e - (1 - p[3]) * 0.65) < 0.12]  # burst only
            allps += ps
        put(f, card, x, y, sc, a)
    f = draw_particles(f, allps, alpha=0.85, glow=1.0)
    # caption
    f.paste((0, 0, 0), (0, 0, W, H), A["band_low"])
    a = ease_out(lin(st, 0.1, 0.45))
    caption(f, (("Direct Dealer", WHITE),), 104, 1240, a, dy=30 * (1 - a))
    d = ImageDraw.Draw(f, "RGBA")
    if a > 0:
        d.ellipse([540 - 11, 1325 - 11, 540 + 11, 1325 + 11], fill=rgba(RED, a))
        d.rectangle([540 - 160 * a, 1323, 540 - 30, 1327], fill=rgba(RED, a))
        d.rectangle([540 + 30, 1323, 540 + 160 * a, 1327], fill=rgba(RED, a))
    a2 = ease_out(lin(st, 0.3, 0.65))
    caption(f, (("Direct Warranty", YEL),), 104, 1410, a2, dy=30 * (1 - a2))
    k = 0
    for ts in BRAND_T:
        if st >= ts:
            k = max(k, math.exp(-(st - ts) * 14))
    dx, dy = jitter(int(t * FPS) * 13 + 4, 14 * k)
    return shake(f, dx, dy)


def scene7(t):
    """17-20 s  Contact card."""
    st = t - 17
    f = Image.new("RGB", (W, H), (0, 0, 0))
    if st < 0.35:
        f = darken(A["road_bg"], 0.6 * (1 - lin(st, 0.1, 0.35)))
        f, k = lightning(f, t, 17.0, 31, 520, -20, 600, 1100)
        f = flash(f, k * 0.6 * (1 - lin(st, 0.1, 0.35)))
    f = rain(f, t, 0.35, 0.55, wind=0.12, tint=(150, 170, 210))
    la = ease_out(lin(st, 0.25, 0.75))
    pulse = 0.85 + 0.15 * math.sin(st * 4)
    put(f, A["logo_glow"], 540, 600, 0.96 + 0.04 * la, la * pulse)
    put(f, A["logo"], 540, 600, 0.96 + 0.04 * la, la)
    if OPTS["offer"]:
        oa = back(lin(st, 0.6, 0.9))
        if oa > 0:
            put(f, pill("FREE TYRE CHECK THIS MONSOON", 44, WHITE, RED), 540, 230, oa, clamp(oa), angle=-3)
    a1 = ease_out(lin(st, 0.7, 1.0))
    caption(f, (("Check your tyres", WHITE),), 92, 990, a1, dy=24 * (1 - a1))
    caption(f, (("before the rain!", YEL),), 92, 1090, a1, dy=24 * (1 - a1))
    a2 = ease_out(lin(st, 1.05, 1.35))
    lay = T((("  Rodo Tyres", WHITE),), 64)
    put(f, lay, 540 + 40, 1220 + 20 * (1 - a2), alpha=a2)
    put(f, A["small_tyre"], 540 + 40 - lay.width / 2 - 2, 1220 + 20 * (1 - a2), alpha=a2, angle=-st * 120)
    caption(f, (("Piravom & Mulanthuruthy", (200, 210, 230)),), 58, 1295, a2, dy=20 * (1 - a2))
    a3 = back(lin(st, 1.45, 1.75))
    if a3 > 0:
        pp = 1 + 0.045 * math.sin(2 * math.pi * 1.4 * (st - 1.75)) if st > 1.75 else 1
        ph = A.setdefault("phone_pill", pill("9747691237", 98, INK, YEL, 44, 18, F_BLACK, icon="\u260E", margin=70))
        put(f, A.setdefault("phone_glow", make_glow(ph, YEL, 50, 1.6)), 540, 1450, a3 * pp, 0.7 * clamp(a3))
        put(f, ph, 540, 1450, a3 * pp, clamp(a3))
    return f


SCENES = [(0, 3, scene1), (3, 6, scene2), (6, 8, scene3), (8, 12, scene4), (12, 14, scene5), (14, 17, scene6),
          (17, 20.01, scene7)]


def scene_at(t):
    for a, b, fn in SCENES:
        if a <= t < b:
            return fn(t)
    return scene7(t)


def whip(f, offset, blur):
    f = ImageChops.offset(f, int(offset), 0)
    k = max(1, int(blur))
    if k > 1:
        f = f.resize((max(8, W // k), H), Image.BILINEAR).resize((W, H), Image.BILINEAR)
    return f


def frame_at(t):
    f = scene_at(t)
    # --- transitions -------------------------------------------------
    # lightning-flash cuts
    for tc in (3.0, 17.0):
        if abs(t - tc) < 0.12:
            f = flash(f, 1 - abs(t - tc) / 0.12, (230, 238, 255))
    # whip pans
    for tc, dirn in ((6.0, -1), (14.0, 1)):
        if tc - 0.13 <= t < tc + 0.13:
            if t < tc:
                p = ease_in(lin(t, tc - 0.13, tc))
                f = whip(f, dirn * p * W * 0.7, 1 + 40 * p)
            else:
                p = 1 - ease_out(lin(t, tc, tc + 0.13))
                f = whip(f, -dirn * p * W * 0.7, 1 + 40 * p)
    # zoom punch into scene 5
    if 11.86 <= t < 12.14:
        if t < 12:
            p = ease_in(lin(t, 11.86, 12))
            f = zoom(f, 1 + 0.6 * p, 540, 900).filter(ImageFilter.BoxBlur(int(10 * p)))
        else:
            p = 1 - ease_out(lin(t, 12, 12.14))
            f = zoom(f, 1 + 0.45 * p, 540, 1000).filter(ImageFilter.BoxBlur(int(10 * p)))
            f = flash(f, 0.4 * p, (255, 240, 200))
    # --- lens + grade ------------------------------------------------
    f = lens_drops(f, t, 0.45 if t >= 17 else 1.0)
    f = ImageChops.multiply(f, A["vig"])
    f = ImageChops.add(f, A["grain"][int(t * FPS) % 6], 1.0, -7)
    if t < 0.25:
        f = darken(f, t / 0.25)
    return f


def render_frame(i):
    return frame_at(i / FPS).tobytes()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(HERE, "rodo_monsoon_grip_test.mp4"))
    ap.add_argument("--offer", action="store_true", help="add 'Free tyre check this monsoon' badge to the end card")
    ap.add_argument("--stills", default="", help="comma separated seconds; writes PNG stills instead of video")
    ap.add_argument("--stills-dir", default=os.path.join(HERE, "stills"))
    ap.add_argument("--workers", type=int, default=os.cpu_count() or 2)
    args = ap.parse_args()
    OPTS["offer"] = args.offer
    build_assets()

    if args.stills:
        os.makedirs(args.stills_dir, exist_ok=True)
        for s in args.stills.split(","):
            t = float(s)
            frame_at(t).save(os.path.join(args.stills_dir, f"still_{t:05.2f}.png"))
            print("still", t)
        return

    wav = os.path.splitext(args.out)[0] + "_sfx.wav"
    sfx.build_mix(wav)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "slow", "-crf", "23",
           "-pix_fmt", "yuv420p", "-profile:v", "high", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "192k",
           "-shortest", args.out]
    enc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    ctx = mp.get_context("fork")
    with ctx.Pool(args.workers) as pool:
        for i, buf in enumerate(pool.imap(render_frame, range(NFRAMES), chunksize=2)):
            enc.stdin.write(buf)
            if i % 30 == 0:
                print(f"frame {i}/{NFRAMES}", flush=True)
    enc.stdin.close()
    enc.wait()
    os.remove(wav)
    print("wrote", args.out)


if __name__ == "__main__":
    main()
