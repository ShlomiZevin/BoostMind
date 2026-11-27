"""PREPARE CLIPS - raw footage -> natural clips in Media, before any editing (his ask, 2026-11-26, after rosenblum-2:
"editing goes well when the clips arrive clean"). He tells a session "prepare the clips first"; the session runs this
(through the studio: POST /api/p/<id>/build {action: "prepare"} - a job, one heavy job at a time) or straight:

    .venv/Scripts/python.exe tools/prepare_clips.py episodes/<id> [--assets <take ids>] [--script scripts/<id>.txt]
                                                    [--markers אקשן,קאט] [--dry]

A natural clip, in 5 steps (each take = one video asset of the project, the ORIGINAL file):
  1. SPLIT - a TikTok / filter-app export is many recordings glued together: split at every restart (a hard picture
     jump - ffmpeg scdet >= 10; a weaker jump 5-10 counts only when no word spans it AND the face jumps with it - else
     it is flagged). A Snapchat file = one recording. Nothing is ever taken across a restart.
  2. TRIM - each recording starts after he stops looking at / tapping the phone and ends before he reaches for it:
     the face missing, much closer than usual, the eyes off the lens, or a big motion at the recording's start / end
     (MediaPipe Face Landmarker, 10 frames a second over its first / last 4 s). Never within 0.6 s after a restart or
     1.0 s before one. Silence before the first word is KEPT (it is often silent acting - the tea walk) and flagged.
     Spoken markers (אקשן / קאט) and claps cut exactly there when present.
  3. CUT-OUT - the clips share their take's matte / fg (made once per take by Analyze; held things through
     tools/sam/keep.py, which tracks in 30 s pieces). A take with no cut-out yet is listed.
  4. WORDS - word times (the take's work/words/<take>.json, else heard here), whispers re-read with the voice filter off
     (take_finder), the script line(s) each clip says, retakes (a line said again later = the LATER take is kept).
  5. INTO MEDIA - each clip = an asset named "רוזנבלום · line 7 · take 2/3" pointing at the ORIGINAL file with
     clip.in / clip.out, so a clip's edge on the timeline can always be dragged out to pull footage back. Flags = a
     plain question on the clip (Media shows it); every other clip needs nothing from him.

Also per clip: the sound's start offset (phone exports start their sound 26-80 ms after the picture - fast_cut's
audioOffset) and the room-noise floor (rosenblum-2's two people were 14 dB apart - never fixed, only noted).
Writes the clips into project.json (rev bumped - the open editor shows them within 2 s) and work/prepare/: report.txt
(the questions first), clips.json, sheet.jpg (first / last frame of every clip). A re-run replaces that take's clips,
keeping his marks on them.
"""
import argparse
import collections
import json
import os
import re
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "tools"))
import take_finder as tf  # noqa: E402
from pipeline import project as projectlib  # noqa: E402
from pipeline.common import Episode  # noqa: E402

AFTER_RESTART, BEFORE_RESTART = 0.6, 1.0   # never this close to a restart (his rule: restarts kept clear 1 s / 0.6 s)
FILE_HEAD, FILE_TAIL = 0.45, 0.6           # the file's own start / stop tap
STRONG, WEAK = 10.0, 5.0                   # scdet: a restart for sure / a maybe (rosenblum-2 hid one at 8.8)
EDGE = 4.0                                 # seconds of a recording's start / end the phone detector looks at
SILENT = 1.5                               # more silence than this before the first word = a question
SILENT_AFTER = 3.0                         # ... after the last word (a reaction / a hold of 2 s is normal)
KFPS = 10
REACH = 2.0                                # a reach / tap longer than this = probably acting: kept and asked


def log(*a):
    print(*a, flush=True)


def audio_offset(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,start_time", "-of", "json", path],
                       capture_output=True, text=True)
    st = {s.get("codec_type"): float(s.get("start_time") or 0) for s in json.loads(r.stdout or "{}").get("streams", [])}
    return round(st.get("audio", 0) - st.get("video", 0), 3)


