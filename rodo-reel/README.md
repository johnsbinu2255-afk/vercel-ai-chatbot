# Rodo Tyres Instagram Reel

A 22-second vertical (1080×1920, 30 fps) motion graphics ad for Rodo Tyres and Accessories. It uses sound effects only, with no music.

## The videos

| File | End card |
| --- | --- |
| `video/rodo-tyres-reel.mp4` | Three contact cards, as in the brief: Piravom tyre shop, Mulanthuruthy tyre shop, Piravom car accessories |
| `video/rodo-tyres-reel-shared-number.mp4` | Two cards: one tyre line for both shops (97476 91237) and the accessories shop (62353 56776) |

Use the second one if both tyre shops really share 9747691237. Everything else is the same in both.

Both files are H.264 + AAC with BT.709 colour, and the sound is normalised to −14 LUFS for Instagram.

A timed Malayalam voice-over script for both versions is in `voiceover-ml.md`.

## Scenes

| Time | Scene | Transition out |
| --- | --- | --- |
| 0–3 s | Tyre rolls in and skids to a stop, then RODO TYRES slams in | Zoom punch |
| 3–6 s | India map zooms to Kerala, then to Ernakulam. Pins drop on Piravom and Mulanthuruthy. "3 SHOPS IN ERNAKULAM" | Whip pan |
| 6–11 s | Apollo, Bridgestone, Yokohama and JK Tyre slam in. "Direct Dealer, Direct Warranty" | Glitch |
| 11–15 s | Gauge counts up to 15 YEARS, then Experienced Staff and Best Price with red slashes, then the Bajaj Finance EMI badge | Tyre-spin wipe |
| 15–17 s | Flash cuts: Android screens, subwoofers, LED headlights, speakers | Zoom out to black |
| 17–22 s | Rodo logo with yellow glow, contact cards, VISIT TODAY! with pulsing numbers | — |

Every cut has a whoosh. Sound effects follow the brief: tyre screech, bass hits, pin pops, logo impacts, dings, counter ticks, shutter clicks, card pops and a final bass drop.

## Changing the text, numbers or logos

- Wording and phone numbers are in `src/config.js`.
- No logo files were supplied, so the brands and the Rodo name are drawn as text. To use the real logos, add PNG files to `logos/` with these names and render again: `rodo.png`, `apollo.png`, `bridgestone.png`, `yokohama.png` and `jk-tyre.png`. Brand logos sit on a white panel. The Rodo logo sits on black, so a transparent background works best for it.
- Timing for both picture and sound is in `src/timeline.js`.

## Preview in a browser

```bash
cd rodo-reel
python3 -m http.server 8000
```

Open <http://localhost:8000> and press **Play**. The menu switches between the two end cards.

## Render the MP4

You need Node 18+ and ffmpeg. Then, once:

```bash
cd rodo-reel
npm install
npx playwright install chromium
```

To render:

```bash
npm run render                             # video/rodo-tyres-reel.mp4
npm run render:shared-number               # video/rodo-tyres-reel-shared-number.mp4
node scripts/render.cjs --stills=1.5,5.4   # single PNG frames, for checking
```

A full render takes about a minute and a half on four cores.

## How it is made

`index.html` loads plain scripts, with no build step:

- `src/scenes.js` draws each scene on a canvas as a pure function of time, so any frame can be rendered on its own.
- `src/main.js` adds the transitions and the camera shake on impacts.
- `src/audio.js` synthesises every sound effect with the Web Audio API.
- `scripts/render.cjs` captures each frame in headless Chromium, and ffmpeg encodes the result.

## Credits

- The map uses India's official boundary (Survey of India composite) and the Kerala district boundaries from [DataMeet](https://github.com/datameet/maps) (CC BY 4.0 / CC BY 2.5 IN). The map scene credits it on screen. `scripts/prepare-map.py` rebuilds `src/map-data.js` from those files.
- Fonts: [Anton](https://github.com/googlefonts/AntonFont) and [Barlow Condensed](https://github.com/jpt/barlow), both under the SIL Open Font License (`fonts/OFL.txt`).
- Brand names are trademarks of their owners.
