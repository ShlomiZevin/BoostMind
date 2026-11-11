"""EXAMPLE (savta-1, 2026-11-11) - the builder of recipes/dialogue-from-takes.md. Copy it to your scratchpad and change
the lists (MAIN, CALL, AV, MUSIC, the sets); it writes ops to the running studio. It is not a tool and not run from here.

savta-1 from his takes (v2 - his notes 2026-11-11, rounds 1-4). Every line a group (its video clip, its set, its voice,
its subtitles - one link); Avraham (the son, never seen) a voice row of his own; Lola's phone call with her sister under
Savta's first lines, seen now and then; the "What we see" strip; the TV and the music options.
Kept from the project as he left it: every row's settings (props, volumes, mutes), the speed, his framing of the first
Savta background and of Lola's fridge background. The takes' cut-out files come from _savta-1-takes (hard links).
Usage: build_v2.py"""
import json, os, re, subprocess, urllib.parse, urllib.request

ROOT = r"c:/workspace/BoostMind/zoomcut"
EP, SRC = "savta-1", "_savta-1-takes"
DROP = r"C:/Users/shazbak/Downloads/drop/סבתא ולולה"
API = "http://localhost:4747"
SCR = os.path.dirname(os.path.abspath(__file__))  # where the take word-timings JSON (savta-words.json) lives
FPS = 30
F = lambda s: int(round(s * FPS))
WORDS = json.load(open(os.path.join(SCR, "savta-words.json"), encoding="utf-8"))
T = {k[:8]: k for k in WORDS}
FIX = {"סוכמת": "סוכנת", "סיפולוקסקר": "סיפולוקס קר", "תדאם.": "תטעם.", "אכול": "אקום"}
FIX_TAKE = {("2EDDED08", "לי."): "היא."}  # his note: "שתאכל היא"
JOIN = {("לא", "לה."): "לולה."}

