// Builds report.html beside results.json (from compare.mjs). ElevenLabs credits: the character-cost header for voices and
// sound effects; music is not reported per call, so it uses the measured rate (795 credits for 30 s, el-music-cost.mjs).
//   node scripts/audio-cost/report.mjs <outDir>
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve(process.argv[2] || 'audio-cost-out');
const data = JSON.parse(fs.readFileSync(path.join(DIR, 'results.json'), 'utf8'));
const PER = data.usdPerCredit;
const MUSIC_CREDITS_PER_SEC = 795 / 30;
for (const r of data.results) {
  if (!r.eleven.ok) continue;
  r.eleven.credits = r.kind === 'music' ? Math.round(MUSIC_CREDITS_PER_SEC * r.secs) : Number(r.eleven.header);
  r.eleven.usd = r.eleven.credits * PER;
}
const R = data.results;
const $ = (n) => '$' + n.toFixed(n < 0.1 ? 4 : 3);
const sum = (side, kind) => R.filter((r) => !kind || r.kind === kind).reduce((s, r) => s + r[side].usd, 0);
const KIND = { voice: 'Voices', sfx: 'Sound effects', music: 'Music' };

const rows = R.map((r) => `<tr><td>${r.label}<div class="sub">${KIND[r.kind]}</div></td>
  <td class="num">${$(r.eleven.usd)}<div class="sub">${r.eleven.credits} credits</div></td><td class="num">${$(r.leonardo.usd)}</td>
  <td class="num win">${(r.leonardo.usd / r.eleven.usd).toFixed(1)}×</td><td class="num">${r.eleven.secs.toFixed(0)}s</td><td class="num">${r.leonardo.secs.toFixed(0)}s</td></tr>`).join('\n');

const players = R.map((r) => `<div class="pair"><div class="ph"><b>${r.label}</b> <span class="sub">${KIND[r.kind]}</span></div>
  <div class="ptext">${r.text.replace(/</g, '&lt;')}</div>
  <div class="two"><div><span class="who">ElevenLabs direct · ${$(r.eleven.usd)}</span><audio controls preload="none" src="${r.eleven.file}"></audio>${r.eleven.heard ? `<div class="sub">Heard: ${r.eleven.heard}</div>` : ''}</div>
  <div><span class="who">Leonardo · ${$(r.leonardo.usd)}</span><audio controls preload="none" src="${r.leonardo.file}"></audio>${r.leonardo.heard ? `<div class="sub">Heard: ${r.leonardo.heard}</div>` : ''}</div></div></div>`).join('\n');

