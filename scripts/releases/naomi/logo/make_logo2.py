# Dr. Naomi-Tzipora's brand "המחוג שבלב" - round 2, recrafted from scratch (his ask 2026-11-22: "recraft it from scratch").
# Three new directions, nothing kept from round 1 (no heart-dial, no Suez One, no burgundy box):
#   D - ציפורה   : her own name is a bird - a calm perched songbird, one solid silhouette; Bellefair + Assistant; deep teal
#   E - הביצה    : "every feeling has a birth date" - an egg with the inner needle standing in it; IBM Plex Sans Hebrew; clay
#   F - הבית     : her house - an arched doorway with her monogram נצ (= נץ, the sunrise moment); Noto Serif Hebrew; aubergine
# Every letter is set from a real font and turned into outlines (no font needed to show the SVG).
#   python scripts/releases/naomi/logo/make_logo2.py   -> scripts/releases/naomi/logo/out/{D,E,F}-{logo,logo-white,mark,mark-white}.svg
# Fonts (OFL, google/fonts) in c:/tmp/naomi-fonts: Bellefair-Regular, Assistant[wght], IBMPlexSansHebrew-Light/Regular,
#   NotoSerifHebrew[wdth,wght].  Switch the live logo = node scripts/releases/naomi/logo/export.mjs <D|E|F>
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_logo import font, text_path, svg, OUT

TITLE = 'המחוג שבלב'
NAME = 'ד״ר נעמי־ציפורה בן־נון־פרידמן־שטרנבך'
TAG = 'לכל רגש יש תאריך לידה'
WHITE = '#FFFFFF'

PAL = {
    'D': dict(main='#1E4B4F', ink='#1E4B4F', sub='#5B7472', acc='#B08A4F', dark='#1E4B4F', light='#F6F1E9'),
    'E': dict(main='#A4492F', ink='#2E2420', sub='#7A665C', acc='#A4492F', dark='#6E2E1D', light='#F4EADF'),
    'F': dict(main='#3A1D35', ink='#3A1D35', sub='#7B6676', acc='#C2A273', dark='#3A1D35', light='#F8F3EE'),
}

# ---------------- marks (viewBox 0 0 100 100) ----------------
# D - the songbird, facing left (forward, in Hebrew): built like a real mark - a head circle, a body circle and the
# two tangent lines to the tail tip; the wing is one hairline cut, the eye a dot
def _tan(T, c, r, upper):
    dx, dy = T[0] - c[0], T[1] - c[1]; d = math.hypot(dx, dy)
    phi, a = math.atan2(dy, dx), math.acos(r / d)
    pts = [(c[0] + r * math.cos(phi + s * a), c[1] + r * math.sin(phi + s * a)) for s in (1, -1)]
    return min(pts, key=lambda p: p[1]) if upper else max(pts, key=lambda p: p[1])
def _bird():
    H, rh = (32.0, 31.0), 10.5          # head
    B, rb = (47.5, 57.5), 22.0          # body
    T = (95.0, 71.0)                    # tail tip
    a1 = _tan(T, H, rh, True)           # back: tangent from the tail tip to the head
    b2 = _tan(T, B, rb, False)          # belly: tangent from the tail tip to the body
    # breast: the outer common tangent of head and body on the left
    vx, vy = B[0] - H[0], B[1] - H[1]; d = math.hypot(vx, vy); ux, uy = vx / d, vy / d
    th = math.acos((rh - rb) / d)
    ns = [(ux * math.cos(s * th) - uy * math.sin(s * th), ux * math.sin(s * th) + uy * math.cos(s * th)) for s in (1, -1)]
    n = min(ns, key=lambda q: q[0])
    t1, t2 = (H[0] + rh * n[0], H[1] + rh * n[1]), (B[0] + rb * n[0], B[1] + rb * n[1])
    ang = lambda c, deg, r: (c[0] + r * math.cos(math.radians(deg)), c[1] + r * math.sin(math.radians(deg)))
    bt, bb = ang(H, 194, rh), ang(H, 170, rh)   # beak base on the head (upper, lower)
    tip = (10.0, 31.6)
    # the back leaves the head along its own curve (no kink at the nape) and lands softly on the tail
    th1 = math.atan2(a1[1] - H[1], a1[0] - H[0]); tx, ty = -math.sin(th1), math.cos(th1)
    a1 = (H[0] + rh * math.cos(th1 - 0.35), H[1] + rh * math.sin(th1 - 0.35)); th1 -= 0.35; tx, ty = -math.sin(th1), math.cos(th1)
    c1 = (a1[0] + 20 * tx, a1[1] + 20 * ty)
    bx, by = T[0] - a1[0], T[1] - a1[1]; bl = math.hypot(bx, by)
    c2 = (T[0] - 0.30 * bx - 4.0 * by / bl, T[1] - 0.30 * by + 4.0 * bx / bl - 6.0)
    f = lambda p: f'{p[0]:.2f} {p[1]:.2f}'
    body = (f'M{f(tip)} L{f(bt)} A{rh} {rh} 0 0 1 {f(a1)} C{f(c1)} {f(c2)} {f(T)} L{f(b2)} A{rb} {rb} 0 0 1 {f(t2)} '
            f'L{f(t1)} A{rh} {rh} 0 0 1 {f(bb)} Z')
    wing = 'M42 49 C57 51 72 58.5 87 69.6 C70 62.5 55 57.5 42 49 Z'
    eye = f'M{H[0]-3.4:.2f} {H[1]-1.4:.2f} a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0 Z'
    return body + ' ' + wing + ' ' + eye
