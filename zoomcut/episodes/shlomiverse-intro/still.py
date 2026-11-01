# Story (1080x1920) and post (1080x1350) pictures: a space backdrop, the REAL logo (logo-512.png, never redrawn),
# its glow and a light streak, the tagline and the address.
#   python still.py [backdrop.jpg] [name]   -> out/shlomiverse-<name>-story.jpg / -post.jpg
import os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
LOGO = 'C:/workspace/BoostMind/v2/site/verse/logo-512.png'
FONT = 'C:/Windows/Fonts/Heebo-VariableFont_wght.ttf'
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'media/backdrop-gpt.jpg')
NAME = sys.argv[2] if len(sys.argv) > 2 else 'still'
TAG, URL, BIO = 'אנשים אמיתיים. יקום מקביל.', 'shlomiverse.com', 'פרטים בביו'

def round_portrait(name, D):
    # a character's face in a circle with the logo's orange rim and glow (same as the video's flyers)
    im = Image.open(f'C:/workspace/BoostMind/public/wiki/img/c/{name}.jpg').convert('RGB')
    s = im.width * 0.86; cx, cy = im.width / 2, im.height * 0.40
    face = im.crop((int(cx - s / 2), int(cy - s / 2), int(cx + s / 2), int(cy + s / 2))).resize((int(D * 0.80), int(D * 0.80)), Image.LANCZOS)
    out = np.zeros((D, D, 4), np.float32)
    yy_, xx_ = np.mgrid[0:D, 0:D].astype(np.float32); r = np.sqrt((xx_ - D / 2) ** 2 + (yy_ - D / 2) ** 2) / (D * 0.40)
    out[..., :3] = np.array([1.0, 0.42, 0.10]); out[..., 3] = np.exp(-((r - 1.0) / 0.12) ** 2) * (r > 1.0) * 0.85
    rim = np.clip(1 - np.abs(r - 0.985) / 0.03, 0, 1)
    out[..., :3] = out[..., :3] * (1 - rim[..., None]) + np.array([1.0, 0.62, 0.25]) * rim[..., None]
    out[..., 3] = np.maximum(out[..., 3], rim)
    f = np.zeros((D, D, 3), np.float32); o = int(D * 0.10)
    f[o:o + face.height, o:o + face.width] = np.asarray(face).astype(np.float32) / 255
    inside = np.clip((0.965 - r) / 0.01, 0, 1)[..., None]
    out[..., :3] = out[..., :3] * (1 - inside) + f * inside
    out[..., 3] = np.maximum(out[..., 3], inside[..., 0])
    return out

