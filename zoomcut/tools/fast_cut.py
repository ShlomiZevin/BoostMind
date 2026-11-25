"""FAST CUT - the first edit of his takes in one command: the right silences out, the clips joined, the sound pulled a
little before and after every cut so it runs on and no word is cut. Monologue (a podcast, a rabbi, a keynote) = one
character; dialogue = two (or more) characters, each in its own GROUP of rows, the turns overlapping like real talk.
Built from the cut he loved on naomi-1-tight (2026-11-24) and every note he gave on it - see "His rules" below.

    .venv/Scripts/python.exe tools/fast_cut.py <episode> [plan.json] [options]

  <episode>        the project (its takes must be analysed: an asset per take, with `audio` / `matte`)
  plan.json        what to cut (below); without one: --takes in order, one character (--who)
  --takes a,b,c    take ids or the start of their names, in order (each whole take = one line)
  --who vova       the character for --takes (default: the first group in the project, else "main")
  --go             write into the project (without it: a dry run - the report + work/fastcut/ops.json only)
  --min-silence S  a pause shorter than this stays (default 0.18 s; inside a phrase 0.30 s - "השהיית תגובה")
  --handle S       the sound before / after each cut (default 0.14 s of the take, never into a cut-out word)
  --keep-retakes   keep every attempt (default: a line said twice = the LATER take - the same 4 words said again within
                   ~45 s drop everything from the first attempt to the second; the report lists each drop)
  --overlap S      dialogue: the next speaker's first word starts S seconds (at playback speed) before the last word
                   of the one before ends (default 0.1 - his number since 2026-11-18)

The plan (JSON) - everything optional except lines:
  {"start": 1.1,                       # timeline second the first line starts (after a knock, an intro)
   "overlap": 0.1, "minSilence": 0.18, "handle": 0.14,
   "script": "scripts/vova-hr.txt",    # subtitles take the script's spelling where the words match
   "fix": {"heard": "right"},          # mishears, word by word
   "characters": {"vova": {"name": "וובה", "set": "m.vova-room-A3.jpg", "setBox": {...}, "box": {...},
                           "subColor": "#ffffff", "subY": 1430, "cutout": true}},
   "lines": [{"who": "osnat", "take": "B1C2", "a": 1.2, "b": 8.4,     # a / b = take seconds (default: its words)
              "keep": [[3.1, 3.9]],     # never cut inside these take seconds (his "no cut here")
              "cut": [5.2],             # always cut the pause at this take second (his "tighten")
              "over": 0.3}]}            # this turn only: more overlap (an interruption), negative = a pause
  A character with no set in the plan keeps the set on its `<who>.bg` row (the sets you laid before the footage).

What it writes (each character = one group, named as the character): `<who>.bg` (its set, one picture per clip, linked),
`<who>.video` (the clips, cut on the words), `voice.<who>` + `voice.<who>.2` (the voices alternate rows so the handles
of two neighbouring clips can overlap), `subs.<who>` (subtitles from the heard words, linked); a dialogue also gets the
"What we see" strip (`view`). Every row he already has keeps its props, name and mute (only its clips are new); every
other row (music, sfx, texts) is not touched. Voices: no fades, ever - hard cuts with sound handles.

His rules (each one a note he had to give):
  - never cut inside a word ("תופעה" was cut in two) - a pause is cut only where no word spans it;
  - never cut a soft word that sits in a "silence" ("אתם", "אותו") - the cut stops at the word's start;
  - a short pause inside a phrase stays ("לא צריך חיתוך כאן", between "השהיית" and "תגובה");
  - a breath before a word is not a word - the picture starts on the speech, not on the breath ("tighten the cut");
  - the sound runs a little before and after each picture cut, never reaching into the words that were cut out;
  - no fades on voices ("אל תעשה את זה בחיים");
  - picture and its voice always in sync: every linked pair is checked (within -40..0 ms) before anything is written;
  - never the selfie start / stop: nothing from the take's first 0.45 s or last 0.35 s; a record tap is dropped.
Words: faster-whisper (the Hebrew model in models/he-turbo), cached in work/words/<take>.json; edges come from the
loudness map (10 ms), whisper only says where words are.
"""
import argparse
import difflib
import json
import os
import re
import subprocess
import sys
import urllib.request

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
API = f"http://127.0.0.1:{os.environ.get('ZC_PORT', '4747')}"
TAKE_HEAD, TAKE_TAIL = 0.45, 0.35       # the selfie start / stop never shows
MIN_PIECE = 0.30                        # a piece shorter than this joins its neighbour over the pause
WORD_BACK = 0.40                        # how far a word's soft onset may run before its loud speech (all of it stays)
TAIL_FWD = 0.15                         # a word's decaying tail kept after the loud speech
PHRASE_GAP = 0.30                       # a pause inside a phrase (no , . ? ! before it) is cut only from this long