BIRD = _bird()
def mark_D(c, acc=None, bg=None):
    return f'<path d="{BIRD}" fill="{c}" fill-rule="evenodd"/>'

# E - the egg, the inner needle rising from its base to the point where a feeling is born
EGG = 'M50 6 C70.5 6 84 32 84 57 C84 80 69.5 95 50 95 C30.5 95 16 80 16 57 C16 32 29.5 6 50 6 Z'
def mark_E(c, acc=None, bg=None):
    # the inner needle: one slim needle in the egg, pointing to "one o'clock" - the moment a feeling moves;
    # the hub is a hole, so the mark stays one colour
    cx, cy, deg = 50, 56, 24
    def p(r, a):
        t = math.radians(a); return cx + r * math.sin(t), cy - r * math.cos(t)
    tip, tail, l, r = p(36, deg), p(22, deg + 180), p(6.2, deg - 90), p(6.2, deg + 90)
    f = lambda q: f'{q[0]:.2f} {q[1]:.2f}'
    needle = (f'M{f(tip)} L{f(r)} L{f(tail)} L{f(l)} Z '
              f'M{cx-2.6:.2f} {cy} a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0 Z')
    return (f'<path d="{EGG}" fill="none" stroke="{c}" stroke-width="5"/>'
            f'<path d="{needle}" fill="{acc or c}" fill-rule="evenodd"/>')

def _mono_font():
    from make_logo import _fonts
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer
    k = ('mono', 0)
    if k not in _fonts:
        _fonts[k] = instancer.instantiateVariableFont(TTFont('c:/tmp/naomi-fonts/NotoSerifHebrew[wdth,wght].ttf'), {'wght': 560, 'wdth': 72})
    return _fonts[k]

# F - the arched door, the monogram נצ inside it (Noto Serif Hebrew, condensed, outlined)
def mark_F(c, acc=None, bg=None):
    knock = bg or '#FFFFFF'
    f = _mono_font()
    size = 54
    # set at 0 first to measure, then centre
    _, w = text_path('נצ', f, size, 0, 0, track=-1.5)
    d, _ = text_path('נצ', f, size, 50 + w / 2, 79, track=-1.5)
    line = acc or knock
    return (f'<path d="M12 97 V49 A38 38 0 0 1 88 49 V97 Z" fill="{c}"/>'
            f'<path d="M18.5 91 V49.5 A31.5 31.5 0 0 1 81.5 49.5 V91" fill="none" stroke="{line}" stroke-width="1.5" opacity=".9"/>'
            f'<path d="{d}" fill="{knock}"/>')

MARKS = {'D': mark_D, 'E': mark_E, 'F': mark_F}
TYPE = {   # (title font, wght, size, track) , (sub font, wght, size, track), sub text
    'D': (('Bellefair-Regular.ttf', None, 104, 1.5), ('Assistant[wght].ttf', 500, 29, 1.2), NAME),
    'E': (('IBMPlexSansHebrew-Light.ttf', None, 92, 5), ('IBMPlexSansHebrew-Regular.ttf', None, 33, 3), TAG),
    'F': (('NotoSerifHebrew[wdth,wght].ttf', 420, 92, 1), ('NotoSerifHebrew[wdth,wght].ttf', 400, 28, 1.2), NAME),
}

def fnt(name, wght):
    return font(name, wght) if wght is not None else font(name)

def lockup(k, white=False):
    p = PAL[k]
    (tf, tw8, ts, tt), (sf, sw8, ss, st), sub = TYPE[k]
    T, S = fnt(tf, tw8), fnt(sf, sw8)
    _, tw = text_path(TITLE, T, ts, 0, 0, track=tt)
    _, sw = text_path(sub, S, ss, 0, 0, track=st)
    words = max(tw, sw)
    mh = 150; ms = mh / 100; gap = 34
    W = mh + gap + words + 6; H = mh + 4
    xr = W - mh - gap
    ty, sy = (100, 142) if k != 'E' else (96, 141)
    # rule between title and sub (F only, a fine champagne hairline)
    tp, _ = text_path(TITLE, T, ts, xr, ty, track=tt)
    sp, _ = text_path(sub, S, ss, xr - (words - sw) / 2 if k == 'F' else xr, sy, track=st)
    if k == 'F':
        tp, _ = text_path(TITLE, T, ts, xr - (words - tw) / 2, ty, track=tt)
    tc = WHITE if white else p['ink']; sc = WHITE if white else p['sub']
    if white:
        m = MARKS[k](WHITE, None, p['dark'])
    else:
        m = MARKS[k](p['main'], p['acc'] if k != 'D' else None, p['light'] if k == 'F' else None)
    body = (f'<g transform="translate({W - mh:.1f},2) scale({ms})">{m}</g>'
            f'<path d="{tp}" fill="{tc}"/><path d="{sp}" fill="{sc}" opacity="{0.85 if white else 1}"/>')
    return svg(round(W), round(H), body)

def mark_only(k, white=False):
    p = PAL[k]
    m = MARKS[k](WHITE, None, p['dark']) if white else MARKS[k](p['main'], p['acc'] if k != 'D' else None, p['light'] if k == 'F' else None)
    return svg(100, 100, m)

if __name__ == '__main__':
    for k in MARKS:
        for name, s in ((f'{k}-logo', lockup(k)), (f'{k}-logo-white', lockup(k, True)),
                        (f'{k}-mark', mark_only(k)), (f'{k}-mark-white', mark_only(k, True))):
            open(os.path.join(OUT, name + '.svg'), 'w', encoding='utf8').write(s)
    print('OK', OUT)
