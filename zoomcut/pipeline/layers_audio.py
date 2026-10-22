"""Sound of a layered project: every audio layer becomes one track - each item's piece of its source (a take's sound,
a sound file) placed on the timeline with its gain and fades, through the layer's filters - and the tracks are mixed
with ONE fixed gain to -14 LUFS and a limiter that only catches the rare peak (the level never rides).

Layer props (skill/edit-video/layers.md):
  volume  0..2 (live in the editor)          mute / hidden   silent
  clean   off | mild | strong | nn (RNNoise)  presence        dB at 2.8 kHz (clarity)
  level   "speech" = even out each source by its speech level, measured on the pieces used (voices)
Item: asset, in (s), from / dur (frames), gain, fade_in / fade_out (s), soften (a shouted line made easier).

The editor plays the stems (work/public/layers/stems/<layer>.wav, after the shared gain, before the layer's volume)
and applies the volume live; the export mixes the same tracks here."""
import hashlib
import json
import os

import numpy as np

from . import audio, audio_render, voice_chain
from .common import FFMPEG, SR, load_json, log, run, save_json
from .media import read_wav


def _src(ep, project, aid):
    """The asset's sound as 48 kHz mono wav (a take's own audio, or the file decoded once)."""
    a = project["assets"][aid]
    if a.get("audio") and os.path.exists(ep.p(a["audio"])):
        return ep.p(a["audio"])
    src = os.path.normpath(ep.p(a["src"]))
    out = ep.work("layers", "audio", f"{aid.replace('/', '_')}.{hashlib.sha1(src.encode()).hexdigest()[:8]}.wav")
    if not os.path.exists(out) or os.path.getmtime(out) < os.path.getmtime(src):
        run([FFMPEG, "-y", "-v", "error", "-i", src, "-vn", "-ac", "1", "-ar", str(SR), out])
    return out


def _filtered(ep, path, props):
    chain = audio._voice_chain({"clean": props.get("clean", "off"), "presence": props.get("presence", 0), "clean_filter": props.get("clean_filter")})
    if not chain:
        return path
    out = ep.work("layers", "audio", f"{os.path.basename(path)[:-4]}.f{hashlib.sha1(chain.encode()).hexdigest()[:8]}.wav")
    if not os.path.exists(out) or os.path.getmtime(out) < os.path.getmtime(path):
        run([FFMPEG, "-y", "-v", "error", "-i", path, "-af", chain, "-ar", str(SR), "-ac", "1", out])
    return out


CLEAN_VARIANTS = ("off", "mild", "strong", "fft", "nn")  # the Noise switch's choices made up front: switching plays another file, at once