# ---------------------------------------------------------------- studio
def req(method, url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(API + url, data=data, method=method, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(r) as f:
        return json.loads(f.read().decode())


def load_project(ep):
    j = req("GET", f"/api/p/{ep}")
    return j.get("project", j)


# ---------------------------------------------------------------- per take: loudness + words
def take_audio(ep, asset):
    path = None
    for src in (asset.get("audio"), asset.get("src")):      # the analysed wav, else the take itself
        if src:
            q = src if os.path.isabs(src) else os.path.normpath(os.path.join(ROOT, "episodes", ep, src))
            if os.path.exists(q):
                path = q
                break
    if not path:
        sys.exit(f"no audio for take {asset.get('label')} - run Analyze on the project first")
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


def loudness(samples, sr=16000):
    """dB per 10 ms (RMS over 20 ms)"""
    hop, win = sr // 100, sr // 50
    n = max(1, len(samples) // hop)
    pad = np.concatenate([samples, np.zeros(win, np.float32)])
    out = np.empty(n)
    for i in range(n):
        seg = pad[i * hop:i * hop + win]
        out[i] = 20 * np.log10(np.sqrt(np.mean(seg * seg)) + 1e-9)
    return out


def words_of(ep, label, samples):
    """[[start, end, word]] - cached in work/words/<label>.json ({w, s, e} - the format other tools read)"""
    path = os.path.join(ROOT, "episodes", ep, "work", "words", label + ".json")
    if os.path.exists(path):
        ws = json.load(open(path, encoding="utf-8"))
        ws = ws.get("words", ws) if isinstance(ws, dict) else ws
        return [[w["s"], w["e"], w["w"]] for w in ws]
    from pipeline.transcribe import _chunks, _get_model
    print(f"  words: {label} ({len(samples) / 16000:.0f} s)...", flush=True)
    model, out = _get_model(), []
    for a, b in _chunks(samples, 16000):
        pa, pb = max(0.0, a - 0.15), min(len(samples) / 16000, b + 0.15)
        segs, _ = model.transcribe(samples[int(pa * 16000):int(pb * 16000)], language="he", word_timestamps=True,
                                   beam_size=5, vad_filter=False, condition_on_previous_text=False)
        for s in segs:
            for w in s.words or []:
                t = w.word.strip()
                if t:
                    ws_ = min(max(pa + w.start, a), b)
                    out.append({"w": t, "s": round(ws_, 3), "e": round(min(max(pa + w.end, ws_ + 0.05), b + 0.1), 3)})
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(out, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    return [[w["s"], w["e"], w["w"]] for w in out]


class Take:
    def __init__(self, ep, aid, asset):
        self.id, self.asset = aid, asset
        self.label = asset.get("label") or aid[2:]
        s = take_audio(ep, asset)
        self.dur = len(s) / 16000
        self.d = loudness(s)
        self.words = words_of(ep, self.label, s)
        p95, noise = np.percentile(self.d, 95), np.percentile(self.d, 10)
        self.LOUD, self.SOFT, self.QUIET, self.NOISE = p95 - 22, max(noise + 6, p95 - 36), p95 - 30, noise

    # loud speech runs (10 ms steps) in [a, b]; record taps at the edges dropped
    def runs(self, a, b):
        d = self.d
        i0, i1 = max(0, int(a * 100)), min(len(d), int(b * 100))
        loud = d[i0:i1] > self.LOUD
        runs, j = [], 0
        while j < len(loud):
            if loud[j]:
                k = j
                while k < len(loud) and loud[k]:
                    k += 1
                runs.append([i0 + j, i0 + k])
                j = k
            else:
                j += 1
        m = []
        for r in runs:
            if m and r[0] - m[-1][1] < 8:
                m[-1][1] = max(m[-1][1], r[1])
            else:
                m.append(r)
        runs = [r for r in m if r[1] - r[0] >= 3]
        while len(runs) > 1 and runs[0][1] - runs[0][0] < 15 and runs[1][0] - runs[0][1] >= 30:
            runs.pop(0)
        while len(runs) > 1 and runs[-1][1] - runs[-1][0] < 15 and runs[-1][0] - runs[-2][1] >= 30:
            runs.pop()
        return runs

    def soft_word_at(self, ws):
        """some voice right around a whisper word start (above the room's floor) - a soft word, not a drifted time"""
        seg = self.d[max(0, int((ws - 0.05) * 100)):int((ws + 0.15) * 100)]
        return (seg > self.NOISE + 10).sum() >= 4

    def back(self, i, limit):
        """walk the start out over the word's soft onset (up to 0.4 s of sound running on into the speech)"""
        j = i
        while j - 1 >= int(limit * 100) and i - (j - 1) <= WORD_BACK * 100 and self.d[j - 1] > self.SOFT:
            j -= 1
        return max(limit, j / 100 - 0.01)

    def fwd(self, i, limit):
        j = i
        while j < int(limit * 100) and j - i < TAIL_FWD * 100 and self.d[j] > max(self.SOFT, self.LOUD - 5):
            j += 1
        return min(limit, j / 100 + 0.01)

    def first_word(self, a=0, b=1e9):
        ws = [w for w in self.words if w[0] >= a - 0.05 and w[1] <= b + 0.3]
        return ws[0][0] if ws else None

    def last_word(self, a=0, b=1e9):
        ws = [w for w in self.words if w[0] >= a - 0.05 and w[1] <= b + 0.3]
        return ws[-1][1] if ws else None


# ---------------------------------------------------------------- retakes: a line said twice = the LATER take (his rule)
def retakes(words, a, b):
    """earlier attempts inside [a, b]: the same 4 words said again within ~45 s -> everything from the first attempt's
    start to the second one's start goes (a stumble, a restart). Returns [(drop_from_word_end, keep_from_word_start)]."""
    ws = [w for w in words if w[0] >= a - 0.05 and w[1] <= b + 0.3]
    nw = [norm(w[2]) for w in ws]
    out, i = [], 0
    while i < len(ws) - 4:
        gram = nw[i:i + 4]
        found = None
        if len(set(gram)) >= 3 and sum(len(x) for x in gram) >= 10:
            for j in range(i + 4, len(ws) - 3):
                if ws[j][0] - ws[i][0] > 45:
                    break
                if nw[j:j + 4] == gram:
                    found = j
                    break
        if found is None:
            i += 1
            continue
        prev_end = ws[i - 1][1] if i else a
        out.append((prev_end, ws[found][0], " ".join(w[2] for w in ws[i:found])))
        i = found
    return out


# ---------------------------------------------------------------- the cut
def pieces(t, a, b, min_sil, keep=(), force=()):
    """the spoken spans of [a, b] with the right silences out"""
    lo, hi = max(TAKE_HEAD, a - 0.1), min(t.dur - TAKE_TAIL, b + 0.3)
    runs = t.runs(a, b)
    if not runs:
        return [(round(max(lo, a), 3), round(min(hi, b), 3))]
    W = t.words
    out = [[t.back(runs[0][0], lo), None]]
    for r1, r2 in zip(runs, runs[1:]):
        g0, g1 = r1[1] / 100, r2[0] / 100
        mid = (g0 + g1) / 2
        if any(ka <= mid <= kb for ka, kb in keep):
            continue
        forced = any(g0 - 0.1 <= x <= g1 + 0.1 for x in force)
        if any(ws < g0 - 0.1 and we > g1 + 0.1 for ws, we, _ in W) and not forced:
            continue                                            # inside a word - never
        before = [w for w in W if w[1] <= mid]
        phrase_end = bool(before) and re.search(r"[,.?!:;…\"]$", before[-1][2])
        need = min_sil if (phrase_end or forced) else max(min_sil, PHRASE_GAP)
        if g1 - g0 < need:
            continue
        tail = t.fwd(r1[1], g1)
        head = t.back(r2[0], tail)
        if not forced:
            soft = [ws for ws, we, _ in W if g0 + 0.08 < ws < g1 - 0.08 and t.soft_word_at(ws)]
            if soft:                                            # a soft word in the "silence" stays whole ("אתם")
                head = min(head, min(soft) - 0.05)
            for ws, we, _ in W:                                 # a word the picture would start inside: start on it
                if ws < head < we and head - ws > 0.05 and ws > tail:
                    head = max(tail + 0.12, ws - 0.03)
        if head - tail >= 0.12:
            out[-1][1] = tail
            out.append([head, None])
    out[-1][1] = t.fwd(runs[-1][1], hi)
    k = 0
    while len(out) > 1 and k < len(out):
        if out[k][1] - out[k][0] < MIN_PIECE:
            if k == 0:
                out[0:2] = [[out[0][0], out[1][1]]]
            elif k == len(out) - 1:
                out[k - 1:k + 1] = [[out[k - 1][0], out[k][1]]]
            else:
                gp, gn = out[k][0] - out[k - 1][1], out[k + 1][0] - out[k][1]
                if gp <= gn:
                    out[k - 1:k + 1] = [[out[k - 1][0], out[k][1]]]
                else:
                    out[k:k + 2] = [[out[k][0], out[k + 1][1]]]
            k = 0
            continue
        k += 1
    return [(round(x, 3), round(y, 3)) for x, y in out]


def handles(t, A, B, H):
    """the sound before / after a picture cut: up to H s, only over what was cut out (never a cut-out word, never the
    loud speech of the next / previous piece), inside the recording's safe margins"""
    pe = [we for ws, we, _ in t.words if we <= A - 0.05]
    ns = [ws for ws, we, _ in t.words if ws >= B + 0.05]
    pre = min(H, A - (pe[-1] + 0.04 if pe else 0.3), A - 0.3)
    post = min(H, (ns[0] - 0.04 if ns else t.dur - 0.25) - B, t.dur - 0.25 - B)
    j = int(A * 100) - 1
    while j > 0 and t.d[j] <= t.LOUD and (A - j / 100) < H:
        j -= 1
    pre = min(pre, max(0.0, A - j / 100 - 0.02))
    j = int(B * 100) + 1
    while j < len(t.d) - 1 and t.d[j] <= t.LOUD and (j / 100 - B) < H:
        j += 1
    post = min(post, max(0.0, j / 100 - B - 0.02))
    return max(0.0, pre), max(0.0, post)


# ---------------------------------------------------------------- subtitles
norm = lambda w: re.sub(r"[^א-תA-Za-z0-9]", "", w).replace("ך", "כ").replace("ם", "מ").replace("ן", "נ").replace("ף", "פ").replace("ץ", "צ")


class Speller:
    """heard words -> the script's spelling and punctuation where they are the SAME words (an ad-lib keeps his words).
    In a dialogue each character is matched only against its own lines ("וובה: ..." in the script) - on vova-hr a
    shared stream gave Osnat's ad-lib Vova's line and pulled the end of the script into the middle of a monologue."""
    def __init__(self, script_path, fix, names=None):
        self.fix, self.tok, self.ptr = fix or {}, {}, {}
        self.names = names or {}            # who -> the name the script writes before the line
        if script_path:
            path = script_path if os.path.isabs(script_path) else os.path.join(ROOT, script_path)
            if not os.path.exists(path):
                path = os.path.join(os.path.dirname(ROOT), script_path)
            for l in open(path, encoding="utf-8").read().splitlines():
                if not l.strip() or l.lstrip().startswith(("#", "(")):
                    continue
                m = re.match(r"^\s*([^:\s]{1,20}):\s*(.*)$", l)
                who, text = (m.group(1), m.group(2)) if m else (None, l)
                text = re.sub(r"\([^)]*\)", " ", text)               # stage directions in the line: (צחוק מזויף)
                toks = text.replace("“", "\"").replace("”", "\"").replace("’", "'").split()
                self.tok.setdefault(who, []).extend(toks)
                self.tok.setdefault("*", []).extend(toks)

    def stream(self, who):
        name = self.names.get(who)
        if name and name in self.tok:
            return name
        return "*" if len(self.tok) <= 2 else (who if who in self.tok else "*")

    def __call__(self, ws, who=None):
        ws = [[s, e, self.fix.get(w, w)] for s, e, w in ws]
        ws = [x for x in ws if x[2]]
        key = self.stream(who)
        tok, ptr = self.tok.get(key, []), self.ptr.get(key, 0)
        if not tok or not ws:
            return ws
        lo, hi = max(0, ptr - 8), min(len(tok), ptr + len(ws) + 15)
        win = tok[lo:hi]
        hn, wn = [norm(x[2]) for x in ws], [norm(x) for x in win]
        sm = difflib.SequenceMatcher(None, hn, wn, autojunk=False)
        out, end = [], ptr
        same = lambda x, y: x == y or difflib.SequenceMatcher(None, x, y).ratio() >= 0.6
        for op, i1, i2, j1, j2 in sm.get_opcodes():
            if op == "equal":
                out += [[ws[i1 + q][0], ws[i1 + q][1], win[j1 + q]] for q in range(i2 - i1)]
                end = lo + j2
            elif op == "replace" and i2 - i1 == j2 - j1 and all(same(hn[i1 + q], wn[j1 + q]) for q in range(i2 - i1)):
                out += [[ws[i1 + q][0], ws[i1 + q][1], win[j1 + q]] for q in range(i2 - i1)]   # a mishear of the same word
                end = lo + j2
            elif op in ("replace", "delete"):
                out += ws[i1:i2]                                    # his own words (an ad-lib, a change)
        self.ptr[key] = end
        return out


def chunks(ws):
    """a new subtitle at . ? !, at a comma once it has 3 words, or at 4 words; a 1-2 word end joins the one before"""
    out, cur = [], []
    for w in ws:
        cur.append(w)
        if re.search(r"[.?!…:\"]$", w[2]) or (re.search(r"[,—–]$", w[2]) and len(cur) >= 3) or len(cur) == 4:
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    j = []
    for c in out:
        if j and len(c) <= 2 and not re.search(r"[.?!…\"]$", j[-1][-1][2]) and len(j[-1]) + len(c) <= 6:
            j[-1] = j[-1] + c
        else:
            j.append(c)
    return [(c[0][0], c[-1][1], " ".join(x[2] for x in c).rstrip(",").rstrip(" —–")) for c in j]


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("episode")
    ap.add_argument("plan", nargs="?")
    ap.add_argument("--takes")
    ap.add_argument("--who")
    ap.add_argument("--go", action="store_true")
    ap.add_argument("--min-silence", type=float)
    ap.add_argument("--handle", type=float)
    ap.add_argument("--overlap", type=float)
    ap.add_argument("--keep-retakes", action="store_true")
    ap.add_argument("--script", help="the script text - subtitles take its spelling (also \"script\" in the plan)")
    args = ap.parse_args()
    ep = args.episode
    plan = json.load(open(args.plan, encoding="utf-8")) if args.plan else {}
    p = load_project(ep)
    FPS = p["canvas"]["fps"]
    F = lambda s: int(round(s * FPS))
    SPEED = p.get("speed") or 1
    lay = {l["id"]: l for l in p["layers"]}
    takes = {k: a for k, a in p["assets"].items() if a.get("kind") == "video"}
    min_sil = args.min_silence or plan.get("minSilence", 0.18)
    H = args.handle if args.handle is not None else plan.get("handle", 0.14)
    over = args.overlap if args.overlap is not None else plan.get("overlap", 0.1)

    def take_id(x):
        if x in takes:
            return x
        m = [k for k in takes if (takes[k].get("label") or k[2:]).lower().startswith(x.lower()) or k[2:].lower().startswith(x.lower())]
        if len(m) != 1:
            sys.exit(f"take '{x}': {'no take' if not m else 'more than one take'} starts so - takes: {', '.join(takes)}")
        return m[0]

    lines = plan.get("lines")
    if not lines:
        if not args.takes:
            sys.exit("give a plan.json with lines, or --takes a,b,c")
        who = args.who or next((l["id"].split(".")[0] for l in p["layers"] if l.get("group") and l["kind"] in ("video", "image")), "main")
        lines = [{"who": who, "take": x.strip()} for x in args.takes.split(",") if x.strip()]
    for ln in lines:
        ln["take"] = take_id(ln["take"])
    chars = plan.get("characters", {})
    order = []
    for ln in lines:
        if ln["who"] not in order:
            order.append(ln["who"])
    dialogue = len(order) > 1

    T = {}
    for k in dict.fromkeys(ln["take"] for ln in lines):
        T[k] = Take(ep, k, takes[k])

    # ---- retakes out: a line said twice = the later take (each kept stretch becomes its own line)
    dropped, exp = [], []
    for ln in lines:
        tk = T[ln["take"]]
        a = ln.get("a", tk.first_word() if tk.first_word() is not None else TAKE_HEAD)
        b = ln.get("b", tk.last_word() if tk.last_word() is not None else tk.dur - TAKE_TAIL)
        if args.keep_retakes or not ln.get("retakes", plan.get("retakes", True)):
            exp.append(dict(ln, a=a, b=b))
            continue
        cur = a
        for e, s, text in retakes(tk.words, a, b):
            if e - cur > 0.2:
                exp.append(dict(ln, a=cur, b=e))
            dropped.append(f"{tk.label[:10]} {e:.2f}-{s:.2f} s: {text}")
            cur = s
        exp.append(dict(ln, a=cur, b=b))
    lines = exp

    # ---- the rows of each character (his props / names / mutes kept)
    def group_name(w):
        if chars.get(w, {}).get("name"):
            return chars[w]["name"]
        for rid in (f"{w}.bg", f"{w}.video", f"voice.{w}"):
            if lay.get(rid, {}).get("group"):
                return lay[rid]["group"]
        return w

    def row(rid, kind, name, group, props):
        if rid in lay:
            return dict(lay[rid], items=[])
        l = {"id": rid, "kind": kind, "name": name, "props": props, "items": []}
        if group:
            l["group"] = group
        return l

    R, SETS = {}, {}
    sub_y = [1430, 1250, 1110, 1000]
    sub_c = ["#ffffff", "#ffe7a3", "#7fd6ff", "#c9f7c0"]
    for ci, w in enumerate(order):
        c, g = chars.get(w, {}), group_name(w)
        old = [i for i in lay.get(f"{w}.bg", {}).get("items", []) if i.get("asset")]
        set_asset = c.get("set") or (old[0]["asset"] if old else None)
        set_box = c.get("setBox") or (old[0].get("box") if old else None) or {"x": -100, "y": 0, "w": 1280, "h": 1920}
        SETS[w] = (set_asset, set_box)
        has_matte = all(takes[ln["take"]].get("matte") for ln in lines if ln["who"] == w)
        vprops = {"fit": "cover", "cutout": bool(c.get("cutout", bool(set_asset) and has_matte)), "eyes": False,
                  "matte_cut": 70, "side_ramp": True, "box": c.get("box") or {"x": 0, "y": 0, "w": 1080, "h": 1920}}
        if set_asset:
            R[f"{w}.bg"] = row(f"{w}.bg", "image", f"רקע – {g}", g, {"blur": 2, "brightness": 0.96, "saturate": 0.95})
        R[f"{w}.video"] = row(f"{w}.video", "video", g, g, vprops)
        voice = {"volume": 1, "clean": "off"}
        R[f"voice.{w}"] = row(f"voice.{w}", "audio", f"קול – {g}", g, dict(voice))
        R[f"voice.{w}.2"] = row(f"voice.{w}.2", "audio", f"קול – {g} (2: הקליפ הבא - הקולות חופפים בחיתוך)", g, dict(voice))
        R[f"subs.{w}"] = row(f"subs.{w}", "subtitles", f"כתוביות – {g}", None,
                             {"style": "solo", "box": {"x": 540, "y": c.get("subY", sub_y[ci % 4]), "w": 980, "anchor": "t"},
                              "font": "font.assistant", "size": 66, "weight": 800, "color": c.get("subColor", sub_c[ci % 4]), "stroke": 10})

    speller = Speller(args.script or plan.get("script"), plan.get("fix"), {w: group_name(w) for w in order})
    n = [0]
    placed = []        # (who, take, A, B, t0, link)
    spans = []         # (who, from, to) frames - for the strip
    report = []
    t_cur = float(plan.get("start", 0))
    prev_who, prev_last_word_tl = None, None

    def place(w, take, A, B, t0):
        n[0] += 1
        lk = f"{w}.{n[0]}"
        fr, du = F(t0), F(t0 + (B - A)) - F(t0)
        tk = T[take]
        if f"{w}.bg" in R:
            R[f"{w}.bg"]["items"].append({"id": f"b{n[0]}", "from": fr, "dur": du, "asset": SETS[w][0], "box": dict(SETS[w][1]), "link": lk})
        R[f"{w}.video"]["items"].append({"id": f"p{n[0]}", "from": fr, "dur": du, "asset": take, "in": round(A, 3),
                                         "box": dict(R[f"{w}.video"]["props"].get("box") or {"x": 0, "y": 0, "w": 1080, "h": 1920}), "link": lk})
        hp, ha = handles(tk, A, B, H)
        vf = max(0, F(t0 - hp))
        ve = F(t0 + (B - A) + ha)
        mine = [i for i in R[f"{w}.video"]["items"]]
        vrow = f"voice.{w}" if len(mine) % 2 else f"voice.{w}.2"
        # the voice's own start = the picture's moment, frame-exact (the sync check below holds it to 0 ms)
        R[vrow]["items"].append({"id": f"v{n[0]}", "from": vf, "dur": ve - vf, "asset": take,
                                 "in": round(A - (fr - vf) / FPS, 3), "fade_in": 0, "fade_out": 0, "link": lk})
        placed.append((w, take, A, B, t0, lk))
        spans.append((w, fr, fr + du))
        return t0 + (B - A)

    for li, ln in enumerate(lines):
        w, take = ln["who"], ln["take"]
        tk = T[take]
        a = ln.get("a", tk.first_word() if tk.first_word() is not None else TAKE_HEAD)
        b = ln.get("b", tk.last_word() if tk.last_word() is not None else tk.dur - TAKE_TAIL)
        ps = pieces(tk, a, b, min_sil, [tuple(x) for x in ln.get("keep", [])], ln.get("cut", []))
        if prev_who is not None and w != prev_who and prev_last_word_tl is not None:
            # a turn: word to word overlap at playback speed (his 0.1 s), counted on the speech, not the clip edges
            runs = tk.runs(ps[0][0], ps[0][1])
            onset = runs[0][0] / 100 if runs else ps[0][0]
            o = ln.get("over", over) * SPEED
            t_start = max(0.0, prev_last_word_tl - o - (onset - ps[0][0]))
        else:
            t_start = t_cur
        t0 = t_start
        for A, B in ps:
            t0 = place(w, take, A, B, t0)
        # subtitles of this line
        heard = [x for x in tk.words if x[1] > a + 0.05 and (x[0] + x[1]) / 2 <= b + 0.05]
        mp = [(A, B, s) for (ww, k, A, B, s, lk) in placed if ww == w and k == take and s >= t_start - 1e-6]
        def tl(x, start):
            for A, B, s in mp:
                if A - 0.05 <= x < B + 0.05:
                    return s + min(max(x, A), B) - A
            if start:
                nx = [q for q in mp if q[0] > x]
                return nx[0][2] if nx else None
            pv = [q for q in mp if q[1] <= x]
            return pv[-1][2] + pv[-1][1] - pv[-1][0] if pv else None
        for s, e, text in chunks(speller(heard, w)):
            ts, te = tl(s, True), tl(e, False)
            if ts is None or te is None or te <= ts or not text.strip():
                continue
            lk = next((q[5] for q in placed if q[0] == w and q[1] == take and q[2] - 0.3 <= s < q[3] + 0.3), None)
            R[f"subs.{w}"]["items"].append({"id": f"s{w}{len(R[f'subs.{w}']['items'])}", "from": F(ts), "dur": max(12, F(te) - F(ts)), "text": text, "link": lk})
        runs = tk.runs(ps[-1][0], ps[-1][1])
        last_off = runs[-1][1] / 100 if runs else ps[-1][1]
        prev_last_word_tl = t0 - (ps[-1][1] - last_off)
        prev_who = w
        t_cur = max(t_cur, t0)
        report.append(f"{li + 1:>2} {w:<8} {tk.label[:14]:<14} {len(ps):>2} clips  {sum(B - A for A, B in ps):6.2f} s of {b - a:6.2f}  at {t_start:7.2f}-{t0:7.2f}")

    END = max(sp[2] for sp in spans)
    # dialogue: picture HANDLES at every turn (layers.md "What we see") - the first / last clip of a line gets up to 1 s
    # more of its take (never the take's first 0.7 s / last 0.45 s, never over the row's next clip), so a strip cut he
    # drags never runs out of picture; the strip still shows only the spoken part (spans above)
    core = {i["link"]: (i["in"], i["dur"], i["from"]) for w in order for i in R[f"{w}.video"]["items"]}   # the cut, before handles
    if dialogue:
        for w in order:
            its = sorted(R[f"{w}.video"]["items"], key=lambda i: i["from"])
            bgs = {i["link"]: i for i in R.get(f"{w}.bg", {"items": []})["items"]}
            for k, it in enumerate(its):
                tk = T[it["asset"]]
                prev_end = its[k - 1]["from"] + its[k - 1]["dur"] if k else 0
                nxt = its[k + 1]["from"] if k + 1 < len(its) else None
                head = min(F(1.0), int((it["in"] - 0.7) * FPS), it["from"] - prev_end)
                end_src = it["in"] + it["dur"] / FPS
                tail = min(F(1.0), int((tk.dur - 0.45 - end_src) * FPS), (nxt - it["from"] - it["dur"]) if nxt is not None else F(1.0))
                tail = min(tail, END - it["from"] - it["dur"])
                head, tail = max(0, head), max(0, tail)
                it["from"] -= head
                it["in"] = round(it["in"] - head / FPS, 3)
                it["dur"] += head + tail
                if it["link"] in bgs:
                    bgs[it["link"]]["from"], bgs[it["link"]]["dur"] = it["from"], it["dur"]
    # tails that would run into the next clip on the same voice row end where it begins
    for rid, l in R.items():
        if l["kind"] == "audio":
            its = sorted(l["items"], key=lambda i: i["from"])
            for x, y in zip(its, its[1:]):
                if x["from"] + x["dur"] > y["from"]:
                    x["dur"] = y["from"] - x["from"]
    # subtitles: never two on screen (also across characters), none under 0.4 s
    allsubs = sorted([(i, rid) for rid, l in R.items() if l["kind"] == "subtitles" for i in l["items"]], key=lambda x: x[0]["from"])
    for (x, _), (y, _) in zip(allsubs, allsubs[1:]):
        if x["from"] + x["dur"] > y["from"]:
            x["dur"] = max(F(0.4), y["from"] - x["from"])
            if x["from"] + x["dur"] > y["from"]:
                shift = x["from"] + x["dur"] - y["from"]
                y["from"] += shift
                y["dur"] = max(F(0.4), y["dur"] - shift)

    # ---- the strip (dialogue): who is seen - one = that one; two = whoever started last; >= 1 s a shot, never empty
    view = None
    if dialogue:
        who_at = []
        starts = sorted((fr, w) for w, fr, to in spans)
        for f in range(END):
            on = {w for w, a_, b_ in spans if a_ <= f < b_}
            if not on:
                who_at.append(who_at[-1] if who_at else order[0])
                continue
            if len(on) == 1:
                who_at.append(next(iter(on)))
                continue
            last = max(((fr, w) for fr, w in starts if fr <= f and w in on), default=(0, sorted(on)[0]))
            who_at.append(last[1])
        has = lambda w, a_, b_: all(any(s_ <= f < e_ for ww, s_, e_ in spans if ww == w) for f in range(a_, b_))
        runs_ = []
        for f, w in enumerate(who_at):
            if runs_ and runs_[-1][0] == w:
                runs_[-1][2] = f + 1
            else:
                runs_.append([w, f, f + 1])
        merged = []
        for r in runs_:
            if merged and (merged[-1][0] == r[0] or (r[2] - r[1] < FPS and has(merged[-1][0], r[1], r[2]))):
                merged[-1][2] = r[2]
            else:
                merged.append(list(r))
        # a short reaction (vova-hr: her "לא, לא שמעתי." = 0.8 s) stays on screen into the next line - we already hear
        # the next one speak while we still see her (an L-cut), as far as her clip's picture handle reaches
        pic = lambda w, a_, b_: all(any(i["from"] <= f < i["from"] + i["dur"] for i in R[f"{w}.video"]["items"]) for f in range(a_, b_))
        for k in range(len(merged) - 1):
            w, a_, b_ = merged[k]
            nxt = merged[k + 1]
            need = FPS - (b_ - a_)
            if need > 0 and nxt[2] - nxt[1] - need >= FPS and pic(w, b_, b_ + need):
                merged[k][2] += need
                nxt[1] += need
        view = row("view", "view", "What we see", None, {})
        view["items"] = [{"id": f"w{i}", "from": a_, "dur": b_ - a_, "show": f"{w}.video"} for i, (w, a_, b_) in enumerate(merged)]

    # ---- checks
    problems = []
    for rid, l in list(R.items()) + ([("view", view)] if view else []):
        its = sorted(l["items"], key=lambda i: i["from"])
        for x, y in zip(its, its[1:]):
            if x["from"] + x["dur"] > y["from"]:
                problems.append(f"overlap on {rid}: {x['id']} / {y['id']}")
    pics = {i["link"]: i for w in order for i in R[f"{w}.video"]["items"]}
    sync_bad = []
    for w in order:
        for rid in (f"voice.{w}", f"voice.{w}.2"):
            for v in R[rid]["items"]:
                pv = pics[v["link"]]
                off = (v["in"] - v["from"] / FPS) - (pv["in"] - pv["from"] / FPS)
                if not -0.040 <= off <= 0.002:      # (+2 ms = rounding to the millisecond)
                    sync_bad.append((v["link"], round(off * 1000)))
                if v["dur"] <= 0:
                    problems.append(f"empty voice clip {v['id']}")
    if sync_bad:
        problems.append(f"voice out of sync with its picture (ms): {sync_bad}")
    if not dialogue:
        vids = sorted(R[f"{order[0]}.video"]["items"], key=lambda i: i["from"])
        problems += [f"gap in the picture {x['id']} -> {y['id']}" for x, y in zip(vids, vids[1:]) if x["from"] + x["dur"] != y["from"]]
    else:
        for f in range(END):
            w = next((i["show"] for i in view["items"] if i["from"] <= f < i["from"] + i["dur"]), None)
            if not w or not any(i["from"] <= f < i["from"] + i["dur"] for i in R[w]["items"]):
                problems.append(f"the strip shows no picture at {f / FPS:.2f} s")
                break
        short = [(round(i["from"] / FPS, 2), round(i["dur"] / FPS, 2)) for i in view["items"][:-1] if i["dur"] < FPS]
        if short:
            problems.append(f"shots under 1 s (s, length): {short}")
    left = []
    for w in order:
        for i in R[f"{w}.video"]["items"]:
            tk = T[i["asset"]]
            c_in, c_dur, c_from = core[i["link"]]
            a0, a1 = int(c_in * 100) + 10, int((c_in + c_dur / FPS) * 100) - 10
            run = 0
            for j, q in enumerate(tk.d[a0:a1] < tk.QUIET):
                run = run + 1 if q else 0
                if run == 40:
                    left.append(round(c_from / FPS + (j - 39 + 10) / 100, 2))
    clips = [i for w in order for i in R[f"{w}.video"]["items"]]
    lens = sorted(i["dur"] / FPS for i in clips)

    # ---- write
    ops = [{"op": "project", "set": {"duration": END}}]   # ends on the last frame of the last clip
    first_other = next((i for i, l in enumerate(p["layers"]) if l["id"] not in R and l["id"] != "view"), len(p["layers"]))
    idx = first_other
    for w in order:
        for rid in (f"{w}.bg", f"{w}.video"):
            if rid not in R:
                continue
            if rid in lay:
                ops.append({"op": "layer.replace", "layer": R[rid]})
            else:
                ops.append({"op": "layer.add", "index": idx, "layer": R[rid]})
                idx += 1
    for w in order:
        rid = f"subs.{w}"
        ops.append({"op": "layer.replace", "layer": R[rid]} if rid in lay else {"op": "layer.add", "index": idx, "layer": R[rid]})
        idx += rid not in lay
    for w in order:
        for rid in (f"voice.{w}", f"voice.{w}.2"):
            ops.append({"op": "layer.replace", "layer": R[rid]} if rid in lay else {"op": "layer.add", "layer": R[rid]})
    if view:
        ops.append({"op": "layer.replace", "layer": view} if "view" in lay else {"op": "layer.add", "layer": view})
        ops.append({"op": "project", "set": {"edit": dict(p.get("edit") or {}, ripple=False)}})   # nothing pushes
    # the order (first = drawn lowest): each character's group together - set, picture, voices; then the rows that were
    # there (texts, an end card, sfx, music) in their order, above the subtitles (an end card covers them); the strip last
    mine = [rid for w in order for rid in (f"{w}.bg", f"{w}.video", f"voice.{w}", f"voice.{w}.2") if rid in R]
    others = [l["id"] for l in p["layers"] if l["id"] not in R and l["id"] != "view"]
    want = mine + [f"subs.{w}" for w in order] + others + (["view"] if view else [])
    ops += [{"op": "layer.move", "id": rid, "index": i} for i, rid in enumerate(want)]

    out_dir = os.path.join(ROOT, "episodes", ep, "work", "fastcut")
    os.makedirs(out_dir, exist_ok=True)
    json.dump(ops, open(os.path.join(out_dir, "ops.json"), "w", encoding="utf-8"), ensure_ascii=False)
    json.dump({"lines": lines, "clips": [(i["id"], i["asset"], i["in"], round(i["from"] / FPS, 2), round(i["dur"] / FPS, 2)) for i in clips]},
              open(os.path.join(out_dir, "last-cut.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)

    print("\n".join(report))
    print(f"{'dialogue' if dialogue else 'monologue'}: {len(clips)} clips, {END / FPS:.2f} s on the timeline = {END / FPS / SPEED:.1f} s at {SPEED}x;"
          f" clip length median {lens[len(lens) // 2]:.2f} s, shortest {lens[0]:.2f} s; {sum(len(R[f'subs.{w}']['items']) for w in order)} subtitles"
          + (f"; {len(view['items'])} shots on the strip" if view else ""))
    print("retakes out (the earlier attempt, take seconds):", ("\n  " + "\n  ".join(dropped)) if dropped else "none")
    print("pauses >= 0.4 s left inside clips (timeline s):", left or "none")
    print("problems:", problems or "none")
    if problems:
        sys.exit("not written - fix the problems first")
    if not args.go:
        print("dry run - nothing written (add --go)")
        return
    busy = req("GET", "/api/jobs").get("busy") or []
    if any((b.get("id") if isinstance(b, dict) else b) == ep for b in busy):
        sys.exit(f"{ep} is busy (an export / a build) - not written")
    r = req("POST", f"/api/p/{ep}/ops", {"rev": p["rev"], "ops": ops})
    print({k: v for k, v in r.items() if k in ("ok", "rev", "error", "problems")})


if __name__ == "__main__":
    main()
