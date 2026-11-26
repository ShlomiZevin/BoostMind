"""TAKE FINDER - where the real scene is inside one long recording (his ask, rosenblum-2, 2026-11-26: "a long shot with
several clips, several takes - find when a clip is starting and when it is ending ... remove the areas where I'm
starting the camera or moving toward the camera").

    .venv/Scripts/python.exe tools/take_finder.py <video> [--script scripts/<id>.txt] [--who rosenblum] [--take <label>]
                                                 [--out <dir>] [--markers אקשן,קאט] [--plan plan.json]
                                                 [--words episodes/<id>/work/words/<take>.json]  (reuse Analyze's words)

What it finds, in this order:
  1. RECORDINGS - a TikTok / filter-app export is many recordings glued together; every restart is a hard picture jump
     (ffmpeg scdet). Nothing is ever taken across a restart (after one the filter is off for ~0.3 s and before one he
     reaches for the phone - rosenblum-1).
  2. MARKERS (optional, his idea for the next shoots) - a spoken "אקשן" starts a scene, "קאט" ends it; a sharp CLAP is
     listed as a boundary too. With markers the scene = from just after the start marker to just before the end marker.
  2b. WHISPERS - a recording with sound but no words is re-read alone without the recogniser's voice filter.
  3. THE SCENE inside each recording - from 0.30 s before its first word to 0.25 s after its last word, never inside the
     recording's first 0.45 s / last 0.35 s (the phone tap). Silence of more than 1.5 s before the first word is FLAGGED,
     not cut: it may be silent acting (look at the sheet) or him walking to the camera.
  4. THE SCRIPT - each scene is matched to the script lines it says (the speaker's lines; directions skipped). A line
     said in two scenes = a retake: the LATER one is kept (his rule), the earlier is marked "superseded".
Writes to <out> (default: work/takefinder/<video name>/ next to the project, or c:/tmp):
  report.txt   - one row per scene: recording, a-b (seconds in the video), its first/last words, the script lines, flags
  sheet.jpg    - first / middle / last frame of every scene (LOOK at it before cutting: setup, his real face, a reach)
  scenes.json  - the same data; with --plan, also a tools/fast_cut.py plan: {"lines": [{who, take, a, b}, ...]} of the
                 kept scenes in script order - the first edit in one more command.
Words: faster-whisper (models/he-turbo via pipeline.transcribe), cached in <out>/words.json.
"""
import argparse
import difflib
import json
import os
import re
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
HEAD, TAIL = 0.45, 0.35          # never the phone tap at a recording's edges
PRE, POST = 0.30, 0.25           # the scene starts / ends this far from its first / last word
SILENT_FLAG = 1.5                # more silence than this before the first word = look (acting or walking in)


def norm(w):
    return re.sub(r"[^\u0590-\u05FFa-zA-Z0-9]", "", w).replace("ך", "כ").replace("ם", "מ").replace("ן", "נ") \
        .replace("ף", "פ").replace("ץ", "צ")


def audio16(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


def loudness(s, sr=16000):
    hop = sr // 100
    n = len(s) // hop
    fr = s[:n * hop].reshape(n, hop)
    return 20 * np.log10(np.sqrt((fr * fr).mean(1)) + 1e-9)


def restarts(path, thr=10):
    """hard picture jumps (seconds) - each one a new recording"""
    p = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-vf", f"scdet=threshold={thr}", "-an", "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="ignore")
    ts = [float(m) for m in re.findall(r"lavfi\.scd\.time:\s*([0-9.]+)", p.stderr)]
    out = []
    for t in ts:                                   # one restart can flash 2-3 jumps in a row
        if not out or t - out[-1] > 0.6:
            out.append(t)
    return out


