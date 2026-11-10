# the Rosenblum game promo (copied from the Osnat one): 'שלומיוורס מציגים' -> NEW GAME + the game's title art -> one clear
# round (siren, an order on a pair, Shahar in last) with a caption per action -> the story picture as the end card -> outro
# frames from record.js (frames/), sounds from sounds.json mixed back at their real moments, the game's music from frame 0
#   python compose.py  -> out/drill-promo.mp4
import json, os, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.join(HERE, '..', '..', '..', 'public', 'rosenblum-games', 'drill', 'assets')
SV = 'C:/workspace/studio/zoomcut/episodes/_assets/shlomiverse'
FONT = 'C:/workspace/sv-intro-natural/fonts/Heebo-VariableFont_wght.ttf'
W, H, FPS = 1080, 1920, 30
FR = os.environ.get('FRAMES', 'frames')
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)

# the cut: (source first frame, source last frame) of the recording
SEGS = [(15, 355), (440, 560)] if FR == 'frames3' else [(15, 285), (385, 505)] if FR == 'frames2' else [(12, 185), (590, 715)]   # round 2: siren + מדרגות! on the first pair + the desk-stairs + the class going down | the last in, Shahar last, the win card (round 1 = frames)
CAPS = [  # (output-second from, to, text) - one caption per action (his ask: show taking, giving, releasing)
    (3.45, 5.0, '1. אזעקה. יוצאים בזוגות') if FR == 'frames3' else (3.45, 5.2, '1. אזעקה. יוצאים בזוגות') if FR == 'frames2' else (3.45, 5.95, '1. אזעקה. יוצאים בזוגות'),
    (5.05, 14.85, '2. תנו פקודה, הקישו על זוג') if FR == 'frames3' else (5.25, 12.3, '2. תנו פקודה, הקישו על זוג') if FR == 'frames2' else (6.0, 9.15, '2. תנו פקודה, הקישו על זוג'),
    (15.0, 17.7, '3. שחר נכנס אחרון') if FR == 'frames3' else (12.45, 15.0, '3. שחר נכנס אחרון') if FR == 'frames2' else (9.25, 12.4, '3. שחר נכנס אחרון'),
]

def font(sz, wt=900):
    f = ImageFont.truetype(FONT, sz)
    try: f.set_variation_by_axes([wt])
    except Exception: pass
    return f

def caption_layer(text):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    f = font(76)
    tw = d.textlength(text, font=f, direction='rtl', language='he') if hasattr(d, 'textlength') else 600
    x0, x1, y0, y1 = 30, W - 30, 152, 302
    d.rounded_rectangle((x0 + 6, y0 + 10, x1 + 6, y1 + 10), 44, fill=(10, 16, 34, 120))
    d.rounded_rectangle((x0, y0, x1, y1), 44, fill=(27, 42, 74, 255), outline=(255, 255, 255, 255), width=6)
    d.text((W / 2, (y0 + y1) / 2 + 4), text, font=f, fill=(255, 210, 63, 255), anchor='mm', direction='rtl', language='he')
    return np.asarray(im, np.float32) / 255

def read_clip(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', f'fps={FPS},scale={W}:{H}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)