# ---- the cut (his rules: the later take of a line said twice; every turn overlaps; Savta right on her words)
# entry: who, take, a, b (take seconds), set; placed after the one before (over = seconds before it ends), or
# with_=(back, seconds) = at that earlier entry's start + seconds (adv=True: what follows comes after this one)
TURN = 0.7
AV = {1: "rec-173007", 2: "rec-173103", 3: "rec-173910", 4: "rec-174044", 5: "rec-175347"}  # Avraham's recordings, his numbering
AVT = 1.2  # Avraham's row plays at 1.2x, pitch kept (his note: no room for him -> speed his sound up)
# his rules (2026-11-11): talk over each other like real life, never wait for the other to finish; never show him
# starting / stopping the recording (a clip starts <= 0.3 s before the first word, ends <= 0.2 s after the last);
# Lola's silences cut, and between two cut pieces the strip is on Savta so the cut isn't seen; >= 1 s a shot.
L3_PIECES = [(0.67, 5.30), (5.60, 9.30), (9.75, 10.95)]
L4_PIECES = [(1.05, 3.30), (3.70, 5.75), (6.20, 9.72), (10.43, 13.85)]
MAIN = [
    dict(who="savta", take="27F2736A", a=0.75, b=9.92, set="savta-salon"),           # 0 "מה?? ... סוכנת איראנית." one go
    dict(who="avram", take=AV[1], a=0.75, b=2.15, with_=(-1, 0.0),                 # 1 her "מה?" lands on his last word
         subs=[(0.75, "שמעת על המקררים והאיראנים?")]),
    dict(who="avram", take=AV[4], a=0.50, b=2.05, with_=(-2, 1.26),                # 2 in her pause after "מה?", she echoes over his end
         subs=[(0.55, "האיראנים פרצו למקררים")]),
    dict(who="avram", take=AV[5], a=0.85, b=2.20, with_=(-3, 8.72),                # 3 on the "ית" of "איראנית"
         subs=[(0.95, "עוד פעם עם השטויות שלך?")]),
    dict(who="savta", take="66A92FC7", a=1.12, b=9.50, set="savta-salon", with_=(-4, 9.21), adv=True),  # 4 "זה לא שטויות..." over his end
    dict(who="avram", take=AV[2], a=0.40, b=1.85, with_=(-1, 7.89),                # 5 over her "עם המקרר?"
         subs=[(0.45, "היא אומרת שזאת אחותה מריסל!")]),
    dict(who="savta", take="645D8C1D", a=0.95, b=13.66, set="savta-salon", with_=(-2, 8.39), adv=True),  # 6 "נו..." over his end
    dict(who="savta", take="2EDDED08", a=0.77, b=5.90, set="savta-salon"),           # 7 "אתמול ... שתאכל היא."
    dict(who="savta", take="2B4BFD6C", a=0.77, b=4.74, set="savta-salon"),           # 8 "ומה אתה חושב? ..."
    dict(who="lola", take="34F35FFD", a=0.65, b=5.95, set="lola-fridge", over=TURN,  # 9
         subs=[(0.9, "אמא!"), (1.62, "You want some chicken?"), (4.72, "I make you!")]),
    dict(who="savta", take="2B4BFD6C", a=5.05, b=12.62, set="savta-salon", over=TURN),  # 10 "לא, לולה, תודה..."
    dict(who="lola", take="485EB445", a=0.95, b=4.58, set="lola-fridge", over=TURN,  # 11
         subs=[(1.2, "אוקיי, אמא!"), (2.22, "I bring!"), (2.84, "I bring you סודה!")]),
    dict(who="lola", take="33D91E6D", a=1.00, b=2.35, set="lola-salon", subs=[(1.05, "בבקשה, אמא!")]),  # 12 tight on 11
    dict(who="savta", take="28F28C0E", a=0.73, b=7.80, set="savta-salon", over=0.5),  # 13 ends on "תטעם"
    dict(who="avram", take=AV[3], a=0.55, b=2.05, with_=(-1, 6.63),                # 14 on her "תטעם"
         subs=[(0.6, "בטח שאני איתה, למה לשפוך את זה?")]),
    dict(who="lola", take="79ADAB63", a=0.67, b=10.95, set="lola-salon", with_=(-2, 7.07), adv=True, pieces=L3_PIECES,  # 15
         subs=[(1.1, "אמא, אמרתי לך!"), (3.02, "מקרר no good!"), (5.6, "No, no, מקרר!"), (7.5, "צריך new refrigerator!")]),
    dict(who="savta", take="E2FE7BA8", a=0.55, b=10.08, set="savta-salon", over=1.45),  # 16 in over "refrigerator"
    dict(who="lola", take="B876B19A", a=1.05, b=13.85, set="lola-salon", with_=(-1, 4.75), pieces=L4_PIECES,  # 17 from "אתה רואה"
         subs=[(1.3, "אמא, מאז התרופות..."), (3.70, "little bit luka-luka."), (6.2, "Refrigerator, no מקרר..."), (10.43, "אמא לא רוצה מחליף!")]),
    dict(who="savta", take="C11833A6", a=0.62, b=6.72, set="savta-salon", with_=(-2, 10.0), adv=True),  # 18 Savta last
]
# Lola's phone call: each phrase once, spread evenly under Savta's words (his note); seen = whole clip, loud, Savta dipped a little
CALL = [  # (take, a, b, main index, take second of that line, seen[, gain])
    ("B22988EE", 1.30, 3.55, 0, 9.40, True, 0.75),  # "הלו, מריסה?" on the "ית" of "איראנית", under Avraham
    ("77B879BC", 1.20, 2.40, 4, 3.98, True),   # "hindi, hindi"    "כל היום מנהלת שיחות" (after "לולה")
    ("B22988EE", 4.55, 5.92, 4, 7.00, True),   # "oho..."          "מה יש לה לדבר עם המקרר?"
    ("77B879BC", 3.35, 4.62, 6, 2.60, True),   # "oo, sandali lang" "שזאת אחותה מריסל"
    ("77B879BC", 4.60, 5.65, 6, 7.25, True),   # "sandali lang"    "אף פעם לא ראיתי..."
    ("77B879BC", 6.10, 8.20, 6, 10.66, True),  # "almaku"          "לדעתי זה בכלל המפעיל האיראני שלה"
]
BEAT = ("77B879BC", 8.75, 11.70)
BYE = (7, 5.08, 10.72)  # her "bye bye" (take s 10.72) on Savta's "שתאכל היא" (main 7, take s 5.08)
BYE_SUB = (10.7, "Bye bye. Sige!")
QUIET, SEEN, DUCK = 0.3, 1.0, -2  # his note: Savta louder when Lola is seen - a small dip only
TV_IN = 8.0
MUSIC = [  # (file, row name, loudness dB) - our own options, one row each
    ("music-savta-a-loop.wav", "מוזיקה – סבתא A: קייפר פרנואידי (שלנו, חדש)", -21.4),
    ("music-savta-b-loop.wav", "מוזיקה – סבתא B: מתח של טלנובלה זולה (שלנו, חדש)", -18.8),
    ("music-paranoid-caper-loop.wav", "מוזיקה – Paranoid caper (שלנו, מאסף)", -17.1),
    ("music-waiting-tiptoe-loop.wav", "מוזיקה – Waiting tiptoe (שלנו, משגיא)", -18.6),
    ("music-fidgety-caper-loop.wav", "מוזיקה – Fidgety caper (שלנו, מאיתי)", -22.0),
    ("music-savta-c-loop.wav", "מוזיקה – סבתא C: קומדיה עצובה, טרגיקומי (שלנו, חדש)", -16.1),
    ("music-savta-d-loop.wav", "מוזיקה – סבתא D: קומדיה עצובה, החיים הקטנים (שלנו, חדש)", -23.3),
    ("music-savta-e-loop.wav", "מוזיקה – סבתא E: חשדני מצויר, טיפטוף פיציקטו (שלנו, חדש)", -18.0),
    ("music-savta-f-loop.wav", "מוזיקה – סבתא F: בלש מצויר, בס מהלך (שלנו, חדש)", -15.3),
    ("music-savta-g-loop.wav", "מוזיקה – סבתא G: התגנבות מצוירת, טובה וקלרינט (שלנו, חדש)", -19.2),
]


