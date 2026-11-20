# The Syncs product page mockups (syncs-page.mjs) on ONE labelled sheet: A / B / C side by side.
#   python scripts/v2-design/syncs-page-sheet.py
from PIL import Image, ImageDraw, ImageFont
D = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/syncs/'
ims = [Image.open(D + f'page-{k}.png').convert('RGB') for k in 'ABC']
w, h, pad, top = ims[0].width, ims[0].height, 40, 120
sheet = Image.new('RGB', (pad + 3 * (w + pad), top + h + pad), '#111318')
dr = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 80)
except OSError: font = ImageFont.load_default()
for i, (k, im) in enumerate(zip('ABC', ims)):
    x = pad + i * (w + pad)
    sheet.paste(im, (x, top))
    dr.text((x + w // 2, top // 2), k, fill='#ff8a1f', font=font, anchor='mm')
sheet.save(D + 'page-mockups.jpg', quality=88)
print(sheet.size)
