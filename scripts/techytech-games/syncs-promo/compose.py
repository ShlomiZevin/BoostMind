# The Syncs social teaser. v2 (his notes, 21 Nov 2026): "the music isn't connected - annoying techno, it should be
# corporate; the hook and the rest aren't connected, not rhythmic, like pasting; fast, with corporate demo / tutorial
# music". So: ONE corporate product-demo track (music/corp.mp3, 120 BPM) runs from the first frame - quiet under the
# hook, full from the cut - and EVERY cut sits on its beat (0.5 s grid); its final chord lands on "עכשיו בשלומיוורס".
#   0.0  HOOK (ronit-joins): Amir "מצוין, אז אנחנו מסונכרנים." Ronit "לא, אנחנו לא מסונכרנים."
#   3.5  "לא מסונכרנים?" (the hook's own words become the question the product answers)
#   5.0  the Syncs logo / "הזום החדש של טקי-טק"
#   7.0  a REAL Syncs meeting (the yogurt one) on a phone, a Syncs notification popping on each beat-cut
#  18.5  "נמשיך להסתנכרן." -> 20.0 the final chord + "עכשיו בשלומיוורס"
#  21.5  in the silence, Ofer (follow-up): "אפשר להתקדם בלי להתקדם פורמלי." -> 'רק בשלומיוורס'
#   python compose.py   -> out/syncs-teaser.mp4
import os, subprocess
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
P = lambda *a: os.path.join(HERE, *a)
SV = 'C:/workspace/BoostMind/zoomcut/episodes/_assets/shlomiverse'
LIB = 'C:/workspace/BoostMind/zoomcut/library/sounds'
W, H, FPS = 1080, 1920, 30
HOOK = (35.55, 38.85)                 # ronit-joins
PUN = (91.60, 94.30)                  # follow-up
# label, recording, from (s), length (s, whole beats), zoom, centre y in the 1688-tall recording (start, end)
CLIPS = [('l1', 'm2', 16.5, 1.5, 1.08, 560, 590),
         ('l2', 'm2', 23.2, 1.5, 1.08, 790, 820),
         ('l3', 'm2', 43.4, 2.0, 1.08, 860, 900),
         ('l4', 'm2', 59.8, 1.5, 1.08, 1110, 1140),
         ('l5', 'demo', 27.0, 1.5, 1.08, 910, 940),
         ('l6', 'm2', 91.0, 1.5, 1.08, 880, 920),
         ('l7', 'recap', 0.8, 2.0, 1.06, 800, 1050)]
T_Q, T_LOGO, T_CLIPS = 3.5, 5.0, 7.0
T_END = T_CLIPS + sum(c[3] for c in CLIPS)    # 18.5
T_NOW = T_END + 1.5                            # 20.0 = the track's final chord
T_PUN = T_NOW + 1.5
T_OUT = T_PUN + (PUN[1] - PUN[0]) + 0.6
M_BUTTON = 30.0                                # the final chord in music/corp.mp3
M_FROM = M_BUTTON - T_NOW                      # the track starts at video 0 from here (on its beat grid)

def read_clip(path, ss=0, t=None, w=W, h=H):
    a = ['ffmpeg', '-v', 'error', '-ss', str(ss), '-i', path] + (['-t', str(t)] if t else []) + \
        ['-vf', f'fps={FPS},scale={w}:{h}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']
    raw = subprocess.run(a, capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)

outro = read_clip(f'{SV}/verse-only.mp4')
hook = read_clip(P('src', 'ronit-joins.mp4'), HOOK[0], HOOK[1] - HOOK[0])
pun = read_clip(P('src', 'follow-up.mp4'), PUN[0], PUN[1] - PUN[0], 720, 1280)
ttl = {k[:-4]: np.asarray(Image.open(P('t', k)).convert('RGBA'), np.float32) / 255 for k in os.listdir(P('t'))}
clips = [(lab, read_clip(P('rec', src + '.mp4'), ss, dur + 0.1, 780, 1688)[:int(dur * FPS)], dur, z, y0, y1) for lab, src, ss, dur, z, y0, y1 in CLIPS]

