"""EXAMPLE (haredit-6, 2026-11-15 - he called the result "perfect") - a builder for recipes/dialogue-from-takes.md
"A phone call": one character on screen, the caller full screen OR in a small window over her. Copy it to your
scratchpad and change the lists (SEC1 / CALL / SEC3, MOM_SUBS, the sets); it writes ops to the running studio. It is
not a tool and not run from here. Its word timings JSON (h6-words.json / m6-words.json: per take {words, db10 = dB per
10 ms, dur}) is made first by a faster-whisper pass (see the recipe). After he starts editing, never rerun it - use the
targeted cut() at the end of this file (the round-3 fixes).

haredit-6 from his takes (2026-11-15): Hani's monologue to Dasi + her mother's call from the ward + 16:00.
Every piece a group (video + background + Hani's wall pictures + voice + subtitles, one link). Silences cut at word
boundaries (his ask: "cut fast, don't leave quiet stuff"); a passage said twice = the later take. The call: the
mother full screen (her voice in the room, Hani's through the phone) or in the small window over Hani's listening
face (her voice through the phone) - the "What we see" strip decides, the PiP rows follow it.
Usage: build6c.py [--dry]"""
import json, os, re, sys, urllib.request
import numpy as np

ROOT = r"c:/workspace/BoostMind/zoomcut"
EP, SRC = "haredit-6", "_haredit-6-takes"
API = "http://127.0.0.1:4747"
SCR = os.path.dirname(os.path.abspath(__file__))
FPS = 30
F = lambda s: int(round(s * FPS))
W = json.load(open(os.path.join(SCR, "h6-words.json"), encoding="utf-8"))
W.update(json.load(open(os.path.join(SCR, "m6-words.json"), encoding="utf-8")))
DRY = "--dry" in sys.argv

# ---------------------------------------------------------------- the cut (take seconds)
# Hani: (take, a, b, set, keep) - keep = stretches where silences stay (acted beats)
SEC1 = [
    ("775B6FF4", 1.55, 10.95, "cubw", []),       # בוקר טוב ... ניסים גלויים ממש  (she arrives at her cubicle, standing)
    ("466C0DDD", 0.80, 6.70, "cub", []),         # אבא שלי נפל ...
    ("D1B76647", 0.62, 6.74, "cub", []),         # אבל תקשיבי ... תארי לך באמצע שבוע
    ("26457B32", 0.96, 8.95, "cub", []),         # (the later take) עם כל האוטובוסים ... נס בתוך נס
    ("8DC74AEA", 0.78, 7.95, "cub", []),         # אברהם משה שאל רב ...
    ("4F919B01", 0.78, 7.30, "cub", []),         # כל ליל שבת ...
    ("33747E31", 0.80, 12.65, "cub", []),        # מתנדבים ... לחמנייה אחת
    ("6EE45D85", 0.75, 5.70, "cub", []),         # רֶבּ שמוליק
    ("CB14731E", 0.76, 4.40, "cub", []),         # פנימית
    ("1667200F", 0.70, 11.84, "cub", [(11.6, 11.84)]),  # לחמניות מהבית ... הכל מסודר + the kiss (heard at 11.78)
    ("2B63FD56", 0.78, 5.75, "cub", []),         # לחם משנה
    ("833AE8B2", 0.85, 22.06, "cub", [(16.9, 22.06)]),  # (the later take) the vort + her rolling laugh, cut at his mark
    ("A4F97E17", 1.20, 13.95, "cub", []),     # (his mark: starts at "במעברים")        # רמזורים של שבת
    ("D52EC4F7", 2.15, 9.15, "cub", [(7.15, 8.35)]),   # ובאמת איזה צוות ... (the ring, she picks up) כן, אמא?
]
CALL_TAKE = "D52EC4F7"
# the call: Hani's lines in her call take + the mother's lines; mode = how the mother is seen
#   full = full screen; pip_end = full screen, the last part on Hani with her in the small window (Hani's listening
#   face before her answer); pip_start@t = small window first, full screen from take second t
CALL = [
    ("M", "D25C02E3", 1.05, 4.62, "pip"),                  # חנהל'ה! וו איז מיין סידור?!  (his note: the window + speaker voice)
    ("H", 11.00, 14.10),                                   # מאיפה אני יודעת ...
    ("M", "D25C02E3", 5.45, 14.12, "pip_end"),             # על השידה ... משוגענע קאפ ...
    ("H", 15.72, 19.95),                                   # אמא, למה שהאחות ...
    ("M", "4D3D9DDD", 1.30, 7.98, "pip_start@4.45"),       # נו רגע ... הסידור איננו | יצחק! שטיי אויף!
    ("H", 26.50, 28.68),                                   # אמא! למה את מעירה אותו?
    ("M", "4D3D9DDD", 8.42, 13.60, "pip_end"),             # נו, הוא מקפיד ... קפידא (its end whole)
    ("H", 32.60, 36.70),                                   # יש עוד כמעט שעתיים ...
    ("M", "4D3D9DDD", 13.95, 19.08, "pip_end"),            # ועם מה יתפלל ... הסידור השני
    ("H", 37.86, 40.98),                                   # אני בעבודה, בארבע ועשרים ...
    ("M", "4D3D9DDD", 19.76, 21.97, "full"),               # וואס הייסט ארבע ועשרים?! אז תצאי עכשיו
    ("H", 42.20, 44.82),                                   # מה זה שייך ...
    ("M", "E36D72B9", 1.95, 8.45, "full"),                 # חנהל'ה, גענוג שוין! ...
    ("H", 48.35, 51.18),                                   # מה עניין שליחות מצווה ...
    ("M", "E36D72B9", 9.52, 15.52, "pip_end"),             # שלוחי מצווה ... לופט געשעפטן
    ("H", 54.16, 57.95),                                   # זה לא עובד ככה ... נדבר אחר כך
]
SEC3 = [
    ("0DB0585E", 4.05, 10.85, "cub", []),        # טוב, אני יוצאת היום בארבע ... חשש גזל
    ("9DE75DAC", 3.40, 17.20, "cub", []),        # (the later take) הדונגל ... ישועות ונחמות - ends there (his mark)
]
S3_PACE = 1.1           # his note: "from here I talked very fast - slower than the video's pace, only this part"
RING_AT = 7.05          # call take second the Nokia starts ringing (she picks up at ~7.7)
TURN = 0.6              # every turn overlaps - "it was more sticky, it was better" (his note, round 2: back to the overlap)
PIP_MAX = 2.0           # at most this long on Hani's listening face per mother line (pip_end)
EXTRA_LISTEN = 24.2     # call take second of more listening face (the window over Hani for the mother's first line)
PAD_IN = 0.08
TAKE_HEAD, TAKE_TAIL = 0.45, 0.35