def req(method, url, body=None, raw=None, ctype="application/json"):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    r = urllib.request.Request(API + url, data=data, method=method, headers={"Content-Type": ctype})
    with urllib.request.urlopen(r) as f:
        return json.loads(f.read().decode())


def heard(take, a, b):
    """Savta's heard words inside [a, b] as subtitle chunks (take seconds): a chunk ends on punctuation or at 4 words"""
    ws = [list(w) for w in WORDS[T[take]] if w[0] >= a - 0.05 and w[1] <= b + 0.05]
    i = 0
    while i < len(ws):
        w = ws[i][2].strip()
        if i + 1 < len(ws) and (w, ws[i + 1][2].strip()) in JOIN:
            ws[i] = [ws[i][0], ws[i + 1][1], JOIN[(w, ws[i + 1][2].strip())]]; del ws[i + 1]; continue
        ws[i][2] = FIX_TAKE.get((take, w)) or FIX.get(w, w); i += 1
    if take == "2B4BFD6C":
        for i in range(len(ws) - 2):
            if [x[2] for x in ws[i:i + 3]] == ["לא,", "לא,", "לא,"]:
                ws[i + 1] = [ws[i + 1][0], ws[i + 2][1], "לולה,"]
                del ws[i + 2]
                break
    out, cur = [], []
    for w in ws:
        cur.append(w)
        if re.search(r"[.?!]$", w[2]) or (w[2].endswith(",") and len(cur) >= 3) or len(cur) == 4:  # no 1-word flashes
            out.append(cur); cur = []
    if cur:
        out.append(cur)
    joined = []  # a 1-2 word end of a sentence goes with the words before it (no flash)
    for c in out:
        if joined and len(c) <= 2 and not re.search(r"[.?!]$", joined[-1][-1][2]) and len(joined[-1]) + len(c) <= 6:
            joined[-1] = joined[-1] + c
        else:
            joined.append(c)
    return [(c[0][0], " ".join(x[2] for x in c).rstrip(",")) for c in joined]


proj = lambda j: j.get("project", j)
src = proj(req("GET", f"/api/p/{SRC}"))
p = proj(req("GET", f"/api/p/{EP}"))
lay = {l["id"]: l for l in p["layers"]}
takes = {k: v for k, v in src["assets"].items() if v.get("kind") == "video"}
for k, a in takes.items():  # the takes' files (hard links)
    for f in ("audio", "preview", "fg", "matte"):
        if a.get(f):
            s, d = os.path.join(ROOT, "episodes", SRC, a[f]), os.path.join(ROOT, "episodes", EP, a[f])
            os.makedirs(os.path.dirname(d), exist_ok=True)
            if not os.path.exists(d):
                os.link(s, d)