# the page: a clean light corporate background, a soft Syncs-orange glow behind the phone
yy, xx = np.mgrid[0:H, 0:W]
g = np.exp(-(((xx - W / 2) / 700) ** 2 + ((yy - H * 0.55) / 950) ** 2))
BG = np.clip(np.stack([0.955 + 0.04 * g, 0.945 - 0.03 * g, 0.93 - 0.09 * g], -1), 0, 1).astype(np.float32)
BG_IM = Image.fromarray((BG * 255).astype(np.uint8))
DARK = np.full((H, W, 3), [0.03, 0.03, 0.05], np.float32)

SW, SH, BZ, R = 860, 1352, 18, 84
PW, PH = SW + 2 * BZ, SH + 2 * BZ
PX, PY = (W - PW) // 2, 440
body = Image.new('RGBA', (PW, PH), (0, 0, 0, 0)); ImageDraw.Draw(body).rounded_rectangle((0, 0, PW - 1, PH - 1), R, fill=(18, 18, 24, 255), outline=(60, 60, 70, 255), width=3)
smask = Image.new('L', (SW, SH), 0); ImageDraw.Draw(smask).rounded_rectangle((0, 0, SW - 1, SH - 1), R - BZ, fill=255)
shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(shadow).rounded_rectangle((PX + 6, PY + 36, PX + PW + 6, PY + PH + 36), R, fill=(60, 30, 10, 110))
shadow = shadow.filter(ImageFilter.GaussianBlur(36))
ease = lambda u: u * u * (3 - 2 * u)
def on_phone(frame, z, cy, bump, slide=0.0):   # the app on a phone; bump = the little punch on each beat-cut
    cw = 780 / z; ch = cw * SH / SW; cy = min(max(cy, ch / 2), 1688 - ch / 2)
    scr = Image.fromarray(frame).resize((SW, SH), Image.LANCZOS, box=(390 - cw / 2, cy - ch / 2, 390 + cw / 2, cy + ch / 2))
    bg = BG_IM.convert('RGBA'); bg.alpha_composite(shadow, (0, int(slide))); ph = body.copy(); ph.paste(scr, (BZ, BZ), smask)
    s = 1.0 + 0.03 * bump; pw, phh = int(PW * s), int(PH * s); ph = ph.resize((pw, phh), Image.BILINEAR)
    bg.alpha_composite(ph, (PX - (pw - PW) // 2, PY - (phh - PH) // 2 + int(slide))); return np.asarray(bg.convert('RGB'), np.float32) / 255
def push(im, u, z0, z1, cx=.5, cy=.5):
    z = z0 + (z1 - z0) * ease(min(1, max(0, u))); cw, ch = W / z, H / z
    x = min(max(cx * W, cw / 2), W - cw / 2); y = min(max(cy * H, ch / 2), H - ch / 2)
    return np.asarray(im.resize((W, H), Image.BILINEAR, box=(x - cw / 2, y - ch / 2, x + cw / 2, y + ch / 2)), np.float32) / 255
BBOX = {}
def over(fr, k, t0, t, dur=0.2, rise=30, s0=0.86):   # pops in on its beat: grows from s0, rises a little
    a = min(1, max(0, (t - t0) / dur))
    if a <= 0: return fr
    lay = ttl[k]; e = ease(a)
    if e < 1:
        if k not in BBOX: ys, xs = np.where(lay[..., 3] > 0.01); BBOX[k] = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
        x0, y0, x1, y1 = BBOX[k]; sc = s0 + (1 - s0) * e; dy = int(rise * (1 - e))
        im = Image.fromarray((lay[y0:y1, x0:x1] * 255).astype(np.uint8), 'RGBA')
        nw, nh = max(1, int((x1 - x0) * sc)), max(1, int((y1 - y0) * sc)); im = im.resize((nw, nh), Image.BILINEAR)
        L = Image.new('RGBA', (W, H)); L.paste(im, ((x0 + x1 - nw) // 2, (y0 + y1 - nh) // 2 + dy)); lay = np.asarray(L, np.float32) / 255
    al = lay[..., 3:4] * e; return fr * (1 - al) + lay[..., :3] * al
def ofer_faint(k, u):   # Ofer's face (the reel's caption cut away), dim behind the punchline
    im = Image.fromarray(pun[min(len(pun) - 1, k)]).crop((20, 330, 700, 850))
    b = im.resize((W, H)).filter(ImageFilter.GaussianBlur(26)); b = ImageEnhance.Brightness(b).enhance(0.5)
    s = W / im.width; fg = im.resize((W, int(im.height * s)), Image.LANCZOS); b.paste(fg, (0, (H - fg.height) // 2))
    return push(b, u, 1.04, 1.1, .5, .45)

N = int(round(T_OUT * FPS)) + len(outro)
os.makedirs(P('out'), exist_ok=True); vout = P('out', 'video-only.mp4')
pr = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                       '-c:v', 'libx264', '-crf', '17', '-preset', 'slow', '-pix_fmt', 'yuv420p', vout], stdin=subprocess.PIPE)
for i in range(N):
    t = i / FPS
    if t < T_Q:                                   # the sketch; its last 0.2 s pushes in towards the cut
        fr = hook[min(i, len(hook) - 1)]
        u = max(0, (t - (T_Q - 0.35)) / 0.35); fr = push(Image.fromarray(fr), u, 1.0, 1.12) if u > 0 else fr.astype(np.float32) / 255
    elif t < T_LOGO:
        fr = push(BG_IM, (t - T_Q) / 1.5, 1.0, 1.03); fr = over(fr, 'q', T_Q, t, 0.18, 0, 0.7)
    elif t < T_CLIPS:
        fr = push(BG_IM, (t - T_LOGO) / 2, 1.0, 1.03); fr = over(fr, 'logo', T_LOGO, t, 0.2, 0, 0.75)
    elif t < T_END:
        t0 = T_CLIPS
        for lab, frs, dur, z, y0, y1 in clips:
            if t < t0 + dur: break
            t0 += dur
        u = (t - t0) / dur; bump = max(0, 1 - (t - t0) / 0.22)
        slide = (1 - ease(min(1, (t - T_CLIPS) / 0.3))) * 900       # the phone slides up into the first beat
        fr = on_phone(frs[min(len(frs) - 1, int((t - t0) * FPS))], z, y0 + (y1 - y0) * ease(u), bump, slide)
        fr = over(fr, lab, t0 + (0.12 if t0 == T_CLIPS else 0), t, 0.16, 24)
    elif t < T_PUN:
        fr = push(BG_IM, (t - T_END) / 3, 1.0, 1.03); fr = over(fr, 'end', T_END, t, 0.2, 0, 0.8); fr = over(fr, 'now', T_NOW, t, 0.16, 0, 0.6)
    elif t < T_OUT:
        k = int((t - T_PUN) * FPS); gg = min(1, (t - T_PUN) / 0.25)
        fr = DARK * (1 - 0.38) + ofer_faint(k, (t - T_PUN) / (T_OUT - T_PUN)) * 0.38
        fr = BG * (1 - gg) + fr * gg if gg < 1 else fr
        fr = over(fr, 'punch', T_PUN, t, 0.15, 0)
    else: fr = outro[min(len(outro) - 1, i - int(round(T_OUT * FPS)))].astype(np.float32) / 255
    pr.stdin.write((np.clip(fr, 0, 1) * 255).astype(np.uint8).tobytes())
pr.stdin.close(); pr.wait()
DUR = N / FPS

# sound: the corporate track from frame 0 (low under the hook's voices, full from the cut, its final chord on
# "עכשיו בשלומיוורס", then it rings out); a whoosh on the cut; a soft pop per notification (rotating, never the same
# twice in a row); a ting on "עכשיו"; Ofer's line alone in the silence; the outro's own sound.
ms = lambda s: int(s * 1000)
dl = lambda s: f'adelay={ms(s)}|{ms(s)}'
POPS = [f'{LIB}/pop1.mp3', f'{LIB}/pop2.mp3', f'{LIB}/pop3.mp3', f'{LIB}/pop-1.mp3', f'{LIB}/pop-2.mp3']
inputs = ['-i', vout, '-i', P('src', 'ronit-joins.mp4'), '-i', P('music', 'corp.mp3'), '-i', f'{SV}/verse-only.mp4',
          '-i', f'{SV}/source/sfx-whoosh.wav', '-i', f'{SV}/source/sfx-ting.mp3', '-i', P('src', 'follow-up.mp4')] + sum((['-i', p] for p in POPS), [])
mend = T_PUN + 0.2
flt = [f'[1:a]atrim={HOOK[0]}:{HOOK[1]},asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st={HOOK[1]-HOOK[0]-0.06}:d=0.06,volume=1.25[hk]',
       f"[2:a]atrim={M_FROM}:{M_FROM + mend},asetpts=PTS-STARTPTS,volume='if(lt(t,{T_Q - 0.05}),0.22,0.9)':eval=frame,afade=t=out:st={mend - 0.5}:d=0.5[m]",
       f'[3:a]volume=0.9,{dl(T_OUT)}[ao]',
       f'[4:a]volume=0.55,{dl(T_Q - 0.25)}[wh]', f'[5:a]volume=0.7,{dl(T_NOW)}[tg]',
       f'[6:a]atrim={PUN[0]}:{PUN[1]},asetpts=PTS-STARTPTS,afade=t=in:d=0.03,afade=t=out:st={PUN[1]-PUN[0]-0.05}:d=0.05,apad=pad_dur=0.6,aecho=0.85:0.6:90:0.18,volume=1.4,{dl(T_PUN)}[pn]']
labs = ['[hk]', '[m]', '[ao]', '[wh]', '[tg]', '[pn]']
t0 = T_CLIPS
for j, c in enumerate(CLIPS):
    flt.append(f'[{7 + j % len(POPS)}:a]volume=0.45,{dl(t0 + (0.12 if j == 0 else 0))}[p{j}]'); labs.append(f'[p{j}]'); t0 += c[3]
# an input can feed only one chain - split the pops that are used twice
used = {}
for j in range(len(CLIPS)):
    used.setdefault(7 + j % len(POPS), []).append(j)
for inp, js in used.items():
    if len(js) > 1:
        flt = [f for f in flt if not f.startswith(f'[{inp}:a]')]
        flt.append(f'[{inp}:a]asplit={len(js)}' + ''.join(f'[s{inp}_{n}]' for n in range(len(js))))
        t0s = [T_CLIPS + sum(c[3] for c in CLIPS[:j]) + (0.12 if j == 0 else 0) for j in js]
        for n, (j, ts) in enumerate(zip(js, t0s)): flt.append(f'[s{inp}_{n}]volume=0.45,{dl(ts)}[p{j}]')
flt.append(''.join(labs) + f'amix=inputs={len(labs)}:normalize=0,alimiter=limit=0.92,atrim=0:{DUR}[a]')
final = P('out', 'syncs-teaser.mp4')
subprocess.run(['ffmpeg', '-y', '-v', 'error', *inputs, '-filter_complex', ';'.join(flt), '-map', '0:v', '-map', '[a]',
                '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', final], check=True)
print('wrote', final, f'{DUR:.1f}s', f'clips {T_CLIPS:.2f}-{T_END:.2f}', f'now {T_NOW:.2f}', f'punch {T_PUN:.2f}')
