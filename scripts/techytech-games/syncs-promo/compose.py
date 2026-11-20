# The Syncs social teaser (Shlomi, 20 Nov 2026), built like the approved Techy-Tech meetings trailer:
#   HOOK (a real sketch, ronit-joins): Amir "מצוין, אז אנחנו מסונכרנים." Ronit "לא, אנחנו לא מסונכרנים."
#   -> 'שלומיוורס מציגים' (the music starts in full) -> "טקי-טק מציגה / הזום של השלומיוורס" -> BOOM the Syncs logo
#   -> a REAL Syncs meeting (the yogurt one, recorded live) on a phone, zoomed on each moment, a Syncs notification each
#   -> "נמשיך להסתנכרן. / עכשיו בשלומיוורס" on the music's end + a boom -> in the silence, Amir (follow-up):
#      "אפשר להתקדם בלי להתקדם פורמלי." (his face faint) -> 'רק בשלומיוורס'.
#   python compose.py   -> out/syncs-teaser.mp4
import os, subprocess
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
P = lambda *a: os.path.join(HERE, *a)
SV = 'C:/workspace/BoostMind/zoomcut/episodes/_assets/shlomiverse'
BOOM = 'C:/workspace/studio/zoomcut/episodes/_assets/crypto/px-boom-05.mp3'
W, H, FPS = 1080, 1920, 30
HOOK = (35.55, 38.85)                 # ronit-joins: "מצוין, אז אנחנו מסונכרנים." / "לא, אנחנו לא מסונכרנים."
PUN = (91.60, 94.30)                  # follow-up: "אפשר להתקדם בלי להתקדם פורמלי."
# label, recording, from (s), length (s), zoom, centre y in the 1688-tall recording (start, end)
CLIPS = [('l1', 'm2', 16.3, 2.3, 1.08, 560, 600),
         ('l2', 'm2', 22.4, 2.6, 1.08, 760, 820),
         ('l3', 'm2', 43.2, 2.5, 1.08, 860, 900),
         ('l4', 'm2', 59.3, 2.6, 1.08, 1100, 1140),
         ('l5', 'demo', 26.6, 2.5, 1.08, 900, 940),
         ('l6', 'm2', 90.4, 2.5, 1.08, 860, 920),
         ('l7', 'recap', 0.6, 4.2, 1.06, 760, 1100)]
T_PRES = HOOK[1] - HOOK[0]            # 3.30
T_TITLE = T_PRES + 1.8
T_LOGO = T_TITLE + 2.0
T_CLIPS = T_LOGO + 1.9
T_END = T_CLIPS + sum(c[3] for c in CLIPS)
T_NOW = T_END + 0.7
T_PUN = T_END + 2.6
T_OUT = T_PUN + (PUN[1] - PUN[0]) + 0.6
M_FROM = 0.3                          # music/m2.mp3: full from 0.3 s, ends ~24.4 s

def read_clip(path, ss=0, t=None, w=W, h=H):
    a = ['ffmpeg', '-v', 'error', '-ss', str(ss), '-i', path] + (['-t', str(t)] if t else []) + \
        ['-vf', f'fps={FPS},scale={w}:{h}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']
    raw = subprocess.run(a, capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)

intro, outro = read_clip(f'{SV}/verse-presents.mp4'), read_clip(f'{SV}/verse-only.mp4')
hook = read_clip(P('src', 'ronit-joins.mp4'), HOOK[0], HOOK[1] - HOOK[0])
pun = read_clip(P('src', 'follow-up.mp4'), PUN[0], PUN[1] - PUN[0], 720, 1280)
ttl = {k[:-4]: np.asarray(Image.open(P('t', k)).convert('RGBA'), np.float32) / 255 for k in os.listdir(P('t'))}
clips = [(lab, read_clip(P('rec', src + '.mp4'), ss, dur + 0.1, 780, 1688)[:int(dur * FPS)], dur, z, y0, y1) for lab, src, ss, dur, z, y0, y1 in CLIPS]

# the background: dark, an orange glow behind the phone (the Syncs colour)
yy, xx = np.mgrid[0:H, 0:W]
g = np.exp(-(((xx - W / 2) / 620) ** 2 + ((yy - H * 0.55) / 900) ** 2))
BG = np.clip(np.stack([0.04 + 0.42 * g, 0.04 + 0.17 * g, 0.06 + 0.03 * g], -1), 0, 1).astype(np.float32)
BG_IM = Image.fromarray((BG * 255).astype(np.uint8))