intro, outro = read_clip(f'{SV}/verse-presents.mp4'), read_clip(f'{SV}/verse-only.mp4')
TITLE_N, END_N = 48, 66
TITLE_ART = Image.open(os.path.join(GAME, 'title.png')).convert('RGBA')
PILL = Image.open(os.path.join(HERE, 'pill.png')).convert('RGBA')
END = Image.open(os.path.join(HERE, 'out', 'drill-story.jpg')).convert('RGB').resize((W, H))
from PIL import ImageFilter, ImageEnhance
TBG = ImageEnhance.Brightness(Image.open(os.path.join(HERE, FR, f'f{SEGS[0][0]:05d}.jpg')).convert('RGB').filter(ImageFilter.GaussianBlur(18))).enhance(0.55)
def title_frame(k):   # the title drops in with a bounce, 'new game' over it a beat later
    t = k / FPS; im = TBG.copy().convert('RGBA')
    u = min(1, t / 0.32); s = (0.55 + 0.53 * u) if u < 1 else 1.08 - 0.08 * min(1, (t - 0.32) / 0.18)
    s *= 1 + 0.02 * t
    tw = int(900 * s); th = int(tw * TITLE_ART.height / TITLE_ART.width)
    ti = TITLE_ART.resize((tw, th), Image.LANCZOS); im.alpha_composite(ti, ((W - tw) // 2, 1000 - th // 2))
    a = min(1, max(0, (t - 0.25) / 0.2))
    if a > 0: pl = PILL.copy(); pl.putalpha(pl.getchannel('A').point(lambda v: int(v * a))); im.alpha_composite(pl, (0, int(30 * (1 - a))))
    return np.asarray(im.convert('RGB'), np.float32) / 255
def end_frame(k):     # the Instagram story picture, a slow push in
    s = 1 + 0.035 * k / END_N; w, h = int(W * s), int(H * s)
    return np.asarray(END.resize((w, h), Image.LANCZOS).crop(((w - W) // 2, (h - H) // 2, (w - W) // 2 + W, (h - H) // 2 + H)), np.float32) / 255
seq = [('i', k) for k in range(len(intro))] + [('t', k) for k in range(TITLE_N)]
for a, b in SEGS: seq += [('g', k) for k in range(a, b + 1)]
seq += [('e', k) for k in range(END_N)]
GAME_END = len(seq)
seq += [('o', k) for k in range(len(outro))]
caps = [(int(a * FPS), int(b * FPS), np.asarray(Image.open(os.path.join(HERE, f'cap{j}.png')).convert('RGBA'), np.float32) / 255) for j, (a, b, t) in enumerate(CAPS)]   # caps.js draws them
CUTS = {len(intro), len(intro) + TITLE_N, GAME_END - END_N, GAME_END}

out = os.path.join(HERE, 'out', 'video-only.mp4')
p = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                      '-c:v', 'libx264', '-crf', '17', '-preset', 'slow', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
for i, (kind, k) in enumerate(seq):
    if kind == 'i': fr = intro[k].astype(np.float32) / 255
    elif kind == 'o': fr = outro[k].astype(np.float32) / 255
    elif kind == 't': fr = title_frame(k)
    elif kind == 'e': fr = end_frame(k)
    else: fr = np.asarray(Image.open(os.path.join(HERE, FR, f'f{k:05d}.jpg')).convert('RGB'), np.float32) / 255
    for a, b, lay in caps:
        if a <= i < b:
            u = min(1, (i - a) / 4, (b - i) / 4); al = lay[..., 3:4] * u
            fr = fr * (1 - al) + lay[..., :3] * al
    # the warm white flash on every hand-over (his rule: the logo fades into light and the next shot appears through it)
    for c in CUTS:
        dd = abs(i - c + 0.5)
        if dd < 5: fr = fr + (1 - fr) * (np.array([1, .945, .863]) * (1 - dd / 5) * 0.85)
    p.stdin.write((np.clip(fr, 0, 1) * 255).astype(np.uint8).tobytes())
p.stdin.close(); p.wait()
DUR = len(seq) / FPS

# sound: each game sound at its moment in the cut
def src_to_out(t):
    f = round(t * FPS); off = len(intro) + TITLE_N
    for a, b in SEGS:
        if a <= f <= b: return (off + f - a) / FPS
        off += b - a + 1
    return None
snd = [(src_to_out(t), n) for t, n in json.load(open(os.path.join(HERE, FR + 'sounds.json')))]
snd = [(t, n) for t, n in snd if t is not None]
# the game picks one of a few variants (stop1/stop2...) - here too, never the same one twice in a row; a sound repeated
# within 0.3 s (a crowd turning at a blocker) is played once
VAR = {}; last = {}; prev = {}; snd2 = []
for t, n in snd:
    if t - prev.get(n, -9) < 0.3: continue
    prev[n] = t
    if not os.path.exists(f'{GAME}/sfx/{n}.mp3'):
        k = 1
        while os.path.exists(f'{GAME}/sfx/{n}{k + 1}.mp3'): k += 1
        i = (last.get(n, 0) % k) + 1; last[n] = i; n = f'{n}{i}'
    if os.path.exists(f'{GAME}/sfx/{n}.mp3'): snd2.append((t, n))
snd = snd2
inputs = ['-i', out, '-i', f'{GAME}/music.mp3', '-i', f'{SV}/verse-presents.mp4', '-i', f'{SV}/verse-only.mp4']
flt = [f'[1:a]atrim=0:{DUR},volume=0.42,afade=t=out:st={DUR - 1.2}:d=1.2[m]', '[2:a]volume=0.9[ai]',
       f'[3:a]volume=0.9,adelay={int(GAME_END / FPS * 1000)}|{int(GAME_END / FPS * 1000)}[ao]']
TT = int(len(intro) / FPS * 1000); ET = int((GAME_END - END_N) / FPS * 1000)
inputs += ['-i', f'{SV}/source/px-kick-hit.mp3', '-i', f'{SV}/source/sfx-ting.mp3']
flt += [f'[4:a]volume=0.8,adelay={TT}|{TT}[th]', f'[5:a]volume=0.7,adelay={ET}|{ET}[et]']
labels = ['[m]', '[ai]', '[ao]', '[th]', '[et]']
for j, (t, n) in enumerate(snd):
    inputs += ['-i', f'{GAME}/sfx/{n}.mp3']
    ms = int(t * 1000); vol = 0.35 if n.startswith(('turn', 'steps')) else 0.6 if n.startswith('saved') else 0.8
    flt.append(f'[{6 + j}:a]volume={vol},adelay={ms}|{ms}[s{j}]'); labels.append(f'[s{j}]')
flt.append(''.join(labels) + f'amix=inputs={len(labels)}:normalize=0,volume=1.45,alimiter=limit=0.9,atrim=0:{DUR}[a]')
final = os.path.join(HERE, 'out', 'drill-promo3.mp4' if FR == 'frames3' else 'drill-promo2.mp4' if FR == 'frames2' else 'drill-promo.mp4')
subprocess.run(['ffmpeg', '-y', '-v', 'error', *inputs, '-filter_complex', ';'.join(flt), '-map', '0:v', '-map', '[a]',
                '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', final], check=True)
print('wrote', final, f'{DUR:.1f}s', len(snd), 'sounds')
