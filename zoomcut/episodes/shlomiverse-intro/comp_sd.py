# The Seedance version: AI clips of the real logo pulling back into space, played BACKWARDS (so they end exactly on
# the real logo frame), then the exact logo locked on the music's final hit with a flash + flare, tagline and address.
#   python comp_sd.py [--beats beats-A3.json] [--clips media/sd-2-...mp4,media/sd-1-...mp4] [--name v1]
#   -> out/shlomiverse-intro-<name>-story.mp4 (1080x1920) and -post.mp4 (1080x1350), 24 fps, music muxed
import os, sys, json, subprocess, glob, shutil, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_frames import backdrop, paste_logo, logo_rgba, LOGO_W, LOGO_CX, LOGO_CY, W, H

HERE = os.path.dirname(os.path.abspath(__file__))
def arg(n, d=None):
    return sys.argv[sys.argv.index(n) + 1] if n in sys.argv else d
B = json.load(open(os.path.join(HERE, arg('--beats', 'beats-A3.json'))))
CLIPS = arg('--clips', 'media/sd-2-pullback-far-mini.mp4,media/sd-1-pullback-mini.mp4').split(',')
NAME = arg('--name', 'v1')
FPS = 24
EXT_LOOP = arg('--ext-loop')            # "1.68,3.93,2": bars 1.68-3.93 played 3 times instead of once
EXT = 0.0
if EXT_LOOP:
    LA, LB, LN = [float(x) for x in EXT_LOOP.split(',')]
    EXT = (LB - LA) * LN
    for k_ in ('logo', 'tagline', 'url', 'duration', 'hit1', 'drums_end'):
        if k_ in B and B[k_] >= LB - 0.01: B[k_] = round(B[k_] + EXT, 3)
SLOW = float(arg('--slow', '0'))       # 0.667: everything before the logo hit 1.5x longer, the hit and the end as they were
LOGO0 = B['logo']
if SLOW:
    EXT = LOGO0 / SLOW - LOGO0
    for k_ in list(B):
        if isinstance(B[k_], (int, float)) and k_ != 'fps':
            B[k_] = round(B[k_] / SLOW if B[k_] < LOGO0 - 0.01 else B[k_] + EXT, 3)
T_LOGO, DUR = B['logo'], B['duration']
TAG, URL = arg('--tag', 'אנשים אמיתיים. יקום מקביל.'), 'shlomiverse.com'
PREFIX = arg('--prefix', 'shlomiverse-intro')
HOOK = arg('--hook')                 # real clips: before the trailer, or floating in it (features/hook*.json)
STORY_ONLY = '--story-only' in sys.argv
POST_TOP = 320                       # 4:5 window: rows 320..1670 of the story frame (logo at ~40%)

# ---- 1. the clips, reversed and scaled, one PNG per frame
tmp = os.path.join(HERE, 'out/sd_frames'); shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
seq = []
for i, c in enumerate(CLIPS):
    pat = os.path.join(tmp, f'c{i}_%04d.png')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(HERE, c), '-vf',
                    f'reverse,fps={FPS},scale={W}:{H}:flags=lanczos', pat], check=True)
    seq += sorted(glob.glob(os.path.join(tmp, f'c{i}_*.png')))
n_seq = len(seq)
t_seq0 = T_LOGO - n_seq / FPS        # the clips end exactly on the logo hit
print('clip frames', n_seq, 'start at', round(t_seq0, 2))

# ---- v3: the planet is there from the first second, small and far, and grows continuously into the AI clip
APPROACH = '--approach' in sys.argv
if APPROACH:
    import cv2
    seqA = sorted(glob.glob(os.path.join(tmp, 'c0_*.png')))      # reversed far clip: the galaxy dive (its planet never shown)
    seqB = sorted(glob.glob(os.path.join(tmp, 'c1_*.png')))      # reversed near clip: the planet turning onto the logo
    SPEED_B = float(arg('--speed-b', '1.33'))                    # the near clip a bit faster, so its growth matches ours
    T_HAND = T_LOGO - (len(seqB) - 1) / FPS / SPEED_B            # where the near clip takes over
    first = np.asarray(Image.open(seqB[0]).convert('RGB')).astype(np.float32) / 255   # = the far-planet frame
    # the planet in that frame (measured: centre 351,610 and 258x179 incl. ring in the 720x1280 clip)
    PCX, PCY, PW, PH = 351 * 1.5, 610 * 1.5, 258 * 1.5, 179 * 1.5
    SW, SH = int(PW * 1.55), int(PH * 1.9)
    x0, y0 = int(PCX - SW / 2), int(PCY - SH / 2)
    sprite = first[y0:y0 + SH, x0:x0 + SW].copy()
    gy, gx = np.mgrid[0:SH, 0:SW].astype(np.float32)
    er = np.sqrt(((gx - SW / 2) / (SW / 2)) ** 2 + ((gy - SH / 2) / (SH / 2)) ** 2)
    smask = np.clip((1.0 - er) / 0.28, 0, 1)[..., None] ** 1.2     # soft ellipse round planet, ring and glow
    # the plate: the same frame with the planet replaced by stars from higher up the same picture
    plate = first.copy()
    donor = first[90:90 + SH, x0:x0 + SW]
    plate[y0:y0 + SH, x0:x0 + SW] = plate[y0:y0 + SH, x0:x0 + SW] * (1 - smask) + donor * smask
    S0 = float(arg('--s0', '0.15'))
    A_END = 2.3                                                  # galaxy dive shown until here, then into the plate
    print('hand-over at', round(T_HAND, 2), 's; far planet starts at', S0)
    def frame_at(seq_, pos):                                     # fractional frame: blend the two nearest
        pos = min(max(pos, 0), len(seq_) - 1); i = int(pos); f_ = pos - i
        a_ = np.asarray(Image.open(seq_[i]).convert('RGB')).astype(np.float32) / 255
        if f_ < 0.02 or i + 1 >= len(seq_): return a_
        b_ = np.asarray(Image.open(seq_[i + 1]).convert('RGB')).astype(np.float32) / 255
        return a_ * (1 - f_) + b_ * f_
    # v4: no jump onto the exact logo. Measure the clip's last frame against the logo frame (ECC, affine) and its colour,
    # ease the clip onto that geometry/colour before the hit, then dissolve slowly to the logo under the glow swell.
    SMOOTH_END = '--smooth-end' in sys.argv
    if SMOOTH_END:
        def _g(a): return cv2.cvtColor((np.clip(a, 0, 1) * 255).astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32) / 255
        last = np.asarray(Image.open(seqB[-1]).convert('RGB')).astype(np.float32) / 255
        _lf = paste_logo(backdrop())
        _m = np.zeros((H, W), np.uint8); _m[380:1340, 60:1020] = 255
        _cc, WARP = cv2.findTransformECC(_g(_lf), _g(last), np.eye(2, 3, dtype=np.float32), cv2.MOTION_AFFINE,
                                         (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 300, 1e-6), _m, 5)
        _al = cv2.warpAffine(last, WARP, (W, H), flags=cv2.INTER_LINEAR + cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REFLECT)
        GAIN = (_lf[380:1340, 60:1020].reshape(-1, 3).mean(0) + 1e-3) / (_al[380:1340, 60:1020].reshape(-1, 3).mean(0) + 1e-3)
        print('ECC', round(float(_cc), 4), 'warp', WARP.round(4).tolist(), 'gain', GAIN.round(3))
    def align_to_logo(img, w):
        if w <= 0: return img
        M = np.eye(2, 3, dtype=np.float32) + (WARP - np.eye(2, 3, dtype=np.float32)) * w
        out = cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR + cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REFLECT)
        out = out * (1 + (GAIN - 1) * w)
        blur = cv2.GaussianBlur(out, (0, 0), 1.6)                 # a touch crisper, towards the sharp logo
        return np.clip(out + (out - blur) * 0.6 * w, 0, 1)
    # the near clip's own motion is fast right to its last frame; a speed curve lets it settle instead of stopping dead
    CLIP_S = (len(seqB) - 1) / FPS
    T_STOP = T_LOGO + 0.35; DEC = 1.2; T_DEC = T_STOP - DEC
    V0 = CLIP_S / ((T_DEC - T_HAND) + DEC / 2)
    def clip_pos(t):           # seconds into the reversed near clip
        if t <= T_DEC: return (t - T_HAND) * V0
        u = min(t, T_STOP) - T_DEC
        return (T_DEC - T_HAND) * V0 + V0 * (u - u * u / (2 * DEC))
    def end_clip_frame(t):
        fr_ = frame_at(seqB, clip_pos(t) * FPS)
        return align_to_logo(fr_, sm((t - (T_LOGO - 0.6)) / (T_STOP - T_LOGO + 0.6)))
    def approach_bg(t):
        if t >= T_HAND:
            fr_ = frame_at(seqB, (t - T_HAND) * FPS * SPEED_B)
            if SMOOTH_END:   # the clip slows to a stop (no freeze) and is eased onto the logo's geometry and colour
                return end_clip_frame(t)
            lock = sm((t - (T_LOGO - 0.30)) / 0.30)
            return fr_ * (1 - lock) + logo_frame * lock
        # far part: galaxy dive -> plate, and the planet sprite growing at a constant rate (no pop-in)
        tk = t * (T_HAND - EXT) / T_HAND                         # a longer trailer: the dive keeps its pace
        ka = (tk + 0.24) * FPS * 0.62                            # the dive, slowed a little
        mix = sm((tk - A_END) / 1.0)
        bgf = plate if mix >= 1 else frame_at(seqA, ka) * (1 - mix) + plate * mix
        bgf = bgf.copy()
        sc = S0 ** (1 - t / T_HAND)                              # exponential growth = steady approach, scale 1 at hand-over
        w_, h_ = max(2, int(SW * sc)), max(2, int(SH * sc))
        spr = cv2.resize(sprite, (w_, h_), interpolation=cv2.INTER_AREA)
        msk = cv2.resize(smask, (w_, h_), interpolation=cv2.INTER_AREA)[..., None]
        cx_, cy_ = PCX, PCY
        xa, ya = int(round(cx_ - w_ / 2)), int(round(cy_ - h_ / 2))
        region = bgf[ya:ya + h_, xa:xa + w_]
        a_in = 1.0 if (HOOK and not FLOAT) else max(0.0, min(1.0, t / 0.6 + 0.35))   # there from the start, just eases in with the fade
        bgf[ya:ya + h_, xa:xa + w_] = region * (1 - msk * a_in) + spr * msk * a_in
        return bgf

