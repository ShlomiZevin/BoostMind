# The trailer of אז אנחנו מסונכרנים (Shlomi's asks, 12 Nov 2026 - final):
#   HOOK: Yaniv's newest, angriest take (verse video security-1, "סיקיוריטי שבור", 24 Oct 2026):
#         "אני גם בכלל לא מבין למה אתה מעלה אותי לשיחה! מה זה קשור אליי?" (his face, the reel's burned-in words cut away)
#   -> 'שלומיוורס מציגים' (the music hits in full here) -> "בטקי-טק יש דבר אחד שלא נגמר." -> BOOM "פגישות בזום."
#   -> the four apps + the invite, real play on a PHONE in the middle (not full screen), a label each
#   -> "תזמינו את כל הצוות לשיחה." -> Yaniv again, mostly HEARD: "בגלל הזומים שלך אני נראה ככה." (a glimpse of him,
#      then his voice over the game) -> the music's hit: "תזמינו חבר. (רק לא את יניב.)" -> 'רק בשלומיוורס'.
# Music = the approved Shlomiverse trailer music, full from the logo, slowed (rubberband, same pitch) so its hit lands on
# "תזמינו חבר", never looped. Text = titles.js (t/*.png). Clips = clips.json (vid/*.mp4: real matches, 780x1688).
#   python compose.py            -> out/meetings-trailer.mp4
import os, subprocess, json
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
SV = 'C:/workspace/studio/zoomcut/episodes/_assets/shlomiverse'
BOOM = 'C:/workspace/studio/zoomcut/episodes/_assets/crypto/px-boom-05.mp3'
GAME = 'C:/workspace/BoostMind-meetings/public/techytech-games/meetings'
SHOTS = 'C:/workspace/BoostMind-meetings/scripts/techytech-games/meetings/shots'
W, H, FPS = 1080, 1920, 30
P = lambda *a: os.path.join(HERE, *a)
YV = P('src', 'security-1.mp4')
Y1 = (110.56, 111.95)                # only "למה אתה מעלה אותי לשיחה" - from its first sound to its end (his note)
Y1_SPLIT = 111.92                    # where "מה זה קשור אליי?" starts
Y2 = (116.62, 119.28)                # "בגלל הזומים שלך אני נראה ככה."
Y2_SHOW = 0.8                        # seconds of his face before only his voice

CLIPS = json.load(open(P('clips.json'), encoding='utf-8'))
SFX_AT = [0.5, 0.35, 0.8, 0.15, 0.4]   # each clip's own moment (the merge, the find, the last line, the pair, the friend joining)
CLIP_LEN = 1.3
T_INTRO = 0.0
T_PRES = 1.8                         # "טקי-טק מציגה - משחק אונליין חדש" + the 4 app icons: what this is, before anything
T_ALONE = T_PRES + 2.0
T_BOOM = T_ALONE + 2.0
T_FOUR = T_BOOM + 0.8                # "אז הפכנו אותן ל־4 משחקים."
T_CLIPS = T_BOOM + 2.1
T_TEAM = T_CLIPS + CLIP_LEN * len(CLIPS)
T_HIT = T_TEAM + 0.9                 # "תזמינו חבר." with the music's hit
T_YANIV = T_HIT + 2.0                # just before the music ends: Yaniv, heard (echo), his picture faint
T_NOY = T_YANIV + (Y1[1] - Y1[0]) + 0.45
T_OUT = T_NOY + 1.7
M_START, M_HIT, M_END = 2.75, 14.25, 18.5     # in music.wav: where it is full, its hit, its end

def read_clip(path, ss=0, t=None, w=W, h=H):
    a = ['ffmpeg', '-v', 'error', '-ss', str(ss), '-i', path] + (['-t', str(t)] if t else []) + \
        ['-vf', f'fps={FPS},scale={w}:{h}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']
    raw = subprocess.run(a, capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)

intro, outro = read_clip(f'{SV}/verse-presents.mp4'), read_clip(f'{SV}/verse-only.mp4')
yan1 = read_clip(YV, Y1[0], Y1[1] - Y1[0], 720, 1280)
ttl = {k[:-4]: np.asarray(Image.open(P('t', k)).convert('RGBA'), np.float32) / 255 for k in os.listdir(P('t'))}
clips = [(lab, [Image.fromarray(f) for f in read_clip(P(src), ss, CLIP_LEN + 0.1, 780, 1688)[:int(CLIP_LEN * FPS)]]) for lab, src, ss, _ in CLIPS]