def words(path, samples, cache):
    if os.path.exists(cache):
        return [[w["s"], w["e"], w["w"]] for w in json.load(open(cache, encoding="utf-8"))]
    from pipeline.transcribe import _chunks, _get_model
    print(f"  words: {len(samples) / 16000:.0f} s of audio...", flush=True)
    model, out = _get_model(), []
    for a, b in _chunks(samples, 16000):
        pa, pb = max(0.0, a - 0.15), min(len(samples) / 16000, b + 0.15)
        segs, _ = model.transcribe(samples[int(pa * 16000):int(pb * 16000)], language="he", word_timestamps=True,
                                   beam_size=5, vad_filter=False, condition_on_previous_text=False)
        for s in segs:
            for w in s.words or []:
                t = w.word.strip()
                if t:
                    ws = min(max(pa + w.start, a), b)
                    out.append({"w": t, "s": round(ws, 3), "e": round(min(max(pa + w.end, ws + 0.05), b + 0.1), 3)})
    json.dump(out, open(cache, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    return [[w["s"], w["e"], w["w"]] for w in out]


def fill_whispers(W, recs, samples, d, cache):
    """a recording with sound but no words = whispers the recogniser's voice filter dropped (Rosenblum whispers all the
    time - rosenblum-2: 3 of 9 recordings came back empty): transcribe that span alone, filter off"""
    extra = json.load(open(cache, encoding="utf-8")) if os.path.exists(cache) else {}
    noise = np.percentile(d, 10)
    model = None
    for ra, rb, rn in recs:
        if any(ra <= w[0] < rb for w in W):
            continue
        seg = d[int(ra * 100):int(rb * 100)]
        if len(seg) == 0 or (seg > noise + 12).sum() < 50:           # < 0.5 s of sound above the room = really silent
            continue
        key = f"{ra:.2f}"
        if key not in extra:
            if model is None:
                from pipeline.transcribe import _get_model
                model = _get_model()
            print(f"  whispers? re-reading recording {rn} ({ra:.1f}-{rb:.1f} s) without the voice filter...", flush=True)
            x = samples[int(ra * 16000):int(rb * 16000)]
            segs, _ = model.transcribe(x, language="he", word_timestamps=True, beam_size=5, vad_filter=False,
                                       condition_on_previous_text=False, no_speech_threshold=0.9)
            extra[key] = [[round(ra + w.start, 3), round(ra + max(w.end, w.start + 0.05), 3), w.word.strip()]
                          for s in segs for w in (s.words or []) if w.word.strip()]
            json.dump(extra, open(cache, "w", encoding="utf-8"), ensure_ascii=False)
        W.extend(extra[key])
    W.sort(key=lambda w: w[0])
    return W


def claps(d):
    """sharp transients: the level jumps 25 dB over the 100 ms before it and falls 15 dB within 80 ms"""
    out = []
    for i in range(10, len(d) - 8):
        if d[i] - d[i - 10:i].max() > 25 and d[i] - d[i + 1:i + 8].min() > 15:
            if not out or i / 100 - out[-1] > 0.5:
                out.append(i / 100)
    return out


def script_lines(path, who):
    """the speaker's spoken lines: 'name: text' rows (directions in ( ) / [ ] skipped); who = a name or its start"""
    rows = []
    for raw in open(path, encoding="utf-8"):
        s = raw.strip()
        if not s or s.startswith("#") or s[0] in "([":
            continue
        m = re.match(r"^\**([^:*]{1,30})\**\s*:\s*(.+)$", s)
        name, text = (m.group(1).strip(), m.group(2)) if m else ("", s)
        rows.append({"n": len(rows) + 1, "who": name, "text": text})
    if who:
        mine = [r for r in rows if r["who"].startswith(who) or who in r["who"]]
        if mine:
            return mine
    return rows


def coverage(line, toks):
    lw = [norm(w) for w in line.split() if norm(w)]
    if not lw:
        return 0
    sm = difflib.SequenceMatcher(a=lw, b=toks, autojunk=False)
    return sum(b.size for b in sm.get_matching_blocks()) / len(lw)


def frame(path, t, out):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{max(0, t):.2f}", "-i", path, "-frames:v", "1",
                    "-vf", "scale=180:-2", out], check=False)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--script")
    ap.add_argument("--who", default="")
    ap.add_argument("--take", default="")
    ap.add_argument("--out")
    ap.add_argument("--markers", default="אקשן,קאט")
    ap.add_argument("--plan")
    ap.add_argument("--threshold", type=float, default=10)
    ap.add_argument("--words", help="reuse a words file ({w,s,e}) - e.g. the project's work/words/<take>.json after Analyze")
    a = ap.parse_args()
    name = os.path.splitext(os.path.basename(a.video))[0]
    out = a.out or os.path.join("c:/tmp/takefinder", name)
    os.makedirs(out, exist_ok=True)

    s = audio16(a.video)
    dur = len(s) / 16000
    d = loudness(s)
    W = words(a.video, s, a.words or os.path.join(out, "words.json"))
    R = restarts(a.video, a.threshold)
    C = claps(d)
    start_m, end_m = [norm(x) for x in a.markers.split(",")] + [""] * (2 - len(a.markers.split(",")))
    marks = [(w[0], w[1], "start" if norm(w[2]) == start_m else "end") for w in W if norm(w[2]) in (start_m, end_m) and norm(w[2])]

    # recordings, then split further at markers
    edges = [0.0] + R + [dur]
    recs = [(edges[i], edges[i + 1], i + 1) for i in range(len(edges) - 1) if edges[i + 1] - edges[i] > 0.3]
    W = fill_whispers(W, recs, s, d, os.path.join(out, "words_whispers.json"))
    scenes = []
    for ra, rb, rn in recs:
        lo, hi = ra + (HEAD if ra > 0 or True else 0), rb - TAIL
        ms = [m for m in marks if ra <= m[0] < rb]
        spans = []
        if ms:                                       # marker-driven: start after "אקשן", end before "קאט"
            cur = lo
            for m0, m1, kind in ms:
                if kind == "start":
                    cur = m1 + 0.3
                else:
                    spans.append((cur, m0 - 0.2, "marker"))
                    cur = None
            if cur is not None:
                spans.append((cur, hi, "marker"))
        else:
            spans.append((lo, hi, "words"))
        for sa, sb, how in spans:
            ws = [w for w in W if w[0] >= sa - 0.05 and w[1] <= sb + 0.3 and norm(w[2]) not in (start_m, end_m)]
            sc = {"rec": rn, "how": how, "words": len(ws), "flags": []}
            if not ws:
                sc.update(a=round(sa, 2), b=round(sb, 2), text="", flags=["no speech - setup / silent"])
                scenes.append(sc)
                continue
            A = max(sa, ws[0][0] - PRE)
            B = min(sb, ws[-1][1] + POST)
            if ws[0][0] - sa > SILENT_FLAG:
                sc["flags"].append(f"{ws[0][0] - sa:.1f} s silent before the first word - acting or walking in? (sheet)")
            if sb - ws[-1][1] > SILENT_FLAG:
                sc["flags"].append(f"{sb - ws[-1][1]:.1f} s after the last word - a reaction? (sheet)")
            cl = [c for c in C if A < c < B]
            if cl:
                sc["flags"].append("clap at " + ", ".join(f"{c:.2f}" for c in cl))
            sc.update(a=round(A, 2), b=round(B, 2), text=" ".join(w[2] for w in ws),
                      first=" ".join(w[2] for w in ws[:4]), last=" ".join(w[2] for w in ws[-4:]))
            scenes.append(sc)

    # script lines per scene + retakes (a line said again later = the later one wins)
    lines = script_lines(a.script, a.who) if a.script else []
    for sc in scenes:
        toks = [norm(w) for w in sc.get("text", "").split() if norm(w)]
        sc["lines"] = [L["n"] for L in lines if toks and coverage(L["text"], toks) >= 0.6]
    last_seen = {}
    for i, sc in enumerate(scenes):
        for n in sc["lines"]:
            last_seen[n] = i
    for i, sc in enumerate(scenes):
        later = sorted({last_seen[n] for n in sc["lines"] if last_seen[n] != i})
        if sc["lines"] and all(last_seen[n] != i for n in sc["lines"]):
            sc["superseded"] = [scenes[j]["rec"] for j in later]
            sc["flags"].append("retake - said again later in recording " + ", ".join(str(scenes[j]["rec"]) for j in later))

    # contact sheet: first / middle / last frame of every scene
    try:
        from PIL import Image, ImageDraw
        tiles = []
        for k, sc in enumerate(scenes):
            row = []
            for j, t in enumerate((sc["a"], (sc["a"] + sc["b"]) / 2, sc["b"] - 0.05)):
                f = os.path.join(out, f"f{k:03d}_{j}.jpg")
                frame(a.video, t, f)
                row.append(Image.open(f) if os.path.exists(f) else Image.new("RGB", (180, 320)))
            tiles.append((sc, row))
        w, h = tiles[0][1][0].size if tiles else (180, 320)
        cols = 4
        sheet = Image.new("RGB", (cols * (3 * w + 12), ((len(tiles) + cols - 1) // cols) * (h + 26)), "white")
        dr = ImageDraw.Draw(sheet)
        for k, (sc, row) in enumerate(tiles):
            x0, y0 = (k % cols) * (3 * w + 12), (k // cols) * (h + 26)
            for j, im in enumerate(row):
                sheet.paste(im.resize((w, h)), (x0 + j * w, y0 + 24))
            dr.text((x0 + 4, y0 + 4), f"#{k + 1} rec{sc['rec']} {sc['a']:.1f}-{sc['b']:.1f}s"
                    + (" RETAKE" if sc.get("superseded") else "") + (" NOSPEECH" if not sc["words"] else ""), fill="black")
        sheet.save(os.path.join(out, "sheet.jpg"), quality=82)
    except Exception as e:
        print("  (no sheet:", e, ")")

    # report
    rep = [f"{a.video}  {dur:.1f} s  - {len(recs)} recordings ({len(R)} restarts), {len(marks)} markers, {len(C)} claps",
           f"restarts at: " + ", ".join(f"{t:.2f}" for t in R), ""]
    for k, sc in enumerate(scenes):
        rep.append(f"#{k + 1:<3} rec {sc['rec']:<3} {sc['a']:7.2f} - {sc['b']:7.2f}  ({sc['b'] - sc['a']:5.1f} s)  "
                   f"lines {sc['lines'] or '-'}")
        if sc.get("first"):
            rep.append(f"       starts: {sc['first']}  ...  ends: {sc['last']}")
        for f in sc["flags"]:
            rep.append(f"       ! {f}")
    if lines:
        said = {n for sc in scenes for n in sc["lines"]}
        miss = [L for L in lines if L["n"] not in said]
        rep.append("")
        rep.append(f"script lines found: {len(said)}/{len(lines)}" + ("" if not miss else "  - not found (check by ear - "
                   "the recogniser drops short phrases):"))
        for L in miss:
            rep.append(f"   {L['n']:>3} {L['who']}: {L['text'][:70]}")
    open(os.path.join(out, "report.txt"), "w", encoding="utf-8").write("\n".join(rep) + "\n")
    keep = [sc for sc in scenes if sc["words"] and not sc.get("superseded")]
    res = {"video": a.video, "duration": dur, "restarts": R, "claps": C, "markers": marks, "scenes": scenes}
    if a.plan:
        take = a.take or name
        res["plan"] = {"lines": [{"who": a.who or "main", "take": take, "a": sc["a"], "b": sc["b"]} for sc in keep]}
        json.dump(res["plan"], open(a.plan, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(res, open(os.path.join(out, "scenes.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("\n".join(rep))
    print(f"\n-> {out}/report.txt, sheet.jpg, scenes.json" + (f", {a.plan}" if a.plan else ""))


if __name__ == "__main__":
    main()