# ---- 2. fixed layers
logo_frame = paste_logo(backdrop())                 # the exact logo, as the AI clips' first frame was built
bg = backdrop()
lg = np.asarray(logo_rgba()).astype(np.float32) / 255
def place(canvas_shape, img, cx, cy):
    out = np.zeros(canvas_shape, np.float32); h, w = img.shape[:2]
    x0, y0 = int(cx - w / 2), int(cy - h / 2); out[y0:y0 + h, x0:x0 + w] = img; return out
# blurred on the whole canvas, so the glow is never cut at the logo picture's edge
glow_src = Image.fromarray((place((H, W, 3), lg[..., :3] * lg[..., 3:4], LOGO_CX, LOGO_CY) * 255).astype(np.uint8))
glow_full = np.asarray(glow_src.filter(ImageFilter.GaussianBlur(38))).astype(np.float32) / 255

# ---- v2: his characters flying at the camera out of the depth (round portraits with an orange rim glow)
import cv2
CAST = '--cast' in sys.argv
MAIN = 'yotam hani rosenblum demokratovich ayelet osnat dorit avram'.split()
REST = ('amir ofer daniel ronit gilad vova news-anchor genz savta shloimi yuval malki brachi esther rina sruli tzvika lola '
        'gym-guy dr-samer matan shuki ruchami').split()
def round_portrait(name, D=512):
    im = Image.open(f'C:/workspace/BoostMind/public/wiki/img/c/{name}.jpg').convert('RGB')
    s = im.width * 0.86; cx, cy = im.width / 2, im.height * 0.40     # the face sits in the upper middle
    face = im.crop((int(cx - s / 2), int(cy - s / 2), int(cx + s / 2), int(cy + s / 2))).resize((int(D * 0.80), int(D * 0.80)), Image.LANCZOS)
    out = np.zeros((D, D, 4), np.float32)
    yy_, xx_ = np.mgrid[0:D, 0:D].astype(np.float32); r = np.sqrt((xx_ - D / 2) ** 2 + (yy_ - D / 2) ** 2) / (D * 0.40)
    # outer glow, then the orange rim, then the face
    glow_a = np.exp(-((r - 1.0) / 0.12) ** 2) * (r > 1.0) * 0.85
    out[..., :3] = np.array([1.0, 0.42, 0.10]); out[..., 3] = glow_a
    rim = np.clip(1 - np.abs(r - 0.985) / 0.03, 0, 1)
    out[..., :3] = out[..., :3] * (1 - rim[..., None]) + np.array([1.0, 0.62, 0.25]) * rim[..., None]
    out[..., 3] = np.maximum(out[..., 3], rim)
    f = np.zeros((D, D, 3), np.float32); o = int(D * 0.10)
    f[o:o + face.height, o:o + face.width] = np.asarray(face).astype(np.float32) / 255
    inside = np.clip((0.965 - r) / 0.01, 0, 1)[..., None]
    out[..., :3] = out[..., :3] * (1 - inside) + f * inside
    out[..., 3] = np.maximum(out[..., 3], inside[..., 0])
    return out
flyers = []
if CAST:
    rng = np.random.default_rng(11)
    order = MAIN[:4] + REST[:6] + MAIN[4:] + REST[6:] + MAIN[:3]
    rng.shuffle(order[10:])
    sprites = {n: round_portrait(n) for n in set(order)}
    t_first, t_last, life = 0.15, 4.9, 2.7
    for i, n in enumerate(order):
        ang = rng.uniform(0, 2 * np.pi)
        rr = rng.uniform(0.75, 1.3) * (1.1 if n in MAIN else 1.0) * (1 + 0.35 * i / len(order))
        flyers.append({'name': n, 't0': t_first + (t_last - t_first) * i / (len(order) - 1) + rng.uniform(-0.12, 0.12), 'life': life * rng.uniform(0.9, 1.1),
                       'x': rr * np.cos(ang) * 0.85, 'y': rr * np.sin(ang) * 1.25, 'big': 1.15 if n in MAIN else rng.uniform(0.8, 1.0)})
VP = (LOGO_CX, LOGO_CY - 60)       # they come out of the depth where the planet will be
SOFT_FACES = '--soft-faces' in sys.argv
def draw_flyers(fr, t):
    global VP
    if APPROACH: VP = (PCX, PCY)
    live = []
    for fl in flyers:
        u = (t - fl['t0']) / fl['life']
        if 0 <= u <= 1:
            z = 16.0 * (0.045) ** u                     # constant-ratio approach: the feeling of flying
            live.append((z, fl))
    for z, fl in sorted(live, key=lambda p: -p[0]):
        size = int(470 * fl['big'] / z)
        if size < 6: continue
        cx = VP[0] + fl['x'] * 760 / z; cy = VP[1] + fl['y'] * 760 / z
        if cx + size < 0 or cx - size > W or cy + size < 0 or cy - size > H: continue
        alpha = min(1.0, max(0.0, (16.0 - z) / 9.0)) ** 1.4
        if SOFT_FACES:   # see-through: ~0.5 when far, up to 0.85 close, stars and dust show through
            alpha = min(1.0, max(0.0, (16.0 - z) / 5.0)) * (0.5 + 0.35 * min(1.0, max(0.0, (14.0 - z) / 12.0)))
        spr = cv2.resize(sprites[fl['name']], (size, size), interpolation=cv2.INTER_AREA if size < 512 else cv2.INTER_LINEAR)
        x0, y0 = int(cx - size / 2), int(cy - size / 2)
        xa, ya, xb, yb = max(0, x0), max(0, y0), min(W, x0 + size), min(H, y0 + size)
        if xa >= xb or ya >= yb: continue
        s = spr[ya - y0:yb - y0, xa - x0:xb - x0]
        a = s[..., 3:4] * alpha
        fr[ya:yb, xa:xb] = fr[ya:yb, xa:xb] * (1 - a) + s[..., :3] * a

# ---- "what you can do" (2nd trailer): instead of the faces, one feature card per bar of the music, each out of the
# planet, tilted, landing on its beat with a glow pulse, then flying past the camera as the next one lands
FEATURES = arg('--features')
cards = []
if FEATURES:
    k_ = 1
    while os.path.exists(os.path.join(FEATURES, f'card-{k_}.png')):
        im_ = np.asarray(Image.open(os.path.join(FEATURES, f'card-{k_}.png')).convert('RGBA')).astype(np.float32) / 255
        im_[..., :3] *= im_[..., 3:4]                       # premultiplied, so warping never fringes
        cards.append(im_); k_ += 1
    SLOTS = [float(x) for x in arg('--slots', '0.49,1.60,2.71,3.82,5.06,6.17,7.28,8.30').split(',')]
    print('cards', len(cards), 'slots', SLOTS[:len(cards) + 1])
C_ARR, C_EXIT = float(arg('--card-in', '0.28')), float(arg('--card-out', '0.30'))   # how long a card takes to arrive / to leave
HOLD_Y = int(arg('--hold-y', '660'))   # above the planet, so it keeps growing below and behind the cards
def _card_quad(w, h, cx, cy, sc, ry, rx, f=1500.0):
    pts = []
    for x, y in ((-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)):
        x, y = x * sc, y * sc
        x1, z1 = x * math.cos(ry), x * math.sin(ry)                 # yaw
        y1, z2 = y * math.cos(rx) - z1 * math.sin(rx), y * math.sin(rx) + z1 * math.cos(rx)
        d = f / (f + z2)
        pts.append((cx + x1 * d, cy + y1 * d))
    return np.float32(pts)