def jumps(path):
    p = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-vf", f"scdet=threshold={WEAK}", "-an", "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="ignore")
    out = []
    for sc, t in re.findall(r"lavfi\.scd\.score:\s*([0-9.]+),\s*lavfi\.scd\.time:\s*([0-9.]+)", p.stderr):
        sc, t = float(sc), float(t)
        if out and t - out[-1][0] <= 0.6:          # one restart flashes 2-3 jumps in a row: keep the strongest
            if sc > out[-1][1]:
                out[-1] = (t, sc)
            continue
        out.append((t, sc))
    return out


# --- the face, 10 frames a second over a stretch ---------------------------------------------------------------------
_det = None


def detector():
    global _det
    if _det is None:
        from mediapipe.tasks import python as mpt
        from mediapipe.tasks.python import vision
        _det = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
            base_options=mpt.BaseOptions(model_asset_path=os.path.join(ROOT, "models", "face_landmarker.task")),
            running_mode=vision.RunningMode.IMAGE, num_faces=1))
    return _det


FW, FH = 270, 480


def frames(path, a, b, fps=KFPS):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{max(0, a):.3f}", "-t", f"{max(0.1, b - a):.3f}", "-i", path,
                          "-vf", f"fps={fps},scale={FW}:{FH}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         capture_output=True).stdout
    n = len(raw) // (FW * FH * 3)
    return np.frombuffer(raw[:n * FW * FH * 3], np.uint8).reshape(n, FH, FW, 3)


def face(rgb):
    """-> None (no face) or (cx, cy, size, gaze_h, gaze_v): the box centre / height in frame fractions, the irises'
    place inside the eyes (0..1 sideways and up-down)"""
    import mediapipe as mp
    r = detector().detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb)))
    if not r.face_landmarks:
        return None
    L = r.face_landmarks[0]
    xs, ys = [p.x for p in L], [p.y for p in L]
    if len(L) < 478:
        gh = gv = 0.5
    else:
        def ratio(iris, a, b, top, bot):
            w = (L[b].x - L[a].x) or 1e-6
            h = (L[bot].y - L[top].y) or 1e-6
            return (L[iris].x - L[a].x) / w, (L[iris].y - L[top].y) / h
        l = ratio(468, 33, 133, 159, 145)
        rr = ratio(473, 362, 263, 386, 374)
        gh, gv = (l[0] + rr[0]) / 2, (l[1] + rr[1]) / 2
    return ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, max(ys) - min(ys), gh, gv)


def reference(path, a, b):
    """how he looks while acting: the median face of the recording's middle (one frame a second, up to 9)"""
    m0, m1 = a + (b - a) * 0.25, a + (b - a) * 0.75
    fs = [face(f) for f in frames(path, m0, m1, fps=min(1.0, 9 / max(1, m1 - m0)))]
    fs = [f for f in fs if f]
    return tuple(np.median(np.array(fs), 0)) if fs else None


def phoneish(path, a, b, ref):
    """per frame (10 a second) over a..b: why he is at the phone there ("" = acting) - the face gone for 0.3 s or more,
    the face much closer than in the middle of the take or far off its place, the eyes far to the side, or a motion
    twice the stretch's usual (the reach). Tuned on rosenblum-2: a face filter moves the picture all the time (motion
    10-20 while acting, 28-39 in the reach), single frames lose the face, the eyes' up-down is too noisy to use."""
    fr = frames(path, a, b)
    mot, fcs, prev = [], [], None
    for f in fr:
        g = f.mean(2)
        mot.append(float(np.abs(g - prev).mean()) if prev is not None else 0.0)
        prev = g
        fcs.append(face(f))
    base = float(np.median(mot[1:])) if len(mot) > 1 else 0.0
    raw = []
    for fc, m in zip(fcs, mot):
        why = ""
        if fc is None:
            why = "no face"
        elif ref is not None:
            if fc[2] > ref[2] * 1.25:
                why = "close to the phone"
            elif abs(fc[0] - ref[0]) > 0.18 or abs(fc[1] - ref[1]) > 0.18:
                why = "away from his place"
            elif abs(fc[3] - ref[3]) > 0.3:
                why = "eyes off the lens"
        if not why and m > max(25.0, 1.8 * base):
            why = "the reach"
        raw.append(why)
    out = [""] * len(raw)  # (a frame counts only inside a run of 3: one lost frame is not the phone)
    i = 0
    while i < len(raw):
        j = i
        while j < len(raw) and raw[j]:
            j += 1
        if j - i >= 3:
            out[i:j] = raw[i:j]
        i = max(j, i + 1)
    return out


