"""EXAMPLE - a monologue to camera from his takes (demokratovich-chanuka, 2026-11-16; round 2 = his notes fixed). Copy it to
your scratchpad, change CUT / FIX / the stickers; needs db10.json + tx/<take>.json (faster-whisper words) + chanuka.txt.
demokratovich-chanuka from his 10 takes (2026-11-16) - adapted from recipes/call-from-takes.example.py (haredit-6):
grouped clips (picture + set + voice + subtitles, one link), the picture cut tight on the loud speech, every silence out,
the voices overlapping each cut (left voice ~0.25 s longer, right voice ~0.3 s earlier) on two alternating voice rows.
Usage: build.py [--dry]"""
import json, os, re, sys, urllib.request, difflib
import numpy as np

ROOT = r"c:/workspace/BoostMind/zoomcut"
EP, SRC = "demokratovich-chanuka", "_demokratovich-chanuka-takes"
API = "http://127.0.0.1:4747"
SCR = os.path.dirname(os.path.abspath(__file__))
FPS = 30
F = lambda s: int(round(s * FPS))
DRY = "--dry" in sys.argv
DB = json.load(open(os.path.join(SCR, "db10.json")))
W = {}
for k, v in DB.items():
    ws = json.load(open(os.path.join(SCR, "tx", k + ".json"), encoding="utf-8"))
    W[k] = {"words": [[w["a"], w["b"], w["w"]] for w in ws], "db10": v["db10"], "dur": v["dur"]}

# ---- the cut: (take, a, b, keep) in take seconds; a passage said twice = the later take
def first(k): return W[k]["words"][0][0]
def last(k): return W[k]["words"][-1][1]
def word_end(k, w, nth=1):
    c = 0
    for s, e, x in W[k]["words"]:
        if w in x:
            c += 1
            if c == nth: return e
    raise KeyError((k, w))
def word_start(k, w, nth=1):
    c = 0
    for s, e, x in W[k]["words"]:
        if w in x:
            c += 1
            if c == nth: return s
    raise KeyError((k, w))

OPEN_AT = 4.5   # his silent acting before the first word (tissue at the eyes, head scratch) - kept as the opening
CUT = [
    ("BCDB45DE", first("BCDB45DE"), last("BCDB45DE"), []),
    ("2E62460D", first("2E62460D"), last("2E62460D"), []),
    ("ACD87F84", first("ACD87F84"), last("ACD87F84"), []),
    ("6190BD21", first("6190BD21"), last("6190BD21"), []),
    ("F19189B4", first("F19189B4"), word_end("F19189B4", "AI"), []),       # its "ועוד אמרו חכמינו בעקבות ה..." = redone next take
    ("D54CADA8", first("D54CADA8"), last("D54CADA8"), []),
    ("17A96C14", first("17A96C14"), last("17A96C14"), []),
    ("EA6C2B7E", first("EA6C2B7E"), word_end("EA6C2B7E", "העליון"), []),  # "ורבים רבים מתיימנים" = the next take's
    ("26A4E0D0", first("26A4E0D0"), last("26A4E0D0"), []),
    ("2208E977", first("2208E977"), last("2208E977"), []),
]
PAD_IN = 0.08
MIN_PIECE = 0.35   # round 2: 0.8 merged short phrases back over their pause - two silences he marked
TAKE_HEAD, TAKE_TAIL = 0.45, 0.35

# ---- subtitles: his words, spelled as the script (mishears fixed, then aligned to the script's words)
FIX = {"רבויסטיין,": "רבותיי,", "אסתר,": "הסתר.", "אסתר": "הסתר", "המסיח,": "המשיח,", "המסיח": "המשיח", "מסיחים,": "משיחים!",
       "מסיחים": "משיחים", "מסיח": "משיח", "הקלות,": "הקלוד,", "הקלות": "הקלוד", "כסלב": "כסלו", "נהדרת,": "נעדרת!",
       "נהדרת": "נעדרת", "מיד": "ביד", "רבויסאי,": "רבותיי,", "קודשנו,": "קודשינו —", "דה": "דעו", "הונא": "נא,"}
