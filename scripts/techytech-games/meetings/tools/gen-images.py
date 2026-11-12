# writes prompts/ + jobs.txt for the meetings game's pictures; run jobs with run-jobs.sh
import os, io
W = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(W, 'prompts'); os.makedirs(P, exist_ok=True)
R = os.path.join(W, 'refs').replace('\\', '/')
ART = os.path.join(W, 'art').replace('\\', '/')

STYLE = ("Polished, colourful, slightly caricatured painted mobile-game art (like a premium casual phone game), "
         "warm soft light, crisp and readable even when shown small.")
TILE = ("A square picture of {who} as seen on their own webcam in a video call: head and shoulders, centred, "
        "{pose}. Behind them: {bg}. The picture is one video-call tile of a game, so: no app interface, no text, "
        "no frame, no name label, nothing else in front. Keep the person exactly the same as in the reference photo - "
        "same face, glasses, hair, beard and clothes - just painted. " + STYLE)
LOOK = "looking at the camera with a neutral, slightly busy expression"

people = {
 'amir':   ('the man in the reference photo (Amir, a strategy VP; navy blazer, light blue shirt)', 'a corner office high in a Tel Aviv glass tower, city view'),
 'ofer':   ('the man in the reference photo (Ofer, a business development VP)', 'a modern company meeting room with a glass wall'),
 'ronit':  ('the woman in the reference photo (Ronit, the COO)', 'a neat, serious office with binders and a plant'),
 'gilad':  ('the man in the reference photo (Gilad, the CEO)', 'a large CEO office with a wooden desk and awards shelf'),
 'itay':   ('the man in the reference photo (Itay, Chief of AI; dark blazer, white shirt)', 'a glass-walled company meeting room'),
 'yaniv':  ('the man in the reference photo (Yaniv, a security engineer)', 'a home office corner with cables and a server box'),
 'daniel': ('the man in the reference photo (Daniel, the technical guy; black cap, glasses, beard, t-shirt)', 'a small cluttered room in an apartment, an IKEA-style shelf, a yellow rubber duck'),
}
poses = {
 'amir-talk':  ('amir', 'talking enthusiastically, mouth open mid-sentence, one hand raised in a presenting gesture'),
 'ofer-talk':  ('ofer', 'talking, mouth open mid-sentence, nodding in agreement'),
 'ronit-talk': ('ronit', 'talking firmly, mouth open mid-sentence, one finger raised to object'),
 'gilad-talk': ('gilad', 'talking, mouth open, asking a pointed question'),
 'itay-leave': ('itay', 'in a hurry: standing up out of his chair, closing a laptop under his arm, half of him already out of the frame, looking at his watch'),
 'yaniv-mouse':('yaniv', 'holding up a strange curved ergonomic mouse to the camera, annoyed, refusing'),
 'daniel-hand':('daniel', 'politely raising one hand to ask to speak, hopeful'),
 'daniel-try': ('daniel', 'mouth open trying to say something, one hand slightly up, being ignored'),
}
staff = {
 'yotam': ('yotam', 'a super-geek senior AI engineer', 'a desk with three monitors and figurines'),
 'osnat': ('osnat', 'the head of people / recruiter', 'a bright HR office with a motivational poster (no words)'),
 'tzvika':('dino', 'a veteran core-platform team lead', 'an old office with an ancient computer and stacks of manuals'),
 'vova':  ('vova', 'the infrastructure and DevOps lead', 'a dim room with server racks'),
 'erez':  ('erez', 'the data-science team lead', 'a whiteboard full of charts'),
 'ido':   ('ido', 'a senior backend developer', 'a home office with a mechanical keyboard and a plant'),
 'lior':  ('sales', 'the global sales VP', 'a hotel room abroad, travel bag behind'),
 'rami':  ('arch', 'the chief architect', 'an office with architecture diagrams on the wall'),
 'yoav':  ('vprd', 'the R&D VP', 'a tidy office with a bookshelf'),
}
jobs = []
def job(name, model, quality, size, refs, prompt, transparent=False):
    pf = os.path.join(P, name + '.txt')
    io.open(pf, 'w', encoding='utf-8').write(prompt)
    jobs.append('|'.join([name, model, quality, size, ','.join(refs), '1' if transparent else '0', pf.replace('\\', '/')]))

for k, (who, bg) in people.items():
    job(k, 'sunburst', 'high', '1024x1024', [f'{R}/{k}.jpg'], TILE.format(who=who, pose=LOOK, bg=bg))
