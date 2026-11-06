// The Shlomiverse's marketing emails: one look for every mail (dark, the verse's orange, Hebrew right to left), built
// from blocks, so a new game, a story, a new video, the weekly digest and the welcome mail all come from the same
// shell. Plain tables and inline styles - the only HTML every mail app (Gmail, Outlook, Apple Mail) shows the same.
// Every mail carries an unsubscribe link and the List-Unsubscribe headers (his rule, 2026-11-04: if we mail users,
// they must be able to stop it).
const crypto = require('crypto');

const SITE = 'https://shlomiverse.com';
const LOGO = SITE + '/verse/logo-512.png';
const C = { bg: '#0b0b0f', card: '#15151b', card2: '#1d1d25', line: '#2a2a33', text: '#f4f4f6', soft: '#b9b9c4', dim: '#7c7c88',
  accent: '#ff6a1f', accent2: '#ff8a3d' };
const FONT = "'Heebo','Rubik',Arial,'Helvetica Neue',Helvetica,sans-serif";

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const abs = (u) => (/^https?:/.test(u) ? u : SITE + (u.startsWith('/') ? '' : '/') + u);
// every link says which mail it came from, so the stats can tell what the mails bring
const track = (u, kind) => { const x = abs(u); return x.startsWith(SITE) ? x + (x.includes('?') ? '&' : '?') + 'utm_source=mail&utm_campaign=' + kind : x; };

// the unsubscribe link: the account's uid signed, so nobody can switch off someone else's mail
const unsubToken = (uid, key) => crypto.createHmac('sha256', key).update('mail-off:' + uid).digest('base64url').slice(0, 22);
const unsubUrl = (base, uid, key) => `${base}?u=${encodeURIComponent(uid)}&t=${unsubToken(uid, key)}`;

// ---------- blocks ----------
// Gmail (phone apps, dark mode) inverts colours, but never a background-image - so every background is also an image -
// and text goes through two blend layers that only Gmail sees (u + .body), which invert it back
const bg = (c) => `background-color:${c};background-image:linear-gradient(${c},${c})`;
const gm = (html) => `<div class="gs"><div class="gd">${html}</div></div>`;
const gmi = (html) => `<span class="gs" style="display:inline-block"><span class="gd" style="display:inline-block">${html}</span></span>`;
const pad = (inner, p = '0 32px') => `<tr><td class="${p === '0 32px' ? 'px' : ''}" style="padding:${p}">${inner}</td></tr>`;
const spacer = (h) => `<tr><td style="height:${h}px;line-height:${h}px;font-size:0">&nbsp;</td></tr>`;

const chip = (t) => `<span style="display:inline-block;${bg(C.accent)};color:#fff;font:700 13px/1 ${FONT};padding:8px 14px;border-radius:999px;letter-spacing:.3px">${gmi(esc(t))}</span>`;
const h1 = (t) => `<div style="font:800 32px/1.2 ${FONT};color:${C.text};margin:0">${gm(esc(t))}</div>`;
const h2 = (t) => `<div style="font:800 22px/1.3 ${FONT};color:${C.text};margin:0">${gm(esc(t))}</div>`;
const p = (t, size = 17) => `<div style="font:400 ${size}px/1.65 ${FONT};color:${C.soft};margin:0">${gm(esc(t))}</div>`;

// the big orange button (a table, so Outlook draws it too)
const button = (label, href) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
<td bgcolor="${C.accent}" style="border-radius:999px;background:linear-gradient(180deg,${C.accent2},${C.accent});box-shadow:0 8px 24px rgba(255,106,31,.45)">
<a href="${esc(href)}" style="display:inline-block;padding:17px 44px;font:800 19px/1 ${FONT};color:#ffffff;text-decoration:none;border-radius:999px">${gmi(esc(label))}</a></td></tr></table>`;
const ghost = (label, href) => `<a href="${esc(href)}" style="font:700 15px/1 ${FONT};color:${C.accent2};text-decoration:none">${gmi(esc(label) + ' &larr;')}</a>`;

const hero = (src, href, alt, radius = 20) => `<a href="${esc(href)}"><img src="${esc(src)}" alt="${esc(alt)}" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;border-radius:${radius}px"></a>`;