def draw_cards(fr, t):
    for i, cd in enumerate(cards):
        s0 = SLOTS[i]; s1 = SLOTS[i + 1] if i + 1 < len(SLOTS) else s0 + 1.1
        u = t - s0
        if u < -C_ARR or t > s1 - 0.04: continue
        side = 1 if i % 2 == 0 else -1
        if u < 0:                                                    # out of the planet, easing in
            e = 1 - (1 - (u + C_ARR) / C_ARR) ** 2
            sc = 0.08 + 0.92 * e; a = min(1.0, e * 1.6)
            cx = PCX + (540 - PCX) * e; cy = PCY + (HOLD_Y - PCY) * e
            ry = math.radians(32 * side) * (1 - e) + math.radians(7 * side) * e; rx = math.radians(-10) * (1 - e)
        else:
            T_OUT = s1 - s0 - C_EXIT
            if u < T_OUT:                                            # the hold: a slow push and the tilt settling
                p = u / T_OUT
                sc = 1.0 + 0.07 * p; a = 1.0
                cx, cy = 540 - side * 10 * p, HOLD_Y - 8 * p
                ry = math.radians(7 * side) * (1 - sm(p * 1.4)) + math.radians(-2 * side) * sm(p * 1.4); rx = 0.0
            else:                                                    # past the camera, to the side
                q = min(1.0, (u - T_OUT) / (C_EXIT - 0.04))
                e = 0.5 - 0.5 * math.cos(math.pi * q)
                sc = 1.07 + 2.2 * e; a = (1 - q) ** 1.6
                cx, cy = 540 - side * 10 - side * 900 * e, HOLD_Y - 8 + 260 * e
                ry = math.radians(-2 * side - 28 * side * e); rx = 0.0
        if a <= 0.01: continue
        h_, w_ = cd.shape[:2]
        sc *= 0.98
        dst = _card_quad(w_, h_, cx, cy, sc, ry, rx)
        Hm = cv2.getPerspectiveTransform(np.float32([[0, 0], [w_, 0], [w_, h_], [0, h_]]), dst)
        xa, ya = max(0, int(dst[:, 0].min()) - 2), max(0, int(dst[:, 1].min()) - 2)
        xb, yb = min(W, int(dst[:, 0].max()) + 3), min(H, int(dst[:, 1].max()) + 3)
        if xa >= xb or ya >= yb: continue
        Ht = np.float64([[1, 0, -xa], [0, 1, -ya], [0, 0, 1]]) @ Hm
        wp = cv2.warpPerspective(cd, Ht, (xb - xa, yb - ya), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
        if u >= 0 and u < 0.6:                                       # the landing: a warm pulse behind the card
            pk = math.exp(-u / 0.18) * 0.55
            g_ = np.exp(-(((xx - cx) / 520) ** 2 + ((yy - cy) / 420) ** 2))[..., None] * np.array([1.0, 0.45, 0.12], np.float32) * pk
            fr[:] = 1 - (1 - fr) * (1 - np.clip(g_, 0, 1))          # the whole frame: a soft glow, never a box
        al = wp[..., 3:4] * a
        fr[ya:yb, xa:xb] = fr[ya:yb, xa:xb] * (1 - al) + wp[..., :3] * a

# ---- v2: richer space - a Milky-Way band of thin orange dust, a soft orange haze drifting, fine glowing particles
SPACE = '--space' in sys.argv
def fbm(h, w, seed, octaves=6, base=6, persist=0.55):
    r = np.random.default_rng(seed); acc = np.zeros((h, w), np.float32); amp, tot = 1.0, 0.0
    for o in range(octaves):
        n = base * 2 ** o
        g = r.random((max(2, int(n * h / w)), n)).astype(np.float32)
        acc += cv2.resize(g, (w, h), interpolation=cv2.INTER_CUBIC) * amp; tot += amp; amp *= persist
    acc /= tot
    return (acc - acc.min()) / (acc.max() - acc.min() + 1e-6)
if SPACE:
    PAD = 360
    TW, TH = W + PAD, H + PAD
    _ty, _tx = np.mgrid[0:TH, 0:TW].astype(np.float32)
    # the band: diagonal through the frame, dusty filaments with darker lanes
    ang_ = math.radians(-58)
    dist_ = (_tx - TW * 0.5) * math.sin(ang_) - (_ty - TH * 0.42) * math.cos(ang_)
    band = np.exp(-(dist_ / 300) ** 2)
    fil = fbm(TH, TW, 5, octaves=7, base=5) ** 2.2
    lanes = 1 - 0.75 * np.clip((fbm(TH, TW, 9, octaves=6, base=8) - 0.45) / 0.3, 0, 1)
    micro = (np.random.default_rng(4).random((TH, TW)) > 0.9965).astype(np.float32) * np.random.default_rng(6).random((TH, TW)).astype(np.float32)
    micro = cv2.GaussianBlur(micro, (0, 0), 0.7) * 2.2
    band_rgb = (band * fil * lanes)[..., None] * np.array([1.0, 0.42, 0.10], np.float32) * 1.05 \
        + (band ** 1.5 * micro)[..., None] * np.array([1.0, 0.85, 0.7], np.float32)
    # soft haze, everywhere but faint
    haze_ = (np.clip((fbm(TH, TW, 21, octaves=5, base=3) - 0.35) / 0.65, 0, 1) ** 2)[..., None] * np.array([0.9, 0.30, 0.06], np.float32) * 0.26
    SKY = (band_rgb + haze_).astype(np.float32)
    # fine glowing orange particles in 3D, drifting toward the camera
    pr = np.random.default_rng(31)
    NP_ = 520
    P = np.stack([pr.uniform(-1, 1, NP_) * 1.3, pr.uniform(-1, 1, NP_) * 2.2, pr.uniform(0.3, 6.0, NP_)], 1).astype(np.float32)
    PB = pr.uniform(0.25, 1.0, NP_).astype(np.float32) ** 2
    PC = np.where(pr.random(NP_) < 0.75, 0, 1)
def space_fx(fr, t, strength=1.0):
    ox = int(PAD / 2 + 70 * math.sin(t * 0.21)); oy = int(PAD / 2 - 12 * t)     # slow drift
    oy = max(0, min(PAD, oy))
    sky = SKY[oy:oy + H, ox:ox + W]
    lay = np.zeros((H, W, 3), np.float32)
    z = (P[:, 2] - t * 0.55) % 6.0 + 0.25            # flying through them
    sx = W / 2 + P[:, 0] * 520 / z; sy = H * 0.45 + P[:, 1] * 520 / z
    for i in np.nonzero((sx > -10) & (sx < W + 10) & (sy > -10) & (sy < H + 10))[0]:
        zi = float(z[i]); rad_ = max(1, int(2.4 / zi + 0.5)); b = float(PB[i]) * min(1.0, (6.2 - zi) / 2.0)
        col = (1.0 * b, 0.48 * b, 0.12 * b) if PC[i] == 0 else (1.0 * b, 0.82 * b, 0.62 * b)
        cv2.circle(lay, (int(sx[i]), int(sy[i])), rad_, col, -1, lineType=cv2.LINE_AA)
    lay = lay * 1.3 + cv2.GaussianBlur(lay, (0, 0), 4) * 2.4
    add = (sky + lay * 0.9) * strength
    return 1 - (1 - fr) * (1 - np.clip(add, 0, 1))

# ---- v2: a star glint blinking on the planet's rim on the final hit
GLINT = '--glint' in sys.argv
# the logo's planet: centre (250, 218), radius 155 in logo-512 pixels -> story pixels
_k = LOGO_W / 508.0
PL_CX, PL_CY, PL_R = LOGO_CX + (250 - 254) * _k, LOGO_CY + (218 - 215.5) * _k, 155 * _k
GL_X, GL_Y = PL_CX + PL_R * math.cos(math.radians(-128)), PL_CY + PL_R * math.sin(math.radians(-128))   # upper-left rim
_gy, _gx = np.mgrid[0:H, 0:W].astype(np.float32); _gdx, _gdy = _gx - GL_X, _gy - GL_Y
_gr = np.sqrt(_gdx ** 2 + _gdy ** 2)
def star(scale, rot):
    c, s = math.cos(rot), math.sin(rot)
    u, v = _gdx * c + _gdy * s, -_gdx * s + _gdy * c
    L = 330 * scale
    rays = (np.exp(-(v / 2.2) ** 2) * np.exp(-np.abs(u) / L) + np.exp(-(u / 2.2) ** 2) * np.exp(-np.abs(v) / L))
    d1, d2 = (u + v) / 1.414, (u - v) / 1.414
    rays += 0.45 * (np.exp(-(d2 / 1.8) ** 2) * np.exp(-np.abs(d1) / (L * 0.4)) + np.exp(-(d1 / 1.8) ** 2) * np.exp(-np.abs(d2) / (L * 0.4)))
    core = np.exp(-(_gr / (14 * scale + 1)) ** 2) * 1.2 + np.exp(-(_gr / (70 * scale + 1)) ** 2) * 0.35
    return (rays + core)[..., None] * np.array([1.0, 0.86, 0.66], np.float32)

FONT = 'C:/Windows/Fonts/Heebo-VariableFont_wght.ttf'
def text_layer(txt, size, weight, color, spacing=0, rtl=False):
    f = ImageFont.truetype(FONT, size); f.set_variation_by_axes([weight])
    s = txt[::-1] if rtl else txt            # no RTL shaping in this PIL: Hebrew written right to left by hand
    if spacing:
        widths = [f.getbbox(ch)[2] - f.getbbox(ch)[0] if ch != ' ' else size * 0.3 for ch in s]
        tw = int(sum(widths) + spacing * (len(s) - 1)) + 20
    else:
        tw = int(f.getlength(s)) + 20
    im = Image.new('RGBA', (tw, int(size * 1.6)), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    if spacing:
        x = 10
        for ch, w_ in zip(s, widths):
            d.text((x, size * 0.2), ch, font=f, fill=color); x += w_ + spacing
    else:
        d.text((10, size * 0.2), s, font=f, fill=color)
    a = np.asarray(im).astype(np.float32) / 255
    return a
tag = text_layer(TAG, 66, 700, (255, 255, 255, 255), rtl=True)
url = text_layer(URL, 50, 600, (255, 122, 48, 255), spacing=4)
TAG_Y, URL_Y = 1335, 1430
BIO = '--bio' in sys.argv           # his words for the end card
bio = text_layer('פרטים בביו', 58, 700, (255, 255, 255, 255), rtl=True)
BIO_Y = 1530

def over(dst, rgba, cx, cy, alpha, dy=0):
    h, w = rgba.shape[:2]; x0, y0 = int(cx - w / 2), int(cy - h / 2 + dy)
    a = rgba[..., 3:4] * alpha
    dst[y0:y0 + h, x0:x0 + w] = dst[y0:y0 + h, x0:x0 + w] * (1 - a) + rgba[..., :3] * a

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
rad = np.sqrt((xx - LOGO_CX) ** 2 + (yy - LOGO_CY) ** 2)
flash_shape = (np.exp(-(rad / 380) ** 2) * 0.9 + np.exp(-(rad / 1100) ** 2) * 0.5)[..., None] * np.array([1.0, 0.62, 0.32], np.float32)
streak = (np.exp(-((yy - LOGO_CY) / 5.0) ** 2) * np.exp(-((xx - LOGO_CX) / 900) ** 2) +
          0.5 * np.exp(-((yy - LOGO_CY) / 22.0) ** 2) * np.exp(-((xx - LOGO_CX) / 520) ** 2))[..., None] * np.array([1.0, 0.55, 0.22], np.float32)
vign = (1 - 0.45 * np.clip((np.sqrt(((xx - W / 2) / (W * 0.75)) ** 2 + ((yy - H * 0.45) / (H * 0.62)) ** 2) - 0.55) / 0.6, 0, 1) ** 1.5)[..., None]
def sm(t): t = min(1, max(0, t)); return t * t * (3 - 2 * t)
SHEEN = '--sheen' in sys.argv
LOGO_A = place((H, W, 1), lg[..., 3:4], LOGO_CX, LOGO_CY)[..., 0]   # where the logo is, for the sweep

def zoom(img, s, cx=LOGO_CX, cy=LOGO_CY):
    if abs(s - 1) < 1e-4: return img
    M = np.float32([[s, 0, cx - s * cx], [0, s, cy - s * cy]])
    import cv2
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)

# ---- 3. render, straight into ffmpeg (story) - the post is cropped from the same frames
outs = {k: os.path.join(HERE, f'out/{PREFIX}-{NAME}-{k}.mp4') for k in ('story', 'post')}
music = os.path.join(HERE, B['music'])
if EXT_LOOP:
    ext_wav = os.path.join(HERE, f'out/music-{NAME}-ext.wav')
    segs = [(0.0, LB)] + [(LA, LB)] * int(LN) + [(LB, None)]
    fc_, ins_ = '', []
    for i_, (a_, b_) in enumerate(segs):
        tr = f'atrim=start={a_}' + (f':end={b_}' if b_ else '')
        fc_ += f'[0:a]{tr},asetpts=PTS-STARTPTS,afade=t=in:d=0.006,' + (f'afade=t=out:st={b_ - a_ - 0.006:.4f}:d=0.006' if b_ else 'anull') + f'[s{i_}];'
    fc_ += ''.join(f'[s{i_}]' for i_ in range(len(segs))) + f'concat=n={len(segs)}:v=0:a=1'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', music, '-filter_complex', fc_, '-ar', '48000', ext_wav], check=True)
    music = ext_wav
    print('music +', round(EXT, 3), 's; logo at', T_LOGO)
if SLOW:
    slow_wav = os.path.join(HERE, f'out/music-{NAME}-slow.wav')
    fc_ = (f'[0:a]atrim=end={LOGO0},asetpts=PTS-STARTPTS,rubberband=tempo={SLOW}:transients=smooth:detector=soft:window=long:pitchq=quality,'
           f'afade=t=out:st={LOGO0 / SLOW - 0.02:.4f}:d=0.02[a];[0:a]atrim=start={LOGO0},asetpts=PTS-STARTPTS,afade=t=in:d=0.01[b];[a][b]concat=n=2:v=0:a=1')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', music, '-filter_complex', fc_, '-ar', '48000', slow_wav], check=True)
    music = slow_wav
    print('music slowed to', SLOW, 'until the hit; logo at', T_LOGO)
SFX = arg('--sfx')
if SFX:   # the glint's sparkle under the music, on the hit
    mixed = os.path.join(HERE, f'out/mix-{NAME}.wav')
    ms = int((T_LOGO + 0.04) * 1000)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', music, '-i', os.path.join(HERE, SFX), '-filter_complex',
                    f'[1:a]volume={arg("--sfx-vol", "0.9")},adelay={ms}|{ms}[s];[0:a][s]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95',
                    mixed], check=True)
    music = mixed
