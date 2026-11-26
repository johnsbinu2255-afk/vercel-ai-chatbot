#!/usr/bin/env python3
"""Assemble a 20-40s vertical (1080x1920) reel from raw clips with ffmpeg.

What it does, in one pass:
  - crops/scales every clip to 9:16, 30fps
  - applies a colour-grade preset
  - cuts clips on the beat (you give the song BPM)
  - joins them with short transitions
  - lays the music underneath with a fade-out
  - adds an optional hook title (first seconds) and CTA end card text

Example:
  python make_reel.py --clips a.mp4 b.mp4 c.mp4 --music song.mp3 --bpm 100 \
      --duration 30 --grade night_neon --title "HEADLIGHT UPGRADE" \
      --cta "Call / WhatsApp: 98XXXXXXXX" --out reel.mp4

Needs only ffmpeg + ffprobe + python3 (no pip installs).
"""
import argparse, math, os, shutil, subprocess, sys

W, H, FPS = 1080, 1920, 30

# Colour grades as ffmpeg filter chains. Tuned for phone footage of cars:
# punchy contrast + saturated colour reads as "premium" on small screens.
GRADES = {
    "teal_orange": "eq=contrast=1.12:saturation=1.28:gamma=0.97,"
                   "colorbalance=rs=-0.06:gs=-0.01:bs=0.08:rh=0.09:gh=0.02:bh=-0.07",
    "night_neon":  "eq=contrast=1.22:brightness=-0.03:saturation=1.38,"
                   "colorbalance=bs=0.10:bm=0.05:rh=0.05,vignette=PI/6",
    "clean_bright": "eq=contrast=1.08:brightness=0.03:saturation=1.15,"
                    "unsharp=5:5:0.6",
    "moody_dark":  "eq=contrast=1.25:brightness=-0.05:saturation=1.08:gamma=0.95,"
                   "colorbalance=bs=0.06:rh=0.04,vignette=PI/5",
    "none": "null",
}

# Rotated through so consecutive cuts don't repeat the same move.
TRANSITIONS = ["fade", "slideleft", "zoomin", "wipeleft", "circleopen",
               "smoothleft", "radial", "slideup", "distance"]

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
]


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        sys.exit("ffmpeg failed:\n" + p.stderr[-2500:])
    return p.stdout


def probe_duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", path], capture_output=True, text=True).stdout
    try:
        return float(out.strip())
    except ValueError:
        sys.exit(f"Could not read duration of {path}")


def esc(text):
    # drawtext escaping
    return (text.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\u2019")
                .replace("%", "\\%"))


def find_font(arg):
    if arg:
        return arg
    for f in FONT_CANDIDATES:
        if os.path.exists(f):
            return f
    return None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--clips", nargs="+", required=True, help="raw clips, in the order you want them to appear")
    ap.add_argument("--music", help="audio file (mp3/m4a/wav). Omit for silent video (add trending audio in Instagram instead)")
    ap.add_argument("--bpm", type=float, default=100, help="song tempo; cuts land on beats")
    ap.add_argument("--beats-per-cut", type=int, default=2, help="2 = a cut every 2 beats (fast). 4 = calmer")
    ap.add_argument("--duration", type=float, default=30, help="target length in seconds (20-40 works best)")
    ap.add_argument("--music-start", type=float, default=0, help="second of the song where the best part starts")
    ap.add_argument("--grade", choices=GRADES, default="teal_orange")
    ap.add_argument("--transition-len", type=float, default=0.25)
    ap.add_argument("--title", help="hook text shown in the first ~2.5s")
    ap.add_argument("--cta", help="call-to-action text for the last ~3s (phone / location)")
    ap.add_argument("--font", help="TTF font path (use one with Malayalam glyphs for Malayalam text)")
    ap.add_argument("--out", default="reel.mp4")
    a = ap.parse_args()

    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            sys.exit(f"{tool} not found. Install ffmpeg first.")
    for c in a.clips:
        if not os.path.exists(c):
            sys.exit(f"Missing clip: {c}")

    td = a.transition_len
    beat = 60.0 / a.bpm
    seg = beat * a.beats_per_cut
    while seg < 0.9:            # anything shorter feels jittery on a phone
        seg *= 2
    # With crossfades each cut overlaps by td, so each added segment adds (seg - td).
    n_seg = max(2, math.ceil((a.duration - seg) / (seg - td)) + 1)
    total = n_seg * seg - (n_seg - 1) * td

    durs = [probe_duration(c) for c in a.clips]
    font = find_font(a.font)
    grade = GRADES[a.grade]

    # Plan segments: cycle through clips; on later passes use a later in-point so
    # the same clip doesn't show identical footage twice.
    inputs, filters, labels = [], [], []
    for i in range(n_seg):
        ci = i % len(a.clips)
        pass_no = i // len(a.clips)
        room = max(0.0, durs[ci] - (seg + td))
        start = min(room, pass_no * (seg + td)) if room else 0.0
        inputs += ["-ss", f"{start:.3f}", "-t", f"{seg + td:.3f}", "-i", a.clips[ci]]
        filters.append(
            f"[{i}:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
            f"fps={FPS},setsar=1,{grade},format=yuv420p,setpts=PTS-STARTPTS[v{i}]")
        labels.append(f"v{i}")

    # Chain xfades
    cur = labels[0]
    for i in range(1, n_seg):
        t = TRANSITIONS[(i - 1) % len(TRANSITIONS)]
        off = i * (seg - td)
        out = f"x{i}"
        filters.append(f"[{cur}][{labels[i]}]xfade=transition={t}:duration={td}:offset={off:.3f}[{out}]")
        cur = out

    # Text overlays
    final = cur
    if font:
        if a.title:
            filters.append(
                f"[{final}]drawtext=fontfile='{font}':text='{esc(a.title)}':fontcolor=white:fontsize=84:"
                f"borderw=6:bordercolor=black@0.8:x=(w-text_w)/2:y=h*0.14:enable='between(t,0.2,2.8)'[t1]")
            final = "t1"
        if a.cta:
            filters.append(
                f"[{final}]drawtext=fontfile='{font}':text='{esc(a.cta)}':fontcolor=white:fontsize=58:"
                f"box=1:boxcolor=black@0.55:boxborderw=26:x=(w-text_w)/2:y=h*0.78:"
                f"enable='gte(t,{total - 3.2:.2f})'[t2]")
            final = "t2"
    elif a.title or a.cta:
        print("Warning: no font found, skipping text overlays (pass --font).", file=sys.stderr)

    # Final fade to black over the last 0.4s
    filters.append(f"[{final}]fade=t=out:st={total - 0.4:.2f}:d=0.4[vout]")

    cmd = ["ffmpeg", "-y", *inputs]
    if a.music:
        cmd += ["-ss", str(a.music_start), "-i", a.music]
        filters.append(f"[{n_seg}:a]atrim=0:{total:.2f},asetpts=PTS-STARTPTS,"
                       f"afade=t=in:d=0.3,afade=t=out:st={total - 1.2:.2f}:d=1.2[aout]")
    cmd += ["-filter_complex", ";".join(filters), "-map", "[vout]"]
    if a.music:
        cmd += ["-map", "[aout]", "-c:a", "aac", "-b:a", "192k"]
    cmd += ["-t", f"{total:.2f}", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart", a.out]

    run(cmd)
    print(f"Done: {a.out}  ({total:.1f}s, {n_seg} cuts, grade={a.grade}, {a.bpm:g} BPM)")


if __name__ == "__main__":
    main()
