"""The Zoom builder, as layers: the planned Zoom edit (work/edit.json + mix.json, made by zoomcut.py) written as a
project.json of generic layers - every tile piece a video item, each office photo a backdrop layer, name tags, green
borders, the removal flash and notice, subtitles, the window, the timer and the count as picture / text / shape
items, each character's voice an audio layer. Nothing Zoom-specific is left for the editor or the export: they only
know layers (skill/edit-video/layers.md). The first time it takes his settings from episode.json (look, framing,
office photo, voice, texts); after that project.json is his and a rebuild only refreshes the builder's items
(pipeline/project.py merge)."""
import os
import subprocess

from . import audio, compose
from .common import FFMPEG, FPS, ROOT, SR, load_json, log, run, save_json
from . import project as projectlib
from .plan import FONTS

TOP, POV_TOP, BAR, POV_Y = compose.TOP, compose.POV_TOP, compose.BAR, compose.POV_Y
ACCENT = "#2BD45E"
TOAST, LEAVE = int(3.5 * FPS), int(0.5 * FPS)
CHROME_V = 1  # bump when ZoomChrome.tsx changes: the picture is drawn again


def rel(ep, p):
    """A path for project.json: relative to the project folder, forward slashes."""
    return os.path.relpath(p, ep.dir).replace("\\", "/")


def image_size(path):
    import cv2
    import numpy as np
    img = cv2.imdecode(np.fromfile(path, np.uint8), cv2.IMREAD_UNCHANGED)
    return int(img.shape[1]), int(img.shape[0])


