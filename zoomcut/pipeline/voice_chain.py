"""A voice layer's track through the editor's voice chain (render/ui/sound.ts - the news-anchor voice and the other
presets), rendered by tools/voice_chain.mjs in headless Chrome: the same code the editor plays live, so the export
sounds like the editor. Cached by the track's samples + the settings (a re-export without changes costs nothing)."""
import hashlib
import json
import os
import subprocess

import numpy as np

from .common import ROOT, SR, log


def apply(ep, layer_id, x, voice):
    """x: one layer's mono float32 track (before its volume) -> the same through props.voice."""
    if not voice:
        return x
    x = np.ascontiguousarray(x, dtype=np.float32)
    key = hashlib.sha1(x[::997].tobytes() + str(len(x)).encode() + json.dumps({k: v for k, v in voice.items() if k != "bypass"}, sort_keys=True).encode()).hexdigest()[:12]
    d = ep.work("layers", "voice")
    os.makedirs(d, exist_ok=True)
    out = os.path.join(d, f"{layer_id.replace('/', '_')}.{key}.f32")
    if not os.path.exists(out):
        src = out[:-4] + ".in.f32"
        x.tofile(src)
        job = os.path.join(d, f"{layer_id.replace('/', '_')}.job.json")
        with open(job, "w", encoding="utf-8") as fh:
            json.dump({"rate": SR, "tracks": [{"in": src, "out": out, "voice": voice}]}, fh)
        r = subprocess.run(["node", os.path.join(ROOT, "tools", "voice_chain.mjs"), job], cwd=ROOT, capture_output=True, text=True)
        os.remove(src)
        if r.returncode or not os.path.exists(out):
            raise RuntimeError("voice chain failed: " + (r.stdout + r.stderr)[-800:])
    y = np.fromfile(out, dtype=np.float32)
    log(f"  · voice chain on {layer_id} ({voice.get('preset', 'custom')})")
    return y[: len(x)] if len(y) >= len(x) else np.pad(y, (0, len(x) - len(y)))
