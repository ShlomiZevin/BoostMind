# the Instagram promo of התרופות של שמונה: 'שלומיוורס מציגים' -> NEW GAME + the title art, the kupa's voice "שלום, הגעתם
# לקופת החולים" -> the three modes zoomed on their moment (a label each, Terra) -> Savta's "נו, יפה. אבל אני בודקת." ->
# 'רק בשלומיוורס'. The game's own hold music is the bed. Shots from record.js (frames-box / frames-sort / frames-tray).
#   python compose.py  -> out/pills-promo.mp4
import json, os, subprocess
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.join(HERE, '..', '..', '..', 'public', 'lola-games', 'pills', 'assets')
SV = 'C:/workspace/studio/zoomcut/episodes/_assets/shlomiverse'
W, H, FPS = 1080, 1920, 30
# (recording, from s, to s, label index or None, centre start, centre end, zoom start, zoom end)
SHOTS = [('frames-box', 6.7, 10.0, 0, (.5, .47), (.5, .5), 1.1, 1.22),
         ('frames-sort', 8.9, 11.3, 1, (.62, .66), (.7, .68), 1.3, 1.55),
         ('frames-tray', 1.0, 4.0, 2, (.5, .6), (.5, .6), 1.04, 1.14),
         ('frames-tray', 11.6, 13.6, None, (.5, .42), (.5, .4), 1.0, 1.12)]
TITLE_N = 39

def read_clip(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', f'fps={FPS},scale={W}:{H}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)

