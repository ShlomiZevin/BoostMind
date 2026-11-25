"""naomi-tips-1 round 6 (his 6 notes, 2026-11-25): name caption bigger + "דולה רגשית" bigger/bolder, from after her face to
before the tips; the title gone at 13.4 s; tip 2 card at 255.73; tip 3 header at 268.93; every glow at her PALM (hand points
read off the frames, not the outline's far point = her elbow). Built on round 5:
- no speed changes anywhere: her take plays at 1x from the record moment to the end of tip 4's reading time
- the title once, in one place, for a long time (low, from the first frame to tip 1), the "4" on the RIGHT (RTL)
- her name on screen as she steps back: ד״ר נעמי־ציפורה בן־נון־פרידמן־שטרנבך / דולה רגשית (text layers)
- the explanation cards are TEXT layers now (his "full control"): a card shape, a separate small round illustration,
  the lead on a peach band, the paragraph - smaller; no "שיטת המחוג הפנימי"
- his timings: tip 1 header at 243.40, the push (card) at 244.53; tip 2 header at 254.47 (card on her next gesture)
- tip 3: the card unfolds with her sweep - the card, the lead, then each line right after the other, the illustration
  last when her hand reaches the left, a glow riding her hand
- the end: each card stays its reading time; her video ends at 292.5 (before the empty-room frame at ~294) and keeps
  playing under the end card's fade-in (no empty chair)
- the roll-up banner reaches the floor (nothing unclear under it)
Keeps his look and music rows. Usage: build5.py [--go]"""
import json, os, shutil, subprocess, sys, urllib.request
from PIL import ImageFont

