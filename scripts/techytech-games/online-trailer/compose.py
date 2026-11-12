# The "online play is here" trailer for אז אנחנו מסונכרנים (Shlomi's ask, 12 Nov 2026): 'שלומיוורס מציגים' ->
# "עד היום שיחקתם לבד." -> BOOM "מהיום - אונליין. עם חברים." -> five real online clips on the beat (a label each) ->
# "תזמינו את כל הצוות לשיחה." -> Yaniv's REAL line from his verse video (ig-18391057894121616 "יניב יורד מהשיחה"):
# "למה העליתם אותי לשיחה?" -> BOOM "תזמינו חבר. (רק לא את יניב.)" -> 'רק בשלומיוורס'.
# Music = the approved Shlomiverse trailer music, FULL from frame 0, slowed (rubberband, same pitch) so its hit lands on
# "תזמינו חבר", never looped. Text = titles.js (t/*.png). Clips = CLIPS below (vid/*.webm from the online test, or stills).
#   python compose.py            -> out/online-trailer.mp4
import os, subprocess, json
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
SV = 'C:/workspace/studio/zoomcut/episodes/_assets/shlomiverse'
BOOM = 'C:/workspace/studio/zoomcut/episodes/_assets/crypto/px-boom-05.mp3'
GAME = 'C:/workspace/BoostMind-meetings/public/techytech-games/meetings'
SHOTS = 'C:/workspace/BoostMind-meetings/scripts/techytech-games/meetings/shots'
W, H, FPS = 1080, 1920, 30
P = lambda *a: os.path.join(HERE, *a)

# the gameplay clips: (label png, source, start s) - source .webm/.mp4 = a phone recording (780x1688), .png = a still
CLIPS = json.load(open(P('clips.json'), encoding='utf-8'))
SFX_AT = [0.5, 0.35, 0.8, 0.15, 0.4]   # each clip's own moment (the merge, the find, the last line, the pair, the friend joining)
CLIP_LEN = 1.4
# the timeline (seconds)
T_ALONE, T_BOOM, T_FRIENDS, T_CLIPS = 1.8, 4.6, 5.3, 6.2
T_TEAM = T_CLIPS + CLIP_LEN * len(CLIPS)
T_YANIV = T_TEAM + 0.8
Y_FROM, Y_TO = 2.62, 4.12                     # "למה העליתם אותי לשיחה?" in the source video
T_HIT = T_YANIV + (Y_TO - Y_FROM)            # "תזמינו חבר." lands with the music's hit
T_NOY = T_HIT + 0.8
T_OUT = T_HIT + 2.8
M_START, M_HIT, M_END = 2.75, 14.25, 18.5     # in music.wav: where it is full, its hit, its end

def read_clip(path, ss=0, t=None, w=W, h=H):
    a = ['ffmpeg', '-v', 'error', '-ss', str(ss), '-i', path] + (['-t', str(t)] if t else []) + \
        ['-vf', f'fps={FPS},scale={w}:{h}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']
    raw = subprocess.run(a, capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)

intro, outro = read_clip(f'{SV}/verse-presents.mp4'), read_clip(f'{SV}/verse-only.mp4')
yaniv = read_clip(P('src', 'hangup.mp4'), Y_FROM, Y_TO - Y_FROM)
ttl = {k[:-4]: np.asarray(Image.open(P('t', k)).convert('RGBA'), np.float32) / 255 for k in os.listdir(P('t'))}

def phone_frames(src, ss):   # a phone recording / still -> 1080-wide frames cropped to the game (no verse chrome)
    n = int(CLIP_LEN * FPS)
    if src.endswith('.png'):
        im = Image.open(src if os.path.isabs(src) else P(src)).convert('RGB')
        return [im] * n
    fr = read_clip(src if os.path.isabs(src) else P(src), ss, CLIP_LEN + 0.1, 780, 1688)
    return [Image.fromarray(f) for f in fr[:n]]
clips = [(lab, phone_frames(src, ss), crop) for lab, src, ss, crop in CLIPS]

