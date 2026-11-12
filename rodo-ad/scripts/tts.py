#!/usr/bin/env python3
"""Synthesize the dialogue lines in timeline.json with Kokoro (local, offline TTS).

Needs: pip install kokoro-onnx soundfile numpy
       kokoro-v1.0.onnx + voices-v1.0.bin from
       https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
Usage: python3 scripts/tts.py <dir-with-model-files>
Writes audio/vo_raw/<id>.wav (24 kHz mono).
"""
import json, os, sys
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
models = sys.argv[1] if len(sys.argv) > 1 else "."
k = Kokoro(os.path.join(models, "kokoro-v1.0.onnx"), os.path.join(models, "voices-v1.0.bin"))
out = os.path.join(root, "audio", "vo_raw"); os.makedirs(out, exist_ok=True)
for line in json.load(open(os.path.join(root, "timeline.json")))["dialogue"]:
    a, sr = k.create(line["text"], voice=line["voice"], speed=line["speed"], lang="en-us")
    idx = np.where(np.abs(a) > 0.01)[0]
    a = a[max(0, idx[0] - int(0.02 * sr)): idx[-1] + int(0.08 * sr)]
    sf.write(os.path.join(out, f"{line['id']}.wav"), a, sr)
    print(line["id"], line["voice"], f"{len(a) / sr:.2f}s")
