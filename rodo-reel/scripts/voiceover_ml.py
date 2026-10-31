"""Generate the Malayalam voice-over (male voice "Arjun", Piper VITS, fully offline).

Usage: python3 scripts/voiceover_ml.py <path to vits-piper-ml_IN-arjun-medium dir>
Requires: pip install piper-tts
Writes audio/vo_ml_*.wav and audio/vo_ml_durations.json.
Model: https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-ml_IN-arjun-medium.tar.bz2
"""
import json, os, sys
import numpy as np
from piper import PiperVoice, SynthesisConfig
import soundfile as sf

LINES = {
    "s1": "നിങ്ങളുടെ ടയറുകൾ നിങ്ങളോട് ചില കാര്യങ്ങൾ പറയുന്നുണ്ട്. അത് ശ്രദ്ധിക്കേണ്ട സമയമാണ്.",
    "s2": "ടയർ ട്രെഡിന്റെ തേയ്മാനം ശ്രദ്ധിക്കുക. ഗ്രിപ്പ് കുറയുന്നത്, പ്രത്യേകിച്ച് നനഞ്ഞ റോഡുകളിൽ, അപകടസാധ്യത വർധിപ്പിക്കും.",
    "s3": "സൈഡ്‌വാൾ കേടുപാടുകൾ. ടയറിന്റെ വശങ്ങളിലുള്ള വിള്ളലുകൾ, മുറിവുകൾ, വീക്കങ്ങൾ എന്നിവ ഒരിക്കലും അവഗണിക്കരുത്.",
    "s4": "അസമമായ ടയർ തേയ്മാനം. വീൽ അലൈൻമെന്റ്, ടയർ പ്രഷർ, സസ്പെൻഷൻ എന്നിവ പരിശോധിക്കുക.",
    "s5": "പതിവായ പരിശോധന. ശരിയായ പരിപാലനം. വിദഗ്ധരുടെ ഫിറ്റിംഗ്. ശരിയായ ടയറുകൾ തിരഞ്ഞെടുക്കൂ, സുരക്ഷയിൽ ഒരിക്കലും വിട്ടുവീഴ്ച ചെയ്യരുത്.",
    "s6": "നിങ്ങളുടെ ഓരോ യാത്രയും മികച്ച പരിചരണം അർഹിക്കുന്നു. സുരക്ഷിതമായി ഡ്രൈവ് ചെയ്യൂ. റോഡോ ടയേഴ്സ് സന്ദർശിക്കൂ.",
}

d = sys.argv[1]
voice = PiperVoice.load(os.path.join(d, "ml_IN-arjun-medium.onnx"))
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# length_scale > 1 = slower, more deliberate read
syn = SynthesisConfig(length_scale=float(os.environ.get("VO_LENGTH", "0.96")))
durs = {}
for key, text in LINES.items():
    chunks = list(voice.synthesize(text, syn_config=syn))
    sr = chunks[0].sample_rate
    gap = np.zeros(int(0.22 * sr), dtype=np.float32)  # breath between sentences
    audio = np.concatenate([np.concatenate([c.audio_float_array, gap]) for c in chunks])
    nz = np.where(np.abs(audio) > 0.01)[0]
    audio = audio[max(nz[0] - 200, 0): nz[-1] + 2000]
    sf.write(os.path.join(root, "audio", f"vo_ml_{key}.wav"), audio, sr)
    durs[key] = round(len(audio) / sr, 3)
json.dump(durs, open(os.path.join(root, "audio", "vo_ml_durations.json"), "w"), indent=2)
print(durs)
