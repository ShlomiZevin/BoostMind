"""The one export for every layered project (project.json - skill/edit-video/layers.md).

    python -m pipeline.export_layers episodes/<id> [--quick | --test]

The stack is split into runs: consecutive picture / text / shape / subtitle layers are a GRAPHICS run, consecutive
video layers (with their backdrops) a VIDEO run.
  1. graphics: each graphics run is drawn by the same composition the editor plays (render/src/Layers.tsx, mode
     "graphics") - only on the frames where something in it changes (an item starts / ends, a fade, an animation, the
     clock), so a mostly still layer costs a handful of frames; the held frames are hard links.
  2. video: the timeline is cut into chunks where no video item crosses; each chunk is one ffmpeg run that stacks,
     bottom to top, the canvas colour, every video item (cropped to its box by the shared geometry, cut out by its
     matte over its backdrop photo, its look, rounded corners, fade) and the graphics runs in between.
  3. sound: pipeline/layers_audio.py - the same tracks the editor plays, one gain to -14 LUFS.
  4. mux, the project's speed, checks.
Gentle on the machine (his PC blue-screens under full load): few pieces at once, few threads, below-normal priority.
--quick: half size, the fastest encoder - a draft to check the edit (out/<id>.draft.mp4).
--test: the phone check - about a third of the size, small and fast, to Telegram (out/<id>.test.mp4; never published)."""
import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor

import numpy as np

from . import cutout as cutout_fx, film_fx, layers_audio, look
from . import project as projectlib
from .common import FFMPEG, ROOT, Episode, ffprobe, log, run
from .compose import LOW, PIECES, X264_THREADS, _look
from .layer_geometry import backdrop_box, fit_box, image_box

VIDEO_KINDS = {"video", "backdrop"}
SKIP_KINDS = {"audio", "effect"}
def animated_styles():
    """The text / subtitle styles that move every frame by themselves - read from the registry (`animated: true` in
    render/src/layers/styles*.tsx, tools/animated_styles.mjs), cached until a style file changes."""
    import glob
    files = sorted(glob.glob(os.path.join(ROOT, "render", "src", "layers", "*.tsx")))
    stamp = ";".join(f"{os.path.basename(f)}:{os.path.getmtime(f):.0f}" for f in files)
    cache = os.path.join(ROOT, "render", "node_modules", ".zc-animated-styles.json")
    try:
        c = json.load(open(cache, encoding="utf-8"))
        if c.get("stamp") == stamp:
            return set(c["names"])
    except (OSError, ValueError):
        pass
    r = subprocess.run(["node", os.path.join(ROOT, "tools", "animated_styles.mjs")], capture_output=True, text=True, encoding="utf-8", cwd=ROOT)
    if r.returncode:
        raise RuntimeError("could not read the style registry: " + r.stderr[-600:])
    names = json.loads(r.stdout)
    json.dump({"stamp": stamp, "names": names}, open(cache, "w", encoding="utf-8"))
    return set(names)
REMOTION = os.path.join(ROOT, "render", "node_modules", "@remotion", "cli", "remotion-cli.js")


def stack_runs(project):
    runs = []
    for l in project["layers"]:
        if l.get("hidden") or l["kind"] in SKIP_KINDS:
            continue
        v = l["kind"] in VIDEO_KINDS
        if runs and runs[-1]["video"] == v:
            runs[-1]["layers"].append(l)
        else:
            runs.append({"video": v, "layers": [l]})
    return runs