intro, outro = read_clip(f'{SV}/verse-presents.mp4'), read_clip(f'{SV}/verse-only.mp4')
TITLE_ART = Image.open(os.path.join(GAME, 'title.png')).convert('RGBA')
PILL = Image.open(os.path.join(HERE, 'pill.png')).convert('RGBA')
TBG = ImageEnhance.Brightness(Image.open(os.path.join(HERE, 'out', 'poster-a.png')).convert('RGB').resize((W, H)).filter(ImageFilter.GaussianBlur(16))).enhance(0.6)
def title_frame(k):   # the title drops in with a bounce, 'new game' over it
    t = k / FPS; im = TBG.copy().convert('RGBA')
    u = min(1, t / 0.22); s = (0.55 + 0.53 * u) if u < 1 else 1.08 - 0.08 * min(1, (t - 0.22) / 0.15)
    tw = int(940 * s); th = int(tw * TITLE_ART.height / TITLE_ART.width)
    im.alpha_composite(TITLE_ART.resize((tw, th), Image.LANCZOS), ((W - tw) // 2, 980 - th // 2))
    a = min(1, max(0, (t - 0.1) / 0.15))
    if a > 0: pl = PILL.copy(); pl.putalpha(pl.getchannel('A').point(lambda v: int(v * a))); im.alpha_composite(pl, (0, int(30 * (1 - a))))
    return np.asarray(im.convert('RGB'), np.float32) / 255
labs = [np.asarray(Image.open(os.path.join(HERE, f'lab{j}.png')).convert('RGBA'), np.float32) / 255 for j in range(3)]

def game_frame(sh, f, u):   # the recorded frame, cropped around the shot's moment, slow push-in
    d, a, b, lab, (x0, y0), (x1, y1), z0, z1 = sh
    im = Image.open(os.path.join(HERE, d, f'f{f:05d}.jpg')).convert('RGB')
    e = u * u * (3 - 2 * u); z = z0 + (z1 - z0) * e; cw, ch = W / z, H / z
    cx = min(max((x0 + (x1 - x0) * e) * W, cw / 2), W - cw / 2); cy = min(max((y0 + (y1 - y0) * e) * H, ch / 2), H - ch / 2)
    if z > 1.01: im = im.resize((W, H), Image.LANCZOS, box=(cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2)).filter(ImageFilter.UnsharpMask(2, 50, 2))
    return np.asarray(im, np.float32) / 255

seq = [('i', k, None) for k in range(len(intro))] + [('t', k, None) for k in range(TITLE_N)]
shot_at = []
for j, sh in enumerate(SHOTS):
    shot_at.append(len(seq)); f0, f1 = round(sh[1] * FPS), round(sh[2] * FPS)
    seq += [('g', (f, (f - f0) / max(1, f1 - f0 - 1)), j) for f in range(f0, f1)]
GAME_END = len(seq)
seq += [('o', k, None) for k in range(len(outro))]
FLASH = {len(intro), len(intro) + TITLE_N, GAME_END}

out = os.path.join(HERE, 'out', 'video-only.mp4')
p = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                      '-c:v', 'libx264', '-crf', '17', '-preset', 'slow', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
for i, (kind, k, j) in enumerate(seq):
    if kind == 'i': fr = intro[k].astype(np.float32) / 255
    elif kind == 'o': fr = outro[k].astype(np.float32) / 255
    elif kind == 't': fr = title_frame(k)
    else:
        fr = game_frame(SHOTS[j], *k)
        if SHOTS[j][3] is not None:
            lay = labs[SHOTS[j][3]]; u = min(1, (i - shot_at[j] + 1) / 3); al = lay[..., 3:4] * u
            fr = fr * (1 - al) + lay[..., :3] * al
    for c in FLASH:
        dd = abs(i - c + 0.5)
        if dd < 5: fr = fr + (1 - fr) * (np.array([1, .945, .863]) * (1 - dd / 5) * 0.85)
    p.stdin.write((np.clip(fr, 0, 1) * 255).astype(np.uint8).tobytes())
p.stdin.close(); p.wait()
DUR = len(seq) / FPS

# sound: each shot's own game sounds at their moments (the logged variant), the kupa voice on the title, the hold music
def sfx_file(n, i):
    if os.path.exists(f'{GAME}/sfx/{n}.mp3'): return n
    k = 1
    while os.path.exists(f'{GAME}/sfx/{n}{k + 1}.mp3'): k += 1
    return f'{n}{i % k + 1}' if os.path.exists(f'{GAME}/sfx/{n}1.mp3') else None
snd, prev = [], {}
for j, sh in enumerate(SHOTS):
    off = shot_at[j] / FPS
    for t, n, i in json.load(open(os.path.join(HERE, sh[0] + 'sounds.json'))):
        if not (sh[1] <= t < sh[2]) or n.startswith('vo-'): continue
        ot = off + t - sh[1]
        if ot - prev.get(n, -9) < 0.12: continue
        prev[n] = ot; f = sfx_file(n, i)
        if f: snd.append((ot, f))
T0 = len(intro) / FPS
inputs = ['-i', out, '-i', f'{GAME}/sfx/hold.mp3', '-i', f'{SV}/verse-presents.mp4', '-i', f'{SV}/verse-only.mp4',
          '-i', f'{SV}/source/px-kick-hit.mp3', '-i', f'{GAME}/sfx/vo-hello.mp3']
GE = GAME_END / FPS
flt = [f'[1:a]atrim=0:{DUR - T0},volume=0.7,afade=t=in:d=0.3,afade=t=out:st={DUR - T0 - 0.8}:d=0.8,adelay={int(T0 * 1000)}|{int(T0 * 1000)}[m]',
       '[2:a]volume=0.9[ai]', f'[3:a]volume=0.9,adelay={int(GE * 1000)}|{int(GE * 1000)}[ao]',
       f'[4:a]volume=0.8,adelay={int(T0 * 1000)}|{int(T0 * 1000)}[th]',
       f'[5:a]volume=1.5,adelay={int((T0 + 0.15) * 1000)}|{int((T0 + 0.15) * 1000)}[vo]']
labels = ['[m]', '[ai]', '[ao]', '[th]', '[vo]']
for j, (t, n) in enumerate(snd):
    inputs += ['-i', f'{GAME}/sfx/{n}.mp3']
    ms = int(t * 1000); vol = 0.5 if n.startswith(('rattle', 'place', 'pop')) else 0.85
    flt.append(f'[{6 + j}:a]volume={vol},adelay={ms}|{ms}[s{j}]'); labels.append(f'[s{j}]')
flt.append(''.join(labels) + f'amix=inputs={len(labels)}:normalize=0,volume=1.3,alimiter=limit=0.9,atrim=0:{DUR}[a]')
final = os.path.join(HERE, 'out', 'pills-promo.mp4')
subprocess.run(['ffmpeg', '-y', '-v', 'error', *inputs, '-filter_complex', ';'.join(flt), '-map', '0:v', '-map', '[a]',
                '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', final], check=True)
print('wrote', final, f'{DUR:.1f}s', len(snd), 'sounds')
