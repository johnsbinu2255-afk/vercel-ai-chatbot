# Rodo Tyres – Monsoon Grip Test (Instagram Reel)

`rodo_monsoon_grip_test.mp4` is a 20 s vertical reel (1080×1920, 9:16, 30 fps, H.264 + AAC). It uses sound effects only, with no music.

| Time | Scene | Transition out |
|---|---|---|
| 0–3 s | Storm opening: night road, rain, lightning, push-in, "Kerala Monsoon is here…" | Lightning-flash cut |
| 3–6 s | Worn bald tyre aquaplaning, red warning pulse ⚠, "Worn tyres = NO GRIP" | Whip pan |
| 6–8 s | Top-view skid, 1 s slow motion, screen crack | Glitch |
| 8–12 s | New tyre with yellow glow, zoom into tread, water flows out, ✅ "New tyres = STRONG GRIP" | Zoom punch |
| 12–14 s | Car in headlights with slow-mo splashes, "Kerala rain needs the RIGHT tyres." | Whip pan |
| 14–17 s | Apollo / Bridgestone / Yokohama / JK slam in, "Direct Dealer • Direct Warranty" | Lightning-flash cut |
| 17–20 s | Rodo Tyres logo glow, "Check your tyres before the rain!", Piravom & Mulanthuruthy, ☎ 9747691237 (pulsing) | — |

Every scene also has raindrops on the "lens", a vignette and film grain.

## Re-rendering

Requires Python 3 with `numpy` and `Pillow`, plus `ffmpeg`. A render takes about 2–3 minutes on 4 cores.

```bash
python3 render.py                     # -> rodo_monsoon_grip_test.mp4
python3 render.py --offer             # adds a "FREE TYRE CHECK THIS MONSOON" badge on the end card
python3 render.py --out september.mp4 # pick another output name
python3 render.py --stills 1,4.8,19.5 # PNG stills for a quick review
```

### Using official logos

The brand cards and the Rodo logo are drawn as text by default. To use the real artwork, drop transparent PNGs into `assets/logos/` with these names and re-render:

- `apollo.png`
- `bridgestone.png`
- `yokohama.png`
- `jk.png`
- `rodo.png`

Use only logo files that you are authorised to use as a dealer.

## Files

- `render.py`: draws every frame (procedural rain, lightning, tyres, cars, text and transitions) and encodes the video.
- `sfx.py`: synthesises the sound effects (rain, thunder, skid, beeps, screech, glass crack, glitch, whooshes, grip thud, bass hits, dings).
