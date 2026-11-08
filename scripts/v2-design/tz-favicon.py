# ציפציפ's tab icon from GPT Image's favicon painting (G-fav.png, tz-logo-gpt.mjs fav - his notes 2026-11-08: "the logo on
# the tab is still not good", "still very pixelized"): the painting's white shapes traced into a vector (potracer), on a
# rounded orange square - favicon.svg is drawn crisp at any size and screen; the PNGs (for browsers without SVG icons)
# are rendered from that same vector.
#   python scripts/v2-design/tz-favicon.py   ->  public/tziftzif/img/favicon.svg + favicon-16|32|48|64.png
import subprocess, numpy as np, potrace
from PIL import Image
SRC = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/tz-logo/G-fav.png'
OUT = 'C:/workspace/BoostMind/public/tziftzif/img/'
im = Image.open(SRC).convert('RGB')
m = 18                                     # the painting's black corner frame
im = im.crop((m, m, im.width - m, im.height - m)).resize((1024, 1024), Image.LANCZOS)
a = np.asarray(im).astype(int)
white = (a.min(axis=2) > 200)              # the mark: white on the orange
paths = potrace.Bitmap(~white).trace(   # (potracer fills the dark pixels)
    turdsize=40, alphamax=1.0, opticurve=True, opttolerance=0.3)
d = []
for curve in paths:
    s = curve.start_point
    d.append(f'M{s.x:.1f} {s.y:.1f}')
    for seg in curve.segments:
        if seg.is_corner:
            d.append(f'L{seg.c.x:.1f} {seg.c.y:.1f}L{seg.end_point.x:.1f} {seg.end_point.y:.1f}')
        else:
            d.append(f'C{seg.c1.x:.1f} {seg.c1.y:.1f} {seg.c2.x:.1f} {seg.c2.y:.1f} {seg.end_point.x:.1f} {seg.end_point.y:.1f}')
    d.append('Z')
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" rx="225" fill="#ff7a1f"/>'
       f'<path fill="#fff" fill-rule="evenodd" d="{"".join(d)}"/></svg>')
open(OUT + 'favicon.svg', 'w').write(svg)
print('favicon.svg', len(svg), 'bytes,', len(paths), 'shapes')
# the PNGs from the vector (Chrome draws it; the same renderer as the tab)
subprocess.run(['node', '-e', f"""
const p = require('C:/workspace/BoostMind/zoomcut/render/node_modules/puppeteer-core'); const fs = require('fs');
(async () => {{ const b = await p.launch({{ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' }}); const pg = await b.newPage();
  const svg = fs.readFileSync('{OUT}favicon.svg', 'utf8');
  for (const n of [16, 32, 48, 64]) {{ await pg.setViewport({{ width: n, height: n }}); await pg.setContent('<style>*{{margin:0}}html,body{{background:transparent}}</style>' + svg.replace('<svg ', '<svg width="' + n + '" height="' + n + '" '));
    await pg.screenshot({{ path: '{OUT}favicon-' + n + '.png', omitBackground: true }}); }}
  await b.close(); }})();"""], check=True)
print('ok')