PRE = 0.0
HK = json.load(open(os.path.join(HERE, HOOK), encoding='utf8')) if HOOK else {}
FLOAT = bool(HK.get('float'))
if FLOAT:
    panes, voice = [], []
    PW_, PH_ = 720, 1280
    _R2 = 46
    pm_ = np.ones((PH_, PW_), np.float32)
    for (cy_, cx_) in ((_R2, _R2), (_R2, PW_ - _R2), (PH_ - _R2, _R2), (PH_ - _R2, PW_ - _R2)):
        ys = slice(0, _R2) if cy_ == _R2 else slice(PH_ - _R2, PH_); xs = slice(0, _R2) if cx_ == _R2 else slice(PW_ - _R2, PW_)
        gy_, gx_ = np.mgrid[ys, xs].astype(np.float32)
        pm_[ys, xs] = np.clip(_R2 - np.sqrt((gx_ - cx_) ** 2 + (gy_ - cy_) ** 2) + 0.5, 0, 1)
    p_edge = np.clip(pm_ - cv2.erode(pm_, np.ones((13, 13), np.uint8)), 0, 1)[..., None]
    p_gy, p_gx = np.mgrid[0:PH_, 0:PW_].astype(np.float32)
    for i, c in enumerate(HK['clips']):
        src = os.path.join(HERE, c['src']); d = c['out'] - c['in']; lead = c.get('lead', 0.0)
        vin = c['in'] - lead; vd = c.get('vout', c['out'] + 1.0) - vin
        fw_, fh_ = (W, H) if c.get('full') else (PW_, PH_)
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(vin), '-t', str(vd), '-i', src, '-vf', f'fps={FPS},scale={fw_}:{fh_}:flags=lanczos',
                              '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
        panes.append({'at': c['at'], 'd': d, 'f': list(np.frombuffer(raw, np.uint8).reshape(-1, fh_, fw_, 3)), 'side': 1 if i % 2 == 0 else -1,
                      'full': c.get('full', 0), 'shrink': c.get('shrink', 0.8), 'lead': lead, 'tail': c.get('tail', 0.0),
                      'keys': c.get('keys'), 'vstart': c['at'] - lead})
        wav = os.path.join(HERE, f'out/hook-{i}.wav'); ms_ = int(c['at'] * 1000)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(c['in']), '-t', str(d), '-i', src, '-af',
                        f'volume={HK.get("gain_db", 0)}dB,'
                        + (f"volume='if(lt(t,{c['lift'][0]}),{10 ** (c['lift'][1] / 20):.3f},if(lt(t,{c['lift'][0] + 0.03}),{10 ** (c['lift'][1] / 20):.3f}-({10 ** (c['lift'][1] / 20):.3f}-1)*(t-{c['lift'][0]})/0.03,1))':eval=frame," if c.get('lift') else '')
                        + f'afade=t=in:d={c.get("fade_in", 0.012)},afade=t=out:st={d - c.get("fade_out", 0.03):.3f}:d={c.get("fade_out", 0.03)},'
                        + (f'highpass=f=110,equalizer=f=3200:t=q:w=1.3:g={c["presence"]},' if c.get('presence') else '')
                        + (f'apad=pad_dur={HK.get("echo_pad", 0.8)},aecho={HK["echo"]},' if HK.get('echo') else '')
                        + (f'pan=stereo|c0={1 - max(0, c["pan"]):.2f}*c0|c1={1 + min(0, c["pan"]):.2f}*c1,' if c.get('pan') else '')
                        + f'adelay={ms_}|{ms_}', '-ar', '48000', '-ac', '2', wav], check=True)
        voice.append(wav)
    def _tl(txt, size, color):
        a_ = text_layer(txt, size, 800, color, rtl=True)
        return a_, np.asarray(Image.fromarray((a_ * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(22))).astype(np.float32) / 255
    TITLE = [_tl(HK['title'][0], 128, (255, 122, 48, 255)), _tl(HK['title'][1], 92, (255, 255, 255, 255))]
    mixed = os.path.join(HERE, f'out/mix-{NAME}-hook.wav')
    n_ = len(voice); ins = sum([['-i', p_] for p_ in voice], [])
    fc = ''.join(f'[{i}:a]' for i in range(n_)) + f'amix=inputs={n_}:duration=longest:normalize=0,asplit=2[vo][sc0];[sc0]apad[sc];'   # padded: the ducking runs to the music's end
    fc += f'[{n_}:a][sc]sidechaincompress=threshold={HK.get("duck_thr", 0.02)}:ratio={HK.get("duck_ratio", 6)}:attack=25:release=300:makeup=1[mu];'   # the music steps back under a voice
    fc += '[vo][mu]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.95'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *ins, '-i', music, '-filter_complex', fc, '-ar', '48000', mixed], check=True)
    music = mixed
    print('float hook:', [(p_['at'], round(p_['d'], 2)) for p_ in panes])