ops = []
used = {m["take"] for m in MAIN} | {c[0] for c in CALL} | {BEAT[0]}
for k, a in takes.items():
    have = p["assets"].get(k, {})
    keep = {x: have[x] for x in ("mark", "note") if x in have}
    if any(u in k for u in used):
        keep["mark"] = "use"
    ops.append({"op": "asset.add", "id": k, "asset": {**a, **keep}})
# Avraham's recordings: WAV copies in media/, one asset each
av_asset = {}
for n, name in AV.items():
    fn = f"avram-{n}-{name}.wav"
    dst = os.path.join(ROOT, "episodes", EP, "media", fn)
    if not os.path.exists(dst):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(DROP, name + ".m4a"), "-ac", "1", "-ar", "48000", dst], check=True)
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", dst], capture_output=True, text=True).stdout)
    av_asset[name] = "s." + fn
    ops.append({"op": "asset.add", "id": "s." + fn, "asset": {"kind": "audio", "src": "media/" + fn, "duration": round(dur, 3), "label": f"Avraham {n}"}})
ops += [{"op": "layer.remove", "id": l} for l in ("open", "savta.standin", "lola.standin") if l in lay]

L = {i: dict(lay[i], items=[]) for i in ("savta.bg", "savta.video", "voice.savta", "lola.bg", "lola.video", "voice.lola", "subs", "subs.lola", "view")}
new_rows = []
if "voice.avram" in lay:
    L["voice.avram"] = dict(lay["voice.avram"], items=[], props=dict(lay["voice.avram"]["props"], tempo=AVT))
else:
    L["voice.avram"] = {"id": "voice.avram", "kind": "audio", "name": "קול - אברהם (לא רואים)", "group": "אברהם",
                        "props": {"volume": 0.85, "voice": {"preset": "natural", "lowcut": 90, "warmth": 3, "box": 0, "presence": 1.5,
                                  "deess": 0, "comp": 0.4, "room": 0.18, "roomSize": 0.9}, "clean": "strong", "level": "speech"}, "items": []}
    new_rows.append(("voice.avram", "voice.lola"))
if "subs.avram" in lay:
    L["subs.avram"] = dict(lay["subs.avram"], items=[], props=dict(lay["subs.avram"]["props"], color="#7fd6ff"))
else:
    sp = json.loads(json.dumps(lay["subs"]["props"]))
    sp["box"] = dict(sp.get("box", {}), y=1110)
    sp["color"] = "#7fd6ff"  # his note: Avraham in another colour
    L["subs.avram"] = {"id": "subs.avram", "kind": "subtitles", "name": "Subtitles - אברהם", "props": sp, "items": []}
    new_rows.append(("subs.avram", "subs.lola"))
for rid, after in new_rows:
    ops.append({"op": "layer.add", "layer": dict(L[rid]), "index": p["layers"].index(lay[after]) + 1})

setid = {s: next(k for k, a in p["assets"].items() if a.get("kind") == "image" and s in k) for s in ("savta-salon", "lola-fridge", "lola-salon")}
his_fridge = next((dict(i["box"]) for i in lay["lola.bg"]["items"] if i.get("asset") == setid["lola-fridge"] and i.get("box", {}).get("x") == -412), None)
BOX = {"savta-salon": dict(lay["savta.bg"]["items"][0]["box"]),                       # his framing
       "lola-fridge": his_fridge or {"x": -412, "y": -703, "w": 3000, "h": 4500},       # his setup on the chicken clip
       "lola-salon": {"x": -260, "y": 0, "w": 1600, "h": 2400}}
VBOX = {"x": 0, "y": 0, "w": 1080, "h": 1920}
tid = lambda short: next(k for k in takes if short in k)
n = 0
speech, spans = [], []  # (who, frame a sentence starts) / (who, from, to) of the seen lines - for the strip