def chrome(ep, accent, ui):
    """The Zoom window (bars, icons) as one transparent picture, drawn by Remotion (render/src/builders/ZoomChrome.tsx)."""
    import json
    out = ep.work("layers", "zoom-chrome.png")
    stamp = json.dumps({"v": CHROME_V, "accent": accent, "ui": ui}, sort_keys=True, ensure_ascii=False)
    if os.path.exists(out) and os.path.exists(out + ".stamp") and open(out + ".stamp", encoding="utf-8").read() == stamp:
        return out
    props = ep.work("layers", "zoom-chrome.props.json")
    save_json(props, {"accent": accent, "ui": ui})
    remotion = os.path.join(ROOT, "render", "node_modules", "@remotion", "cli", "remotion-cli.js")
    r = subprocess.run(["node", remotion, "still", "src/index.ts", "ZoomChrome", out, f"--props={props}", "--image-format=png", "--log=error"],
                       cwd=os.path.join(ROOT, "render"), capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode:
        raise RuntimeError("the Zoom window picture failed:\n" + r.stderr[-800:])
    open(out + ".stamp", "w", encoding="utf-8").write(stamp)
    return out


def removal_wav(ep):
    out = ep.work("layers", "sfx-remove.wav")
    if not os.path.exists(out):
        audio._write_mono(out, audio.removal_sound())
    return out


def rect_box(r):
    return {"x": round(r["x"], 2), "y": round(r["y"], 2), "w": round(r["w"], 2), "h": round(r["h"], 2)}


def build(ep):
    """The fresh builder project for this episode (not merged)."""
    props = load_json(ep.work("edit.json"))
    mixplan = load_json(ep.work("mix.json"), [])
    state = load_json(ep.work("state.json"), {}) or {}
    if not props:
        raise SystemExit("✖ analyze the project first (no work/edit.json)")
    fps, total = props["fps"], props["durationInFrames"]
    accent = props.get("accent") or ACCENT
    ui = props.get("ui") or {}
    has_pov = compose.has_pov(props)
    top = POV_TOP if has_pov else TOP
    names = {pp["id"]: pp["name"] for pp in props["participants"]}
    chars = {c["id"]: c for c in ep.characters}
    assets, layers = {}, []

    # ---- assets: the takes, the office photos, the project's pictures, fonts, the window, sounds -------------------
    for cid, c in props["clips"].items():
        meta = (load_json(ep.work("meta", cid + ".json"), {}) or {}).get("clip", {})
        a = {"kind": "video", "src": "work/public/" + c["src"], "w": c["w"], "h": c["h"], "framing": c.get("framing"),
             "duration": meta.get("duration"), "who": c.get("char"), "label": f"{names.get(c.get('char'), c.get('char'))} · {cid.split('_')[-1]}"}
        if c.get("preview"):
            a["preview"] = "work/public/" + c["preview"]
        if c.get("fg"):
            a["fg"] = "work/public/" + c["fg"]
        if c.get("matte"):
            a["matte"] = rel(ep, c["matte"])
        if os.path.exists(ep.work("audio", cid + ".wav")):
            a["audio"] = f"work/audio/{cid}.wav"
        assets[cid] = a
    bgdir = ep.p("backgrounds")
    for fn in sorted(os.listdir(bgdir)) if os.path.isdir(bgdir) else []:
        if fn.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
            w, h = image_size(os.path.join(bgdir, fn))
            assets["bg." + fn] = {"kind": "image", "src": f"backgrounds/{fn}", "w": w, "h": h, "tag": "background"}
    for m in ep.cfg.get("media", []) or []:
        p = ep.p(m)
        if os.path.exists(p) and m.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
            w, h = image_size(p)
            assets["m." + os.path.basename(m)] = {"kind": "image", "src": rel(ep, p), "w": w, "h": h}
    for fnt in FONTS:
        if fnt.get("file"):
            assets["font." + fnt["id"]] = {"kind": "font", "src": rel(ep, os.path.join(ROOT, "fonts", fnt["file"])),
                                           "family": "zc-" + fnt["id"], "label": fnt.get("name", fnt["id"])}
    cp = chrome(ep, accent, ui)
    assets["zoom.chrome"] = {"kind": "image", "src": rel(ep, cp), "w": 1080, "h": 1920, "label": "Zoom window"}
    assets["sfx.remove"] = {"kind": "audio", "src": rel(ep, removal_wav(ep)), "label": "Leave chime"}

    # ---- the window: chrome picture, meeting title, timer, participant count -------------------------------------
    whole = lambda i, **k: {"id": i, "from": 0, "dur": total, "pin": "span", **k}
    layers.append({"id": "zoom.chrome", "kind": "image", "name": "Window", "group": "Window",
                   "items": [whole("w1", asset="zoom.chrome", box={"x": 0, "y": 0, "w": 1080, "h": 1920})]})

    # ---- per character: background (backdrop), picture (video), name tag, voice (audio) ----------------------------
    pieces = {}  # (pid) -> [item]
    for ch in compose.plan_chunks(props):
        for it in ch["items"]:
            pieces.setdefault(it["pid"], []).append((ch, it))
    shot_rects = [(s, compose.layout(s["layout"], s["order"], top)) for s in props["shots"]]
    for pp in props["participants"]:
        pid, name = pp["id"], pp["name"]
        fr, look = pp.get("frame") or {}, pp.get("look") or {}
        cut = any(it["clip"].get("fg") for _, it in pieces.get(pid, []))
        items = []
        for k, (ch, it) in enumerate(pieces.get(pid, [])):
            cid = next((c for c, v in props["clips"].items() if v is it["clip"]), None)
            r = it["rect"]
            item = {"id": f"p{k}", "from": ch["from"] + it["off"], "dur": it["len"], "asset": cid, "in": round(it["src"], 4),
                    "box": rect_box(r), "ref": {"take": cid, "in": round(it["src"], 2)}}
            if r["small"]:
                item.update({"head": 0.06, "z": 1})
            if it["fade"]:
                item["fade_in"] = round(it["fade"] / fps, 4)
            items.append(item)
        bg = pp.get("bg")
        if bg:
            layers.append({"id": f"{pid}.bg", "kind": "backdrop", "name": "Background", "group": name,
                           "props": {"target": f"{pid}.picture", "asset": "bg." + os.path.basename(bg["image"]),
                                     "x": bg.get("x", 0), "y": bg.get("y", 0), "zoom": bg.get("zoom", 1)}, "items": []})
        layers.append({"id": f"{pid}.picture", "kind": "video", "name": "Picture", "group": name,
                       "props": {"fit": "face", "zoom": fr.get("zoom", 1) or 1, "x": fr.get("x", 0) or 0, "y": fr.get("y", 0) or 0,
                                 "look": look, "radius": 14, "cutout": bool(cut)}, "items": items})

    # tags + thin borders per tile per shot; the green border on the speaker; the removal flash
    tags = {pid: [] for pid in names}
    borders, actives, flash, flash_txt = [], [], [], []
    leaving = {e["id"]: (e["at"] - LEAVE, e["at"]) for e in props["events"] if e["type"] == "remove"}
    for s, rects in shot_rects:
        for pid, r in rects.items():
            if pid not in tags:
                continue
            k = len(tags[pid])
            tags[pid].append({"id": f"t{k}", "from": s["from"], "dur": s["dur"], "text": names[pid], "ref": {"shot": s["from"]},
                              "box": {"x": round(r["x"] + r["w"] - 14, 2), "y": round(r["y"] + r["h"] - 14, 2), "anchor": "br"},
                              **({"size": 26} if r["small"] else {})})
            borders.append({"id": f"b{len(borders)}", "from": s["from"], "dur": s["dur"], "box": rect_box(r), "ref": {"shot": s["from"], "who": pid}})
        for a in props["active"]:
            a0, a1 = max(a["from"], s["from"]), min(a["from"] + a["dur"], s["from"] + s["dur"])
            if a1 <= a0 or a["id"] not in rects:
                continue
            if a["id"] in leaving:  # no green while he flashes red
                l0 = leaving[a["id"]][0]
                a1 = min(a1, l0) if a0 < l0 else a0
            if a1 > a0:
                actives.append({"id": f"a{len(actives)}", "from": a0, "dur": a1 - a0, "box": rect_box(rects[a["id"]]),
                                "ref": {"shot": s["from"], "at": a["from"]}})
        for pid, (l0, l1) in leaving.items():
            a0, a1 = max(l0, s["from"]), min(l1, s["from"] + s["dur"])
            if a1 <= a0 or pid not in rects:
                continue
            r = rects[pid]
            t0, t1 = (a0 - l0) / fps, (l1 - l0) / fps
            prog = lambda tt: 0.25 + 0.3 * (tt * fps / LEAVE)
            flash.append({"id": f"f{len(flash)}", "from": a0, "dur": a1 - a0, "box": rect_box(r), "fill": "rgb(160,0,0)",
                          "anim": {"opacity": [[0, prog(t0)], [t1 - t0, prog(t1)]]}, "ref": {"leave": pid, "part": "fill", "shot": s["from"]}})
            flash.append({"id": f"f{len(flash)}", "from": a0, "dur": a1 - a0, "box": rect_box(r), "stroke": "#ff3b3b", "width": 6,
                          "ref": {"leave": pid, "part": "border", "shot": s["from"]}})
            sc = lambda tt: 0.9 + 0.1 * (tt * fps / LEAVE)
            flash_txt.append({"id": f"r{len(flash_txt)}", "from": a0, "dur": a1 - a0, "text": "הוסר מהפגישה",
                              "box": {"x": round(r["x"] + r["w"] / 2, 2), "y": round(r["y"] + r["h"] / 2, 2), "anchor": "c"},
                              "anim": {"scale": [[0, sc(t0)], [t1 - t0, sc(t1)]]}, **({"size": 34} if r["small"] else {}),
                              "ref": {"leave": pid, "shot": s["from"]}})
    layers.append({"id": "zoom.borders", "kind": "shape", "name": "Tile edges", "group": "Window",
                   "props": {"stroke": "rgba(255,255,255,0.06)", "width": 1, "radius": 14}, "items": borders})
    layers.append({"id": "zoom.active", "kind": "shape", "name": "Speaker highlight", "group": "Window",
                   "props": {"stroke": accent, "width": 5, "radius": 14}, "items": actives})
    for pp in props["participants"]:
        layers.append({"id": f"{pp['id']}.tag", "kind": "text", "name": "Name tag", "group": pp["name"],
                       "props": {"style": "tag", "size": 32}, "items": tags[pp["id"]]})
    if flash:
        layers.append({"id": "zoom.leaving", "kind": "shape", "name": "Removed flash", "group": "Window",
                       "props": {"radius": 14}, "items": flash})
        layers.append({"id": "zoom.leaving-text", "kind": "text", "name": "Removed stamp", "group": "Window",
                       "props": {"style": "pill", "size": 64}, "items": flash_txt})

    # ---- subtitles: inside the big tile, above its name tag ------------------------------------------------------
    subs, chunk_no = [], {}
    for c in props["captions"]:
        cn = chunk_no[(c.get("n"), bool(c.get("side")))] = chunk_no.get((c.get("n"), bool(c.get("side"))), -1) + 1
        for s, rects in shot_rects:
            a0, a1 = max(c["from"], s["from"]), min(c["from"] + c["dur"], s["from"] + s["dur"])
            if a1 <= a0:
                continue
            big = sorted([r for r in rects.values() if not r["small"]], key=lambda r: -r["w"] * r["h"])
            own = rects.get(c.get("id")) if not c.get("side") and c.get("id") in rects and not rects[c["id"]]["small"] else None
            r = own if s["layout"] == "gallery" else (big[0] if big else own)
            narrow = bool(r) and r["w"] < 600
            if r:
                left, right, bottom = r["x"] + 20, r["x"] + r["w"] - 20, r["y"] + r["h"] - (64 if narrow else 84)
            else:
                left, right, bottom = 70, 1010, BAR - 96
            k = len(subs)
            item = {"id": f"s{k}", "from": a0, "dur": a1 - a0, "text": c["text"], "who": c["name"],
                    "box": {"x": round((left + right) / 2, 2), "y": round(bottom, 2), "w": round(right - left, 2), "anchor": "b"},
                    "ref": {"line": c.get("n"), "k": cn, "side": bool(c.get("side")), "part": a0 - c["from"]}}
            if c.get("side"):
                item["side"] = True
            if narrow:
                item.update({"compact": True, "size": 32})
            subs.append(item)
    layers.append({"id": "subs", "kind": "subtitles", "name": "Subtitles", "group": "Subtitles", "hidden": not props.get("subtitles", True),
                   "props": {"style": "zoom", "size": 46}, "items": subs})

    # ---- the removal notice ----------------------------------------------------------------------------------------
    ovs = props.get("overlays") or []
    oy = lambda o, i: o["y"] if o.get("y") is not None else (1180 if o.get("style") == "label" else POV_Y + i * 150)
    toast = []
    for e in props["events"]:
        if e["type"] != "remove":
            continue
        pov_bottom = max([0] + [oy(o, i) + -(-len(o.get("text", "")) // 36) * 58 + 24 for i, o in enumerate(ovs)
                                if o["from"] <= e["at"] < o["from"] + o["dur"] and oy(o, i) < POV_TOP])
        y = max(top + 40, pov_bottom + 28)
        n = TOAST / fps
        toast.append({"id": f"n{len(toast)}", "from": e["at"], "dur": TOAST, "text": (ui.get("removed") or "המארח הסיר את {name} מהפגישה").replace("{name}", e["name"]),
                      "box": {"x": 540, "y": y, "anchor": "t"}, "anim": {"opacity": [[0, 0], [4 / fps, 1], [n - 10 / fps, 1], [n, 0]]},
                      "ref": {"event": e["id"]}})
    if toast:
        layers.append({"id": "zoom.toast", "kind": "text", "name": "Notice", "group": "Window", "props": {"style": "toast", "size": 44}, "items": toast})

    # ---- title, timer, participant count -------------------------------------------------------------------------
    layers.append({"id": "zoom.title", "kind": "text", "name": "Meeting title", "group": "Window",
                   "props": {"style": "plain", "size": 30, "weight": 600, "color": "#fff", "lineHeight": 1.33},
                   "items": [whole("tt", text=props.get("title", "Meeting"), box={"x": 530, "y": 61, "w": 760, "anchor": "c"})]})
    layers.append({"id": "zoom.timer", "kind": "text", "name": "Timer", "group": "Window",
                   "props": {"style": "plain", "size": 24, "weight": 400, "color": "#a8a8a8", "dir": "ltr", "lineHeight": 1.33},
                   "items": [whole("tm", text="{clock}", clock_start=props.get("timerStart", 0), box={"x": 530, "y": 101, "w": 300, "anchor": "c"})]})
    count, cuts = len(props["participants"]), sorted(e["at"] for e in props["events"] if e["type"] == "remove")
    edges = [0] + cuts + [total]
    layers.append({"id": "zoom.count", "kind": "text", "name": "Participants count", "group": "Window",
                   "props": {"style": "plain", "size": 24, "weight": 600, "color": "#fff", "dir": "ltr", "lineHeight": 1.33},
                   "items": [{"id": f"c{k}", "from": edges[k], "dur": edges[k + 1] - edges[k], "text": str(count - k), "ref": {"count": k},
                              "box": {"x": 343, "y": 1766, "anchor": "tl"}, **({"pin": "span"} if k == len(cuts) else {})}
                             for k in range(len(edges) - 1) if edges[k + 1] > edges[k]]})

    # ---- his texts and pictures (episode.json "overlays"): his layers from the start --------------------------------
    srcs = [o for o in ep.cfg.get("overlays", []) if (o.get("text") or "").strip() or (o.get("style") == "image" and o.get("image"))]
    for i, (o, src) in enumerate(zip(ovs, srcs)):
        pin = "end" if (src.get("start") or 0) < 0 else ("span" if not src.get("end") else None)
        base = {"id": "o1", "from": o["from"], "dur": o["dur"], **({"pin": pin} if pin else {})}
        if o.get("style") == "image":
            p = ep.p(src["image"])
            aid = "m." + os.path.basename(p)
            if aid not in assets:
                w, h = image_size(p)
                assets[aid] = {"kind": "image", "src": rel(ep, p), "w": w, "h": h}
            layers.append({"id": f"image.{i + 1}", "kind": "image", "name": os.path.splitext(os.path.basename(p))[0], "group": "Pictures",
                           "items": [{**base, "asset": aid, "fade_in": o.get("fade_in", 0.3), "opacity": o.get("opacity", 1),
                                      "box": {"x": o.get("x") if o.get("x") is not None else 540, "y": o.get("y") if o.get("y") is not None else 960,
                                              "w": o.get("w") or 960, "anchor": "c"}}]})
        else:
            item = {**base, "text": o["text"], "theme": o.get("theme", "light"), "opacity": o.get("opacity", 1), "size": o.get("size") or 46,
                    "box": {"x": 540, "y": oy(o, i), "w": 960, "anchor": "t"}}
            if o.get("font") and o["font"] != "system":
                item["font"] = "font." + o["font"]
            layers.append({"id": f"text.{i + 1}", "kind": "text", "name": (o["text"][:24] + "…") if len(o["text"]) > 24 else o["text"],
                           "group": "Text", "props": {"style": "pov" if o.get("style") in ("pov", "label") else o.get("style", "pov")}, "items": [item]})

    # ---- sound: one voice layer per character, the effects --------------------------------------------------------
    voices = {}
    for k, seg in enumerate(mixplan):
        if seg.get("sfx"):
            continue
        char = seg["clip"].split("_")[0]
        it = {"id": f"v{len(voices.get(char, []))}", "from": round(seg["at"] * fps, 3), "dur": round((seg["out"] - seg["in"]) * fps, 3),
              "asset": seg["clip"], "in": round(seg["in"], 4), "fade_out": seg.get("fade_out", 0.12), "ref": {"line": seg["n"]} if seg.get("n") is not None else {"take": seg["clip"], "in": round(seg["in"], 2)}}
        if abs(seg.get("gain", 1) - 1) > 1e-6:
            it["gain"] = seg["gain"]
        if seg.get("soften"):
            it["soften"] = True
        voices.setdefault(char, []).append(it)
    for pp in props["participants"]:
        v = audio.voice_of(ep, pp["id"])
        layers.append({"id": f"{pp['id']}.voice", "kind": "audio", "name": "Voice", "group": pp["name"],
                       "props": {"volume": v.get("volume", 1), "clean": v.get("clean", "off"), "presence": v.get("presence", 0), "level": "speech"},
                       "items": voices.get(pp["id"], [])})
    sfx = [{"id": f"x{k}", "from": round(seg["at"] * fps, 3), "dur": round(len(audio.removal_sound()) / SR * fps, 3), "asset": "sfx.remove",
            "in": 0, "ref": {"sfx": k}} for k, seg in enumerate(mixplan) if seg.get("sfx")]
    layers.append({"id": "sfx", "kind": "audio", "name": "Effects", "group": "Sound", "props": {"volume": 1}, "items": sfx})

    script = [{k: l.get(k) for k in ("n", "speaker", "name", "text", "status", "start", "interrupted", "clip", "in", "out", "cut",
                                     "score", "heard", "auto", "alternatives", "fix")} for l in state.get("lines", [])]
    return {"format": projectlib.FORMAT, "title": ep.cfg.get("title") or ep.id,
            "canvas": {"w": props.get("width", 1080), "h": props.get("height", 1920), "fps": fps, "color": "#0b0b0b"},
            "duration": total, "speed": float(ep.cfg.get("speed") or 1), "assets": assets, "layers": layers, "script": script,
            "builder": {"kind": "zoom", "top": top, "accent": accent,
                        "actions": [{"id": "analyze", "label": "Re-analyze the footage"},
                                    {"id": "line", "label": "Fix a line (take / start / end / timing)"},
                                    {"id": "caption", "label": "A line's subtitle text"}]}}


def sync(ep, note="rebuild"):
    """Build the Zoom layers and fold them into project.json (his edits kept)."""
    fresh = build(ep)
    old = projectlib.load(ep)
    merged = projectlib.merge(old, fresh)
    if old:  # his project settings stay his
        for k in ("title", "speed", "canvas"):
            if k in old:
                merged[k] = old[k]
    projectlib.save(ep, merged, note)
    n = sum(len(l.get("items", [])) for l in merged["layers"])
    log(f"✔ layers: {len(merged['layers'])} layers, {n} items, {len(merged['assets'])} assets → {projectlib.path_of(ep)}")
    return merged