const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ElevenLabs direct vs Leonardo — voices, sound effects, music</title>
<style>
:root{--bg:#0d0f12;--card:#15181d;--line:rgba(255,255,255,.08);--text:#e8eaed;--mute:#8b929c;--acc:#3ecf8e}
[data-theme=light]{--bg:#fafafa;--card:#fff;--line:rgba(0,0,0,.09);--text:#16181c;--mute:#6b7280;--acc:#0f9d63}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.6 Inter,Segoe UI,system-ui,sans-serif}
.wrap{max-width:1080px;margin:0 auto;padding:48px 24px 80px}
h1{font-size:30px;line-height:1.2;margin:0 0 6px;letter-spacing:-.02em}h2{font-size:19px;margin:52px 0 12px}
.meta,.sub{color:var(--mute);font-size:13px}.win{color:var(--acc);font-weight:600}
.verdict{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--acc);border-radius:10px;padding:18px 22px;margin:26px 0}
.verdict p{margin:6px 0}ul{padding-left:20px}li{margin:4px 0}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:22px 0}
.stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px 18px}.stat b{display:block;font-size:24px;letter-spacing:-.02em}.stat span{color:var(--mute);font-size:13px}
.tbl{overflow-x:auto;border:1px solid var(--line);border-radius:10px;background:var(--card)}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{padding:11px 14px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{color:var(--mute);font-weight:500;font-size:12px;text-transform:uppercase;letter-spacing:.04em}tr:last-child td{border-bottom:0}
td.num,th.num{text-align:right;white-space:nowrap}tfoot td{font-weight:600}
.pair{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px 18px;margin:0 0 14px}
.ptext{color:var(--mute);font-size:13px;margin:4px 0 12px}.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.two audio{width:100%;margin:6px 0}.who{font-size:13px;font-weight:500}
@media(max-width:700px){.two{grid-template-columns:1fr}}
.toggle{position:fixed;top:16px;right:16px;background:var(--card);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:7px 12px;cursor:pointer;font:inherit;font-size:13px;transition:border-color .15s}
.toggle:hover{border-color:var(--acc)}code{font-family:ui-monospace,Consolas,monospace;font-size:13px}
</style></head><body>
<button class="toggle" onclick="const h=document.documentElement;h.dataset.theme=h.dataset.theme==='dark'?'light':'dark'">Theme</button>
<div class="wrap">
<h1>ElevenLabs direct vs Leonardo</h1>
<div class="meta">Voices, sound effects and music · the same 7 jobs on both, prompts taken from the studio library · 30 Oct 2026</div>

<div class="verdict">
<p><b>Going to ElevenLabs directly is ${(sum('leonardo') / sum('eleven')).toFixed(1)}× cheaper for the same jobs, faster, and gives more control.</b> All 7 jobs: ${$(sum('eleven'))} direct against ${$(sum('leonardo'))} on Leonardo.</p>
<p><b>It is very likely the same models.</b> Leonardo's voice model takes ElevenLabs' own voice ids (George, Liam…). Both sides return the same file format, byte for byte the same length, and the Hebrew line paused at the same moments (2.24s vs 2.30s, 3.30s vs 3.36s, …). Leonardo does not name its audio supplier, so this is evidence, not a statement from them.</p>
<p><b>Quality: listen below</b> - I can't judge sound by ear. What I could check: every spoken line was transcribed word for word correctly on both sides (Hebrew included), loudness is within 1-3 dB, and the lengths match. Leonardo's music track starts with 0.9s of silence; the direct one starts at once.</p>
</div>

<div class="stats">
<div class="stat"><b>${$(sum('eleven', 'voice') / 3)} <span>vs</span> ${$(sum('leonardo', 'voice') / 3)}</b><span>A voice line, average (Leonardo is flat per call; direct is per character)</span></div>
<div class="stat"><b>${$(sum('eleven', 'sfx'))} <span>vs</span> ${$(sum('leonardo', 'sfx'))}</b><span>The three sound effects (1s, 2s, 16s loop)</span></div>
<div class="stat"><b>${$(sum('eleven', 'music'))} <span>vs</span> ${$(sum('leonardo', 'music'))}</b><span>One minute of music</span></div>
</div>

<h2>Job by job</h2>
<div class="tbl"><table>
<thead><tr><th>Job</th><th class="num">ElevenLabs direct</th><th class="num">Leonardo</th><th class="num">Leonardo costs</th><th class="num">Direct time</th><th class="num">Leo time</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><td>Total</td><td class="num">${$(sum('eleven'))}</td><td class="num">${$(sum('leonardo'))}</td><td class="num win">${(sum('leonardo') / sum('eleven')).toFixed(1)}×</td><td></td><td></td></tr></tfoot>
</table></div>
<p class="sub">ElevenLabs bills in plan credits: your Creator plan is $22 for 121,000 credits a month, so 1 credit = $${PER.toFixed(6)}. Credits per call: the <code>character-cost</code> header ElevenLabs returns (voices = 1 credit a character; sound effects = 10 credits a second). Music has no header, so it was measured separately on the balance: 795 credits for 30 seconds, about 1,590 a minute. Leonardo's price is the dollar amount it charged per generation. These credits come out of what the plan already includes (about 50,000 of 266,610 used this month), so until the limit they cost nothing extra.</p>

<h2>What direct adds besides price</h2>
<ul>
<li><b>Music of any length</b>, 10 seconds to 5 minutes (<code>music_length_ms</code>). Through Leonardo it is always one minute.</li>
<li><b>The newer voice model</b> <code>eleven_v4</code> (Sketch Studio already uses it on this key) and the whole voice library, including your own cloned voices. Leonardo offers v3 with 21 preset voices.</li>
<li><b>The file comes back in the same call</b>, so no queue and no polling.</li>
<li>Voices are priced per character: one short line is ~$0.01-0.02 instead of a flat $0.13. A long batch of 12 announcer lines (~400 characters) is ~$0.07, still about half of Leonardo's.</li>
</ul>

<h2>Things to know first</h2>
<ul>
<li><b>Music rights:</b> ElevenLabs' music terms (updated 9 Oct 2026) allow games on the Creator plan if they are "Indie Games": under $500K revenue per game, from a company with under $1M a year from games. Bigger "Studio Games" need an Enterprise music plan. While Plaxzy is under those limits, its games qualify. Creator is also listed "for individual use only".</li>
<li><b>Plan limits:</b> Creator allows 62 minutes of music generation a month, and everything shares the same monthly credits as Sketch Studio.</li>
<li>The key is in <code>zoomcut/.env</code> (<code>ELEVENLABS_API_KEY</code>). Noam's computer would need it too, or the studio keeps using Leonardo.</li>
</ul>

<h2>Listen</h2>
${players}

<p class="sub" style="margin-top:36px">Scripts: c:\\workspace\\BoostMind\\scripts\\audio-cost\\ (compare.mjs runs the jobs, el-music-cost.mjs measures music, report.mjs builds this page). Raw numbers: results.json in this folder.</p>
</div></body></html>`;
fs.writeFileSync(path.join(DIR, 'report.html'), html);
console.log('->', path.join(DIR, 'report.html'), 'eleven', sum('eleven').toFixed(4), 'leonardo', sum('leonardo').toFixed(4));