# ---- 1. graphics ---------------------------------------------------------------------------------------------------
def changes(layers, fps, total, step=1):
    """The frames where something in these layers looks different from the frame before. step: moving things (fades,
    animations, animated styles) drawn every step-th frame - the phone test uses 3 (10 a second is plenty to check)."""
    keys, animated = {0}, animated_styles()
    for l in layers:
        props = l.get("props") or {}
        for it in l.get("items", []):
            if it.get("hidden"):
                continue
            a, z = int(math.floor(it["from"])), int(math.ceil(it["from"] + it["dur"]))
            keys.update((a, z))
            fi, fo = it.get("fade_in", props.get("fade_in", 0)) or 0, it.get("fade_out", props.get("fade_out", 0)) or 0
            if fi:
                keys.update(range(a, a + int(math.ceil(fi * fps)) + 1, step))
            if fo:
                keys.update(range(z - int(math.ceil(fo * fps)) - 1, z, step))
            for k in (it.get("anim") or {}).values():
                if k:
                    keys.update(range(a + int(k[0][0] * fps), a + int(math.ceil(k[-1][0] * fps)) + 1, step))
            if (it.get("style") or props.get("style")) in animated:
                keys.update(range(a, z, step))
            if "{clock}" in str(it.get("text", "")):
                keys.update(range(a, z, max(1, int(round(fps)))))
    return sorted(k for k in keys if 0 <= k < total)


def asset_public(ep, project, ids, pub):
    """The pictures / fonts a graphics run uses, linked into the renderer's public folder: {asset id: file name}."""
    urls = {}
    os.makedirs(pub, exist_ok=True)
    for aid in ids:
        a = project["assets"].get(aid)
        if not a or a["kind"] not in ("image", "font"):
            continue
        src = os.path.normpath(ep.p(a["src"]))
        name = "".join(c if c.isalnum() or c in "-_." else "_" for c in aid) + os.path.splitext(src)[1]
        dst = os.path.join(pub, name)
        if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src):
            if os.path.exists(dst):
                os.remove(dst)
            try:
                os.link(src, dst)
            except OSError:
                shutil.copy2(src, dst)
        urls[aid] = name
    return urls


def render_graphics(ep, project, k, layers, scale, total, step=1):
    """One graphics run -> work/layers/g<k>/f-000000.png .. one picture per video frame (held frames hard-linked)."""
    fps = project["canvas"]["fps"]
    keys = changes(layers, fps, total, step)
    out = ep.work("layers", f"g{k}", "x")[:-2]
    raw = os.path.join(out, "raw")
    for d in (out, raw):
        if os.path.isdir(d):
            shutil.rmtree(d)
        os.makedirs(d)
    used = {a for l in layers for a in [(l.get("props") or {}).get("asset")] + [it.get("asset") for it in l.get("items", [])] + [it.get("font") for it in l.get("items", [])] + [(l.get("props") or {}).get("font")] if a}
    # every picture / font the project has: a style may name one in any field (a sticker's picture) - they're linked, cheap
    used |= {aid for aid, a in project["assets"].items() if a["kind"] in ("font", "image")}
    pub = ep.work("layers", "public", "x")[:-2]
    urls = asset_public(ep, project, used, pub)
    props_file = ep.work("layers", f"g{k}.props.json")
    with open(props_file, "w", encoding="utf-8") as fh:
        json.dump({"project": project, "urls": urls, "static": True, "mode": "graphics", "only": [l["id"] for l in layers], "frameMap": keys},
                  fh, ensure_ascii=False)
    log(f"  · drawing layers {', '.join(l['id'] for l in layers[:4])}{'…' if len(layers) > 4 else ''}: {len(keys)} of {total} frames change")
    r = subprocess.run(["node", REMOTION, "render", "src/index.ts", "Layers", raw, "--sequence", "--image-format=png", f"--props={props_file}",
                        f"--public-dir={pub}", "--concurrency=4", "--log=error"] + ([f"--scale={scale}"] if scale != 1 else []),
                       cwd=os.path.join(ROOT, "render"), creationflags=LOW)
    if r.returncode:
        raise RuntimeError("drawing the layers failed")
    pngs = sorted(f for f in os.listdir(raw) if f.endswith(".png"))
    if len(pngs) != len(keys):
        raise RuntimeError(f"drew {len(pngs)} frames, expected {len(keys)}")
    for i, key in enumerate(keys):
        nxt = keys[i + 1] if i + 1 < len(keys) else total
        src = os.path.join(raw, pngs[i])
        for f in range(key, nxt):
            if (f - key) % 1000 == 999:  # NTFS allows 1023 links to one file: a fresh copy every 1000 frames held
                shutil.copy2(os.path.join(raw, pngs[i]), src := os.path.join(raw, f"hold-{i}-{f}.png"))
            os.link(src, os.path.join(out, f"f-{f:06d}.png"))
    return out