// a list of what is inside, each line with its own small emoji
const bullets = (items) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items.map(([icon, t]) => `<tr>
<td width="44" valign="top" style="padding:0 0 14px 0"><div style="width:36px;height:36px;border-radius:12px;${bg(C.card2)};text-align:center;font:20px/36px ${FONT}">${icon}</div></td>
<td valign="middle" style="padding:0 12px 14px 0;font:400 16px/1.5 ${FONT};color:${C.soft}">${gm(t)}</td></tr>`).join('')}</table>`;

// round faces with names (who is in it)
const faces = (list) => `<table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:${list.length * 76}px;table-layout:fixed"><tr>${list.map((c) => `
<td align="center" valign="top" width="${Math.floor(100 / list.length)}%" style="padding:0 2px"><a href="${esc(c.href)}" style="text-decoration:none">
<img src="${esc(c.img)}" alt="${esc(c.name)}" width="52" height="52" style="display:block;width:52px;height:52px;border-radius:50%;border:3px solid ${C.accent};object-fit:cover;margin:0 auto">
<div style="font:600 12px/1.3 ${FONT};color:${C.soft};padding-top:6px;max-width:64px">${gm(esc(c.name))}</div></a></td>`).join('')}</tr></table>`;

// cards in a row (more games / videos - tall video posters go 3-4 in a row); a lone last card of two spans the row
const cards = (list, cols = 2) => {
  const rows = [];
  for (let i = 0; i < list.length; i += cols) rows.push(list.slice(i, i + cols));
  const w = Math.floor(536 / cols) - 12;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed">${rows.map((r) => {
    const span = cols === 2 && r.length === 1;
    const cells = r.map((c) => `
<td width="${span ? '100%' : Math.floor(100 / cols) + '%'}" valign="top" style="padding:0 6px 14px 6px"${span ? ' colspan="2"' : ''}>
<a href="${esc(c.href)}" style="text-decoration:none;display:block;${bg(C.card2)};border-radius:16px;overflow:hidden">
<img src="${esc(c.img)}" alt="${esc(c.title)}" width="${span ? 524 : w}" style="display:block;width:100%;height:auto;border:0">
<div style="padding:${cols > 2 ? '10px 10px 12px' : '12px 14px 14px'}">
${c.tag ? `<div style="font:700 11px/1 ${FONT};color:${C.accent2};padding-bottom:6px;letter-spacing:.4px">${gm(esc(c.tag))}</div>` : ''}
<div style="font:800 ${cols > 2 ? 14 : 16}px/1.3 ${FONT};color:${C.text}">${gm(esc(c.title))}</div>
${c.text ? `<div style="font:400 13px/1.5 ${FONT};color:${C.dim};padding-top:4px">${gm(esc(c.text))}</div>` : ''}
</div></a></td>`);
    while (!span && cells.length < cols) cells.push(`<td width="${Math.floor(100 / cols)}%"></td>`);
    return `<tr>${cells.join('')}</tr>`;
  }).join('')}</table>`;
};

// a section title with a thin orange line under it
const section = (t) => `<div style="font:800 20px/1.3 ${FONT};color:${C.text};padding-bottom:8px">${gm(esc(t))}</div>
<div style="width:44px;height:4px;border-radius:4px;${bg(C.accent)};font-size:0;line-height:0">&nbsp;</div>`;

// a story as a phone: the tall picture in a dark frame, the character's face and name above it
const phone = ({ img, href, face, name, text }) => `<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td>
<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 14px"><tr>
<td valign="middle"><img src="${esc(face)}" alt="" width="44" height="44" style="display:block;width:44px;height:44px;border-radius:50%;border:3px solid ${C.accent};object-fit:cover"></td>
<td valign="middle" style="padding-right:10px;font:800 18px/1.2 ${FONT};color:${C.text}">${gm(esc(name))}<div style="font:400 13px/1.3 ${FONT};color:${C.dim}">${gm('סטורי חדש')}</div></td></tr></table>
<a href="${esc(href)}" style="display:block;text-decoration:none;${bg('#000000')};border:2px solid ${C.line};border-radius:34px;padding:8px;max-width:262px;margin:0 auto">
<img src="${esc(img)}" alt="${esc(text)}" width="262" style="display:block;width:100%;max-width:262px;height:auto;border-radius:26px;border:0"></a>
</td></tr></table>`;

// a quote in the character's voice
const quote = (t) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="border-right:4px solid ${C.accent};${bg(C.card2)};border-radius:14px;padding:16px 18px;font:500 17px/1.6 ${FONT};color:${C.text}">${gm(esc(t))}</td></tr></table>`;

