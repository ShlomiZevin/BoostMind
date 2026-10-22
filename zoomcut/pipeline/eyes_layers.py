"""Eye contact for a layered project: each video asset gets a corrected copy - the same frames with the eyes brought to
the lens - and the editor switches between his own eyes and the corrected ones live (a video layer's props.eyes).

  python -m pipeline.eyes_layers episodes/<id> [--assets a,b] [--mode nvidia|neural] [--strength 1] [--dy 0.6]
                                               [--nudge x,y] [--file <asset>=<path>] [--seconds N]

Engines, the ones he approved (memory: reference_gaze_fix):
  nvidia  NVIDIA Maxine eye contact + our blink blend (tools/eyes_nvidia.py) - "better than CapCut". Default. If NVIDIA
          fails (offline, credits) our own v6 (gaze_video.py --mode neural) is used and NVIDIA is tried again next time.
  neural  our own v6 only (free, local).
  --file  his CapCut (or any app's) eye-contact export of that take - it must be the same video, frame for frame.
Per asset it writes (paths relative to the project folder):
  eyes_src = the full corrected take (the export reads it instead of src)
  eyes     = a light copy the size of `preview` (the editor plays it)
  eyes_fg  = the corrected person on transparency, like `fg` (when the asset has a cut-out mask)
  eyes_engine = nvidia | v6 | capcut"""
import argparse
import hashlib
import json
import os
import subprocess
import sys

from . import project as projectlib
from .common import FFMPEG, ROOT, Episode, log, run


def probe(path, what="stream=width,height"):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", what, "-of", "json", path],
                       capture_output=True, text=True)
    return json.loads(r.stdout or "{}")


def duration(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True)
    return float(r.stdout.strip() or 0)