def blurred(im, dark):   # a 9:16 frame from any picture: the picture whole in the middle, itself blurred around it
    b = im.resize((W, H)).filter(ImageFilter.GaussianBlur(30)); b = ImageEnhance.Brightness(b).enhance(dark)
    s = min(W / im.width, H / im.height); fg = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
    b.paste(fg, ((W - fg.width) // 2, (H - fg.height) // 2)); return b
HERO = Image.open(f'{GAME}/assets/hero.jpg').convert('RGB')
hb = HERO.resize((1536, 1920)).crop((228, 0, 1308, 1920)).filter(ImageFilter.GaussianBlur(28))
BG_HERO = ImageEnhance.Brightness(hb).enhance(0.45); BG_HERO.paste(HERO, (0, 170))
HUB = Image.open(f'{SHOTS}/hub.png').convert('RGB')
BG_ALONE = ImageEnhance.Color(ImageEnhance.Brightness(blurred(HUB, 0.5)).enhance(0.42)).enhance(0.25)

ease = lambda u: u * u * (3 - 2 * u)
def push(im, u, z0, z1, cx=.5, cy=.5):   # a slow eased push-in on a picture
    z = z0 + (z1 - z0) * ease(min(1, max(0, u))); cw, ch = W / z, H / z
    x = min(max(cx * W, cw / 2), W - cw / 2); y = min(max(cy * H, ch / 2), H - ch / 2)
    return np.asarray(im.resize((W, H), Image.BILINEAR, box=(x - cw / 2, y - ch / 2, x + cw / 2, y + ch / 2)), np.float32) / 255
def over(fr, k, t0, t, dur=0.35, rise=40):   # a title rises in softly (never pops), stays
    a = min(1, max(0, (t - t0) / dur))
    if a <= 0: return fr
    lay = ttl[k]; dy = int(rise * (1 - ease(a)))
    if dy: lay = np.concatenate([np.zeros((dy, W, 4), np.float32), lay[:-dy]])
    al = lay[..., 3:4] * ease(a); return fr * (1 - al) + lay[..., :3] * al

N = int(round((T_OUT) * FPS)) + len(outro)
FLASH = [T_ALONE, T_BOOM, T_CLIPS, T_TEAM, T_YANIV, T_HIT, T_OUT]
out = P('out', 'video-only.mp4'); os.makedirs(P('out'), exist_ok=True)
pr = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                       '-c:v', 'libx264', '-crf', '17', '-preset', 'slow', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
for i in range(N):
    t = i / FPS
    if t < T_ALONE: fr = intro[min(i, len(intro) - 1)].astype(np.float32) / 255
    elif t < T_BOOM:
        fr = push(BG_ALONE, (t - T_ALONE) / (T_BOOM - T_ALONE), 1.0, 1.12); fr = over(fr, 'alone', T_ALONE + 0.3, t, 0.6)
    elif t < T_CLIPS:
        u = (t - T_BOOM) / (T_CLIPS - T_BOOM); fr = push(BG_HERO, u, 1.18, 1.05, .5, .55) * 0.55
        fr = over(fr, 'online', T_BOOM, t, 0.12, 0)
    elif t < T_TEAM:
        j = int((t - T_CLIPS) / CLIP_LEN); lab, frs, crop = clips[j]; k = min(len(frs) - 1, int((t - T_CLIPS - j * CLIP_LEN) * FPS))
        x0, y0, x1, y1 = crop; im = frs[k].crop((x0, y0, x1, y1))
        fr = np.asarray(blurred(im, 0.45), np.float32) / 255 if im.width / im.height < W / H - .01 else np.asarray(im.resize((W, H), Image.LANCZOS), np.float32) / 255
        u = (t - T_CLIPS - j * CLIP_LEN) / CLIP_LEN; fr = push(Image.fromarray((fr * 255).astype(np.uint8)), u, 1.0, 1.06)
        fr = over(fr, lab, T_CLIPS + j * CLIP_LEN, t, 0.12, 20)
    elif t < T_YANIV:
        fr = push(BG_HERO, (t - T_TEAM) / 0.8, 1.0, 1.08) * 0.5; fr = over(fr, 'team', T_TEAM, t, 0.2)
    elif t < T_HIT:
        k = min(len(yaniv) - 1, i - int(round(T_YANIV * FPS)))   # his face only: the reel's burned-in title + subtitle cut away
        yi = Image.fromarray(yaniv[k]).resize((720, 1280)).crop((0, 385, 720, 985))
        fr = push(blurred(yi, 0.4), (t - T_YANIV) / (T_HIT - T_YANIV), 1.0, 1.08)
        fr = over(fr, 'ysub', T_YANIV, t, 0.1, 0)
    elif t < T_OUT:
        u = (t - T_HIT) / (T_OUT - T_HIT); fr = push(BG_HERO, u, 1.1, 1.0, .5, .4) * 0.6
        fr = over(fr, 'invite', T_HIT, t, 0.1, 0); fr = over(fr, 'noyaniv', T_NOY, t, 0.3)
    else: fr = outro[min(len(outro) - 1, i - int(round(T_OUT * FPS)))].astype(np.float32) / 255
    for c in FLASH:
        d = abs(t - c) * FPS
        if d < 4: fr = fr + (1 - fr) * (np.array([1, .945, .863]) * (1 - d / 4) * 0.8)
    pr.stdin.write((np.clip(fr, 0, 1) * 255).astype(np.uint8).tobytes())
pr.stdin.close(); pr.wait()
DUR = N / FPS

# sound: the music full from frame 0, slowed so its hit lands on T_HIT, then its own tail; the intro's blink is in the
# intro clip; a deep hit on the first boom, the produced cinematic boom on "תזמינו חבר", Yaniv's own voice, the outro's whoosh
tempo = (M_HIT - M_START) / T_HIT
music = P('out', 'music.wav')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', P('src', 'music.wav'), '-filter_complex',
                f'[0:a]atrim={M_START}:{M_HIT},asetpts=PTS-STARTPTS,rubberband=tempo={tempo:.4f}[a];[0:a]atrim={M_HIT}:{M_END},asetpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=0:a=1[m]',
                '-map', '[m]', music], check=True)