def text_layer(txt, size, weight, color, spacing=0, rtl=False):
    f = ImageFont.truetype(FONT, size); f.set_variation_by_axes([weight])
    s = txt[::-1] if rtl else txt            # no RTL shaping in this PIL: Hebrew laid out right to left by hand
    widths = [f.getlength(ch) for ch in s]
    tw = int(sum(widths) + spacing * (len(s) - 1)) + 40
    im = Image.new('RGBA', (tw, int(size * 1.7)), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    x = 20
    for ch, w_ in zip(s, widths):
        d.text((x, size * 0.25), ch, font=f, fill=color); x += w_ + spacing
    return np.asarray(im).astype(np.float32) / 255

def cover(img, w, h, focus_y=0.5):
    s = max(w / img.width, h / img.height)
    im = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    x0 = (im.width - w) // 2; y0 = int((im.height - h) * focus_y)
    return np.asarray(im.crop((x0, y0, x0 + w, y0 + h)).convert('RGB')).astype(np.float32) / 255

def over(dst, rgba, cx, cy, alpha=1.0):
    h, w = rgba.shape[:2]; x0, y0 = int(round(cx - w / 2)), int(round(cy - h / 2))
    a = rgba[..., 3:4] * alpha
    dst[y0:y0 + h, x0:x0 + w] = dst[y0:y0 + h, x0:x0 + w] * (1 - a) + rgba[..., :3] * a

def screen(dst, add):
    return 1 - (1 - dst) * (1 - np.clip(add, 0, 1))

def make(W, H, logo_w, logo_cy, tag_y, url_y, tag_size, url_size, out, faces=(), bio_y=None):
    img = cover(Image.open(SRC), W, H)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    cx = W / 2
    # warm light behind the planet
    r = np.sqrt(((xx - cx) / (logo_w * 0.62)) ** 2 + ((yy - logo_cy) / (logo_w * 0.72)) ** 2)
    img = screen(img, np.exp(-r ** 2 * 1.4)[..., None] * np.array([0.34, 0.10, 0.02]))
    lg = Image.open(LOGO).convert('RGBA')
    lg = lg.resize((logo_w, round(lg.height * logo_w / lg.width)), Image.LANCZOS)
    la = np.asarray(lg).astype(np.float32) / 255
    # glow of the logo itself, then the logo on top
    # (blurred on the whole canvas, so the glow is never cut at the logo picture's edge)
    h, w = la.shape[:2]; x0, y0 = int(cx - w / 2), int(logo_cy - h / 2)
    src = np.zeros((H, W, 3), np.float32); src[y0:y0 + h, x0:x0 + w] = la[..., :3] * la[..., 3:4]
    g = Image.fromarray((src * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(logo_w * 0.045))
    gl = np.asarray(g).astype(np.float32) / 255
    img = screen(img, gl * 0.55)
    # a thin anamorphic light streak through the planet
    st = (np.exp(-((yy - logo_cy) / 3.0) ** 2) * np.exp(-((xx - cx) / (W * 0.55)) ** 2) * 0.55 +
          np.exp(-((yy - logo_cy) / 16.0) ** 2) * np.exp(-((xx - cx) / (W * 0.3)) ** 2) * 0.18)
    img = screen(img, st[..., None] * np.array([1.0, 0.6, 0.25]))
    for name, fx, fy, d, dim in faces:     # farther ones smaller and dimmer, like the video's field of faces
        pr = round_portrait(name, d); pr[..., :3] *= dim
        over(img, pr, fx, fy)
    over(img, la, cx, logo_cy)
    over(img, text_layer(TAG, tag_size, 700, (255, 255, 255, 255), rtl=True), cx, tag_y)
    over(img, text_layer(URL, url_size, 600, (255, 122, 48, 255), spacing=4), cx, url_y)
    if bio_y: over(img, text_layer(BIO, tag_size - 6, 700, (255, 255, 255, 255), rtl=True), cx, bio_y)
    Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)).save(out, quality=95)
    print(out)

os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
# story: logo at ~43%, text under it, faces around; the bottom 15% left free of text (Instagram's reply bar)
STORY_FACES = [('rosenblum', 175, 255, 230, 1.0), ('hani', 540, 170, 180, 0.85), ('demokratovich', 905, 265, 240, 1.0),
               ('ayelet', 345, 455, 140, 0.7), ('dorit', 745, 440, 150, 0.72),
               ('yotam', 140, 1185, 190, 0.9), ('osnat', 945, 1190, 200, 0.92), ('avram', 255, 1760, 180, 0.8), ('savta', 835, 1765, 190, 0.82)]
POST_FACES = [('rosenblum', 135, 150, 200, 1.0), ('hani', 540, 92, 130, 0.8), ('demokratovich', 945, 150, 210, 1.0),
              ('yotam', 110, 1230, 160, 0.85), ('osnat', 970, 1230, 170, 0.88)]
make(1080, 1920, 900, 830, 1340, 1440, 70, 52, os.path.join(HERE, f'out/shlomiverse-{NAME}-story.jpg'), STORY_FACES, 1545)
make(1080, 1350, 700, 520, 955, 1040, 60, 46, os.path.join(HERE, f'out/shlomiverse-{NAME}-post.jpg'), POST_FACES, 1122)