def place(who, take, a, b, setname, t, subs=None, gain=None):
    """one group at timeline second t: video + set + voice (+ subtitles), linked; Avraham = voice + subtitles only"""
    global n
    sp = AVT if who == "avram" else 1.0
    k, fa, fd = f"k.{who}.{n}", F(t), F(t + (b - a) / sp) - F(t)
    if who != "avram":
        L[f"{who}.bg"]["items"].append({"id": f"b{n}", "from": fa, "dur": fd, "link": k, "asset": setid[setname], "box": dict(BOX[setname])})
        L[f"{who}.video"]["items"].append({"id": f"p{n}", "from": fa, "dur": fd, "link": k, "asset": tid(take), "in": a, "box": dict(VBOX)})
    v = {"id": f"v{n}", "from": fa, "dur": fd, "link": k, "asset": av_asset[take] if who == "avram" else tid(take), "in": a,
         "fade_in": 0.01, "fade_out": 0.01}
    if gain is not None:
        v["gain"] = gain
    L[f"voice.{who}"]["items"].append(v)
    row = {"savta": "subs", "lola": "subs.lola", "avram": "subs.avram"}[who]
    for j, (c0, text) in enumerate(subs or []):
        st = F(t + (c0 - a) / sp)
        en = F(t + (subs[j + 1][0] - a) / sp) if j + 1 < len(subs) else F(t + (b - a) / sp) - 2
        L[row]["items"].append({"id": f"s{n}.{j}", "from": st, "dur": max(1, en - st), "text": text, "link": k})
        if who != "avram" and (gain is None or gain >= 1) and (j == 0 or re.search(r"[.?!]$", subs[j - 1][1])):
            speech.append((who, st))
    n += 1
    return fa, fd, v


t, starts, ends = 0.0, [], []
maps = []  # per main line: [(take a, take b, timeline start)] - for take -> timeline
for i, m in enumerate(MAIN):
    if "with_" in m:
        back, off = m["with_"]
        tt = starts[i + back] + off
    else:
        tt = t - m.get("over", 0)
    subs = m.get("subs") or heard(m["take"], m["a"], m["b"])
    pieces = m.get("pieces") or [(m["a"], m["b"])]
    sp = AVT if m["who"] == "avram" else 1.0
    mp, cur = [], tt
    for (a, b) in pieces:
        mp.append((a, b, cur))
        cur += (b - a) / sp
    # the subtitles on the cut line: each starts where its words are, ends where the next starts (or the line ends)
    tl = lambda x: next((s + (x - a) / sp for (a, b, s) in mp if a - 0.01 <= x < b + 0.01), None)
    for (a, b, s) in mp:
        fa, fd, _ = place(m["who"], m["take"], a, b, m.get("set"), s, [])
        if m["who"] != "avram":
            spans.append((m["who"], fa, fa + fd))
    row = {"savta": "subs", "lola": "subs.lola", "avram": "subs.avram"}[m["who"]]
    for j, (c0, text) in enumerate(subs):
        s0 = tl(c0)
        if s0 is None:
            s0 = next((s for (a, b, s) in mp if a > c0), mp[0][2])
        s1 = tl(subs[j + 1][0]) if j + 1 < len(subs) else cur - 0.07
        s1 = s1 if s1 is not None else cur - 0.07
        st, en = F(s0), F(s1)
        L[row]["items"].append({"id": f"s{n}.{i}.{j}", "from": st, "dur": max(1, en - st), "text": text, "link": f"k.{m['who']}.{n - len(mp) + next(k for k, (a, b, s) in enumerate(mp) if s <= s0 + 1e-6 and (k == len(mp) - 1 or mp[k + 1][2] > s0))}"})
        if m["who"] != "avram" and (j == 0 or re.search(r"[.?!]$", subs[j - 1][1])):
            speech.append((m["who"], st))
    maps.append(mp)
    starts.append(tt)
    ends.append(cur)
    if "with_" not in m or m.get("adv"):
        t = cur
at = lambda i, x: next((s + x - a for (a, b, s) in maps[i] if a - 0.01 <= x <= b + 0.01), starts[i] + x - MAIN[i]["a"])
# her phone call
shows = []
for c in CALL:
    tk, a, b, i, x, seen = c[:6]
    fa, fd, v = place("lola", tk, a, b, "lola-fridge", at(i, x), gain=(c[6] if len(c) > 6 else SEEN) if seen else QUIET)
    if seen:
        v.update(duck=DUCK, duck_layers=["voice.savta"])
        shows.append((fa, fa + fd))