def run_of(flags, from_end=False, gap=2):
    """how many frames from the start (or the end) are 'at the phone' - a run that allows gaps of <= gap frames"""
    seq = flags[::-1] if from_end else flags
    last, miss = -1, 0
    for i, w in enumerate(seq):
        if w:
            last, miss = i, 0
        else:
            miss += 1
            if miss > gap:
                break
    return last + 1


# --- the clips of one take -------------------------------------------------------------------------------------------
def take_clips(ep, aid, A, args, script_rows):
    src = ep.p(A["src"])
    if not os.path.exists(src):
        log(f"  ! {aid}: file not found ({A['src']})")
        return [], {}
    label = A.get("label") or os.path.splitext(os.path.basename(src))[0]
    out = ep.work("prepare", label, "x")[:-2]
    samples = tf.audio16(src)
    dur = min(len(samples) / 16000, float(A.get("duration") or 1e9))
    d = tf.loudness(samples)
    wfile = ep.p("work", "words", label + ".json")
    W = tf.words(src, samples, wfile if os.path.exists(wfile) else os.path.join(out, "words.json"))
    off = audio_offset(src)
    log(f"  · {label}: {dur:.1f} s, sound starts {off * 1000:.0f} ms after the picture, {len(W)} words")

    # 1. SPLIT
    J = jumps(src)
    restarts, maybes = [], []
    for t, sc in J:
        # (a word over the jump = no restart - unless the recogniser stretched it: rosenblum-2's "אתה" ran 1.46 s right
        # over the restart at 297.25 that scored 8.8)
        spoken = any(w[0] - 0.15 < t < w[1] + 0.15 and w[1] - w[0] <= 0.9 for w in W)
        if sc >= STRONG:
            restarts.append(t)
            continue
        if spoken:
            continue
        fa, fb = frames(src, t - 0.25, t - 0.15, 10), frames(src, t + 0.1, t + 0.2, 10)
        f0 = face(fa[0]) if len(fa) else None
        f1 = face(fb[0]) if len(fb) else None
        jumped = (f0 is None) != (f1 is None) or (f0 and f1 and (abs(f0[0] - f1[0]) > 0.04 or abs(f0[1] - f1[1]) > 0.04
                                                                or abs(f0[2] / f1[2] - 1) > 0.08))
        if jumped:
            restarts.append(t)
        else:
            maybes.append((t, sc))
    restarts.sort()
    edges = [0.0] + restarts + [dur]
    recs = [(edges[i], edges[i + 1], i + 1) for i in range(len(edges) - 1) if edges[i + 1] - edges[i] > 0.5]
    W = tf.fill_whispers(W, recs, samples, d, os.path.join(out, "words_whispers.json"))
    claps = tf.claps(d)
    mk = [tf.norm(x) for x in args.markers.split(",")] + ["", ""]
    start_m, end_m = mk[0], mk[1]
    noise_all = float(np.percentile(d, 10))

    clips = []
    for ra, rb, rn in recs:
        lo = ra + (AFTER_RESTART if ra > 0 else FILE_HEAD)
        hi = rb - (BEFORE_RESTART if rb < dur - 0.01 else FILE_TAIL)
        if hi - lo < 0.4:
            continue
        flags = []
        ws = [w for w in W if w[0] >= ra and w[1] <= rb + 0.05]
        marks = [w for w in ws if tf.norm(w[2]) in (start_m, end_m) and tf.norm(w[2])]
        ws = [w for w in ws if w not in marks]
        # 2. TRIM: the phone at the recording's start / end
        ref = reference(src, ra, rb)
        h0 = phoneish(src, lo, min(hi, lo + EDGE), ref)
        h1 = phoneish(src, max(lo, hi - EDGE), hi, ref)
        n0, n1 = run_of(h0), run_of(h1, from_end=True)
        why0 = collections.Counter(w for w in h0[:n0] if w).most_common(1)
        why1 = collections.Counter(w for w in h1[len(h1) - n1:] if w).most_common(1)
        # a reach / a tap is short: longer than REACH s "at the phone" is more likely acting (rosenblum-2: he walks in
        # with the tea, leans into the lens for the close-up) - nothing cut, asked instead
        if n0 > REACH * KFPS:
            flags.append(f"The first {n0 / KFPS:.1f} s look like setup ({why0[0][0]}) - kept. Acting, or cut it?")
            n0, why0 = 0, []
        if n1 > REACH * KFPS:
            flags.append(f"The last {n1 / KFPS:.1f} s look like reaching for the phone ({why1[0][0]}) - kept. Acting, or cut it?")
            n1, why1 = 0, []
        a = lo + (n0 / KFPS + 0.1 if n0 else 0)
        b = hi - (n1 / KFPS + 0.1 if n1 else 0)
        how = "phone" if (n0 or n1) else "margins"
        # spoken markers / claps cut exactly there
        for w in marks:
            if tf.norm(w[2]) == start_m:
                a, how = max(a, w[1] + 0.3), "marker"
            else:
                b, how = min(b, w[0] - 0.2), "marker"
        for c in claps:
            if ra < c < ra + 3 and c + 0.3 > a:
                a, how = c + 0.3, "clap"
            if rb - 3 < c < rb and c - 0.2 < b:
                b, how = c - 0.2, "clap"
        inside = [w for w in ws if w[1] > a - 0.05 and w[0] < b + 0.05]
        if ws:
            if ws[0][0] - tf.PRE < a and how != "marker":
                if n0 or ws[0][0] < ra + 0.45:
                    flags.append(f"Speaks {max(0, ws[0][0] - ra):.1f} s after the recording starts, " + (f"while still at the phone ({why0[0][0]})" if why0 else "right on the restart") +
                                 " - start kept at his first word. OK?")
                a = max(ra + 0.15, min(a, ws[0][0] - tf.PRE))
            if ws[-1][1] + tf.POST > b and how != "marker":
                if ws[-1][1] + 0.05 > rb - 0.3:
                    flags.append("His last word runs into the restart - check the ending.")
                elif n1:
                    flags.append(f"Already {why1[0][0] if why1 else 'reaching'} while saying the last word - end kept after it. OK?")
                b = min(rb - 0.1, max(b, ws[-1][1] + tf.POST))
            inside = [w for w in ws if w[1] > a - 0.05 and w[0] < b + 0.05]
        if b - a < 0.4:
            continue
        if not inside:
            flags.append(f"No words in these {b - a:.1f} s - a silent piece (acting, a look) or just setup?")
        else:
            if inside[0][0] - a > SILENT:
                flags.append(f"{inside[0][0] - a:.1f} s of silence before the first word - kept. Silent acting, or him walking to the camera?")
            if b - inside[-1][1] > SILENT_AFTER:
                flags.append(f"{b - inside[-1][1]:.1f} s after the last word - kept. A reaction, or dead time?")
        for t, sc in maybes:
            if a < t < b:
                flags.append(f"Maybe a restart at {t - a:.1f} s into the clip (picture jump {sc:.1f}) - one clip or two?")
        seg = d[int(a * 100):int(b * 100)]
        clips.append({"take": aid, "label": label, "rec": rn, "in": round(a, 2), "out": round(b, 2), "how": how,
                      "words": [[round(w[0], 2), round(w[1], 2), w[2]] for w in inside],
                      "text": " ".join(w[2] for w in inside), "noise_db": round(float(np.percentile(seg, 10)) if len(seg) else noise_all, 1),
                      "flags": flags, "phone": {"start": why0[0][0] if why0 else "", "end": why1[0][0] if why1 else ""}})
    info = {"label": label, "duration": round(dur, 2), "audio_offset": off, "restarts": [round(t, 2) for t in restarts],
            "maybe_restarts": [[round(t, 2), sc] for t, sc in maybes], "claps": claps,
            "cutout": bool(A.get("matte") and os.path.exists(ep.p(A["matte"])))}
    return clips, info


