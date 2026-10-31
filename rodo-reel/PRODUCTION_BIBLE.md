# RODO ACCESSORIES — "Your tyres are trying to tell you something."

Premium automotive motion-graphics reel. Instagram Reels, 9:16, 1080 × 1920, 30 fps, 60 s, English.
All picture is procedural 3D (Three.js) + kinetic typography + a technical HUD layer. Nobody appears on camera.
All audio is synthesized (music bed and sound effects), and the voice-over comes from an offline neural TTS
voice (a deep male narrator blend, pitched down about 1 semitone).

**Look:** black and graphite studio, metallic silver, realistic rubber, and red used only as an accent or warning colour.
**Type:** Inter Display Black/ExtraBold for headlines, Inter for body text, JetBrains Mono for HUD readouts.
**Safe zones:** all type sits between y = 260 and y = 1500 px. The optical centre is x = 510 px, which keeps type clear of the Reels button column.

---

## 1. Scene-by-scene storyboard

| # | Time | Picture | Camera | Purpose |
|---|------|---------|--------|---------|
| 1 | 0.0–6.4 | Black → a red **TPMS tyre-pressure warning light** flickers on like a dashboard lamp → push *through* it → a 3D wheel emerges from darkness on a red rim light → two red **sonar pulse rings** ripple off the tyre in time with sub hits → slammed headline | Slow dolly-in from 8.6 m to 6 m, slight roll, wheel rotating | Thumb-stopper: a familiar warning symbol, a beep, motion, then the question |
| 2 | 6.4–16.0 | Macro of the tread rolling toward lens. Tread blocks **physically shave down** (displacement shader) while a cut-away gauge counts 8.0 → 1.6 mm, then turns red/hatched ("WORN"). Rain streaks and a cold light shift arrive for "wet roads" | Grazing top-front macro, slow drift and roll, micro-shake in the rain | Show the wear happening |
| 3 | 16.0–26.0 | Wheel spins down and stops with damage at 2 o'clock. Inspection mode: viewfinder brackets, a red scan beam sweeps the sidewall (0–100 %), then **CRACK** is circled and **BULGE** is ringed (a real geometry bulge with an emissive crack) | Wide 3/4 view → push-in on the damage | Professional technical inspection |
| 4 | 26.0–36.0 | **Top-down** tread view with a heat-map overlay. Three wear patterns morph in the geometry: one-sided edge (ALIGNMENT), both shoulders (INFLATION), cupping/patches (SUSPENSION). Each one lights its cause pill and red bracket | Overhead, slow descent, roll settles to 0° | Technical comparison |
| 5 | 36.0–49.0 | White flash and light-sweep into a **bright hex-lit workshop** with a glossy floor. Five beats, each with a whip transition: 01 pressure check (valve callout, 0 → 35 PSI), 02 tread probe drops into a groove (7.8 mm), 03 the rim slides into the tyre (*clunk*, "SEATED"), 04 balancer spin with wobble damping out and a weight clipped on (18 g → 0 g, "BALANCED ✓"), then a hero roll of the new tyre | Varied: 3/4, macro, rear 3/4, face-on, low orbit | The solution, in a brighter mood |
| 6 | 49.0–60.0 | Back to dark. Red halo and dust. Headline lines rise. Riser → **impact** → the camera pulls up and back, the wheel becomes the logo mark (a chrome ring with 72 ticks draws on and a red marker orbits), the metallic RODO wordmark tracks in with a sheen sweep, then ACCESSORIES, a red rule, the tagline, a CTA pill and the category line. Clean hold for the loop | Front 3/4 → crane up | Brand reveal |

## 2. Voice-over script (deep, confident male voice, unhurried)

