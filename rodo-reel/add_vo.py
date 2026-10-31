"""Mix a continuous voice-over take into the reel, line by line, synced to scenes.

Usage: python3 add_vo.py vo.mp3 [video_silent.mp4] [sfx_music.wav] [out.mp4]
The take is split on its pauses into the 7 script lines; each line is placed at
its scene start and the music/SFX bed is ducked under the voice.
"""
import subprocess, sys, re, os
vo = sys.argv[1]
video = sys.argv[2] if len(sys.argv) > 2 else 'video_silent.mp4'
bed = sys.argv[3] if len(sys.argv) > 3 else 'sfx_music.wav'
out = sys.argv[4] if len(sys.argv) > 4 else 'RODO_Wheel_Alignment_Reel.mp4'
# scene start for each VO line (seconds)
SLOTS = [0.35, 3.45, 9.45, 15.45, 21.35, 25.35, 26.75]

log = subprocess.run(['ffmpeg', '-i', vo, '-af', 'silencedetect=noise=-38dB:d=0.35', '-f', 'null', '-'],
                     capture_output=True, text=True).stderr
starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', log)]
ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', log)]
dur = float(re.search(r'Duration: (\d+):(\d+):([\d.]+)', log).group(3)) + 60 * int(re.search(r'Duration: (\d+):(\d+)', log).group(2))
# speech regions = gaps between silences
regions, cur = [], 0.0
for s, e in zip(starts, ends + [dur] * (len(starts) - len(ends))):
    if s - cur > 0.25: regions.append((max(0, cur - 0.05), s + 0.05))
    cur = e
if dur - cur > 0.25: regions.append((cur - 0.05, dur))
# merge down to 7 lines by joining the shortest gaps
while len(regions) > len(SLOTS):
    gaps = [regions[i + 1][0] - regions[i][1] for i in range(len(regions) - 1)]
    i = gaps.index(min(gaps)); regions[i:i + 2] = [(regions[i][0], regions[i + 1][1])]
if len(regions) < len(SLOTS):
    sys.exit(f'Found only {len(regions)} spoken lines; expected {len(SLOTS)}. Record with clear pauses between lines.')
print('lines:', [(round(a, 2), round(b, 2)) for a, b in regions])
parts, labels = [], []
for k, ((a, b), at) in enumerate(zip(regions, SLOTS)):
    nxt = SLOTS[k + 1] if k + 1 < len(SLOTS) else 30.0
    tempo = min(1.25, max(1.0, (b - a) / max(0.5, nxt - at - 0.1)))  # speed up slightly only if a line overruns
    parts.append(f'[1:a]atrim={a}:{b},asetpts=PTS-STARTPTS,atempo={tempo:.3f},adelay={int(at*1000)}|{int(at*1000)}[v{k}]')
    labels.append(f'[v{k}]')
fc = ';'.join(parts) + f';{"".join(labels)}amix=inputs={len(labels)}:normalize=0,aformat=channel_layouts=stereo,volume=1.6,asplit[vo][sc];' \
     '[2:a][sc]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=350[bed];' \
     '[bed][vo]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.0:LRA=11[a]'
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', video, '-i', vo, '-i', bed, '-filter_complex', fc,
                '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
                '-t', '30', '-movflags', '+faststart', out], check=True)
print('wrote', out)
