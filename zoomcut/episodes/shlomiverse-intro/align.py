# Measure how the AI clip's last frame (reversed clip end) differs from the exact logo frame: affine (ECC) + brightness.
import sys, cv2, numpy as np
sys.argv = ['x']
from make_frames import backdrop, paste_logo, W, H, LOGO_CX, LOGO_CY
logo = (paste_logo(backdrop()) * 255).astype(np.uint8)
cap = cv2.VideoCapture('media/sd-1-pullback-mini.mp4'); frames = []
while True:
    ok, f = cap.read()
    if not ok: break
    frames.append(cv2.resize(cv2.cvtColor(f, cv2.COLOR_BGR2RGB), (W, H), interpolation=cv2.INTER_LANCZOS4))
clip_end = frames[0]   # reversed -> last shown frame
def gray(a): return cv2.cvtColor(a, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255
roi = (slice(380, 1340), slice(60, 1020))
mask = np.zeros((H, W), np.uint8); mask[roi] = 255
for name, src in [('frame0', frames[0]), ('frame3', frames[3]), ('frame8', frames[8])]:
    warp = np.eye(2, 3, dtype=np.float32)
    cc, warp = cv2.findTransformECC(gray(logo), gray(src), warp, cv2.MOTION_AFFINE,
                                    (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 300, 1e-6), mask, 5)
    sx = np.hypot(warp[0, 0], warp[1, 0]); rot = np.degrees(np.arctan2(warp[1, 0], warp[0, 0]))
    # brightness: mean of planet region after alignment
    al = cv2.warpAffine(src, warp, (W, H), flags=cv2.INTER_LINEAR + cv2.WARP_INVERSE_MAP)
    m_l = logo[roi].reshape(-1, 3).mean(0); m_a = al[roi].reshape(-1, 3).mean(0)
    print(name, 'cc', round(cc, 4), 'scale', round(sx, 4), 'rot', round(rot, 3), 'shift', warp[:, 2].round(2), 'mean logo', m_l.round(1), 'clip', m_a.round(1))
    np.save(f'out/warp_{name}.npy', warp)
cv2.imwrite('out/test/align_cmp.jpg', cv2.cvtColor(np.hstack([logo[roi], frames[0][roi]]), cv2.COLOR_RGB2BGR))
