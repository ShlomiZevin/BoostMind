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

# Each failed graph run is noted here: the export runs the sound again once the picture is done (CPU free) and never
# hands out a Full export whose sound fell back to the older mix (2026-11-09: two haredit-5 exports were sent with it).
FAILED = []


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
        # the clip wins (2026-11-03): a clip's own cleaning plays that cleaning's source, its own speech level its own
        # gain; its own voice / clarity / fx go to the graph (layergraph.soundOf)
        row_clean = props.get("clean") or "off"
        t = layers_audio.tempo_of(l)  # (the row's own speed: its sources sped up, pitch kept - each item's in / t there)
        sources, levels = {}, {}
        for c in sorted({it.get("clean") or row_clean for it in items} or {row_clean}):
            srcs, lv = layers_audio.layer_sources(ep, project, l, c)
            for aid, x in srcs.items():
                key = aid if c == row_clean else f"{aid}|{c}"
                x = np.ascontiguousarray(layers_audio.stretched(ep, x, t), dtype=np.float32)
                p = os.path.join(d, f"{l['id']}__{key}.{hashlib.sha1(x[::997].tobytes() + str(len(x)).encode()).hexdigest()[:10]}.f32".replace("/", "_").replace("|", "_"))
                if not os.path.exists(p):
                    x.tofile(p)
                sources[key] = p
                levels[key] = float(lv[aid])

        def one(it):
            aid = it.get("asset") or props.get("asset")
            c = it.get("clean") or row_clean
            key = aid if c == row_clean else f"{aid}|{c}"
            speech = (it.get("level") if it.get("level") is not None else props.get("level")) == "speech"
            return {**{k: it.get(k) for k in ("from", "dur", "in", "rate", "gain", "fade_in", "fade_out", "fx", "soften", "voice", "presence")},
                    **({"in": (it.get("in") or 0) / t} if abs(t - 1) > 1e-4 else {}), "asset": key, "lvl": levels.get(key, 1.0) if speech else 1.0}
        job["layers"].append({"id": l["id"],
                              "props": {k: props.get(k) for k in ("fx", "presence", "voice")},
                              "items": [one(it) for it in items],
                              "sources": sources,
                              "levels": {}})
    if not job["layers"]:
        return {}
    shape = {"canvas": project["canvas"], "layers": [{k: l.get(k) for k in ("id", "kind", "hidden", "muted", "props", "items")} for l in project["layers"]]}
    for L in job["layers"]:  # (the ducks and the lift come from the other layers)
        L["project"] = shape
        L["layer"] = next(x for x in shape["layers"] if x["id"] == L["id"])
    key = hashlib.sha1(json.dumps(job, sort_keys=True, default=str).encode()).hexdigest()[:12]
    for L in job["layers"]:  # (each job's own track files: a "done" job is always its own result)
        L["out"] = os.path.join(d, f"{L['id']}.{key}.track.f32".replace("/", "_"))
    jp = os.path.join(d, f"job.{key}.json")
    done = os.path.join(d, f"job.{key}.done")
    # (an export with nothing changed in the sound renders nothing again - if its tracks are really still there: a
    # space cleanup can take the tracks and leave the marker)
    if not os.path.exists(done) or not all(os.path.exists(L["out"]) for L in job["layers"]):
        with open(jp, "w", encoding="utf-8") as fh:
            json.dump(job, fh)
        r = subprocess.run(["node", os.path.join(ROOT, "tools", "audio_layers.mjs"), jp], cwd=ROOT, capture_output=True, text=True,
                           encoding="utf-8", errors="replace")
        if r.returncode:
            log("  · sound graph failed - the older mix is used: " + (r.stdout + r.stderr).strip()[-400:])
            FAILED.append(key)
            return None
        open(done, "w").close()
    out = {}
    for L in job["layers"]:
        y = np.fromfile(L["out"], dtype=np.float32)
        out[L["id"]] = y[:n] if len(y) >= n else np.pad(y, (0, n - len(y)))
    log(f"  · sound: {len(out)} layers through the editor's graph (clip fx, clarity, voice chain)")
    prune(d, [p for L in job["layers"] for p in [*L["sources"].values(), L["out"]]] + [jp, done])
    return out


def prune(d, used, keep_s=3600):
    """Only the newest export's sound renders stay (his rule, 2026-11-02: "not that much gigabyte for small TikTok
    sketches"): every export wrote new raw tracks (~10 MB a layer-minute) and none were ever deleted - 261 files in one
    project. What this render used is marked fresh; what no render used for an hour goes (an export of a project at
    its own pace renders twice - the hour keeps both). Remade by the next export if ever needed."""
    import time
    now, keep = time.time(), {os.path.normcase(os.path.abspath(p)) for p in used}
    for p in used:
        if os.path.exists(p):
            os.utime(p, None)
    freed = 0
    for f in os.listdir(d):
        p = os.path.join(d, f)
        if os.path.normcase(os.path.abspath(p)) in keep or not os.path.isfile(p) or now - os.path.getmtime(p) < keep_s:
            continue
        try:
            freed += os.path.getsize(p)
            os.remove(p)
        except OSError:
            pass
    if freed > 50e6:
        log(f"  · {freed / 1e9:.1f} GB of older sound renders removed")
