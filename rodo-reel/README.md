# RODO Tyres & Accessories — "4 Signs You Need a Wheel Alignment"

A 30-second vertical reel (1080×1920, 30 fps, H.264 + AAC) for Instagram Reels, Facebook Reels and YouTube Shorts.
Every frame is drawn in code (`reel.html`), so the timing is exact and you can change any text, colour or timing and render it again.

| File | What it is |
|---|---|
| `RODO_Wheel_Alignment_Reel_NoVO.mp4` | Finished video with music and sound effects, **without the voice-over yet** |
| `reel.html` | The animation. Open it in a browser to watch a live preview |
| `render.js` | Renders `reel.html` frame by frame to MP4 (Playwright + ffmpeg) |
| `sfx.py` | Builds the music bed and all sound effects, timed to the scenes |
| `add_vo.py` | Mixes in a voice-over recording, line by line, with the music ducked under it |

## Timeline

| Time | Scene | Number/text |
|---|---|---|
| 0:00–0:03 | Laser scan reveals the car; camera pushes in on the glowing front wheels | IS YOUR CAR LOSING ITS DIRECTION? |
| 0:03–0:09 | Chase view: the car drifts off line, red arrows, a freeze-frame and a warning sign | **01** CAR PULLING TO ONE SIDE? |
| 0:09–0:15 | A steering wheel vibrates with shock waves and a live vibration graph | **02** FEELING STEERING VIBRATIONS? |
| 0:15–0:21 | A rotating tyre zooms in to a side-by-side of normal and worn tread, with the worn edge outlined in glowing red | **03** TYRES WEARING UNEVENLY? |
| 0:21–0:25 | Driver's view: the steering wheel is 17.8° off centre on a straight road, then turns back to centre (✓ CENTRED) | **04** STEERING WHEEL NOT STRAIGHT? |
| 0:25–0:30 | 4-wheel laser alignment bay where each wheel's toe angle settles to 0.00°, then the RODO logo reveal | DON'T IGNORE THE SIGNS → GET YOUR WHEEL ALIGNMENT CHECKED! · VISIT RODO TYRES & ACCESSORIES · ERNAKULAM, KERALA |

Transitions follow the script: fast zoom, whip-pan, spinning-tyre wipe, tyre-rotation spin, and a zoom-out to the alignment machine.

## Rebuild

```bash
node render.js video video_silent.mp4          # ~2 min
python3 sfx.py sfx_music.wav
ffmpeg -i video_silent.mp4 -i sfx_music.wav -af loudnorm=I=-14:TP=-1 -c:v copy -c:a aac -b:a 192k -shortest out.mp4
node render.js stills 2,6,12,18,23,29 stills   # preview frames
```

## Adding the voice-over

Record (or generate) the full script as **one take, with a clear pause between each line**, then run:

```bash
python3 add_vo.py vo.mp3 video_silent.mp4 sfx_music.wav RODO_Wheel_Alignment_Reel.mp4
```

The script splits the take at its pauses into the 7 lines and places each line at the start of its scene (0.35s, 3.45s, 9.45s, 15.45s, 21.2s, 24.55s and 26.15s), speeding a line up slightly (at most 1.25×) only if it would run into the next one. It turns the music down under the voice and sets the loudness to −14 LUFS for social media.

## Instagram caption

🚗 IS YOUR CAR DRIVING STRAIGHT?

Incorrect wheel alignment can affect your driving experience and cause uneven tyre wear.

Look out for these 4 warning signs:
1. Car pulling to one side
2. Steering wheel vibrations
3. Uneven tyre wear
4. Crooked steering wheel

Don't wait until the problem gets worse!

📍 For professional wheel alignment service, visit RODO TYRES & ACCESSORIES, ERNAKULAM, KERALA.

Your tyres deserve the right alignment. Drive safer with RODO!

#RODOTyres #WheelAlignment #WheelAlignmentErnakulam #TyresErnakulam #CarAccessoriesKerala #TyreShopErnakulam #CarCareKerala #KeralaCars #Ernakulam
