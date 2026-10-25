"""Write the Terra brief for the fan-facing copy of the characters wiki (bios, video titles, teasers).

  python scripts/wiki/copy_brief.py [--only-missing]   -> scripts/wiki/work/copy-brief.txt
  node ~/.claude/skills/sol-leonardo/scripts/sol.js --in scripts/wiki/work/copy-brief.txt \
       --out scripts/wiki/work/copy-answer.md --model gpt-5.6-terra --env "C:/workspace/aspect/aspect-agent-server/.env"
then merge the JSON from the answer into scripts/wiki/copy.json (merge_copy.py).
"""
import json, os, sys
from canon import characters, episodes, load_json, HERE

only_missing = '--only-missing' in sys.argv
copy = load_json(os.path.join(HERE, 'copy.json'), {'characters': {}, 'videos': {}, 'worlds': {}})
chars, worlds = characters()
eps = episodes(chars)

KEEP = ('id', 'name', 'name_en', 'world', 'role', 'brief', 'personality', 'catchphrases', 'speech', 'behavior', 'themes', 'look', 'relations', 'dont')
parts = []
parts.append("""אתה קופירייטר עברי לאתר מעריצים של יקום קומי. תשובות חדות, בלי הקדמות.

הקשר: שלומי זוין עושה מערכונים קצרים בטיקטוק/אינסטגרם (40K עוקבים) עם דמויות קבועות שהקהל עוקב אחריהן שנים, כמו סדרה.
הקהל אומר לו "זה כמו המולטיוורס של שלומי". אנחנו בונים ויקי של הדמויות: מי זה מי, הסדרות, כל הסרטונים, וצ'אט שבו מדברים עם הדמויות. צנוע, בלי להתפאר.

הכלל הכי חשוב: הדמויות הן אנשים אמיתיים בתוך היקום. כותבים עליהן כמו ויקי של סדרה אהובה מבפנים, בעובדות שלהן ובביטחון שלהן.
אסור: להסביר את הבדיחה ("היא חושבת שהיא עמוקה אבל..."), "פרודיה", "סאטירה", "דמות", "מערכון", "שלומי מגלם". הקורא צריך לחייך מהעובדות עצמן.
התיאורים למטה (brief / comedy) הם מאחורי הקלעים, בשבילך בלבד - הם מסבירים את הבדיחה; אל תעתיק אותם, תתרגם אותם לעובדות מתוך העולם.
טון: עברית מדוברת, קלילה, חכמה. משפטים קצרים. בלי אימוג'ים. בלי מקפים ארוכים (—); מקף רגיל בלבד.

המשימות - החזר JSON תקין אחד בלבד בבלוק ```json, במבנה:
{
 "worlds": {"<מפתח העולם כמו שהוא>": {"title": "שם קצר", "blurb": "משפט אחד מתוך העולם"}},
 "characters": {"<id>": {"tagline": "עד 6 מילים", "bio": "2-3 משפטים, גוף שלישי, עובדות מתוך העולם", "ask": ["3 שאלות קצרות שמעריץ ישאל את הדמות בצ'אט"]}},
 "videos": {"<id>": {"title": "כותרת קצרה ומושכת", "teaser": "משפט אחד שגורם ללחוץ, בלי לספיילר את הפאנץ'"}}
}
""")
parts.append('## העולמות\n' + json.dumps(worlds, ensure_ascii=False, indent=1))
parts.append('## הדמויות')
for c in chars:
    if only_missing and c['id'] in copy['characters']:
        continue
    parts.append(json.dumps({k: c[k] for k in KEEP if k in c}, ensure_ascii=False))
parts.append('## הסרטונים (תמלול מלא)')
for e in eps:
    if only_missing and e['id'] in copy['videos']:
        continue
    parts.append(f"### {e['id']} | {e['editor_title']} | משתתפים: {', '.join(e['cast']) or '?'}\n{e['transcript'][:6000]}")

os.makedirs(os.path.join(HERE, 'work'), exist_ok=True)
out = os.path.join(HERE, 'work', 'copy-brief.txt')
with open(out, 'w', encoding='utf8') as f:
    f.write('\n\n'.join(parts))
print('wrote', out, os.path.getsize(out), 'bytes;', len(chars), 'characters,', len(eps), 'videos')