ROOT = r"C:/workspace/BoostMind"; ZC = ROOT + "/zoomcut"; EP = "naomi-tips-1"
SCR = os.path.dirname(os.path.abspath(__file__)); G4, G5 = SCR + "/gfx4", SCR + "/gfx5"
API = "http://127.0.0.1:4747"; FPS = 30
F = lambda s: int(round(s * FPS))
def req(m, u, b=None):
    r = urllib.request.Request(API + u, data=json.dumps(b).encode() if b is not None else None, method=m, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(r) as f: return json.loads(f.read().decode())
p = req("GET", f"/api/p/{EP}"); p = p.get("project", p)
if p["rev"] not in (66,) and "--force" not in sys.argv:
    sys.exit(f"rev {p['rev']} - he may have edited it; look first")
KEEP = {l["id"]: l for l in p["layers"]}
media = os.path.join(ZC, "episodes", EP, "media")
ops = []
def probe(path):
    return subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", path], capture_output=True, text=True).stdout.strip()
for fn, src in [("g5-title3.png", G5 + "/title3.png")] + [(f"g5-illus-{n}.png", f"{G5}/illus-{n}.png") for n in range(1, 5)]:
    shutil.copy2(src, os.path.join(media, fn)); w, h = map(int, probe(os.path.join(media, fn)).split(",")[:2])
    ops.append({"op": "asset.add", "id": "m." + fn, "asset": {"kind": "image", "src": "media/" + fn, "w": w, "h": h, "label": fn}})
shutil.copy2(G5 + "/Heebo.ttf", os.path.join(media, "Heebo.ttf"))
ops.append({"op": "asset.add", "id": "font.heebo", "asset": {"kind": "font", "src": "media/Heebo.ttf", "family": "zc-heebo"}})

TAKE = "t.v1c044g50000dc3b38nog65rc0ktfseg"
A0, A1 = 216.0, 292.5                                   # the record moment -> tip 4's reading time; no speed change
FOOT_END = A1 - A0
T = lambda src: src - A0
END_S = 3.0; DUR = F(FOOT_END + END_S)
FULL = {"x": 0, "y": 0, "w": 1080, "h": 1920}

R = {}
def row(id, kind, name, group=None, props=None, items=None):
    l = {"id": id, "kind": kind, "name": name, "props": props or {}, "items": items or []}
    if group: l["group"] = group
    R[id] = l; return l
G_SET, G_GFX, G_CARD, G_END = "המכון", "גרפיקה", "כרטיס הסבר", "סיום"
row("set", "image", "רקע – המכון (S4, הכיסא מתחתיה)", G_SET, {"brightness": 1.0},
    [{"id": "set0", "from": 0, "dur": DUR, "asset": "m.naomi-institute-S4.jpg", "box": {"x": -262, "y": 0, "w": 1536, "h": 2304}, "pin": "span"}])
row("wall.banner", "image", "הרול-אפ שלה (כנס)", G_SET, {},
    [{"id": "wall.banner0", "from": 0, "dur": DUR, "asset": "m.g-banner.png", "box": {"x": -40, "y": 596, "w": 352, "h": 1316}, "pin": "span"}])
nv = dict(KEEP["naomi.video"])
nv["props"] = dict(nv["props"], box=dict(FULL), zoom=1, x=0, y=0)
nv["items"] = [{"id": "nv0", "from": 0, "dur": F(FOOT_END + 0.45), "asset": TAKE, "in": A0, "box": dict(FULL)}]   # runs under the end card's fade
R["naomi.video"] = nv

# ---- text measuring (Heebo, the same file the editor draws with)
FONT = G5 + "/Heebo.ttf"
def width(text, size, wght):
    f = ImageFont.truetype(FONT, size); f.set_variation_by_axes([wght]); return f.getlength(text)
def wrap(text, size, wght, maxw):
    lines, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if cur and width(t, size, wght) > maxw: lines.append(cur); cur = w
        else: cur = t
    return lines + ([cur] if cur else [])

BURG, INK, PEACH, CREAM = "#7a1630", "#5a1427", "#f9cbb7", "#fff7f1"
def txt(text, box, size, wght, color, **k):
    return {"text": text, "box": box, "style": "plain", "font": "font.heebo", "size": size, "weight": wght, "color": color,
            "align": k.get("align", "right"), "dir": "rtl", "lineHeight": k.get("lh", 1.3)}

# ---- rows
row("gfx.glow", "image", "קסם – הבזק אור מהיד", G_GFX)
row("gfx.title", "image", "פתיח – 4 ״אל תצפו״ שכל מנהל HR... (פעם אחת)", G_GFX)
row("name.bg", "shape", "שם – רקע", G_GFX); row("name.text", "text", "שם – ד״ר נעמי־ציפורה...", G_GFX)
row("name.tagbg", "shape", "שם – רקע תפקיד", G_GFX); row("name.tag", "text", "שם – דולה רגשית", G_GFX)
row("gfx.head", "image", "״אל תצפו״ + כותרת הטיפ (זהה בכל טיפ)", G_GFX)
for rid, kind, name in (("card.box", "shape", "כרטיס – רקע"), ("card.illus", "image", "כרטיס – איור"), ("card.leadbg", "shape", "כרטיס – פס מודגש"),
                        ("card.lead", "text", "כרטיס – משפט פתיחה")):
    row(rid, kind, name, G_CARD)
NL = 7
for k in range(NL): row(f"card.l{k}", "text", f"כרטיס – שורה {k + 1}", G_CARD)

def glow(at, hx, hy, size=520, dur=0.7, path=None):
    box = {"x": round(hx - size / 2), "y": round(hy - size / 2), "w": size, "h": size}
    it = {"id": f"gl{len(R['gfx.glow']['items'])}", "from": F(at), "dur": F(dur), "asset": "m.g4-glow.png", "box": box,
          "anim": {"opacity": [[0, 0], [0.08, 0.95], [dur, 0]], "scale": [[0, 0.3], [0.35, 1.3], [dur, 1.6]]}}
    if path:
        it["anim"] = {"opacity": [[0, 0], [0.12, 0.9], [dur - 0.3, 0.9], [dur, 0]], "scale": [[0, 0.5], [0.3, 1.0]],
                      "x": [[pt, round(px - hx)] for pt, px, py in path], "y": [[pt, round(py - hy)] for pt, px, py in path]}
    R["gfx.glow"]["items"].append(it)
def fade(d, k=0.3): return [[0, 0], [0.14, 1], [d - k, 1], [d, 0]]

# ---- the title: once, low (her face is up top at the lens), from the first frame to tip 1
TI = {"x": 160, "y": 1021, "w": 760, "h": 507}        # visible ~1066-1437
t_end = 403 / FPS                                     # his mark: the title goes here
R["gfx.title"]["items"].append({"id": "ti0", "from": F(0.1), "dur": F(t_end) - F(0.1), "asset": "m.g5-title3.png", "box": TI,
    "anim": {"opacity": [[0, 0], [0.12, 1], [t_end - 0.5, 1], [t_end - 0.1, 0]], "scale": [[0, 0.88], [0.25, 1.04], [0.4, 1]]}})

# ---- her name as she steps back (above her head - it is at y >= ~410 from 220.6 on)
n0, n1 = T(221.0), T(243.40) - 1.0                     # after her face (she stepped back), gone before tip 1
NAME, TAG = "ד״ר נעמי־ציפורה בן־נון־פרידמן־שטרנבך", "דולה רגשית"
NS, TS = 54, 50
nw = width(NAME, NS, 800); tw = width(TAG, TS, 900)
nb = {"x": round(540 - nw / 2 - 32), "y": 232, "w": round(nw + 64), "h": 92}
tb = {"x": round(540 - tw / 2 - 30), "y": 334, "w": round(tw + 60), "h": 74}
nanim = {"opacity": fade(n1 - n0), "y": [[0, -24], [0.3, 0]]}
R["name.bg"]["items"].append({"id": "nb0", "from": F(n0), "dur": F(n1) - F(n0), "box": nb, "fill": "rgba(255,247,241,0.94)", "radius": 46,
                              "shadow": "0 8px 22px rgba(122,22,48,.25)", "anim": nanim})
R["name.text"]["items"].append(dict(txt(NAME, {"x": 540, "y": 243, "w": round(nw + 20), "anchor": "t"}, NS, 800, BURG, align="center"),
                                    id="nt0", **{"from": F(n0), "dur": F(n1) - F(n0), "anim": nanim}))
tanim = {"opacity": [[0, 0], [0.3, 0], [0.45, 1], [n1 - n0 - 0.3, 1], [n1 - n0, 0]], "y": [[0, -24], [0.5, 0]]}
R["name.tagbg"]["items"].append({"id": "tg0", "from": F(n0), "dur": F(n1) - F(n0), "box": tb, "fill": BURG, "radius": 37, "anim": tanim})
R["name.tag"]["items"].append(dict(txt(TAG, {"x": 540, "y": 340, "w": round(tw + 20), "anchor": "t"}, TS, 900, "#ffffff", align="center"),
                                   id="tt0", **{"from": F(n0), "dur": F(n1) - F(n0), "anim": tanim}))

# ---- the tips
TIPS = [  # A (header), hand A, B (card), hand B, lead, paragraph
    (243.40, (720, 840), 244.53, (722, 770), "בטרימסטר הראשון",
     "השעון התעסוקתי עדיין לא מווסת. בססו טקס בוקר קבוע: מאצ׳ה על שיבולת, גלילת פיד וזמן בהייה. בשעת היציאה נטפל בהמשך."),
    (254.47, (356, 965), 255.73, (378, 850), "בשלב הנפרדות התעסוקתית",
     "הילד עדיין מתקשה להבחין בינו לבין ראש הצוות. הציגו את המנהל כעמית ותיק, ואת יחסי הכפיפות נבסס בהדרגה."),
    (268.93, (700, 945), None, None, "״וואו! יש פה חשיבה ממש מרעננת!״",
     "הילד מורגל בתקשורת עם AI המבוססת על תיקוף חיובי מתמיד. אמצו דפוסי תגובה דומים כדי לאפשר התקשרות. את העובדה שהרעיון לא ישים נחשוף בהדרגה."),
    (281.50, (800, 980), 284.00, (620, 1240), "בעקומת הגדילה התעסוקתית",
     "עצם ההסכמה שמשימה תהיה רשומה על שמו היא אבן דרך התפתחותית. הביצוע יגיע בשלב הבא. אל תדלגו על שלבים."),
]
HEAD = {"x": 110, "y": 250, "w": 860, "h": 341}; SMALL, DY = 0.721, -70
# the card, above her head (her hair from ~855): x 110-970, from y 462
CX0, CX1, CY0, CYMAX = 110, 970, 462, 846
ILL = 186; PADX, PADY = 30, 26
TX1 = CX1 - PADX; TX0 = CX0 + PADX + ILL + 26; TW = TX1 - TX0
LS, LW, PS, PW, PLH = 34, 800, 28, 600, 1.34
def come(box, hand):
    return round(hand[0] - (box["x"] + box["w"] / 2)), round(hand[1] - (box["y"] + box["h"] / 2))
HAND3 = [(270.0, 800, 760), (270.2, 780, 735), (270.6, 752, 710), (271.0, 742, 690), (271.4, 670, 675),
         (271.8, 565, 635), (272.2, 460, 657), (272.6, 407, 742), (272.9, 380, 800)]
for i, (A, ha, B, hb, lead, para) in enumerate(TIPS):
    a = T(A); e = T(TIPS[i + 1][0]) if i + 1 < len(TIPS) else FOOT_END
    b = T(B) if B else T(270.0)
    d, bb = e - a, b - a
    dx, dy = come(HEAD, ha)
    R["gfx.head"]["items"].append({"id": f"hd{i}", "from": F(a), "dur": F(e) - F(a), "asset": f"m.g4-head-{i + 1}.png", "box": HEAD,
        "anim": {"opacity": fade(d), "scale": [[0, 0.12], [0.4, 1.06], [0.56, 1], [bb, 1], [bb + 0.35, SMALL], [d, SMALL]],
                 "x": [[0, dx], [0.42, 0]], "y": [[0, dy], [0.42, 0], [bb, 0], [bb + 0.35, DY]]}})
    glow(a + 0.02, *ha)
    # the card's layout, measured
    lines = wrap(para, PS, PW, TW)
    assert len(lines) <= NL, (i, lines)
    lh = round(PS * PLH)
    lead_w = min(TW, width(lead, LS, LW)) + 24
    h_in = round(LS * 1.3) + 14 + lh * len(lines)
    ch = h_in + 2 * PADY
    cy0 = CY0 + max(0, (CYMAX - CY0 - ch) // 2) // 2
    card = {"x": CX0, "y": cy0, "w": CX1 - CX0, "h": ch}
    ill = {"x": CX0 + PADX, "y": cy0 + (ch - ILL) // 2 - 6, "w": ILL + 18, "h": ILL + 18}
    ly = cy0 + PADY
    leadbg = {"x": round(TX1 - lead_w), "y": ly + 4, "w": round(lead_w), "h": round(LS * 1.3) - 2}
    pieces = [("card.box", {"box": card, "fill": CREAM, "radius": 30, "stroke": "#d9a84e", "width": 3,
                            "shadow": "0 12px 34px rgba(122,22,48,.30)"}),
              ("card.illus", {"asset": f"m.g5-illus-{i + 1}.png", "box": ill}),
              ("card.leadbg", {"box": leadbg, "fill": PEACH, "radius": 10}),
              ("card.lead", txt(lead, {"x": TX1 - 12, "y": ly, "w": TW, "anchor": "tr"}, LS, LW, BURG))]
    for k, ln in enumerate(lines):
        pieces.append((f"card.l{k}", txt(ln, {"x": TX1, "y": ly + round(LS * 1.3) + 14 + k * lh, "w": TW, "anchor": "tr"}, PS, PW, INK, lh=1.2)))
    if B:   # the push: everything comes from her hand together, a short cascade on the lines
        bx, by = come(card, hb)
        for rid, it in pieces:
            st = b + (0.04 * int(rid[6:]) if rid[6:].isdigit() else 0)
            dd = e - st
            R[rid]["items"].append(dict(it, id=f"{rid}-{i}", **{"from": F(st), "dur": F(e) - F(st),
                "anim": {"opacity": fade(dd), "scale": [[0, 0.2], [0.4, 1.04], [0.58, 1]], "x": [[0, bx], [0.45, 0]], "y": [[0, by], [0.45, 0]]}}))
        glow(b + 0.02, *hb)
    else:   # tip 3: unfolds with her sweep - card, lead, the lines one after the other, the illustration when she reaches the left
        t0, t1 = T(270.0), T(272.6)
        seq = [p_ for p_ in pieces if p_[0] in ("card.box", "card.leadbg", "card.lead")] + [p_ for p_ in pieces if p_[0].startswith("card.l") and p_[0] not in ("card.leadbg", "card.lead")]
        steps = len(seq)
        for k, (rid, it) in enumerate(seq):
            st = t0 + (t1 - t0) * k / steps
            dd = e - st
            pop = {"scale": [[0, 0.6], [0.22, 1.06], [0.36, 1]], "x": [[0, 40], [0.3, 0]]} if rid != "card.box" else {"scale": [[0, 0.3], [0.3, 1.03], [0.45, 1]], "x": [[0, 260], [0.35, 0]]}
            R[rid]["items"].append(dict(it, id=f"{rid}-{i}", **{"from": F(st), "dur": F(e) - F(st), "anim": dict(pop, opacity=fade(dd, 0.3))}))
        rid, it = next(p_ for p_ in pieces if p_[0] == "card.illus")
        st = T(272.5); dd = e - st
        R[rid]["items"].append(dict(it, id=f"{rid}-{i}", **{"from": F(st), "dur": F(e) - F(st),
            "anim": {"opacity": fade(dd), "scale": [[0, 0.2], [0.35, 1.12], [0.5, 1]]}}))
        glow(t0, HAND3[0][1], HAND3[0][2], size=560, dur=HAND3[-1][0] - HAND3[0][0] + 0.3, path=[(ht - 270.0, hx, hy) for ht, hx, hy in HAND3])

R["gfx.glow"]["items"].sort(key=lambda x: x["from"])
for x, y in zip(R["gfx.glow"]["items"], R["gfx.glow"]["items"][1:]):
    if x["from"] + x["dur"] > y["from"]: x["dur"] = y["from"] - x["from"]

end = dict(KEEP["end"]); end["items"] = [dict(end["items"][0], **{"from": F(FOOT_END), "dur": DUR - F(FOOT_END)})]
R["end"] = end
for lid in ("fx.grade", "fx.vig"):
    l = dict(KEEP[lid]); l["items"] = [dict(l["items"][0], dur=F(FOOT_END + 0.45))]; R[lid] = l
for lid in ("music.enya", "music.einaudi"):
    l = dict(KEEP[lid]); l["items"] = [dict(l["items"][0], dur=DUR)]; R[lid] = l
ORDER = (["set", "wall.banner", "naomi.video", "fx.grade", "fx.vig", "card.box", "card.illus", "card.leadbg", "card.lead"]
         + [f"card.l{k}" for k in range(NL)]
         + ["gfx.head", "gfx.title", "name.bg", "name.text", "name.tagbg", "name.tag", "gfx.glow", "end", "music.enya", "music.einaudi"])
bad = []
for rid in ORDER:
    it = sorted(R[rid]["items"], key=lambda x: x["from"])
    for x, y in zip(it, it[1:]):
        if y["from"] < x["from"] + x["dur"]: bad.append((rid, x["id"], y["id"]))
ops.append({"op": "project", "set": {"duration": DUR}})
for l in p["layers"]: ops.append({"op": "layer.remove", "id": l["id"]})
for i, rid in enumerate(ORDER): ops.append({"op": "layer.add", "index": i, "layer": R[rid]})
print("footage", round(FOOT_END, 2), "| name", round(n0, 1), "-", round(n1, 1), "| tips A/B", [(round(T(x[0]), 1), round(T(x[2] or 270.0), 1)) for x in TIPS])
print("problems:", bad or "none")
if "--go" in sys.argv and not bad:
    r = req("POST", f"/api/p/{EP}/ops", {"rev": p["rev"], "ops": ops}); print({k: v for k, v in r.items() if k in ("ok", "rev", "error", "problems")})
