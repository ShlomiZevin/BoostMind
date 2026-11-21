# Syncs social teaser v3 - one compositor: hook sketch -> blurred sketch bg + phone with the real app -> logo CTA
# python compose3.py [--from T --to T]  -> video.mp4 (silent), then mix.sh adds the sound
import subprocess, sys, os, numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
P = os.path.dirname(HERE)
W, H, FPS = 1080, 1920, 30
SH = 'C:/workspace/BoostMind/zoomcut/episodes/_assets/shlomiverse'
END = 27.6
HOOK_IN = 35.80            # ronit-joins: Amir "מצוין, אז אנחנו מסונכרנים" -> Ronit "לא, אנחנו לא מסונכרנים" (ends 38.48)
HOOK_LEN = 2.75

class Reader:
    def __init__(s, f, t0, dur, w, h, vf=''):
        s.w, s.h = w, h
        f_ = f'fps={FPS},scale={w}:{h}' + (',' + vf if vf else '')
        s.p = subprocess.Popen(['ffmpeg', '-v', 'error', '-ss', str(t0), '-i', f, '-t', str(dur + 0.2), '-vf', f_,
                                '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
        s.frames = []; s.last = None
    def get(s, i):
        while len(s.frames) <= i:
            b = s.p.stdout.read(s.w * s.h * 3)
            if len(b) < s.w * s.h * 3: break
            s.frames.append(Image.frombytes('RGB', (s.w, s.h), b))
            if len(s.frames) > 3: s.frames[-4] = None
        for k in range(min(i, len(s.frames) - 1), -1, -1):
            if s.frames[k] is not None: return s.frames[k]

def ease(x): x = max(0., min(1., x)); return 1 - (1 - x) ** 3
def txt(id_): return Image.open(f'{HERE}/txt/{id_}.png').convert('RGBA')

# ---------- phone mockup (base: screen 780x1688 inside a 26 px bezel) ----------
BZ = 26; PW, PH = 780 + 2 * BZ, 1688 + 2 * BZ
body = Image.new('RGBA', (PW, PH), (0, 0, 0, 0)); d = ImageDraw.Draw(body)
d.rounded_rectangle([0, 0, PW - 1, PH - 1], 96, fill=(18, 18, 22, 255), outline=(90, 90, 100, 255), width=4)
d.rounded_rectangle([6, 6, PW - 7, PH - 7], 90, outline=(40, 40, 46, 255), width=3)
smask = Image.new('L', (780, 1688), 0); ImageDraw.Draw(smask).rounded_rectangle([0, 0, 779, 1687], 72, fill=255)
shadow = Image.new('RGBA', (PW + 160, PH + 160), (0, 0, 0, 0))
ImageDraw.Draw(shadow).rounded_rectangle([80, 100, PW + 80, PH + 100], 96, fill=(0, 0, 0, 170))
shadow = shadow.filter(ImageFilter.GaussianBlur(40))

def phone(screen):
    im = body.copy(); im.paste(screen, (BZ, BZ), smask); return im

# ---------- the shots (video time) ----------
# kind, t0, t1, file, src_in, framing, labels [(id, t_appear, y_center)]
M2, M3, RC = f'{P}/rec/m2.mp4', f'{P}/rec/m3.mp4', f'{P}/rec/recap.mp4'
LY = 400
SHOTS = [
    ('reveal', 3.75, 5.75, M2, 4.10, ('fixed', 0.70, 900), [('presents', 3.75, 330), ('syncs', 4.75, 520), ('newapp', 4.75, 720)]),
    ('pick',   5.75, 7.25, M2, 0.00, (120, 1100), [('pick', 5.75, LY)]),
    ('write',  7.25, 9.25, M2, 21.70, (940, 1720), [('write', 7.25, LY)]),
    ('live',   9.25, 10.75, M2, 31.00, (1000, 1420), [('live', 9.25, LY)]),
    ('owner', 10.75, 12.25, M2, 37.20, (1180, 1480), [('owner', 10.75, LY)]),
    ('shek',  12.25, 13.25, M2, 50.20, (1290, 1720), []),
    ('shek2', 13.25, 14.25, M2, 58.40, (1150, 1420), []),
    ('mute',  14.25, 15.75, M3, 18.80, (900, 1420), [('mute', 14.25, LY)]),
    ('end',   15.75, 17.25, M2, 90.60, (1000, 1450), [('end', 15.75, LY)]),
    ('recap', 17.25, 18.75, RC, 0.20, (450, 1400), [('recap', 17.25, 320), ('recap2', 17.75, 450)]),
    ('item',  18.75, 19.75, RC, 3.00, (800, 1010), [('recap', 0, 320), ('recap2', 0, 450)]),
    ('hero',  19.75, 23.25, M2, 62.00, ('fixed', 0.80, 730), [('syncs', 19.75, 360), ('meet', 20.75, 610)]),
]
CENTER = 1150

def framing(f, t_rel, dur):
    if f[0] == 'fixed':
        s, top = f[1], f[2]
        s = s * (1.04 - 0.04 * ease(t_rel / dur))  # slow settle
        return s, top
    y0, y1 = f
    s = max(1.0, min(1.25, 860 / (y1 - y0)))
    s *= 0.95 + 0.05 * ease(t_rel / 0.35) + 0.025 * (t_rel / dur)   # ease in on the cut + slow push
    top = CENTER - (BZ + (y0 + y1) / 2) * s
    return s, top

def paste_label(fr, id_, t, t_app, yc, cache):
    if t < t_app: return
    im = cache.setdefault(id_, txt(id_))
    k = ease((t - t_app) / 0.25) if t_app > 0 else 1
    sc = 0.86 + 0.14 * k
    w, h = int(im.width * sc), int(im.height * sc)
    a = im.resize((w, h), Image.LANCZOS)
    if k < 1: a.putalpha(a.getchannel('A').point(lambda v: int(v * k)))
    fr.alpha_composite(a, ((W - w) // 2, int(yc - h / 2)))

# top dark band so captions sit on calm ground over the phone
band = Image.new('RGBA', (W, 700), (0, 0, 0, 0))
ba = np.zeros((700, W), np.uint8)
for y in range(700): ba[y, :] = 238 if y < 520 else int(238 * max(0, 1 - (y - 520) / 130))
band.putalpha(Image.fromarray(ba))

def main():
    t_from = float(sys.argv[sys.argv.index('--from') + 1]) if '--from' in sys.argv else 0
    t_to = float(sys.argv[sys.argv.index('--to') + 1]) if '--to' in sys.argv else END
    out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else f'{HERE}/video.mp4'
    enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS),
                            '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
    src = f'{P}/src/ronit-joins.mp4'
    hook = Reader(src, HOOK_IN, HOOK_LEN + 0.4, W, H)
    bg = Reader(src, HOOK_IN + HOOK_LEN, 22, W, H, 'gblur=sigma=38,eq=brightness=-0.16:saturation=0.75')
    circle = Reader(f'{SH}/kit/circle-end.mp4', 0, 1.5, W, H)
    amir = Reader(f'{P}/src/follow-up.mp4', 101.50, 2.2, 720, 1280)
    icon = Image.open('C:/workspace/BoostMind/public/verse/art/syncs-icon.png').convert('RGBA').resize((210, 210), Image.LANCZOS)
    cache = {}; readers = {}
    n0, n1 = int(round(t_from * FPS)), int(round(t_to * FPS))
    for n in range(n0, n1):
        t = n / FPS
        if t < 23.25:
            # ---- background: the hook sketch, then the same sketch blurred
            if t < HOOK_LEN + 0.25:
                z = 1.0 + 0.08 * ease(min(t, HOOK_LEN) / HOOK_LEN)
                fr0 = hook.get(n)
                fw, fh = int(W * z), int(H * z)
                fr0 = fr0.resize((fw, fh), Image.BILINEAR).crop(((fw - W) // 2, int(720 * z - 720), (fw - W) // 2 + W, int(720 * z - 720) + H))
            if t >= HOOK_LEN:
                b = bg.get(n - int(HOOK_LEN * FPS))
                k = ease((t - HOOK_LEN) / 0.25)
                fr = Image.blend(fr0, b, k) if k < 1 else b.copy()
            else:
                fr = fr0
            fr = fr.convert('RGBA')
            if HOOK_LEN <= t < 3.75:
                paste_label(fr, 'notsync', t, HOOK_LEN, 900, cache)
            # ---- phone shots
            for sh in SHOTS:
                kind, t0, t1, f, sin, fra, labels = sh
                if not (t0 <= t < t1): continue
                key = kind
                if key not in readers: readers[key] = Reader(f, sin, t1 - t0, 780, 1688)
                scr = readers[key].get(int(round((t - t0) * FPS)))
                ph = phone(scr)
                s, top = framing(fra, t - t0, t1 - t0)
                if kind == 'reveal':  # the phone rises in on the beat
                    top += 1300 * (1 - ease((t - t0) / 0.45))
                pw, phh = int(PW * s), int(PH * s)
                x = (W - pw) // 2
                sd = shadow.resize((int(shadow.width * s), int(shadow.height * s)), Image.BILINEAR)
                fr.alpha_composite(sd, (x - int(80 * s), int(top - 80 * s))) if top - 80 * s > -sd.height else None
                fr.alpha_composite(ph.resize((pw, phh), Image.BILINEAR), (x, int(top))) if True else None
                fr.alpha_composite(band, (0, 0))
                for id_, ta, yc in labels:
                    paste_label(fr, id_, t, ta, yc, cache)
            # warm flash into the logo
            if t > 23.05:
                k = (t - 23.05) / 0.2
                fr = Image.blend(fr, Image.new('RGBA', (W, H), (255, 241, 220, 255)), min(1, k))
        else:
            ci = min(44, int((t - 23.25) * 3 * FPS))       # circle-end at 3x: lock on 23.75
            fr = circle.get(ci).convert('RGBA')
            if t < 23.40:
                fr = Image.blend(fr, Image.new('RGBA', (W, H), (255, 241, 220, 255)), 1 - (t - 23.25) / 0.15)
            if t >= 23.75:
                paste_label(fr, 'now', t, 23.75, 1300, cache)
                # Syncs icon over the logo, then Amir's tile for the punchline
                if t < 25.15:
                    k = ease((t - 23.75) / 0.25); sc = 0.86 + 0.14 * k
                    ic = icon.resize((int(210 * sc), int(210 * sc)), Image.LANCZOS)
                    fr.alpha_composite(ic, ((W - ic.width) // 2, 420 - ic.height // 2))
                else:
                    a = amir.get(int((t - 25.15) * FPS)).crop((0, 330, 720, 738))   # his face below the sketch's POV text
                    k = ease((t - 25.15) / 0.25); sc = (0.86 + 0.14 * k)
                    tw, th = int(760 * sc), int(431 * sc)
                    tile = Image.new('RGBA', (tw + 12, th + 12), (0, 0, 0, 0))
                    m = Image.new('L', (tw + 12, th + 12), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, tw + 11, th + 11], 34, fill=255)
                    ImageDraw.Draw(tile).rounded_rectangle([0, 0, tw + 11, th + 11], 34, fill=(252, 114, 17, 255))
                    m2 = Image.new('L', (tw, th), 0); ImageDraw.Draw(m2).rounded_rectangle([0, 0, tw - 1, th - 1], 28, fill=255)
                    tile.paste(a.resize((tw, th), Image.BILINEAR), (6, 6), m2)
                    tile.putalpha(Image.fromarray(np.minimum(np.array(m), int(255 * k)).astype(np.uint8)))
                    fr.alpha_composite(tile, ((W - tile.width) // 2, 470 - tile.height // 2))
                    if t >= 25.3:
                        pi = cache.setdefault('punch', txt('punch'))
                        fr.alpha_composite(pi, ((W - pi.width) // 2, 470 + th // 2 - pi.height + 4))
        enc.stdin.write(fr.convert('RGB').tobytes())
    enc.stdin.close(); enc.wait()

if __name__ == '__main__':
    main()