def blurred(im, dark):   # a 9:16 frame from any picture: the picture whole in the middle, itself blurred around it
    b = im.resize((W, H)).filter(ImageFilter.GaussianBlur(30)); b = ImageEnhance.Brightness(b).enhance(dark)
    s = min(W / im.width, H / im.height); fg = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
    b.paste(fg, ((W - fg.width) // 2, (H - fg.height) // 2)); return b
yface = lambda a: Image.fromarray(a).crop((0, 285, 720, 870))   # his face + shoulders, no burned-in title / subtitle
HERO = Image.open(f'{GAME}/assets/hero.jpg').convert('RGB')
hb = HERO.resize((1536, 1920)).crop((228, 0, 1308, 1920)).filter(ImageFilter.GaussianBlur(28))
BG_HERO = ImageEnhance.Brightness(hb).enhance(0.45); BG_HERO.paste(HERO, (0, 170))
BG_SOFT = ImageEnhance.Brightness(hb).enhance(0.55)          # behind the phone: the cast, blurred
BG_DARK = ImageEnhance.Brightness(hb).enhance(0.3)
def framed_poster():   # the game's poster SMALL with a clear frame (his note: not full width), on the blurred cast
    pw = 700; ph = int(pw * HERO.height / HERO.width); b = 14
    card = Image.new('RGBA', (pw + 2 * b, ph + 2 * b), (0, 0, 0, 0)); ImageDraw.Draw(card).rounded_rectangle((0, 0, pw + 2 * b - 1, ph + 2 * b - 1), 46, fill=(255, 255, 255, 255))
    m = Image.new('L', (pw, ph), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, pw - 1, ph - 1), 34, fill=255); card.paste(HERO.resize((pw, ph), Image.LANCZOS), (b, b), m)
    bg = ImageEnhance.Brightness(hb).enhance(0.4).convert('RGBA'); x, y = (W - card.width) // 2, 200
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle((x + 8, y + 26, x + card.width + 8, y + card.height + 26), 46, fill=(0, 0, 0, 180))
    bg.alpha_composite(sh.filter(ImageFilter.GaussianBlur(26))); bg.alpha_composite(card, (x, y)); return bg.convert('RGB')
POSTER = framed_poster()
HUB = Image.open(f'{SHOTS}/hub.png').convert('RGB')
BG_ALONE = ImageEnhance.Color(ImageEnhance.Brightness(blurred(HUB, 0.5).filter(ImageFilter.GaussianBlur(6))).enhance(0.26)).enhance(0.25)

# the phone the game plays on: a dark body with rounded corners and a soft shadow, the screen 640 wide
SW, SH, BZ, R = 600, 1252, 18, 74
PW, PH = SW + 2 * BZ, SH + 2 * BZ
PX, PY = (W - PW) // 2, 380
body = Image.new('RGBA', (PW, PH), (0, 0, 0, 0)); ImageDraw.Draw(body).rounded_rectangle((0, 0, PW - 1, PH - 1), R, fill=(18, 18, 24, 255), outline=(70, 70, 82, 255), width=3)
smask = Image.new('L', (SW, SH), 0); ImageDraw.Draw(smask).rounded_rectangle((0, 0, SW - 1, SH - 1), R - BZ, fill=255)
shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(shadow).rounded_rectangle((PX + 10, PY + 30, PX + PW + 10, PY + PH + 30), R, fill=(0, 0, 0, 170))
shadow = shadow.filter(ImageFilter.GaussianBlur(28))
def on_phone(frame, bgimg, u):
    bg = push(bgimg, u, 1.0, 1.06, as_img=True).convert('RGBA'); bg.alpha_composite(shadow)
    ph = body.copy(); scr = frame.crop((0, 60, 780, 1688)).resize((SW, SH), Image.LANCZOS)   # the verse's top pill cut away
    ph.paste(scr, (BZ, BZ), smask)
    s = 1.0 + 0.02 * ease(u); pw, phh = int(PW * s), int(PH * s); ph = ph.resize((pw, phh), Image.LANCZOS)
    bg.alpha_composite(ph, (PX - (pw - PW) // 2, PY - (phh - PH) // 2)); return np.asarray(bg.convert('RGB'), np.float32) / 255

ease = lambda u: u * u * (3 - 2 * u)
def push(im, u, z0, z1, cx=.5, cy=.5, as_img=False):   # a slow eased push-in on a picture
    z = z0 + (z1 - z0) * ease(min(1, max(0, u))); cw, ch = W / z, H / z
    x = min(max(cx * W, cw / 2), W - cw / 2); y = min(max(cy * H, ch / 2), H - ch / 2)
    r = im.resize((W, H), Image.BILINEAR, box=(x - cw / 2, y - ch / 2, x + cw / 2, y + ch / 2))
    return r if as_img else np.asarray(r, np.float32) / 255
BBOX = {}
def over(fr, k, t0, t, dur=0.35, rise=40, t1=None):   # a title grows in softly from 86% (never pops); t1 = it leaves there
    a = min(1, max(0, (t - t0) / dur))
    if t1 is not None: a = min(a, max(0, 1 - (t - t1) / 0.12))
    if a <= 0: return fr
    lay = ttl[k]; e = ease(a)
    if e < 1:
        if k not in BBOX: ys, xs = np.where(lay[..., 3] > 0.01); BBOX[k] = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
        x0, y0, x1, y1 = BBOX[k]; sc = 0.86 + 0.14 * e; dy = int(rise * (1 - e))
        im = Image.fromarray((lay[y0:y1, x0:x1] * 255).astype(np.uint8), 'RGBA')
        nw, nh = max(1, int((x1 - x0) * sc)), max(1, int((y1 - y0) * sc)); im = im.resize((nw, nh), Image.BILINEAR)
        L = Image.new('RGBA', (W, H)); L.paste(im, ((x0 + x1 - nw) // 2, (y0 + y1 - nh) // 2 + dy)); lay = np.asarray(L, np.float32) / 255
    al = lay[..., 3:4] * e; return fr * (1 - al) + lay[..., :3] * al

N = int(round(T_OUT * FPS)) + len(outro)
FLASH = [T_PRES, T_BOOM, T_CLIPS, T_TEAM, T_HIT, T_OUT]
out = P('out', 'video-only.mp4'); os.makedirs(P('out'), exist_ok=True)
pr = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                       '-c:v', 'libx264', '-crf', '17', '-preset', 'slow', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
for i in range(N):
    t = i / FPS
    if t < T_PRES: fr = intro[min(i, len(intro) - 1)].astype(np.float32) / 255
    elif t < T_ALONE:   # what this is: Techy-Tech presents an online game (text only, the app icons)
        fr = push(BG_DARK, (t - T_PRES) / 2, 1.0, 1.06); fr = over(fr, 'present', T_PRES + 0.1, t, 0.35)
    elif t < T_BOOM:
        fr = push(BG_DARK, (t - T_ALONE) / 2, 1.06, 1.12); fr = over(fr, 'alone', T_ALONE + 0.15, t, 0.5)
    elif t < T_CLIPS:
        fr = push(BG_DARK, (t - T_BOOM) / (T_CLIPS - T_BOOM), 1.12, 1.18); fr = over(fr, 'online', T_BOOM, t, 0.12, 0); fr = over(fr, 'four', T_FOUR, t, 0.3)
    elif t < T_TEAM:
        j = int((t - T_CLIPS) / CLIP_LEN); lab, frs = clips[j]; u = (t - T_CLIPS - j * CLIP_LEN) / CLIP_LEN
        fr = on_phone(frs[min(len(frs) - 1, int(u * CLIP_LEN * FPS))], BG_SOFT, (t - T_CLIPS) / (T_TEAM - T_CLIPS))
        fr = over(fr, lab, T_CLIPS + j * CLIP_LEN, t, 0.12, 20)
    elif t < T_HIT:
        fr = push(POSTER, (t - T_TEAM) / (T_HIT - T_TEAM), 1.0, 1.03); fr = over(fr, 'team', T_TEAM, t, 0.2)
    elif t < T_OUT:   # the hit, the music dies away, then Yaniv in the silence - heard, his picture faint over it
        fr = push(POSTER, (t - T_HIT) / (T_OUT - T_HIT), 1.03, 1.0)
        ty = t - T_YANIV; yl = Y1[1] - Y1[0]
        if 0 <= ty < yl + 0.25:
            k = min(len(yan1) - 1, int(ty * FPS)); g = min(1, ty / 0.25, max(0, (yl + 0.25 - ty) / 0.25)) * 0.38
            fr = fr * (1 - g) + push(blurred(yface(yan1[k]), 0.4), ty / yl, 1.05, 1.12, .5, .45) * g
        fr = over(fr, 'invite', T_HIT, t, 0.1, 0)
        if 0 <= ty < yl + 0.3: fr = over(fr, 'ysub', T_YANIV, t, 0.08, 0, T_YANIV + yl + 0.25)
        fr = over(fr, 'noyaniv', T_NOY, t, 0.3)
    else: fr = outro[min(len(outro) - 1, i - int(round(T_OUT * FPS)))].astype(np.float32) / 255
    for c in FLASH:
        d = abs(t - c) * FPS
        if d < 4: fr = fr + (1 - fr) * (np.array([1, .945, .863]) * (1 - d / 4) * 0.8)
    pr.stdin.write((np.clip(fr, 0, 1) * 255).astype(np.uint8).tobytes())
pr.stdin.close(); pr.wait()
DUR = N / FPS

# sound: the music JUST STARTS in full on the logo (with the intro's own blink + a deep hit), slowed
# so its hit lands on "תזמינו חבר", then its own tail; a deep hit on "פגישות בזום", each clip's own game sound, the join
# chime, the produced cinematic boom on the hit, Yaniv alone in the silence after it, the outro's whoosh
tempo = (M_HIT - M_START) / (T_HIT - T_INTRO)
music = P('out', 'music.wav')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', P('src', 'music.wav'), '-filter_complex',
                f'[0:a]atrim={M_START}:{M_HIT},asetpts=PTS-STARTPTS,rubberband=tempo={tempo:.4f}[a];[0:a]atrim={M_HIT}:{M_END},asetpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=0:a=1[m]',
                '-map', '[m]', music], check=True)
ms = lambda s: int(s * 1000)
dl = lambda s: f'adelay={ms(s)}|{ms(s)}'
inputs = ['-i', out, '-i', music, '-i', f'{SV}/verse-presents.mp4', '-i', f'{SV}/verse-only.mp4', '-i', f'{SV}/source/px-kick-hit.mp3',
          '-i', BOOM, '-i', YV, '-i', f'{GAME}/assets/sfx/join-1.mp3']
sw = [f'{GAME}/assets/sfx/{s}' for s in ('big-1.mp3', 'found-1.mp3', 'line-2.mp3', 'pair-1.mp3', 'join-2.mp3')]
for s in sw: inputs += ['-i', s]
flt = [f'[1:a]volume=0.8,{dl(T_INTRO)}[m]', f'[2:a]volume=0.9,{dl(T_INTRO)}[ai]', f'[3:a]volume=0.9,{dl(T_OUT)}[ao]',
       f'[4:a]volume=1.0,{dl(T_BOOM)}[b1]', f'[5:a]volume=1.0,{dl(T_HIT)}[b2]',
       f'[6:a]asplit=2[ya][yb]', f'[ya]atrim={Y1[0]}:{Y1[1]},asetpts=PTS-STARTPTS,afade=t=in:d=0.03,afade=t=out:st={Y1[1]-Y1[0]-0.05}:d=0.05,apad=pad_dur=1,aecho=0.85:0.75:140|280:0.32|0.16,volume=1.7,{dl(T_YANIV)}[y1]',
       f'[yb]anullsink',
       f'[7:a]volume=0.7,{dl(T_TEAM + 0.1)}[jn]']
labs = ['[m]', '[ai]', '[ao]', '[b1]', '[b2]', '[y1]', '[jn]']
for j in range(min(len(sw), len(CLIPS))):
    flt.append(f'[{8 + j}:a]volume=0.6,{dl(T_CLIPS + j * CLIP_LEN + SFX_AT[j])}[g{j}]'); labs.append(f'[g{j}]')
flt.append(''.join(labs) + f'amix=inputs={len(labs)}:normalize=0,alimiter=limit=0.92,atrim=0:{DUR}[a]')
final = P('out', 'meetings-trailer.mp4')
subprocess.run(['ffmpeg', '-y', '-v', 'error', *inputs, '-filter_complex', ';'.join(flt), '-map', '0:v', '-map', '[a]',
                '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', final], check=True)
print('wrote', final, f'{DUR:.1f}s', f'tempo {tempo:.3f}', f'hit at {T_HIT:.2f}s')
