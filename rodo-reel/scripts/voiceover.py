"""Generate the RODO ACCESSORIES voice-over lines with Kokoro TTS (offline).

Usage: python3 scripts/voiceover.py <kokoro.onnx> <voices.bin>
Writes audio/vo_*.wav (24 kHz mono) and audio/vo_durations.json.
"""
import json, sys, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

LINES = {
    "s1": "Your car gives you warning signs every day. But there's one thing most drivers forget to check.",
    "s2": "Your tyre tread wears down over time. When it becomes too worn, your grip on the road can be seriously affected.",
    "s3": "Notice a bulge, crack or unusual damage on your tyre? Never ignore it. Get it inspected by a professional.",
    "s4": "Uneven tyre wear can indicate incorrect alignment, inflation problems or suspension issues.",
    "s5": "Regular tyre inspections help identify problems early. Choose the right tyres, maintain the correct pressure, and never compromise on safety.",
    "s6": "Your journey deserves better care. Visit Rodo Accessories, where every journey begins with the right choice.",
}

k = Kokoro(sys.argv[1], sys.argv[2])
# Deep, confident male read: blend a smooth narrator with a low, gravelly one.
voice = 0.6 * k.get_voice_style("am_michael") + 0.4 * k.get_voice_style("am_onyx")
durs = {}
for key, text in LINES.items():
    audio, sr = k.create(text, voice=voice, speed=0.95, lang="en-us")
    audio = np.asarray(audio, dtype=np.float32)
    nz = np.where(np.abs(audio) > 0.01)[0]  # trim leading/trailing silence
    audio = audio[max(nz[0] - 240, 0): nz[-1] + 2400]
    sf.write(f"audio/vo_{key}.wav", audio, sr)
    durs[key] = round(len(audio) / sr, 3)
json.dump(durs, open("audio/vo_durations.json", "w"), indent=2)
print(durs)
