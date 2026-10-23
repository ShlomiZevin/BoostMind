"""The one-camera builder: a solo project (lesson.py - a monologue, the rabbi / guru / news anchor / keynote) as layers.

lesson.py stays the brain: its own plan (cuts, dragged edges, inserts and holds, slow motion, jump-cut joins), its
subtitles, its overlay / sound / effect timing, its eye contact, cut-out, set and sound processing. This file only
TRANSLATES what it decided into project.json layers (skill/edit-video/layers.md), and project.merge() keeps his own
edits on a rebuild - the same shape as the Zoom builder (zoomcut.py + to_layers.py).

  python -m pipeline.to_layers_solo episodes/<id>        (on a "_" test copy until its export matches the old one)

Layers, bottom to top: Set (the room photo: sign, plaque, blur, dim baked in) - things placed behind him - Person
(cut-out, eye contact, look; holds = held frames) - the film effects - Opening video - texts / overlays - the other
side's subtitles - Subtitles - and the sound: Voice (his voice chain + cleaning), effects, inserts, Music."""
import glob
import hashlib
import json
import os
import shutil
import subprocess
import sys

import numpy as np

from . import project as projectlib
from .common import FFMPEG, ROOT, SR, log, run

sys.path.insert(0, ROOT)
import lesson as L  # noqa: E402

FPS, W, H = L.FPS, L.W, L.H
PRESETS = {  # render/ui/sound.ts VOICE_PRESETS (the chain's values; "denoise" is the cleaning, handled apart)
    "raw": {"raw": True, "boost": 0, "denoise": False, "lowcut": 0, "warmth": 0, "box": 0, "presence": 0, "deess": 0, "comp": 0},
    "natural": {"denoise": False, "lowcut": 60, "warmth": 0, "box": 0, "presence": 0, "deess": 0, "comp": 0},
    "podcast": {"denoise": True, "lowcut": 85, "warmth": 1.5, "box": -2.5, "presence": 2.5, "deess": 0.4, "comp": 0.6},
    "radio": {"denoise": True, "lowcut": 120, "warmth": 3, "box": -3, "presence": 4, "deess": 0.5, "comp": 0.9},
    "warm": {"denoise": True, "lowcut": 70, "warmth": 3, "box": -1.5, "presence": 1, "deess": 0.3, "comp": 0.4},
    "bright": {"denoise": True, "lowcut": 100, "warmth": 0, "box": -2, "presence": 5, "deess": 0.6, "comp": 0.5},
    "news": {"denoise": True, "lowcut": 95, "warmth": 2, "box": -3, "presence": 3.5, "deess": 0.45, "comp": 0.75},
    "hall": {"denoise": True, "lowcut": 130, "warmth": -1.5, "box": -1, "presence": 1.5, "deess": 0.35, "comp": 0.5, "room": 0.45, "roomSize": 1.8},
    "stage": {"denoise": True, "lowcut": 110, "warmth": 1, "box": -2.5, "presence": 3, "deess": 0.4, "comp": 0.7, "room": 0.32, "roomSize": 2.4, "pa": 0.5},
}
FILTER_IDS = ["grade", "dark", "vignette", "grain", "zoom", "drift", "flicker", "ghost"]
FILTER_LABEL = {"grade": "Movie colour", "dark": "Darken", "vignette": "Vignette", "grain": "Film grain", "zoom": "Slow zoom in",
                "drift": "Handheld", "flicker": "Light flicker", "ghost": "Ghost trail", "hits": "Hits", "black": "Black"}


def voice_settings(v0):
    """episode.json "voice" -> the full settings (sound.ts voiceSettings)."""
    if isinstance(v0, str):
        return {"preset": v0, **PRESETS.get(v0, PRESETS["natural"])}
    if isinstance(v0, dict):
        return {**PRESETS.get(v0.get("preset") or "natural", PRESETS["natural"]), **v0}
    return {"preset": "natural", **PRESETS["natural"]}


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration",
                        "-of", "json", path], capture_output=True, text=True)
    j = json.loads(r.stdout or "{}")
    s = (j.get("streams") or [{}])[0]
    return s.get("width") or W, s.get("height") or H, float((j.get("format") or {}).get("duration") or 0)


def stamp_ok(out, sig):
    return os.path.exists(out) and os.path.exists(out + ".sig") and open(out + ".sig").read() == sig


def stamp(out, sig):
    open(out + ".sig", "w").write(sig)


# ---- picture ---------------------------------------------------------------------------------------------------
def final_matte(ls, n, ramp):
    """The take's export mask, exactly as lesson.py builds each piece's: his matte (+ the kept desk, lighten) at the
    matte size, the half-sure halo cut away (matte_cut, TV range), and the sides faded when he doesn't fill the frame.
    One file per take, so the layered export reads it straight (no lesson-specific steps there)."""
    mk = L.matte_path(ls, n)
    if not os.path.exists(mk):
        return None
    keep = L.keep_png(ls, n)
    cut = ls.cfg.get("matte_cut", 175)
    sig = hashlib.md5(json.dumps([os.path.getmtime(mk), keep and os.path.getmtime(keep), cut, bool(ramp), 1]).encode()).hexdigest()[:10]
    out = ls.work("layers", "matte", f"{n}.mkv")
    if stamp_ok(out, sig):
        return out
    mw, mh = L.MATTE_W * 2, L.MATTE_H * 2
    ins, fc = ["-i", mk], f"[0:v]fps={FPS},scale={mw}:{mh},format=gray[a0]"
    last = "[a0]"
    if keep:
        ins += ["-loop", "1", "-i", keep]
        fc += f";[1:v]scale={mw}:{mh},format=gray[k];[a0][k]blend=all_mode=lighten:shortest=1,format=gray[a1]"
        last = "[a1]"
    # (lesson.py stores the pieces as yuv420p - TV range - before mask_curve reads them: the same steps here)
    fc += f";{last}format=yuv420p,lutyuv=y='{L.mask_curve(cut)}',format=gray"
    if ramp:
        ins += ["-loop", "1", "-i", ramp]
        fc += f"[m0];[{ins.count('-i') - 1}:v]format=gray,scale={mw}:{mh}[r];[m0][r]blend=all_mode=multiply:shortest=1,format=gray"
    fc += "[o]"
    run([FFMPEG, "-y", "-v", "error", *ins, "-filter_complex", fc, "-map", "[o]", "-shortest", "-c:v", "ffv1", "-pix_fmt", "gray", out + ".part.mkv"])
    os.replace(out + ".part.mkv", out)
    stamp(out, sig)
    return out