# ---- 2. video --------------------------------------------------------------------------------------------------------
def video_items(project, run_layers):
    """Every visible video item of a run, with its layer props and its backdrop, in drawing order."""
    out = []
    order = {l["id"]: i for i, l in enumerate(run_layers)}
    for l in run_layers:
        if l["kind"] != "video":
            continue
        bd = next((b for b in project["layers"] if b["kind"] == "backdrop" and not b.get("hidden") and (b.get("props") or {}).get("target") == l["id"]), None)
        for j, it in enumerate(l.get("items", [])):
            if it.get("hidden"):
                continue
            out.append({**(l.get("props") or {}), **it, "box": it.get("box") or (l.get("props") or {}).get("box"),
                        "_bd": bd, "_order": (it.get("z", 0), order[l["id"]], j)})
    return sorted(out, key=lambda x: x["_order"])


def crf_for(scale):
    """The encoder's quality by size: full 18, Quick check 24, the phone test 30 (small enough to send as it is)."""
    return "18" if scale >= 1 else "24" if scale >= 0.45 else "30"


def plan_chunks(items, total, min_len=60, max_len=300):
    """Cut the timeline where no video item crosses; a stretch longer than max_len is cut anyway."""
    bounds = sorted({0, total} | {int(it["from"]) for it in items} | {int(it["from"] + it["dur"]) for it in items})
    crossing = lambda b: any(it["from"] < b < it["from"] + it["dur"] for it in items)
    cuts, start = [0], 0
    for b in bounds[1:]:
        if b >= total:
            break
        if (b - start >= min_len and not crossing(b)) or b - start >= max_len:
            cuts.append(b)
            start = b
    while total - cuts[-1] > max_len:
        cuts.append(cuts[-1] + max_len)
    cuts.append(total)
    return [(a, z) for a, z in zip(cuts, cuts[1:]) if z > a]


def _mask(ep, w, h, r):
    import cv2
    path = ep.work("layers", "masks", f"{w}x{h}r{r}.png")
    if not os.path.exists(path):
        m = np.zeros((h, w), np.uint8)
        cv2.rectangle(m, (r, 0), (w - 1 - r, h - 1), 255, -1)
        cv2.rectangle(m, (0, r), (w - 1, h - 1 - r), 255, -1)
        for cx, cy in ((r, r), (w - 1 - r, r), (r, h - 1 - r), (w - 1 - r, h - 1 - r)):
            cv2.circle(m, (cx, cy), r, 255, -1, lineType=cv2.LINE_AA)
        cv2.imwrite(path, m)
    return path


