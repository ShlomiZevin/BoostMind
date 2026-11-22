# Dr. Naomi-Tzipora's brand mark "המחוג שבלב" - three directions (A/B/C) drawn as SVG, the Hebrew set from real fonts
# (Suez One / Frank Ruhl Libre / Heebo) and turned into outlines, so every SVG/PNG is exact with no font installed.
#   python scripts/releases/naomi/logo/make_logo.py            -> scripts/releases/naomi/logo/out/{A,B,C}-*.svg
# Fonts: google/fonts (OFL) in c:/tmp/naomi-fonts (downloaded by the session; any computer: curl them again).
# The picked direction is copied to zoomcut/episodes/_assets/naomi/logo/ by export.mjs (PICK.txt names it).
import math, os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.varLib import instancer

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out'); os.makedirs(OUT, exist_ok=True)
FONTS = os.environ.get('NAOMI_FONTS', 'c:/tmp/naomi-fonts')

BURG, DEEP, RED, GOLD, CREAM, WHITE = '#6B1023', '#4A0B18', '#C8313A', '#B8862F', '#F6E9DC', '#FFFFFF'
TITLE, SUB = 'המחוג שבלב', 'לכל רגש יש תאריך לידה'

_fonts = {}
def font(name, wght=None):
    k = (name, wght)
    if k not in _fonts:
        f = TTFont(os.path.join(FONTS, name))
        if wght is not None and 'fvar' in f:
            f = instancer.instantiateVariableFont(f, {'wght': wght})
        _fonts[k] = f
    return _fonts[k]

def text_path(txt, f, size, x_right, y_base, track=0):
    """Hebrew (RTL) laid out from x_right leftwards; returns (path d, width)."""
    cmap, gs, hmtx = f.getBestCmap(), f.getGlyphSet(), f['hmtx']
    upm = f['head'].unitsPerEm; s = size / upm
    x = x_right; parts = []
    for ch in txt:
        g = cmap.get(ord(ch))
        if g is None: raise SystemExit(f'missing glyph {ch!r} in font')
        adv = hmtx[g][0] * s
        x -= adv
        pen = SVGPathPen(gs)
        gs[g].draw(TransformPen(pen, (s, 0, 0, -s, x, y_base)))
        d = pen.getCommands()
        if d: parts.append(d)
        x -= track
    return ' '.join(parts), x_right - x + track

# ---- the heart (viewBox 0 0 120 110), its dial centre ----
HEART = 'M60 103 C27 80 7 62 7 37.5 C7 20 20 8 36.5 8 C46.5 8 54.5 13 60 21.5 C65.5 13 73.5 8 83.5 8 C100 8 113 20 113 37.5 C113 62 93 80 60 103 Z'
CX, CY = 60, 50

def pt(r, deg):  # 0deg = up, clockwise
    a = math.radians(deg); return CX + r * math.sin(a), CY - r * math.cos(a)

def needle(deg, tip, tail, w, front, back, hub, hub_r=4.6, hub_fill=None):
    t = pt(tip, deg); b = pt(tail, deg + 180)
    l = pt(w, deg - 90); r = pt(w, deg + 90)
    return (f'<path d="M{t[0]:.2f} {t[1]:.2f} L{l[0]:.2f} {l[1]:.2f} L{r[0]:.2f} {r[1]:.2f} Z" fill="{front}"/>'
            f'<path d="M{b[0]:.2f} {b[1]:.2f} L{l[0]:.2f} {l[1]:.2f} L{r[0]:.2f} {r[1]:.2f} Z" fill="{back}"/>'
            f'<circle cx="{CX}" cy="{CY}" r="{hub_r}" fill="{hub}"/>' + (f'<circle cx="{CX}" cy="{CY}" r="{hub_r*0.45:.2f}" fill="{hub_fill}"/>' if hub_fill else ''))

def ticks(r1, r2, degs, color, w, cap='round'):
    out = []
    for d in degs:
        a, b = pt(r1, d), pt(r2, d)
        out.append(f'<line x1="{a[0]:.2f}" y1="{a[1]:.2f}" x2="{b[0]:.2f}" y2="{b[1]:.2f}" stroke="{color}" stroke-width="{w}" stroke-linecap="{cap}"/>')
    return ''.join(out)

def arc(r, d1, d2, color, w):
    a, b = pt(r, d1), pt(r, d2); large = 1 if (d2 - d1) % 360 > 180 else 0
    return f'<path d="M{a[0]:.2f} {a[1]:.2f} A{r} {r} 0 {large} 1 {b[0]:.2f} {b[1]:.2f}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round"/>'

NEEDLE_DEG = 42   # the needle points to "half past one" - the moment something inside moves

# A - the clean line: a rounded outline heart, the 5 stages as 5 ticks on the dial, a red needle (the cover's needle)
def mark_A(mono=None):
    c, n, h = (mono or BURG), (mono or RED), (mono or BURG)
    back = mono or BURG
    return (f'<path d="{HEART}" fill="none" stroke="{c}" stroke-width="7.2" stroke-linejoin="round"/>'
            + ticks(30, 35.5, [-60, -30, 0, 30, 60], c, 4.2)
            + needle(NEEDLE_DEG, 31, 9, 4.3, n, back, h, 5.2, (CREAM if not mono else None)))