ms = lambda s: int(s * 1000)
inputs = ['-i', out, '-i', music, '-i', f'{SV}/verse-presents.mp4', '-i', f'{SV}/verse-only.mp4', '-i', f'{SV}/source/px-kick-hit.mp3',
          '-i', BOOM, '-i', P('src', 'hangup.mp4'), '-i', f'{GAME}/assets/sfx/join-1.mp3']
sw = [f'{GAME}/assets/sfx/{s}' for s in ('big-1.mp3', 'found-1.mp3', 'line-2.mp3', 'pair-1.mp3', 'join-2.mp3')]
for s in sw: inputs += ['-i', s]
flt = [f'[1:a]volume=0.8[m]', '[2:a]volume=0.9[ai]', f'[3:a]volume=0.9,adelay={ms(T_OUT)}|{ms(T_OUT)}[ao]',
       f'[4:a]volume=1.0,adelay={ms(T_BOOM)}|{ms(T_BOOM)}[b1]', f'[5:a]volume=1.0,adelay={ms(T_HIT)}|{ms(T_HIT)}[b2]',
       f'[6:a]atrim={Y_FROM}:{Y_TO},asetpts=PTS-STARTPTS,volume=1.6,adelay={ms(T_YANIV)}|{ms(T_YANIV)}[y]',
       f'[7:a]volume=0.7,adelay={ms(T_TEAM + 0.1)}|{ms(T_TEAM + 0.1)}[jn]']
labs = ['[m]', '[ai]', '[ao]', '[b1]', '[b2]', '[y]', '[jn]']
for j in range(min(len(sw), len(CLIPS))):
    d = ms(T_CLIPS + j * CLIP_LEN + SFX_AT[j]); flt.append(f'[{8 + j}:a]volume=0.6,adelay={d}|{d}[g{j}]'); labs.append(f'[g{j}]')
flt.append(''.join(labs) + f'amix=inputs={len(labs)}:normalize=0,alimiter=limit=0.92,atrim=0:{DUR}[a]')
final = P('out', 'online-trailer.mp4')
subprocess.run(['ffmpeg', '-y', '-v', 'error', *inputs, '-filter_complex', ';'.join(flt), '-map', '0:v', '-map', '[a]',
                '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', final], check=True)
print('wrote', final, f'{DUR:.1f}s', f'tempo {tempo:.3f}', f'hit at {T_HIT:.2f}s')
