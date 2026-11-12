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
Y1 = (109.85, 112.45)                # "אני גם בכלל לא מבין למה אתה מעלה אותי לשיחה! מה זה קשור אליי?"
Y1_SPLIT = 111.92                    # where "מה זה קשור אליי?" starts
Y2 = (116.62, 119.28)                # "בגלל הזומים שלך אני נראה ככה."
Y2_SHOW = 0.8                        # seconds of his face before only his voice

CLIPS = json.load(open(P('clips.json'), encoding='utf-8'))
SFX_AT = [0.5, 0.35, 0.8, 0.15, 0.4]   # each clip's own moment (the merge, the find, the last line, the pair, the friend joining)
CLIP_LEN = 1.3
T_INTRO = Y1[1] - Y1[0]
T_ALONE = T_INTRO + 1.8
T_BOOM = T_ALONE + 2.4
T_CLIPS = T_BOOM + 1.3
T_TEAM = T_CLIPS + CLIP_LEN * len(CLIPS)
T_YANIV = T_TEAM + 0.8
T_HIT = T_YANIV + (Y2[1] - Y2[0])
T_NOY = T_HIT + 0.8
T_OUT = T_HIT + 2.8
M_START, M_HIT, M_END = 2.75, 14.25, 18.5     # in music.wav: where it is full, its hit, its end

def read_clip(path, ss=0, t=None, w=W, h=H):
    a = ['ffmpeg', '-v', 'error', '-ss', str(ss), '-i', path] + (['-t', str(t)] if t else []) + \
        ['-vf', f'fps={FPS},scale={w}:{h}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']
    raw = subprocess.run(a, capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)

intro, outro = read_clip(f'{SV}/verse-presents.mp4'), read_clip(f'{SV}/verse-only.mp4')
yan1 = read_clip(YV, Y1[0], Y1[1] - Y1[0], 720, 1280)
yan2 = read_clip(YV, Y2[0], Y2_SHOW + 0.1, 720, 1280)
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
HUB = Image.open(f'{SHOTS}/hub.png').convert('RGB')
BG_ALONE = ImageEnhance.Color(ImageEnhance.Brightness(blurred(HUB, 0.5).filter(ImageFilter.GaussianBlur(6))).enhance(0.26)).enhance(0.25)

# the phone the game plays on: a dark body with rounded corners and a soft shadow, the screen 640 wide
SW, SH, BZ, R = 640, 1336, 18, 78
PW, PH = SW + 2 * BZ, SH + 2 * BZ
PX, PY = (W - PW) // 2, 300
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
def over(fr, k, t0, t, dur=0.35, rise=40, t1=None):   # a title rises in softly (never pops); t1 = it leaves there
    a = min(1, max(0, (t - t0) / dur))
    if t1 is not None: a = min(a, max(0, 1 - (t - t1) / 0.12))
    if a <= 0: return fr
    lay = ttl[k]; dy = int(rise * (1 - ease(a)))
    if dy: lay = np.concatenate([np.zeros((dy, W, 4), np.float32), lay[:-dy]])
    al = lay[..., 3:4] * ease(a); return fr * (1 - al) + lay[..., :3] * al

