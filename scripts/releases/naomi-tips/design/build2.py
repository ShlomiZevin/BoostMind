"""naomi-tips-1 REDO (his notes 2026-11-25): her take from a split second after he presses record (the step back from the
lens is part of it, sped up on the way to the stool), the over-the-top institute set (S1, bar stool), her own face on the
wall + her roll-up banner + a real diploma, designed graphics (the identical "אל תצפו" ribbon, gold medallions, headline
bands, brochure panels with her-style illustrations), each reveal coming out of her hand with a sparkle at her gestures,
a beauty look + colour grade, end card, his 2 songs on 2 rows. Usage: build2.py [--go]"""
import json, os, shutil, subprocess, sys, urllib.request

ROOT = r"C:/workspace/BoostMind"; ZC = ROOT + "/zoomcut"; EP = "naomi-tips-1"
SCR = os.path.dirname(os.path.abspath(__file__)); GFX = SCR + "/gfx"
API = "http://127.0.0.1:4747"; FPS = 30
F = lambda s: int(round(s * FPS))
def req(m, u, b=None):
    r = urllib.request.Request(API + u, data=json.dumps(b).encode() if b is not None else None, method=m, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(r) as f: return json.loads(f.read().decode())
p = req("GET", f"/api/p/{EP}"); p = p.get("project", p)
if p["rev"] not in (4, 5, 6) and "--force" not in sys.argv:
    sys.exit(f"rev {p['rev']} - he may have edited it; look first")
media = os.path.join(ZC, "episodes", EP, "media")
DL = "C:/Users/shazbak/Downloads/"
FILES = {
    "naomi-institute-S1.jpg": ZC + "/episodes/_assets/naomi-tips/sets/naomi-institute-S1.jpg",
    "naomi-institute-S2.jpg": ZC + "/episodes/_assets/naomi-tips/sets/naomi-institute-S2.jpg",
    "song-enya-caribbean-blue.mp3": DL + "Enya - Caribbean Blue (Official 4K Music Video).mp3",
    "song-einaudi-experience.mp3": DL + "Ludovico Einaudi - Experience (Official Visualizer).mp3",
}
for f in os.listdir(GFX):
    if f.endswith(".png"): FILES["g-" + f] = GFX + "/" + f
ops = []
def probe(path, what):
    o = subprocess.run(["ffprobe", "-v", "error", "-show_entries", what, "-of", "csv=p=0", path], capture_output=True, text=True).stdout.strip()
    return o
for fn, src in FILES.items():
    dst = os.path.join(media, fn)
    shutil.copy2(src, dst)
    if fn.endswith(".mp3"):
        ops.append({"op": "asset.add", "id": "s." + fn, "asset": {"kind": "audio", "src": "media/" + fn, "duration": round(float(probe(dst, "format=duration")), 3), "label": fn}})
    else:
        w, h = map(int, probe(dst, "stream=width,height").split(",")[:2])
        ops.append({"op": "asset.add", "id": "m." + fn, "asset": {"kind": "image", "src": "media/" + fn, "w": w, "h": h, "label": fn}})

TAKE = "t.v1c044g50000dc3b38nog65rc0ktfseg"
# ---- her take: 216.0 (a split second after he presses record - his face at the lens) -> the step back (1x) -> the walk to
# the stool sped up 2.5x -> seated to before she gets up (297.5)
CLIPS = [(216.0, 220.5, 1.0), (220.5, 233.6, 2.5), (233.6, 297.5, 1.0)]
SC = 1.35
VBOX = {"x": round(551 - 335 * SC), "y": round(1075 - 1035 * SC), "w": round(720 * SC), "h": round(1280 * SC)}   # her hips on the velvet seat
tl_at, t = [], 0.0
vid = []
for i, (a, b, rate) in enumerate(CLIPS):
    d = (b - a) / rate
    vid.append({"id": f"nv{i}", "from": F(t), "dur": F(t + d) - F(t), "asset": TAKE, "in": a, "box": dict(VBOX), **({"rate": rate} if rate != 1 else {})})
    tl_at.append((a, b, rate, t)); t += d
FOOT_END = t
def T(src):   # take second -> timeline second
    for a, b, rate, t0 in tl_at:
        if a <= src <= b: return t0 + (src - a) / rate
    raise ValueError(src)
END_S = 3.0; DUR = F(FOOT_END + END_S)

R = {}
def row(id, kind, name, group=None, props=None, items=None):
    l = {"id": id, "kind": kind, "name": name, "props": props or {}, "items": items or []}
    if group: l["group"] = group
    R[id] = l; return l
k = 1.25
img2c = lambda x0, y0, x1, y1: {"x": round(x0 * k - 100), "y": round(y0 * k), "w": round((x1 - x0) * k), "h": round((y1 - y0) * k)}
span = lambda aid, box, name, rid, group: row(rid, "image", name, group, {}, [{"id": rid + "0", "from": 0, "dur": DUR, "asset": aid, "box": box, "pin": "span"}])
G_SET, G_ME, G_FX, G_GFX, G_END, G_MUS = "המכון", "נעמי", "מראה", "גרפיקה", "סיום", "מוזיקה"
span("m.naomi-institute-S1.jpg", {"x": -100, "y": 0, "w": 1280, "h": 1920}, "רקע – המכון (S1, כיסא בר)", "set", G_SET)
R["set"]["props"] = {"brightness": 1.0}
span("m.g-mag-left.png", img2c(284, 92, 390, 245), "על הקיר – שער מגזין (נפש)", "wall.magL", G_SET)
span("m.g-mag-right.png", img2c(790, 125, 890, 268), "על הקיר – שער מגזין (רגש+)", "wall.magR", G_SET)
span("m.g-photo-award.png", img2c(452, 350, 622, 487), "על הקיר – פרס מפעל חיים", "wall.photo", G_SET)
span("m.cert-doula.png", {"x": 634, "y": 690, "w": 176, "h": 188}, "על הקיר – תעודת דולה רגשית", "wall.cert", G_SET)
span("m.g-banner.png", img2c(18, 225, 280, 1205), "הרול-אפ שלה (כנס)", "wall.banner", G_SET)
row("naomi.video", "video", "נעמי", G_ME, {"fit": "cover", "cutout": True, "eyes": False, "matte_cut": 70, "side_ramp": False, "box": dict(VBOX),
                                          "look": {"saturate": 1.08, "contrast": 1.06, "brightness": 1.05}}, vid)
# the look: a warm cinematic grade + a soft vignette on the set and her (the graphics above stay clean)
row("fx.grade", "effect", "מראה – צבע קולנועי", G_FX, {"filter": "grade", "amount": 0.4}, [{"id": "gr0", "from": 0, "dur": F(FOOT_END), "fade_in": 0, "fade_out": 0}])
row("fx.vig", "effect", "מראה – וינייט", G_FX, {"filter": "vignette", "amount": 0.3}, [{"id": "vg0", "from": 0, "dur": F(FOOT_END), "fade_in": 0, "fade_out": 0}])

# ---- graphics. Hand points (canvas) from her outline: arm out to the right ~(850, 760); arm raised ~(700, 380)
HAND = {"right": (850, 760), "up": (700, 380), "lap": (560, 1000), "face": (540, 560)}
def reveal(box, d, hand, pop=1.06):
    cx, cy = box["x"] + box["w"] / 2, box["y"] + box["h"] / 2
    hx, hy = HAND[hand]
    return {"opacity": [[0, 0], [0.12, 1], [max(0.5, d - 0.3), 1], [d, 0]],
            "scale": [[0, 0.12], [0.42, pop], [0.6, 1], [max(0.61, d - 0.3), 1], [d, 0.94]],
            "x": [[0, round(hx - cx)], [0.45, 0]], "y": [[0, round(hy - cy)], [0.45, 0]]}
def sparkle_at(hand, at, size=360):
    hx, hy = HAND[hand]
    return {"from": F(at), "dur": F(1.0), "asset": "m.g-sparkle.png", "box": {"x": round(hx - size / 2), "y": round(hy - size / 2), "w": size, "h": size},
            "anim": {"opacity": [[0, 0], [0.1, 1], [0.6, 0.9], [1.0, 0]], "scale": [[0, 0.2], [0.35, 1.25], [1.0, 0.8]]}}
row("gfx.sparkle", "image", "קסם – ניצוצות מהיד", G_GFX)
row("gfx.ribbon", "image", "״אל תצפו״ (זהה בכל טיפ)", G_GFX)
row("gfx.medal", "image", "מספר הטיפ", G_GFX)
row("gfx.head", "image", "כותרת הטיפ", G_GFX)
row("gfx.panel", "image", "הסבר הטיפ (פרוספקט)", G_GFX)
row("gfx.four", "image", "פתיח – 4", G_GFX)
row("gfx.titleribbon", "image", "פתיח – ״אל תצפו״", G_GFX)
row("gfx.tband", "image", "פתיח – פס תחתון", G_GFX)
row("gfx.tline", "image", "פתיח – שכל מנהל HR", G_GFX)
row("gfx.tgz", "image", "פתיח – Gen Z", G_GFX)

# title: the "4" slams in as she steps back from the lens, the ribbon stamps, Gen Z pops when she sits
t1, t_sit, tip1 = 1.2, T(233.6) + 0.2, T(242.0)
FOURB = {"x": 390, "y": 18, "w": 300, "h": 300}
R["gfx.four"]["items"].append({"id": "f0", "from": F(t1), "dur": F(tip1 - 0.1) - F(t1), "asset": "m.g-four.png", "box": FOURB,
    "anim": {"opacity": [[0, 0], [0.15, 1], [tip1 - t1 - 0.4, 1], [tip1 - t1 - 0.1, 0]], "scale": [[0, 2.6], [0.3, 0.92], [0.45, 1]]}})
TRB = {"x": 260, "y": 282, "w": 560, "h": 176}
R["gfx.titleribbon"]["items"].append({"id": "tr0", "from": F(t1 + 0.5), "dur": F(tip1 - 0.1) - F(t1 + 0.5), "asset": "m.g-ribbon-title.png", "box": TRB,
    "anim": {"opacity": [[0, 0], [0.1, 1], [tip1 - t1 - 0.9, 1], [tip1 - t1 - 0.6, 0]], "scale": [[0, 1.6], [0.22, 0.95], [0.35, 1]]}})
# the bottom band hides the edge of his picture while he is close (from the first frame), the line pops at 1.2 s, Gen Z when she sits
BANDB = {"x": 0, "y": 1300, "w": 1080, "h": 520}
R["gfx.tband"]["items"].append({"id": "tb0", "from": 0, "dur": F(tip1 - 0.1), "asset": "m.g-tband.png", "box": BANDB,
    "anim": {"opacity": [[0, 1], [tip1 - 0.5, 1], [tip1 - 0.1, 0]]}})
TLB = {"x": 40, "y": 1420, "w": 1000, "h": 192}
R["gfx.tline"]["items"].append({"id": "tl0", "from": F(t1 + 0.3), "dur": F(tip1 - 0.1) - F(t1 + 0.3), "asset": "m.g-tline.png", "box": TLB,
    "anim": {"opacity": [[0, 0], [0.25, 1], [tip1 - t1 - 0.8, 1], [tip1 - t1 - 0.4, 0]], "y": [[0, 40], [0.3, 0]]}})
TGB = {"x": 318, "y": 1612, "w": 444, "h": 194}
R["gfx.tgz"]["items"].append({"id": "tg0", "from": F(t_sit), "dur": F(tip1 - 0.1) - F(t_sit), "asset": "m.g-tgz.png", "box": TGB,
    "anim": {"opacity": [[0, 0], [0.1, 1], [tip1 - 0.4 - t_sit, 1], [tip1 - 0.1 - t_sit, 0]], "scale": [[0, 0.1], [0.35, 1.18], [0.5, 1]]}})
HAND["gz"] = (540, 1700)
R["gfx.sparkle"]["items"] += [dict(sparkle_at("face", t1), id="sp0"), dict(sparkle_at("gz", t_sit), id="sp1")]

# the four tips: header (ribbon + medallion + headline) at her gesture, the brochure panel at the next one
TIPS = [  # header at, header hand, panel at, panel hand, end (take seconds)
    (242.0, "right", 244.0, "up", 255.9),
    (256.0, "lap", 257.8, "lap", 267.5),
    (267.6, "right", 270.0, "up", 281.5),
    (281.6, "right", 283.0, "right", 297.5),
]
RIBB = {"x": 300, "y": 58, "w": 560, "h": 176}
MEDB = {"x": 868, "y": 62, "w": 170, "h": 170}
HEADB = {"x": 40, "y": 240, "w": 1000, "h": 158}
PANB = {"x": 40, "y": 1420, "w": 1000, "h": 356}
for i, (ha, hh, pa, ph, e) in enumerate(TIPS):
    a, b, c = T(ha), T(pa), (T(e) if e < 297.5 else FOOT_END)
    d = c - a
    # the ribbon: the same piece, on screen from tip 1 to the end; it stamps (a pulse) at every new tip
    rd = (T(TIPS[i + 1][0]) if i + 1 < len(TIPS) else FOOT_END) - a
    R["gfx.ribbon"]["items"].append({"id": f"rb{i}", "from": F(a), "dur": F(a + rd) - F(a), "asset": "m.g-ribbon.png", "box": RIBB,
        "anim": (reveal(RIBB, rd, hh, 1.1) if i == 0 else {"scale": [[0, 1], [0.12, 1.14], [0.3, 1]]}) | ({"opacity": [[0, 1], [rd - 0.3, 1], [rd, 0]]} if i == len(TIPS) - 1 else {})})
    R["gfx.medal"]["items"].append({"id": f"md{i}", "from": F(a), "dur": F(c) - F(a), "asset": f"m.g-medal-{i + 1}.png", "box": MEDB,
        "anim": {"opacity": [[0, 0], [0.1, 1], [d - 0.3, 1], [d, 0]], "scale": [[0, 0.1], [0.35, 1.2], [0.5, 1]]}})
    R["gfx.head"]["items"].append({"id": f"hd{i}", "from": F(a + 0.15), "dur": F(c) - F(a + 0.15), "asset": f"m.g-head-{i + 1}.png", "box": HEADB,
        "anim": reveal(HEADB, c - a - 0.15, hh)})
    R["gfx.panel"]["items"].append({"id": f"pn{i}", "from": F(b), "dur": F(c) - F(b), "asset": f"m.g-panel-{i + 1}.png", "box": PANB,
        "anim": reveal(PANB, c - b, ph)})
    R["gfx.sparkle"]["items"] += [dict(sparkle_at(hh, a), id=f"sh{i}"), dict(sparkle_at(ph, b), id=f"sp{i}b")]
R["gfx.sparkle"]["items"].sort(key=lambda x: x["from"])
for x, y in zip(R["gfx.sparkle"]["items"], R["gfx.sparkle"]["items"][1:]):
    if x["from"] + x["dur"] > y["from"]: x["dur"] = y["from"] - x["from"]

# end card
row("end", "image", "סיום – הספר שלה", G_END, {}, [{"id": "e0", "from": F(FOOT_END), "dur": DUR - F(FOOT_END), "asset": "m.g-endcard.png",
    "box": {"x": 0, "y": 0, "w": 1080, "h": 1920}, "anim": {"opacity": [[0, 0], [0.35, 1]], "scale": [[0, 1.04], [3.0, 1]]}}])
# his two songs - only to choose by feel (he publishes with the platform's licensed music)
for lid, name, aid, muted in (("music.enya", "מוזיקה – Enya, Caribbean Blue (רק לבחירה)", "s.song-enya-caribbean-blue.mp3", False),
                              ("music.einaudi", "מוזיקה – Einaudi, Experience (רק לבחירה)", "s.song-einaudi-experience.mp3", True)):
    row(lid, "audio", name, G_MUS, {"volume": 0.8, "own_pace": True, "clean": "off"},
        [{"id": lid + "0", "from": 0, "dur": DUR, "asset": aid, "in": 0, "fade_in": 0.3, "fade_out": 2.0}])
    R[lid]["muted"] = muted

ORDER = ["set", "wall.magL", "wall.magR", "wall.photo", "wall.cert", "wall.banner", "naomi.video", "fx.grade", "fx.vig",
         "gfx.panel", "gfx.head", "gfx.ribbon", "gfx.medal", "gfx.tband", "gfx.tline", "gfx.tgz", "gfx.titleribbon", "gfx.four", "gfx.sparkle", "end",
         "music.enya", "music.einaudi"]
ops.append({"op": "project", "set": {"duration": DUR}})
for l in p["layers"]: ops.append({"op": "layer.remove", "id": l["id"]})
for i, rid in enumerate(ORDER): ops.append({"op": "layer.add", "index": i, "layer": R[rid]})
print("footage", round(FOOT_END, 2), "s, +end", END_S, "| title", round(t1, 1), "sit", round(t_sit, 1), "| tips at", [round(T(x[0]), 1) for x in TIPS])
json.dump(ops, open(SCR + "/ops2.json", "w", encoding="utf-8"), ensure_ascii=False)
if "--go" in sys.argv:
    r = req("POST", f"/api/p/{EP}/ops", {"rev": p["rev"], "ops": ops}); print({k: v for k, v in r.items() if k in ("ok", "rev", "error", "problems")})
