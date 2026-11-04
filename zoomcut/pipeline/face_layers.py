"""Face swap for a layered project (a BETA, his ask 2026-11-03): each video asset gets a copy with another face on his -
any picture he gives - and the editor switches between his own face and the swapped one live (a video layer's
props.face), like eye contact. The face comes the Snapchat way (tools/faceswap/quick.py, its own .venv): the picture's
face stretched over his, his light and shadow, his own eyeballs and mouth inside - every expression and blink is his.

  python -m pipeline.face_layers episodes/<id> --image <image asset id> [--assets a,b] [--blend a|c] [--seconds N]

  --blend a  the face takes his light (default)   c  + Poisson blending, the most blended
Per asset it writes (paths relative to the project folder):
  face_src  = the full swapped take (the export reads it instead of src / eyes_src)
  face      = a light copy the size of `preview` (the editor plays it)
  face_fg   = the swapped person on transparency, like `fg` (when the asset has a cut-out mask - the same outline)
  face_image, face_blend = what it was made with
Swapped from the take as filmed (not the eye-contact copy): his own eyeballs stay in it."""
import argparse
import hashlib
import json
import os
import subprocess
import sys

from . import project as projectlib
from .common import ROOT, Episode, log
from .eyes_layers import cutout_copy, light_copy

ENGINE = os.path.join(ROOT, "tools", "faceswap")
PY = os.path.join(ENGINE, ".venv", "Scripts", "python.exe")


def swapped(src, image, out, blend, seconds=None):
    """src -> out with the picture's face on his (picture only - the editor and the export take the sound elsewhere)"""
    if seconds:  # a test: the first N seconds only
        cut = out + ".in.mp4"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-t", str(seconds), "-i", src, "-c", "copy", cut], check=True)
        src = cut
    env = dict(os.environ, QS_BLEND="light" if blend == "a" else "light+poisson", PYTHONIOENCODING="utf-8")
    r = subprocess.run([PY, os.path.join(ENGINE, "quick.py"), src, image, out + ".tmp.mp4"], env=env, capture_output=True, text=True,
                       creationflags=getattr(subprocess, "BELOW_NORMAL_PRIORITY_CLASS", 0))
    if r.returncode or not os.path.exists(out + ".tmp.mp4"):
        sys.exit("face swap failed: " + (r.stdout + r.stderr).strip().splitlines()[-1] if (r.stdout + r.stderr).strip() else "face swap failed")
    log("    " + (r.stdout.strip().splitlines() or [""])[-1].split(" -> ")[0])
    os.replace(out + ".tmp.mp4", out)
    if seconds: os.remove(src)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--image", required=True, help="the picture's asset id (a picture in the project's media)")
    ap.add_argument("--assets", help="asset ids, comma separated (default: every video asset a video layer uses)")
    ap.add_argument("--blend", choices=["a", "c"], default="a")
    ap.add_argument("--seconds", type=float, help="only the first N seconds (a test)")
    a = ap.parse_args()
    if not os.path.exists(PY):
        sys.exit(f"the face swap engine is not set up: {PY} (py -3.12 -m venv tools/faceswap/.venv, then pip install mediapipe opencv-python numpy)")
    ep = Episode(a.episode)
    p = projectlib.load(ep)
    img = p["assets"].get(a.image)
    if not img or img.get("kind") != "image":
        sys.exit(f"not a picture in this project: {a.image}")
    image = ep.p(img["src"])
    used = {it.get("asset") for l in p["layers"] if l["kind"] == "video" for it in l.get("items", [])}
    ids = a.assets.split(",") if a.assets else [k for k, v in p["assets"].items() if v.get("kind") == "video" and k in used]
    made = {}
    for k, aid in enumerate(ids):
        asset = p["assets"][aid]
        src = ep.p(asset["src"])
        sig = hashlib.md5(json.dumps({"i": a.image, "t": os.path.getmtime(image), "b": a.blend, "sec": a.seconds, "v": 1},
                                     sort_keys=True).encode()).hexdigest()[:8]
        safe = aid.replace("/", "_")
        full = ep.work("face", f"{safe}.{sig}.mp4")
        os.makedirs(os.path.dirname(full), exist_ok=True)
        log(f"  · face swap {k + 1}/{len(ids)}: {aid}")
        if not os.path.exists(full):
            swapped(src, image, full, a.blend, a.seconds)
        rel = lambda f: os.path.relpath(f, ep.dir).replace("\\", "/")
        out = {"face_src": rel(full), "face_image": a.image, "face_blend": a.blend}
        # (always a copy for the editor - even a take without a preview: what he sees is what the export makes)
        light = ep.work("public", "face", f"{safe}.{sig}.mp4")
        os.makedirs(os.path.dirname(light), exist_ok=True)
        if not os.path.exists(light) or os.path.getmtime(light) < os.path.getmtime(full):
            # (no preview: the size of the swapped file itself - it is upright; a phone take's src is stored sideways)
            light_copy(full, ep.p(asset["preview"]) if asset.get("preview") else full, light)
        out["face"] = rel(light)
        if asset.get("matte") and os.path.exists(ep.p(asset["matte"])):
            fg = ep.work("public", "face", f"{safe}.{sig}_fg.webm")
            if not os.path.exists(fg) or os.path.getmtime(fg) < os.path.getmtime(full):
                cutout_copy(full, ep.p(asset["matte"]), ep.p(asset["fg"]) if asset.get("fg") else None, fg)
            out["face_fg"] = rel(fg)
        made[aid] = out
    p = projectlib.load(ep)  # (again: he may have edited while it ran - only the assets' face fields change)
    for aid, out in made.items():
        if aid in p["assets"]:
            p["assets"][aid].update(out)
    projectlib.save(ep, p, note=f"face swap: {len(made)} takes")
    log(f"  · face swap ready for {len(made)} takes")


if __name__ == "__main__":
    main()