N = int(round(T_OUT * FPS)) + len(outro)
FLASH = [T_INTRO, T_ALONE, T_BOOM, T_CLIPS, T_TEAM, T_YANIV, T_HIT, T_OUT]
out = P('out', 'video-only.mp4'); os.makedirs(P('out'), exist_ok=True)
pr = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                       '-c:v', 'libx264', '-crf', '17', '-preset', 'slow', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
for i in range(N):
    t = i / FPS
    if t < T_INTRO:   # the hook: Yaniv, angry, close
        fr = push(blurred(yface(yan1[min(i, len(yan1) - 1)]), 0.4), t / T_INTRO, 1.05, 1.2, .5, .45)
        sp = Y1_SPLIT - Y1[0]; fr = over(fr, 'ysub', 0, t, 0.08, 0, sp); fr = over(fr, 'ysub2', sp, t, 0.08, 0)
    elif t < T_ALONE: fr = intro[min(i - int(round(T_INTRO * FPS)), len(intro) - 1)].astype(np.float32) / 255
    elif t < T_BOOM:
        fr = push(BG_ALONE, (t - T_ALONE) / (T_BOOM - T_ALONE), 1.0, 1.12); fr = over(fr, 'alone', T_ALONE + 0.25, t, 0.6)
    elif t < T_CLIPS:
        fr = push(BG_HERO, (t - T_BOOM) / (T_CLIPS - T_BOOM), 1.18, 1.05, .5, .55) * 0.5; fr = over(fr, 'online', T_BOOM, t, 0.12, 0)
    elif t < T_TEAM:
        j = int((t - T_CLIPS) / CLIP_LEN); lab, frs = clips[j]; u = (t - T_CLIPS - j * CLIP_LEN) / CLIP_LEN
        fr = on_phone(frs[min(len(frs) - 1, int(u * CLIP_LEN * FPS))], BG_SOFT, (t - T_CLIPS) / (T_TEAM - T_CLIPS))
        fr = over(fr, lab, T_CLIPS + j * CLIP_LEN, t, 0.12, 20)
    elif t < T_YANIV:
        fr = push(BG_HERO, (t - T_TEAM) / 0.8, 1.0, 1.08) * 0.5; fr = over(fr, 'team', T_TEAM, t, 0.2)
    elif t < T_HIT:   # Yaniv mostly heard: a glimpse of him, then his voice over the call grid
        k = i - int(round(T_YANIV * FPS))
        if t - T_YANIV < Y2_SHOW: fr = push(blurred(yface(yan2[min(k, len(yan2) - 1)]), 0.4), (t - T_YANIV) / Y2_SHOW, 1.1, 1.18, .5, .45)
        else: fr = push(BG_HERO, (t - T_YANIV) / (T_HIT - T_YANIV), 1.25, 1.12, .5, .55) * 0.55
        fr = over(fr, 'ysub3', T_YANIV, t, 0.08, 0)
    elif t < T_OUT:
        fr = push(BG_HERO, (t - T_HIT) / (T_OUT - T_HIT), 1.1, 1.0, .5, .4) * 0.55
        fr = over(fr, 'invite', T_HIT, t, 0.1, 0); fr = over(fr, 'noyaniv', T_NOY, t, 0.3)
    else: fr = outro[min(len(outro) - 1, i - int(round(T_OUT * FPS)))].astype(np.float32) / 255
    for c in FLASH:
        d = abs(t - c) * FPS
        if d < 4: fr = fr + (1 - fr) * (np.array([1, .945, .863]) * (1 - d / 4) * 0.8)
    pr.stdin.write((np.clip(fr, 0, 1) * 255).astype(np.uint8).tobytes())
pr.stdin.close(); pr.wait()
DUR = N / FPS

# sound: Yaniv dry on the hook; the music JUST STARTS in full on the logo (with the intro's own blink + a deep hit), slowed
# so its hit lands on "תזמינו חבר", then its own tail; a deep hit on "פגישות בזום", each clip's own game sound, the join
# chime, Yaniv's second line over the music, the produced cinematic boom on the hit, the outro's whoosh
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
       f'[6:a]asplit=2[ya][yb]', f'[ya]atrim={Y1[0]}:{Y1[1]},asetpts=PTS-STARTPTS,volume=1.5[y1]',
       f'[yb]atrim={Y2[0]}:{Y2[1]},asetpts=PTS-STARTPTS,volume=1.7,{dl(T_YANIV)}[y2]',
       f'[7:a]volume=0.7,{dl(T_TEAM + 0.1)}[jn]']
labs = ['[m]', '[ai]', '[ao]', '[b1]', '[b2]', '[y1]', '[y2]', '[jn]']
for j in range(min(len(sw), len(CLIPS))):
    flt.append(f'[{8 + j}:a]volume=0.6,{dl(T_CLIPS + j * CLIP_LEN + SFX_AT[j])}[g{j}]'); labs.append(f'[g{j}]')
flt.append(''.join(labs) + f'amix=inputs={len(labs)}:normalize=0,alimiter=limit=0.92,atrim=0:{DUR}[a]')
final = P('out', 'meetings-trailer.mp4')
subprocess.run(['ffmpeg', '-y', '-v', 'error', *inputs, '-filter_complex', ';'.join(flt), '-map', '0:v', '-map', '[a]',
                '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', final], check=True)
print('wrote', final, f'{DUR:.1f}s', f'tempo {tempo:.3f}', f'hit at {T_HIT:.2f}s')
