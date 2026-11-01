# Key frames for the AI-video tries and the stills: the REAL logo (logo-512.png) on the deep-space backdrop.
#   python make_frames.py  -> media/frame-logo.jpg (logo, 9:16), media/frame-space.jpg (empty space + a faint far glow)
# The logo's place is shared with comp.py (LOGO_CX, LOGO_CY, LOGO_W) so a composited logo lands exactly on it.
import os, numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
LOGO = 'C:/workspace/BoostMind/v2/site/verse/logo-512.png'
BG = os.path.join(HERE, 'out/bg/0420.png')      # Blender's empty sky (stars + faint nebula), 1080x1920
W, H = 1080, 1920
LOGO_W, LOGO_CX, LOGO_CY = 860, 540, 860        # story layout: logo a bit above the middle, text below it

def backdrop(glow=1.0):
    bg = np.asarray(Image.open(BG).convert('RGB')).astype(np.float32) / 255
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    # warm haze behind the logo + a faint wide nebula, the brand's orange
    r = np.sqrt(((xx - LOGO_CX) / 520) ** 2 + ((yy - LOGO_CY) / 640) ** 2)
    haze = np.exp(-r ** 2 * 1.6)[..., None] * np.array([0.30, 0.085, 0.015]) * glow
    rng = np.random.default_rng(3)
    neb = Image.fromarray((rng.random((24, 14)) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(60))
    neb = (np.asarray(neb).astype(np.float32) / 255) ** 3
    nebc = neb[..., None] * np.array([0.30, 0.07, 0.10]) * 0.6
    out = 1 - (1 - bg) * (1 - haze) * (1 - nebc)          # screen blend
    return np.clip(out, 0, 1)

def logo_rgba(width=LOGO_W):
    lg = Image.open(LOGO).convert('RGBA')
    h = round(lg.height * width / lg.width)
    return lg.resize((width, h), Image.LANCZOS)

def paste_logo(img01, width=LOGO_W, cx=LOGO_CX, cy=LOGO_CY, alpha=1.0):
    lg = np.asarray(logo_rgba(width)).astype(np.float32) / 255
    h, w = lg.shape[:2]
    x0, y0 = int(round(cx - w / 2)), int(round(cy - h / 2))
    out = img01.copy()
    a = lg[..., 3:4] * alpha
    region = out[y0:y0 + h, x0:x0 + w]
    out[y0:y0 + h, x0:x0 + w] = region * (1 - a) + lg[..., :3] * a
    return out

def save(img01, path, q=94):
    Image.fromarray((np.clip(img01, 0, 1) * 255).astype(np.uint8)).save(path, quality=q)

if __name__ == '__main__':
    os.makedirs(os.path.join(HERE, 'media'), exist_ok=True)
    save(paste_logo(backdrop()), os.path.join(HERE, 'media/frame-logo.jpg'))
    # empty space with a tiny far-away orange glow where the planet will come from
    sp = backdrop(glow=0.25)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt((xx - LOGO_CX) ** 2 + (yy - LOGO_CY) ** 2)
    sp = 1 - (1 - sp) * (1 - (np.exp(-(d / 10) ** 2) * 0.9 + np.exp(-(d / 60) ** 2) * 0.25)[..., None] * np.array([1.0, 0.45, 0.12]))
    save(sp, os.path.join(HERE, 'media/frame-space.jpg'))
    print('ok')
