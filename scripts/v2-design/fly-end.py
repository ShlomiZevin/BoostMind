# The flight game's ending clip (verse/fly.js): the teaser's own moment where the word turns onto the planet's ring, played
# to the END of the animation (his note 2026-11-07: "the reveal ends suddenly"). The teaser (zoomcut/episodes/shlomiverse-intro,
# out/shlomiverse-intro-v4-story.mp4 - flight.mp4 is its 540 px copy) turns the word on by 9.1 s, then the locked logo's flare
# and glow settle until ~12.5 s - but from 10.6 s its tagline, address and "פרטים בביו" fade in UNDER the logo. So from 10.4 s
# the text rows are painted out (OpenCV inpaint with a mask of the text as it stands at the end), the glow keeps settling.
#   python scripts/v2-design/fly-end.py  -> v2/site/verse/art/fly-end.mp4 (360x640, silent) + fly-land.mp3 (its music, mono)
import subprocess, numpy as np, cv2, os
SRC = 'C:/workspace/BoostMind/zoomcut/episodes/shlomiverse-intro/out/shlomiverse-intro-v4-story.mp4'
ART = 'C:/workspace/BoostMind/v2/site/verse/art/'
T0, T1, CLEAN = 7.4, 13.0, 10.4          # the clip; from CLEAN on, the text rows are painted out
W, H = 540, 960

def frames(t0, dur):
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-ss', str(t0), '-i', SRC, '-t', str(dur), '-vf', f'scale={W}:{H}', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'], stdout=subprocess.PIPE)
    while True:
        b = p.stdout.read(W * H * 3)
        if len(b) < W * H * 3: break
        yield np.frombuffer(b, np.uint8).reshape(H, W, 3)

# the text as it stands at the very end (all three lines on), in the rows under the logo
last = list(frames(14.3, 0.1))[0]
g = cv2.cvtColor(last, cv2.COLOR_BGR2GRAY).astype(np.int16)
bg = cv2.medianBlur(last, 21); gb = cv2.cvtColor(bg, cv2.COLOR_BGR2GRAY).astype(np.int16)
mask = ((g - gb) > 18).astype(np.uint8) * 255
mask[:610] = 0; mask[820:] = 0
mask = cv2.dilate(mask, np.ones((5, 5), np.uint8), iterations=2)
cv2.imwrite('C:/Users/shazbak/AppData/Local/Temp/claude/c--workspace-BoostMind/2b909074-3c8a-43f4-bdbb-2f2d5ceb7904/scratchpad/fly/frames/end-mask.png', mask)

enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', '24', '-i', '-',
                        '-vf', 'scale=360:640', '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-pix_fmt', 'yuv420p', '-profile:v', 'main',
                        '-movflags', '+faststart', ART + 'fly-end.mp4'], stdin=subprocess.PIPE)
n = 0
for i, f in enumerate(frames(T0, T1 - T0)):
    t = T0 + i / 24
    if t >= CLEAN: f = cv2.inpaint(f, mask, 6, cv2.INPAINT_TELEA)
    enc.stdin.write(np.ascontiguousarray(f).tobytes()); n += 1
enc.stdin.close(); enc.wait()
# its music: the same bars, to the end of the settle, faded
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(T0), '-i', SRC, '-t', str(T1 - T0 + 0.8), '-vn', '-ac', '1',
                '-af', f'afade=t=out:st={T1 - T0 - 0.6}:d=1.4', '-c:a', 'libmp3lame', '-b:a', '56k', ART + 'fly-land.mp3'], check=True)
print('frames', n, 'clip', os.path.getsize(ART + 'fly-end.mp4'), 'land', os.path.getsize(ART + 'fly-land.mp3'))