bye_t = at(*BYE[:2])
cut = BYE[2] - 0.08
place("lola", BEAT[0], BEAT[1], cut, "lola-fridge", bye_t - (BYE[2] - BEAT[1]), gain=QUIET)  # "sige, sige" - quiet
fa, fd, v = place("lola", BEAT[0], cut, BEAT[2], "lola-fridge", bye_t - 0.08, subs=[BYE_SUB], gain=SEEN)  # "bye bye" - seen
v.update(duck=DUCK, duck_layers=["voice.savta"])
shows.append((fa, fa + fd))
END = F(max(ends))  # ends on the last frame of the last line
# the strip: one seen line = that one; two at once = whoever started a sentence last (>= 0.7 s a shot); her calls on top
who_at = []
for f in range(END):
    on = [s for s in spans if s[1] <= f < s[2]]
    if not on:
        who_at.append(who_at[-1] if who_at else "savta"); continue
    if len({s[0] for s in on}) == 1:
        who_at.append(on[0][0]); continue
    last = max((x for x in speech if x[1] <= f and any(x[0] == s[0] for s in on)), key=lambda x: x[1], default=None)
    who_at.append(last[0] if last else on[-1][0])
for a, b in shows:
    for f in range(a, min(b, END)):
        who_at[f] = "lola"
END_SAVTA = 1.0  # the last second on Savta - she has the last word
has = lambda w, a, b: all(any(it["from"] <= f < it["from"] + it["dur"] for it in L[f"{w}.video"]["items"]) for f in range(max(0, a), min(b, END)))
for i, m in enumerate(MAIN):
    if m["who"] == "lola" and len(maps[i]) > 1:
        for (a, b, s) in maps[i][1:]:
            j0, j1 = F(s) - 15, F(s) + 15
            if has("savta", j0, j1):
                for f in range(max(0, j0), min(j1, END)):
                    who_at[f] = "savta"
if has("savta", END - F(END_SAVTA), END):
    for f in range(END - F(END_SAVTA), END):
        who_at[f] = "savta"
runs = []
for f, w in enumerate(who_at):
    if runs and runs[-1][0] == w:
        runs[-1][2] = f + 1
    else:
        runs.append([w, f, f + 1])
merged = []
for r in runs:
    if merged and (merged[-1][0] == r[0] or (r[2] - r[1] < 1.0 * FPS and has(merged[-1][0], r[1], r[2]))):  # >= 1 s; never no picture
        merged[-1][2] = r[2]
    else:
        merged.append(list(r))
L["view"]["items"] = [{"id": f"w{i}", "from": a, "dur": b - a, "show": f"{w}.video"} for i, (w, a, b) in enumerate(merged)]


def loop_items(asset, sec, prefix, start_in=0.0):
    out, f, k, cur = [], 0, 0, start_in
    while f < END:
        d = min((sec - cur) * FPS, END - f)
        out.append({"id": f"{prefix}{k}", "from": round(f, 3), "dur": round(d, 3), "asset": asset, "in": round(cur, 3), "fade_in": 0, "fade_out": 0})
        f += d; k += 1
        cur = cur + d / FPS
        if cur >= sec - 1e-6:
            cur = 0.0
    return out


tvl = lay["tv"]
L["tv"] = dict(tvl, items=loop_items(tvl["items"][0]["asset"], p["assets"][tvl["items"][0]["asset"]]["duration"], "t", TV_IN))
ml = lay["music"]
L["music"] = dict(ml, items=loop_items(ml["items"][0]["asset"], p["assets"][ml["items"][0]["asset"]]["duration"], "m"))
ops.append({"op": "project", "set": {"duration": END}})
for rid, l in L.items():
    if rid in lay:
        ops.append({"op": "layer.replace", "layer": l})
    else:
        ops.append({"op": "layer.replace", "layer": l})  # (added above, filled here)
for j, (fn, name, db) in enumerate(MUSIC):
    aid, lid = "s." + fn, f"music.{j + 1}"
    dur = p["assets"].get(aid, {}).get("duration") or float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                                                                             os.path.join(ROOT, "episodes", EP, "media", fn)], capture_output=True, text=True).stdout)
    if lid in lay:
        ops.append({"op": "layer.replace", "layer": dict(lay[lid], items=loop_items(aid, dur, f"m{j + 1}."))})
r = req("POST", f"/api/p/{EP}/ops", {"rev": p["rev"], "ops": ops})
print("ops", r.get("ok"), r.get("rev"), r.get("error"), r.get("problems"), "length", round(END / FPS, 2), "s,",
      len(MAIN), "lines,", len(L["view"]["items"]), "strip cuts")