def _quad3(w, h, cx, cy, sc, ry, rx, rz, f=1500.0):
    pts = []
    for x, y in ((-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)):
        x, y = x * sc, y * sc
        x, y = x * math.cos(rz) - y * math.sin(rz), x * math.sin(rz) + y * math.cos(rz)          # roll
        x1, z1 = x * math.cos(ry), x * math.sin(ry)                                               # yaw
        y1, z2 = y * math.cos(rx) - z1 * math.sin(rx), y * math.sin(rx) + z1 * math.cos(rx)       # pitch
        d_ = f / (f + z2)
        pts.append((cx + x1 * d_, cy + y1 * d_))
    return np.float32(pts)
def _warp_draw(fr, img_pm, cx, cy, sc, ry, rx, rz, a):
    h_, w_ = img_pm.shape[:2]
    dst = _quad3(w_, h_, cx, cy, sc, ry, rx, rz)
    xa, ya = max(0, int(dst[:, 0].min()) - 2), max(0, int(dst[:, 1].min()) - 2)
    xb, yb = min(W, int(dst[:, 0].max()) + 3), min(H, int(dst[:, 1].max()) + 3)
    if xa >= xb or ya >= yb or a <= 0.01: return
    Hm = np.float64([[1, 0, -xa], [0, 1, -ya], [0, 0, 1]]) @ cv2.getPerspectiveTransform(np.float32([[0, 0], [w_, 0], [w_, h_], [0, h_]]), dst)
    wp = cv2.warpPerspective(img_pm, Hm, (xb - xa, yb - ya), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    fr[ya:yb, xa:xb] = fr[ya:yb, xa:xb] * (1 - wp[..., 3:4] * a) + wp[..., :3] * a
KCH = ('cx', 'cy', 'sc', 'ry', 'rx', 'rz', 'a', 'g', 'z')
def _key_at(keys, t):
    """a smooth curve through the keyframes (Catmull-Rom), held at both ends"""
    ts = [k['t'] for k in keys]
    if t <= ts[0]: return dict(keys[0])
    if t >= ts[-1]: return dict(keys[-1])
    i = max(j for j in range(len(ts) - 1) if ts[j] <= t)
    k0, k1, k2, k3 = keys[max(0, i - 1)], keys[i], keys[i + 1], keys[min(len(keys) - 1, i + 2)]
    u = (t - k1['t']) / (k2['t'] - k1['t'])
    out = {}
    for ch in KCH:
        p0, p1, p2, p3 = (k.get(ch, k1.get(ch, 0)) for k in (k0, k1, k2, k3))
        m1 = (p2 - p0) / max(1e-6, k2['t'] - k0['t']) * (k2['t'] - k1['t']) if k0 is not k1 else (p2 - p1)
        m2 = (p3 - p1) / max(1e-6, k3['t'] - k1['t']) * (k2['t'] - k1['t']) if k3 is not k2 else (p2 - p1)
        h = (2 * u ** 3 - 3 * u ** 2 + 1) * p1 + (u ** 3 - 2 * u ** 2 + u) * m1 + (-2 * u ** 3 + 3 * u ** 2) * p2 + (u ** 3 - u ** 2) * m2
        lo, hi = min(p1, p2), max(p1, p2)
        out[ch] = min(hi, max(lo, h))                               # no overshoot: hovering, never wobbling past a key
    return out
def draw_hover(fr, t):
    live = []
    for i, p_ in enumerate(panes):
        ks = p_['keys']
        if t < ks[0]['t'] or t > ks[-1]['t']: continue
        st = _key_at(ks, t)
        if st['a'] <= 0.005: continue
        live.append((st.get('z', 0), i, p_, st))
    for _, i, p_, st in sorted(live, key=lambda x: x[0]):
        L_ = len(p_['f']); k_ = max(0, int((t - p_['vstart']) * FPS))
        if k_ >= L_: k_ = max(0, L_ - 1 - (k_ - L_ + 1) % max(1, L_ - 1))
        g = min(1.0, max(0.0, st['g']))
        if g < 0.01 and p_['f'][k_].shape[1] == W:                     # still the full-screen video
            fr[:] = p_['f'][k_].astype(np.float32) / 255
            continue
        img = p_['f'][k_]
        if img.shape[1] != PW_: img = cv2.resize(img, (PW_, PH_), interpolation=cv2.INTER_AREA)
        img = img.astype(np.float32) / 255
        sweep = (t - p_['vstart']) / 3.0                               # a slow glass glint across the pane
        band = np.exp(-(((p_gx * 0.7 + p_gy * 0.45) / 900.0 - (sweep * 1.6 - 0.3)) ** 2) / 0.004)[..., None] * 0.14 * g
        img = 1 - (1 - img) * (1 - band)
        op = 1.0 + (float(HK.get('opacity', 0.85)) - 1.0) * g
        rgba = np.concatenate([img * pm_[..., None] * op, pm_[..., None] * op], 2)
        rgba = rgba * (1 - p_edge * g) + np.concatenate([np.array([1.0, 0.55, 0.2], np.float32) * np.ones((PH_, PW_, 3), np.float32), np.ones((PH_, PW_, 1), np.float32)], 2) * p_edge * g
        _warp_draw(fr, rgba, st['cx'], st['cy'], st['sc'], math.radians(st['ry']), math.radians(st['rx']), math.radians(st['rz']), st['a'])
def draw_panes(fr, t):
    if panes and panes[0].get('keys'): return draw_hover(fr, t)
    """the hook's real clips as glass panes drifting and turning in the space, the last one spun away into the planet"""
    # who is in front: a pane that is leaving goes behind everything, a newer pane comes in behind the one still talking
    leaving = lambda p_: t > p_['at'] - p_['lead'] + p_['lead'] + p_['d'] + p_['tail']
    order = [x for x in enumerate(panes) if leaving(x[1]) and x[0] < len(panes) - 1] + \
            [x for x in reversed(list(enumerate(panes))) if not (leaving(x[1]) and x[0] < len(panes) - 1)]
    for i, p_ in order:
        side = p_['side']; last = i == len(panes) - 1
        at = p_['at'] - p_['lead']                                                # when the picture appears
        d = p_['lead'] + p_['d'] + p_['tail']                                     # on screen until it leaves
        end = at + d
        if t < at or t > end + (HK.get('spin', 0.85) if last else HK.get('exit', 0.65)): continue
        L_ = len(p_['f']); k_ = max(0, int((t - at) * FPS))
        if k_ >= L_: k_ = max(0, L_ - 1 - (k_ - L_ + 1) % max(1, L_ - 1))         # past its last frame: play back, never freeze
        if p_['full'] and t - at < p_['full']:                                   # full screen, as in the original video
            fr[:] = p_['f'][k_].astype(np.float32) / 255
            continue
        img = p_['f'][k_]
        if img.shape[1] != PW_: img = cv2.resize(img, (PW_, PH_), interpolation=cv2.INTER_AREA)
        img = img.astype(np.float32) / 255
        sweep = (t - at) / max(d, 0.1)                                            # a slow glass glint across the pane
        band = np.exp(-(((p_gx * 0.7 + p_gy * 0.45) / 900.0 - (sweep * 1.6 - 0.3)) ** 2) / 0.004)[..., None] * 0.16
        img = 1 - (1 - img) * (1 - band)
        op = float(HK.get('opacity', 0.85))
        u = t - at
        F0, SH0 = p_['full'], p_['shrink']
        gs = 1.0 if not F0 else 0.5 - 0.5 * math.cos(math.pi * min(1.0, max(0.0, (u - F0) / SH0)))   # glass-ness, 0 = still the full video
        op = 1.0 + (op - 1.0) * gs
        rgba = np.concatenate([img * pm_[..., None] * op, pm_[..., None] * op], 2)
        rgba = rgba * (1 - p_edge * gs) + np.concatenate([np.array([1.0, 0.55, 0.2], np.float32) * np.ones((PH_, PW_, 3), np.float32), np.ones((PH_, PW_, 1), np.float32)], 2) * p_edge * gs
        ARR, EXIT, SPIN = HK.get('arrive', 0.9), HK.get('exit', 0.65), HK.get('spin', 0.85)
        ee = lambda x: 0.5 - 0.5 * math.cos(math.pi * min(1.0, max(0.0, x)))         # slow in, slow out
        if F0 and u < F0 + SH0:                                                   # the full screen shrinks back into a pane in the space
            e = gs
            sc = (W / PW_) * (1 - e) + 0.90 * e; a = 1.0
            cx, cy = 540, 960 + (930 - 960) * e
            ry, rx, rz = math.radians(side * 18 * e), math.radians(10 * e), math.radians(side * -6 * e)
        elif u < ARR and not F0:                                                  # out of the depth while it already plays
            e = 1 - (1 - u / ARR) ** 2
            sc = 0.12 + 0.78 * e; a = min(1.0, 0.25 + e)
            dx_ = HK.get('arrive_dx', 0) * side if i > 0 else 0
            cx, cy = PCX + (540 + dx_ - PCX) * e, PCY + (930 - PCY) * e
            ry, rx, rz = math.radians(side * (40 - 22 * e)), math.radians(12 - 2 * e), math.radians(side * (-18 + 12 * e))
        elif u <= d:                                                              # the drift: a slow turn, a slow push
            st_ = F0 + SH0 if F0 else ARR
            q = (u - st_) / max(0.1, d - st_)
            sc = 0.90 + 0.05 * q; a = 1.0
            dx_ = (HK.get('arrive_dx', 0) * side if i > 0 and not F0 else 0) * (1 - ee(q * 2.2))
            cx, cy = 540 + dx_ + side * 24 * math.sin(q * 1.6), 930 - 16 * q
            ry, rx, rz = math.radians(side * (18 - 22 * q)), math.radians(10 - 12 * q), math.radians(side * (-6 + 7 * q))
        elif not last:                                                            # drifts past, still playing, fading
            q = min(1.0, (u - d) / EXIT); e = ee(q)
            sc = 0.95 + 0.9 * e; a = (1 - q) ** 1.3
            cx, cy = 540 + side * 24 * math.sin(1.6) + side * 620 * e, 914 + 140 * e
            ry, rx, rz = math.radians(side * (-4 - 26 * e)), math.radians(-2 - 6 * e), math.radians(side * (1 + 10 * e))
        else:                                                                     # turns away into the planet
            q = min(1.0, (u - d) / SPIN); e = ee(q)
            sc = 0.95 * (1 - e) + 0.03 * e; a = 1 - sm((q - 0.7) / 0.3)
            cx, cy = 540 + side * 24 * math.sin(1.6) + (PCX - 540) * e, 914 + (PCY - 914) * e
            ry, rx, rz = math.radians(side * (-4 + 4 * e)), math.radians(-2 + 2 * e), math.radians(side * (1 + 120 * e))
        if 0.5 <= u < 1.4 and not F0:                                             # a soft warm swell as it settles
            g_ = np.exp(-(((xx - cx) / 560) ** 2 + ((yy - cy) / 800) ** 2))[..., None] * np.array([1.0, 0.45, 0.12], np.float32) * 0.22 * math.sin(math.pi * (u - 0.5) / 0.9)
            fr[:] = 1 - (1 - fr) * (1 - np.clip(g_, 0, 1))
        _warp_draw(fr, rgba, cx, cy, sc, ry, rx, rz, a)
HOLLY = HK.get('title_style') == 'hollywood'
if HOLLY:
    def _ld(n):
        return np.asarray(Image.open(os.path.join(HERE, f'media/title-{n}.png')).convert('RGBA')).astype(np.float32) / 255
    TM, TS = _ld('main'), _ld('sub')
    TK = cv2.resize(_ld('mask')[..., 3], (TM.shape[1], TM.shape[0]))
    TM_GLOW = cv2.GaussianBlur(TM[..., 3], (0, 0), 34)
    TY1, TY2 = 600, 780
    TBASE = float(HK.get('title_scale', 0.84))                    # the ring band about 860 px wide
def _place(fr_shape, img, cx, cy, sc, blur=0.0):
    """img (h, w, c) scaled about its centre and put at (cx, cy) on a frame-sized canvas"""
    h_, w_ = img.shape[:2]
    M = np.float32([[sc, 0, cx - sc * w_ / 2], [0, sc, cy - sc * h_ / 2]])
    out = cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    if blur > 0.3: out = cv2.GaussianBlur(out, (0, 0), blur)
    return out
_SR = np.random.default_rng(7)
_SPARKS = [(float(_SR.uniform(0, 1)), float(_SR.uniform(-60, 60)), float(_SR.uniform(-40, 80)), float(_SR.uniform(0.5, 1.0))) for _ in range(46)]
def falling_star(fr, u, u0=0.5, dur=0.85):
    """a shooting star cutting down through the title: a hot head, a long fading tail, sparks drifting down behind it"""
    v = (u - u0) / dur
    if v < 0 or v > 1.9: return
    A, Bp = np.array([960.0, TY1 - 330]), np.array([120.0, TY1 + 330])
    lay = np.zeros((H, W, 3), np.float32)
    col = np.array([1.0, 0.82, 0.55], np.float32)
    if v <= 1:
        for j in range(34):                                               # the tail: the head's last positions, fading
            w_ = max(0.0, v - j * 0.016)
            p = A + (Bp - A) * (1 - (1 - w_) ** 1.6)
            k = (1 - j / 34) ** 1.6
            cv2.circle(lay, (int(p[0]), int(p[1])), max(1, int(12 * k)), tuple(float(c) * k * 1.5 for c in col), -1, cv2.LINE_AA)
    for (s0, vx, vy, b) in _SPARKS:                                       # sparks shed along the path, falling and fading
        if v < s0: continue
        age = (v - s0) * dur
        if age > 0.75: continue
        p = A + (Bp - A) * (1 - (1 - s0) ** 1.6) + np.array([vx * age, vy * age + 260 * age * age])
        k = b * (1 - age / 0.75) ** 1.5
        cv2.circle(lay, (int(p[0]), int(p[1])), 3, tuple(float(c) * k * 1.6 for c in col), -1, cv2.LINE_AA)
    lay = lay + cv2.GaussianBlur(lay, (0, 0), 7) * 2.4 + cv2.GaussianBlur(lay, (0, 0), 26) * 1.6
    fr[:] = 1 - (1 - fr) * (1 - np.clip(lay, 0, 1))
def draw_title_holly(fr, t):
    t0, t1 = HK['title_at'], HK['title_out']
    if not (t0 - 0.05 <= t < t1 + 0.05): return
    u, L = t - t0, t1 - t0
    ein = sm(u / 0.7)                                                   # the title arrives out of a blur, slowly
    eout = sm((u - (L - 0.42)) / 0.42)                                  # and we fly through it into the cards
    sc = TBASE * (1.18 - 0.18 * ein) * (1 + 0.035 * u / L) * (1 + 0.45 * eout * eout)
    blur = 14 * (1 - ein) + 10 * eout
    a = ein * (1 - eout)
    if a <= 0.005: return
    main = _place(fr.shape, TM, 540, TY1, sc, blur)
    glow = _place(fr.shape, TM_GLOW, 540, TY1, sc * 1.02)
    mask = _place(fr.shape, TK, 540, TY1, sc, blur * 0.6)
    pulse = 0.35 * math.exp(-max(0.0, u - 0.5) / 0.6) * sm(u / 0.5) + 0.16
    fr[:] = 1 - (1 - fr) * (1 - np.clip(glow[..., None] * np.array([1.0, 0.42, 0.1], np.float32) * pulse * a * 0.8, 0, 1))
    fr[:] = fr * (1 - main[..., 3:4] * a) + main[..., :3] * a
    # a light sweep across the letters
    p_ = -0.25 + 1.5 * sm((u - 0.55) / 1.0)
    band = np.exp(-(((xx - 540) * 0.9 + (yy - TY1) * 0.5) / (TM.shape[1] * sc * 0.5) - (1 - 2 * p_)) ** 2 / 0.006)
    fr[:] = 1 - (1 - fr) * (1 - np.clip((band * mask)[..., None] * np.array([1.0, 0.95, 0.85], np.float32) * 0.85 * a, 0, 1))
    # an anamorphic flare: a hot point riding the sweep, a long thin streak across the frame
    fx = 540 + (TM.shape[1] * sc * 0.5) * (1 - 2 * p_)
    fa = math.sin(math.pi * min(1.0, max(0.0, (u - 0.45) / 1.15))) * (1 - eout)
    if fa > 0.01:
        fl = (np.exp(-((yy - TY1 + 20) / 4.0) ** 2) * np.exp(-np.abs(xx - fx) / 520) * 1.1 +
              np.exp(-((yy - TY1 + 20) / 26.0) ** 2) * np.exp(-np.abs(xx - fx) / 240) * 0.35 +
              np.exp(-(((xx - fx) ** 2 + (yy - TY1 + 20) ** 2) / (2 * 34.0 ** 2))) * 1.2)
        fr[:] = 1 - (1 - fr) * (1 - np.clip(fl[..., None] * np.array([1.0, 0.68, 0.38], np.float32) * fa, 0, 1))
    falling_star(fr, u, HK.get('star_at', 0.62))
    # "מציגים": a beat later, letters settling in
    ea = sm((u - 0.6) / 0.5)
    if ea > 0.01:
        sub = _place(fr.shape, TS, 540, TY2 + 14 * (1 - ea), TBASE * 1.15 * (1.12 - 0.12 * ea) * (1 + 0.45 * eout * eout), 6 * (1 - ea) + 8 * eout)
        aa = ea * (1 - eout)
        fr[:] = fr * (1 - sub[..., 3:4] * aa) + sub[..., :3] * aa
def draw_title(fr, t):
    if HOLLY: return draw_title_holly(fr, t)
    t0, t1 = HK['title_at'], HK['title_out']
    if not (t0 <= t < t1): return
    a = sm((t - t0) / 0.35) * (1 - sm((t - (t1 - 0.3)) / 0.3))
    for (ln, gw), cy_, dy_ in ((TITLE[0], 640, 0), (TITLE[1], 770, 10)):
        gl_ = np.zeros_like(fr); h_, w_ = gw.shape[:2]; x0_, y0_ = int(W / 2 - w_ / 2), int(cy_ - h_ / 2)
        gl_[y0_:y0_ + h_, x0_:x0_ + w_] = gw[..., 3:4] * np.array([1.0, 0.42, 0.1], np.float32) * 0.9
        fr[:] = 1 - (1 - fr) * (1 - np.clip(gl_ * a, 0, 1))
        over(fr, ln, W / 2, cy_, a, dy=(1 - a) * (18 + dy_))
if HOOK and not FLOAT:
    PRE, FLY = HK['pre'], HK['fly']
    hook_frames, parts = [], []
    for i, c in enumerate(HK['clips']):
        src = os.path.join(HERE, c['src']); d = c['out'] - c['in']
        vd = c.get('vout', c['out']) - c['in']                  # the picture can stop earlier (a view switch) - its last frame holds
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(c['in']), '-t', str(vd), '-i', src, '-vf', f'fps={FPS},scale={W}:{H}:flags=lanczos',
                              '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
        fr_c = list(np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3))
        hook_frames += fr_c + [fr_c[-1]] * max(0, int(round((c['in'] + d) * FPS)) - int(round(c['in'] * FPS)) - len(fr_c))
        wav = os.path.join(HERE, f'out/hook-{i}.wav')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(c['in']), '-t', str(d), '-i', src, '-af',
                        f'volume={HK.get("gain_db", 0)}dB,afade=t=in:d=0.012,afade=t=out:st={d - 0.03:.3f}:d=0.03', '-ar', '48000', '-ac', '2', wav], check=True)
        parts.append(wav)
    T_CLIPS = len(hook_frames) / FPS
    # the rounded card the last frame becomes, with the same orange rim as the feature cards
    _R = 70
    _cm = np.ones((H, W), np.float32)
    for (cy_, cx_) in ((_R, _R), (_R, W - _R), (H - _R, _R), (H - _R, W - _R)):
        ys, xs = slice(cy_ - _R if cy_ == _R else H - _R, cy_ if cy_ == _R else H), slice(cx_ - _R if cx_ == _R else W - _R, cx_ if cx_ == _R else W)
        gy_, gx_ = np.mgrid[ys, xs].astype(np.float32)
        _cm[ys, xs] = np.clip(_R - np.sqrt((gx_ - cx_) ** 2 + (gy_ - cy_) ** 2) + 0.5, 0, 1)
    _edge = np.clip(_cm - cv2.erode(_cm, np.ones((19, 19), np.uint8)), 0, 1)
    def _title_line(txt, size, color):
        a_ = text_layer(txt, size, 800, color, rtl=True)
        g_ = np.asarray(Image.fromarray((a_ * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(22))).astype(np.float32) / 255
        return a_, g_
    TITLE = [_title_line(HK['title'][0], 128, (255, 122, 48, 255)), _title_line(HK['title'][1], 92, (255, 255, 255, 255))]
    # the sound: the clips back to back, a rising shimmer into the title, the music from `pre`
    mixed = os.path.join(HERE, f'out/mix-{NAME}-hook.wav')
    ins = sum([['-i', p_] for p_ in parts], [])
    n_ = len(parts)
    ms_pre, ms_sw = int(PRE * 1000), int(max(0.0, PRE - 2.48 + 0.05) * 1000)
    fc = ''.join(f'[{i}:a]' for i in range(n_)) + f'concat=n={n_}:v=0:a=1[hk];'
    fc += f'[{n_}:a]adelay={ms_pre}|{ms_pre}[mu];'
    fc += f'[{n_ + 1}:a]areverse,volume=0.32,afade=t=in:d=0.8,adelay={ms_sw}|{ms_sw}[sw];'
    fc += '[hk][sw][mu]amix=inputs=3:duration=longest:normalize=0,alimiter=limit=0.95'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *ins, '-i', music, '-i', os.path.join(HERE, 'music/sfx-shimmer.mp3'), '-filter_complex', fc, '-ar', '48000', mixed], check=True)
    music = mixed
    print('hook', round(T_CLIPS, 2), 's of clips; music from', PRE)