SEQ = {
    "2E62460D": [(["הצ", "'ט"], ["הצ׳אט,"]), (["הצ", "'ט,"], ["הצ׳אט,"])],
    "17A96C14": [(["איי", "-איי"], ["AI!"])],
    "F19189B4": [(["ה", "-AI"], ["ה־AI!"])],
    "6190BD21": [(["רבו", "ישראל"], ["רבותיי,"])],
    "ACD87F84": [(["רבו", "ישראל,"], ["רבותיי,"])],
}
SCRIPT = [re.sub(r"^\S+:\s*", "", l) for l in open(os.path.join(SCR, "chanuka.txt"), encoding="utf-8").read().splitlines()
          if l.strip() and not l.startswith("#") and not l.startswith("(")]
STOK = " ".join(SCRIPT).split()
norm = lambda w: re.sub(r"[^\u05d0-\u05eaA-Za-z0-9]", "", w).replace("ך", "כ").replace("ם", "מ").replace("ן", "נ").replace("ף", "פ").replace("ץ", "צ")


def heard(take, a, b):
    ws = [[s, e, w] for s, e, w in W[take]["words"] if e > a + 0.05 and (s + e) / 2 <= b + 0.05]
    for h, sd in SEQ.get(take, []):
        i = 0
        while i <= len(ws) - len(h):
            if [x[2] for x in ws[i:i + len(h)]] == h:
                s0, e0 = ws[i][0], ws[i + len(h) - 1][1]
                st = [s0 + (e0 - s0) * q / len(sd) for q in range(len(sd) + 1)]
                ws[i:i + len(h)] = [[st[q], st[q + 1], sd[q]] for q in range(len(sd))]
                i += len(sd)
            else: i += 1
    return [[s, e, FIX.get(w, w)] for s, e, w in ws]


ptr = [0]
def said(take, a, b):
    """heard words -> the script's spelling and punctuation where they match (an ad-lib keeps his words)"""
    hw = heard(take, a, b)
    lo, hi = max(0, ptr[0] - 8), min(len(STOK), ptr[0] + len(hw) + 40)
    win = STOK[lo:hi]
    sm = difflib.SequenceMatcher(None, [norm(x[2]) for x in hw], [norm(x) for x in win], autojunk=False)
    out, end = [], ptr[0]
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            out += [[hw[i1 + q][0], hw[i1 + q][1], win[j1 + q]] for q in range(i2 - i1)]
            end = lo + j2
        elif op == "replace":
            s0, e0 = hw[i1][0], hw[i2 - 1][1]
            n = j2 - j1
            if n <= 2 * (i2 - i1) + 1:
                st = [s0 + (e0 - s0) * q / n for q in range(n + 1)]
                out += [[st[q], st[q + 1], win[j1 + q]] for q in range(n)]
                end = lo + j2
            else:
                out += hw[i1:i2]
        elif op == "delete":
            out += hw[i1:i2]
    ptr[0] = end
    return out


def chunks(ws):
    out, cur = [], []
    for w in ws:
        cur.append(w)
        t = w[2]
        if re.search(r"[.?!…:]$", t) or (re.search(r"[,—]$", t) and len(cur) >= 3) or len(cur) == 4:
            out.append(cur); cur = []
    if cur: out.append(cur)
    j = []
    for c in out:
        if j and len(c) <= 2 and not re.search(r"[.?!…]$", j[-1][-1][2]) and len(j[-1]) + len(c) <= 6:
            j[-1] = j[-1] + c
        else: j.append(c)
    return [(c[0][0], c[-1][1], " ".join(x[2] for x in c).rstrip(",").rstrip(" —")) for c in j]


