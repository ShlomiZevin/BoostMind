"""Dialogue mix: place every line on the timeline with short fades, even out the characters,
then EBU R128 loudness to TikTok level (-14 LUFS, -1.5 dBTP)."""
import json
import re
import wave

import numpy as np

from .common import FFMPEG, SR, log, run
from .media import read_wav


def speech_gain(x, target_db=-20.0):
    n = SR // 100
    frames = len(x) // n
    if frames < 10:
        return 1.0
    rms = np.sqrt((x[: frames * n].reshape(frames, n) ** 2).mean(axis=1) + 1e-12)
    db = 20 * np.log10(rms)
    speech = db[db > np.percentile(db, 60)]
    level = 10 * np.log10(np.mean(10 ** (speech / 10))) if len(speech) else -30
    return float(np.clip(10 ** ((target_db - level) / 20), 0.25, 8.0))


def _biquad(x, b, a):
    y = np.zeros_like(x)
    x1 = x2 = y1 = y2 = 0.0
    b0, b1, b2 = b
    _, a1, a2 = a
    for i, v in enumerate(x):
        o = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, v, y1, o
        y[i] = o
    return y


def _rbj(kind, f0, gain_db, q, sr):
    A, w = 10 ** (gain_db / 40), 2 * np.pi * f0 / sr
    al, c = np.sin(w) / (2 * q), np.cos(w)
    if kind == "peak":
        b, a = [1 + al * A, -2 * c, 1 - al * A], [1 + al / A, -2 * c, 1 - al / A]
    else:  # high shelf
        sq = 2 * np.sqrt(A) * al
        b = [A * ((A + 1) + (A - 1) * c + sq), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - sq)]
        a = [(A + 1) - (A - 1) * c + sq, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - sq]
    return [v / a[0] for v in b], [1.0, a[1] / a[0], a[2] / a[0]]


def soften(x, sr=SR):
    """A shouted / too-close line made easier on the ear: less of the harsh 2-5 kHz, the top rounded off, the peaks
    evened out (a gentle compressor) - then back to the level it had, so it does not drop out of the mix."""
    rms0 = np.sqrt(np.mean(x ** 2)) + 1e-9
    y = _biquad(x.astype(np.float64), *_rbj("peak", 3200, -5.0, 0.9, sr))
    y = _biquad(y, *_rbj("shelf", 7000, -5.0, 0.7, sr))
    win = max(1, int(0.02 * sr))
    env = np.sqrt(np.convolve(y ** 2, np.ones(win) / win, mode="same")) + 1e-9
    thr = np.percentile(env, 60)
    g = np.where(env > thr, (thr / env) ** 0.5, 1.0)  # ~2:1 above the line's typical level
    y = y * g
    return (y * (rms0 / (np.sqrt(np.mean(y ** 2)) + 1e-9))).astype(np.float32)


def mix(ep, plan, total, out_wav):
    cache, gains = {}, {}
    buf = np.zeros(int((total + 1) * SR), dtype=np.float32)
    for seg in plan:
        if seg.get("sfx"):
            fx = removal_sound()
            at = int(seg["at"] * SR)
            buf[at:at + len(fx)] += fx[: max(0, len(buf) - at)]
            continue
        cid = seg["clip"]
        if cid not in cache:
            cache[cid], _ = read_wav(ep.work("audio", cid + ".wav"))
            gains[cid] = speech_gain(cache[cid])
        x = cache[cid]
        a, z = int(seg["in"] * SR), int(seg["out"] * SR)
        piece = x[a:z].copy() * gains[cid]
        if seg.get("soften"):
            piece = soften(piece)
        piece = piece * seg.get("gain", 1.0)  # an aside is quieter; any line can be turned up or down
        if len(piece) == 0:
            continue
        fi = min(len(piece), int(0.012 * SR))
        fo = min(len(piece), max(1, int(seg["fade_out"] * SR)))
        piece[:fi] *= np.linspace(0, 1, fi)
        piece[-fo:] *= np.linspace(1, 0, fo) ** 1.5
        at = int(seg["at"] * SR)
        buf[at:at + len(piece)] += piece[: max(0, len(buf) - at)]
    buf = buf[: int(total * SR)]
    raw = out_wav.replace(".wav", ".raw.wav")
    with wave.open(raw, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes((np.clip(buf, -1, 1) * 32767).astype(np.int16).tobytes())
    # two-pass loudnorm
    r = run_capture([FFMPEG, "-hide_banner", "-i", raw, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"])
    m = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", r, re.S).group(0))
    af = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    run([FFMPEG, "-y", "-v", "error", "-i", raw, "-af", af, "-ar", str(SR), "-ac", "2", out_wav])
    log(f"  · dialogue mixed ({total:.1f}s), loudness {m['input_i']} → -14 LUFS")
    return out_wav


def run_capture(cmd):
    import subprocess
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    return r.stderr


def removal_sound():
    """A short descending two-note bloop in the spirit of a video-call leave chime (synthesised, no assets)."""
    out = []
    for freq, dur in ((784.0, 0.13), (523.3, 0.22)):
        t = np.arange(int(dur * SR)) / SR
        env = np.minimum(1, t / 0.008) * np.exp(-t / (dur * 0.45))
        tone = np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(4 * np.pi * freq * t)
        out.append(tone * env)
        out.append(np.zeros(int(0.02 * SR)))
    return (np.concatenate(out) * 0.32).astype(np.float32)