def hook_frame(f):
    T = f / FPS
    fr = frame(f - PRE * FPS)                                  # the opening space, before the music: same scene, continuous
    if T < T_CLIPS:
        return hook_frames[int(f)].astype(np.float32) / 255
    if T < T_CLIPS + FLY:                                      # the last clip frame becomes a card and is pulled into the planet
        q = (T - T_CLIPS) / FLY
        e = q * q * (3 - 2 * q) * 0.55 + q ** 3 * 0.45
        sc = 1.0 - 0.96 * e
        rim = min(1.0, q / 0.12)
        img = hook_frames[-1].astype(np.float32) / 255
        img = img * (1 - _edge[..., None] * rim) + np.array([1.0, 0.55, 0.2], np.float32) * _edge[..., None] * rim
        w_, h_ = max(2, int(W * sc)), max(2, int(H * sc))
        cx_, cy_ = W / 2 + (PCX - W / 2) * e, H / 2 + (PCY - H / 2) * e
        im_ = cv2.resize(img, (w_, h_), interpolation=cv2.INTER_AREA); m_ = cv2.resize(_cm, (w_, h_), interpolation=cv2.INTER_AREA)[..., None]
        x0_, y0_ = int(cx_ - w_ / 2), int(cy_ - h_ / 2)
        xa, ya, xb, yb = max(0, x0_), max(0, y0_), min(W, x0_ + w_), min(H, y0_ + h_)
        a_ = m_[ya - y0_:yb - y0_, xa - x0_:xb - x0_] * (1 - sm((q - 0.8) / 0.2))
        gl_ = np.exp(-(((xx - cx_) / (w_ * 0.7 + 40)) ** 2 + ((yy - cy_) / (h_ * 0.6 + 40)) ** 2))[..., None] * np.array([1.0, 0.45, 0.12], np.float32) * 0.5 * rim
        fr = 1 - (1 - fr) * (1 - np.clip(gl_, 0, 1))
        fr[ya:yb, xa:xb] = fr[ya:yb, xa:xb] * (1 - a_) + im_[ya - y0_:yb - y0_, xa - x0_:xb - x0_] * a_
    t0 = T_CLIPS + FLY * 0.55
    if t0 <= T < PRE + 0.3:                                    # the title, in near-silence; gone before the first card lands
        a = sm((T - t0) / 0.45) * (1 - sm((T - (PRE - 0.05)) / 0.3))
        for (ln, gw), cy_, dy_ in ((TITLE[0], 700, 0), (TITLE[1], 830, 10)):
            gl_ = np.zeros_like(fr); h_, w_ = gw.shape[:2]; x0_, y0_ = int(W / 2 - w_ / 2), int(cy_ - h_ / 2)
            gl_[y0_:y0_ + h_, x0_:x0_ + w_] = gw[..., 3:4] * np.array([1.0, 0.42, 0.1], np.float32) * 0.9
            fr = 1 - (1 - fr) * (1 - np.clip(gl_ * a, 0, 1))
            over(fr, ln, W / 2, cy_, a, dy=(1 - a) * (18 + dy_))
    return np.clip(fr, 0, 1)