def orig_preview(ls, n):
    """His take as filmed, for the editor, when the proxies were made from the eye-contact copy (Original eyes, no cut-out)."""
    out = ls.work("public", "takes", f"{n}.orig.mp4")
    src = L.take_src(ls, n, False)
    if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(src):
        return out
    look = "" if ls.cfg.get("look") else "," + L.grade(ls, 540)  # (like the other take files: the baked grade in)
    run([FFMPEG, "-y", "-v", "error", "-i", src, "-vf", f"fps={FPS},scale=540:960{look}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "26",
         "-g", "15", "-pix_fmt", "yuv420p", "-an", out + ".part.mp4"])
    os.replace(out + ".part.mp4", out)
    return out


def look_of(ls):
    """episode.json "look" (live: warm / brightness / saturation / smooth) or the baked "grade" -> a video layer's look."""
    lk = ls.cfg.get("look")
    if lk:
        return {k: v for k, v in {"saturate": float(lk.get("saturation", 1)), "brightness": 1 + float(lk.get("brightness", 0)),
                                  "warm": float(lk.get("warm", 0)) or None, "smooth": float(lk.get("smooth", 0)) or None}.items() if v is not None}
    return {}  # the older baked grade ("grade"): not a live look - the editor's take files carry it, the export gets props.af


# ---- sound -----------------------------------------------------------------------------------------------------
def prepared(ls, key, make):
    """A sound processed by lesson.py's own steps, written once per its settings: work/layers/sounds/<key>.wav."""
    out = ls.work("layers", "sounds", f"{key}.wav")
    if not os.path.exists(out):
        x = make()
        L.write_wav(out + ".part.wav", np.asarray(x, np.float32))
        os.replace(out + ".part.wav", out)
    return out


def sig_of(*parts):
    def mt(p):
        return os.path.getmtime(p) if isinstance(p, str) and os.path.exists(p) else p
    return hashlib.md5(json.dumps([mt(p) for p in parts], sort_keys=True, default=str).encode()).hexdigest()[:12]


def needs_prepared(s):
    """A sound whose processing has no live equivalent (RNNoise on it, played backwards, pauses cut out of it)."""
    return bool(s.get("denoise") or s.get("reverse") or s.get("skip"))


def filter_of(s):
    f = s.get("filter") or s.get("phone")
    return "phone" if f is True else f if isinstance(f, str) else None


_LEVELS = {}


def norm_level(ls, path, filt):
    """The filters lesson.py ends with loudnorm (thought / echo / muffled: every one at one level): the gain that step
    gave this sound, measured once here - the live filter then plays it at the same level (fx.level)."""
    af = L.SOUND_FILTERS.get(filt, "")
    if "loudnorm=" not in af:
        return 0.0
    key = (path, filt)
    if key not in _LEVELS:
        import re
        target = float(af.split("loudnorm=I=")[1].split(":")[0])
        pre = af.split(",loudnorm=")[0]
        r = subprocess.run([FFMPEG, "-hide_banner", "-i", path, "-af", pre + ",ebur128", "-f", "null", "-"], capture_output=True, text=True,
                           encoding="utf-8", errors="replace")
        m = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)
        _LEVELS[key] = round(target - float(m[-1]), 2) if m and float(m[-1]) > -70 else 0.0
    return _LEVELS[key]


def live_sound(ls, s, path):
    """A sound's settings as a clip's live fields (render/ui/soundfx.ts): (rate, fx). lesson.py's "pitch" is a tape
    (speed and pitch together) -> rate; its "tempo" (speed, same pitch) -> rate x tempo with the pitch brought back."""
    import math
    tempo, pitch = float(s.get("tempo", 1.0) or 1.0), float(s.get("pitch", 1.0) or 1.0)
    fx = {}
    filt = filter_of(s)
    if filt:
        fx["filter"] = filt
        lv = norm_level(ls, path, filt)
        if abs(lv) > 0.05:
            fx["level"] = lv
        if filt == "echo" and s.get("echo") is not None:
            fx["echo"] = float(s["echo"])
    if abs(tempo - 1) > 1e-3:
        fx["pitch"] = round(-12 * math.log2(tempo), 3)
    if s.get("room"):
        vv = ls.cfg.get("voice")
        vs = vv if isinstance(vv, dict) else ({"room": 0.45, "roomSize": 1.8} if vv == "hall" else {})
        r = s.get("room")
        fx["room"] = float(r) if not isinstance(r, bool) else float(vs.get("room") or 0.3)
        fx["roomSize"] = round(float(s.get("roomSize") or vs.get("roomSize") or 1.6), 2)
    return tempo * pitch, fx


def pre_sound_file(ls, s):
    """Only what has no live equivalent, done once: RNNoise on it, its skipped pauses joined, played backwards - NO
    filter / pitch / tempo / room (those stay live on the clip). The file starts at the sound's own "from"."""
    src = ls.asset(s["sound"])
    keys = {k: s.get(k) for k in ("denoise", "reverse", "skip", "from", "to")}

    def make():
        snd = L.load_sound(src, None, 1.0, denoise=s.get("denoise"))
        if s.get("reverse"):
            snd = snd[::-1].copy()
        xf = int(0.015 * SR)
        seg = np.zeros(0, np.float32)
        plain = {k: v for k, v in s.items() if k not in ("tempo", "pitch", "filter", "phone", "echo")}  # (the parts in the file's own seconds)
        for pa, pb in L.sound_parts(ls, plain):
            piece = snd[int(pa * SR):int(pb * SR)].astype(np.float32).copy()
            if len(seg) > xf and len(piece) > xf:
                piece[:xf] *= np.linspace(0, 1, xf)
                seg[-xf:] *= np.linspace(1, 0, xf)
                seg = np.concatenate([seg[:-xf], seg[-xf:] + piece[:xf], piece[xf:]])
            else:
                seg = np.concatenate([seg, piece])
        return seg
    return prepared(ls, "q" + sig_of(src, keys), make)


