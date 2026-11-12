#!/usr/bin/env bash
# Assembles the final 1080x1920 / 30 fps / 40 s film from rendered frames + soundtrack.
#
#   scripts/assemble.sh <frames-dir> motion   # all-motion-graphics cut (no footage needed)
#   scripts/assemble.sh <frames-dir> live     # uses live/s1.mp4 s2.mp4 s3.mp4 s7.mp4 for the car scenes
#
# <frames-dir> holds base/ main/ solo/ produced by scripts/render_frames.mjs:
#   base  --layer base               --from 0    --to 15.2   (motion cut only)
#   main  --layer main               --from 12.6 --to 40
#   solo  --layer main (variant=solo) --from 35.6 --to 37.5  (motion cut only)
set -euo pipefail
FR="${1:?frames dir}"; MODE="${2:-motion}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/output"; mkdir -p "$OUT"
OV="$FR/overlay_$MODE"; rm -rf "$OV"; mkdir -p "$OV"
ENC=(-c:v libx264 -preset slow -crf "${CRF:-19}" -profile:v high -level 4.2 -pix_fmt yuv420p -x264-params "aq-mode=3:aq-strength=1.1:deblock=-1,-1"
     -r 30 -movflags +faststart -c:a aac -b:a 256k -ar 48000 -t 40)
GRADE="noise=alls=2:allf=t,format=yuv420p"   # a touch of grain keeps the dark gradients from banding

# overlay sequence: motion graphics with alpha, frames 378 (12.6 s) .. 1199
for i in $(seq 378 1199); do
  f=$(printf 'f_%05d.png' "$i"); src="$FR/main/$f"
  if [ "$MODE" = motion ] && [ "$i" -ge 1068 ] && [ "$i" -lt 1125 ]; then src="$FR/solo/$f"; fi
  [ -f "$src" ] || { echo "missing frame $src" >&2; exit 1; }
  ln -s "$src" "$OV/$f"
done

if [ "$MODE" = motion ]; then
  ffmpeg -y -hide_banner -loglevel error -nostats \
    -framerate 30 -start_number 0 -i "$FR/base/f_%05d.png" \
    -framerate 30 -start_number 378 -i "$OV/f_%05d.png" \
    -i "$ROOT/audio/mix_motion.wav" \
    -filter_complex "color=c=black:s=1080x1920:r=30:d=40[bg];[bg][0:v]overlay=eof_action=pass[base];[1:v]setpts=PTS+12.6/TB[ov];[base][ov]overlay=eof_action=pass:format=auto,$GRADE[v]" \
    -map "[v]" -map 2:a "${ENC[@]}" "$OUT/rodo_component_vs_coaxial_40s_motion.mp4"
else
  L="$ROOT/live"
  for c in s1 s2 s3 s7; do [ -f "$L/$c.mp4" ] || { echo "missing $L/$c.mp4 (see live/PROMPTS.md)" >&2; exit 1; }; done
  FIT="scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1,format=yuv420p"
  ffmpeg -y -hide_banner -loglevel error -nostats \
    -i "$L/s1.mp4" -i "$L/s2.mp4" -i "$L/s3.mp4" -i "$L/s7.mp4" \
    -framerate 30 -start_number 378 -i "$OV/f_%05d.png" \
    -i "$ROOT/audio/mix_live.wav" \
    -filter_complex "\
[0:v]$FIT,tpad=stop_mode=clone:stop_duration=5,trim=0:5,setpts=PTS-STARTPTS[a];\
[1:v]$FIT,tpad=stop_mode=clone:stop_duration=5,trim=0:5,setpts=PTS-STARTPTS[b];\
[2:v]$FIT,tpad=stop_mode=clone:stop_duration=5,trim=0:5.2,setpts=PTS-STARTPTS[c];\
color=c=black:s=1080x1920:r=30:d=20.4,format=yuv420p[g1];\
[3:v]$FIT,tpad=stop_mode=clone:stop_duration=5,trim=0:1.9,setpts=PTS-STARTPTS[d];\
color=c=black:s=1080x1920:r=30:d=2.5,format=yuv420p[g2];\
[a][b][c][g1][d][g2]concat=n=6:v=1:a=0[base];\
[4:v]setpts=PTS+12.6/TB[ov];[base][ov]overlay=eof_action=pass:format=auto,$GRADE[v]" \
    -map "[v]" -map 5:a "${ENC[@]}" "$OUT/rodo_component_vs_coaxial_40s.mp4"
fi
ls -la "$OUT"