def corrected(src, out, a):
    """src -> out (eye contact). Returns the engine that made it."""
    part = out[:-4] + ".part.mp4"
    fell_back = out + ".fallback"
    if a.file:
        if abs(duration(src) - duration(a.file)) > 0.15:
            raise SystemExit(f"{os.path.basename(a.file)} is {duration(a.file):.2f}s but the take is {duration(src):.2f}s - "
                             f"export it without trimming (same length, same fps), or the mouth will not match the voice")
        run([FFMPEG, "-y", "-v", "error", "-i", a.file, "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "15", "-pix_fmt", "yuv420p", part])
        os.replace(part, out)
        return "capcut"
    if a.mode == "nvidia":
        cmd = [sys.executable, os.path.join(ROOT, "tools", "eyes_nvidia.py"), src, part] + (["--seconds", str(a.seconds)] if a.seconds else [])
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
        if r.returncode == 0 and os.path.exists(part):
            os.replace(part, out)
            if os.path.exists(fell_back):
                os.remove(fell_back)
            return "nvidia"
        log(f"    NVIDIA eye contact failed - using our own (v6): {(r.stdout + r.stderr).strip()[-300:]}")
    cmd = [sys.executable, os.path.join(ROOT, "tools", "gaze_video.py"), src, part, "--mode", "neural",
           "--strength", str(a.strength), "--dy", str(a.dy)] + ([f"--nudge={a.nudge}"] if a.nudge else []) + (["--preview", str(a.seconds)] if a.seconds else [])
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode or not os.path.exists(part):
        raise RuntimeError("eye contact failed: " + (r.stdout + r.stderr)[-800:])
    os.replace(part, out)
    if a.mode == "nvidia":
        open(fell_back, "w").close()  # (NVIDIA is tried again next time)
    return "v6"


def light_copy(full, like, out):
    """The editor's copy: the size of the asset's `preview`, a keyframe every half second (seeks land at once)."""
    s = (probe(like).get("streams") or [{}])[0]
    w, h = s.get("width") or 540, s.get("height") or 960
    run([FFMPEG, "-y", "-v", "error", "-i", full, "-an", "-vf", f"scale={w}:{h}:flags=bicubic", "-c:v", "libx264", "-preset", "veryfast",
         "-crf", "21", "-g", "15", "-keyint_min", "15", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out + ".tmp.mp4"])
    os.replace(out + ".tmp.mp4", out)


def cutout_copy(full, matte, like, out):
    """The corrected person on transparency (VP9 + alpha), made exactly like `fg` (pipeline/background.fg_preview)."""
    s = (probe(like).get("streams") or [{}])[0] if like and os.path.exists(like) else {}
    w = s.get("width") or 540
    h0 = probe(full).get("streams", [{}])[0]
    h = s.get("height") or int(round(w * h0.get("height", 1920) / h0.get("width", 1080) / 2) * 2)
    fc = (f"[1:v]scale={w}:{h}:flags=bicubic,gblur=sigma=0.8,format=gray[a];[0:v]scale={w}:{h}:flags=bilinear[v];"
          f"[v][a]alphamerge,format=yuva420p[o]")
    run([FFMPEG, "-y", "-v", "error", "-i", full, "-i", matte, "-filter_complex", fc, "-map", "[o]", "-an",
         "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "1400k", "-deadline", "realtime", "-cpu-used", "8",
         "-row-mt", "1", "-auto-alt-ref", "0", "-g", "15", out + ".tmp.webm"])
    os.replace(out + ".tmp.webm", out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--assets", help="asset ids, comma separated (default: every video asset a video layer uses)")
    ap.add_argument("--mode", choices=["nvidia", "neural"], default="nvidia")
    ap.add_argument("--strength", type=float, default=1.0)
    ap.add_argument("--dy", type=float, default=0.6)
    ap.add_argument("--nudge")
    ap.add_argument("--file", action="append", default=[], help="<asset>=<path>: an eye-contact export to use for that take")
    ap.add_argument("--seconds", type=float, help="only the first N seconds (a test)")
    a = ap.parse_args()
    ep = Episode(a.episode)
    p = projectlib.load(ep)
    files = dict(f.split("=", 1) for f in a.file)
    used = {it.get("asset") for l in p["layers"] if l["kind"] == "video" for it in l.get("items", [])}
    ids = a.assets.split(",") if a.assets else [k for k, v in p["assets"].items() if v.get("kind") == "video" and k in used]
    made = {}
    for k, aid in enumerate(ids):
        asset = p["assets"][aid]
        src = ep.p(asset["src"])
        a.file = files.get(aid)
        if a.file and a.file.startswith("asset:"):  # a video he added to the project's media
            a.file = ep.p(p["assets"][a.file[6:]]["src"])
        sig = hashlib.md5(json.dumps({"m": a.mode, "s": a.strength, "dy": a.dy, "n": a.nudge, "f": a.file and os.path.getmtime(a.file),
                                      "sec": a.seconds, "v": 1}, sort_keys=True).encode()).hexdigest()[:8]
        safe = aid.replace("/", "_")
        full = ep.work("gaze", f"{safe}.{sig}.mp4")
        log(f"  · eye contact {k + 1}/{len(ids)}: {aid}")
        if not os.path.exists(full) or (a.mode == "nvidia" and os.path.exists(full + ".fallback")):
            engine = corrected(src, full, a)
            open(full + ".engine", "w").write(engine)
        engine = open(full + ".engine").read().strip() if os.path.exists(full + ".engine") else a.mode
        rel = lambda f: os.path.relpath(f, ep.dir).replace("\\", "/")
        out = {"eyes_src": rel(full), "eyes_engine": engine}
        if asset.get("preview"):
            light = ep.work("public", "eyes", f"{safe}.{sig}.mp4")
            os.makedirs(os.path.dirname(light), exist_ok=True)
            if not os.path.exists(light) or os.path.getmtime(light) < os.path.getmtime(full):
                light_copy(full, ep.p(asset["preview"]), light)
            out["eyes"] = rel(light)
        if asset.get("matte") and os.path.exists(ep.p(asset["matte"])):
            fg = ep.work("public", "eyes", f"{safe}.{sig}_fg.webm")
            if not os.path.exists(fg) or os.path.getmtime(fg) < os.path.getmtime(full):
                cutout_copy(full, ep.p(asset["matte"]), ep.p(asset["fg"]) if asset.get("fg") else None, fg)
            out["eyes_fg"] = rel(fg)
        made[aid] = out
        log(f"    {engine}")
    p = projectlib.load(ep)  # (again: he may have edited while it ran - only the assets' eye fields change)
    for aid, out in made.items():
        if aid in p["assets"]:
            p["assets"][aid].update(out)
    projectlib.save(ep, p, note=f"eye contact: {len(made)} takes")
    log(f"  · eye contact ready for {len(made)} takes ({', '.join(sorted({o['eyes_engine'] for o in made.values()}))})")


if __name__ == "__main__":
    main()
