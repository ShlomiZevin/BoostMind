# a private draft bundle for a claude.ai artifact (his phone) - same game, site-wide paths copied in
import os, re, shutil, sys
SRC = 'public/naomi-games/pause'; OUT = sys.argv[1]
shutil.rmtree(OUT, ignore_errors=True); shutil.copytree(SRC, OUT, ignore=shutil.ignore_patterns('game.json', 'cover.jpg'))
shutil.copy('public/dr-naomi/brand/mark.webp', f'{OUT}/assets/brand-mark.webp')
shutil.copy('public/verse/logo-512.png', f'{OUT}/assets/ui/verse-logo.png')
s = open(f'{SRC}/index.html', encoding='utf-8').read()
s = s.replace('/dr-naomi/brand/mark.webp', 'assets/brand-mark.webp').replace('/verse/logo-512.png', 'assets/ui/verse-logo.png')
s = s.replace('href="/games" target="_top"', 'href="https://shlomiverse.com/games" target="_blank"')
s = re.sub(r'<script src="/t\.js"[^>]*></script>\n?', '', s); s = re.sub(r'<script src="/verse/game-frame\.js"></script>\n?', '', s)
s = re.sub(r'<!doctype html>\n?|<html[^>]*>\n?|</html>\n?|<head>\n?|</head>\n?|<body>\n?|</body>\n?', '', s)
s = s.replace('<meta charset="utf-8">\n', '').replace('<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">\n', '')
s = s.replace('<title>השהיית תגובה – ד״ר נעמי־ציפורה</title>', '<title>השהיית תגובה</title>\n<script>document.documentElement.lang="he";document.documentElement.dir="rtl";</script>')
open(f'{OUT}/index.html', 'w', encoding='utf-8').write(s)
files = [os.path.relpath(os.path.join(d, f), OUT).replace(chr(92), '/') for d, _, fs in os.walk(OUT) for f in fs if f != 'index.html']
print(len(files), sum(os.path.getsize(os.path.join(OUT, f)) for f in files) // 1024, 'KB'); print('\n'.join(files))