# B - the seal: a solid burgundy heart, a cream dial inside, gold minute ticks, the red needle with a gold hub
def mark_B(mono=None, knock=None):
    fill = mono or 'url(#bg)'
    inner = knock or CREAM
    tk = knock or GOLD
    ring = (f'<circle cx="{CX}" cy="{CY}" r="33" fill="none" stroke="{inner}" stroke-width="2.4" opacity="{1 if knock else .9}"/>')
    small = ticks(28.5, 31, [d for d in range(0, 360, 30) if d % 90], tk, 1.8)
    big = ticks(26, 31, [0, 90, 180, 270], tk, 3)
    nd = needle(NEEDLE_DEG, 31.5, 11, 5.6, (knock or RED), (knock or CREAM), (knock or GOLD), 5.4, (None if knock else DEEP))
    if knock:  # one-colour version: the needle's tail stays as an outline so the dial still reads
        nd = needle(NEEDLE_DEG, 31.5, 11, 5.6, knock, knock, knock, 5.8)
    grad = '' if mono else f'<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#84182F"/><stop offset="1" stop-color="{DEEP}"/></linearGradient></defs>'
    return grad + f'<path d="{HEART}" fill="{fill}"/>' + ring + small + big + nd

# C - the gauge: a fine heart line, a gold half-dial (a gauge, from "closed" to "open") and a burgundy needle
def mark_C(mono=None):
    c, g, n = (mono or BURG), (mono or GOLD), (mono or BURG)
    return (f'<path d="{HEART}" fill="none" stroke="{c}" stroke-width="4" stroke-linejoin="round"/>'
            + arc(32, -90, 90, g, 3)
            + ticks(25.5, 29.5, [-90, -67.5, -45, -22.5, 0, 22.5, 45, 67.5, 90], g, 2.2)
            + needle(NEEDLE_DEG + 10, 30, 7, 3.6, n, n, n, 5) + f'<circle cx="{CX}" cy="{CY}" r="2" fill="{CREAM if not mono else "none"}"/>')

DIRS = {
    'A': dict(mark=mark_A, title=('SuezOne-Regular.ttf', None), sub=('Heebo[wght].ttf', 500), name='הקו הנקי'),
    'B': dict(mark=mark_B, title=('SuezOne-Regular.ttf', None), sub=('Heebo[wght].ttf', 500), name='החותם'),
    'C': dict(mark=mark_C, title=('FrankRuhlLibre[wght].ttf', 700), sub=('FrankRuhlLibre[wght].ttf', 500), name='המד'),
}

def svg(w, h, body, vb=None):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb or f"0 0 {w} {h}"}" width="{w}" height="{h}">{body}</svg>\n'

def lockup(key, color_title, color_sub, mono=None, knock=None):
    """horizontal lockup, RTL: the mark on the right, the words to its left."""
    d = DIRS[key]
    markscale = 1.55
    mw, mh = 120 * markscale, 110 * markscale
    gap = 22
    tf = font(*d['title']); sf = font(*d['sub'])
    tsize, ssize = 96, 33.5
    x_right = 0  # lay out relative, then shift
    tp, tw = text_path(TITLE, tf, tsize, 10000, 0)
    sp, sw = text_path(SUB, sf, ssize, 10000, 0, track=0.6)
    words_w = max(tw, sw)
    W = mw + gap + words_w + 8
    H = mh + 6
    # words block: right edge at W - mw - gap
    xr = W - mw - gap
    ty, sy = 98, 150
    tp, _ = text_path(TITLE, tf, tsize, xr, ty)
    sp, _ = text_path(SUB, sf, ssize, xr - (words_w - sw) / 2 if key == 'C' else xr, sy, track=0.6)
    body = (f'<g transform="translate({W - mw:.1f},3) scale({markscale})">'
            + (d['mark'](mono, knock) if key == 'B' else d['mark'](mono)) + '</g>'
            + f'<path d="{tp}" fill="{color_title}"/><path d="{sp}" fill="{color_sub}"/>')
    return svg(round(W), round(H), body)

def mark_only(key, mono=None, knock=None):
    body = DIRS[key]['mark'](mono, knock) if key == 'B' else DIRS[key]['mark'](mono)
    return svg(120, 110, body)

if __name__ == '__main__':
    for k in DIRS:
        open(os.path.join(OUT, f'{k}-logo.svg'), 'w', encoding='utf8').write(lockup(k, BURG, DEEP))
        open(os.path.join(OUT, f'{k}-logo-white.svg'), 'w', encoding='utf8').write(
            lockup(k, WHITE, WHITE, mono=WHITE) if k != 'B' else lockup(k, WHITE, WHITE, mono=WHITE, knock=BURG))
        open(os.path.join(OUT, f'{k}-mark.svg'), 'w', encoding='utf8').write(mark_only(k))
        open(os.path.join(OUT, f'{k}-mark-white.svg'), 'w', encoding='utf8').write(
            mark_only(k, mono=WHITE) if k != 'B' else mark_only(k, mono=WHITE, knock=BURG))
    print('OK', OUT)