| Starts | Line |
|--------|------|
| 0.55 s | "Your car gives you warning signs every day. But there's one thing most drivers forget to check." |
| 7.60 s | "Your tyre tread wears down over time. When it becomes too worn, your grip on the road can be seriously affected." |
| 17.30 s | "Notice a bulge, crack or unusual damage on your tyre? Never ignore it. Get it inspected by a professional." |
| 27.50 s | "Uneven tyre wear can indicate incorrect alignment, inflation problems or suspension issues." |
| 37.50 s | "Regular tyre inspections help identify problems early. Choose the right tyres, maintain the correct pressure, and never compromise on safety." |
| 50.60 s | "Your journey deserves better care. Visit Rodo Accessories, where every journey begins with the right choice." |

The lines total about 42 s of speech, which leaves room for music and sound-effect moments. When re-recording with a human voice artist, keep the start times above. Each line fits its window with 0.5–1.5 s to spare.


### 2b. Malayalam voice-over (current version)

The released video uses this Malayalam narration. It is generated offline with the male Piper voice "Arjun" by `scripts/voiceover_ml.py`. Start times are in `web/timeline.json`, and `"vo_prefix": "vo_ml_"` selects these files.

| Starts | Line |
|--------|------|
| 0.35 s | നിങ്ങളുടെ ടയറുകൾ നിങ്ങളോട് ചില കാര്യങ്ങൾ പറയുന്നുണ്ട്. അത് ശ്രദ്ധിക്കേണ്ട സമയമാണ്. |
| 7.45 s | ടയർ ട്രെഡിന്റെ തേയ്മാനം ശ്രദ്ധിക്കുക. ഗ്രിപ്പ് കുറയുന്നത്, പ്രത്യേകിച്ച് നനഞ്ഞ റോഡുകളിൽ, അപകടസാധ്യത വർധിപ്പിക്കും. |
| 16.7 s | സൈഡ്‌വാൾ കേടുപാടുകൾ. ടയറിന്റെ വശങ്ങളിലുള്ള വിള്ളലുകൾ, മുറിവുകൾ, വീക്കങ്ങൾ എന്നിവ ഒരിക്കലും അവഗണിക്കരുത്. |
| 26.6 s | അസമമായ ടയർ തേയ്മാനം. വീൽ അലൈൻമെന്റ്, ടയർ പ്രഷർ, സസ്പെൻഷൻ എന്നിവ പരിശോധിക്കുക. |
| 36.5 s | പതിവായ പരിശോധന. ശരിയായ പരിപാലനം. വിദഗ്ധരുടെ ഫിറ്റിംഗ്. ശരിയായ ടയറുകൾ തിരഞ്ഞെടുക്കൂ, സുരക്ഷയിൽ ഒരിക്കലും വിട്ടുവീഴ്ച ചെയ്യരുത്. |
| 49.5 s | നിങ്ങളുടെ ഓരോ യാത്രയും മികച്ച പരിചരണം അർഹിക്കുന്നു. സുരക്ഷിതമായി ഡ്രൈവ് ചെയ്യൂ. റോഡോ ടയേഴ്സ് സന്ദർശിക്കൂ. |

On-screen text stays in English. The end screen now reads **RODO TYRES** with the CTA **VISIT RODO TYRES**. The tyre brands shown are JK TYRE · APOLLO · BRIDGESTONE · YOKOHAMA · MICHELIN · CEAT · MRF.

## 3. On-screen text, exact copy

**Scene 1:** `⚠ SYSTEM ALERT · CHECK TYRES` (mono, typed) → `YOUR TYRES` / `ARE TRYING TO` / `TELL YOU` / **`SOMETHING.`** (red)

**Scene 2:** `01` (outline, then a chrome fill) `WORN-OUT TREAD`. HUD: `TREAD DEPTH · CUTAWAY`, `8.0 MM → 1.6 MM`, `HEALTHY → WEARING → WORN`. Supporting text: "Less tread can mean **less grip,** especially on *wet roads.*"

**Scene 3:** `02` `SIDEWALL DAMAGE`. HUD: `INSPECTION MODE` → `SCANNING SIDEWALL nn%` → `SCAN COMPLETE · 2 ISSUES`, `CRACK / DETECTED`, `BULGE / DETECTED`. Supporting text: "**Cracks, cuts** and **bulges** should *never be ignored.*"

