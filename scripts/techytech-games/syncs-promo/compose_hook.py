# The Syncs HOOK teaser, v5 (his ask, 21 Nov 2026): "give the hook, then a bit of the regular product preview we just
# described, and a closure like you did with Ofer". So it is the story video (the real launch, story.py ->
# out/story-video-only.mp4) with the sketch in front and Ofer behind, on ONE corporate track (music/corp.mp3, 120 BPM):
#   0.0  HOOK (ronit-joins): Amir "מצוין, אז אנחנו מסונכרנים." Ronit "לא, אנחנו לא מסונכרנים."  (the track low under it)
#   3.5  "לא מסונכרנים?" on the launch's keynote backdrop (the track full)
#   5.0  the launch itself: טקי-טק מציגה / Syncs -> 4 benefit shots on the phone -> "התחילו עם Syncs"
#  20.0  the track's final chord + "עכשיו בשלומיוורס"
#  21.5  in the silence, Ofer (follow-up): "אפשר להתקדם בלי להתקדם פורמלי." -> 'רק בשלומיוורס'
# Every cut sits on the track's 0.5 s beat (the story's own cuts are on its grid, it starts on 5.0).
# Run story-titles.js + story.py first.   python compose_hook.py -> out/syncs-hook-teaser.mp4
import os, subprocess
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw, ImageFont
FONT = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 40)

HERE = os.path.dirname(os.path.abspath(__file__))
P = lambda *a: os.path.join(HERE, *a)
SV = 'C:/workspace/BoostMind/zoomcut/episodes/_assets/shlomiverse'
W, H, FPS = 1080, 1920, 30
HOOK = (35.47, 38.49)                 # Ronit cut right after 'מסונכרנים' (38.48) - she goes on talking
PUN = (91.60, 94.30)
T_Q, T_STORY = 3.0, 4.5
STORY_LEN = 15.5                      # the story to 0.5 s after its "עכשיו בשלומיוורס" (its 15.0)
T_NOW = T_STORY + 15.0                # 19.5
T_PUN = T_STORY + STORY_LEN           # 20.0 - Ofer comes right on the chord's ring, the end card stays behind him
T_OUT = T_PUN + (PUN[1] - PUN[0]) + 0.6
M_FROM = 30.0 - T_NOW                 # music/corp.mp3's final chord (30.0) on T_NOW

def read_clip(path, ss=0, t=None, w=W, h=H):
    a = ['ffmpeg', '-v', 'error', '-ss', str(ss), '-i', path] + (['-t', str(t)] if t else []) + \
        ['-vf', f'fps={FPS},scale={w}:{h}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']
    raw = subprocess.run(a, capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)