def said(line, toks):
    """the clip says this line: 60% of its words in order - or a broken-off try of a long one (6+ of its words, 35%)"""
    lw = [tf.norm(w) for w in line.split() if tf.norm(w)]
    if not lw:
        return False
    import difflib
    m = sum(b.size for b in difflib.SequenceMatcher(a=lw, b=toks, autojunk=False).get_matching_blocks())
    return m / len(lw) >= 0.6 or (m >= 6 and m / len(lw) >= 0.35)


def match_script(clips, rows):
    """each clip's script lines (>= 60% of a line's words heard in it, in order), only the take's own speaker's lines (the
    speaker = whose long lines the take's words cover most); a line said in more clips = takes, numbered in recording
    order, the LAST one kept"""
    for take in {c["take"] for c in clips}:
        mine = [c for c in clips if c["take"] == take]
        toks = [tf.norm(w) for c in mine for w in c["text"].split() if tf.norm(w)]
        score = collections.Counter()
        for r in rows:
            n = len([w for w in r["text"].split() if tf.norm(w)])
            if r["who"] and n >= 4 and tf.coverage(r["text"], toks) >= 0.6:
                score[r["who"]] += n
        who = score.most_common(1)[0][0] if score else ""
        own = [r for r in rows if r["who"] == who] if who else rows
        for c in mine:
            ct = [tf.norm(w) for w in c["text"].split() if tf.norm(w)]
            c["lines"] = [r["n"] for r in own if ct and said(r["text"], ct)]
            c["who"] = who
    # a line the script repeats word for word (the question read out again) is no retake of itself
    seen, dup = {}, set()
    for r in rows:
        k = " ".join(tf.norm(w) for w in r["text"].split() if tf.norm(w))
        if k in seen:
            dup |= {r["n"], seen[k]}
        seen.setdefault(k, r["n"])
    for c in clips:
        c["lines"] = [n for n in c["lines"] if n not in dup] + [n for n in c["lines"] if n in dup]
        c["repeated"] = [n for n in c["lines"] if n in dup]
    by_line = collections.defaultdict(list)
    for i, c in enumerate(clips):
        for n in c["lines"]:
            if n not in c["repeated"]:
                by_line[n].append(i)
    for i, c in enumerate(clips):
        c["kept"] = True
        own = [n for n in c["lines"] if n not in c["repeated"]]
        if own:
            later = [by_line[n][-1] for n in own if by_line[n][-1] != i]
            if len(later) == len(own):
                c["kept"] = False
                c["flags"].append("Said again later (" + ", ".join(sorted({f"clip {j + 1}" for j in later})) +
                                  ") - this earlier take is set aside. OK?")
        n0 = own[0] if own else None
        if n0 is not None:
            c["take_no"], c["takes"] = by_line[n0].index(i) + 1, len(by_line[n0])
    return clips


