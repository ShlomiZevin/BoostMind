# The business strip's device picture (his notes 2026-11-10): a generated scene with pure green screens (biz-art3.mjs) filled with REAL frames -
# the home with its sponsored banner on the laptop, a strong frame of one of his videos on the phone with a small "המותג שלכם" pill.
# Any frame can be swapped: python scripts/v2-design/biz-fill.py [scene.png] [laptop.png] [phone.jpg]  ->  v2/site/verse/art/biz-media-a.jpg
import sys
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont

D = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/band/'
scene_p = sys.argv[1] if len(sys.argv) > 1 else D + 'scene-green-1.png'
lap_p = sys.argv[2] if len(sys.argv) > 2 else D + 'site-cap.png'
ph_p = sys.argv[3] if len(sys.argv) > 3 else D + 'phone-frame.jpg'
OUT = 'C:/workspace/BoostMind/v2/site/verse/art/biz-media-a.jpg'

scene = cv2.cvtColor(np.array(Image.open(scene_p).convert('RGB')), cv2.COLOR_RGB2BGR)
hsv = cv2.cvtColor(scene, cv2.COLOR_BGR2HSV)
green = cv2.inRange(hsv, (40, 120, 120), (85, 255, 255))
green = cv2.morphologyEx(green, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
n, lab, stats, _ = cv2.connectedComponentsWithStats(green)
blobs = sorted([i for i in range(1, n)], key=lambda i: -stats[i, cv2.CC_STAT_AREA])[:2]

def quad(mask):
    cs, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    c = max(cs, key=cv2.contourArea)
    hull = cv2.convexHull(c).reshape(-1, 2).astype(np.float32)
    s, d = hull.sum(1), np.diff(hull, axis=1).ravel()
    return np.array([hull[s.argmin()], hull[d.argmin()], hull[s.argmax()], hull[d.argmax()]], np.float32)   # tl, tr, br, bl

def cover(img, w, h):
    iw, ih = img.size
    sc = max(w / iw, h / ih)
    img = img.resize((int(iw * sc + 1), int(ih * sc + 1)), Image.LANCZOS)
    x, y = (img.width - w) // 2, max(0, int((img.height - h) * 0.25))
    return img.crop((x, y, x + w, y + h))

def pill(img, text):
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', int(img.width * 0.075))
    t = text[::-1]   # PIL draws left to right - reversed Hebrew reads right
    bw = d.textlength(t, font=f)
    W, H = bw + img.width * 0.09, img.width * 0.12
    x0, y0 = (img.width - W) / 2, img.width * 0.12
    d.rounded_rectangle((x0, y0, x0 + W, y0 + H), radius=H / 2, fill=(255, 255, 255))
    d.text((x0 + (W - bw) / 2, y0 + H * 0.16), t, font=f, fill=(17, 17, 20))
    return img

out = scene.copy()
for i in blobs:
    m = (lab == i).astype(np.uint8) * 255
    q = quad(m)
    w = int(max(np.linalg.norm(q[1] - q[0]), np.linalg.norm(q[2] - q[3])))
    h = int(max(np.linalg.norm(q[3] - q[0]), np.linalg.norm(q[2] - q[1])))
    is_phone = h > w
    src = Image.open(ph_p if is_phone else lap_p).convert('RGB')
    src = cover(src, w * 2, h * 2)
    if is_phone:
        src = pill(src, 'המותג שלכם')
    s = cv2.cvtColor(np.array(src), cv2.COLOR_RGB2BGR)
    M = cv2.getPerspectiveTransform(np.array([[0, 0], [s.shape[1], 0], [s.shape[1], s.shape[0]], [0, s.shape[0]]], np.float32), q)
    warped = cv2.warpPerspective(s, M, (scene.shape[1], scene.shape[0]))
    mm = cv2.dilate(m, np.ones((5, 5), np.uint8))
    mm = cv2.GaussianBlur(mm, (3, 3), 0).astype(np.float32)[..., None] / 255
    out = (warped * mm + out * (1 - mm)).astype(np.uint8)

# the green screens' glow on the desk / edges: pull green down to the warm light around it (outside the screens)
screens = np.zeros(out.shape[:2], np.uint8)
for i in blobs: screens[lab == i] = 255
screens = cv2.dilate(screens, np.ones((9, 9), np.uint8))
o = out.astype(np.int16); b_, g_, r_ = o[..., 0], o[..., 1], o[..., 2]
spill = (g_ > np.maximum(r_, b_) + 6) & (screens == 0)
o[..., 1] = np.where(spill, np.maximum(r_, b_), g_)
out = np.clip(o, 0, 255).astype(np.uint8)
img = Image.fromarray(cv2.cvtColor(out, cv2.COLOR_BGR2RGB))
img.save(D + 'biz-media-a-filled.png')
w, h = img.size
img = img.crop((0, int(h * 0.085), int(w * 0.77), int(h * 0.70)))   # wide: phone + laptop, for a short strip
img = img.resize((1180, int(img.height * 1180 / img.width)), Image.LANCZOS)
img.save(OUT, quality=84, optimize=True)
print('ok', len(blobs), 'screens ->', OUT, img.size)