**Scene 4:** `03` `UNEVEN TYRE WEAR`. Pills: `ALIGNMENT` `INFLATION` `SUSPENSION`. Descriptors: `ONE-SIDED EDGE WEAR` / `SHOULDER WEAR · BOTH EDGES` / `CUPPING · PATCHY WEAR`. Supporting text: "Check your **alignment, inflation** and **suspension.**"

**Scene 5:** `REGULAR` / `INSPECTION` → `PROPER` / `MAINTENANCE` → `THE RIGHT` / `TYRES`. Service cards:
- `SERVICE 01/04 · PRESSURE CHECK · 35 PSI · SET ✓`
- `02/04 · TREAD MEASUREMENT · 7.8 MM · HEALTHY ✓`
- `03/04 · PROFESSIONAL FITTING · SEATED · DONE ✓`
- `04/04 · WHEEL BALANCING · 0 G · BALANCED ✓`

Brands: `TYRES FROM` · `JK TYRE · APOLLO · BRIDGESTONE` · `YOKOHAMA · MICHELIN · CEAT · MRF`. These are typeset only, with no logos, and imply no authorisation.

**Scene 6:** `YOUR JOURNEY` / `DESERVES` / **`BETTER CARE.`** → **`RODO`** (metallic) / `TYRES` / `DRIVE SAFE. DRIVE CONFIDENT.` / [`VISIT RODO TYRES`] / `TYRES · ACCESSORIES · INFOTAINMENT · AUDIO · CAR CARE`

The reel invents no awards, certifications, warranties or claims of manufacturer authorisation. 35 PSI, 7.8 mm and the tyre size are illustrative readings only.

## 4. Animation and camera notes

- **Hero tyre:** a lathe-built cross-section with 768 × 279 vertices. The canvas-generated tread pattern drives real displacement, the normal map and the cavity colour. The sidewall carries moulded lettering (225/45 R18 95W, TUBELESS RADIAL, load and pressure line). A custom shader adds:
  - global wear, left/centre/right shoulder wear and cupping, all of which flatten the geometry and the normals
  - a heat-map emissive
  - a crack mask with a glow
  - a CPU-morphed sidewall bulge
- **Alloy:** a concave 5-twin-spoke extrusion in clear-coated silver, a gunmetal barrel, a polished lip, lug nuts, a valve stem, a drilled disc and a red caliper (the caliper does not spin).
- **Lighting:** physically based spots for key, top, white rim and red kicker, plus PMREM softbox environments (dark studio and workshop). The setup uses ACES tone mapping, Unreal bloom, a vignette, film grain and dust particles. Scene 2 adds rain streaks and Scene 1 adds pulse rings.
- **Typography motions:**
  - *slam:* scale 1.45 → 1, blur 22 → 0 px, exponential ease-out
  - *rise:* masked per-character, 108 % → 0 %, 35 ms stagger
  - *words:* masked per-word, 70 ms stagger
  - *track:* letter-spacing collapses with the blur
  - *type:* mono typewriter
  - *pop:* back-ease scale
  - Exit for all styles: up 70 px, blur and fade over 0.38 s
- **Numbers 01/02/03:** the outline flies in from the left, then a chrome fill wipes left to right, and a red rule grows under the label.

## 5. Transitions

| Time | Transition |
|------|------------|
| 6.4, 16.0, 26.0, 36.0, 49.0 | **Whip cut.** About 0.22 s each side: a canvas blur of up to 26 px, a 140 px vertical slide, a 6 % scale and a light-streak sweep, with a whoosh. Scene directions alternate (down, up, down…) |
| 36.0 | Whip plus a **white flash** (screen blend) that cross-fades the dark backdrop into the workshop and switches the environment map |
| 39.0, 41.3, 43.8, 46.2 | Fast 0.16 s micro-whips between the service beats |
| 53.45 | Brand **impact**: flash, bloom spike, the camera cranes up and the wordmark tracks in |
| Text inside each scene | Exits on the scene's last ~0.4 s so the cut lands on clean picture |