def placed_sound_file(ls, s):
    """A placed sound (episode.json "sounds") as lesson.py processes it - filter / pitch / tempo / echo / denoise, his
    room, reversed, its skipped pauses joined - before its trim, gain and fades (those stay live on the item)."""
    src = ls.asset(s["sound"])
    keys = {k: s.get(k) for k in ("filter", "phone", "pitch", "denoise", "tempo", "echo", "room", "roomSize", "reverse", "skip", "from", "to")}

    def make():
        snd = L.load_sound(src, s.get("filter") or s.get("phone"), s.get("pitch", 1.0), denoise=s.get("denoise"), tempo=s.get("tempo", 1.0), echo=s.get("echo"))
        if s.get("room"):
            snd = L.with_room(ls, s, snd)
        if s.get("reverse"):
            snd = snd[::-1].copy()
        xf = int(0.015 * SR)
        seg = np.zeros(0, np.float32)
        for pa, pb in L.sound_parts(ls, s):
            piece = snd[int(pa * SR):int(pb * SR)].astype(np.float32).copy()
            if len(seg) > xf and len(piece) > xf:
                piece[:xf] *= np.linspace(0, 1, xf)
                seg[-xf:] *= np.linspace(1, 0, xf)
                seg = np.concatenate([seg[:-xf], seg[-xf:] + piece[:xf], piece[xf:]])
            else:
                seg = np.concatenate([seg, piece])
        return seg
    return prepared(ls, "s" + sig_of(src, keys, ls.cfg.get("voice") if s.get("room") else None), make)


