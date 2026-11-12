# Live-action shots — generation brief

The car scenes (1, 2, 3 and the 1.4 s return to the car in scene 7) need a generative
video model. Nothing in this folder is generated yet: the Higgsfield workspace had
0 credits and Canva video generation was not available on the connected plan.

Drop the finished clips here and run `scripts/assemble.sh <frames-dir> live`:

| File     | Slot in the film   | Length needed | Content |
|----------|--------------------|---------------|---------|
| `s1.mp4` | 00:00 – 00:05      | 5.0 s         | Exterior drive past the showroom |
| `s2.mp4` | 00:05 – 00:10      | 5.0 s         | Through the window, passenger asks |
| `s3.mp4` | 00:10 – 00:15.2    | 5.2 s         | Driver answers (medium close-up) |
| `s7.mp4` | 00:35.6 – 00:37.5  | 1.9 s         | Both friends smiling |

9:16, 1080×1920 preferred (anything else is scaled and centre-cropped). The clips' own
audio is ignored; the film's soundtrack is `audio/mix_live.wav`.

## Recommended route (Higgsfield, Seedance 2.5)

Price checked on the day this was written: one 17 s generation costs **119 credits at
720p** or **272 credits at 1080p**; a 5 s 720p clip costs 35. Reference stills
(`gpt_image_2_6`) cost about 0.25 credits each.

1. **Reference stills** (keeps faces, clothes, car and light identical in every shot)
   - *Cast and cabin*: "Photorealistic film still, interior of a modern premium sedan
     with black leather and brushed-aluminium trim, soft daylight. Two South Asian men
     in their mid-twenties in the front seats. Driver: short black hair, trimmed beard,
     navy crew-neck T-shirt, silver wristwatch, relaxed and confident. Passenger: short
     textured black hair, clean-shaven, light grey overshirt over a white T-shirt,
     curious and friendly. Seen from the dashboard, both faces clearly visible."
   - *Exterior*: "Photorealistic automotive commercial still, metallic silver premium
     sedan, front three-quarter view, driving on a clean sunlit road past a modern
     car-accessories showroom with a glass front. Above the entrance, a black sign with
     white capital letters reading exactly: RODO ACCESSORIES."
2. **One 17 s generation** (`mode: omni_reference`, both stills as `image_references`,
   `audio/vo_raw/p1.wav` and `d1.wav` as `audio_references` so the lips follow the same
   voices used in the rest of the film), then cut it into the four files above.

```
Premium automotive commercial, photorealistic, cinematic natural sunlight, shallow depth
of field, colour palette black, metallic silver and subtle electric blue. Same two men,
same clothes, same car and same light in every shot.

[0-5 s] Wide tracking shot, front three-quarter view of the silver sedan gliding along a
sunlit road. Cut to a close-up of the rotating alloy wheel with reflections on the
asphalt. The car passes the showroom; the sign "RODO ACCESSORIES" is clearly readable.
The camera drifts towards the passenger-side window.

[5-10 s] In one continuous move the camera passes through the passenger window into the
cabin. Music is playing. The passenger nods to the beat, then turns to the driver and
says: "Bro, what's the difference between a component speaker and a coaxial speaker?"

[10-15 s] Medium close-up of the driver, hands on the wheel. He smiles slightly, glances
over and answers confidently: "Good question! Both are car speakers, but their design
and sound performance are different."

[15-17 s] Two-shot from the dashboard: both friends smiling and nodding to the music.

No subtitles, no on-screen text except the showroom sign, no logos on the car.
```

The blue sound-wave overlay at the end of scene 3 and the iris transitions into and out
of the 3D section are already part of the rendered `main` layer, so they sit on top of
whatever footage is supplied.
