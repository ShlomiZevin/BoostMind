"""naomi-tips-1 round 3 (his notes 2026-11-25): her strip in the middle of the screen (his zoom / y kept), the institute
set S3 with the stool in the middle under her and no photos of faces behind her (a wall of diplomas only; the roll-up
banner stays), and every piece of type designed by GPT Image in the look of her first release's story posters: the
title as one readable sentence (story-poster lockup), the identical "אל תצפו" header per tip (top), a brochure card
per tip (bottom), and the end card = her invitation to organisations (מאונבורדינג לבונדינג). Hebrew checked letter by
letter (card 4's band word patched from card 2). Keeps his naomi.video, look and music rows as they are.
Usage: build3.py [--go]"""
import json, os, shutil, subprocess, sys, urllib.request

ROOT = r"C:/workspace/BoostMind"; ZC = ROOT + "/zoomcut"; EP = "naomi-tips-1"
SCR = os.path.dirname(os.path.abspath(__file__)); GFX = SCR + "/gfx3"
API = "http://127.0.0.1:4747"; FPS = 30
F = lambda s: int(round(s * FPS))
def req(m, u, b=None):
    r = urllib.request.Request(API + u, data=json.dumps(b).encode() if b is not None else None, method=m, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(r) as f: return json.loads(f.read().decode())
p = req("GET", f"/api/p/{EP}"); p = p.get("project", p)
if p["rev"] not in (16, 17) and "--force" not in sys.argv:
    sys.exit(f"rev {p['rev']} - he may have edited it; look first")
KEEP = {l["id"]: l for l in p["layers"]}
media = os.path.join(ZC, "episodes", EP, "media")
FILES = {"naomi-institute-S3.jpg": ZC + "/episodes/_assets/naomi-tips/sets/naomi-institute-S3.jpg"}
for f in os.listdir(GFX):
    FILES["g3-" + f] = GFX + "/" + f
ops = []
def probe(path):
    return subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", path], capture_output=True, text=True).stdout.strip()
for fn, src in FILES.items():
    dst = os.path.join(media, fn)
    shutil.copy2(src, dst)
    w, h = map(int, probe(dst).split(",")[:2])
    ops.append({"op": "asset.add", "id": "m." + fn, "asset": {"kind": "image", "src": "media/" + fn, "w": w, "h": h, "label": fn}})

CLIPS = [(216.0, 220.5, 1.0), (220.5, 233.6, 2.5), (233.6, 297.5, 1.0)]   # as in round 2 (his take, unchanged)
tl_at, t = [], 0.0
for a, b, rate in CLIPS:
    tl_at.append((a, b, rate, t)); t += (b - a) / rate
FOOT_END = t
def T(src):
    for a, b, rate, t0 in tl_at:
        if a <= src <= b: return t0 + (src - a) / rate
    raise ValueError(src)
END_S = 3.0; DUR = F(FOOT_END + END_S)

R = {}
def row(id, kind, name, group=None, props=None, items=None):
    l = {"id": id, "kind": kind, "name": name, "props": props or {}, "items": items or []}
    if group: l["group"] = group
    R[id] = l; return l
G_SET, G_GFX, G_END = "המכון", "גרפיקה", "סיום"
# the set: S3's stool (image x 545) lands under her hips (canvas ~530)
SET_X, k = -151, 1.25
row("set", "image", "רקע – המכון (S3, הכיסא באמצע)", G_SET, {"brightness": 1.0},
    [{"id": "set0", "from": 0, "dur": DUR, "asset": "m.naomi-institute-S3.jpg", "box": {"x": SET_X, "y": 0, "w": 1280, "h": 1920}, "pin": "span"}])
row("wall.banner", "image", "הרול-אפ שלה (כנס)", G_SET, {},
    [{"id": "wall.banner0", "from": 0, "dur": DUR, "asset": "m.g-banner.png",
      "box": {"x": round(18 * k + SET_X), "y": round(225 * k), "w": round(262 * k), "h": round(980 * k)}, "pin": "span"}])

HAND = {"right": (850, 760), "up": (700, 380), "lap": (560, 1000), "face": (540, 560), "gz": (540, 1700)}
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
row("gfx.title", "image", "פתיח – 4 ״אל תצפו״ שכל מנהל HR... (משפט אחד)", G_GFX)
row("gfx.head", "image", "״אל תצפו״ + כותרת הטיפ (זהה בכל טיפ)", G_GFX)
row("gfx.body", "image", "הסבר הטיפ (פרוספקט)", G_GFX)

# title: one sentence, on from the first frame (it also hides the bottom edge of his picture while he is at the lens),
# a pulse + sparkle when she sits
t1, t_sit, tip1 = 1.2, T(233.6) + 0.2, T(242.0)
TITLEB = {"x": 20, "y": 1196, "w": 1040, "h": 693}
d = tip1 - 0.1
R["gfx.title"]["items"].append({"id": "ti0", "from": 0, "dur": F(d), "asset": "m.g3-title.png", "box": TITLEB,
    "anim": {"opacity": [[0, 1], [d - 0.4, 1], [d, 0]],
             "scale": [[0, 0.94], [0.25, 1.03], [0.4, 1], [t_sit, 1], [t_sit + 0.15, 1.05], [t_sit + 0.35, 1]]}})
R["gfx.sparkle"]["items"] += [dict(sparkle_at("face", t1), id="sp0"), dict(sparkle_at("gz", t_sit), id="sp1")]

TIPS = [  # header at, header hand, card at, card hand, end (take seconds) - her gestures, as in round 2
    (242.0, "right", 244.0, "up", 255.9),
    (256.0, "lap", 257.8, "lap", 267.5),
    (267.6, "right", 270.0, "up", 281.5),
    (281.6, "right", 283.0, "right", 297.5),
]
HEADB = {"x": 170, "y": 6, "w": 740, "h": 293}   # above her hair
BODYB = {"x": 20, "y": 1318, "w": 1040, "h": 585}
for i, (ha, hh, pa, ph, e) in enumerate(TIPS):
    a, b, c = T(ha), T(pa), (T(e) if e < 297.5 else FOOT_END)
    R["gfx.head"]["items"].append({"id": f"hd{i}", "from": F(a), "dur": F(c) - F(a), "asset": f"m.g3-head-{i + 1}.png", "box": HEADB,
        "anim": reveal(HEADB, c - a, hh, 1.08)})
    R["gfx.body"]["items"].append({"id": f"bd{i}", "from": F(b), "dur": F(c) - F(b), "asset": f"m.g3-body-{i + 1}.png", "box": BODYB,
        "anim": reveal(BODYB, c - b, ph)})
    R["gfx.sparkle"]["items"] += [dict(sparkle_at(hh, a), id=f"sh{i}"), dict(sparkle_at(ph, b), id=f"sp{i}b")]
R["gfx.sparkle"]["items"].sort(key=lambda x: x["from"])
for x, y in zip(R["gfx.sparkle"]["items"], R["gfx.sparkle"]["items"][1:]):
    if x["from"] + x["dur"] > y["from"]: x["dur"] = y["from"] - x["from"]

row("end", "image", "סיום – הזמנה לארגונים (מאונבורדינג לבונדינג)", G_END, {}, [{"id": "e0", "from": F(FOOT_END), "dur": DUR - F(FOOT_END),
    "asset": "m.g3-endcard-orgs.jpg", "box": {"x": 0, "y": -2, "w": 1080, "h": 1924}, "anim": {"opacity": [[0, 0], [0.35, 1]], "scale": [[0, 1.04], [3.0, 1]]}}])

# his rows as they are now
for lid in ("naomi.video", "fx.grade", "fx.vig", "music.enya", "music.einaudi"):
    R[lid] = KEEP[lid]
ORDER = ["set", "wall.banner", "naomi.video", "fx.grade", "fx.vig", "gfx.body", "gfx.head", "gfx.title", "gfx.sparkle", "end",
         "music.enya", "music.einaudi"]
ops.append({"op": "project", "set": {"duration": DUR}})
for l in p["layers"]: ops.append({"op": "layer.remove", "id": l["id"]})
for i, rid in enumerate(ORDER): ops.append({"op": "layer.add", "index": i, "layer": R[rid]})
print("footage", round(FOOT_END, 2), "| sit", round(t_sit, 1), "| tips at", [round(T(x[0]), 1) for x in TIPS])
if "--go" in sys.argv:
    r = req("POST", f"/api/p/{EP}/ops", {"rev": p["rev"], "ops": ops}); print({k: v for k, v in r.items() if k in ("ok", "rev", "error", "problems")})