## 6. Sound design (`scripts/soundtrack.py`, timings from `web/timeline.json`)

- **Music:** 92 BPM in D minor (Dm–B♭–F–C):
  - sub drone (D1 + A1) from frame 0
  - filtered saw pulse bass on eighth notes from the 2.0 s hook impact
  - detuned pads from Scene 2
  - kick on beats 1 and 3, eighth-note hats
  - brighter filter and claps in the Scene 5 workshop
  - breath (drop-out) before 36.0 s and 53.45 s
  - D-major lift chord under the logo
- **SFX:**
  - engine idle with a rev blip (0–7 s)
  - TPMS chime (0.25 s, 0.85 s)
  - risers (0.9 s, 52.2 s)
  - whooshes on every cut
  - sub impacts on 2.0, 3.7, 7.0, 16.8, 26.8 and 53.45 s
  - metallic HUD ticks
  - heartbeat thumps with the pulse rings
  - scanner sweep (17.5 s)
  - rain (11.2–16 s)
  - pneumatic hiss (pressure check)
  - probe and fitting clunks
  - balancer motor whirr
  - shimmer on the workshop flash and the logo
  - final low tail
- **Mix:**
  - The VO is pitched down about 1 semitone, EQ'd (+3 dB at 140 Hz, +2.5 dB at 3.2 kHz) and lightly compressed.
  - Under the voice, music ducks 60 % and SFX duck 40 %. The VO sits about 8 dB above the bed.
  - A shared synthetic hall reverb is used, with a soft-clip limiter.
  - Delivery is −14 LUFS integrated and −1.5 dBTP.

## 7. Asset requirements

Everything ships in this folder. No external assets are needed to rebuild.

| Asset | Source |
|-------|--------|
| 3D tyre, alloy, brake, workshop backdrop, HUD | Procedural (`web/js/tyre.js`, `main.js`, `hud.js`) |
| Three.js r160 + post-processing | Vendored in `web/vendor` (MIT) |
| Fonts: Inter / Inter Display, JetBrains Mono | OFL, from Google Fonts. These must be installed locally |
| Voice-over | `audio/vo_*.wav`, from Kokoro-82M TTS (Apache-2.0) via `scripts/voiceover.py` |
| Music + SFX | Synthesized by `scripts/soundtrack.py` |
| **Optional upgrades** | the real RODO logo as SVG (swap into Scene 6), a professional male VO session using the script and start times in §2, and photographed workshop plates for Scene 5 |

## 8. Editing and rendering

1. `python3 scripts/voiceover.py <kokoro.onnx> <voices.bin>` generates the VO lines (or drop in human recordings with the same file names).
2. `python3 scripts/soundtrack.py` writes `audio/mix.wav` plus stems (`stem_music_sfx.wav`, `stem_voiceover.wav`).
3. `node scripts/render.mjs` runs headless Chromium, calls `renderFrame(t)` for every frame (deterministic) and pipes JPEG q95 into x264 CRF 16, which writes `out/video_silent.mp4`.
   - `--stills 2.2,21,57` renders preview PNGs.
   - `--from/--to` renders a section.
   - `--workers N` splits the render into parallel chunks.
   - `?gl=1.0` in the page URL renders the 3D layer at full resolution. The default is 0.75 for speed on software GL; type is always rendered at 1080p.
4. `bash scripts/finalize.sh` muxes the audio with loudnorm to −14 LUFS and AAC 256k, and writes the master, a 720p preview and a cover JPG.
5. Upload the master as a Reel. Choose a cover frame around 4.5 s (the headline frame). Turn on IG auto-captions or burn in captions from §2 if desired.

To retime anything, edit `web/timeline.json` (scene windows, VO start times, SFX events). Picture and sound both read from it.
