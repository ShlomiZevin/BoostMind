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


# a character marked "clean": true - phone / filter-app audio with codec damage (a haze, "watery" gaps up top) and an
# uneven level: rumble and the damaged top out, mild noise reduction, a compressor that evens the level (no makeup -
# it lifted the hiss), a soft gate between words. Mild on purpose: it must never swallow a soft word.
CLEAN_AF = ("highpass=f=80,lowpass=f=7500,afftdn=nr=15:nf=-40:tn=1,"
            "acompressor=threshold=0.12:ratio=2.5:attack=8:release=150:makeup=1,"
            "agate=threshold=0.012:ratio=2:range=0.25:attack=5:release=180")


# "clean": "strong" - a muffled, ringing take (Daniel, gilad-joins: 1-6 kHz 4-6 dB low, the room ringing after each
# word): mud out, presence up, compressor, a fast gate on the ringing tails. No RNNoise: it swallowed his "אה".
CLEAN_STRONG_AF = ("highpass=f=90,equalizer=f=300:t=q:w=1:g=-3,equalizer=f=2800:t=q:w=1.2:g=5,lowpass=f=9000,"
                   "acompressor=threshold=0.12:ratio=2.5:attack=6:release=120:makeup=1,"
                   "agate=threshold=0.01:ratio=3:range=0.1:attack=2:release=50")


# "clean": "nn" - RNNoise, the neural noise filter (models/rnnoise/cb.rnnn) he already knows from the news anchor voice;
# it wants 48 kHz. A gentle compressor after it evens the level. (It can swallow a soft "אה" - his call per character.)
CLEAN_NN_AF = ("aresample=48000,highpass=f=80,arnndn=m=models/rnnoise/cb.rnnn,"
               "acompressor=threshold=0.12:ratio=2.5:attack=8:release=150:makeup=1")


# "clean": "fft" - the one-camera engine's own noise reduction (lesson.py DENOISE), so a migrated solo voice keeps
# exactly its filter ("Standard (FFT)" in the editor)
CLEAN_FFT_AF = "afftdn=nf=-28:tn=1"


def voice_of(ep, char_id):
    """A character's voice layer: {"volume": 1, "clean": "off" | "mild" | "strong", "presence": dB at 2.8 kHz}.
    (An older "clean": true / "strong" on the character still counts.)"""
    ch = next((c for c in ep.characters if c["id"] == char_id), {})
    v = dict(ch.get("voice") or {})
    old = ch.get("clean")
    v.setdefault("clean", "strong" if old == "strong" else "mild" if old else "off")
    v.setdefault("volume", 1.0)
    v.setdefault("presence", 0.0)
    return v


def _voice_chain(v):
    chain = {"mild": CLEAN_AF, "strong": CLEAN_STRONG_AF, "nn": CLEAN_NN_AF, "fft": CLEAN_FFT_AF}.get(v.get("clean"), "")
    pr = float(v.get("presence") or 0)
    if abs(pr) >= 0.5:  # clarity: up for a muffled voice, down for a harsh one
        chain = (chain + "," if chain else "") + f"equalizer=f=2800:t=q:w=1.2:g={pr:.1f}"
    return chain


def _cleaned(ep, cid):
    """The take's audio through its character's voice filters (cached per filter chain)."""
    import hashlib
    import os
    src = ep.work("audio", cid + ".wav")
    chain = _voice_chain(voice_of(ep, cid.split("_")[0]))
    if not chain:
        return src
    out = ep.work("audio", f"{cid}.v{hashlib.sha1(chain.encode()).hexdigest()[:8]}.wav")
    if not os.path.exists(out) or os.path.getmtime(out) < os.path.getmtime(src):
        run([FFMPEG, "-y", "-v", "error", "-i", src, "-af", chain, "-ar", str(SR), "-ac", "1", out])
    return out


def _write_mono(path, x):
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


def mix(ep, plan, total, out_wav, stems=None):
    """Every line placed on the timeline through its character's voice layer, then ONE fixed gain to -14 LUFS (a
    limiter only catching the rare peak - the level never rides). stems: a folder to also write one track per
    character there (before his volume, after the shared gain) + the sound effects - the editor plays them as layers."""
    import os
    cache, gains = {}, {}
    n = int((total + 1) * SR)
    buf = np.zeros(n, dtype=np.float32)
    per = {}
    sfx = np.zeros(n, dtype=np.float32)
    # each take's level is measured on the pieces the video USES, not the whole take: a mostly silent listening take
    # (Daniel, Ofer, Ronit in gilad-joins) measured whole came out 6-10 dB too loud
    used = {}
    for seg in plan:
        if not seg.get("sfx"):
            used.setdefault(seg["clip"], []).append((seg["in"], seg["out"]))
    for seg in plan:
        if seg.get("sfx"):
            fx = removal_sound()
            at = int(seg["at"] * SR)
            sfx[at:at + len(fx)] += fx[: max(0, n - at)]
            continue
        cid = seg["clip"]
        char = cid.split("_")[0]
        if cid not in cache:
            cache[cid], _ = read_wav(_cleaned(ep, cid))
            pieces = [cache[cid][int(a * SR):int(z * SR)] for a, z in used.get(cid, [])]
            gains[cid] = speech_gain(np.concatenate(pieces) if pieces and sum(map(len, pieces)) > SR // 2 else cache[cid])
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
        st = per.setdefault(char, np.zeros(n, dtype=np.float32))
        st[at:at + len(piece)] += piece[: max(0, n - at)]
    vols = {c: float(voice_of(ep, c).get("volume", 1.0)) for c in per}
    for c, st in per.items():
        buf += st * vols[c]
    buf += sfx
    m = int(total * SR)
    raw = out_wav.replace(".wav", ".raw.wav")
    _write_mono(raw, buf[:m])
    r = run_capture([FFMPEG, "-hide_banner", "-i", raw, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"])
    meas = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", r, re.S).group(0))
    gain_db = -14.0 - float(meas["input_i"])
    af = f"volume={gain_db:.2f}dB,alimiter=limit=0.84:attack=3:release=50:level=false"
    run([FFMPEG, "-y", "-v", "error", "-i", raw, "-af", af, "-ar", str(SR), "-ac", "2", out_wav])
    if stems:
        g = 10 ** (gain_db / 20)
        os.makedirs(stems, exist_ok=True)
        for c, st in per.items():
            _write_mono(os.path.join(stems, c + ".wav"), st[:m] * g)
        _write_mono(os.path.join(stems, "_sfx.wav"), sfx[:m] * g)
    log(f"  · dialogue mixed ({total:.1f}s), loudness {meas['input_i']} → -14 LUFS")
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