def pieces(take, a, b, keep=()):
    """(the haredit-6 method, unchanged) the spoken spans of [a, b]: pauses between LOUD runs at word boundaries cut out,
    edges walked out over the soft onset / decaying tail so no word loses its start or end; cuts saving < 0.12 s not made"""
    t = W[take]
    d = np.array(t["db10"]); p95 = np.percentile(d, 95); noise = np.percentile(d, 10)
    LOUD, SOFT = p95 - 22, max(noise + 6, p95 - 36)
    lo, hi = max(TAKE_HEAD, a - 0.1), min(t["dur"] - TAKE_TAIL, b + 0.3)
    i0, i1 = int(a * 100), min(len(d), int(b * 100))
    loud = d[i0:i1] > LOUD
    runs, j, n = [], 0, len(loud)
    while j < n:
        if loud[j]:
            k = j
            while k < n and loud[k]: k += 1
            runs.append([i0 + j, i0 + k]); j = k
        else: j += 1
    m = []
    for r in runs:
        if m and r[0] - m[-1][1] < 8: m[-1][1] = r[1]
        else: m.append(r)
    runs = [r for r in m if r[1] - r[0] >= 3]
    # his record / stop tap: a blip under 0.15 s cut off from the speech by >= 0.3 s of quiet (round 2 note: "you see me
    # starting the recording" - the tap at 0.75 s of 2E62460D started the piece 0.6 s early)
    while len(runs) > 1 and runs[0][1] - runs[0][0] < 15 and runs[1][0] - runs[0][1] >= 30: runs.pop(0)
    while len(runs) > 1 and runs[-1][1] - runs[-1][0] < 15 and runs[-1][0] - runs[-2][1] >= 30: runs.pop()
    if not runs:
        return [(round(max(lo, a), 3), round(min(hi, b), 3))]
    def back(i, limit):
        j = i
        while j - 1 >= int(limit * 100) and i - (j - 1) <= 8 and d[j - 1] > SOFT: j -= 1
        return max(limit, j / 100 - 0.01)
    def fwd(i, limit):
        j = i
        while j < int(limit * 100) and j - i < 15 and d[j] > max(SOFT, p95 - 27): j += 1
        return min(limit, j / 100 + 0.01)
    words = t["words"]
    bounds = [(words[q][1] + words[q + 1][0]) / 2 for q in range(len(words) - 1)] + [w[1] for w in words] + [w[0] for w in words]
    in_keep = lambda x0, x1: any(x1 > ka and x0 < kb for ka, kb in keep)
    out = [[back(runs[0][0], lo), None]]
    for r1, r2 in zip(runs, runs[1:]):
        g0, g1 = r1[1] / 100, r2[0] / 100
        qr = (d[r1[1]:r2[0]] < p95 - 30).sum() / 100      # a real silence (>= 0.2 s under speech) is a word boundary itself
        if g1 - g0 >= 0.18 and not in_keep(g0, g1) and (any(g0 - 0.06 <= x <= g1 + 0.06 for x in bounds) or qr >= 0.2):
            tail = fwd(r1[1], g1); head = back(r2[0], tail)
            if head - tail >= 0.12:
                out[-1][1] = tail; out.append([head, None]); continue
    out[-1][1] = fwd(runs[-1][1], hi)
    for ka, kb in keep:
        for o in out:
            if o[0] <= kb and o[1] >= ka - 0.4: o[0], o[1] = min(o[0], max(lo, ka)), max(o[1], min(hi, kb))
    k = 0
    while len(out) > 1 and k < len(out):
        if out[k][1] - out[k][0] < MIN_PIECE:
            if k == 0: out[0:2] = [[out[0][0], out[1][1]]]
            elif k == len(out) - 1: out[k - 1:k + 1] = [[out[k - 1][0], out[k][1]]]
            else:
                gp, gn = out[k][0] - out[k - 1][1], out[k + 1][0] - out[k][1]
                if gp <= gn: out[k - 1:k + 1] = [[out[k - 1][0], out[k][1]]]
                else: out[k:k + 2] = [[out[k][0], out[k + 1][1]]]
            k = 0; continue
        k += 1
    return [(round(x, 3), round(y, 3)) for x, y in out]


VOICE_PRE, VOICE_POST = 0.3, 0.25
def handles(take, A, B):
    t = W[take]; d = np.array(t["db10"]); LOUD = np.percentile(d, 95) - 22
    j = int(A * 100) - 3
    while j > int((A - VOICE_PRE) * 100) and d[j] <= LOUD: j -= 1
    pre = A - max(0.3, (j + 5) / 100 if d[j] > LOUD else A - VOICE_PRE)
    j = int(B * 100) + 3
    while j < min(len(d) - 1, int((B + VOICE_POST) * 100)) and d[j] <= LOUD: j += 1
    post = min(t["dur"] - 0.25, (j - 5) / 100 if d[j] > LOUD else B + VOICE_POST) - B
    return max(0.0, round(pre, 3)), max(0.0, round(post, 3))


