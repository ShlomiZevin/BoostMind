# the 10-second promo (his ask, v15 build): 'שלומיוורס מציגים' -> NEW GAME + the game's title art (1 s) -> five quick
# real-game shots, a 1-3 word label on each (Terra) -> 'רק בשלומיוורס'
# shots come from recordsol.js recordings (frames-l3 = desk-stairs level, frames-l1 = bridge level), each with its sounds
#   python compose10.py  -> out/drill-promo10.mp4
import json, os, subprocess
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.join(HERE, '..', '..', '..', 'public', 'rosenblum-games', 'drill', 'assets')
SV = 'C:/workspace/studio/zoomcut/episodes/_assets/shlomiverse'
W, H, FPS = 1080, 1920, 30
# (recording, from second, to second) - one label each (lab0..lab4.png from caps.js + caps10.json)
SHOTS = [('frames-l3', 0.45, 1.3), ('frames-l3', 3.2, 4.45), ('frames-l1', 3.15, 4.05), ('frames-l1', 7.0, 7.85), ('frames-l3', 11.9, 12.75)]
TITLE_N = 27

def read_clip(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', f'fps={FPS},scale={W}:{H}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)

intro, outro = read_clip(f'{SV}/verse-presents.mp4'), read_clip(f'{SV}/verse-only.mp4')
TITLE_ART = Image.open(os.path.join(GAME, 'title.png')).convert('RGBA')
PILL = Image.open(os.path.join(HERE, 'pill.png')).convert('RGBA')
TBG = ImageEnhance.Brightness(Image.open(os.path.join(HERE, SHOTS[0][0], 'f00030.jpg')).convert('RGB').filter(ImageFilter.GaussianBlur(18))).enhance(0.55)
def title_frame(k):   # the title drops in with a bounce, 'new game' over it at once (only 1 s)
    t = k / FPS; im = TBG.copy().convert('RGBA')
    u = min(1, t / 0.22); s = (0.55 + 0.53 * u) if u < 1 else 1.08 - 0.08 * min(1, (t - 0.22) / 0.15)
    tw = int(900 * s); th = int(tw * TITLE_ART.height / TITLE_ART.width)
    im.alpha_composite(TITLE_ART.resize((tw, th), Image.LANCZOS), ((W - tw) // 2, 1000 - th // 2))
    a = min(1, max(0, (t - 0.1) / 0.15))
    if a > 0: pl = PILL.copy(); pl.putalpha(pl.getchannel('A').point(lambda v: int(v * a))); im.alpha_composite(pl, (0, int(30 * (1 - a))))
    return np.asarray(im.convert('RGB'), np.float32) / 255
labs = [np.asarray(Image.open(os.path.join(HERE, f'lab{j}.png')).convert('RGBA'), np.float32) / 255 for j in range(len(SHOTS))]

seq = [('i', k, None) for k in range(len(intro))] + [('t', k, None) for k in range(TITLE_N)]
shot_at = []
for j, (fr, a, b) in enumerate(SHOTS):
    shot_at.append(len(seq))
    seq += [('g', (fr, f), j) for f in range(round(a * FPS), round(b * FPS))]
GAME_END = len(seq)
seq += [('o', k, None) for k in range(len(outro))]
FLASH = {len(intro), len(intro) + TITLE_N, GAME_END}   # the warm white flash on the hand-overs (not between quick shots)

out = os.path.join(HERE, 'out', 'video-only10.mp4')
p = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                      '-c:v', 'libx264', '-crf', '17', '-preset', 'slow', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
for i, (kind, k, j) in enumerate(seq):
    if kind == 'i': fr = intro[k].astype(np.float32) / 255
    elif kind == 'o': fr = outro[k].astype(np.float32) / 255
    elif kind == 't': fr = title_frame(k)
    else:
        fr = np.asarray(Image.open(os.path.join(HERE, k[0], f'f{k[1]:05d}.jpg')).convert('RGB'), np.float32) / 255
        lay = labs[j]; u = min(1, (i - shot_at[j] + 1) / 3); al = lay[..., 3:4] * u
        fr = fr * (1 - al) + lay[..., :3] * al
    for c in FLASH:
        dd = abs(i - c + 0.5)
        if dd < 5: fr = fr + (1 - fr) * (np.array([1, .945, .863]) * (1 - dd / 5) * 0.85)
    p.stdin.write((np.clip(fr, 0, 1) * 255).astype(np.uint8).tobytes())
p.stdin.close(); p.wait()
DUR = len(seq) / FPS

# sound: each shot's own game sounds at their moments (variants, never the same twice in a row, a burst played once)
snd, last, prev = [], {}, {}
for j, (fr, a, b) in enumerate(SHOTS):
    off = shot_at[j] / FPS
    for t, n in json.load(open(os.path.join(HERE, fr + 'sounds.json'))):
        if not (a <= t < b) or n in ('steps', 'siren'): continue
        ot = off + t - a
        if ot - prev.get(n, -9) < 0.3: continue
        prev[n] = ot
        if not os.path.exists(f'{GAME}/sfx/{n}.mp3'):
            kk = 1
            while os.path.exists(f'{GAME}/sfx/{n}{kk + 1}.mp3'): kk += 1
            i2 = (last.get(n, 0) % kk) + 1; last[n] = i2; n = f'{n}{i2}'
        if os.path.exists(f'{GAME}/sfx/{n}.mp3'): snd.append((ot, n))
inputs = ['-i', out, '-i', f'{GAME}/music.mp3', '-i', f'{SV}/verse-presents.mp4', '-i', f'{SV}/verse-only.mp4',
          '-i', f'{SV}/source/px-kick-hit.mp3', '-i', f'{GAME}/sfx/steps.mp3']
GS, GE = shot_at[0] / FPS, GAME_END / FPS
flt = [f'[1:a]atrim=0:{DUR},volume=0.5,afade=t=out:st={DUR - 1.0}:d=1.0[m]', '[2:a]volume=0.9[ai]',
       f'[3:a]volume=0.9,adelay={int(GE * 1000)}|{int(GE * 1000)}[ao]',
       f'[4:a]volume=0.8,adelay={int(len(intro) / FPS * 1000)}|{int(len(intro) / FPS * 1000)}[th]',
       f'[5:a]atrim=0:{GE - GS},volume=0.35,afade=t=out:st={GE - GS - 0.3}:d=0.3,adelay={int(GS * 1000)}|{int(GS * 1000)}[st]']
labels = ['[m]', '[ai]', '[ao]', '[th]', '[st]']
for j, (t, n) in enumerate(snd):
    inputs += ['-i', f'{GAME}/sfx/{n}.mp3']
    ms = int(t * 1000); vol = 0.35 if n.startswith('turn') else 0.6 if n.startswith('saved') else 0.85
    flt.append(f'[{6 + j}:a]volume={vol},adelay={ms}|{ms}[s{j}]'); labels.append(f'[s{j}]')
flt.append(''.join(labels) + f'amix=inputs={len(labels)}:normalize=0,volume=1.4,alimiter=limit=0.9,atrim=0:{DUR}[a]')
final = os.path.join(HERE, 'out', 'drill-promo10.mp4')
subprocess.run(['ffmpeg', '-y', '-v', 'error', *inputs, '-filter_complex', ';'.join(flt), '-map', '0:v', '-map', '[a]',
                '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', final], check=True)
print('wrote', final, f'{DUR:.1f}s', len(snd), 'sounds')