hook = read_clip(P('src', 'ronit-joins.mp4'), HOOK[0], HOOK[1] - HOOK[0])
hook_more = read_clip(P('src', 'ronit-joins.mp4'), HOOK[1], 1.6)
story = read_clip(P('out', 'story-video-only.mp4'), 0, STORY_LEN + 0.1)
pun = read_clip(P('src', 'follow-up.mp4'), PUN[0], PUN[1] - PUN[0], 720, 1280)
outro = read_clip(f'{SV}/verse-only.mp4')
Q = np.asarray(Image.open(P('ts', 'q.png')).convert('RGBA'), np.float32) / 255
BG_IM = Image.open(P('look', 'bg-tall.png')).convert('RGB').resize((W, int(W * 1536 / 1024)), Image.LANCZOS)
BG_IM = BG_IM.crop((0, (BG_IM.height - H) // 2, W, (BG_IM.height - H) // 2 + H))
DARK = np.full((H, W, 3), [0.03, 0.03, 0.05], np.float32)
ease = lambda u: u * u * (3 - 2 * u)
def push(im, u, z0, z1, cx=.5, cy=.5):
    z = z0 + (z1 - z0) * ease(min(1, max(0, u))); cw, ch = W / z, H / z
    x = min(max(cx * W, cw / 2), W - cw / 2); y = min(max(cy * H, ch / 2), H - ch / 2)
    return np.asarray(im.resize((W, H), Image.BILINEAR, box=(x - cw / 2, y - ch / 2, x + cw / 2, y + ch / 2)), np.float32) / 255
def pop(fr, lay, a, s0=0.7):          # grows in from s0 on its beat
    e = ease(min(1, max(0, a)))
    if e <= 0: return fr
    if e < 1:
        sc = s0 + (1 - s0) * e; im = Image.fromarray((lay * 255).astype(np.uint8), 'RGBA')
        nw, nh = int(W * sc), int(H * sc); L = Image.new('RGBA', (W, H)); L.paste(im.resize((nw, nh), Image.BILINEAR), ((W - nw) // 2, (H - nh) // 2))
        lay = np.asarray(L, np.float32) / 255
    al = lay[..., 3:4] * e; return fr * (1 - al) + lay[..., :3] * al
def ofer_faint(k, u):
    im = Image.fromarray(pun[min(len(pun) - 1, k)]).crop((20, 330, 700, 850))
    b = im.resize((W, H)).filter(ImageFilter.GaussianBlur(26)); b = ImageEnhance.Brightness(b).enhance(0.5)
    s = W / im.width; fg = im.resize((W, int(im.height * s)), Image.LANCZOS); b.paste(fg, (0, (H - fg.height) // 2))
    return push(b, u, 1.04, 1.1, .5, .45)
END = story[min(len(story) - 1, int(round(STORY_LEN * FPS)) - 1)].astype(np.float32) / 255
TW, TH = 900, 690; TX, TY = (W - TW) // 2, 640
tmask = Image.new('L', (TW, TH), 0); ImageDraw.Draw(tmask).rounded_rectangle((0, 0, TW - 1, TH - 1), 44, fill=255)
def ofer_tile(k):   # Ofer's Zoom frame as a Syncs speaker tile: rounded, orange speaking border, his name
    im = Image.fromarray(pun[min(len(pun) - 1, k)]).crop((20, 330, 700, 850)).resize((TW, TH), Image.LANCZOS)
    L = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(L)
    d.rounded_rectangle((TX - 9, TY - 9, TX + TW + 8, TY + TH + 8), 52, fill=(252, 114, 17, 255))
    L.paste(im, (TX, TY), tmask)
    d.rounded_rectangle((TX + TW - 190, TY + TH - 86, TX + TW - 24, TY + TH - 24), 20, fill=(10, 10, 14, 200))
    d.text((TX + TW - 107, TY + TH - 55), 'עופר'[::-1], font=FONT, fill=(255, 255, 255, 255), anchor='mm')
    return np.asarray(L, np.float32) / 255
PUNCH = np.asarray(Image.open(P('t', 'punch.png')).convert('RGBA'), np.float32) / 255

N = int(round(T_OUT * FPS)) + len(outro)
os.makedirs(P('out'), exist_ok=True); vout = P('out', 'hook-video-only.mp4')
pr = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                       '-c:v', 'libx264', '-crf', '17', '-preset', 'slow', '-pix_fmt', 'yuv420p', vout], stdin=subprocess.PIPE)
for i in range(N):
    t = i / FPS
    if t < T_Q:
        fr = hook[min(i, len(hook) - 1)]; u = max(0, (t - (T_Q - 0.35)) / 0.35)
        fr = push(Image.fromarray(fr), u, 1.0, 1.12) if u > 0 else fr.astype(np.float32) / 255
    elif t < T_STORY:   # the sketch keeps playing behind the question, blurred and dim (one piece, no hard jump)
        k = min(len(hook_more) - 1, int((t - T_Q) * FPS))
        b = Image.fromarray(hook_more[k]).filter(ImageFilter.GaussianBlur(min(28, 4 + 120 * (t - T_Q))))
        fr = push(ImageEnhance.Brightness(b).enhance(max(0.35, 1 - 3 * (t - T_Q))), 0.3 + (t - T_Q) / 1.5, 1.12, 1.18)
        fr = pop(fr, Q, (t - T_Q) / 0.18)
    elif t < T_PUN:
        fr = story[min(len(story) - 1, int(round((t - T_STORY) * FPS)))].astype(np.float32) / 255
    elif t < T_OUT:     # the end card stays (dimmed); Ofer pops in as a Syncs speaker tile, his line as subtitles
        e = ease(min(1, (t - T_PUN) / 0.2)); fr = END * (1 - 0.6 * e)
        fr = pop(fr, ofer_tile(int((t - T_PUN) * FPS)), (t - T_PUN) / 0.2, 0.85)
        al = PUNCH[..., 3:4] * e; fr = fr * (1 - al) + PUNCH[..., :3] * al
    else: fr = outro[min(len(outro) - 1, i - int(round(T_OUT * FPS)))].astype(np.float32) / 255
    pr.stdin.write((np.clip(fr, 0, 1) * 255).astype(np.uint8).tobytes())
pr.stdin.close(); pr.wait()
DUR = N / FPS

ms = lambda s: int(s * 1000)
dl = lambda s: f'adelay={ms(s)}|{ms(s)}'
inputs = ['-i', vout, '-i', P('src', 'ronit-joins.mp4'), '-i', P('music', 'corp.mp3'), '-i', f'{SV}/verse-only.mp4',
          '-i', f'{SV}/source/sfx-whoosh.wav', '-i', f'{SV}/source/sfx-ting.mp3', '-i', P('src', 'follow-up.mp4')]
mend = T_PUN + 1.6
flt = [f'[1:a]atrim={HOOK[0]}:{HOOK[1]},asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st={HOOK[1]-HOOK[0]-0.04}:d=0.04,volume=1.25[hk]',
       f"[2:a]atrim={M_FROM}:{M_FROM + mend},asetpts=PTS-STARTPTS,volume='if(lt(t,{T_Q - 0.05}),0.22,0.9)':eval=frame,volume='if(gt(t,{T_PUN}),0.5,1)':eval=frame,afade=t=out:st={mend - 0.8}:d=0.8[m]",
       f'[3:a]volume=0.9,{dl(T_OUT)}[ao]', f'[4:a]volume=0.55,{dl(T_Q - 0.25)}[wh]', f'[5:a]volume=0.7,{dl(T_NOW)}[tg]',
       f'[6:a]atrim={PUN[0]}:{PUN[1]},asetpts=PTS-STARTPTS,afade=t=in:d=0.03,afade=t=out:st={PUN[1]-PUN[0]-0.05}:d=0.05,apad=pad_dur=0.6,aecho=0.85:0.6:90:0.18,volume=1.4,{dl(T_PUN)}[pn]']
labs = ['[hk]', '[m]', '[ao]', '[wh]', '[tg]', '[pn]']
flt.append(''.join(labs) + f'amix=inputs={len(labs)}:normalize=0,alimiter=limit=0.92,atrim=0:{DUR}[a]')
final = P('out', 'syncs-hook-teaser.mp4')
subprocess.run(['ffmpeg', '-y', '-v', 'error', *inputs, '-filter_complex', ';'.join(flt), '-map', '0:v', '-map', '[a]',
                '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', final], check=True)
print('wrote', final, f'{DUR:.1f}s')