for k, (base, pose) in poses.items():
    who, bg = people[base]
    job(k, 'sunburst', 'high', '1024x1024', [f'{R}/{base}.jpg'], TILE.format(who=who, pose=pose, bg=bg))
for k, (ref, role, bg) in staff.items():
    job(k, 'sunburst', 'medium', '1024x1024', [f'{R}/{ref}.jpg'],
        TILE.format(who=f'the person in the reference photo ({role})', pose=LOOK, bg=bg))

CROWD = ("A sheet of {n} separate square webcam portraits arranged in a {g} grid with wide plain white gaps between them, "
         "each one a different office worker of an Israeli enterprise software company on their own video call: head and "
         "shoulders, centred, their own home or office behind them. Varied men and women, ages 25-60, varied hair, "
         "skin tones, glasses or not, casual and business clothes. {extra} Every portrait a clearly different person. "
         "No text, no interface, no frames. " + STYLE)
job('crowd-sheet-1', 'flare', 'medium', '1536x1024', [], CROWD.format(n=12, g='4 columns by 3 rows', extra='All looking at the camera calmly.'))
job('crowd-sheet-2', 'flare', 'medium', '1536x1024', [], CROWD.format(n=12, g='4 columns by 3 rows', extra='All looking at the camera calmly, some smiling, some bored.'))
job('crowd-talk-sheet', 'flare', 'medium', '1536x1024', [], CROWD.format(n=8, g='4 columns by 2 rows', extra='Each one TALKING with mouth open mid-sentence, some gesturing.'))
job('asleep', 'flare', 'medium', '1024x1024', [], TILE.format(who='an office worker', pose='fallen asleep in front of the camera, head tilted back, mouth open', bg='a home office in the evening'))
job('noone', 'flare', 'medium', '1024x1024', [], "A square webcam view of a home office with an empty desk chair - the camera is on but nobody is there. No text, no interface. " + STYLE)

job('hub', 'flare', 'medium', '1024x1536', [], "An upright desktop wallpaper for a laptop of an enterprise software company called Techy-Tech: a calm, "
    "beautiful view from a high office in Petah Tikva at golden hour, soft blue sky. Empty, quiet space in the middle "
    "(three app icons will be placed there later - do not paint icons). No text, no logos. " + STYLE)
ICON = ("A single rounded-square mobile app icon for an invented video-call app, {d}. Glossy, friendly, bold, centred, "
        "filling the picture, transparent background around the icon. No text, no letters, not any real brand. " + STYLE)
job('app-zoomba', 'flare', 'medium', '1024x1024', [], ICON.format(d='bright blue with a white video camera symbol'), True)
job('app-meetly', 'flare', 'medium', '1024x1024', [], ICON.format(d='bright green with a white group-of-people symbol'), True)
job('app-teamz', 'flare', 'medium', '1024x1024', [], ICON.format(d='purple with white nodes connected by lines'), True)
job('title', 'sunburst', 'high', '1536x1024', [f'{ART}/concept.png'],
    "Title lettering for a mobile game, painted, in the colourful style of the reference picture: the Hebrew words "
    "\"אז אנחנו מסונכרנים\" (exactly these letters, right to left: א ז / א נ ח נ ו / מ ס ו נ כ ר נ י ם), "
    "big, bold, fun corporate style, with a small video-call camera accent. Only the lettering, transparent background, "
    "nothing else.", True)
COV = ("A painted game cover: a big video-call grid of the management of an enterprise software company. The people "
       "in the reference photos are the cast, painted as the same recognisable people in polished game art: reference "
       "1 Amir (in the centre tile, biggest, talking confidently), 2 Ofer nodding, 3 Ronit objecting, 4 Gilad the CEO "
       "unimpressed, 5 Itay standing up in a hurry, 6 Yaniv holding a weird ergonomic mouse, 7 Daniel with his hand "
       "raised trying to talk. Funny, colourful, inviting. {extra} No words, no letters anywhere. " + STYLE)
castrefs = [f'{R}/{x}.jpg' for x in ['amir', 'ofer', 'ronit', 'gilad', 'itay', 'yaniv', 'daniel']]
job('cover', 'sunburst', 'high', '1536x1024', castrefs, COV.format(extra='Wide picture.'))
job('hero', 'sunburst', 'high', '1024x1536', castrefs, COV.format(extra='Upright picture; keep the top fifth calm and empty for a title.'))

io.open(os.path.join(W, 'jobs.txt'), 'w', encoding='utf-8').write('\n'.join(jobs) + '\n')
print(len(jobs), 'jobs')
