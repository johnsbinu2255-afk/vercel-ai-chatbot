#!/usr/bin/env bash
# Mux the rendered picture with the mix, loudness-normalised for Instagram (-14 LUFS, -1.5 dBTP).
set -euo pipefail
cd "$(dirname "$0")/.."
# Shop watermark (top-left, hidden once the brand end screen starts at 53.2 s)
FONT=$(fc-match -f '%{file}' "Inter Display:style=Black")
WM="drawbox=x=60:y=168:w=6:h=34:color=0xe3202a@0.85:t=fill:enable='lt(t,53.2)',"
WM+="drawtext=fontfile=$FONT:text='RODO TYRES':fontsize=34:fontcolor=white@0.6:x=78:y=168:enable='lt(t,53.2)'"
ffmpeg -y -loglevel error -i out/video_silent.mp4 -i audio/mix.wav \
  -map 0:v -map 1:a -vf "$WM" -c:v libx264 -preset slow -crf 19 -maxrate 14M -bufsize 28M -pix_fmt yuv420p \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:a aac -b:a 256k -ar 48000 \
  -shortest -movflags +faststart out/RODO_Tyres_Reel_1080x1920.mp4
# Light preview for messaging apps
ffmpeg -y -loglevel error -i out/RODO_Tyres_Reel_1080x1920.mp4 -vf scale=720:1280 \
  -c:v libx264 -crf 24 -preset slow -c:a aac -b:a 160k -movflags +faststart out/RODO_Tyres_Reel_preview_720p.mp4
# Cover frame for the Reel grid
ffmpeg -y -loglevel error -ss 4.5 -i out/RODO_Tyres_Reel_1080x1920.mp4 -frames:v 1 -q:v 2 out/RODO_Tyres_Reel_cover.jpg
ls -lh out/RODO_Tyres_Reel_*