def req(method, url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(API + url, data=data, method=method, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(r) as f:
        return json.loads(f.read().decode())


# ---- read, link the take files
proj = lambda j: j.get("project", j)
src = proj(req("GET", f"/api/p/{SRC}"))
p = proj(req("GET", f"/api/p/{EP}"))
lay = {l["id"]: l for l in p["layers"]}
takes = {k: v for k, v in src["assets"].items() if v.get("kind") == "video" and k.startswith("t.")}
tid = lambda k: next(x for x in takes if x[2:10] == k[:8])
for k, a in takes.items():
    for f in ("audio", "preview", "fg", "matte"):
        if a.get(f):
            s, d = os.path.join(ROOT, "episodes", SRC, a[f]), os.path.join(ROOT, "episodes", EP, a[f])
            os.makedirs(os.path.dirname(d), exist_ok=True)
            if not os.path.exists(d) and not DRY: os.link(s, d)
ops = []
for k, a in takes.items():
    have = p["assets"].get(k, {})
    ops.append({"op": "asset.add", "id": k, "asset": {**a, **{x: have[x] for x in ("mark", "note") if x in have}}})

# ---- the rows
NECH = {l["id"]: l for l in json.load(open(os.path.join(ROOT, "episodes", "demokratovich-nechama", "project.json"), encoding="utf-8"))["layers"]}
VBOX = {"x": 0, "y": 330, "w": 1080, "h": 1920}       # his head sits high in these takes: under the plaque and Eisenkot
VPROPS = dict(NECH["person"]["props"], box=dict(VBOX))
VOICE = dict(NECH["voice"]["props"])                 # what he left on the rabbi's last sermon
SET = "m.set-preview.jpg"
SETBOX = {"x": -100, "y": 0, "w": 1280, "h": 1920}
def row(id, kind, name, group=None, props=None):
    l = {"id": id, "kind": kind, "name": name, "props": props or {}, "items": []}
    if group: l["group"] = group
    return l
R = {
    "dem.bg": row("dem.bg", "image", "רקע – בית המשפט הקטן (חנוכה)", "הרב", {"blur": 0}),
    "dem.video": row("dem.video", "video", "הרב דמוקרטוביץ", "הרב", VPROPS),
    "voice": row("voice", "audio", "קול – הרב", "הרב", dict(VOICE)),
    "voice.2": row("voice.2", "audio", "קול – הרב (2: הקליפ הבא - הקולות חופפים בחיתוך)", "הרב", dict(VOICE)),
    "subs": row("subs", "subtitles", "כתוביות", None, dict(NECH["subs"]["props"])),
}
for k in R:   # what he set on this project's rows, if he already touched them
    if k in lay: R[k]["props"] = {**R[k]["props"], **lay[k].get("props", {})}

T = 0.0
n = [0]
placed = []
tlmap = []   # (take, A, B, t0) for every piece - take second -> timeline
def link():
    n[0] += 1
    return f"g{n[0]}"

def piece(take, A, B, t0):
    lk = link()
    fr, du = F(t0), F(t0 + (B - A)) - F(t0)
    R["dem.bg"]["items"].append({"id": f"b{n[0]}", "from": fr, "dur": du, "asset": SET, "box": dict(SETBOX), "link": lk})
    R["dem.video"]["items"].append({"id": f"p{n[0]}", "from": fr, "dur": du, "asset": tid(take), "in": round(A, 3), "box": dict(VBOX), "link": lk})
    hp, ha = handles(take, A, B)
    hp = min(hp, t0)
    vrow = "voice" if len(R["dem.video"]["items"]) % 2 else "voice.2"
    R[vrow]["items"].append({"id": f"v{n[0]}", "from": F(t0 - hp), "dur": F(t0 + (B - A) + ha) - F(t0 - hp), "asset": tid(take),
                             "in": round(A - hp, 3), "fade_in": 0.01, "fade_out": 0.01, "link": lk})
    placed.append((A, B, t0, lk)); tlmap.append((take, A, B, t0))
    return t0 + (B - A)

def entry_subs(take, a, b):
    def at(x, start):
        for A, B, t0, lk in placed:
            if A - (0.3 if start else 0) <= x < B + (0 if start else 0.3):
                return t0 + min(max(x, A), B) - A, lk
        if start:
            nx = [q for q in placed if q[0] > x]
            return (nx[0][2], nx[0][3]) if nx else (None, None)
        pv = [q for q in placed if q[1] <= x]
        return (pv[-1][2] + pv[-1][1] - pv[-1][0], pv[-1][3]) if pv else (None, None)
    for s, e, text in chunks(said(take, a, b)):
        ts, lk = at(s, True); te, _ = at(e, False)
        if ts is None or te is None or te <= ts: continue
        R["subs"]["items"].append({"id": f"s{len(R['subs']['items'])}", "from": F(ts), "dur": max(12, F(te) - F(ts)), "text": text, "link": lk})
    placed.clear()

report = []
for take, a, b, keep in CUT:
    ps = pieces(take, a, b, keep)
    if take == "BCDB45DE":   # the acted opening: its first piece starts at OPEN_AT
        ps[0] = (OPEN_AT, ps[0][1])
    t_start = T
    for x, y in ps:
        T = piece(take, x, y, T)
    entry_subs(take, a, b)
    report.append(f"{take}  {len(ps)} pieces  {round(sum(y - x for x, y in ps), 2)} s of {round(b - a, 2)}  -> {round(t_start, 2)}-{round(T, 2)}")

for vr in ("voice", "voice.2"):   # a tail that would run into the next clip on its own row ends where that one begins
    its = sorted(R[vr]["items"], key=lambda i: i["from"])
    for x, y in zip(its, its[1:]):
        if x["from"] + x["dur"] > y["from"]: x["dur"] = y["from"] - x["from"]

def tl(take, t):
    """a take second -> the timeline second (the piece it falls in, or the next one)"""
    best = None
    for k, A, B, t0 in tlmap:
        if k != take: continue
        if A <= t <= B: return t0 + t - A
        if t < A and best is None: best = t0
    if best is not None: return best
    xs = [t0 + B - A for k, A, B, t0 in tlmap if k == take]
    return xs[-1]

LAST_WORD = take_last_t = max(t0 + B - A for k, A, B, t0 in tlmap)   # the end of the last piece = his last word's tail
END = LAST_WORD + 4.0
DUR = F(END)

# ---- his pictures on his words
def pop(d):
    return {"scale": [[0, 0.3], [0.12, 1.07], [0.3, 1], [max(0.31, d - 0.18), 1], [d, 0.3]],
            "opacity": [[max(0.31, d - 0.18), 1], [d, 0]]}
def span(item, a, b):
    d = round(b - a, 3)
    it = {k: v for k, v in item.items() if k not in ("anim",)}
    it.update({"from": F(a), "dur": F(b) - F(a)})
    if "anim" in item: it["anim"] = pop(d)
    return it
ST = {i["id"]: i for i in lay["st"]["items"]}
SC = {i["id"]: i for i in lay["scroll"]["items"]}
TX = {i["id"]: i for i in lay["scroll.tx"]["items"]}
w = lambda k, x, nth=1: tl(k, word_start(k, x, nth))
we = lambda k, x, nth=1: tl(k, word_end(k, x, nth))
take_end = lambda k: max(t0 + B - A for kk, A, B, t0 in tlmap if kk == k)
STICK = {
    "st1": (w("BCDB45DE", "אסתר", 2), we("BCDB45DE", "מאיתנו") + 0.3),
    "st2": (w("2E62460D", "שהרי"), take_end("2E62460D")),
    "st3": (w("ACD87F84", "תחיית"), take_end("ACD87F84")),
    "st4": (w("6190BD21", "ואכן"), take_end("6190BD21")),
    "st5": (w("17A96C14", "הקול"), we("17A96C14", "-איי") + 0.3),
    "st6": (w("17A96C14", "חודש"), take_end("17A96C14")),
    "st7": (w("EA6C2B7E", "וכשם"), take_end("EA6C2B7E")),
    "st8": (w("26A4E0D0", "ורבים"), we("26A4E0D0", "הפחות") + 0.5),
    "st9": (w("26A4E0D0", "וכשם"), take_end("26A4E0D0")),
    "st10": (w("2208E977", "שהרי"), we("2208E977", "ושמונה") + 0.3),
}
SCROLL = {
    "sc0": (w("2E62460D", "משיח"), we("2E62460D", "שיחה") + 0.6),
    "sc1": (w("6190BD21", "ומלאה"), we("6190BD21", "מכסים") + 0.3),
    "sc2": (w("F19189B4", "מים"), take_end("F19189B4")),
    "sc3": (w("D54CADA8", "בעקבתא"), take_end("D54CADA8")),
    "sc4": (w("17A96C14", "הקול"), we("17A96C14", "-איי") + 0.3),
}
END_AT = LAST_WORD   # round 2: "you put the end in too early, really too early" - on the last word, not during the line
items = {
    "st": [span(ST[k], a, b) for k, (a, b) in STICK.items()],
    "scroll": [span(SC[k], a, b) for k, (a, b) in SCROLL.items()],
    "scroll.tx": [span(TX["sct" + k[2:]], a, b) for k, (a, b) in SCROLL.items()],
    "hook": [dict(lay["hook"]["items"][0], **{"from": 0, "dur": F(w("2E62460D", "משיח"))})],
    "ticker": [dict(lay["ticker"]["items"][0], **{"from": 0, "dur": F(END_AT)})],
    "endcard": [dict(lay["endcard"]["items"][0], **{"from": F(END_AT), "dur": DUR - F(END_AT), "fade_in": 0.6})],
}
# music (round 2: "use the niggun Modzitz, it's better") - the Modzitz on the main row, glued as on nechama (its own
# tail fades at 84 s: a second item 1 s earlier, back into its theme at 20 s); the clarinet on the muted row
MZ_END = 84.0
mus = [{"id": "mu0", "from": 0, "dur": min(DUR, F(MZ_END - 1.6)), "asset": "s.niggun-modzitz.mp3", "in": 1.6, "fade_in": 0.4,
        "fade_out": 1.0 if DUR > F(MZ_END - 1.6) else 2.5}]
if DUR > F(MZ_END - 1.6):
    st2 = F(MZ_END - 1.6) - F(1.0)
    mus.append({"id": "mu1", "from": st2, "dur": DUR - st2, "asset": "s.niggun-modzitz.mp3", "in": 20.0, "fade_in": 1.0, "fade_out": 2.5})
items["music"] = mus
BED = 82.72
alt = [{"id": "cl0", "from": 0, "dur": min(DUR, F(BED)), "asset": "s.clarinet-bed.wav", "in": 0, "fade_in": 0.4, "fade_out": 0 if DUR > F(BED) else 2.5}]
if DUR > F(BED):
    alt.append({"id": "cl1", "from": F(BED), "dur": DUR - F(BED), "asset": "s.clarinet-bed.wav", "in": 23.6, "fade_in": 0.01, "fade_out": 2.5})
items["music.alt"] = alt

# ---- the stickers where they don't cover him (round 2: "put the images in a place not covering the rabbi"; the grandpa
# at the right, y 560, was "placed very well" - kept exactly): his cut-out (the matte) over each sticker's time, mapped
# onto the canvas, and the spot beside / above him that it covers least
import subprocess
MS = 10   # canvas cells of 10 px
def person_mask(a, b):
    m = np.zeros((192, 108), bool)
    for t in np.arange(a, b, 0.4):
        it = next((i for i in R["dem.video"]["items"] if i["from"] <= F(t) < i["from"] + i["dur"]), None)
        if not it: continue
        src = it["in"] + (F(t) - it["from"]) / FPS
        mat = os.path.join(ROOT, "episodes", EP, takes[it["asset"]]["matte"])
        raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{src:.2f}", "-i", mat, "-frames:v", "1", "-vf", "scale=72:128",
                              "-pix_fmt", "gray", "-f", "rawvideo", "-"], capture_output=True).stdout
        if len(raw) < 72 * 128: continue
        g = np.frombuffer(raw[:72 * 128], np.uint8).reshape(128, 72) > 100
        bx = VBOX   # 720x1280 -> box (x, y, w, h) on the canvas
        ys, xs = np.nonzero(g)
        cy = ((bx["y"] + ys / 128 * bx["h"]) / MS).astype(int); cx = ((bx["x"] + xs / 72 * bx["w"]) / MS).astype(int)
        ok = (cy >= 0) & (cy < 192) & (cx >= 0) & (cx < 108)
        m[cy[ok], cx[ok]] = True
    from numpy.lib.stride_tricks import sliding_window_view   # (a margin of 20 px around him)
    pad = np.pad(m, 2)
    return sliding_window_view(pad, (5, 5)).any(axis=(2, 3))
