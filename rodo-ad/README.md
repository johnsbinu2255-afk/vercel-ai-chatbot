# RODO Accessories — "Component vs Coaxial" (40 s, 9:16)

Source for the vertical educational ad: a deterministic renderer for the 3D motion
graphics, a synthesized soundtrack, and an assembly script.

| | |
|---|---|
| Format | 1080 × 1920, 30 fps, 40.0 s, H.264 + AAC 48 kHz stereo |
| Finished cut | `output/rodo_component_vs_coaxial_40s_motion.mp4` |
| Palette | black, metallic silver, electric blue (`#2f9bff`) |
| Type | Saira Condensed / Saira (headlines), Inter (labels) |

## What is finished, and what is not

**Finished** — `output/rodo_component_vs_coaxial_40s_motion.mp4` is a complete 40 s film
made entirely of motion graphics. Scenes 4–7 follow the brief; scenes 1–3 use a
motion-graphics stand-in (see below) with the same dialogue.

**Not made** — the live-action car scenes with the two actors (scenes 1–3 and the short
return to the car in scene 7). They need a generative video model and neither connected
service could run one: Higgsfield had 0 credits and Canva video generation was not on
the connected plan. `live/PROMPTS.md` has the shot brief, prompts and credit prices;
once the four clips exist, `scripts/assemble.sh <frames> live` cuts them in.

**Brand** — no logo file was supplied, so the ending uses a typographic "RODO
ACCESSORIES" wordmark. Swap in the real logo in `render/index.html` (`#logo`).

## Timeline

| Time | Brief | In the motion cut |
|---|---|---|
| 0–5 | Car drives past the showroom | Macro product shot, then "COMPONENT vs COAXIAL" title |
| 5–10 | Passenger asks the question | Same line as voice; "WHAT'S THE DIFFERENCE?" |
| 10–15 | Driver starts answering | Same line as voice; "BOTH ARE CAR SPEAKERS" → "DIFFERENT DESIGN / DIFFERENT SOUND" |
| 15–24 | Component speaker | Exploded woofer, separate tweeter, external crossover, car-placement inset |
| 24–31 | Coaxial speaker | Tweeter drops onto the centre post, 360° turn, door fit |
| 31–36 | Side-by-side comparison | Split screen, two comparison rows, emphasis follows the voice |
| 36–40 | Back to the car, logo | Comparison holds, then wordmark + "UPGRADE YOUR CAR AUDIO" / "VISIT RODO ACCESSORIES" |

Scene boundaries and dialogue start times live in `timeline.json`.

## Rebuild

```bash
cd rodo-ad && npm install            # three.js + fonts (Playwright/Chromium must be available)
pip install kokoro-onnx soundfile numpy scipy

python3 scripts/tts.py <dir with kokoro-v1.0.onnx + voices-v1.0.bin>   # dialogue -> audio/vo_raw
python3 scripts/build_audio.py motion                                   # -> audio/mix_motion.wav
python3 scripts/build_audio.py live                                     # -> audio/mix_live.wav

F=/path/to/frames                    # ~3 GB of PNGs, keep it outside the repo
node scripts/render_frames.mjs --layer base --from 0    --to 15.2 --out $F/base
node scripts/render_frames.mjs --layer main --from 12.6 --to 40   --out $F/main
node scripts/render_frames.mjs --layer main --variant solo --from 35.6 --to 37.5 --out $F/solo
scripts/assemble.sh $F motion        # or: live
```

Rendering uses software WebGL (about 2–3 s per frame on 4 cores); ranges can be split
across processes because existing frames are skipped. Preview any moment with
`node scripts/render_frames.mjs --still 16.8 --out frame.png`.

## Layout

- `render/speakers.js` — procedural speaker models (woofer with basket, spider, voice
  coil and motor; dome tweeter; pole-mounted coaxial; passive crossover; door panel)
- `render/main.js` — camera, animation and on-screen text as a function of time
- `scripts/build_audio.py` — dialogue processing, music bed, sound design, logo sting
- `audio/` — voice lines, both mixes and their stems

## Voices and music

The two voices are synthetic (Kokoro TTS: `am_puck` for the passenger, `am_michael` for
the driver). The music and every sound effect are synthesized in `build_audio.py`, so
there is nothing to license.
