"""Fast export. A browser renders only the interface (bars, name tags, captions, POV, removal flash)
as transparent PNG frames; ffmpeg composites the actual videos underneath — each tile cropped,
scaled, colour-adjusted, rounded and placed — one chunk per shot, chunks in parallel, then a
lossless concat and the audio. Same pixels as the all-browser render, a fraction of the time.

Geometry here must mirror render/src/ZoomCall.tsx (layout, videoBox, POV band).
"""
import os
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor

import numpy as np

from .common import FFMPEG, FPS, ROOT, log, run

TOP, POV_TOP, BAR, PAD, GAP = 150, 300, 1752, 16, 12
SW = 1080 - 2 * PAD
POV_Y = 270  # below the Reels / TikTok header - the same default as the editor (ZoomCall.tsx)


def layout(name, order, top):
    sh_total = BAR - top - 22
    r = {}
    n = len(order)
    if n == 1:
        r[order[0]] = dict(x=PAD, y=top, w=SW, h=sh_total, small=False)
    elif name == "gallery" and n >= 3:
        # Zoom's phone gallery: two columns (the first on the right), an odd last tile centred
        cols, rows = 2, (n + 1) // 2
        w, h = (SW - GAP) / 2, (sh_total - GAP * (rows - 1)) / rows
        for i, pid in enumerate(order):
            row, col = divmod(i, cols)
            x = PAD + (SW - w) / 2 if (n % 2 and i == n - 1) else PAD + SW - (col + 1) * w - col * GAP
            r[pid] = dict(x=x, y=top + row * (h + GAP), w=w, h=h, small=False)
    elif name == "gallery" or (name == "duo" and n == 2):
        h = (sh_total - GAP * (n - 1)) / n
        for i, pid in enumerate(order):
            r[pid] = dict(x=PAD, y=top + i * (h + GAP), w=SW, h=h, small=False)
    elif name == "duo":
        h = (sh_total - GAP) / 2
        r[order[0]] = dict(x=PAD, y=top, w=SW, h=h, small=False)
        r[order[1]] = dict(x=PAD, y=top + h + GAP, w=SW, h=h, small=False)
        r[order[2]] = dict(x=PAD + 22, y=top + sh_total - 360 - 22, w=270, h=360, small=True)
    else:
        sh = 380 if top > 200 else 430
        mh = sh_total - sh - GAP
        r[order[0]] = dict(x=PAD, y=top, w=SW, h=mh, small=False)
        rest = order[1:]
        w = (SW - GAP * (len(rest) - 1)) / len(rest)
        for i, pid in enumerate(rest):
            r[pid] = dict(x=PAD + SW - (i + 1) * w - i * GAP, y=top + mh + GAP, w=w, h=sh, small=True)
    return r


def video_box(clip, t, fr):
    fr = fr or {}
    base = max(t["w"] / clip["w"], t["h"] / clip["h"])
    s = base * max(1, fr.get("zoom") or 1)
    vw, vh = clip["w"] * s, clip["h"] * s
    fm = clip["framing"]
    fx = fm.get("cx", 0.5)
    head = fm["top"] if fm.get("top") is not None else max(0, fm.get("cy", 0.4) - fm.get("fh", 0.3) * 0.7)
    left = t["w"] / 2 - fx * vw + (fr.get("x") or 0) * t["w"]
    top = t["h"] * ((0.06 if t["small"] else 0.09) + (fr.get("y") or 0)) - head * vh
    left = min(0, max(t["w"] - vw, left))
    top = min(0, max(t["h"] - vh, top))
    return left, top, vw, vh


def has_pov(props):
    for i, o in enumerate(props.get("overlays") or []):
        y = o.get("y")
        if y is None:
            y = 1180 if o.get("style") == "label" else POV_Y + i * 150
        if o.get("style") == "pov" and y < POV_TOP - 40:
            return True
    return False


def _mask(ep, w, h, r=14):
    import cv2
    path = ep.work("masks", f"{w}x{h}.png")
    if not os.path.exists(path):
        m = np.zeros((h, w), np.uint8)
        cv2.rectangle(m, (r, 0), (w - 1 - r, h - 1), 255, -1)
        cv2.rectangle(m, (0, r), (w - 1, h - 1 - r), 255, -1)
        for cx, cy in ((r, r), (w - 1 - r, r), (r, h - 1 - r), (w - 1 - r, h - 1 - r)):
            cv2.circle(m, (cx, cy), r, 255, -1, lineType=cv2.LINE_AA)
        cv2.imwrite(path, m)
    return path


