# RODO TYRES: Normal Air vs Nitrogen (Instagram Reel)

A 33-second vertical motion graphics video (1080×1920, 30 fps, 990 frames), built with [Remotion](https://www.remotion.dev). It uses sound effects only, with no music and no voiceover.

**The video:** `video/rodo-nitrogen-vs-normal-air.mp4` (H.264 + AAC, BT.709 colour). The sound is levelled to −16 LUFS, with peaks below −1.8 dBFS, so nothing clips.

## Scenes

Each scene is its own component in `src/scenes/`, and it holds its own pictures and sounds. `src/Reel.tsx` places them on the timeline.

| Time | File | What happens |
| --- | --- | --- |
| 0:00–0:03 | `Scene1Hook.tsx` | Tyre rolls in from the right, skids and spins inside a nitrogen swirl. "NORMAL AIR or NITROGEN?" slams in, with a camera punch to 115%. A yellow line then slices the screen in two. |
| 0:03–0:06 | `Scene2Setup.tsx` | Grey tyre vs blue tyre, labels drop in, and "2 Key Differences" flips in. |
| 0:06–0:14 | `Scene3Pressure.tsx` | "1 Holds Pressure Longer". Shows the tyre-wall close-up, gauges (32→26 vs 32→31 PSI), sag, warning, three pump refills, calendar and tick, then the key message. |
| 0:14–0:23 | `Scene4Heat.tsx` | "2 Less Heat, Longer Tyre Life". Shows the hot road, thermometers, heat waves, tread wear, the tyre life bars and "LAST LONGER". |
| 0:23–0:26 | `Scene5Summary.tsx` | Comparison table row by row, then everything shrinks to a point of light. |
| 0:26–0:33 | `Scene6Finale.tsx` | Logo lands with a shockwave, the slogan types in, the dealers grid and seal appear, then contact details. |

Transitions between scenes are in `src/transitions/`: the "1" and "2" zoom-throughs and the white flash. The slice and the shrink-to-light happen inside scenes 1 and 5.

Every scene uses its own frame count, where 0 is the scene's first frame. To change when something happens, edit the `T` (timing) table at the top of the scene file. The sound attached to that moment moves with it.

The watermark (0:00–0:30, bottom right, 400 px from the bottom) is in `src/components/Watermark.tsx`. All text stays between 250 px from the top and 350 px from the bottom.

## Your logos and sounds

- **Logos:** put PNG files in `assets/logos/`, named `rodo.png`, `jk.png`, `apollo.png`, `bridgestone.png`, `yokohama.png`, `continental.png` and `michelin.png`. A missing brand logo is shown as its name in bold text instead. Your Rodo logo is already there. The watermark uses a white cut-out of it, made automatically.
- **Sound effects:** put a file named after the sound into `assets/sfx/` (`.wav`, `.mp3`, `.ogg`, `.m4a` or `.flac`) and it replaces the made-in-code version. It's levelled to sit in the mix like the original. Sounds that don't have a file are synthesised by `scripts/sfx/recipes.mjs`, so the video is complete without any downloads.

| Sound name | Used for |
| --- | --- |
| `rumble`, `screech`, `swirl` | Tyre rolling in, skid, nitrogen swirl (0:00–0:01) |
| `bass-impact` | Heavy hits on the hook text, key message and "LAST LONGER" |
| `pop` | Small text and contact lines |
| `slice` | Yellow line splitting the screen |
| `whoosh` | Tyres appearing, title cards, merges, table slide |
| `thud`, `flip-click`, `ding-ding` | Label drops, "2" flip, game-show ding |
| `deep-whoosh`, `bass-hit` | Number zoom-throughs and title cards |
| `hiss`, `whirr`, `beep`, `pump`, `hum`, `page-flip`, `chime` | Difference 1 |
| `road-roll`, `sizzle`, `rise-whine`, `cool-whoosh`, `rising-whoosh`, `ting` | Difference 2 |
| `camera-flash`, `buzz`, `ding`, `reverse-whoosh` | Flash, table X and ticks, shrink to light |
| `boom`, `type-click`, `shimmer`, `ribbon`, `hit`, `stamp`, `bass-tail` | Finale |

## Commands

You need Node 18+. Run this once:

```bash
cd nitrogen-reel
npm install
```

Then:

```bash
npm run studio          # preview and scrub the video in Remotion Studio
npm run render          # full render -> video/rodo-nitrogen-vs-normal-air.mp4 (about 6 minutes on 4 cores)
npm run render:sound    # after changing only sounds: re-mix the audio (about 2 minutes) and keep the last picture
npm run stills -- 2.0 12.5 30.4   # PNG frames at those seconds, in out/stills/
```

Remotion downloads its own headless Chrome the first time. To use a Chrome you already have, set `REMOTION_BROWSER=/path/to/chrome`.

How the sound is finished (`scripts/master.mjs`): Remotion mixes the scene sounds without loss. The mix is then measured to the BS.1770 loudness standard and levelled to −16 LUFS. A look-ahead limiter catches peaks above −3 dB, including the peaks between samples that AAC encoding would otherwise push over. The last 0.35 s fades to silence.

## Licences

- **Remotion** is free for individuals and for companies with up to 3 employees. A larger company needs a [Remotion Company License](https://www.remotion.pro/license).
- **Fonts:** Bebas Neue and Montserrat, under the SIL Open Font License (`public/fonts/OFL.txt`).
- **Brand names** are trademarks of their owners.
