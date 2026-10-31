"""Cut the RODO logo (flat yellow background) into transparent layers for animation.

Outputs (brand/):
  logo_alpha.png      whole logo, background removed
  emblem.png          R emblem + small RODO (as supplied)
  emblem_reverse.png  same, with the black parts turned white for dark backgrounds
  word_R.png, word_D.png, tyre_O1.png, tyre_O2.png   pieces of the big wordmark
  layout.json         where each piece sits in the original logo (pixels)
"""
import json
import numpy as np
from PIL import Image

src = np.asarray(Image.open('brand/rodo_logo_original.png').convert('RGB')).astype(np.float64)
H, W, _ = src.shape
border = np.concatenate([src[:8].reshape(-1, 3), src[-8:].reshape(-1, 3), src[:, :8].reshape(-1, 3), src[:, -8:].reshape(-1, 3)])
bg = np.median(border, 0)

# alpha from distance to the background colour; un-mix the background from edge pixels
d = np.sqrt(((src - bg) ** 2).sum(2))
alpha = np.clip((d - 30) / (150 - 30), 0, 1)
a = np.maximum(alpha, 1e-3)[..., None]
fg = np.clip(bg + (src - bg) / a, 0, 255)
rgba = np.dstack([fg, alpha * 255]).astype(np.uint8)

def save(arr, name):
    Image.fromarray(arr, 'RGBA').save(f'brand/{name}')

save(rgba, 'logo_alpha.png')
layout = {'size': [W, H], 'bg': bg.round().tolist()}

def crop(x0, y0, x1, y1, name, mask=None):
    piece = rgba[y0:y1, x0:x1].copy()
    if mask is not None:
        piece[..., 3] = (piece[..., 3] * mask[y0:y1, x0:x1]).astype(np.uint8)
    save(piece, name)
    layout[name] = [x0, y0, x1 - x0, y1 - y0]

yy, xx = np.mgrid[0:H, 0:W]
def circle(cx, cy, r, soft=1.5):
    return np.clip((r - np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)) / soft + .5, 0, 1)

O1 = (569.5, 703.0, 177.5)      # tyre O's: centre x, centre y, radius (measured from the rubber)
O2 = (1255.0, 703.0, 177.5)
c1, c2 = circle(*O1), circle(*O2)

# emblem lockup (R mark + small RODO)
crop(515, 85, 970, 512, 'emblem.png')
# wordmark pieces; the R loses any pixels that belong to the first tyre
crop(95, 535, 412, 868, 'word_R.png', mask=1 - c1)
crop(755, 535, 1075, 868, 'word_D.png', mask=1 - c2)
for (cx, cy, r), m, name in [(O1, c1, 'tyre_O1.png'), (O2, c2, 'tyre_O2.png')]:
    x0, y0 = int(cx - r - 4), int(cy - r - 4)
    crop(x0, y0, int(cx + r + 5), int(cy + r + 5), name, mask=m)
    layout[name + '#centre'] = [cx, cy, r]

# reverse emblem: black -> white, red stays red, mixed edge pixels interpolated
em = Image.open('brand/emblem.png'); e = np.asarray(em).astype(np.float64)
red = np.array([220, 2, 1.]); white = np.array([246, 246, 246.])
t = np.clip(e[..., 0] / red[0], 0, 1)[..., None]           # how "red" each pixel is
rev = np.where(t > .97, e[..., :3], t * red + (1 - t) * white)
save(np.dstack([rev, e[..., 3]]).astype(np.uint8), 'emblem_reverse.png')

json.dump(layout, open('brand/layout.json', 'w'), indent=1)
print(json.dumps(layout))
