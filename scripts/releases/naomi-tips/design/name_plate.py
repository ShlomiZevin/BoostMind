"""naomi-tips-1 round 8: her name / "דולה רגשית" / "מומחית ל״אוטיזם תעסוקתי״ בדור ה-Z" as ONE designed lockup (GPT Image 2.6,
gfx5/name-plate.png, every letter checked) instead of the three text lines. Above her head: in at take 223.4 (her head top
~510 from there), out 1 s before tip 1. Usage: name_plate.py [--go]"""
import json, sys, urllib.request
API = "http://127.0.0.1:4747"; EP = "naomi-tips-1"; FPS = 30
F = lambda s: int(round(s * FPS))
def req(m, u, b=None):
    r = urllib.request.Request(API + u, data=json.dumps(b).encode() if b is not None else None, method=m, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(r) as f: return json.loads(f.read().decode())
p = req("GET", f"/api/p/{EP}")["project"]
if p["rev"] not in (76,) and "--force" not in sys.argv: sys.exit(f"rev {p['rev']} - look first")
ids = [l["id"] for l in p["layers"]]
T = lambda src: src - 216.0
n0, n1 = T(223.4), T(243.40) - 1.0
K = 0.629                                   # visible 1399x440 of 1536x640 -> 880 wide
box = {"x": round(540 - 769.5 * K), "y": round(228 - 101 * K), "w": round(1536 * K), "h": round(640 * K)}
d = n1 - n0
layer = {"id": "name.plate", "kind": "image", "name": "שם – ד״ר נעמי־ציפורה / דולה רגשית / מומחית (מעוצב)", "group": "גרפיקה", "props": {},
         "items": [{"id": "np0", "from": F(n0), "dur": F(n1) - F(n0), "asset": "m.g5-name-plate.png", "box": box,
                    "anim": {"opacity": [[0, 0], [0.14, 1], [d - 0.35, 1], [d, 0]], "scale": [[0, 0.82], [0.3, 1.04], [0.45, 1]], "y": [[0, -26], [0.3, 0]]}}]}
ops = [{"op": "asset.add", "id": "m.g5-name-plate.png", "asset": {"kind": "image", "src": "media/g5-name-plate.png", "w": 1536, "h": 640, "label": "name plate"}}]
for lid in ("name.bg", "name.text", "name.tagbg", "name.tag", "name.subbg", "name.sub"):
    if lid in ids: ops.append({"op": "layer.remove", "id": lid})
ops.append({"op": "layer.add", "index": ids.index("gfx.glow") - 6 if "gfx.glow" in ids else len(ids), "layer": layer})
print("plate", box, "from", round(n0, 2), "to", round(n1, 2))
if "--go" in sys.argv:
    r = req("POST", f"/api/p/{EP}/ops", {"rev": p["rev"], "ops": ops}); print({k: v for k, v in r.items() if k in ("ok", "rev", "error", "problems")})
