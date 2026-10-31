# BoostMind - the Shlomiverse | שלומי זוין

This repo and its Firebase project (`boostmind-b052c`) are **the Shlomiverse**: Shlomi's comedy world and the business
built on it - the links page (his bio link), the characters' wiki, the characters' sites, Hani's games, the stats, and
Sketch Studio (`zoomcut/`), the editor he makes his videos with.

**Client proposals are no longer here.** Since 2026-10-31 they live in their own repo and project:
`c:\workspace\boostart` → `https://pro.boostart.io/` (Firebase `boostart-pro`). Proposal and outreach work - XPLACE
messages, the Boostart "about me" page, the `proposal-doc` skill, `shlomi-zevin-profile.md` - happens there; read its
CLAUDE.md. The old `boostmind-b052c.web.app/boostart/` and old proposal links redirect there (`firebase.json`).

The project will get its own `.co.il` domain (Shlomi is buying it). Push notifications and the "add to home screen"
app wait for that domain, because both belong to one web address.

## Wholos - a separate workstream, for now

הריפו הזה מכיל גם את **Wholos** (אפליקציית האימונים והתזונה) ואת השיווק שלה. היא עוברת לפרויקט משלה בשלב נפרד
(יש לה משתמשים - זהירות). עד אז היא כאן, והכתובת הראשית `/` עדיין פותחת אותה.

- `MARKETING.md` — **onboarding מלא לסשן שיווק של Wholos.** מי אתה, מה המוצר,
  הכללים, הכלים, הפייפליינים, לוח המשימות והמלכודות. לקרוא לפני כל עבודת שיווק.
- `BRAND-PLAYBOOK.md` — מה לעשות כששם המותג, המסר או כרטיס השיתוף משתנים.
- `matzav-marketing/LEONARDO.md` — יצירת תמונות: מודלים, מחירים, ואיך עברית נשברת.

## A new page or site - every session, every time

Shlomi found new sites missing from his lists because some sessions never added them. **A new page under
`public/` (or a site elsewhere) is not done until it is listed:**
- **/all/** - his private index of everything: `python scripts/all/catalog.py`, then
  `firebase deploy --only functions:stats` from `techietech-api/`.
- **A character's site / part of his comedy world (the Shlomiverse):** also the sites strip of the links page
  (`public/links/index.html`), the character's profile in Sketch Studio (`site.url`) and its world in
  `zoomcut/characters/index.json`, and the sites table in `zoomcut/skill/edit-video/wiki.md`.
- **A finished video** reaches the wiki and the links page by itself when it is published from Sketch Studio
  (a "Shlomiverse" job); one that missed it: `python scripts/wiki/publish_site.py <episode-id>`.

## Deploy

```bash
bash scripts/deploy.sh
```

One step, about 20 seconds: it pulls Hani's games from live first (they are released from another machine -
`scripts/hani_games_pull.py`, downloads only what changed), deploys hosting, and checks the games' no-cache header.
Never run a bare `firebase deploy --only hosting` here - it can put old game files back.

Other sessions deploy this same folder, so a draft waiting for Shlomi's approval stays out of `public/`.