def clip_label(c, i):
    who = c.get("who") or c["label"][:10]
    if c["lines"]:
        ln = c["lines"]
        lines = f"line {ln[0]}" if len(ln) == 1 else "lines " + ", ".join(map(str, ln[:3])) + (f" +{len(ln) - 3}" if len(ln) > 3 else "")
        tk = f" · take {c['take_no']}/{c['takes']}" if c.get("takes", 1) > 1 else ""
        return f"{who} · {lines}{tk}"  # (set aside or not: Media says it under the name)
    return f"{who} · clip {i + 1}" + (" · silent" if not c["words"] else "")


def sheet(ep, clips, out):
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        return
    tiles = []
    for c in clips:
        row = []
        for t in (c["in"] + 0.05, c["out"] - 0.05):
            f = frames(ep.p(c["src"]), t, t + 0.1, 10)
            row.append(Image.fromarray(f[0]).resize((135, 240)) if len(f) else Image.new("RGB", (135, 240)))
        tiles.append((c, row))
    if not tiles:
        return
    cols = 5
    W, H = 135 * 2 + 10, 240 + 22
    im = Image.new("RGB", (cols * W, ((len(tiles) + cols - 1) // cols) * H), "white")
    dr = ImageDraw.Draw(im)
    for k, (c, row) in enumerate(tiles):
        x, y = (k % cols) * W, (k // cols) * H
        im.paste(row[0], (x, y + 20))
        im.paste(row[1], (x + 135, y + 20))
        dr.text((x + 3, y + 4), f"#{k + 1} {c['out'] - c['in']:.1f}s" + (" ?" if c["flags"] else "") +
                ("" if c["kept"] else " aside"), fill="red" if c["flags"] else "black")
    im.save(out, quality=82)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--assets", help="take ids (comma) - default: every take (video asset that is not a clip)")
    ap.add_argument("--script", help="default: scripts/<episode.json script>.txt, else the project's script.txt")
    ap.add_argument("--markers", default="אקשן,קאט")
    ap.add_argument("--dry", action="store_true", help="the report only - nothing written to the project")
    args = ap.parse_args()
    ep = Episode(args.episode)
    p = projectlib.load(ep)
    takes = [(k, a) for k, a in p["assets"].items() if a.get("kind") == "video" and not a.get("clip")]
    if args.assets:
        want = args.assets.split(",")
        takes = [(k, a) for k, a in takes if k in want or (a.get("label") or "") in want]
    dates = {}
    try:
        dates = json.load(open(ep.p("work", "dates.json"), encoding="utf-8"))
        dates = dates.get("dates", dates)
    except Exception:
        pass
    takes.sort(key=lambda x: (dates.get(x[0]) or 0, x[0]))  # (recording order: retakes = the later one)
    sp = args.script or (os.path.join(ROOT, "scripts", ep.cfg["script"] + ".txt") if ep.cfg.get("script") else ep.p("script.txt"))
    rows = tf.script_lines(sp, "") if sp and os.path.exists(sp) else []
    log(f"prepare clips: {len(takes)} take(s)" + (f", script {os.path.basename(sp)} ({len(rows)} lines)" if rows else ", no script"))

    allc, infos = [], {}
    for aid, A in takes:
        cs, info = take_clips(ep, aid, A, args, rows)
        for c in cs:
            c["src"] = A["src"]
        allc += cs
        infos[aid] = info
    match_script(allc, rows)

    # the report: the questions first
    rep, q = [], 0
    for i, c in enumerate(allc):
        c["name"] = clip_label(c, i)
        if c["flags"]:
            q += 1
            rep.append(f"#{i + 1} {c['name']}  ({c['label']} {c['in']:.2f}-{c['out']:.2f})")
            rep += [f"     ? {f}" for f in c["flags"]]
    head = [f"{len(allc)} clips from {len(takes)} take(s) - {q} need a look" + (":" if q else " - all clean."), ""]
    tail = ["", "all clips:"]
    for i, c in enumerate(allc):
        tail.append(f"#{i + 1:<3} {c['name']:<34} {c['label'][-12:]} rec {c['rec']:<2} {c['in']:7.2f}-{c['out']:7.2f} "
                    f"({c['out'] - c['in']:4.1f} s) [{c['how']}] noise {c['noise_db']} dB  {c['text'][:50]}")
    for aid, info in infos.items():
        tail.append(f"{info['label']}: {len(info['restarts'])} restarts {info['restarts']}, maybe {info['maybe_restarts']}, "
                    f"sound offset {info['audio_offset']} s, cut-out {'yes' if info['cutout'] else 'NO - run Analyze'}")
    if rows:
        said = {n for c in allc for n in c["lines"]}
        miss = [r for r in rows if r["n"] not in said]
        tail.append(f"script lines found: {len(said)}/{len(rows)}" + (" - not heard (check by ear):" if miss else ""))
        tail += [f"   {r['n']:>3} {r['who']}: {r['text'][:60]}" for r in miss]
    od = ep.work("prepare", "report.txt")
    open(od, "w", encoding="utf-8").write("\n".join(head + rep + tail) + "\n")
    json.dump({"takes": infos, "clips": allc}, open(ep.work("prepare", "clips.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    sheet(ep, allc, ep.work("prepare", "sheet.jpg"))
    # the next step ready: a tools/fast_cut.py plan of the kept clips, in script order
    kept = sorted([c for c in allc if c["kept"] and c["words"]], key=lambda c: (min(c["lines"]) if c["lines"] else 1e9, c["in"]))
    plan = {"restarts": {i["label"]: i["restarts"] for i in infos.values()},
            "audioOffset": {i["label"]: i["audio_offset"] for i in infos.values() if i["audio_offset"]},
            "lines": [{"who": c.get("who") or "main", "take": c["label"], "a": c["in"], "b": c["out"]} for c in kept]}
    if sp and os.path.exists(sp):
        plan["script"] = os.path.relpath(sp, ROOT).replace(os.sep, "/")
    json.dump(plan, open(ep.work("prepare", "plan.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    log("\n".join(head + rep + tail))
    if args.dry:
        log("\n(dry run - nothing written to the project)")
        return

    # 5. INTO MEDIA (the project again: he may have edited while this ran - only clip assets change)
    p = projectlib.load(ep)
    done = {c["take"] for c in allc} | {aid for aid, _ in takes}
    old = {k: a for k, a in p["assets"].items() if a.get("clip", {}).get("take") in done}
    for k in old:
        del p["assets"][k]
    per = collections.Counter()
    for c in allc:
        A = p["assets"].get(c["take"])
        if not A:
            continue
        per[c["take"]] += 1
        short = re.sub(r"[^\w-]", "", c["label"])[-10:]
        cid = f"c.{short}.{per[c['take']]:02d}"
        a = {k: v for k, v in A.items() if k in ("kind", "src", "w", "h", "duration", "audio", "preview", "fg", "matte",
                                                 "framing", "keep_static")}
        a["label"] = c["name"]
        a["clip"] = {"take": c["take"], "in": c["in"], "out": c["out"], "rec": c["rec"], "lines": c["lines"],
                     "who": c.get("who", ""), "kept": c["kept"], "flags": c["flags"], "text": c["text"],
                     "noise_db": c["noise_db"], "audio_offset": infos[c["take"]]["audio_offset"], "how": c["how"]}
        if c.get("takes"):
            a["clip"]["take_no"], a["clip"]["takes"] = c["take_no"], c["takes"]
        for k in ("mark", "note"):                       # his marks on a clip outlive a re-run
            if k in old.get(cid, {}):
                a[k] = old[cid][k]
        p["assets"][cid] = a
    projectlib.save(ep, p, note=f"prepare clips: {len(allc)} clips, {q} to look at")
    # each clip's picture in Media: the studio's thumb route serves work/layers/thumbs/<id>.jpg when it is there
    for cid, a in p["assets"].items():
        c = a.get("clip")
        if c and c["take"] in done:
            th = ep.work("layers", "thumbs", re.sub(r"[^\w.-]", "_", cid) + ".jpg")
            pv = a.get("preview") if a.get("preview") and os.path.exists(ep.p(a["preview"])) else a["src"]
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{c['in'] + min(0.6, (c['out'] - c['in']) / 2):.2f}",
                            "-i", ep.p(pv), "-frames:v", "1", "-vf", "scale=160:-2", th], check=False)
    log(f"\n-> {len(allc)} clips in Media ({q} with a question) · work/prepare/report.txt, sheet.jpg, plan.json (for fast_cut)")


if __name__ == "__main__":
    main()