def plan_chunks(props):
    top = POV_TOP if has_pov(props) else TOP
    parts = {p["id"]: p for p in props["participants"]}
    chunks = []
    for shot in props["shots"]:
        s0, s1 = shot["from"], shot["from"] + shot["dur"]
        rects = layout(shot["layout"], shot["order"], top)
        items = []
        for pid, rect in sorted(rects.items(), key=lambda kv: kv[1]["small"]):  # floating tiles on top
            for seg in sorted(props["tiles"].get(pid, []), key=lambda s: s["from"]):
                a, b = max(seg["from"], s0), min(seg["from"] + seg["dur"], s1)
                if b <= a or seg["clip"] not in props["clips"]:
                    continue
                items.append({"pid": pid, "rect": rect, "clip": props["clips"][seg["clip"]], "off": a - s0, "len": b - a,
                              "src": seg["at"] + (a - seg["from"]) / FPS, "fade": seg.get("fade", 0) if a == seg["from"] else 0,
                              "look": parts.get(pid, {}).get("look"), "frame": parts.get(pid, {}).get("frame"),
                              "bg": parts.get(pid, {}).get("bg")})
        chunks.append({"from": s0, "dur": shot["dur"], "items": _absorb_tiny(items)})
    return chunks


def _absorb_tiny(items, min_len=20):
    """A tile that switches takes for a few frames (a listening tile, 2 or 15 frames) is invisible - and it hung ffmpeg
    for good (gilad-joins export, 2026-10-22, old and layered paths alike). The neighbouring piece of the same person
    takes its frames instead: the next piece starts earlier in its take, or the previous one runs on."""
    out = []
    for pid in dict.fromkeys(it["pid"] for it in items):
        mine = sorted((dict(it) for it in items if it["pid"] == pid), key=lambda it: it["off"])
        k = 0
        while k < len(mine):
            it = mine[k]
            if it["len"] < min_len and len(mine) > 1:
                nxt = mine[k + 1] if k + 1 < len(mine) else None
                gap = max(0, nxt["off"] - it["off"]) if nxt is not None else 0  # (they may overlap: then just drop it)
                if nxt is not None and nxt["src"] - gap / FPS >= 0:
                    nxt["off"] -= gap; nxt["len"] += gap; nxt["src"] -= gap / FPS; nxt["fade"] = 0
                    mine.pop(k)
                    continue
                if k > 0:
                    mine[k - 1]["len"] += it["len"]
                    mine.pop(k)
                    continue
            k += 1
        out += mine
    return out


def _look(look):
    if not look:
        return ""
    sat, con, bri = look.get("saturate", 1), look.get("contrast", 1), look.get("brightness", 1)
    f = f",eq=saturation={sat:.3f}:contrast={con:.3f}"
    if abs(bri - 1) > 1e-3:
        f += f",colorchannelmixer=rr={bri:.3f}:gg={bri:.3f}:bb={bri:.3f}"
    return f