def enc(path, crop):
    return subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                             '-i', music, '-vf', crop, '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p',
                             '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', path], stdin=subprocess.PIPE)
NF = int(round(DUR * FPS))
END_CLIP = None
if not APPROACH: SMOOTH_END = False
NO_HIT = '--no-hit' in sys.argv   # for measuring the base hand-over without the hit's light
def frame(f):
    t = f / FPS
    k = int(round((t - t_seq0) * FPS))
    if APPROACH and t < T_LOGO:
        fr = approach_bg(t)
    elif t < T_LOGO and 0 <= k < n_seq:
        fr = np.asarray(Image.open(seq[k]).convert('RGB')).astype(np.float32) / 255
        lock = sm((t - (T_LOGO - 0.30)) / 0.30)                    # glide onto the exact logo
        fr = fr * (1 - lock) + logo_frame * lock
    elif t < T_LOGO:
        fr = bg.copy() if k < 0 else logo_frame.copy()
    else:
        base = logo_frame
        if APPROACH and SMOOTH_END:
            d = sm((t - T_LOGO - 0.15) / 0.95)                     # long, eased dissolve under the glow swell
            if d < 1:
                base = end_clip_frame(t) * (1 - d) + logo_frame * d
        fr = zoom(base, 1.0 + 0.035 * sm((t - T_LOGO) / (DUR - T_LOGO)))
    fr = fr.copy()
    if SPACE:   # under the characters; a touch lighter over the AI galaxy, a whisper on the end card
        fr = space_fx(fr, t, 1.0 - 0.2 * sm((t - T_LOGO) / 1.5) if SMOOTH_END else (1.0 if t < T_LOGO else 0.8))
    if flyers and t < T_LOGO:
        draw_flyers(fr, t)
    if FLOAT:
        draw_panes(fr, t); draw_title(fr, t)
    if cards and t < T_LOGO:
        draw_cards(fr, t)
    fade_in = 1.0 if (HOOK and not FLOAT) or (FLOAT and panes[0]['full']) else (sm(t / 0.35) if FLOAT else sm(t / 0.9))
    # the final hit: flash, flare streak, the logo's glow pulsing
    if SHEEN and SMOOTH_END and not NO_HIT and t > T_LOGO - 0.6:
        # one continuous light curve: a build before the hit, the swell on it, settling after - nothing switches on at once
        u = t - T_LOGO
        pre_ = sm((u + 0.6) / 0.6)
        swell = sm(u / 0.14) * math.exp(-max(0.0, u - 0.14) * 1.1) if u > 0 else 0.0
        rise = sm(u / 0.30) * math.exp(-max(0.0, u - 0.30) * 0.9) if u > 0 else 0.0
        st_ = 0.6 * pre_ * (math.exp(-max(0.0, u) * 1.2)) + 1.1 * rise
        gl_ = 0.2 * pre_ + 0.75 * swell
        fr = 1 - (1 - fr) * (1 - np.clip(flash_shape * 0.22 * swell + streak * st_ + glow_full * gl_, 0, 1))
        if 0.12 <= u <= 1.5:
            p_ = -1.0 + 2.2 * sm((u - 0.12) / 1.25)
            band_ = np.exp(-(((xx - LOGO_CX) * 0.82 + (yy - LOGO_CY) * 0.57) / (LOGO_W * 0.5) - p_) ** 2 / 0.012)
            fr = 1 - (1 - fr) * (1 - np.clip((band_ * LOGO_A)[..., None] * np.array([1.0, 0.86, 0.66], np.float32) * 0.55 * sm((u - 0.12) / 0.2), 0, 1))
    elif NO_HIT:
        pass
    elif SHEEN and t >= T_LOGO - 0.04:
        u = t - T_LOGO
        swell = sm(u / 0.14) * math.exp(-max(0.0, u - 0.14) * 1.1)          # rim glow swells and settles
        rise = sm(u / 0.30) * math.exp(-max(0.0, u - 0.30) * 0.9)            # a soft anamorphic streak rises and fades
        fr = 1 - (1 - fr) * (1 - np.clip(flash_shape * 0.22 * swell + streak * 1.1 * rise + glow_full * (0.2 + 0.75 * swell), 0, 1))
        if 0.12 <= u <= 1.5:                                                   # a light sweep gliding across ring and wordmark
            p_ = -1.0 + 2.2 * sm((u - 0.12) / 1.25)
            band_ = np.exp(-(((xx - LOGO_CX) * 0.82 + (yy - LOGO_CY) * 0.57) / (LOGO_W * 0.5) - p_) ** 2 / 0.012)
            fr = 1 - (1 - fr) * (1 - np.clip((band_ * LOGO_A)[..., None] * np.array([1.0, 0.86, 0.66], np.float32) * 0.55, 0, 1))
    elif t >= T_LOGO - 0.04:
        e = math.exp(-(t - T_LOGO) * 3.2)
        fr = 1 - (1 - fr) * (1 - np.clip(flash_shape * 0.6 * e + streak * 1.6 * math.exp(-(t - T_LOGO) * 1.6), 0, 1))
        fr = 1 - (1 - fr) * (1 - np.clip(glow_full * (0.25 + 0.8 * e), 0, 1))
    # a soft build of glow + flare in the half second before the hit
    pre = sm((t - (T_LOGO - 0.6)) / 0.6) if t < T_LOGO and not SMOOTH_END and not NO_HIT else 0
    if pre > 0:
        fr = 1 - (1 - fr) * (1 - np.clip(streak * 0.6 * pre, 0, 1))
    if GLINT and T_LOGO <= t < T_LOGO + 1.4:
        u = t - T_LOGO - 0.04
        sc_ = sm(u / 0.09) * math.exp(-max(0.0, u - 0.09) * 2.6)
        if sc_ > 0.01:
            fr = 1 - (1 - fr) * (1 - np.clip(star(0.35 + 0.75 * sc_, 0.25 + 0.5 * u) * sc_, 0, 1))
    if t >= B['tagline']:
        a = sm((t - B['tagline']) / 0.55); over(fr, tag, W / 2, TAG_Y, a, dy=(1 - a) * 24)
    if t >= B['url']:
        a = sm((t - B['url']) / 0.55); over(fr, url, W / 2, URL_Y, a, dy=(1 - a) * 18)
    if BIO and t >= B['url'] + 0.6:
        a = sm((t - B['url'] - 0.6) / 0.55); over(fr, bio, W / 2, BIO_Y, a, dy=(1 - a) * 18)
    vg = vign
    if FLOAT and panes[0].get('keys'):
        g0 = min(1.0, max(0.0, _key_at(panes[0]['keys'], t)['g']))
        vg = 1 - (1 - vign) * g0
    elif FLOAT and panes[0]['full']:   # the opening full-screen video gets no vignette; it comes in as the pane shrinks
        p0 = panes[0]; g0 = min(1.0, max(0.0, (t - p0['at'] - p0['full']) / p0['shrink']))
        vg = 1 - (1 - vign) * (0.5 - 0.5 * math.cos(math.pi * g0))
    return np.clip(fr * vg * fade_in, 0, 1)

if arg('--preview'):   # a few frames as PNG, no video
    for f in [int(x) for x in arg('--preview').split(',')]:
        Image.fromarray(((hook_frame(f) if f < int(round(PRE * FPS)) else frame(f - int(round(PRE * FPS)))) * 255 + 0.5).astype(np.uint8)).save(os.path.join(HERE, f'out/test/{NAME}-{f:04d}.png'))
    sys.exit(0)
pS = enc(outs['story'], 'null'); pP = None if STORY_ONLY else enc(outs['post'], f'crop={W}:1350:0:{POST_TOP}')
NPRE = int(round(PRE * FPS))
for f in range(NPRE + NF):
    buf = ((hook_frame(f) if f < NPRE else frame(f - NPRE)) * 255 + 0.5).astype(np.uint8).tobytes()
    pS.stdin.write(buf)
    if pP: pP.stdin.write(buf)
for p in [x for x in (pS, pP) if x]:
    p.stdin.close(); p.wait()
print(outs['story'] if STORY_ONLY else '\n'.join(outs.values()))