# ---------------------------------------------------------------- subtitles: what was said (fixed mishears)
FIX = {"פילי": "פילאי", "הרעב": "הרב", "נשט": "נס", "ספייק": "ספק", "ספייקה": "ספיקא", "המויצי,": "המוציא,", "השקים,": "השקית,",
       "לכם": "לחם", "חכמה": "רק מה,", "הרעב": "הרב", "לחמניה,": "לחמנייה,", "וורט": "ווארט", "חמזורים": "רמזורים",
       "להתר,": "להיתר,", "הקודש,": "הקדוש", "אימה.": "אמא.", "אימה,": "אמא,", "אימה?": "אמא?", "שאחות": "שהאחות",
       "מיירה": "מעירה", "מרקי.": "מלכי!", "לשערת": "לשרת", "אההה": "", "אהההה": "", "קולטת": "קולטת?!",
       "פלואים,": "פלואים!", "ממש!": "ממש!", "ויז": "ויז'ניץ,", "'ניץ,": "", "למאי": "למעריב,", "ריב,": "",
       "לחמניות": "לחמניות", "וורט,": "ווארט,"}
FIX_TAKE = {
    "6EE45D85": {"רב": "ר'"}, "2B63FD56": {"לרב": "לר'"},
}
SEQ = {   # take: [(heard words, what he said)]
    "26457B32": [(["קולטת"], ["קולטת?!"]), (["לקרות"], ["לקרות?!"]), (["ושלום"], ["ושלום!"]), (["כי", "טוב"], ["כי", "טוב!"])],
    "833AE8B2": [(["שאני", "חרד"], ["שנחרד"]), (["רבי", "יצחק"], ["ר'", "יצחק"]), (["מתחתיו", "נו"], ["מתחתיו!", "נו,"]),
                 (["אוי", "אברהם", "משה"], ["אוי,", "אברהם", "משה…"]), (["איזה", "ווארט"], ["איזה", "ווארט!"])],
    "1667200F": [(["אם", "הוא", "צריך", "לטלטל", "שם"], ["אם", "מותר", "לטלטל", "לשם"]), (["הרב", "עם"], ["הרב", "אם"])],
    "D52EC4F7": [(["אני", "אדבר"], ["נדבר"]), (["יש", "לי", "מעט", "עוד", "שעתיים"], ["יש", "עוד", "כמעט", "שעתיים"]),
                 (["בין", "ארבע"], ["בארבע"])],
    "0DB0585E": [(["ב־4", "ב־20,"], ["בארבע", "ועשרים,"]), (["ב־4"], ["בארבע"]), (["לבוא"], ["לעבור"]), (["שאני", "לא", "ייחס"], ["שלא", "יהיה", "חס"]),
                 (["אני", "את", "ה־20", "דקות", "השלילים"], ["את", "העשרים", "דקות", "אני", "אשלים"])],
    "9DE75DAC": [(["שאדום", "כן", "יתחברי"], ["שהדונגל", "יתחבר", "לי"]), (["ישועות", "השם", "כערב", "פעמים,"], ["ישועת", "השם", "כהרף", "עין!"])],
}
# the mother: her words as she said them (Yiddish spelled as the script), take seconds; translations below them
MOM_SUBS = {
    "D25C02E3": [(1.05, "חנהל'ה!"), (1.96, "וו איז מיין סידור?!"), (3.32, "איך האב אים דא געלייגט!"),
                 (5.50, "על השידה! איננו!"), (7.02, "גם התהילים נעלם!"), (8.12, "אולי האחות לקחה,"),
                 (9.34, "מי יודע מה הולך פה!"), (10.54, "משוגענע קאפ, האחיות האלה!"), (12.24, "כל היום מזיזות לי פה דברים!")],
    "4D3D9DDD": [(1.30, "נו, רגע… התהילים פה."), (3.34, "הסידור איננו."), (4.45, "יצחק! יצחק, שטיי אויף!"),
                 (6.40, "ס'איז שוין מנחה קטנה!"), (8.45, "נו, הוא מקפיד על מנחה קטנה!"), (10.44, "אם אני לא מעירה אותו עכשיו,"),
                 (11.78, "אחר כך תהיה לי קפידא!"), (13.98, "ועם מה יתפלל? אין לו סידור!"), (15.96, "חנהל'ה, תעברי בבית"),
                 (17.42, "ותביאי את הסידור השני."), (19.78, "וואס הייסט ארבע ועשרים?!"), (20.98, "אז תצאי עכשיו!")],
    "E36D72B9": [(1.95, "חנהל'ה, גענוג שוין!"), (3.42, "תביאי לאבא את הסידור!"), (4.66, "עשיתי אותך שליחת מצווה!"),
                 (6.04, "כשתגיעי – חי שקלים בצדקה!"), (9.52, "שלוחי מצווה אינם ניזוקים!"), (11.16, "והצדקה תעמוד לך לזכות,"),
                 (12.54, "לא יאונה לך שום רע"), (13.70, "שם בלופט געשעפטן שלכם!")],
}
MOM_TR = {
    "D25C02E3": [(1.96, 4.58, "(איפה הסידור שלי? שמתי אותו כאן!)"), (10.54, 11.50, "(משוגעות!)")],
    "4D3D9DDD": [(4.45, 7.96, "(יצחק, תקום! כבר זמן מנחה קטנה!)"), (19.78, 20.96, "(מה זאת אומרת ארבע ועשרים?!)")],
    "E36D72B9": [(1.95, 3.40, "(מספיק כבר!)"), (13.70, 15.48, "(בעסקי האוויר שלכם!)")],
}

# ---------------------------------------------------------------- looks
SET = {"open": "m.tt-openspace.jpg", "cub": "m.set-wall-a.jpg", "cubw": "m.set-wall-a.jpg", "ward": "m.hosp-up.jpg"}
# cubw = her cubicle seen wider (she walks in standing, farther away): the seated set and its two pictures at 0.75
SETBOX = {"open": {"x": -100, "y": 0, "w": 1280, "h": 1920}, "cub": {"x": -302, "y": -450, "w": 1800},
          "cubw": {"x": -92, "y": -105, "w": 1350}, "ward": {"x": -100, "y": 0, "w": 1280, "h": 1920}}
KIDS = {"cub": {"x": -8, "y": 414, "w": 398}, "cubw": {"x": 129, "y": 543, "w": 298}}
FAMILY = {"cub": {"x": 573, "y": 854, "w": 585}, "cubw": {"x": 565, "y": 873, "w": 439}}
VBOX = {"x": 0, "y": 150, "w": 1080, "h": 1920}          # Hani seated (haredit-3's framing)
VBOX_OPEN = {"x": 0, "y": 0, "w": 1080, "h": 1920}       # standing at the entrance
MBOX = {"x": 0, "y": 60, "w": 1080, "h": 1920}           # the mother
PIP = {"x": 690, "y": 280, "w": 360, "h": 540}
MOM_NAME = "אמי מורתי פערל שתחי'"
VPROPS = {"fit": "cover", "cutout": True, "eyes": False, "look": {}, "matte_cut": 70, "side_ramp": True,
          "af": "eq=brightness=0.0:contrast=1.05:saturation=1.08,colorbalance=rs=0.06:gs=0.02:bs=-0.06:rm=0.06:bm=-0.06",
          "box": {"x": 0, "y": 0, "w": 1080, "h": 1920}, "mirror": True}