SW, SH, BZ, R = 860, 1352, 18, 84
PW, PH = SW + 2 * BZ, SH + 2 * BZ
PX, PY = (W - PW) // 2, 440
body = Image.new('RGBA', (PW, PH), (0, 0, 0, 0)); ImageDraw.Draw(body).rounded_rectangle((0, 0, PW - 1, PH - 1), R, fill=(18, 18, 24, 255), outline=(90, 90, 104, 255), width=3)
smask = Image.new('L', (SW, SH), 0); ImageDraw.Draw(smask).rounded_rectangle((0, 0, SW - 1, SH - 1), R - BZ, fill=255)
shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(shadow).rounded_rectangle((PX + 10, PY + 30, PX + PW + 10, PY + PH + 30), R, fill=(0, 0, 0, 190))
shadow = shadow.filter(ImageFilter.GaussianBlur(30))
ease = lambda u: u * u * (3 - 2 * u)
def on_phone(frame, z, cy, u):   # the app on a phone, zoomed in on the moment (z = how close), drifting slowly
    cw = 780 / z; ch = cw * SH / SW; cy = min(max(cy, ch / 2), 1688 - ch / 2)
    scr = Image.fromarray(frame).resize((SW, SH), Image.LANCZOS, box=(390 - cw / 2, cy - ch / 2, 390 + cw / 2, cy + ch / 2))
    bg = BG_IM.convert('RGBA'); bg.alpha_composite(shadow); ph = body.copy(); ph.paste(scr, (BZ, BZ), smask)
    s = 1.0 + 0.015 * ease(u); pw, phh = int(PW * s), int(PH * s); ph = ph.resize((pw, phh), Image.LANCZOS)
    bg.alpha_composite(ph, (PX - (pw - PW) // 2, PY - (phh - PH) // 2)); return np.asarray(bg.convert('RGB'), np.float32) / 255
def push(im, u, z0, z1, cx=.5, cy=.5):
    z = z0 + (z1 - z0) * ease(min(1, max(0, u))); cw, ch = W / z, H / z
    x = min(max(cx * W, cw / 2), W - cw / 2); y = min(max(cy * H, ch / 2), H - ch / 2)
    return np.asarray(im.resize((W, H), Image.BILINEAR, box=(x - cw / 2, y - ch / 2, x + cw / 2, y + ch / 2)), np.float32) / 255
BBOX = {}
def over(fr, k, t0, t, dur=0.35, rise=40, t1=None):   # grows in softly from 86% (never pops); t1 = leaves there
    a = min(1, max(0, (t - t0) / dur))
    if t1 is not None: a = min(a, max(0, 1 - (t - t1) / 0.15))
    if a <= 0: return fr
    lay = ttl[k]; e = ease(a)
    if e < 1:
        if k not in BBOX: ys, xs = np.where(lay[..., 3] > 0.01); BBOX[k] = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
        x0, y0, x1, y1 = BBOX[k]; sc = 0.86 + 0.14 * e; dy = int(rise * (1 - e))
        im = Image.fromarray((lay[y0:y1, x0:x1] * 255).astype(np.uint8), 'RGBA')
        nw, nh = max(1, int((x1 - x0) * sc)), max(1, int((y1 - y0) * sc)); im = im.resize((nw, nh), Image.BILINEAR)
        L = Image.new('RGBA', (W, H)); L.paste(im, ((x0 + x1 - nw) // 2, (y0 + y1 - nh) // 2 + dy)); lay = np.asarray(L, np.float32) / 255
    al = lay[..., 3:4] * e; return fr * (1 - al) + lay[..., :3] * al
def amir_faint(k, u):   # Ofer's face (the reel's caption cut away), blurred around, faint behind the punchline
    im = Image.fromarray(pun[min(len(pun) - 1, k)]).crop((20, 330, 700, 850))
    b = im.resize((W, H)).filter(ImageFilter.GaussianBlur(26)); b = ImageEnhance.Brightness(b).enhance(0.5)
    s = W / im.width; fg = im.resize((W, int(im.height * s)), Image.LANCZOS); b.paste(fg, (0, (H - fg.height) // 2))
    return push(b, u, 1.04, 1.1, .5, .45)

N = int(round(T_OUT * FPS)) + len(outro)
FLASH = [T_PRES, T_LOGO, T_CLIPS, T_END]
os.makedirs(P('out'), exist_ok=True); vout = P('out', 'video-only.mp4')
pr = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                       '-c:v', 'libx264', '-crf', '17', '-preset', 'slow', '-pix_fmt', 'yuv420p', vout], stdin=subprocess.PIPE)
for i in range(N):
    t = i / FPS
    if t < T_PRES: fr = hook[min(i, len(hook) - 1)].astype(np.float32) / 255
    elif t < T_TITLE: fr = intro[min(len(intro) - 1, i - int(round(T_PRES * FPS)))].astype(np.float32) / 255
    elif t < T_LOGO: fr = push(BG_IM, (t - T_TITLE) / 2, 1.0, 1.05); fr = over(fr, 'present', T_TITLE + 0.1, t, 0.4)
    elif t < T_CLIPS: fr = push(BG_IM, (t - T_LOGO) / 2, 1.05, 1.1); fr = over(fr, 'logo', T_LOGO, t, 0.25, 0)
    elif t < T_END:
        t0 = T_CLIPS
        for lab, frs, dur, z, y0, y1 in clips:
            if t < t0 + dur: break
            t0 += dur
        u = (t - t0) / dur; fr = on_phone(frs[min(len(frs) - 1, int((t - t0) * FPS))], z, y0 + (y1 - y0) * ease(u), (t - T_CLIPS) / (T_END - T_CLIPS))
        fr = over(fr, lab, t0, t, 0.18, 20)
    elif t < T_PUN: fr = push(BG_IM, (t - T_END) / 2.6, 1.0, 1.04); fr = over(fr, 'end', T_END, t, 0.2, 0); fr = over(fr, 'now', T_NOW, t, 0.35)
    elif t < T_OUT:
        k = int((t - T_PUN) * FPS); g = min(1, (t - T_PUN) / 0.3) * 0.38
        fr = BG * (1 - g) + amir_faint(k, (t - T_PUN) / (T_OUT - T_PUN)) * g
        fr = over(fr, 'punch', T_PUN, t, 0.15, 0)
    else: fr = outro[min(len(outro) - 1, i - int(round(T_OUT * FPS)))].astype(np.float32) / 255
    for c in FLASH:
        d = abs(t - c) * FPS
        if d < 4: fr = fr + (1 - fr) * (np.array([1, .945, .863]) * (1 - d / 4) * 0.7)
    pr.stdin.write((np.clip(fr, 0, 1) * 255).astype(np.uint8).tobytes())
pr.stdin.close(); pr.wait()
DUR = N / FPS

# sound: the hook's own voices; the music JUST STARTS in full with 'שלומיוורס מציגים' and runs to the end card, a boom on
# the logo and on the end card, then the silence and Amir's line alone (a little room), the outro's whoosh
ms = lambda s: int(s * 1000)
dl = lambda s: f'adelay={ms(s)}|{ms(s)}'
inputs = ['-i', vout, '-i', P('src', 'ronit-joins.mp4'), '-i', P('music', 'm2.mp3'), '-i', f'{SV}/verse-presents.mp4', '-i', f'{SV}/verse-only.mp4',
          '-i', f'{SV}/source/px-kick-hit.mp3', '-i', BOOM, '-i', P('src', 'follow-up.mp4')]
mlen = T_END - T_PRES
flt = [f'[1:a]atrim={HOOK[0]}:{HOOK[1]},asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st={HOOK[1]-HOOK[0]-0.06}:d=0.06,volume=1.25[hk]',
       f'[2:a]atrim={M_FROM}:{M_FROM + mlen + 0.4},asetpts=PTS-STARTPTS,afade=t=out:st={mlen}:d=0.4,volume=0.85,{dl(T_PRES)}[m]',
       f'[3:a]atrim=0:1.8,volume=0.9,{dl(T_PRES)}[ai]', f'[4:a]volume=0.9,{dl(T_OUT)}[ao]',
       f'[5:a]volume=0.9,{dl(T_LOGO)}[b1]', f'[6:a]volume=1.0,{dl(T_END)}[b2]',
       f'[7:a]atrim={PUN[0]}:{PUN[1]},asetpts=PTS-STARTPTS,afade=t=in:d=0.03,afade=t=out:st={PUN[1]-PUN[0]-0.05}:d=0.05,apad=pad_dur=0.6,aecho=0.85:0.6:90:0.18,volume=1.4,{dl(T_PUN)}[pn]']
labs = ['[hk]', '[m]', '[ai]', '[ao]', '[b1]', '[b2]', '[pn]']
flt.append(''.join(labs) + f'amix=inputs={len(labs)}:normalize=0,alimiter=limit=0.92,atrim=0:{DUR}[a]')
final = P('out', 'syncs-teaser.mp4')
subprocess.run(['ffmpeg', '-y', '-v', 'error', *inputs, '-filter_complex', ';'.join(flt), '-map', '0:v', '-map', '[a]',
                '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', final], check=True)
print('wrote', final, f'{DUR:.1f}s', f'clips {T_CLIPS:.2f}-{T_END:.2f}', f'punch {T_PUN:.2f}')