// ---------- the shell ----------
function shell({ kind, subject, preheader, body, unsub, note }) {
  const footer = `<tr><td style="padding:28px 32px 34px;border-top:1px solid ${C.line}" align="center">
<a href="${SITE}/?utm_source=mail&utm_campaign=${kind}"><img src="${LOGO}" alt="השלומיוורס" width="72" style="display:block;width:72px;height:auto;border:0;margin:0 auto 12px"></a>
<div style="font:400 13px/1.7 ${FONT};color:${C.dim}">${gm(note || `כל הדמויות. כל הסרטונים. ואפשר לדבר עם כולן.<br>
קיבלת את המייל כי יש לך חשבון בשלומיוורס. לא יותר ממייל אחד ביום.`)}</div>
<div style="font:400 13px/1.7 ${FONT};color:${C.dim};padding-top:10px">
${unsub ? `<a href="${esc(unsub)}" style="color:${C.soft};text-decoration:underline">${gmi('לבחור על מה לקבל מיילים או להפסיק')}</a>
&nbsp;·&nbsp; ` : ''}<a href="${SITE}/?utm_source=mail&utm_campaign=${kind}" style="color:${C.soft};text-decoration:underline">${gmi('shlomiverse.com')}</a></div>
</td></tr>`;
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light"><title>${esc(subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>u + .body .gs{background:#000;mix-blend-mode:screen}u + .body .gd{background:#000;mix-blend-mode:difference}
body{margin:0;padding:0;background:${C.bg}}a{color:${C.accent2}}img{-ms-interpolation-mode:bicubic}
@media (max-width:620px){.w{width:100%!important}.px{padding-left:18px!important;padding-right:18px!important}}</style></head>
<body class="body" style="margin:0;padding:0;${bg(C.bg)}" bgcolor="${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.bg}">${esc(preheader)}${'&#8204;&nbsp;'.repeat(60)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="${bg(C.bg)}"><tr><td align="center" style="padding:24px 10px;${bg(C.bg)}" dir="rtl">
<table role="presentation" class="w" width="600" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="width:600px;max-width:600px;${bg(C.card)};border-radius:28px;overflow:hidden;border:1px solid ${C.line}" bgcolor="${C.card}">
<tr><td align="center" style="padding:26px 32px 6px;background-color:${C.card};background-image:linear-gradient(180deg,#3a1c10 0%,#241812 45%,${C.card} 100%)">
<a href="${SITE}/?utm_source=mail&utm_campaign=${kind}"><img src="${LOGO}" alt="השלומיוורס" width="96" style="display:block;width:96px;height:auto;border:0"></a></td></tr>
${body}
${footer}
</table></td></tr></table></body></html>`;
}

// ---------- the mails ----------
// a new game: its hero picture, what you do, who is in it, the button to play
function newGame(d, k) {
  const play = track(d.url, k);
  return [spacer(14), pad(hero(d.hero, play, d.title)), spacer(26), pad(chip('משחק חדש בשלומיוורס')), spacer(16), pad(h1(d.title)), spacer(10),
    pad(p(d.tagline)), spacer(24), d.points?.length ? pad(bullets(d.points)) + spacer(10) : '', pad(button(d.cta || 'לשחק עכשיו', play)), spacer(30),
    d.cast ? pad(`<div style="font:700 14px/1 ${FONT};color:${C.dim};text-align:center;padding-bottom:14px">${gm('מי במשחק')}</div>` + faces(d.cast)) : '',
    d.cast ? spacer(30) : '',
    d.more?.length ? pad(section('עוד משחקים בשלומיוורס')) + spacer(16) + pad(cards(d.more), '0 26px') + spacer(10) : ''].join('');
}

// a character's story: the story as a phone, the line they wrote, the story's own button
function story(d, k) {
  return [spacer(18), pad(phone({ img: d.img, href: track(d.href, k), face: d.face, name: d.name, text: d.text })), spacer(24),
    pad(quote(d.text)), spacer(24), pad(button(d.cta || 'לצפות בסטורי', track(d.link || d.href, k))), spacer(16),
    pad(`<div style="text-align:center">${ghost('לעמוד של ' + d.name, track(d.page, k))}</div>`), spacer(30)].join('');
}

// a new video: its poster, the play button, the teaser, more videos
function video(d, k) {
  const watch = track(d.href, k);
  return [spacer(18), pad(`<a href="${esc(watch)}" style="display:block;text-decoration:none;${bg('#000000')};border:2px solid ${C.line};border-radius:34px;padding:8px;max-width:262px;margin:0 auto"><img src="${esc(d.poster)}" alt="${esc(d.title)}" width="262" style="display:block;width:100%;max-width:262px;height:auto;border-radius:26px;border:0"></a>`), spacer(14),
    pad(`<div style="text-align:center">${ghost('▶ לצפייה בסרטון', watch)}</div>`), spacer(20), pad(chip('סרטון חדש')), spacer(16),
    pad(h1(d.title)), spacer(10), pad(p(d.teaser)), spacer(26), pad(button('לצפות עכשיו', watch)), spacer(34),
    d.more?.length ? pad(section('עוד סרטונים מהשבוע')) + spacer(16) + pad(cards(d.more, 3), '0 26px') + spacer(10) : ''].join('');
}

// the week in the verse: the lead item, then games, videos, stories
function digest(d, k) {
  const t = (x) => ({ ...x, href: track(x.href, k) });
  return [spacer(10), pad(`<div style="text-align:center">${chip(d.week)}</div>`), spacer(14),
    pad(`<div style="text-align:center">${h1(d.title)}</div>`), spacer(10), pad(`<div style="text-align:center">${p(d.intro)}</div>`), spacer(26),
    d.lead.img ? pad(hero(d.lead.img, track(d.lead.href, k), d.lead.title)) + spacer(16) : '', pad(h2(d.lead.title)), spacer(8), pad(p(d.lead.text, 16)), spacer(18),
    pad(button(d.lead.cta, track(d.lead.href, k))), spacer(38),
    d.games?.length ? pad(section(d.gamesTitle || 'משחקים חדשים')) + spacer(16) + pad(cards(d.games.map(t)), '0 26px') + spacer(24) : '',
    d.videos?.length ? pad(section(d.videosTitle || 'סרטונים חדשים')) + spacer(16) + pad(cards(d.videos.map(t), d.videos.length >= 4 ? 4 : 3), '0 26px') + spacer(24) : '',
    d.faces?.length ? pad(section(d.facesTitle || 'העלו סטורי השבוע')) + spacer(18) + pad(faces(d.faces.map(t))) + spacer(30) : ''].join('');
}

// the first mail of a new account: what the verse is, who lives in it, where to start
function welcome(d, k) {
  return [spacer(14), pad(hero(d.hero, track('/', k), 'השלומיוורס')), spacer(26), pad(h1(`ברוכים הבאים ליקום${d.name ? ', ' + d.name : ''}!`)), spacer(10),
    pad(p('השלומיוורס הוא עולם שלם של דמויות – כל אחת עם הסרטונים שלה, הסטורי שלה, המשחקים שלה. ואפשר לדבר עם כולן.')), spacer(24),
    // everything a new account can do in the verse (his ask: don't forget any of its features)
    pad(bullets([['🎬', '<b style="color:#fff">סרטונים</b> – כל הדמויות, כל הסדרות, במקום אחד. שומרים את מה שאהבתם בנגיעה.'],
      ['💬', '<b style="color:#fff">לדבר עם הדמויות</b> – שאלו את חני, את צביקה או את רוזנבלום מה שבא לכם. הן מכירות אתכם בשם.'],
      ['📣', '<b style="color:#fff">תגובות</b> – כותבים @ ושם של דמות מתחת לסרטון, והיא עונה לכם.'],
      ['🎮', '<b style="color:#fff">משחקים</b> – כל דמות והמשחק שלה, עם שיא יומי.'],
      ['🔔', '<b style="color:#fff">סטורי והתראות</b> – עוקבים אחרי הדמויות שאתם אוהבים ובוחרים ממי לקבל התראות.'],
      ['💡', '<b style="color:#fff">הקהילה</b> – מציעים רעיון לפרק או לדמות חדשה, ומצביעים לרעיונות שבא לכם לראות.'],
      ['📱', '<b style="color:#fff">אפליקציה</b> – מתקינים את השלומיוורס על הטלפון, ונכנסים בנגיעה.']])), spacer(10),
    // the stickers - his "super important" (2026-11-04): its own box, not one more line
    pad(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="background-color:#2a160c;background-image:linear-gradient(135deg,#3a1c10,#1d1d25);border:2px solid ${C.accent};border-radius:20px;padding:20px 20px 22px" align="center">
<div style="font:32px/1 ${FONT};padding-bottom:10px">🎨</div>
<div style="font:800 21px/1.3 ${FONT};color:${C.text}">${gm('סטיקרים מהדמויות – ישר לוואטסאפ')}</div>
<div style="font:400 15px/1.6 ${FONT};color:${C.soft};padding:8px 0 16px">${gm('עוצרים על כל רגע בכל סרטון, ובנגיעה אחת הוא הופך לסטיקר של הדמות. כל הסטיקרים שלכם נשמרים במקום אחד.')}</div>
${button('להכין סטיקר', track('/my-stickers', k))}</td></tr></table>`), spacer(26),
    pad(`<div style="font:700 14px/1 ${FONT};color:${C.dim};text-align:center;padding-bottom:14px">${gm('כמה מהשכנים החדשים שלך')}</div>` + faces(d.cast.map((c) => ({ ...c, href: track(c.href, k) })))), spacer(30),
    pad(button('להיכנס ליקום', track('/', k))), spacer(30),
    pad(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="${bg(C.card2)};border-radius:16px;padding:18px 20px;font:400 15px/1.6 ${FONT};color:${C.soft}"><div class="gs"><div class="gd">
<b style="color:#fff">📬 מה יגיע אליך במייל?</b><br>רק כשקורה משהו חדש – משחק, סרטון או סטורי – ולא יותר ממייל אחד ביום.
${d.prefs ? `<br><a href="${esc(d.prefs)}" style="color:${C.accent2};font-weight:700;text-decoration:none">לבחור על מה לקבל מיילים &larr;</a>` : ''}</div></div></td></tr></table>`), spacer(34)].join('');
}

// a reply from a character to someone who sent a form on their site: their face, their words, their signature
function reply(d, k) {
  const verse = d.face === LOGO;
  return [spacer(verse ? 6 : 20), verse ? '' : pad(`<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">
<img src="${esc(d.face)}" alt="${esc(d.sign)}" width="96" height="96" style="display:block;width:96px;height:96px;border-radius:50%;border:4px solid ${C.accent};object-fit:cover;margin:0 auto">
<div style="font:700 14px/1.4 ${FONT};color:${C.dim};padding-top:10px">${gm(esc(d.site || ''))}</div></td></tr></table>`), spacer(verse ? 8 : 18),
    d.chip ? pad(`<div style="text-align:center">${chip(d.chip)}</div>`) + spacer(14) : '',
    pad(`<div style="text-align:center">${h1(d.title)}</div>`), spacer(18),
    ...(d.paras || []).map((x) => pad(p(x)) + spacer(14)), spacer(6),
    pad(`<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
${verse ? '' : `<td valign="middle"><img src="${esc(d.face)}" alt="" width="48" height="48" style="display:block;width:48px;height:48px;border-radius:50%;object-fit:cover"></td>`}
<td valign="middle" style="padding-right:${verse ? 0 : 12}px"><div style="font:800 17px/1.3 ${FONT};color:${C.text}">${gm(esc(d.sign))}</div>
<div style="font:400 14px/1.4 ${FONT};color:${C.dim}">${gm(esc(d.signRole || ''))}</div></td></tr></table>`), spacer(28),
    d.cta ? pad(button(d.cta.label, track(d.cta.href, k))) + spacer(34) : ''].join('');
}

// an idea's step (his ask, 2026-11-05): the Shlomiverse liked it / it's being made / it's out - the writer's own idea quoted,
// what it means, and the button (the idea on the wall, or the video)
function idea(d, k) {
  return [spacer(18), pad(`<div style="text-align:center">${chip(d.chip)}</div>`), spacer(16), pad(`<div style="text-align:center">${h1(d.title)}</div>`), spacer(20),
    pad(quote(d.idea)), spacer(20), pad(p(d.body)), spacer(26), pad(button(d.cta, track(d.href, k))), spacer(34)].join('');
}

// the citizenship journey's invitation (stage 4; his words, 2026-11-06): a letter from the Shlomiverse's embassy - the picture
// (Miriam at the counter, Demokratovich behind her with the stamp), "לכבוד <their name>", the letter, one button, the signature
function citizen(d, k) {
  const go = track('/citizenship', k);
  const line = (t, st = '') => pad(`<div style="font:400 17px/1.7 ${FONT};color:${C.soft};${st}">${gm(esc(t))}</div>`) + spacer(12);
  return [spacer(14), pad(hero(d.hero, go, d.title)), spacer(26),
    d.to ? pad(`<div style="font:700 16px/1.4 ${FONT};color:${C.dim}">${gm(esc(d.to))}</div>`) + spacer(10) : '',
    pad(h1(d.title)), spacer(18), ...(d.paras || []).map((x) => line(x)),
    d.bold ? pad(`<div style="font:800 18px/1.6 ${FONT};color:${C.text}">${gm(esc(d.bold))}</div>`) + spacer(8) : '',
    d.fine ? pad(`<div style="font:400 14px/1.6 ${FONT};color:${C.dim}">${gm(esc(d.fine))}</div>`) + spacer(26) : spacer(18),
    pad(button(d.cta, go)), spacer(30),
    pad(`<div style="font:400 16px/1.6 ${FONT};color:${C.soft}">${gm('בברכה,')}</div><div style="font:800 17px/1.5 ${FONT};color:${C.text}">${gm(esc(d.sign))}</div>
<div style="font:400 14px/1.5 ${FONT};color:${C.dim}">${gm(esc(d.signRole))}</div>`), spacer(32)].join('');
}

const KINDS = { game: newGame, story, video, digest, welcome, reply, idea, citizen };

// one mail: { subject, html, text, headers } - `unsub` is this reader's own link, `unsubPost` the one-click address
function render(kind, d, { unsub, unsubPost } = {}) {
  if (kind !== 'reply') unsub = unsub || SITE + '/mail/off';
  const body = KINDS[kind]({ prefs: unsub, ...d }, kind);
  const note = kind === 'reply' ? `זו תשובה אוטומטית מ${esc(d.site || 'השלומיוורס')}, בשלומיוורס – עולם של דמויות.<br>אפשר להשיב למייל הזה.` : d.note ? esc(d.note) : null;
  const html = shell({ kind, subject: d.subject, preheader: d.preheader || '', body, unsub, note });
  const text = [d.subject, '', ...(d.paras || [d.preheader || '']), '', abs(d.url || d.href || d.cta?.href || '/'), ...(unsub ? ['', 'לבחור על מה לקבל מיילים או להפסיק: ' + unsub] : [])].join('\n');
  const headers = unsub ? { 'List-Unsubscribe': `<${unsubPost || unsub}>`, ...(unsubPost ? { 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : {}) } : {};
  return { subject: d.subject, html, text, headers };
}

module.exports = { render, unsubToken, unsubUrl, KINDS: Object.keys(KINDS) };
