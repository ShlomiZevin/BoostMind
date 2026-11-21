# The Syncs STORY video (Shlomi, 20 Nov 2026): Syncs presented as a real product Techy-Tech built - a straight corporate
# launch on the GPT keynote backdrop: the logo -> 4 features, each the real app on a phone -> "פגישה אחת ביום. / עכשיו
# בשלומיוורס". Instagram safe zones kept. Music = the teaser's track.   python story.py -> out/syncs-story.mp4
import os, subprocess
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
P = lambda *a: os.path.join(HERE, *a)
W, H, FPS = 1080, 1920, 30
# title, recording, from, length, zoom, centre y (start, end)
# v2 (21 Nov): the corporate demo track (music/corp.mp3, 120 BPM) - every cut on its 0.5 s beat, its final chord on
# "עכשיו בשלומיוורס"
FEAT = [('f1', 'm2', 0.4, 3.0, 1.0, 844, 844),
        ('f2', 'demo', 26.6, 3.0, 1.04, 880, 940),
        ('f3', 'm2', 43.4, 2.5, 1.04, 860, 900),
        ('f4', 'recap', 0.6, 3.0, 1.02, 700, 1100)]
T_FEAT = 2.5
T_END = T_FEAT + sum(f[3] for f in FEAT)     # 14.0
T_NOW = T_END + 1.0                          # 15.0 = the track's final chord
DUR = T_NOW + 2.5
M_FROM = 30.0 - T_NOW

def read_clip(path, ss=0, t=None, w=W, h=H):
    a = ['ffmpeg', '-v', 'error', '-ss', str(ss), '-i', path] + (['-t', str(t)] if t else []) + \
        ['-vf', f'fps={FPS},scale={w}:{h}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']
    raw = subprocess.run(a, capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)
ttl = {k[:-4]: np.asarray(Image.open(P('ts', k)).convert('RGBA'), np.float32) / 255 for k in os.listdir(P('ts'))}
feats = [(k, read_clip(P('rec', s + '.mp4'), ss, d + 0.1, 780, 1688)[:int(d * FPS)], d, z, y0, y1) for k, s, ss, d, z, y0, y1 in FEAT]
BG_IM = Image.open(P('look', 'bg-tall.png')).convert('RGB').resize((W, int(W * 1536 / 1024)), Image.LANCZOS)
BG_IM = BG_IM.crop((0, (BG_IM.height - H) // 2, W, (BG_IM.height - H) // 2 + H)) if BG_IM.height >= H else BG_IM.resize((W, H))
ease = lambda u: u * u * (3 - 2 * u)
def push(im, u, z0, z1):
    z = z0 + (z1 - z0) * ease(min(1, max(0, u))); cw, ch = W / z, H / z
    return np.asarray(im.resize((W, H), Image.BILINEAR, box=((W - cw) / 2, (H - ch) / 2, (W + cw) / 2, (H + ch) / 2)), np.float32) / 255
SW, SH, BZ, R = 700, 1100, 16, 70
PW, PH = SW + 2 * BZ, SH + 2 * BZ
PX, PY = (W - PW) // 2, 500
body = Image.new('RGBA', (PW, PH), (0, 0, 0, 0)); ImageDraw.Draw(body).rounded_rectangle((0, 0, PW - 1, PH - 1), R, fill=(14, 14, 18, 255), outline=(110, 90, 80, 255), width=3)
smask = Image.new('L', (SW, SH), 0); ImageDraw.Draw(smask).rounded_rectangle((0, 0, SW - 1, SH - 1), R - BZ, fill=255)
shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(shadow).rounded_rectangle((PX + 8, PY + 30, PX + PW + 8, PY + PH + 30), R, fill=(0, 0, 0, 200))
shadow = shadow.filter(ImageFilter.GaussianBlur(30))
def on_phone(frame, z, cy, u, bgu, rise=0):
    cw = 780 / z; ch = cw * SH / SW; cy = min(max(cy, ch / 2), 1688 - ch / 2)
    scr = Image.fromarray(frame).resize((SW, SH), Image.LANCZOS, box=(390 - cw / 2, cy - ch / 2, 390 + cw / 2, cy + ch / 2))
    bg = Image.fromarray((push(BG_IM, bgu, 1.0, 1.08) * 255).astype(np.uint8)).convert('RGBA'); bg.alpha_composite(shadow)
    ph = body.copy(); ph.paste(scr, (BZ, BZ), smask)
    bg.alpha_composite(ph, (PX, PY + int(rise))); return np.asarray(bg.convert('RGB'), np.float32) / 255
def over(fr, k, t0, t, dur=0.4, rise=30):
    a = min(1, max(0, (t - t0) / dur))
    if a <= 0: return fr
    e = ease(a); lay = ttl[k]
    if rise and e < 1: lay = np.roll(lay, int(rise * (1 - e)), axis=0)
    al = lay[..., 3:4] * e; return fr * (1 - al) + lay[..., :3] * al

N = int(round(DUR * FPS))
os.makedirs(P('out'), exist_ok=True); vout = P('out', 'story-video-only.mp4')
pr = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                       '-c:v', 'libx264', '-crf', '17', '-preset', 'slow', '-pix_fmt', 'yuv420p', vout], stdin=subprocess.PIPE)
for i in range(N):
    t = i / FPS
    if t < T_FEAT:
        fr = push(BG_IM, t / DUR, 1.0, 1.08); fr = over(fr, 's0', 0.15, t, 0.6, 0); fr = over(fr, 's0h', 0.9, t, 0.5)
    elif t < T_END:
        t0 = T_FEAT
        for k, frs, d, z, y0, y1 in feats:
            if t < t0 + d: break
            t0 += d
        u = (t - t0) / d; rise = 60 * (1 - ease(min(1, (t - t0) / 0.45)))
        fr = on_phone(frs[min(len(frs) - 1, int((t - t0) * FPS))], z, y0 + (y1 - y0) * ease(u), u, t / DUR, rise)
        fr = over(fr, k, t0, t, 0.35)
    else:
        fr = push(BG_IM, t / DUR, 1.0, 1.08); fr = over(fr, 'end', T_END, t, 0.5, 0); fr = over(fr, 'now', T_NOW, t, 0.4)
    pr.stdin.write((np.clip(fr, 0, 1) * 255).astype(np.uint8).tobytes())
pr.stdin.close(); pr.wait()
final = P('out', 'syncs-story.mp4')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', vout, '-i', P('music', 'corp.mp3'), '-filter_complex',
                f'[1:a]atrim={M_FROM}:{M_FROM + DUR},asetpts=PTS-STARTPTS,afade=t=out:st={DUR - 0.8}:d=0.8,volume=0.9[a]',
                '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', final], check=True)
print('wrote', final, f'{DUR:.1f}s')
