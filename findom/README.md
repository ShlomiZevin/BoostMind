# Veyra

A simple site of AI queens: see the queens, pick one, her page, chat with her, her Telegram.
Static site (vanilla HTML/CSS/JS). Firebase Hosting + Firestore later; no server of its own.

```
web/                 the site (Firebase Hosting public dir)
  index.html         home: all queens
  queen.html?q=<id>  queen page: photos, bio, chat button, Telegram, tribute prices
  chat.html?q=<id>   chat: queen list, conversation, tribute sheet, Telegram
  css/veyra.css      the whole design system (dark default, light via toggle)
  js/app.js          config, theme, age gate, tribute sheet, icons
  js/chat.js         chat page; getReply() is the single integration point
  js/queens.js       GENERATED from data/queens.json
data/queens.json     source of truth for queens (Firestore seed later)
scripts/             image generation, image optimisation, queens.js build
brief/               model briefs and answers (SOL/Terra copy, image prompts)
design/              design mockups the site was built from (design/v3)
```

## Run locally

```bash
python -m http.server 5055 -d web   # open http://localhost:5055  (avoid `npx serve`: its clean-URL redirect drops ?q=)
```

## Connect the chat service

Set `chatEndpoint` in `web/js/app.js`:

```js
window.VEYRA_CONFIG = { chatEndpoint: 'https://…/reply', demoTributes: true };
```

Request: `POST { queenId, messages: [{ role: "user" | "queen", text }] }` → `{ reply: "..." }`.
Until it is set, the queens answer with placeholder lines from `lines` in `data/queens.json`.
Chat history lives in the browser (`localStorage`, key `veyra.chat.<id>`).

## Payments

Not connected. With `demoTributes: true` a tribute is recorded locally and marked
"preview — no charge". The payment provider hooks into `tributeSheet()` in `app.js`.
Stripe/PayPal do not accept this category; it needs a high-risk / adult processor.

## Add or edit a queen

1. Edit `data/queens.json` (copy an existing entry).
2. Images: `web/img/queens/<id>-card|avatar|g1..g4.jpg`. Generate with
   `node scripts/oai-image.mjs --batch <jobs.json> --out-dir web/img/queens`
   (prompts in `brief/v4-*.json`), then `python scripts/optimize-images.py`.
3. `node scripts/build-queens.mjs`, then `node scripts/og.mjs` — renders her link-preview image
   (`web/og/<id>.jpg`) and her shareable page `web/<id>.html` (→ `/<id>`) with Open Graph tags.
   `queen.html` is the template for those pages; edit it, then re-run `og.mjs`.

## Deploy

Live at https://veyra-queens.web.app (Firebase project `veyra-queens`, set in `.firebaserc`).

```bash
firebase deploy --only hosting        # from findom/
```
The source PNGs in `web/img/queens/` are excluded from hosting; only the optimised JPEGs ship.