HANI_VOICE = {"volume": 1, "voice": {"preset": "natural", "lowcut": 50, "warmth": 11, "box": 1, "presence": 4, "deess": 0,
              "comp": 0.4, "room": 0.06, "roomSize": 0.8}, "clean": "fft", "level": "speech", "fx": {"pitch": 0.5}}
MOM_VOICE = {"volume": 0.85, "voice": {"preset": "natural", "lowcut": 70, "warmth": 6, "box": 0, "presence": 3, "deess": 0.2,
             "comp": 0.4, "room": 0.06, "roomSize": 0.8}, "clean": "fft", "level": "speech"}
PHONE = {"fx": {"filter": "phone"}, "gain": 0.5}         # a voice heard through the phone at Hani's ear / from it
SUBS = {"style": "solo", "box": {"x": 540, "y": 1430, "w": 980, "anchor": "t"}, "font": "font.assistant", "size": 66,
        "weight": 800, "color": "#ffffff", "stroke": 10}


def req(method, url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(API + url, data=data, method=method, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(r) as f:
        return json.loads(f.read().decode())


def full(k):
    return next(x for x in W if x.startswith(k))


def pieces(take, a, b, keep=()):
    """the spoken spans of [a, b] (take seconds). A pause = a stretch between two LOUD runs (the speech core, peak -22 dB)
    at a word boundary; breaths sit below it so they count as pause. Edges are walked out over the soft sounds (a word's
    first consonant, its decaying end - anything above the room's noise + 6 dB) so no word loses its start or end
    (his notes, round 1: "כל ליל שבת", "הוא עם", "אז", "קפידא" were clipped). A cut that saves under 0.15 s is not made
    (a tiny jump only throws the picture off the sound)."""
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
    m = []   # holes under 0.08 s are inside a word
    for r in runs:
        if m and r[0] - m[-1][1] < 8: m[-1][1] = r[1]
        else: m.append(r)
    runs = [r for r in m if r[1] - r[0] >= 3]
    if not runs:
        return [(round(max(lo, a), 3), round(min(hi, b), 3))]
    def back(i, limit):          # from a loud start, back over the soft onset (at most 0.15 s)
        j = i
        while j - 1 >= int(limit * 100) and i - (j - 1) <= 8 and d[j - 1] > SOFT: j -= 1
        return max(limit, j / 100 - 0.01)
    def fwd(i, limit):           # from a loud end, on over the decaying tail (at most 0.28 s)
        j = i
        while j < int(limit * 100) and j - i < 15 and d[j] > max(SOFT, p95 - 27): j += 1
        return min(limit, j / 100 + 0.01)
    words = t["words"]
    bounds = [(words[q][1] + words[q + 1][0]) / 2 for q in range(len(words) - 1)] + [w[1] for w in words] + [w[0] for w in words]
    in_keep = lambda x0, x1: any(x1 > ka and x0 < kb for ka, kb in keep)
    def quiet_word(i, limit):    # a quiet first word before the loud speech (he often starts softly: "הוא", "אז", "אבל"
        Q = max(noise + 8, p95 - 34)   # at -40 dB, then a dip, then the loud words) - its start, up to 0.5 s back
        j0 = max(int(limit * 100), i - 50); best = None; j = i - 1
        while j >= j0:
            if d[j] > Q:
                k = j
                while k - 1 >= j0 and d[k - 1] > Q: k -= 1
                if j - k + 1 >= 6: best = k
                j = k - 1
            else: j -= 1
        return max(limit, best / 100 - 0.04) if best is not None else back(i, limit)
    out = [[back(runs[0][0], lo), None]]
    for r1, r2 in zip(runs, runs[1:]):
        g0, g1 = r1[1] / 100, r2[0] / 100
        if g1 - g0 >= 0.18 and not in_keep(g0, g1) and any(g0 - 0.06 <= x <= g1 + 0.06 for x in bounds):
            tail = fwd(r1[1], g1); head = back(r2[0], tail)
            if head - tail >= 0.12:
                out[-1][1] = tail; out.append([head, None]); continue
    out[-1][1] = fwd(runs[-1][1], hi)
    for ka, kb in keep:          # an acted stretch keeps its own edges
        for o in out:
            if o[0] <= kb and o[1] >= ka - 0.4: o[0], o[1] = min(o[0], max(lo, ka)), max(o[1], min(hi, kb))
    k = 0                        # no piece under 0.8 s: join it to its neighbour
    while len(out) > 1 and k < len(out):
        if out[k][1] - out[k][0] < 0.8:
            if k == 0: out[0:2] = [[out[0][0], out[1][1]]]
            elif k == len(out) - 1: out[k - 1:k + 1] = [[out[k - 1][0], out[k][1]]]
            else:
                gp, gn = out[k][0] - out[k - 1][1], out[k + 1][0] - out[k][1]
                if gp <= gn: out[k - 1:k + 1] = [[out[k - 1][0], out[k][1]]]
                else: out[k:k + 2] = [[out[k][0], out[k + 1][1]]]
            k = 0; continue
        k += 1
    return [(round(x, 3), round(y, 3)) for x, y in out]


def said(take, a, b):
    """Hani's words in [a, b] (any word reaching into it - whisper starts words early) as (start, end, text), fixed"""
    fx = dict(FIX); fx.update(FIX_TAKE.get(take[:8], {}))
    ws = [[s, e, w] for s, e, w in W[take]["words"] if e > a + 0.1 and (s + e) / 2 <= b]
    j = []
    for w in ws:   # "ה -VPN" -> "ה־VPN"
        if w[2].startswith("-") and j: j[-1] = [j[-1][0], w[1], j[-1][2] + "־" + w[2][1:]]
        else: j.append(w)
    ws = [[s, e, fx.get(w, w)] for s, e, w in j]
    for heard, said_ in SEQ.get(take[:8], []):
        i = 0
        while i <= len(ws) - len(heard):
            if [x[2] for x in ws[i:i + len(heard)]] == heard:
                s0, e0 = ws[i][0], ws[i + len(heard) - 1][1]
                st = [s0 + (e0 - s0) * q / len(said_) for q in range(len(said_) + 1)]
                ws[i:i + len(heard)] = [[st[q], st[q + 1], said_[q]] for q in range(len(said_))]
                i += len(said_)
            else: i += 1
    return [(max(s, a), e, w) for s, e, w in ws if w]


def chunks(ws):
    out, cur = [], []
    for w in ws:
        cur.append(w)
        t = w[2]
        if re.search(r"[.?!…]$", t) or (t.endswith(",") and len(cur) >= 3) or len(cur) == 4:
            out.append(cur); cur = []
    if cur: out.append(cur)
    j = []
    for c in out:
        if j and len(c) <= 2 and not re.search(r"[.?!…]$", j[-1][-1][2]) and len(j[-1]) + len(c) <= 6:
            j[-1] = j[-1] + c
        else: j.append(c)
    return [(c[0][0], c[-1][1], " ".join(x[2] for x in c).rstrip(",")) for c in j]


# ---------------------------------------------------------------- read, link the take files
proj = lambda j: j.get("project", j)
src = proj(req("GET", f"/api/p/{SRC}"))
p = proj(req("GET", f"/api/p/{EP}"))
lay = {l["id"]: l for l in p["layers"]}
takes = {k: v for k, v in src["assets"].items() if v.get("kind") == "video"}
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
    keep = {x: have[x] for x in ("mark", "note") if x in have}
    ops.append({"op": "asset.add", "id": k, "asset": {**a, **keep}})

# ---------------------------------------------------------------- the rows
def row(id, kind, name, group=None, props=None, **kw):
    l = {"id": id, "kind": kind, "name": name, "props": props or {}, "items": []}
    if group: l["group"] = group
    l.update(kw)
    return l

R = {}
order = [
    row("hani.bg", "image", "רקע – חני", "חני", {"blur": 0, "brightness": 0.96, "saturate": 0.95}),
    row("hani.kids", "image", "חני – תמונת הילדים (בקיוביקל)", "חני"),
    row("hani.family", "image", "חני – תמונה משפחתית (בקיוביקל)", "חני"),
    row("hani.video", "video", "חני", "חני", dict(VPROPS)),
    row("voice", "audio", "קול – חני", "חני", dict(HANI_VOICE)),
    row("voice.2", "audio", "קול – חני (2: הקליפ הבא - הקולות חופפים בחיתוך)", "חני", dict(HANI_VOICE)),
    row("mom.bg", "image", "רקע – אמא (המחלקה)", "אמא", {"blur": 4, "brightness": 0.96, "saturate": 0.95}),
    row("mom.video", "video", "אמא", "אמא", dict(VPROPS)),
    row("mom.tag", "text", "אמא – שם (מסך מלא)", "אמא", {"style": "pill"}),
    row("voice.mom", "audio", "קול – אמא (בטלפון = כשרואים את חני)", "אמא", dict(MOM_VOICE)),
    row("pip.bg", "image", "אמא בחלון קטן – רקע", "אמא בחלון קטן", {"blur": 3, "brightness": 0.96, "saturate": 0.95}),
    row("pip.video", "video", "אמא בחלון קטן", "אמא בחלון קטן", dict(VPROPS, side_ramp=False, radius=26, box=dict(PIP))),
    row("pip.frame", "shape", "אמא בחלון קטן – מסגרת", "אמא בחלון קטן", {"fill": "rgba(0,0,0,0)", "stroke": "#ffffff", "width": 6, "radius": 26}),
    row("pip.tag", "text", "אמא בחלון קטן – שם", "אמא בחלון קטן", {"style": "pill"}),
    row("subs", "subtitles", "כתוביות – חני", None, dict(SUBS)),
    row("subs.mom", "subtitles", "כתוביות – אמא", None, dict(SUBS, color="#ffd86b")),
    row("subs.tr", "subtitles", "תרגום היידיש", None, dict(SUBS, size=50, weight=700, color="#e9eef7", stroke=8,
                                                           box={"x": 540, "y": 1610, "w": 960, "anchor": "t"})),
    dict(lay["text.pov"]),
    dict(lay["text.time"]),
    row("view", "view", "מה רואים"),
    dict(lay["ring"], items=[]),
    dict(lay["beep"], items=[]),
    dict(lay["music"], items=[]),
]
order = [l for l in order if l["id"] not in ("ward", "hum")]
for l in order:
    if l["id"] in lay and l["kind"] != "view": l["props"] = {**l["props"], **lay[l["id"]].get("props", {})}   # (what he set)
    R[l["id"]] = l
R["beep"]["props"]["volume"] = 0.9
R["beep"]["name"] = "בית החולים – ציפצופים (מוניטורים, משאבה, קריאה לאחות)"
for l in ("hani.video", "mom.video", "pip.video"):
    R[l]["props"]["box"] = dict({"hani.video": VBOX, "mom.video": MBOX, "pip.video": PIP}[l])

T = 0.0          # the timeline (seconds)
strip = []       # (from_s, to_s, show)
n = [0]
voice_clips = []  # (row, item) for the phone pass
turns = []       # (timeline s, "room" | "phone") - the beeps change only where a line starts, never mid-line
placed = []      # Hani's pieces of the entry being placed: (take a, take b, timeline start, link)


def link():
    n[0] += 1
    return f"g{n[0]}"


def add_sub(rowid, a_take, b_take, take_a, t0, text, lk):
    """a subtitle at take seconds a..b of a piece that starts at take_a / timeline t0"""
    R[rowid]["items"].append({"id": f"s{len(R[rowid]['items'])}.{rowid}", "from": F(t0 + a_take - take_a),
                              "dur": max(12, F(t0 + b_take - take_a) - F(t0 + a_take - take_a)), "text": text, "link": lk})


def hani_piece(take, a, b, t0, setname, pre=0.0, post=0.0, words=None):
    """one Hani group at timeline t0: [a - pre, b + post] of the take (pre / post = her listening face, silent)"""
    lk = link()
    A, B = a - pre, b + post
    fr, du = F(t0), F(t0 + (B - A)) - F(t0)
    box = dict(VBOX_OPEN if setname in ("open", "cubw") else VBOX)
    R["hani.bg"]["items"].append({"id": f"b{n[0]}", "from": fr, "dur": du, "asset": SET[setname], "box": dict(SETBOX[setname]), "link": lk})
    if setname in KIDS:
        R["hani.kids"]["items"].append({"id": f"k{n[0]}", "from": fr, "dur": du, "asset": "m.kids.png", "box": dict(KIDS[setname]), "link": lk})
        R["hani.family"]["items"].append({"id": f"f{n[0]}", "from": fr, "dur": du, "asset": "m.family-framed.png", "box": dict(FAMILY[setname]), "link": lk})
    R["hani.video"]["items"].append({"id": f"p{n[0]}", "from": fr, "dur": du, "asset": tid(take), "in": round(A, 3), "box": box, "link": lk})
    hp, ha = handles(full(take), A, B)
    hp = min(hp, t0)   # (nothing before the video's first frame)
    vrow = "voice" if len(R["hani.video"]["items"]) % 2 else "voice.2"   # (alternating: this clip's picture is already in)
    v = {"id": f"v{n[0]}", "from": F(t0 - hp), "dur": F(t0 + (B - A) + ha) - F(t0 - hp), "asset": tid(take), "in": round(A - hp, 3),
         "fade_in": 0.01, "fade_out": 0.01, "link": lk}
    R[vrow]["items"].append(v); voice_clips.append(("hani", v))
    placed.append((A, B, t0, lk))
    return t0 + (B - A), lk


VOICE_PRE, VOICE_POST = 0.3, 0.25
def handles(take, A, B):
    """how far the voice runs before / after its picture (his method: the left clip's voice a little longer, the right
    clip's a little earlier - a word the picture misses is still heard): up to VOICE_PRE / VOICE_POST, never into another
    loud word of the take (a re-said line) and never into the recording's first 0.3 s / last 0.25 s"""
    t = W[take]; d = np.array(t["db10"]); LOUD = np.percentile(d, 95) - 22
    j = int(A * 100) - 3
    while j > int((A - VOICE_PRE) * 100) and d[j] <= LOUD: j -= 1
    pre = A - max(0.3, (j + 5) / 100 if d[j] > LOUD else A - VOICE_PRE)
    j = int(B * 100) + 3
    while j < min(len(d) - 1, int((B + VOICE_POST) * 100)) and d[j] <= LOUD: j += 1
    post = min(t["dur"] - 0.25, (j - 5) / 100 if d[j] > LOUD else B + VOICE_POST) - B
    return max(0.0, round(pre, 3)), max(0.0, round(post, 3))


def entry_subs(take, a, b):
    """the entry's words as subtitles, chunked over the whole entry, each mapped through its pieces"""
    def at(x, start):
        for A, B, t0, lk in placed:
            if A - (0.3 if start else 0) <= x < B + (0 if start else 0.3):
                return t0 + min(max(x, A), B) - A, lk
        if start:
            nx = [p for p in placed if p[0] > x]
            return (nx[0][2], nx[0][3]) if nx else (None, None)
        pv = [p for p in placed if p[1] <= x]
        return (pv[-1][2] + pv[-1][1] - pv[-1][0], pv[-1][3]) if pv else (None, None)
    for s, e, text in chunks(said(full(take), a, b)):
        ts, lk = at(s, True); te, _ = at(e, False)
        if ts is None or te is None or te <= ts: continue
        R["subs"]["items"].append({"id": f"s{len(R['subs']['items'])}", "from": F(ts), "dur": max(12, F(te) - F(ts)), "text": text, "link": lk})
    placed.clear()


def hani_entry(take, a, b, setname, keep, t0):
    ps = pieces(full(take), a, b, keep)
    for x, y in ps:
        t0, _ = hani_piece(take, x, y, t0, setname)
    entry_subs(take, a, b)
    return t0, ps


# ---- section 1: Hani to Dasi
for take, a, b, s, keep in SEC1:
    t_start = T
    T, ps = hani_entry(take, a, b, s, keep, T)
    strip.append((t_start, T, "hani.video"))
    if take == CALL_TAKE:
        call_t0 = t_start - ps[0][0]       # timeline = call_t0 + take second (while the call take runs unbroken)
        ring_at = None
        acc = t_start
        for x, y in ps:                     # the ring at RING_AT of the take, through the pieces
            if x <= RING_AT <= y: ring_at = acc + RING_AT - x
            acc += y - x
        hani_last_take_end = ps[-1][1]

# ---- section 2: the call
call_start = ring_at
mom_spans = []   # (from_s, to_s, how) - for the ward sounds
prev_hani_end_take = hani_last_take_end
lines = CALL
k = 0
while k < len(lines):
    ln = lines[k]
    if ln[0] == "M":
        _, take, a, b, mode = ln
        ps = pieces(full(take), a, b)
        nxt = lines[k + 1] if k + 1 < len(lines) else None
        m0 = T - TURN                         # she comes in over Hani's last words
        dur = sum(y - x for x, y in ps)
        m1 = m0 + dur
        # where Hani is seen with her in the window
        pip_a = pip_b = None
        if mode == "pip_end" and nxt:
            gap = (nxt[1] - PAD_IN) - (prev_hani_end_take + 0.15)
            P = max(0.0, min(PIP_MAX, gap, dur - 1.0))
            if P >= 0.8: pip_a, pip_b = m1 - TURN - P, m1
        elif mode == "pip":
            pip_a, pip_b = m0, m1
            # Hani's listening face under the window: on from where her line ended, then more from later in the take
            c0 = prev_hani_end_take
            c1 = min(c0 + (m1 - TURN - T), nxt[1] - 0.3)
            t_ = hani_piece(CALL_TAKE, c0, c1, T, "cub")[0]; placed.clear()
            if m1 - TURN - t_ > 0.1:
                hani_piece(CALL_TAKE, EXTRA_LISTEN, EXTRA_LISTEN + (m1 - TURN - t_), t_, "cub"); placed.clear()
        elif mode.startswith("pip_start@"):
            cut_take = float(mode.split("@")[1])
            acc = m0
            for x, y in ps:
                if x <= cut_take <= y: cut_at = acc + cut_take - x
                acc += y - x
            pip_a, pip_b = m0, cut_at
        # her pieces: full screen rows or the window rows, split where the picture changes
        acc = m0
        mlk = None
        for x, y in ps:
            seg_a, seg_b = acc, acc + (y - x)
            cuts = sorted({seg_a, seg_b} | ({c for c in (pip_a, pip_b) if c is not None and seg_a < c < seg_b}))
            for u, w in zip(cuts, cuts[1:]):
                if w - u < 0.05: continue
                tin = x + (u - seg_a)
                in_pip = pip_a is not None and pip_a - 1e-6 <= u and w <= pip_b + 1e-6
                lk = link()
                fr, du = F(u), F(w) - F(u)
                if in_pip:
                    R["pip.bg"]["items"].append({"id": f"pb{n[0]}", "from": fr, "dur": du, "asset": SET["ward"], "box": dict(PIP), "radius": 26, "link": lk})
                    R["pip.video"]["items"].append({"id": f"pp{n[0]}", "from": fr, "dur": du, "asset": tid(take), "in": round(tin, 3), "box": dict(PIP), "link": lk})
                    R["pip.frame"]["items"].append({"id": f"pf{n[0]}", "from": fr, "dur": du, "box": dict(PIP), "link": lk})
                    R["pip.tag"]["items"].append({"id": f"pt{n[0]}", "from": fr, "dur": du, "text": MOM_NAME, "style": "pill", "bg": "#1d2a55",
                                                  "color": "#ffffff", "size": 25, "radius": 22, "font": "font.assistant",
                                                  "box": {"x": PIP["x"] + PIP["w"] / 2, "y": PIP["y"] + PIP["h"] - 30, "anchor": "t"}, "link": lk})
                else:
                    R["mom.bg"]["items"].append({"id": f"mb{n[0]}", "from": fr, "dur": du, "asset": SET["ward"], "box": dict(SETBOX["ward"]), "link": lk})
                    R["mom.video"]["items"].append({"id": f"mp{n[0]}", "from": fr, "dur": du, "asset": tid(take), "in": round(tin, 3), "box": dict(MBOX), "link": lk})
                    R["mom.tag"]["items"].append({"id": f"mt{n[0]}", "from": fr, "dur": du, "text": MOM_NAME, "style": "pill", "bg": "#1d2a55",
                                                  "color": "#ffffff", "size": 44, "radius": 30, "font": "font.assistant",
                                                  "box": {"x": 540, "y": 250, "anchor": "t"}, "link": lk})
                v = {"id": f"mv{n[0]}", "from": fr, "dur": du, "asset": tid(take), "in": round(tin, 3), "fade_in": 0.01, "fade_out": 0.01, "link": lk}
                if mode == "pip": v.update(json.loads(json.dumps(PHONE)))   # a line all in the window: the speaker, all of it
                R["voice.mom"]["items"].append(v); voice_clips.append(("mom", v))
                for s0, text in MOM_SUBS[take[:8]]:
                    s1 = max(s0, x)   # (a word whose start the silence cut trimmed)
                    if x - 0.35 <= s0 < y and u - 1e-6 <= seg_a + (s1 - x) < w:
                        nx = [q for q, _ in MOM_SUBS[take[:8]] if q > s0]
                        e0 = min(nx[0] if nx else y, y)
                        add_sub("subs.mom", s1, e0, tin, u, text, lk)
                for s0, e0, text in MOM_TR.get(take[:8], []):
                    s1 = max(s0, x)
                    if x - 0.35 <= s0 < y and u - 1e-6 <= seg_a + (s1 - x) < w:
                        add_sub("subs.tr", s1, min(e0, y), tin, u, text, lk)
            acc = seg_b
        # the strip: full screen from her start (she is seen when she starts), Hani where the window is
        if mode == "pip":
            strip.append((T, m1, "hani.video"))
        elif mode.startswith("pip_start@"):
            strip.append((T, cut_at, "hani.video")); strip.append((cut_at, m1, "mom.video"))
        elif pip_a is not None:
            strip.append((m0, pip_a, "mom.video")); strip.append((pip_a, m1, "hani.video"))
        else:
            strip.append((m0, m1, "mom.video"))
        mom_spans.append((m0, m1))
        turns.append((m0, "phone" if mode == "pip" else "room"))
        last_mom = (m0, m1, mode, pip_a, pip_b)
        T = m1
        k += 1
        continue
    # Hani's line in the call take
    _, a, b = ln
    ps = pieces(full(CALL_TAKE), a, b)
    h0 = T - TURN
    turns.append((h0, "phone"))
    m0, m1, mode, pip_a, pip_b = last_mom
    pre = 0.0
    if mode == "pip_end" and pip_a is not None:   # her listening face before she answers, under the window
        pre = (h0 - pip_a)
        h0 = pip_a
    t0 = h0
    for i, (x, y) in enumerate(ps):
        post = 0.0
        nxt = lines[k + 1] if k + 1 < len(lines) else None
        if i == len(ps) - 1 and nxt and nxt[0] == "M" and nxt[4].startswith("pip_start@"):
            # she listens while her mother starts in the window: run on into the pause after her line
            nm_ps = pieces(full(nxt[1]), nxt[2], nxt[3])
            ct = float(nxt[4].split("@")[1]); upto = sum(min(yy, ct) - xx for xx, yy in nm_ps if xx < ct)
            post = min(upto - TURN, (lines[k + 2][1] - PAD_IN if k + 2 < len(lines) else y + 5) - y - 0.2, 6.0)
            post = max(0.0, post)
        t0, lk = hani_piece(CALL_TAKE, x, y, t0, "cub", pre=pre if i == 0 else 0.0, post=post)
    entry_subs(CALL_TAKE, a, b)
    if not (mode == "pip_end" and pip_a is not None):
        strip.append((h0 + 0.0, t0 - post, "hani.video"))
    else:
        strip.append((m1, t0 - post, "hani.video"))
    T = t0 - post   # the next line overlaps her words, not her silent listening
    if post:
        strip.append((T, T, "hani.video"))  # (placeholder, merged below)
        hani_tail = t0
    prev_hani_end_take = ps[-1][1] + post
    k += 1
call_end = max(T, max(m1 for _, m1 in mom_spans))
T = call_end

# ---- section 3: 16:00
s3_t0 = T + 0.0
for take, a, b, s, keep in SEC3:
    t_start = T
    T, ps = hani_entry(take, a, b, s, keep, T)
    strip.append((t_start, T, "hani.video"))
END = T

# ---------------------------------------------------------------- the strip: back to back, no gaps, >= 1 s
st = sorted([s for s in strip if s[1] - s[0] > 0.02], key=lambda s: s[0])
clean = []
for a, b, who in st:
    if clean and a < clean[-1][1]:
        if clean[-1][2] != who:   # whoever starts later is seen from there
            if a - clean[-1][0] < 0.05: clean.pop()
            else: clean[-1] = (clean[-1][0], a, clean[-1][2])
        else:
            a = clean[-1][0]
    if clean and a > clean[-1][1]:
        if clean[-1][2] == who: a = clean[-1][1]
        else: clean[-1] = (clean[-1][0], a, clean[-1][2])
    if clean and clean[-1][2] == who:
        clean[-1] = (clean[-1][0], b, who); continue
    clean.append((a, b, who))
# a shot under 1 s joins its neighbour if that one has picture there
def covered(who, a, b):
    rowid = who
    its = R[rowid]["items"]
    return all(any(i["from"] <= F(t) < i["from"] + i["dur"] for i in its) for t in np.arange(a, b, 1 / FPS))
k = 0
while k < len(clean):
    a, b, who = clean[k]
    if b - a < 1.0 and len(clean) > 1:
        if k > 0 and covered(clean[k - 1][2], a, b):
            clean[k - 1] = (clean[k - 1][0], b, clean[k - 1][2]); del clean[k]; k = max(0, k - 1); continue
        if k + 1 < len(clean) and covered(clean[k + 1][2], a, b):
            clean[k + 1] = (a, clean[k + 1][1], clean[k + 1][2]); del clean[k]; continue
    k += 1
merged = []
for s in clean:
    if merged and merged[-1][2] == s[2]: merged[-1] = (merged[-1][0], s[1], s[2])
    else: merged.append(s)
clean = merged
clean[0] = (0.0, clean[0][1], clean[0][2]); clean[-1] = (clean[-1][0], END, clean[-1][2])
for i, (a, b, who) in enumerate(clean):
    R["view"]["items"].append({"id": f"w{i}", "from": F(a), "dur": F(b) - F(a), "show": who})

def seen_at(fr):
    for it in R["view"]["items"]:
        if it["from"] <= fr < it["from"] + it["dur"]: return it["show"]
    return None

# ---------------------------------------------------------------- the sound follows who is seen
# a voice clip of whoever is NOT on screen (the mother while we see Hani - the window too; Hani while we see her
# mother) is heard through the phone; split where the picture changes
def split_by_view(rowid, who_row, phone_when_not):
    out = []
    for it in R[rowid]["items"]:
        cuts = sorted({it["from"], it["from"] + it["dur"]} | {v["from"] for v in R["view"]["items"] if it["from"] < v["from"] < it["from"] + it["dur"]})
        for j, (u, w) in enumerate(zip(cuts, cuts[1:])):
            pc = dict(it, id=it["id"] if len(cuts) == 2 else f"{it['id']}.{j}", **{"from": u, "dur": w - u})
            if "in" in it: pc["in"] = round(it["in"] + (u - it["from"]) / FPS, 3)
            if seen_at(u) != who_row and (phone_when_not or seen_at(u) == "mom.video"):
                pc.update(json.loads(json.dumps(PHONE)))
            out.append(pc)
    R[rowid]["items"] = out
# his rule (round 2): a voice never changes in the middle - the mother's line keeps the voice it started with (room
# when she starts full screen, even after we cut to Hani; the speaker only for a line all in the window); Hani never
# through a filter
# Hani: through the phone only while her mother is full screen (and only in the call)
def hani_phone():
    out = []
    for it in R["voice"]["items"]:
        cuts = sorted({it["from"], it["from"] + it["dur"]} | {v["from"] for v in R["view"]["items"] if it["from"] < v["from"] < it["from"] + it["dur"]})
        for j, (u, w) in enumerate(zip(cuts, cuts[1:])):
            pc = dict(it, id=it["id"] if len(cuts) == 2 else f"{it['id']}.{j}", **{"from": u, "dur": w - u})
            pc["in"] = round(it["in"] + (u - it["from"]) / FPS, 3)
            if seen_at(u) == "mom.video": pc.update(json.loads(json.dumps(PHONE)))
            out.append(pc)
    R["voice"]["items"] = out

# ---------------------------------------------------------------- texts, ring, ward, music
pov = dict(R["text.pov"]); pov["items"] = [dict(i) for i in pov["items"]]
R["text.time"]["items"] = [dict(R["text.time"]["items"][0], **{"from": F(s3_t0), "dur": F(2.2)})]
R["ring"]["items"] = [{"id": "r0", "from": F(ring_at), "dur": F(2.2), "asset": "s.kosher-ring.mp3", "in": 0, "gain": 0.6, "fade_in": 0.01, "fade_out": 0.15}]
# ward / monitor / hum: from just after she picks up to the end of the call; in the room while we see the mother,
# through the phone while we see Hani (split where the picture changes, each piece going on with the loop)
w_a, w_b = ring_at + 1.6, call_end + 0.4
def bed(asset, loop, base, on_hani, on_mom):
    cuts = sorted({F(w_a), F(w_b)} | {F(t) for t, _ in turns if F(w_a) < F(t) < F(w_b)})
    state = lambda f: ([st for t, st in turns if F(t) <= f] or ["phone"])[-1]
    out = []
    for u, w in zip(cuts, cuts[1:]):
        pos = (u - F(w_a)) / FPS
        a = u
        while a < w:
            off = pos % loop
            seg = min(w - a, F(loop - off) or 1)
            it = {"id": f"{base}{len(out)}", "from": a, "dur": seg, "asset": asset, "in": round(off, 3), "fade_in": 0.01, "fade_out": 0.01}
            it.update(on_mom if state(u) == "room" else on_hani)
            out.append(it); a += seg; pos += seg / FPS
    return out
R["beep"]["items"] = bed("s.monitor-beeps-busy.wav", 30.0, "b", {"gain": 0.8, "fx": {"filter": "phone"}}, {"gain": 1.0})
mus, at, i = [], 0, 0
while at < F(END):
    d = min(2670, F(END) - at)
    mus.append({"id": f"m{i}", "from": at, "dur": d, "asset": "s.music-hasidic-freilach.mp3", "in": 0, "fade_in": 0.01, "fade_out": 0.01})
    at += d; i += 1
R["music"]["items"] = mus

for rid in ("subs", "subs.mom", "subs.tr"):
    its = sorted(R[rid]["items"], key=lambda i: i["from"])
    for x, y in zip(its, its[1:]):
        if x["from"] + x["dur"] > y["from"]: x["dur"] = max(1, y["from"] - x["from"])
    k = 0   # a subtitle too short to read joins the next one (or the one before)
    while k < len(its):
        x = its[k]
        if x["dur"] < 18 and len(its) > 1:
            if k + 1 < len(its) and its[k + 1]["from"] - (x["from"] + x["dur"]) < 6:
                y = its[k + 1]; y["text"] = x["text"] + " " + y["text"]; y["dur"] += y["from"] - x["from"]; y["from"] = x["from"]; y["link"] = x.get("link", y.get("link"))
                del its[k]; continue
            if k > 0:
                w = its[k - 1]; w["text"] += " " + x["text"]; w["dur"] = x["from"] + x["dur"] - w["from"]; del its[k]; continue
        k += 1
    R[rid]["items"] = its
allsubs = sorted([("subs", i) for i in R["subs"]["items"]] + [("subs.mom", i) for i in R["subs.mom"]["items"]], key=lambda x: x[1]["from"])
for (ra, x), (rb, y) in zip(allsubs, allsubs[1:]):
    if x["from"] + x["dur"] > y["from"]:
        if y["from"] - x["from"] >= 18: x["dur"] = y["from"] - x["from"]
        else:   # (too short to read: it keeps 0.6 s and the next one starts after it)
            x["dur"] = 18; e = y["from"] + y["dur"]; y["from"] = x["from"] + 18; y["dur"] = max(12, e - y["from"])
for t in R["subs.tr"]["items"]:
    nx = [i["from"] for i in R["subs"]["items"] if i["from"] > t["from"]]
    if nx and t["from"] + t["dur"] > nx[0]: t["dur"] = max(1, nx[0] - t["from"])
print(f"section 3 starts {s3_t0:.2f} s = {s3_t0 / 1.25:.2f} s in the editor")
# ---------------------------------------------------------------- checks
probs = []
for rid in ("hani.video", "mom.video", "pip.video", "voice", "voice.2", "voice.mom", "hani.bg", "mom.bg"):
    its = sorted(R[rid]["items"], key=lambda i: i["from"])
    for x, y in zip(its, its[1:]):
        if x["from"] + x["dur"] > y["from"] and rid != "voice.mom":
            probs.append(f"{rid}: {x['id']} overlaps {y['id']}")
for v in R["view"]["items"]:
    its = R[v["show"]]["items"]
    for f in range(v["from"], v["from"] + v["dur"]):
        if not any(i["from"] <= f < i["from"] + i["dur"] for i in its):
            probs.append(f"strip {v['id']} {v['show']} has no clip at {f / FPS:.2f}s"); break
    if v["dur"] < FPS: probs.append(f"strip {v['id']} short {v['dur']}f")
for rid in ("subs", "subs.mom", "subs.tr"):
    for s in R[rid]["items"]:
        if s["dur"] < 12: probs.append(f"{rid} {s['id']} flash")
print(f"length {END:.1f} s raw = {END / 1.25:.1f} s at 1.25x | Hani clips {len(R['hani.video']['items'])} | mother {len(R['mom.video']['items'])} full + {len(R['pip.video']['items'])} window | strip {len(R['view']['items'])}")
print("\n".join(probs) or "checks ok")
for v in R["view"]["items"]:
    if "mom" in v["show"] or any(pp["from"] < v["from"] + v["dur"] and pp["from"] + pp["dur"] > v["from"] for pp in R["pip.video"]["items"]):
        print(f"  {v['from'] / FPS:7.2f}-{(v['from'] + v['dur']) / FPS:7.2f} {v['show']}")

ops += [{"op": "layer.remove", "id": l["id"]} for l in p["layers"]]
for i, l in enumerate(order):
    ops.append({"op": "layer.add", "layer": l, "index": i})
ops.append({"op": "project", "set": {"duration": F(END), "characters": ["hani", "perel"], "edit": {"ripple": False}}})
json.dump({"ops": ops}, open(os.path.join(SCR, "ops6c.json"), "w", encoding="utf-8"), ensure_ascii=False)
if not DRY and not probs:
    try:
        r = req("POST", f"/api/p/{EP}/ops", {"rev": p["rev"], "ops": ops})
    except urllib.error.HTTPError as e:
        print("REFUSED", e.read()[:800].decode()); sys.exit(1)
    print("rev", r.get("rev"), r.get("error"), r.get("problems"))


# ======================= late rounds: targeted ops (fix3.py, round 3) =======================
# # haredit-6, his notes round 3 (almost perfect - targeted ops only): a breath cut inside g18, the cut to the next clip
# # after "גזל", the mother's first subtitles + "כאן"
# import json, urllib.request, copy, numpy as np
# API = 'http://127.0.0.1:4747'; FPS = 30
# W = json.load(open(r'C:/Users/shazbak/AppData/Local/Temp/claude/ead2227d178773e9/09b23f4b-b6c0-4c04-8e7c-2287966f2f3a/scratchpad/h6-words.json', encoding='utf-8'))
# p = json.load(urllib.request.urlopen(API + '/api/p/haredit-6'))['project']
# L = {l['id']: l for l in p['layers']}
# items = {lid: [copy.deepcopy(i) for i in l['items']] for lid, l in L.items()}
# end = lambda i: i['from'] + i['dur']
# 
# def cut(c0, c1, shift_links=(), split_link=None, new_link=None):
#     """remove timeline frames [c0, c1): what starts at / after c1 (and every clip of shift_links) moves left by D;
#     split_link's clips crossing the cut become two (the second part a new group); what else crosses it gets shorter"""
#     D = c1 - c0
#     for lid, its in items.items():
#         out = []
#         for i in its:
#             if i.get('link') in shift_links or i['from'] >= c1:
#                 i['from'] -= D; out.append(i); continue
#             if end(i) <= c0: out.append(i); continue
#             if split_link and i.get('link') == split_link and i['from'] < c0 and end(i) > c1:
#                 a = dict(i); a['dur'] = c0 - i['from']
#                 b = dict(i); b['id'] = i['id'] + 'b'; b['link'] = new_link
#                 b['from'] = c0; b['dur'] = end(i) - c1
#                 if 'in' in i: b['in'] = round(i['in'] + (c1 - i['from']) / FPS * (i.get('rate') or 1), 3)
#                 out += [a, b]; continue
#             if i['from'] >= c0 and end(i) <= c1: continue          # wholly inside: gone
#             if i['from'] < c0 and end(i) > c1: i['dur'] -= D; out.append(i); continue
#             if i['from'] < c0: i['dur'] = c0 - i['from']; out.append(i); continue
#             i['dur'] = end(i) - c1; i['from'] = c0                   # starts inside: its tail stays
#             if 'in' in i: pass
#             out.append(i)
#         items[lid] = out
#     return D
# 
# def item(lid, iid):
#     return next(i for i in items[lid] if i['id'] == iid)
# 
# # --- 1) the breath between "בשבת" and "אז" (take 1667200F 6.38-6.69, his "cut the silence")
# pv = item('hani.video', 'p18')
# d = np.array(W['1667200F']['db10']); LOUD = np.percentile(d, 95) - 22
# s0 = 6.0 + next(k for k in range(60, 0, -1) if d[600 + k - 60 + 0] > LOUD) / 100 if False else None
# # loud end of "בשבת" and loud start of "אז" around 6.3-6.75
# seg = np.arange(620, 690)
# e_loud = max(j for j in seg if d[j] > LOUD and j < 650) / 100
# s_loud = min(j for j in seg if d[j] > LOUD and j > 650) / 100
# a_src, b_src = e_loud + 0.04, s_loud - 0.03
# c0 = pv['from'] + round((a_src - pv['in']) * FPS); c1 = pv['from'] + round((b_src - pv['in']) * FPS)
# print('breath', e_loud, s_loud, 'frames', c0, c1, 'cut', (c1 - c0) / FPS, 's')
# D1 = cut(c0, c1, split_link='g18', new_link='g18b')
# 
# # --- 2) the cut to the next clip after "גזל" (his mark, frame 5390 before this round's cut)
# mark = 5390 - D1
# p52 = item('hani.video', 'p52'); p53 = item('hani.video', 'p53')
# D2 = end(p52) - mark
# links53 = {i.get('link') for i in items['hani.video'] if i['from'] >= p53['from'] - 1}
# print('gazal cut', mark, 'remove', D2, 'frames')
# # the left clip ends at the mark (its voice keeps ~0.25 s past it), everything from the next clip on moves left
# for lid, its in items.items():
#     for i in its:
#         if i.get('link') == 'g52':
#             if lid.startswith('voice'): i['dur'] = min(end(i), mark + 8) - i['from']
#             else: i['dur'] = mark - i['from']
# cut(mark, mark + D2, shift_links=links53)
# for i in items['subs']:          # its subtitle ends with it
#     if i['from'] < mark < end(i): i['dur'] = mark - i['from']
# 
# # --- 3) the mother's first subtitles: two calm ones; "כאן" (not "כן")
# sm = sorted(items['subs.mom'], key=lambda i: i['from'])
# a, b, c = sm[0], sm[1], sm[2]
# a['text'] = "חנהל'ה! וו איז מיין סידור?!"; a['dur'] = c['from'] - a['from']
# items['subs.mom'] = [x for x in items['subs.mom'] if x['id'] != b['id']]
# for i in items['subs']:
#     if 'ואיפה זה כן' in i['text']: i['text'] = i['text'].replace('ואיפה זה כן', 'ואיפה זה כאן')
# 
# # --- ops
# ops = []
# for lid, its in items.items():
#     old = {i['id']: i for i in L[lid]['items']}
#     new = {i['id']: i for i in its}
#     for iid in old:
#         if iid not in new: ops.append({'op': 'item.remove', 'layer': lid, 'id': iid})
#     for iid, i in new.items():
#         if iid not in old: ops.append({'op': 'item.add', 'layer': lid, 'item': i})
#         elif i != old[iid]: ops.append({'op': 'item.update', 'layer': lid, 'id': iid, 'set': {k: i.get(k) for k in set(i) | set(old[iid]) if i.get(k) != old[iid].get(k)}})
# notes = [dict(n, at=n['at'] - (D1 if n['at'] >= c1 else 0)) for n in p.get('notes', [])]
# ops.append({'op': 'project', 'set': {'duration': p['duration'] - D1 - D2, 'notes': notes}})
# # checks: the strip has picture everywhere; no overlaps on a picture row
# probs = []
# for v in items['view']:
#     its = items[v['show']]
#     for f in range(v['from'], end(v)):
#         if not any(i['from'] <= f < end(i) for i in its): probs.append(('hole', v['id'], f)); break
# for lid in ('hani.video', 'hani.bg', 'voice', 'voice.2'):
#     s_ = sorted(items[lid], key=lambda i: i['from'])
#     for x, y in zip(s_, s_[1:]):
#         if end(x) > y['from']: probs.append(('overlap', lid, x['id'], y['id']))
# print(len(ops), 'ops', probs or 'checks ok')
# if not probs:
#     r = urllib.request.Request(API + '/api/p/haredit-6/ops', data=json.dumps({'rev': p['rev'], 'ops': ops}).encode(), method='POST', headers={'content-type': 'application/json'})
#     print(json.load(urllib.request.urlopen(r)).get('rev'))
