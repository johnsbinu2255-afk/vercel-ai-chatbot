# Colour grading and transitions

## Colour grades (works in CapCut, InShot, Premiere, DaVinci, or via `scripts/make_reel.py --grade ...`)

| Preset | Best for | Look | CapCut-style manual values |
|---|---|---|---|
| `night_neon` | headlights, ambient light, 360 screen at night | deep blacks, glowing blues/magentas, vignette | Contrast +20, Saturation +30, Shadows -15, Highlights -10, Temp -10, Tint +8, Vignette 25 |
| `teal_orange` | daytime, any car, general default | cinematic teal shadows, warm skin and paint | Contrast +12, Saturation +25, Temp +5, Shadows tint teal, Highlights tint orange, Sharpen 20 |
| `clean_bright` | infotainment, interiors, bright showroom | crisp, airy, clean | Brightness +5, Contrast +8, Saturation +12, Sharpen 25 |
| `moody_dark` | premium/luxury cars, black cars | dark, high contrast, dramatic | Contrast +25, Brightness -8, Saturation +8, Vignette 35 |

Rules that matter more than the preset:
- Grade ALL clips with the same preset, otherwise cuts look like different videos.
- Fix exposure first (clips too dark or blown out), then apply the look.
- Don't push saturation past ~+35. Car paint and skin go orange and cheap.
- Keep whites white on the headlight reveal. If the new LED looks yellow or blue, that's a white-balance problem, fix it before grading.

## Transitions that suit this niche

Use cuts on the beat for most of the video, and a stylised transition at moments of change (before to after, process to reveal).

| Moment | Use | Why |
|---|---|---|
| Between normal shots | hard cut on beat, or 0.25s fade/slide | stays energetic |
| Before to After | whip pan / swipe, flash, or glitch | signals the transformation |
| Reveal | zoom-in punch + flash on the beat drop | gives the payoff a hit |
| Outro | fade to black then logo | clean ending |
| Speed ramp | slow-mo into fast on a part install | satisfying "tech" feel |

Don't use more than 3 different transition styles in one reel. A different effect on every cut looks like a template, not a brand.

## Motion graphics ideas (easy, high impact)
- **Animated title** at 0.2s: 3-5 words, bold, slides/scales in (e.g. "HEADLIGHT UPGRADE")
- **Callout label** with a line pointing at a part ("Projector lens", "360 camera", "Android 13")
- **Before/After tags** that pop in and out
- **Price or offer sticker** in the last 5s ("Fitting FREE this week", only if true)
- **Logo sting + phone number** end card, 3s
- **Light streaks / flares** overlay (screen blend) on the reveal

Keep text inside the safe zone: leave ~150px at top and ~380px at bottom so Instagram's UI doesn't cover it.

## Pacing
- 20-40s total. 25-30s is the sweet spot.
- Average shot length 1-2s. Slow down only for the reveal.
- First 2 seconds decide whether people keep watching, so open with the best visual, not the shop logo.