def place(it, a, b, blocked):
    if it["id"] == "st3":
        return dict(it["box"], x=735, y=560, w=340, h=round(340 * it["box"]["h"] / it["box"]["w"]))
    m = person_mask(a, b)
    best = None
    for w_ in (340, 300, 260, 220):
        h_ = round(w_ * it["box"]["h"] / it["box"]["w"])
        for x in list(range(10, 1080 - w_ - 10 + 1, 30)):
            for y in range(250, 1430 - h_, 20):
                if any(x < bx1 and x + w_ > bx0 and y < by1 and y + h_ > by0 for bx0, by0, bx1, by1 in blocked): continue
                cover = m[y // MS:(y + h_) // MS, x // MS:(x + w_) // MS].mean()
                plaque = 1 if (y < 520 and x + w_ > 360 and x < 1050) else 0      # the plaque + Eisenkot stay clear
                score = cover * 10 + plaque * 0.5 + abs(y - 560) / 4000 + (340 - w_) / 2000
                if best is None or score < best[0]: best = (score, x, y, w_, h_, cover)
    _, x, y, w_, h_, cover = best
    print(f"  {it['id']}: x {x} y {y} w {w_}  covers him {cover:.0%}")
    return dict(it["box"], x=x, y=y, w=w_, h=h_)
sc_spans = [(F(a), F(b)) for a, b in SCROLL.values()]
for it in items["st"]:
    a, b = it["from"] / FPS, (it["from"] + it["dur"]) / FPS
    hook_on = it["from"] < items["hook"][0]["dur"]
    scroll_on = any(it["from"] < s1 and it["from"] + it["dur"] > s0 for s0, s1 in sc_spans)
    blocked = ([(70, 640, 1010, 840)] if hook_on else []) + ([(80, 240, 1000, 700)] if scroll_on else [])   # the hook / the scroll
    it["box"] = place(it, a, b, blocked)

# ---- silences left inside a piece (>= 0.2 s quiet at speech level) - the report he would otherwise mark
left = []
for i in R["dem.video"]["items"]:
    k = i["asset"][2:10]; d = np.array(W[k]["db10"]); thr = np.percentile(d, 95) - 30
    a0, a1 = int(i["in"] * 100) + 10, int((i["in"] + i["dur"] / FPS) * 100) - 10
    q = d[a0:a1] < thr; run = 0
    for j, v in enumerate(q):
        run = run + 1 if v else 0
        if run == 20: left.append((k, round((a0 + j - 19) / 100, 2), round(i["from"] / FPS + (a0 + j - 19) / 100 - i["in"], 2)))
print("silences >= 0.2 s left inside pieces (take, take s, timeline s):", left)

# ---- write: the new rows at the bottom, the old preview set out, every overlay row re-timed
ops.append({"op": "project", "set": {"duration": DUR}})
for k in ("pre.set", "dem.bg", "dem.video", "voice", "voice.2", "subs"):
    if k in lay: ops.append({"op": "layer.remove", "id": k})
for i, k in enumerate(("dem.bg", "dem.video", "voice", "voice.2")):
    ops.append({"op": "layer.add", "index": i, "layer": R[k]})
order_after = ["st", "scroll", "scroll.tx", "hook", "ticker"]
ops.append({"op": "layer.add", "index": 4 + len(order_after), "layer": R["subs"]})   # under the end card
for lid, its in items.items():
    for it in lay[lid]["items"]:
        ops.append({"op": "item.remove", "layer": lid, "id": it["id"]})
    for it in its:
        ops.append({"op": "item.add", "layer": lid, "item": it})
ops.append({"op": "layer.update", "id": "music", "props": {"volume": 0.141, "clean": "off", "lift": {"db": 8, "fade": 1.2, "of": "subs"}},
            "set": {"name": "מוזיקה – ניגון מודז׳יץ", "muted": False}})
ops.append({"op": "layer.update", "id": "music.alt", "props": {"volume": 0.22, "clean": "off"},
            "set": {"name": "מוזיקה – קלרינט עצוב (חלופה)", "muted": True}})

print("\n".join(report))
print(f"length {round(END, 2)} s at 1x ({round(END / 1.2, 1)} s at 1.2x), {len(R['dem.video']['items'])} pieces, {len(R['subs']['items'])} subtitles")
json.dump({"subs": [(round(i["from"] / FPS, 2), i["text"]) for i in R["subs"]["items"]]}, open(os.path.join(SCR, "subs.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
json.dump(ops, open(os.path.join(SCR, "ops.json"), "w", encoding="utf-8"), ensure_ascii=False)
if not DRY:
    r = req("POST", f"/api/p/{EP}/ops", {"rev": p["rev"], "ops": ops})
    print(r)