def ranged_sound_file(ls, s, n):
    """A sound between two of his words (from_word .. to_word): processed, looped when it is shorter than the span."""
    src = ls.asset(s["sound"])
    keys = {k: s.get(k) for k in ("filter", "phone", "pitch", "denoise", "tempo", "echo", "room", "roomSize")}

    def make():
        snd = L.load_sound(src, s.get("filter") or s.get("phone"), s.get("pitch", 1.0), denoise=s.get("denoise"), tempo=s.get("tempo", 1.0), echo=s.get("echo"))
        if s.get("room"):
            snd = L.with_room(ls, s, snd)
        if len(snd) < n:
            snd = np.tile(snd, n // max(1, len(snd)) + 1)
        return snd[:n]
    return prepared(ls, "r" + sig_of(src, keys, n), make)


def plain_sound_file(ls, path, flt=None):
    return prepared(ls, "p" + sig_of(ls.asset(path), flt), lambda: L.load_sound(ls.asset(path), flt))


def music_file(ls, items, total):
    """The music bed as lesson.py mixes it - looped over its span, faded, the speech carve (-3.5 dB at 2.5 kHz, as
    sound.ts), ducked under his voice and lifted when he stops for good - at full level (the layer's volume = its gain)."""
    m = ls.cfg.get("music") or {}
    if not m or m.get("off") or not m.get("sound"):
        return None, 0, 0
    n = int(total / FPS * SR)
    a0 = int(max(0.0, float(m.get("start") or 0)) * SR)
    a1 = n if m.get("end") is None else min(n, int(float(m["end"]) * SR))
    if a1 - a0 <= SR // 10:
        return None, 0, 0
    # only what is content, not a setting: the bed looped over the whole video (its clip's edges drag anywhere) and the
    # speech carve; its fades, the end lift and any duck are LIVE (the clip's fades, props.lift - automation.js)
    key = "m2" + sig_of(ls.asset(m["sound"]), total)

    def make():
        bed = L.load_sound(ls.asset(m["sound"]))
        full = np.tile(bed, n // max(1, len(bed)) + 1)[:n].copy()
        tmp = ls.work("layers", "sounds", key + ".dry.wav")
        L.write_wav(tmp, full)
        out = tmp[:-8] + ".carved.wav"
        run([FFMPEG, "-y", "-v", "error", "-i", tmp, "-af", "equalizer=f=2500:t=q:w=0.9:g=-3.5", "-ar", str(SR), "-ac", "1", out])
        from .media import read_wav
        y, _ = read_wav(out)
        os.remove(tmp)
        os.remove(out)
        return y
    return prepared(ls, key, make), a0 / SR, a1 / SR


# ---- the project -----------------------------------------------------------------------------------------------
def build(ep_dir, keep_settings=False):
    """keep_settings: only project.json (+ work/) is written - his episode.json / captions.txt stay exactly as they are
    (moving a project to the layered editor: deleting project.json is the way back)."""
    ls = L.Lesson(ep_dir)
    if keep_settings:  # lesson.py's timing steps write their results back into episode.json - here they stay in memory
        real = L.save_json
        L.save_json = lambda path, data, *a, **k: None if os.path.basename(path) == "episode.json" else real(path, data, *a, **k)
        try:
            return _build(ls, sync=False)
        finally:
            L.save_json = real
    return _build(ls)


def _build(ls, sync=True):
    rel = lambda p: os.path.relpath(p, ls.dir).replace("\\", "/")
    log(f"▶ {ls.slug} as layers (one camera)")
    items, total = L.plan(ls)
    if sync:  # (re-reads the script into captions.txt)
        L.sync_captions(ls)
    L.time_overlays(ls, items, total)
    L.time_fx(ls, items, total)
    caps = L.captions(ls, items, total)
    L.take_proxies(ls)
    set_png = L.text_layers(ls, caps, anims_too=False)  # (the set: the photo + sign + plaque, blurred and dimmed as before)
    cfg = ls.cfg
    eyes = L.eye_cfg(ls) is not None and L.eye_on(ls) is not False
    cutout = cfg.get("cutout") is not False
    pw, ph, px, py = L.layout(ls)
    ramp = L.ramp_png(ls) if (pw < W or px > 0 or px + pw < W) else None
    v = voice_settings(cfg.get("voice"))
    dn = cfg.get("denoise") or {}
    clean = None if not v.get("denoise") else "nn" if dn.get("rnn") else "fft" if not dn else "custom"

    assets, layers = {}, []
    font = lambda fid: assets.setdefault(f"font.{fid}", {"kind": "font", "src": rel(os.path.join(ROOT, "fonts", next(
        f["file"] for f in json.load(open(os.path.join(ROOT, "fonts", "fonts.json"))) if f["id"] == fid))), "family": f"zc-{fid}"})
    for fid in ("stam-ashkenaz", "assistant"):
        font(fid)

    # the takes: whole, every version the editor switches between live
    for t in ls.takes:
        n = L.name(t)
        w, h, dur = probe(t)
        a = {"kind": "video", "src": rel(t), "w": w, "h": h, "duration": round(dur, 3), "label": n,
             "audio": rel(L.take_audio(ls, n, False))}  # (his voice as recorded - its pitch is live, the voice layer's fx)
        takes = ls.work("public", "takes")
        if eyes:
            g = L.take_src(ls, n, True)
            a.update({"preview": rel(orig_preview(ls, n)), "eyes": rel(os.path.join(takes, f"{n}.plain.mp4")), "eyes_src": rel(g),
                      "eyes_engine": "capcut" if (cfg.get("eye_contact") or {}).get("file") else "v6" if os.path.exists(g + ".fallback") else
                      (cfg.get("eye_contact") or {}).get("mode", "nvidia")})
            if cutout:
                a.update({"fg": rel(os.path.join(takes, f"{n}.raw.webm")), "eyes_fg": rel(os.path.join(takes, f"{n}.webm"))})
        else:
            a["preview"] = rel(os.path.join(takes, f"{n}.plain.mp4"))
            if cutout:
                a["fg"] = rel(os.path.join(takes, f"{n}.webm"))
        if cutout:  # his matte as it is - the halo threshold, the kept desk and the side fade are LIVE (VideoTrack / pipeline/cutout.py)
            mk = L.matte_path(ls, n)
            if os.path.exists(mk):
                a["matte"] = rel(mk)
            ks = L.keep_static_png(ls, n)
            if ks:
                a["keep_static"] = rel(ks)
        assets[f"t.{n}"] = a
    full = {"x": 0, "y": 0, "w": W, "h": H}
    # Set - LIVE: the room photo (with its sign painted in) in the photo's own pixels, placed by its box (drag = pan,
    # the corner = zoom), its blur / dim as the picture's look; the plaque's lettering a sharp layer over it, the same box
    scene, plaque = ls.work("public", "scene.png"), ls.work("public", "plaque.png")
    if os.path.exists(scene):
        sw_, sh_, _ = probe(scene)
        c_, sw, sh, cx, cy = L.bg_place(ls)
        box = {"x": -cx, "y": -cy, "w": sw, "h": sh}
        assets["m.set"] = {"kind": "image", "src": rel(scene), "w": sw_, "h": sh_, "label": "Set - " + os.path.basename(cfg.get("background") or "photo")}
        look = {"blur": float(cfg.get("bg_blur", 2.2))}
        if cfg.get("bg_dim", True):
            look.update({"brightness": 0.96, "saturate": 0.95})
        layers.append({"id": "set", "kind": "image", "name": "Set", "owner": "builder", "props": look,
                       "items": [{"id": "set", "from": 0, "dur": total, "asset": "m.set", "box": dict(box), "pin": "span", "ref": {"set": 1}}]})
        if cfg.get("plaque_quad") and os.path.exists(plaque):
            assets["m.plaque"] = {"kind": "image", "src": rel(plaque), "w": sw_, "h": sh_, "label": "Plaque"}
            layers.append({"id": "plaque", "kind": "image", "name": "Plaque", "owner": "builder", "props": {},
                           "items": [{"id": "plaque", "from": 0, "dur": total, "asset": "m.plaque", "box": dict(box), "pin": "span", "ref": {"plaque": 1}}]})
    else:  # (no set photo: the older composite)
        assets["m.set"] = {"kind": "image", "src": rel(set_png), "w": W, "h": H, "label": "Set"}
        layers.append({"id": "set", "kind": "image", "name": "Set", "owner": "builder", "props": {},
                       "items": [{"id": "set", "from": 0, "dur": total, "asset": "m.set", "box": dict(full), "pin": "span", "ref": {"set": 1}}]})
    # (texts placed on the set, behind him, go here - see overlays below)
    behind_at = len(layers)

    # Person: the cut, held frames, the other side's footage
    pic, vo = [], []
    for k, it in enumerate(items):
        ins = it.get("insert") or {}
        if it["kind"] == "clip":
            link = f"cut-{it['take']}-{round(it['a'], 2)}"  # (picture, voice and subtitles of one piece move together)
            pic.append({"id": f"c{k}", "from": it["out"], "dur": it["n"], "asset": f"t.{it['take']}", "in": round(it["a"], 4),
                        **({"rate": it["sp"]} if it.get("sp", 1) != 1 else {}), "ref": {"take": it["take"], "a": round(it["a"], 2)}, "link": link})
            an = it.get("an", it["n"])
            vo.append({"id": f"v{k}", "from": it["out"], "dur": an, "asset": f"t.{it['take']}", "in": round(it["a"], 4),
                       **({"rate": it["sp"]} if it.get("sp", 1) != 1 else {}), "fade_in": 0.012,
                       "fade_out": round(max(0.012, (an - it["n"]) / FPS), 3) if "an" in it else 0.012,
                       "ref": {"take": it["take"], "a": round(it["a"], 2)}, "link": link})
        elif ins.get("hide"):
            continue
        elif ins.get("footage"):
            fo = ins["footage"]
            pic.append({"id": f"c{k}", "from": it["out"], "dur": it["n"], "asset": f"t.{fo['take']}", "in": round(float(fo["from"]), 4),
                        "ref": {"footage": fo["take"], "at": round(it["t"], 2)}})
        else:
            pic.append({"id": f"c{k}", "from": it["out"], "dur": it["n"], "asset": f"t.{it['take']}", "in": round(it["t"], 4), "rate": 0,
                        "ref": {"hold": it["take"], "at": round(it["t"], 2)}})
    layers.append({"id": "person", "kind": "video", "name": "Person", "owner": "builder",
                   "props": {"fit": "cover", "cutout": cutout, "eyes": bool(eyes), "look": look_of(ls),
                             **({"matte_cut": int(cfg.get("matte_cut", 175)), "side_ramp": True} if cutout else {}),
                             **({"keep": {"below": round(L.keep_below(ls, L.name(ls.takes[0])), 4)}} if cutout and L.keep_cfg(ls, L.name(ls.takes[0])) else {}),
                             **({} if cfg.get("look") else {"af": L.grade(ls)}),
                             "box": {"x": px, "y": py, "w": pw, "h": ph}}, "items": pic})
    for it in pic:
        it["box"] = {"x": px, "y": py, "w": pw, "h": ph}

    # the film effects (episode.json "fx") - one layer per filter, its time = its item
    fx = L.fx_spec(ls) if cfg.get("fx") else {}
    fade = float(fx.get("fade", 1.5))
    for fid in FILTER_IDS:
        amt = float(fx.get("grade_amount" if fid == "grade" else fid) or 0)
        if fid == "grade" and not amt and fx.get("grade"):
            amt = round((1 - float(fx["grade"].get("saturation", 1))) / 0.35, 3)
        if amt <= 0.001:
            continue
        r = (fx.get("times") or {}).get(fid)
        s0, s1 = (float(r[0]), float(r[1]) if r[1] is not None else total / FPS) if r else (0.0, total / FPS)
        its = [{"id": f"{fid}0", "from": round(s0 * FPS), "dur": max(1, round((s1 - s0) * FPS)), "fade_in": fade if r else 0,
                "fade_out": min(fade, 0.6) if r and r[1] is not None else 0, "ref": {"fx": fid}}]
        layers.append({"id": f"fx.{fid}", "kind": "effect", "name": FILTER_LABEL[fid], "owner": "builder",
                       "props": {"filter": fid, "amount": amt, "center": fx.get("center", [0.5, 0.36]),
                                 **({"ghost_lag": fx.get("ghost_lag", 0.2)} if fid == "ghost" else {})}, "items": its})
    if fx.get("hits"):
        layers.append({"id": "fx.hits", "kind": "effect", "name": "Hits", "owner": "builder", "props": {"filter": "hits", "center": fx.get("center", [0.5, 0.36])},
                       "items": [{"id": f"h{k}", "from": round(float(h["at"]) * FPS), "dur": 15, **{x: h[x] for x in ("kick", "shake", "flash", "hold") if x in h},
                                  "ref": {"hit": k}} for k, h in enumerate(fx["hits"]) if h.get("at") is not None]})
    if fx.get("black"):
        layers.append({"id": "fx.black", "kind": "effect", "name": "Black", "owner": "builder", "props": {"filter": "black"},
                       "items": [{"id": f"b{k}", "from": round(float(a) * FPS), "dur": max(1, round((min(float(b), total / FPS) - float(a)) * FPS)), "ref": {"black": k}}
                                 for k, (a, b) in enumerate(fx["black"]) if float(a) * FPS < total]})

    # the opening video (over everything but the texts, as before)
    iv = cfg.get("intro_video")
    if iv:
        f = ls.asset(iv["file"])
        w_, h_, d_ = probe(f)
        assets["v.intro"] = {"kind": "video", "src": rel(f), "w": w_, "h": h_, "duration": round(d_, 3), "label": "Opening"}
        layers.append({"id": "intro", "kind": "video", "name": "Opening", "owner": "builder", "props": {"fit": "cover"},
                       "items": [{"id": "iv", "from": 0, "dur": round(float(iv.get("seconds", 5)) * FPS), "asset": "v.intro", "in": float(iv.get("from", 0)),
                                  "box": dict(full), **({"fade_out": float(iv["fade"])} if iv.get("fade") else {}), "ref": {"intro": 1}}]})

    # texts on video (episode.json "overlays", timed by lesson.py)
    over_layers, behind = overlay_layers(ls, assets, rel, total)
    layers[behind_at:behind_at] = behind
    layers += over_layers

    # subtitles: the other side's (said over him) above his own
    for who, lid, name, st in (("other", "subs.other", "Other side", {**(cfg.get("captions_style") or {}), **(cfg.get("captions_other") or {})}),
                               ("him", "subs", "Subtitles", cfg.get("captions_style") or {})):
        cs = [c for c in caps if bool(c.get("over")) == (who == "other")]
        if not cs and who == "other":
            continue
        y = L.cap_y_of(ls, {"over": who == "other"})
        props = {"style": "solo", "box": {"x": W / 2, "y": y, "w": 980, "anchor": "t"}}
        if st.get("font"):
            props["font"] = font(st["font"]) and f"font.{st['font']}"
        props.update({k: st[k] for k in ("size", "weight", "color", "stroke") if st.get(k) is not None})
        layers.append({"id": lid, "kind": "subtitles", "name": name, "owner": "builder", "props": props,
                       "items": [{"id": f"s{k}", "from": c["from"], "dur": max(1, c["to"] - c["from"]), "text": c["text"], "ref": {"cap": c["text"][:40], "k": k},
                                  **({"link": lk} if (lk := link_at(pic, c["from"])) else {})}
                                 for k, c in enumerate(cs)]})

    # sound: his voice - the chain he tuned (live in the editor, the same code renders the export) and its cleaning
    voice = {k: v[k] for k in ("preset", "raw", "boost", "lowcut", "warmth", "box", "presence", "deess", "comp", "room", "roomSize", "pa") if k in v}
    vp = L.voice_pitch(ls)
    layers.append({"id": "voice", "kind": "audio", "name": "Voice", "owner": "builder",
                   "props": {"volume": 1, "voice": voice, **({"clean": clean} if clean else {}), **({"fx": {"pitch": vp}} if vp else {}),
                             **({"clean_filter": L.denoise_filter(ls)} if clean == "custom" else {})}, "items": vo})
    layers += sound_layers(ls, items, total, assets, rel)
    mf, m0, m1 = music_file(ls, items, total)
    if mf:
        m = cfg["music"]
        assets["s.music"] = {"kind": "audio", "src": rel(mf), "duration": round(total / FPS, 3), "label": "Music - " + os.path.basename(m["sound"]).rsplit(".", 1)[0]}
        lift = m.get("lift") or {}
        layers.append({"id": "music", "kind": "audio", "name": "Music", "owner": "builder",
                       "props": {"volume": float(m.get("gain") if m.get("gain") is not None else 0.3),
                                 **({"lift": {"db": float(lift["db"]), "fade": float(lift.get("fade", 1.0)), "of": "subs"}} if lift.get("db") else {})},
                       "items": [{"id": "m0", "from": round(m0 * FPS, 3), "dur": round((m1 - m0) * FPS, 3), "asset": "s.music", "in": 0,
                                  "fade_in": float(m.get("fade_in", 1.5)), "fade_out": float(m.get("fade_out", 2.5)), "ref": {"music": 1}}]})

    new = {"format": projectlib.FORMAT, "title": cfg.get("title") or ls.slug, "canvas": {"w": W, "h": H, "fps": FPS, "color": "#000000"},
           "duration": total, "speed": float(cfg.get("speed", 1.0)), "assets": assets, "layers": layers,
           "builder": {"kind": "solo", "from": "lesson.py"}, "edit": {"ripple": True}, "characters": characters_of(ls)}

    class Ep:  # (project.py reads / writes through the folder helpers)
        dir = ls.dir
        p = ls.p
        work = ls.work
    old = projectlib.load(Ep)
    projectlib.save(Ep, projectlib.merge(old, new), note="solo builder")
    log(f"  · {len(layers)} layers, {total / FPS:.1f}s - {len(pic)} picture clips, {len(vo)} voice pieces, {len(caps)} subtitles")


def r4(v):
    return round(v * 10000) / 10000


def pop_anim(dur, step=1 / 60):
    """The old "pops in" (lesson.py pop_expr / render/src/layers/entrances_solo.js popAnim) as scale keyframes."""
    def at(t):
        p, q = min(1, max(0, t / 0.35)), min(1, max(0, (dur - t) / 0.2))
        return (0.3 + 0.7 * (1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2)) * (0.3 + 0.7 * q)
    ts, t = set(), 0.0
    while t <= min(0.35, dur) + 1e-9:
        ts.add(r4(t))
        t += step
    ts.add(r4(min(0.35, dur)))
    k = 0
    while k * step <= 0.2 + 1e-9:
        if dur - k * step >= 0:
            ts.add(r4(dur - k * step))
        k += 1
    ts.add(r4(max(0, dur - 0.2)))
    return {"scale": [[t, r4(at(t))] for t in sorted(ts)]}


def blink_anim(dur):
    """The old "blinks" (on for 72% of each second) as opacity keyframes (entrances_solo.js blinkAnim)."""
    import math
    keys = []
    for k in range(math.ceil(dur)):
        keys += [[k, 1], [r4(k + 0.7199), 1], [r4(k + 0.72), 0], [r4(k + 0.9999), 0]]
    return {"opacity": keys + [[math.ceil(dur), 1]]}


def link_at(pic, f):
    """The link of the cut piece on screen at frame f (a subtitle belongs to the piece it starts in)."""
    for it in pic:
        if it.get("link") and it["from"] <= f < it["from"] + it["dur"]:
            return it["link"]
    return None


def characters_of(ls):
    """Who is in this video (zoomcut/characters - the Characters page): episode.json "characters" if he set it, else
    the characters whose profile lists this video, else those of the earlier videos of the same series."""
    if ls.cfg.get("characters"):
        return list(ls.cfg["characters"])
    reg = os.path.join(ROOT, "characters")
    if not os.path.isdir(reg):
        return []
    series_of = lambda ep: (L.load_json(os.path.join(ROOT, "episodes", ep, "episode.json"), {}) or {}).get("series")
    mine, same = [], []
    for cid in sorted(os.listdir(reg)):
        c = L.load_json(os.path.join(reg, cid, "character.json"), None)
        if not c:  # (NPCs too: out of the main gallery, still in the videos they are in)
            continue
        vids = c.get("videos") or []
        if ls.slug in vids:
            mine.append(cid)
        elif ls.cfg.get("series") and any(series_of(v) == ls.cfg["series"] for v in vids):
            same.append(cid)
    return mine or same


def overlay_layers(ls, assets, rel, total):
    """episode.json "overlays" -> text / image layers (render/src/layers/styles_solo.tsx draws the animated ones)."""
    front, behind = [], []
    for k, o in enumerate(L.overlays(ls)):
        a = float(o.get("start") or 0)
        b = float(o["end"]) if o.get("end") is not None else total / FPS
        it = {"id": f"o{k}", "from": round(a * FPS), "dur": max(1, round((b - a) * FPS)), "ref": {"overlay": k}}
        if o.get("end") is None:
            it["pin"] = "span"
        for x in ("fade_in", "fade_out"):
            if o.get(x):
                it[x] = float(o[x])
        anim = {}
        if o.get("pop"):
            anim.update(pop_anim(b - a))
        if o.get("blink"):
            anim.update(blink_anim(b - a))
        if anim:
            it["anim"] = anim
        style = o.get("style") or "pov"
        if style == "sticker" and o.get("motion") == "video":  # a green-screen clip: not a layer kind yet (LAYERS-KEEP.md)
            log(f"  · overlay {k}: a green-screen clip - not carried over yet")
            continue
        if o.get("image") and style not in ("sticker",) and o.get("motion") != "video":
            aid = f"m.ov{k}"
            img = ls.asset(o["image"])
            iw, ih, _ = probe(img)
            assets[aid] = {"kind": "image", "src": rel(img), "w": iw, "h": ih}
            # the old engine's box: x / y its top-left corner, w x h; "plain" = the whole picture inside it (contain)
            bx, by = float(o.get("x") if o.get("x") is not None else 60), float(o.get("y") if o.get("y") is not None else 380)
            bw, bh = float(o.get("w") or 960), float(o.get("h") or 540)
            k_ = min(bw / iw, bh / ih) if o.get("plain") else max(bw / iw, bh / ih)
            cw, ch = iw * k_, ih * k_
            it.update({"asset": aid, "box": {"x": round(bx + (bw - cw) / 2, 1), "y": round(by + (bh - ch) / 2, 1), "w": round(cw, 1), "h": round(ch, 1)}})
            if o.get("opacity") is not None:
                it["opacity"] = float(o["opacity"])
            if not o.get("plain"):
                log(f"  · overlay {k}: a framed picture - drawn without its frame for now (LAYERS-KEEP.md)")
            lay = {"id": f"ov.{k}", "kind": "image", "name": o.get("name") or f"Picture {k + 1}", "owner": "builder", "props": {}, "items": [it]}
        else:
            fields = {x: v for x, v in o.items() if x not in ("start", "end", "fade_in", "fade_out", "pop", "behind", "png", "image_abs", "anim", "anim_y",
                                                              "from_words", "to_words", "take", "sound", "opacity", "y", "x")}
            if o.get("font"):
                fid = o["font"]
                if os.path.exists(os.path.join(ROOT, "fonts", "fonts.json")) and any(f["id"] == fid and f.get("file") for f in json.load(open(os.path.join(ROOT, "fonts", "fonts.json")))):
                    assets.setdefault(f"font.{fid}", {"kind": "font", "src": rel(os.path.join(ROOT, "fonts", next(f["file"] for f in json.load(open(os.path.join(ROOT, "fonts", "fonts.json"))) if f["id"] == fid))), "family": f"zc-{fid}"})
                    fields["font"] = f"font.{fid}"
                else:
                    fields.pop("font", None)
            if style == "pov":
                fields["box_opacity"] = o.get("opacity", 1)
                it["box"] = {"x": float(o.get("x") or W / 2), "y": float(o.get("y") or 270), "anchor": "t", "w": float(o.get("maxw") or 940)}
            elif style == "ticker":
                fields["t0"] = a
                png = ls.work("text", f"ov{k}.png")  # the strip as the old engine drew it: its width sets the loop
                if os.path.exists(png):
                    import cv2
                    fields["tw"] = int(cv2.imread(png, cv2.IMREAD_UNCHANGED).shape[1])
                fields.setdefault("bg", f"rgba(0,0,0,{float(o.get('opacity') if o.get('opacity') is not None else 0.55):.2f})")
                it["box"] = {"x": 0, "y": float(o.get("y") or 1560) - 10, "anchor": "tl"}
            else:  # the one-camera styles (render/src/layers/styles_solo.tsx): the old fields, the place as each style expects
                if o.get("opacity") is not None:
                    fields["box_opacity"] = o["opacity"]
                x, y = o.get("x"), o.get("y")
                if style == "thought":
                    it["box"] = {"x": float(x if x is not None else 540), "y": float(y if y is not None else 1150), "w": float(o.get("w") or 960), "anchor": "t"}
                    if o.get("w"):
                        fields["placed"] = True
                elif style == "market":
                    it["box"] = {"x": float(x if x is not None else 540), "y": float(y if y is not None else 300), "anchor": "t"}
                elif style == "sticker":
                    it["box"] = {"x": 0, "y": 0} if o.get("motion") == "rain" else                         {"x": float(x if x is not None else 540), "y": float(y if y is not None else 700), "anchor": "c"}
                    if o.get("image"):
                        img = ls.asset(o["image"])
                        iw, ih, _ = probe(img)
                        assets[f"m.st{k}"] = {"kind": "image", "src": rel(img), "w": iw, "h": ih}
                        fields["image"] = f"m.st{k}"
                elif style in ("card", "question"):
                    style = "card"
                    w = float(o.get("w") or 860)
                    it["box"] = {"x": float(x) + w / 2 if x is not None else 540, "y": float(y if y is not None else 300), "anchor": "t"}
                elif style == "lower3":
                    it["box"] = {"x": 0, "y": float(y if y is not None else 1450)}
                else:
                    it["box"] = {"x": float(x if x is not None else 540), "y": float(y if y is not None else 0), "anchor": "t"}
            it.update(fields)
            it["style"] = style
            lay = {"id": f"ov.{k}", "kind": "text", "name": o.get("name") or (o.get("text") or style).split("\n")[0][:24], "owner": "builder",
                   "props": {"style": style}, "items": [it]}
        (behind if o.get("behind") else front).append(lay)
    return front, behind


def sound_layers(ls, items, total, assets, rel):
    """The effects (episode.json "sounds" on their lanes), the inserts' sounds and chimes, the opening sound, the voice bed."""
    cfg = ls.cfg
    lanes = {}
    pl = L.placed_sounds(ls, items)

    def add(lane, item):
        lanes.setdefault(lane, []).append(item)

    for si, s in enumerate(cfg.get("sounds", [])):
        lane = int(s.get("lane") or 0)
        if si in pl:
            o0, o1 = pl[si]
            aid = f"s.{si}"
            name = os.path.basename(s["sound"]).rsplit(".", 1)[0]
            trim = float(s.get("trim_in", 0) or 0)
            cut = -o0 if o0 < 0 else 0.0
            base = {"id": f"x{si}", "from": round(max(0.0, o0) * FPS, 3), "dur": round((o1 - max(0.0, o0)) * FPS, 3), "asset": aid,
                    "gain": float(s.get("gain", 0.8)), "fade_in": float(s.get("fade_in", 0.02)), "fade_out": float(s.get("fade_out", 0.06)), "ref": {"sound": si},
                    **({"duck": float(s["duck"])} if s.get("duck") else {})}  # (his voice dips while it plays - live, automation.js)
            # the sound + its settings, live (speed, pitch, filter, echo, room - render/ui/soundfx.ts); only RNNoise /
            # backwards / skipped pauses are done once beforehand (pre_sound_file), the rest stays live on the clip
            pre = needs_prepared(s)
            f = pre_sound_file(ls, s) if pre else ls.asset(s["sound"])
            rate, fx = live_sound(ls, s, f)
            assets[aid] = {"kind": "audio", "src": rel(f), "label": name}
            start = 0.0 if pre else float(s.get("from", 0.0))
            add(lane, {**base, "in": round(start + (trim + cut) * rate, 4), **({"rate": round(rate, 4)} if abs(rate - 1) > 1e-4 else {}),
                       **({"fx": fx} if fx else {})})
            if s.get("chime"):
                ch = s["chime"]
                cf = plain_sound_file(ls, ch["sound"])
                assets[f"s.{si}.chime"] = {"kind": "audio", "src": rel(cf), "label": os.path.basename(ch["sound"]).rsplit(".", 1)[0]}
                add(lane, {"id": f"x{si}c", "from": round(max(0.0, o0 + float(ch.get("at", 0.0))) * FPS, 3), "dur": round(len_s(cf) * FPS, 3),
                           "asset": f"s.{si}.chime", "in": 0, "gain": float(ch.get("gain", 0.6)), "fade_in": 0.005, "fade_out": 0.01, "ref": {"chime": si}})
            continue
        words = L.load_json(ls.work("words", s["take"] + ".json"), [])
        t0 = L.word_time(words, s["from_word"], s.get("from_edge", "start"), 0.0) + s.get("from_offset", 0.0)
        t1 = L.word_time(words, s["to_word"], s.get("to_edge", "start"), max(0.0, t0)) + s.get("to_offset", 0.0)
        o0, o1 = L.out_time(items, s["take"], t0), L.out_time(items, s["take"], t1)
        if o0 is None or o1 is None or o1 <= o0:
            log(f"  · sound {si} could not be placed - left out")
            continue
        aid = f"s.{si}"
        name = os.path.basename(s["sound"]).rsplit(".", 1)[0]
        if s.get("denoise"):
            f = ranged_sound_file(ls, s, int((o1 - o0) * SR))
            assets[aid] = {"kind": "audio", "src": rel(f), "label": name}
            add(lane, {"id": f"x{si}", "from": round(o0 * FPS, 3), "dur": round((o1 - o0) * FPS, 3), "asset": aid, "in": 0, "gain": float(s.get("gain", 0.5)),
                       "fade_in": float(s.get("fade_in", 0.05)), "fade_out": float(s.get("fade_out", 0.04)), "ref": {"sound": si}})
            continue
        raw = ls.asset(s["sound"])
        rate, fx = live_sound(ls, s, raw)
        assets[aid] = {"kind": "audio", "src": rel(raw), "label": name}
        one = len_s_any(raw) / rate  # (seconds one play of it lasts on the video)
        t, k = o0, 0
        while t < o1 - 0.02 and k < 200:  # a short recording plays again until the span ends (it looped)
            d = min(one, o1 - t)
            add(lane, {"id": f"x{si}" + (f"r{k}" if k else ""), "from": round(t * FPS, 3), "dur": round(d * FPS, 3), "asset": aid, "in": 0,
                       **({"rate": round(rate, 4)} if abs(rate - 1) > 1e-4 else {}), **({"fx": fx} if fx else {}), "gain": float(s.get("gain", 0.5)),
                       "fade_in": float(s.get("fade_in", 0.05)) if k == 0 else 0.005, "fade_out": float(s.get("fade_out", 0.04)) if t + d >= o1 - 0.02 else 0.005,
                       "ref": {"sound": si, "rep": k}})
            t, k = t + d, k + 1
    out = [{"id": f"sfx{k}" if k else "sfx", "kind": "audio", "name": f"Sounds {k + 1}" if k else "Sounds", "owner": "builder", "props": {"volume": 1},
            "items": sorted(v, key=lambda i: i["from"])} for k, v in sorted(lanes.items())]

    ins_items = []
    for k, it in enumerate(items):
        if it["kind"] != "hold":
            continue
        ins = it["insert"]
        o = it["out"] / FPS
        n = it.get("an", it["n"]) / FPS
        if ins.get("sound"):
            raw = ls.asset(ins["sound"])
            aid = f"s.ins{k}"
            assets[aid] = {"kind": "audio", "src": rel(raw), "label": os.path.basename(ins["sound"]).rsplit(".", 1)[0]}
            filt = filter_of(ins)
            lv = norm_level(ls, raw, filt) if filt else 0.0
            ifx = {"filter": filt, **({"level": lv} if lv else {})} if filt else None
            lead, tail = float(ins.get("lead", 0)), float(ins.get("tail", 0))
            ins_items.append({"id": f"i{k}", "from": round(max(0.0, o - lead) * FPS, 3), "dur": round((n + lead + tail) * FPS, 3), "asset": aid,
                              **({"fx": ifx} if ifx else {}),
                              "in": float(ins.get("from", 0)), "gain": float(ins.get("gain", 0.55 if ins.get("phone") else 0.8)),
                              "fade_in": 0.08, "fade_out": float(ins.get("fade_out", 0.08)), "ref": {"insert": k}})
        if ins.get("chime"):
            ch = ins["chime"]
            f = plain_sound_file(ls, ch["sound"])
            aid = f"s.ins{k}.chime"
            assets[aid] = {"kind": "audio", "src": rel(f), "label": os.path.basename(ch["sound"]).rsplit(".", 1)[0]}
            ins_items.append({"id": f"i{k}c", "from": round((o + float(ch.get("at", 0))) * FPS, 3), "dur": round(len_s(f) * FPS, 3), "asset": aid, "in": 0,
                              "gain": float(ch.get("gain", 0.7)), "fade_in": 0.005, "fade_out": 0.01, "ref": {"chime": k}})
    isd = cfg.get("intro_sound")
    if isd:
        f = plain_sound_file(ls, isd["sound"])
        assets["s.intro"] = {"kind": "audio", "src": rel(f), "label": "Opening sound"}
        ins_items.append({"id": "intro", "from": 0, "dur": round(float(isd.get("seconds", 4)) * FPS, 3), "asset": "s.intro", "in": float(isd.get("from", 0)),
                          "gain": float(isd.get("gain", 0.8)), "fade_in": 0.005, "fade_out": float(isd.get("fade_out", 1.5)), "ref": {"intro_sound": 1}})
    if cfg.get("voice_bed"):
        n = int(total / FPS * SR)
        bed = np.zeros(n + SR, np.float32)
        L.voice_bed(ls, pl, bed)
        if bed.any():
            f = prepared(ls, "bed" + sig_of(cfg.get("voice_bed"), sorted(pl.items())), lambda: bed[:n])
            assets["s.bed"] = {"kind": "audio", "src": rel(f), "label": "Voice-over room"}
            ins_items.append({"id": "bed", "from": 0, "dur": total, "asset": "s.bed", "in": 0, "gain": 1, "fade_in": 0, "fade_out": 0, "ref": {"bed": 1}})
    if ins_items:
        out.append({"id": "inserts", "kind": "audio", "name": "Inserts", "owner": "builder", "props": {"volume": 1}, "items": sorted(ins_items, key=lambda i: i["from"])})
    return out


def len_s_any(path):
    """Seconds of any sound file (ffprobe)."""
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True)
    return float(r.stdout.strip() or 0) or 1.0


def len_s(path):
    from .media import read_wav
    return len(read_wav(path)[0]) / SR


if __name__ == "__main__":
    build(sys.argv[1], keep_settings="--keep-settings" in sys.argv)
