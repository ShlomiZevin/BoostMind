"""naomi-tips-1 round 4 (his notes 2026-11-25, "really really good now"):
- her video exactly as shot: the whole frame = the canvas, centred, one framing from the first frame to the last (no
  jumps, no dead sides, her crossed-leg foot never cut); the room re-framed around her (S4 at 1.5x: the velvet seat at
  her hips, the footrest ring under her foot)
- the clothes reveal plays at real speed (216-226), only the walk to the chair is sped up (226-233.6 at 2.5x)
- the title: "אל תצפו" is THE object (the same burgundy pill as the tips) - low while she is at the lens, out of the
  way for the reveal, back above her once she sits
- everything inside the social safe zone (y 225-1440): the tip header appears big from her hand on her first gesture,
  on her second it shrinks to the top and the brochure card opens under it, above her head
- reveals timed to her gestures (from the cut-out's outline); a soft glow instead of the stars; tip 3's card unfolds
  strip by strip following her sweep over her head, a glow riding on her hand
Keeps his look and music rows. Usage: build4.py [--go]"""
import json, os, shutil, subprocess, sys, urllib.request

ROOT = r"C:/workspace/BoostMind"; ZC = ROOT + "/zoomcut"; EP = "naomi-tips-1"
SCR = os.path.dirname(os.path.abspath(__file__)); GFX = SCR + "/gfx4"
API = "http://127.0.0.1:4747"; FPS = 30
F = lambda s: int(round(s * FPS))
def req(m, u, b=None):
    r = urllib.request.Request(API + u, data=json.dumps(b).encode() if b is not None else None, method=m, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(r) as f: return json.loads(f.read().decode())
p = req("GET", f"/api/p/{EP}"); p = p.get("project", p)
if p["rev"] not in (26,) and "--force" not in sys.argv:
    sys.exit(f"rev {p['rev']} - he may have edited it; look first")
KEEP = {l["id"]: l for l in p["layers"]}
media = os.path.join(ZC, "episodes", EP, "media")
FILES = {"naomi-institute-S4.jpg": ZC + "/episodes/_assets/naomi-tips/sets/naomi-institute-S4.jpg"}
for f in os.listdir(GFX):
    FILES["g4-" + f] = GFX + "/" + f
ops = []
def probe(path):
    return subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", path], capture_output=True, text=True).stdout.strip()
for fn, src in FILES.items():
    dst = os.path.join(media, fn)
    shutil.copy2(src, dst)
    w, h = map(int, probe(dst).split(",")[:2])
    ops.append({"op": "asset.add", "id": "m." + fn, "asset": {"kind": "image", "src": "media/" + fn, "w": w, "h": h, "label": fn}})

TAKE = "t.v1c044g50000dc3b38nog65rc0ktfseg"
CLIPS = [(216.0, 226.0, 1.0), (226.0, 233.6, 2.5), (233.6, 297.5, 1.0)]   # the reveal at real speed, the walk sped up
FULL = {"x": 0, "y": 0, "w": 1080, "h": 1920}                            # the frame as shot = the canvas
tl_at, t, vid = [], 0.0, []
for i, (a, b, rate) in enumerate(CLIPS):
    d = (b - a) / rate
    vid.append({"id": f"nv{i}", "from": F(t), "dur": F(t + d) - F(t), "asset": TAKE, "in": a, "box": dict(FULL), **({"rate": rate} if rate != 1 else {})})
    tl_at.append((a, b, rate, t)); t += d
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
SET_K, SET_X = 1.5, -262   # S4: seat top (image y 1005) -> canvas ~1507 at her hips, footrest ring (1225) -> ~1837 under her foot
row("set", "image", "רקע – המכון (S4, הכיסא מתחתיה)", G_SET, {"brightness": 1.0},
    [{"id": "set0", "from": 0, "dur": DUR, "asset": "m.naomi-institute-S4.jpg", "box": {"x": SET_X, "y": 0, "w": round(1024 * SET_K), "h": round(1536 * SET_K)}, "pin": "span"}])
row("wall.banner", "image", "הרול-אפ שלה (כנס)", G_SET, {},
    [{"id": "wall.banner0", "from": 0, "dur": DUR, "asset": "m.g-banner.png", "box": {"x": -30, "y": 640, "w": 300, "h": 1120}, "pin": "span"}])
nv = dict(KEEP["naomi.video"])
nv["props"] = dict(nv["props"], box=dict(FULL), zoom=1, x=0, y=0)
nv["items"] = vid
R["naomi.video"] = nv

row("gfx.glow", "image", "קסם – הבזק אור מהיד", G_GFX)
row("gfx.title", "image", "פתיח – 4 ״אל תצפו״ שכל מנהל HR... (משפט אחד)", G_GFX)
row("gfx.head", "image", "״אל תצפו״ + כותרת הטיפ (זהה בכל טיפ)", G_GFX)
row("gfx.body", "image", "הסבר הטיפ (פרוספקט)", G_GFX)
for k in range(6): row(f"gfx.unfold{k}", "image", f"טיפ 3 – נפרס ({k + 1}/6)", G_GFX)

def glow(at, hx, hy, size=520, dur=0.7, path=None):
    box = {"x": round(hx - size / 2), "y": round(hy - size / 2), "w": size, "h": size}
    it = {"id": f"gl{len(R['gfx.glow']['items'])}", "from": F(at), "dur": F(dur), "asset": "m.g4-glow.png", "box": box,
          "anim": {"opacity": [[0, 0], [0.08, 0.95], [dur, 0]], "scale": [[0, 0.3], [0.35, 1.3], [dur, 1.6]]}}
    if path:   # a glow riding on her hand: path = [(t, x, y), ...] in seconds from `at`
        it["anim"] = {"opacity": [[0, 0], [0.12, 0.9], [dur - 0.3, 0.9], [dur, 0]], "scale": [[0, 0.5], [0.3, 1.0]],
                      "x": [[pt, round(px - hx)] for pt, px, py in path], "y": [[pt, round(py - hy)] for pt, px, py in path]}
    R["gfx.glow"]["items"].append(it)

# ---- title: low while she is at the lens (her face up top), gone for the reveal, back above her once she sits
TI_LOW = {"x": 130, "y": 979, "w": 820, "h": 547}    # visible 1045-1430
TI_TOP = {"x": 130, "y": 174, "w": 820, "h": 547}    # visible 240-625, her head starts at ~855
t_gone, t_sit, tip1 = T(219.8), T(233.6) + 0.3, T(242.0)
R["gfx.title"]["items"] += [
    {"id": "ti0", "from": 0, "dur": F(t_gone), "asset": "m.g4-title2.png", "box": TI_LOW,
     "anim": {"opacity": [[0, 1], [t_gone - 0.35, 1], [t_gone, 0]], "scale": [[0, 0.9], [0.22, 1.04], [0.36, 1]]}},
    {"id": "ti1", "from": F(t_sit), "dur": F(tip1 - 0.15) - F(t_sit), "asset": "m.g4-title2.png", "box": TI_TOP,
     "anim": {"opacity": [[0, 0], [0.15, 1], [tip1 - t_sit - 0.5, 1], [tip1 - t_sit - 0.15, 0]], "scale": [[0, 0.6], [0.3, 1.05], [0.45, 1]]}}]

# ---- the tips. A = header from her hand (big), B = header shrinks to the top + the card opens under it.
# take seconds; hand points from the cut-out (canvas px)
TIPS = [  # A, hand A, B, hand B, end
    (242.0, (800, 1080), 243.8, (767, 830), 253.0),
    (253.0, (272, 1100), 255.1, (400, 865), 267.6),
    (267.6, (877, 1100), 270.0, None, 281.5),          # B = the unfold over her head
    (281.5, (890, 1100), 284.0, (505, 855), 297.5),
]
HEAD = {"x": 110, "y": 250, "w": 860, "h": 341}       # big, alone
SMALL, DY = 0.721, -70                                 # -> 620 wide at the top (visible ~230-450)
BODY = {"x": 90, "y": 405, "w": 900, "h": 506}         # visible ~441-857, above her hair
def come(box, hand):
    cx, cy = box["x"] + box["w"] / 2, box["y"] + box["h"] / 2
    return round(hand[0] - cx), round(hand[1] - cy)
for i, (A, ha, B, hb, E) in enumerate(TIPS):
    a, b, e = T(A), T(B), (T(E) if E < 297.5 else FOOT_END)
    d, bb = e - a, b - a
    dx, dy = come(HEAD, ha)
    R["gfx.head"]["items"].append({"id": f"hd{i}", "from": F(a), "dur": F(e) - F(a), "asset": f"m.g4-head-{i + 1}.png", "box": HEAD,
        "anim": {"opacity": [[0, 0], [0.1, 1], [d - 0.3, 1], [d, 0]],
                 "scale": [[0, 0.12], [0.4, 1.06], [0.56, 1], [bb, 1], [bb + 0.35, SMALL], [d, SMALL]],
                 "x": [[0, dx], [0.42, 0]], "y": [[0, dy], [0.42, 0], [bb, 0], [bb + 0.35, DY]]}})
    glow(a + 0.02, *ha)
    if hb:
        bx, by = come(BODY, hb)
        db = e - b
        R["gfx.body"]["items"].append({"id": f"bd{i}", "from": F(b), "dur": F(e) - F(b), "asset": f"m.g4-body-{i + 1}.png", "box": BODY,
            "anim": {"opacity": [[0, 0], [0.12, 1], [db - 0.3, 1], [db, 0]], "scale": [[0, 0.12], [0.42, 1.05], [0.6, 1]],
                     "x": [[0, bx], [0.45, 0]], "y": [[0, by], [0.45, 0]]}})
        glow(b + 0.02, *hb)
    else:
        # tip 3: the card unfolds right to left as her hand sweeps over her head (take 270.0-272.8)
        HAND = [(270.0, 800, 760), (270.2, 780, 735), (270.6, 752, 710), (271.0, 742, 690), (271.4, 670, 675),
                (271.8, 565, 635), (272.2, 460, 657), (272.6, 407, 742), (272.9, 380, 800)]
        def when(x):   # when her hand passes canvas x (the strips to the right of her first point open at once)
            if x >= HAND[0][1]: return HAND[0][0]
            for (t0, x0, _), (t1, x1, _) in zip(HAND, HAND[1:]):
                if x1 <= x <= x0: return t0 + (t1 - t0) * (x0 - x) / (x0 - x1)
            return HAND[-1][0]
        for k in range(6):
            sx0 = BODY["x"] + max(0, k * 150 - 1); sw = min(900, (k + 1) * 150 + 1) - max(0, k * 150 - 1)
            ts = T(when(BODY["x"] + k * 150 + 75))
            ds = e - ts
            R[f"gfx.unfold{k}"]["items"].append({"id": f"uf{k}", "from": F(ts), "dur": F(e) - F(ts), "asset": f"m.g4-body-3-s{k}.png",
                "box": {"x": sx0, "y": BODY["y"], "w": sw, "h": BODY["h"]},
                "anim": {"opacity": [[0, 0], [0.1, 1], [ds - 0.3, 1], [ds, 0]], "scale": [[0, 0.3], [0.25, 1.1], [0.4, 1]], "y": [[0, 40], [0.3, 0]]}})
        t0 = T(HAND[0][0])
        glow(t0, HAND[0][1], HAND[0][2], size=560, dur=HAND[-1][0] - HAND[0][0] + 0.3,
             path=[(T(ht) - t0, hx, hy) for ht, hx, hy in HAND])

R["gfx.glow"]["items"].sort(key=lambda x: x["from"])
for x, y in zip(R["gfx.glow"]["items"], R["gfx.glow"]["items"][1:]):
    if x["from"] + x["dur"] > y["from"]: x["dur"] = y["from"] - x["from"]

end = dict(KEEP["end"]); end["items"] = [dict(end["items"][0], **{"from": F(FOOT_END), "dur": DUR - F(FOOT_END)})]
R["end"] = end
for lid in ("fx.grade", "fx.vig"):
    l = dict(KEEP[lid]); l["items"] = [dict(l["items"][0], dur=F(FOOT_END))]; R[lid] = l
for lid in ("music.enya", "music.einaudi"):
    l = dict(KEEP[lid]); l["items"] = [dict(l["items"][0], dur=DUR)]; R[lid] = l
ORDER = (["set", "wall.banner", "naomi.video", "fx.grade", "fx.vig", "gfx.body"] + [f"gfx.unfold{k}" for k in range(6)]
         + ["gfx.head", "gfx.title", "gfx.glow", "end", "music.enya", "music.einaudi"])
ops.append({"op": "project", "set": {"duration": DUR}})
for l in p["layers"]: ops.append({"op": "layer.remove", "id": l["id"]})
for i, rid in enumerate(ORDER): ops.append({"op": "layer.add", "index": i, "layer": R[rid]})
print("footage", round(FOOT_END, 2), "| title gone", round(t_gone, 1), "sit", round(t_sit, 1),
      "| tips A/B", [(round(T(x[0]), 1), round(T(x[2]), 1)) for x in TIPS])
if "--go" in sys.argv:
    r = req("POST", f"/api/p/{EP}/ops", {"rev": p["rev"], "ops": ops}); print({k: v for k, v in r.items() if k in ("ok", "rev", "error", "problems")})
