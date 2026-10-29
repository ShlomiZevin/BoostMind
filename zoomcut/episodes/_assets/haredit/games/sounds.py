# The Hani sound pack for the games (/hani-games/sounds/): the sounds of haredit-1/2, level-matched mp3s + sounds.json.
# Brachi and the mumble are the phone versions the videos play (the studio's cached renders: phone filter, pitch, tempo).
import json, os, subprocess
A = 'zoomcut/episodes/_assets'; C = f'{A}/haredit/calls'; OUT = 'public/hani-games/sounds'
BRACHI = ['אמא, מלכי שוב מטפסת. אני אומרת לה לרדת והיא לא מקשיבה לי.', 'על השיש במטבח!', 'אני מנסה, אמא! אני מושכת אותה ביד והיא לא רוצה לרדת!',
  'אמא, היא עדיין לא יורדת. ויענקי הוציא את כל האבני בניין... ושרולי קורא לי מהחדר... אמא, את שומעת אותי?', 'אמא, שרולי עכשיו מטפס על הארון!',
  'מטפס על הארון בחדר!', 'כן! הוא מחפש את העיגוליות!', 'אבל אמא, זה פרווה.', 'כן, יענקי! הוא דרך על האבני בניין ועכשיו כואב לו!',
  'הוא רוצה להתקלח, אבל הוא אומר שהוא לא יכול לבד עם הגבס.', 'הוא עוד לא חזר מהכולל, התקשרתי אליו והוא לא עונה.', 'טוב, אמא, מתי את חוזרת?',
  'טוב, אמא, ביי!', 'אמא, שרולי נפל במקלחת!', 'כן, הוא החליק עם הגבס, והוא צועק לי שאני אבוא, אבל הכל מים.', 'טוב, אמא, אבל הוא לא מצליח לקום.',
  'ועכשיו מלכי בוכה, והיא רוצה רק אותך, ויענקי לקח לי את הכיסא... אמא? אמא! למה את לא עונה לי?', 'יענקי!']
S = [  # id, source, group, label, loop
  ('phone-ring', f'{A}/haredit/kosher-ring.mp3', 'phone', 'הפלאפון הכשר מצלצל', False),
  ('phone-ring-2', f'{A}/haredit/kosher-ring-b.mp3', 'phone', 'הפלאפון הכשר מצלצל (גרסה ב׳)', False),
  ('mumble-phone', f'{A}/gym/sigal-mumble.mp3.phone.p1.2.wav', 'phone', 'מלמול בצד השני של הטלפון (בלי מילים אמיתיות)', False),
] + [(f'brachi-{i:02d}', (f'{C}/brachi-r{i:02d}.mp3.phone.p1.7.t1.3.wav' if os.path.exists(f'{C}/brachi-r{i:02d}.mp3.phone.p1.7.t1.3.wav') else f'{C}/brachi-r{i:02d}.mp3.phone.p1.7.wav'),
       'brachi', f'ברכי בטלפון: ״{t}״', False) for i, t in enumerate(BRACHI, 1)] + [
  ('kids-ima-1', f'{C}/ima-dry.mp3', 'kids', 'ילד קורא ״אמא! אמא!״', False),
  ('kids-ima-2', f'{C}/ima-far-1.mp3', 'kids', '״אמא! אמא!״ מהחדר השני', False),
  ('kids-ima-3', f'{C}/ima-far-2.mp3', 'kids', '״אמא! אמא!״ מרחוק', False),
  ('kids-ma-ma', f'{C}/mommy-far.mp3', 'kids', '״מה? מה?״ מרחוק', False),
  ('malki-wail', f'{C}/malki-wail.mp3', 'kids', 'מלכי בוכה (יללה ארוכה)', False),
  ('yanky-cry', f'{C}/yanky-cry.mp3', 'kids', 'יענקי בוכה (דרך על האבני בניין)', False),
  ('climb-oy', f'{C}/climb.mp3', 'kids', 'ילד מטפס ונאנח', False),
  ('crash', f'{C}/crash.mp3', 'house', 'משהו נופל ומתנפץ', False),
  ('cookie-tin', f'{C}/cookie-tin.mp3', 'house', 'קופסת העיגוליות נפתחת', False),
  ('shower', f'{C}/shower.mp3', 'house', 'מקלחת נפתחת', False),
  ('shower-loop', f'{C}/shower-loop.mp3', 'house', 'מים זורמים במקלחת (לולאה)', True),
  ('house-ambience', f'{C}/house-bed.mp3', 'ambience', 'רקע של בית מלא ילדים (לולאה)', True),
  ('office-ambience', f'{A}/haredit/office-room.mp3', 'ambience', 'רקע של משרד ההייטק (לולאה, 22 שניות)', True),
  ('office-ambience-long', f'{A}/haredit/office-room-long.mp3', 'ambience', 'רקע של משרד ההייטק (לולאה, 2 דקות)', True),
  ('niggun-freilach', 'zoomcut/episodes/haredit-2/media/music-hasidic-freilach.mp3', 'music', 'ניגון חסידי שמח, כלי בלבד', True),
]
GROUPS = {'phone': 'הפלאפון הכשר', 'brachi': 'ברכי מתקשרת', 'kids': 'הילדים', 'house': 'הבית', 'ambience': 'רקעים', 'music': 'מוזיקה'}
os.makedirs(OUT, exist_ok=True); items = []
for sid, src, g, label, loop in S:
    out = f'{OUT}/{sid}.mp3'
    lvl = 'loudnorm=I=-20:TP=-2' if g in ('ambience', 'music') or loop else 'loudnorm=I=-16:TP=-1.5'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', lvl, '-ac', '1', '-ar', '44100', '-b:a', '128k', out], check=True)
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out], capture_output=True, text=True).stdout)
    items.append({'id': sid, 'file': f'{sid}.mp3', 'group': g, 'label': label, 'seconds': round(dur, 2), 'loop': loop})
json.dump({'base': 'https://boostmind-b052c.web.app/hani-games/sounds/', 'groups': GROUPS, 'sounds': items},
          open(f'{OUT}/sounds.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(items), 'sounds')
