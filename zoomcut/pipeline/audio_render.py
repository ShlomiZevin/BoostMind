"""The export's sound tracks rendered by the EDITOR's own audio graph (render/ui/layergraph.ts via tools/audio_layers.mjs,
headless Chrome): every clip's gain / fades / fx (filter, pitch, soften, room), the layer's fx, clarity and voice
chain - exactly what the editor plays. pipeline/layers_audio.py then only sums the tracks (volumes) and sets the one
loudness gain. Sources = each layer's cleaned-only sound + its speech-level gains (layers_audio.layer_sources)."""
import hashlib
import json
import os
import subprocess

import numpy as np

from .common import ROOT, SR, log


def render(ep, project, n):
    """{layer id: mono float32 track of n samples, before its volume} for every audio layer, or None if it failed."""
    from . import layers_audio
    fps = project["canvas"]["fps"]
    d = ep.work("layers", "render")
    os.makedirs(d, exist_ok=True)
    job = {"rate": SR, "fps": fps, "n": n, "layers": []}
    for l in project["layers"]:
        if l["kind"] != "audio":
            continue
        props = l.get("props") or {}
        items = [it for it in l.get("items", []) if not it.get("hidden") and (it.get("asset") or props.get("asset"))]
        srcs, levels = layers_audio.layer_sources(ep, project, l)
        sources = {}
        for aid, x in srcs.items():
            x = np.ascontiguousarray(x, dtype=np.float32)
            p = os.path.join(d, f"{l['id']}__{aid}.{hashlib.sha1(x[::997].tobytes() + str(len(x)).encode()).hexdigest()[:10]}.f32".replace("/", "_"))
            if not os.path.exists(p):
                x.tofile(p)
            sources[aid] = p
        job["layers"].append({"id": l["id"],
                              "props": {k: props.get(k) for k in ("fx", "presence", "voice")},
                              "items": [{**{k: it.get(k) for k in ("from", "dur", "in", "rate", "gain", "fade_in", "fade_out", "fx", "soften")},
                                         "asset": it.get("asset") or props.get("asset")} for it in items],
                              "sources": sources,
                              "levels": {aid: float(g) for aid, g in levels.items()} if props.get("level") == "speech" else {}})
    if not job["layers"]:
        return {}
    key = hashlib.sha1(json.dumps(job, sort_keys=True, default=str).encode()).hexdigest()[:12]
    for L in job["layers"]:  # (each job's own track files: a "done" job is always its own result)
        L["out"] = os.path.join(d, f"{L['id']}.{key}.track.f32".replace("/", "_"))
    jp = os.path.join(d, f"job.{key}.json")
    done = os.path.join(d, f"job.{key}.done")
    if not os.path.exists(done):  # (an export with nothing changed in the sound renders nothing again)
        with open(jp, "w", encoding="utf-8") as fh:
            json.dump(job, fh)
        r = subprocess.run(["node", os.path.join(ROOT, "tools", "audio_layers.mjs"), jp], cwd=ROOT, capture_output=True, text=True,
                           encoding="utf-8", errors="replace")
        if r.returncode:
            log("  · sound graph failed - the older mix is used: " + (r.stdout + r.stderr).strip()[-400:])
            return None
        open(done, "w").close()
    out = {}
    for L in job["layers"]:
        y = np.fromfile(L["out"], dtype=np.float32)
        out[L["id"]] = y[:n] if len(y) >= n else np.pad(y, (0, n - len(y)))
    log(f"  · sound: {len(out)} layers through the editor's graph (clip fx, clarity, voice chain)")
    return out
