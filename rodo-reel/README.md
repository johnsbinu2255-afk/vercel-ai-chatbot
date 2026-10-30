# RODO ACCESSORIES — Tyre Awareness Reel (9:16 · 1080×1920 · 30 fps · 60 s)

"YOUR TYRES ARE TRYING TO TELL YOU SOMETHING." — a fully procedural motion-graphics commercial:
3D tyre & alloy (Three.js), kinetic typography, technical HUD, synthesized score/SFX and narrated VO.

- **Final video:** `out/RODO_Tyres_Reel_1080x1920.mp4` (cover: `out/RODO_Tyres_Reel_cover.jpg`)
- **Creative + technical spec:** [PRODUCTION_BIBLE.md](PRODUCTION_BIBLE.md) — storyboard, VO script, exact on-screen copy,
  animation/camera notes, transitions, sound design, assets, render workflow.

## Rebuild

```bash
pip install numpy soundfile kokoro-onnx          # VO + audio
python3 scripts/voiceover.py kokoro-v1.0.int8.onnx voices-v1.0.bin   # optional: VO already in audio/
python3 scripts/soundtrack.py                    # -> audio/mix.wav + stems
node scripts/render.mjs                          # needs playwright + ffmpeg -> out/video_silent.mp4
bash scripts/finalize.sh                         # -> out/RODO_Tyres_Reel_1080x1920.mp4
```

Preview the live animation: `cd web && python3 -m http.server` then open `http://localhost:8000/`
and call `renderFrame(12.5)` in the console. Retime everything from `web/timeline.json`.