def render_chunk(ep, project, k, c0, c1, runs, gdirs, scale, base=None, name=None):
    """base: a video to draw on instead of the canvas colour (the effected picture under the layers above an effect)."""
    fps = project["canvas"]["fps"]
    W, H = project["canvas"]["w"], project["canvas"]["h"]
    n = c1 - c0
    cw, ch = int(round(W * scale / 2) * 2), int(round(H * scale / 2) * 2)
    out = ep.work("layers", "chunks", name or f"c{k:04d}.mp4")
    color = (project["canvas"].get("color") or "#000000").replace("#", "0x")
    if base:
        args = [FFMPEG, "-y", "-v", "error", "-i", base]
        fc, last, idx = [f"[0:v]setpts=PTS-STARTPTS,trim=end_frame={n}[base]"], "[base]", 1
    else:
        args = [FFMPEG, "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c={color}:s={cw}x{ch}:r={fps}:d={(n + 2) / fps:.4f}"]
        fc, last, idx = [], "[0:v]", 1
    # the drawn layers: a frame that is fully opaque (an end poster over everything) comes out of the PNG encoder as
    # RGB, not RGBA - the format changed mid-stream, ffmpeg rebuilt the graph and deadlocked (the last chunk of _gl
    # hung for good, 2026-10-22). -reinit_filter 0 + format=rgba keep one format.
    gin = {}
    for ri, run_ in enumerate(runs):
        if not run_["video"]:
            args += ["-reinit_filter", "0", "-framerate", str(fps), "-start_number", str(c0), "-i", os.path.join(gdirs[ri], "f-%06d.png")]
            gin[ri], idx = idx, idx + 1
    for ri, run_ in enumerate(runs):
        if not run_["video"]:
            fc.append(f"[{gin[ri]}:v]setpts=PTS-STARTPTS,format=rgba,trim=end_frame={n}[gi{ri}]")
            fc.append(f"{last}[gi{ri}]overlay=0:0:format=auto:eof_action=pass[gb{ri}]")
            last = f"[gb{ri}]"
            continue
        for j, it in enumerate(run_["items"]):
            a, z = max(it["from"], c0), min(it["from"] + it["dur"], c1)
            a, z = int(round(a)), int(round(z))
            if z <= a:
                continue
            tag = f"{ri}_{j}"
            asset = project["assets"][it["asset"]]
            box = it["box"]
            rate = float(it["rate"]) if it.get("rate") is not None else 1.0  # (0 = a held frame: never "or 1")
            src_t = float(it.get("in", 0)) + (a - it["from"]) / fps * rate
            ln = z - a
            w, h = max(2, int(box["w"] * scale) // 2 * 2), max(2, int(box["h"] * scale) // 2 * 2)
            left, top, vw, vh = (v * scale for v in fit_box(asset, box, it))
            vw, vh = max(2, int(round(vw / 2) * 2)), max(2, int(round(vh / 2) * 2))
            cx, cy = min(max(0, int(round(-left))), max(0, vw - w)), min(max(0, int(round(-top))), max(0, vh - h))
            hold = rate <= 1e-6  # rate 0 = a held frame at `in` (the other side talks over a frozen frame of him)
            dur = 0.2 if hold else ln / fps * rate + 0.1
            spts = "setpts=PTS-STARTPTS," if hold or abs(rate - 1) < 1e-4 else f"setpts=(PTS-STARTPTS)/{rate:.4f},"
            # the frames of the item: one frame repeated for a hold, else ln frames at its rate (picture and matte alike)
            frames = (f"fps={fps},trim=end_frame=1,loop=loop={max(0, ln - 1)}:size=1:start=0,setpts=N/{fps}/TB" if hold
                      else f"fps={fps},trim=end_frame={ln}")
            # eye contact: the corrected take (same frames, same matte) unless the item / layer turned it off
            src = asset.get("eyes_src") if it.get("eyes") is not False and asset.get("eyes_src") else asset["src"]
            args += ["-ss", f"{src_t:.4f}", "-t", f"{dur:.4f}", "-i", os.path.normpath(ep.p(src))]
            vi = idx
            idx += 1
            bd = it.get("_bd")
            cutout = it.get("cutout") and asset.get("matte")
            fit_wh = f"scale={vw}:{vh}:flags=bicubic,crop={w}:{h}:{cx}:{cy}"
            # props.af: a filter on the SOURCE picture first (a one-camera project's grade, already in the editor's take
            # copies) - the picture only, never the matte
            af = (it.get("af") or "").strip().strip(",")
            src_f = f"{frames},{af}" if af else frames
            look_of = lambda it_, tg: _look(it_.get("look")) + look.extra(it_.get("look"), scale, tg)  # colour, then warm / smooth
            if cutout:
                args += ["-ss", f"{src_t:.4f}", "-t", f"{dur:.4f}", "-i", os.path.normpath(ep.p(asset["matte"]))]
                ai = idx
                idx += 1
                sig = max(0.6, 1.0 * vw / asset["w"])
                fc.append(f"[{ai}:v]{spts}{frames},{fit_wh},gblur=sigma={sig:.2f},format=gray[al{tag}]")
                # the cut-out's live settings (edge cleanup, the desk kept, the side ramp) - pipeline/cutout.py, the
                # same math as the editor's VideoTrack
                kargs, kn, kfc = cutout_fx.post(tag, idx, ep, it, asset, box, W * scale, vw, vh, w, h, cx, cy, ln, fps, scale)
                args += kargs
                idx += kn
                if kfc:
                    fc.append(kfc)
                fc.append(f"[{vi}:v]{spts}{src_f},{fit_wh}[p{tag}]")
                fc.append(f"[p{tag}][{'ak' if kfc else 'al'}{tag}]alphamerge=shortest=1[pa{tag}]")
                img = project["assets"].get((bd or {}).get("props", {}).get("asset") or "") if bd else None
                if img:
                    gx, gy, gw, gh = backdrop_box(img, vw, vh, bd["props"], (cx, cy, w, h))
                    gw, gh = int(round(gw / 2) * 2), int(round(gh / 2) * 2)
                    bx, by = min(max(0, int(round(cx - gx))), max(0, gw - w)), min(max(0, int(round(cy - gy))), max(0, gh - h))
                    args += ["-loop", "1", "-framerate", str(fps), "-t", f"{ln / fps + 0.1:.4f}", "-i", os.path.normpath(ep.p(img["src"]))]
                    bi = idx
                    idx += 1
                    fc.append(f"[{bi}:v]setpts=PTS-STARTPTS,fps={fps},trim=end_frame={ln},scale={gw}:{gh}:flags=bicubic,crop={w}:{h}:{bx}:{by},format=yuv420p[g{tag}]")
                    fc.append(f"[g{tag}][pa{tag}]overlay=shortest=1:format=auto{look_of(it, tag)},format=yuva420p[v{tag}]")
                else:
                    fc.append(f"[pa{tag}]null{look_of(it, tag)},format=yuva420p[v{tag}]")
            else:
                fc.append(f"[{vi}:v]{spts}{src_f},{fit_wh}{look_of(it, tag)},format=yuva420p[v{tag}]")
            r = int(round((it.get("radius") or 0) * scale))
            post = []
            fi = float(it.get("fade_in") or 0) if a == int(round(it["from"])) else 0
            if fi:
                post.append(f"fade=t=in:st=0:d={fi:.4f}:alpha=1")
            op = float(it.get("opacity", 1) if it.get("opacity") is not None else 1)
            if op < 0.999:
                post.append(f"colorchannelmixer=aa={op:.3f}")
            t0, t1 = (a - c0) / fps, (z - c0 - 0.5) / fps
            post.append(f"setpts=PTS+{t0:.4f}/TB")
            if r > 0 and not (cutout and not bd):
                args += ["-loop", "1", "-framerate", str(fps), "-t", f"{ln / fps + 0.1:.4f}", "-i", _mask(ep, w, h, r)]
                mi = idx
                idx += 1
                fc.append(f"[{mi}:v]format=gray,setpts=PTS-STARTPTS,trim=end_frame={ln}[m{tag}]")
                fc.append(f"[v{tag}][m{tag}]alphamerge,{','.join(post)}[o{tag}]")
            else:
                fc.append(f"[v{tag}]{','.join(post)}[o{tag}]")
            fc.append(f"{last}[o{tag}]overlay=x={int(round(box['x'] * scale))}:y={int(round(box['y'] * scale))}:eof_action=pass:"
                      f"enable='between(t,{t0:.4f},{t1:.4f})'[b{tag}]")
            last = f"[b{tag}]"
    fc.append(f"{last}format=yuv420p[out]")
    args += ["-filter_complex", ";".join(fc), "-map", "[out]", "-frames:v", str(n), "-r", str(fps),
             "-c:v", "libx264", "-threads", str(X264_THREADS), "-preset", "medium" if scale >= 1 else "ultrafast",
             "-crf", crf_for(scale), "-pix_fmt", "yuv420p", "-an", out]
    r = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", errors="replace", creationflags=LOW)
    if r.returncode:
        raise RuntimeError(f"chunk {k} ({c0}-{c1}) failed:\n{r.stderr[-1500:]}")
    return out


# ---- 3-4. sound, mux, speed, checks ---------------------------------------------------------------------------------
def check(final, project, speed, quick):
    """Length at the project's speed, size, frame rate, sound, loudness - and stills to look at."""
    import re
    fps, W, H = project["canvas"]["fps"], project["canvas"]["w"], project["canvas"]["h"]
    info = ffprobe(final)
    v = next((s for s in info["streams"] if s["codec_type"] == "video"), None)
    a = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)
    dur, want = float(info["format"]["duration"]), project["duration"] / fps / speed
    problems = []
    if not v:
        problems.append("no picture")
    elif not quick and (int(v["width"]), int(v["height"])) != (W, H):
        problems.append(f"size {v['width']}x{v['height']}, expected {W}x{H}")
    if v and abs(eval(v.get("r_frame_rate", "0/1")) - fps) > 0.01:
        problems.append(f"frame rate {v.get('r_frame_rate')}, expected {fps}")
    if not a:
        problems.append("no sound")
    if abs(dur - want) > 0.25:
        problems.append(f"length {dur:.2f}s, expected {want:.2f}s")
    r = subprocess.run([FFMPEG, "-hide_banner", "-i", final, "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True,
                       encoding="utf-8", errors="replace").stderr
    m = re.findall(r"I:\s+(-?\d+\.\d) LUFS", r)
    lufs = float(m[-1]) if m else None
    if lufs is None or abs(lufs + 14) > 1.5:
        problems.append(f"loudness {lufs} LUFS (target -14)")
    return dur, lufs, problems


def at_fps(project, factor):
    """The same project at fps / factor (the phone test: 15 a second - every timeline position in seconds stays put,
    so the picture and the sound land exactly where they do in the real file; it just steps a bit)."""
    import copy
    p = copy.deepcopy(project)
    p["canvas"]["fps"] = project["canvas"]["fps"] / factor
    p["duration"] = int(math.ceil(project["duration"] / factor))
    for l in p["layers"]:
        for it in l.get("items", []):
            it["from"] = it["from"] / factor
            it["dur"] = max(1, it["dur"] / factor)
    return p


def export(ep, quick=False, test=False):
    t_start = time.time()
    project = projectlib.load(ep)
    if not project:
        sys.exit("✖ no project.json")
    if test:  # the phone test: half the frames (15 a second) - half the drawing, compositing and encoding
        project = at_fps(project, 2)
    fps, total = project["canvas"]["fps"], int(project["duration"])
    speed = float(project.get("speed") or 1)
    scale = 0.35 if test else 0.5 if quick else 1.0  # (test: 378x672 - reads well on a phone, a few MB)
    small = quick or test
    log(f"▶ export {ep.id}{' (phone test)' if test else ' (quick check)' if quick else ''}: {total} frames, {len(project['layers'])} layers, speed x{speed}")
    # film effects (pipeline/film_fx.py): every effect layer acts on what is below the top-most effect layer; the
    # layers above it are drawn on the effected picture
    top = film_fx.top_effect(project)
    ids = [l["id"] for l in project["layers"]]
    sub = lambda keep: {**project, "layers": [l for l in project["layers"] if keep(ids.index(l["id"]))]}
    passes = [stack_runs(sub(lambda i: i < top)), stack_runs(sub(lambda i: i > top))] if top >= 0 else [stack_runs(project)]
    # the sound doesn't depend on the picture: it is mixed alongside it
    sound_pool = ThreadPoolExecutor(max_workers=1)
    sound = sound_pool.submit(layers_audio.mix, ep, project, ep.work("layers", "export.wav"))
    # the graphics runs are drawn two at a time (a still one - the set - doesn't wait for the long one)
    gdirs, todo, gk = [], [], 0
    for runs in passes:
        g = {}
        for ri, r_ in enumerate(runs):
            if r_["video"]:
                r_["items"] = video_items(project, r_["layers"])
            else:
                todo.append((g, ri, gk, r_["layers"]))
                gk += 1
        gdirs.append(g)
    with ThreadPoolExecutor(max_workers=2) as pool:
        futs = [(g, ri, pool.submit(render_graphics, ep, project, k, ls, scale, total, 3 if test else 1)) for g, ri, k, ls in todo]
        for g, ri, fu in futs:
            g[ri] = fu.result()
    runs = [r_ for rs in passes for r_ in rs]
    log(f"  · layers drawn in {time.time() - t_start:.0f}s - putting the videos in")
    all_items = [it for r_ in runs if r_["video"] for it in r_["items"]]
    chunks = plan_chunks(all_items, total)
    cdir = ep.work("layers", "chunks", "x")[:-2]
    for fn in os.listdir(cdir):
        os.remove(os.path.join(cdir, fn))
    done = [0]

    fps_ = project["canvas"]["fps"]
    pre_all = film_fx.preroll(project) if top >= 0 else 0
    cw, chh = int(round(project["canvas"]["w"] * scale / 2) * 2), int(round(project["canvas"]["h"] * scale / 2) * 2)

    def job(kc):
        k, (c0, c1) = kc
        if top < 0:
            o = render_chunk(ep, project, k, c0, c1, passes[0], gdirs[0], scale)
        else:  # below the effect (from a little earlier: the ghost's history) -> the effects -> the layers above
            pre = min(pre_all, c0)
            low = render_chunk(ep, project, k, c0 - pre, c1, passes[0], gdirs[0], scale, name=f"c{k:04d}.low.mp4")
            fx = ep.work("layers", "chunks", f"c{k:04d}.fx.mp4")
            film_fx.apply_chunk(ep, project, low, fx, c0, c1 - c0, pre, cw, chh, crf_for(scale), "medium" if scale >= 1 else "ultrafast")
            o = render_chunk(ep, project, k, c0, c1, passes[1], gdirs[1], scale, base=fx)
        done[0] += c1 - c0
        log(f"Rendered {done[0]}/{total}")
        return o

    with ThreadPoolExecutor(max_workers=PIECES) as pool:
        outs = list(pool.map(job, enumerate(chunks)))
    lst = ep.work("layers", "chunks", "list.txt")
    with open(lst, "w", encoding="utf-8") as fh:
        fh.writelines(f"file '{o}'\n" for o in outs)
    silent = ep.work("layers", "video.mp4")
    run([FFMPEG, "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", silent])
    log(f"  · picture done in {time.time() - t_start:.0f}s ({len(chunks)} pieces) - the sound")
    wav = sound.result()
    sound_pool.shutdown()
    os.makedirs(ep.p("out"), exist_ok=True)
    final = ep.p("out", f"{ep.id}.test.mp4" if test else f"{ep.id}.draft.mp4" if quick else f"{ep.id}.mp4")
    abr = "96k" if test else "192k"
    tmp = final[:-4] + ".tmp.mp4"
    if abs(speed - 1) > 1e-3:  # the project's speed: every layer together, voices keep their pitch
        run([FFMPEG, "-y", "-v", "error", "-i", silent, "-i", wav, "-filter_complex", f"[0:v]setpts=PTS/{speed},fps={fps}[v];[1:a]atempo={speed}[a]",
             "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-threads", str(X264_THREADS), "-preset", "ultrafast" if small else "medium",
             "-crf", "30" if test else "24" if quick else "17", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", abr, "-shortest", "-movflags", "+faststart", tmp])
    else:
        run([FFMPEG, "-y", "-v", "error", "-i", silent, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
             "-c:a", "aac", "-b:a", abr, "-shortest", "-movflags", "+faststart", tmp])
    os.replace(tmp, final)
    dur, lufs, problems = check(final, project, speed, small)
    if problems:
        log("⚠ problems: " + "; ".join(problems))
    log(f"✔ {final}  ({dur:.1f}s, {lufs} LUFS, {time.time() - t_start:.0f}s)")
    for g in gdirs:  # the drawn frames are only for this export
        for d in g.values():
            shutil.rmtree(d, ignore_errors=True)
    return final


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--quick", action="store_true")
    ap.add_argument("--test", action="store_true")
    a = ap.parse_args()
    export(Episode(a.episode), quick=a.quick, test=a.test)