def layer_sources(ep, project, layer, clean=None):
    """({asset id: samples}, {asset id: level gain}) - each source of an audio layer through ONLY its cleaning (`clean`,
    or the layer's own): the editor applies clarity, the speech level, gains and fades live on top. The level gain is
    each source's speech level evened out (when the layer asks), measured on the pieces it uses."""
    fps = project["canvas"]["fps"]
    props = dict(layer.get("props") or {})
    if clean is not None:
        props["clean"] = clean
    props["presence"] = 0  # (clarity is live)
    items = [it for it in layer.get("items", []) if not it.get("hidden")]
    cache, levels = {}, {}
    for it in items:
        aid = it.get("asset") or props.get("asset")
        if aid not in cache:
            cache[aid], _ = read_wav(_filtered(ep, _src(ep, project, aid), props))
    for aid, x in cache.items():
        pieces = [x[int(it.get("in", 0) * SR):int((it.get("in", 0) + it["dur"] / fps) * SR)] for it in items if (it.get("asset") or props.get("asset")) == aid]
        whole = np.concatenate(pieces) if pieces else x
        levels[aid] = audio.speech_gain(whole if len(whole) > SR // 2 else x)
    return cache, levels


def is_voice(project, layer):
    """A layer of takes' sound (a person speaking) - the one the Noise switch is for."""
    return any(project["assets"].get(it.get("asset"), {}).get("kind") == "video" for it in layer.get("items", []))


def track(ep, project, layer, n, sources=None):
    """One audio layer as a mono float track of n samples (before its volume). sources: a dict that gets each source
    of the layer as the editor should play it - filtered, evened out ({asset id: samples})."""
    fps = project["canvas"]["fps"]
    props = layer.get("props") or {}
    out = np.zeros(n, dtype=np.float32)
    items = [it for it in layer.get("items", []) if not it.get("hidden")]
    cache, level = {}, {}
    for it in items:
        aid = it.get("asset") or props.get("asset")
        if aid not in cache:
            cache[aid], _ = read_wav(_filtered(ep, _src(ep, project, aid), props))
    if props.get("level") == "speech":  # each source evened out on the pieces this layer USES (not the whole take)
        for aid, x in cache.items():
            pieces = [x[int(it.get("in", 0) * SR):int((it.get("in", 0) + it["dur"] / fps) * SR)] for it in items if (it.get("asset") or props.get("asset")) == aid]
            whole = np.concatenate(pieces) if pieces else x
            level[aid] = audio.speech_gain(whole if len(whole) > SR // 2 else x)
    if sources is not None:
        for aid, x in cache.items():
            sources[aid] = x * level.get(aid, 1.0)
        for it in items:  # a softened item plays its own prepared piece in the editor (soften is per item)
            if it.get("soften"):
                aid = it.get("asset") or props.get("asset")
                a = int(it.get("in", 0) * SR)
                z = a + int(round(it["dur"] / fps * SR))
                sources[f"{aid}@{it['id']}"] = audio.soften(cache[aid][a:z].copy() * level.get(aid, 1.0))
    for it in items:
        aid = it.get("asset") or props.get("asset")
        x = cache[aid]
        a = int(it.get("in", 0) * SR)
        n_out = int(round(it["dur"] / fps * SR))
        rate = float(it.get("rate", 1) if it.get("rate") is not None else 1)
        if rate <= 1e-6:  # a held frame: no sound
            continue
        if abs(rate - 1) > 1e-4:  # slow / fast motion: rate x the length of source, stretched to the item (pitch follows)
            src_n = max(2, int(round(n_out * rate)))
            seg = x[a:a + src_n]
            piece = np.interp(np.linspace(0, max(0, len(seg) - 1), n_out), np.arange(len(seg)), seg).astype(np.float32) * level.get(aid, 1.0) if len(seg) > 1 else np.zeros(0, np.float32)
        else:
            piece = x[a:a + n_out].copy() * level.get(aid, 1.0)
        if it.get("soften"):
            piece = audio.soften(piece)
        piece = piece * float(it.get("gain", 1.0))
        if not len(piece):
            continue
        fi = min(len(piece), max(1, int(float(it.get("fade_in", 0.012)) * SR)))
        piece[:fi] *= np.linspace(0, 1, fi)
        fo = min(len(piece), int(float(it.get("fade_out", 0)) * SR))
        if fo > 0:
            piece[-fo:] *= np.linspace(1, 0, fo) ** 1.5
        at = int(it["from"] / fps * SR)
        if at >= n:
            continue
        out[at:at + len(piece)] += piece[: n - at]
    return voice_chain.apply(ep, layer["id"], out, props.get("voice"))  # the editor's voice chain (sound.ts), same code


def _audible(l):
    return l["kind"] == "audio" and not l.get("hidden") and not l.get("muted")


def mix(ep, project, out_wav, stems_dir=None, speed=1.0):
    """All audio layers -> out_wav (stereo, -14 LUFS). stems_dir: also one file per layer for the editor."""
    fps = project["canvas"]["fps"]
    total = project["duration"] / fps
    n = int(round(total * SR))
    srcs = {}
    tracks = {l["id"]: track(ep, project, l, n, srcs.setdefault(l["id"], {})) for l in project["layers"] if l["kind"] == "audio"}
    rendered = audio_render.render(ep, project, n)  # the editor's own graph (clip fx, clarity, voice chain): what he heard
    if rendered:
        tracks.update(rendered)
    buf = np.zeros(n, dtype=np.float32)
    for l in project["layers"]:
        if _audible(l):
            buf += tracks[l["id"]] * float((l.get("props") or {}).get("volume", 1.0))
    raw = out_wav.replace(".wav", ".raw.wav")
    audio._write_mono(raw, buf)
    if np.abs(buf).max() < 1e-6:  # silence (no audio layers yet)
        gain_db = 0.0
    else:
        r = audio.run_capture([FFMPEG, "-hide_banner", "-i", raw, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"])
        import re
        meas = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", r, re.S).group(0))
        gain_db = -14.0 - float(meas["input_i"]) if meas["input_i"] not in ("-inf", "inf") else 0.0
    af = f"volume={gain_db:.2f}dB,alimiter=limit=0.84:attack=3:release=50:level=false"
    run([FFMPEG, "-y", "-v", "error", "-i", raw, "-af", af, "-ar", str(SR), "-ac", "2", out_wav])
    if stems_dir:
        g = 10 ** (gain_db / 20)
        os.makedirs(stems_dir, exist_ok=True)
        index = {}
        for lid, tr in tracks.items():
            p = os.path.join(stems_dir, lid + ".wav")
            audio._write_mono(p, tr * g)
            index[lid] = int(os.path.getmtime(p) * 1000)
        # each layer's sources as the editor plays them live (an item = a piece of one, at its gain / fades / volume):
        # filtered, evened out and at the shared gain - only the changed ones are written again
        sdir = os.path.join(os.path.dirname(stems_dir), "src")
        os.makedirs(sdir, exist_ok=True)
        sources = {}
        for lid, per in srcs.items():
            for aid, x in per.items():
                name = f"{lid}__{aid}".replace("/", "_") + ".wav"
                p = os.path.join(sdir, name)
                y = (x * g).astype(np.float32)
                sig = hashlib.sha1(np.round(y[::997] * 1e4).tobytes()).hexdigest()[:12]
                if not (os.path.exists(p) and os.path.exists(p + ".sig") and open(p + ".sig").read() == sig):
                    audio._write_mono(p, y)
                    open(p + ".sig", "w").write(sig)
                sources[f"{lid}|{aid}"] = {"file": name, "v": int(os.path.getmtime(p) * 1000)}
        # a voice's Noise switch: every cleaning made up front ("<layer>|<asset>|<clean>") - switching swaps the file.
        # These are cleaning ONLY, at the shared gain: clarity (presence), the speech level (levels[key]), gains, fades
        # and the voice chain are applied live by the editor.
        levels = {}
        for l in project["layers"]:
            if l["kind"] != "audio" or not is_voice(project, l):
                continue
            for v in sorted(set(CLEAN_VARIANTS) | {(l.get("props") or {}).get("clean") or "off"}):
                srcs_v, lv = layer_sources(ep, project, l, v)
                for aid, x in srcs_v.items():
                    levels[f"{l['id']}|{aid}|{v}"] = round(float(lv[aid]), 5)  # x this live when the layer's level is "speech"
                    name = f"{l['id']}__{aid}__{v}".replace("/", "_") + ".wav"
                    p = os.path.join(sdir, name)
                    y = (x * g).astype(np.float32)
                    sig = hashlib.sha1(np.round(y[::997] * 1e4).tobytes()).hexdigest()[:12]
                    if not (os.path.exists(p) and os.path.exists(p + ".sig") and open(p + ".sig").read() == sig):
                        audio._write_mono(p, y)
                        open(p + ".sig", "w").write(sig)
                    sources[f"{l['id']}|{aid}|{v}"] = {"file": name, "v": int(os.path.getmtime(p) * 1000)}
        save_json(os.path.join(stems_dir, "stems.json"), {"gain_db": round(gain_db, 2), "stems": index, "sources": sources, "levels": levels})
    log(f"  · sound mixed ({total:.1f}s, {len(tracks)} audio layers, {gain_db:+.1f} dB to -14 LUFS)")
    return out_wav


def stems(ep, project=None):
    """The editor's sound: one file per audio layer (work/public/layers/stems), seconds."""
    from . import project as projectlib
    project = project or projectlib.load(ep)
    return mix(ep, project, ep.work("layers", "mix.wav"), stems_dir=ep.work("public", "layers", "stems", "x")[:-2])


if __name__ == "__main__":
    import sys
    from .common import Episode
    stems(Episode(sys.argv[1]))