def render_chunk(ep, k, ch, ui_dir, pad):
    out = ep.work("chunks", f"c{k:03d}.mp4")
    n = ch["dur"]
    args = [FFMPEG, "-y", "-v", "error",
            "-f", "lavfi", "-i", f"color=c=0x0b0b0b:s=1080x1920:r={FPS}:d={(n + 2) / FPS:.4f}",
            "-framerate", str(FPS), "-start_number", str(ch["from"]), "-i", os.path.join(ui_dir, f"element-%0{pad}d.png")]
    fc, last, idx = [], "[0:v]", 2
    for j, it in enumerate(ch["items"]):
        r = it["rect"]
        # even sizes: the video goes through yuva420p, which can't be odd (3 thumbnails of 341.3 px -> 340 vs a 341 mask)
        w, h = int(r["w"]) // 2 * 2, int(r["h"]) // 2 * 2
        left, top, vw, vh = video_box(it["clip"], r, it["frame"])
        vw, vh = int(round(vw / 2) * 2), int(round(vh / 2) * 2)
        cx, cy = min(max(0, int(round(-left))), vw - w), min(max(0, int(round(-top))), vh - h)
        dur = it["len"] / FPS + 0.1
        args += ["-ss", f"{it['src']:.4f}", "-t", f"{dur:.4f}", "-i", os.path.join(ep.public, it["clip"]["src"])]
        args += ["-loop", "1", "-framerate", str(FPS), "-t", f"{dur:.4f}", "-i", _mask(ep, w, h)]
        vi, mi = idx, idx + 1
        idx += 2
        fade = f",fade=t=in:st=0:d={it['fade'] / FPS:.4f}:alpha=1" if it["fade"] else ""
        t0, t1 = it["off"] / FPS, (it["off"] + it["len"] - 0.5) / FPS
        bg, matte = it.get("bg"), it["clip"].get("matte")
        if bg and matte:
            # the background layer: the office photo placed in the person's box (bg_box = the editor's bgBox), the take
            # masked by its cut-out on top, the character's look over both - then cropped to the tile like before
            from .background import bg_box
            gx, gy, gw, gh = bg_box(bg, vw, vh)
            gw, gh = int(round(gw / 2) * 2), int(round(gh / 2) * 2)
            # every branch of the tile (take, mask, photo) is cut to the piece's exact frame count: branches that ran on
            # after a short piece ended left ffmpeg's scheduler waiting forever (gilad-joins export hung, 2026-10-22)
            args += ["-ss", f"{it['src']:.4f}", "-t", f"{dur:.4f}", "-i", matte]
            args += ["-loop", "1", "-framerate", str(FPS), "-t", f"{dur:.4f}", "-i", os.path.join(ep.public, bg["image"])]
            ai, bi = idx, idx + 1
            idx += 2
            sig = max(0.8, 1.0 * vw / it["clip"]["w"])
            bx, by = min(max(0, int(round(cx - gx))), gw - w), min(max(0, int(round(cy - gy))), gh - h)
            fr = it["len"]
            fc.append(f"[{bi}:v]setpts=PTS-STARTPTS,fps={FPS},trim=end_frame={fr},scale={gw}:{gh}:flags=bicubic,crop={w}:{h}:{bx}:{by},format=yuv420p[g{j}]")
            fc.append(f"[{ai}:v]setpts=PTS-STARTPTS,fps={FPS},trim=end_frame={fr},scale={vw}:{vh}:flags=bicubic,crop={w}:{h}:{cx}:{cy},gblur=sigma={sig:.2f},format=gray[al{j}]")
            fc.append(f"[{vi}:v]setpts=PTS-STARTPTS,fps={FPS},trim=end_frame={fr},scale={vw}:{vh}:flags=bicubic,crop={w}:{h}:{cx}:{cy}[p{j}]")
            fc.append(f"[p{j}][al{j}]alphamerge=shortest=1[pa{j}]")
            fc.append(f"[g{j}][pa{j}]overlay=shortest=1:format=auto{_look(it['look'])},format=yuva420p[v{j}]")
        else:
            fc.append(f"[{vi}:v]setpts=PTS-STARTPTS,fps={FPS},scale={vw}:{vh}:flags=bicubic,crop={w}:{h}:{cx}:{cy}{_look(it['look'])},format=yuva420p[v{j}]")
        fc.append(f"[{mi}:v]format=gray,setpts=PTS-STARTPTS[m{j}]")
        fc.append(f"[v{j}][m{j}]alphamerge{fade},setpts=PTS+{t0:.4f}/TB[o{j}]")
        fc.append(f"{last}[o{j}]overlay=x={int(round(r['x']))}:y={int(round(r['y']))}:eof_action=pass:"
                  f"enable='between(t,{t0:.4f},{t1:.4f})'[b{j}]")
        last = f"[b{j}]"
    fc.append(f"{last}[1:v]overlay=0:0:format=auto,format=yuv420p[out]")
    args += ["-filter_complex", ";".join(fc), "-map", "[out]", "-frames:v", str(n), "-r", str(FPS),
             "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-an", out]
    r = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode:
        raise RuntimeError(f"chunk {k} failed:\n{r.stderr[-1200:]}")
    return out


def export(ep, props, props_path, silent_out, concurrency=8):
    """Render the interface frames, composite every shot, concat. Returns the silent video path."""
    t_start = time.time()
    ui_dir = ep.work("ui")
    os.makedirs(ui_dir, exist_ok=True)  # first export of a new episode
    for fn in os.listdir(ui_dir):
        os.remove(os.path.join(ui_dir, fn))
    ui_props = props_path.replace(".json", ".ui.json")
    import json
    with open(ui_props, "w", encoding="utf-8") as fh:
        json.dump({**props, "uiOnly": True}, fh, ensure_ascii=False)
    log(f"  · drawing the interface ({props['durationInFrames']} frames)")
    remotion = os.path.join(ROOT, "render", "node_modules", "@remotion", "cli", "remotion-cli.js")
    r = subprocess.run(["node", remotion, "render", "src/index.ts", "ZoomCall", ui_dir, "--sequence", "--image-format=png",
                        f"--props={ui_props}", f"--public-dir={ep.public}", f"--concurrency={concurrency}", "--log=error"],
                       cwd=os.path.join(ROOT, "render"))
    if r.returncode:
        raise RuntimeError("interface render failed")
    pngs = sorted(f for f in os.listdir(ui_dir) if f.endswith(".png"))
    pad = len(pngs[0].split("-")[1].split(".")[0])
    log(f"  · interface done in {time.time() - t_start:.0f}s — compositing the videos")
    chunks = plan_chunks(props)
    done = [0]

    def job(kc):
        k, ch = kc
        out = render_chunk(ep, k, ch, ui_dir, pad)
        done[0] += ch["dur"]
        log(f"Rendered {done[0]}/{props['durationInFrames']}")
        return out

    with ThreadPoolExecutor(max_workers=max(2, min(6, (os.cpu_count() or 8) // 3))) as pool:
        outs = list(pool.map(job, enumerate(chunks)))
    lst = ep.work("chunks", "list.txt")
    with open(lst, "w", encoding="utf-8") as fh:
        fh.writelines(f"file '{o}'\n" for o in outs)
    run([FFMPEG, "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", silent_out])
    log(f"  · video composited in {time.time() - t_start:.0f}s")
    return silent_out
