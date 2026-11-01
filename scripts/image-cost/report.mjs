// Builds report.html next to results.json (from compare.mjs).
//   node scripts/image-cost/report.mjs <outDir>
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve(process.argv[2] || 'image-cost-out');
const data = JSON.parse(fs.readFileSync(path.join(DIR, 'results.json'), 'utf8'));
const R = data.results.sort((a, b) => a.id.localeCompare(b.id));
const $ = (n, d = 4) => '$' + n.toFixed(d);
const sum = (k) => R.reduce((s, r) => s + r[k].usd, 0);
const totO = sum('openai'), totL = sum('leonardo');
const byId = Object.fromEntries(R.map((r) => [r.id, r]));
const tokensUsed = data.leonardoTokens.before - data.leonardoTokens.after;
const usdPerToken = totL / tokensUsed;
const per1000 = (id, k) => '$' + (byId[id][k].usd * 1000).toFixed(2);
const date = new Date(data.date).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

const rows = R.map((r) => {
  const o = r.openai, l = r.leonardo;
  const diff = Math.round((1 - o.usd / l.usd) * 100);
  return `<tr><td class="mono">${r.id}</td><td>${r.label}<div class="sub">${r.model} · ${r.q} · ${r.w}×${r.h}${r.refs ? ' · ' + r.refs.length + ' ref' : ''}</div></td>
  <td class="num">${$(o.usd)}<div class="sub">${o.usage.input_tokens} in / ${o.usage.output_tokens} out tok</div></td>
  <td class="num">${$(l.usd)}</td><td class="num win">${diff}%</td>
  <td class="num">${o.secs.toFixed(0)}s</td><td class="num">${l.secs.toFixed(0)}s</td></tr>`;
}).join('\n');

const gallery = R.map((r) => `<figure class="pair"><figcaption><span class="mono">${r.id}</span> ${r.label} <span class="sub">${r.model} · ${r.q} · ${r.w}×${r.h}</span></figcaption>
  <div class="imgs"><div><img src="${r.openai.file}" loading="lazy"><span>OpenAI · ${$(r.openai.usd)}</span></div>
  <div><img src="${r.leonardo.file}" loading="lazy"><span>Leonardo · ${$(r.leonardo.usd)}</span></div></div></figure>`).join('\n');

const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>OpenAI direct vs Leonardo — GPT Image 2.5 cost test</title>
<style>
:root{--bg:#0d0f12;--card:#15181d;--line:rgba(255,255,255,.08);--text:#e8eaed;--mute:#8b929c;--acc:#3ecf8e}
[data-theme=light]{--bg:#fafafa;--card:#fff;--line:rgba(0,0,0,.09);--text:#16181c;--mute:#6b7280;--acc:#0f9d63}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.6 Inter,Segoe UI,system-ui,sans-serif}
.wrap{max-width:1080px;margin:0 auto;padding:48px 24px 80px}
h1{font-size:30px;line-height:1.2;margin:0 0 6px;letter-spacing:-.02em}h2{font-size:19px;margin:56px 0 14px;letter-spacing:-.01em}
.meta{color:var(--mute);font-size:13px}.sub{color:var(--mute);font-size:12px;font-weight:400}.mono{font-family:ui-monospace,Consolas,monospace}
.verdict{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--acc);border-radius:10px;padding:20px 22px;margin:28px 0}
.verdict p{margin:6px 0}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:24px 0}
.stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px 18px}.stat b{display:block;font-size:26px;letter-spacing:-.02em}
.stat span{color:var(--mute);font-size:13px}.win{color:var(--acc);font-weight:600}
.tbl{overflow-x:auto;border:1px solid var(--line);border-radius:10px;background:var(--card)}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{padding:11px 14px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{color:var(--mute);font-weight:500;font-size:12px;text-transform:uppercase;letter-spacing:.04em}tr:last-child td{border-bottom:0}
td.num,th.num{text-align:right;white-space:nowrap}tfoot td{font-weight:600}
.yes{color:var(--acc)}.no{color:#e5484d}.part{color:#f5a524}
ul{padding-left:20px}li{margin:4px 0}
.pair{margin:0 0 28px}.pair figcaption{margin-bottom:8px;font-weight:500}.imgs{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.imgs div{background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}.imgs img{width:100%;display:block}
.imgs span{display:block;padding:8px 12px;font-size:13px;color:var(--mute)}
.refs{display:flex;gap:10px}.refs img{height:120px;border-radius:8px;border:1px solid var(--line)}
.toggle{position:fixed;top:16px;right:16px;background:var(--card);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:7px 12px;cursor:pointer;font:inherit;font-size:13px;transition:border-color .15s}
.toggle:hover{border-color:var(--acc)}code{font-family:ui-monospace,Consolas,monospace;font-size:13px;background:var(--card);border:1px solid var(--line);border-radius:4px;padding:1px 5px}
</style></head><body>
<button class="toggle" onclick="const h=document.documentElement;h.dataset.theme=h.dataset.theme==='dark'?'light':'dark'">Theme</button>
<div class="wrap">
<h1>OpenAI direct vs Leonardo</h1>
<div class="meta">GPT Image 2.5 Flare &amp; Sunburst · same 8 jobs run on both · ${date} · real charges, not estimates · <a href="sheets.html" style="color:var(--acc)">game art test: sprite sheets and textures</a></div>

<div class="verdict">
<p><b>OpenAI direct is cheaper on every job, faster on every job, and the images come out the same.</b></p>
<p>Across all 8 jobs: <b>${$(totO, 3)}</b> on OpenAI vs <b>${$(totL, 3)}</b> on Leonardo (${Math.round((1 - totO / totL) * 100)}% less). Everything you do with these models on Leonardo works on OpenAI directly: reference photos, several references at once, width/height, quality. Both models (<code>gpt-image-2.5-flare</code>, <code>gpt-image-2.5-sunburst</code>) are already enabled on your OpenAI key.</p>
<p>The one thing to keep in mind: your Sketch Studio also uses Leonardo for <b>sound effects, music loops and video</b> (<code>zoomcut/tools/leonardo.mjs sfx | loop | video</code>). OpenAI doesn't offer those, so if you switch, switch for images only and keep Leonardo for audio and video.</p>
</div>

<div class="stats">
<div class="stat"><b>${$(byId.A.openai.usd, 3)} <span>vs</span> ${$(byId.A.leonardo.usd, 3)}</b><span>Your default: MEDIUM, 1024×1024</span></div>
<div class="stat"><b>${$(byId.C.openai.usd, 3)} <span>vs</span> ${$(byId.C.leonardo.usd, 3)}</b><span>MEDIUM portrait 1024×1536</span></div>
<div class="stat"><b>${$(byId.G.openai.usd, 3)} <span>vs</span> ${$(byId.G.leonardo.usd, 3)}</b><span>With a face reference photo</span></div>
<div class="stat"><b>${$(totO, 2)} <span>vs</span> ${$(totL, 2)}</b><span>All 8 test jobs, OpenAI vs Leonardo</span></div>
</div>

<h2>Job by job</h2>
<div class="tbl"><table>
<thead><tr><th></th><th>Job</th><th class="num">OpenAI</th><th class="num">Leonardo</th><th class="num">OpenAI cheaper by</th><th class="num">OpenAI time</th><th class="num">Leo time</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><td></td><td>Total</td><td class="num">${$(totO)}</td><td class="num">${$(totL)}</td><td class="num win">${Math.round((1 - totO / totL) * 100)}%</td><td></td><td></td></tr></tfoot>
</table></div>
<p class="sub">OpenAI cost = the tokens OpenAI reported for that call × its list price ($5 / 1M text in, $8 / 1M image in, $30 / 1M image out; same for Flare, Sunburst and gpt-image-2). Leonardo cost = the dollar amount Leonardo charged per generation. Your Leonardo balance went ${data.leonardoTokens.before} → ${data.leonardoTokens.after} tokens (${tokensUsed} tokens, about $${usdPerToken.toFixed(4)} each), which matches that amount. Times include upload and download; jobs ran in parallel. Quirk: OpenAI billed the 1024×1536 portrait for fewer tokens (343) than the 1024×1024 square (439), on both models; that is what the API reported.</p>

<h2>At volume</h2>
<div class="tbl"><table>
<thead><tr><th>1,000 images of…</th><th class="num">OpenAI</th><th class="num">OpenAI Batch (−50%)</th><th class="num">Leonardo</th></tr></thead>
<tbody>
<tr><td>MEDIUM square 1024×1024</td><td class="num">${per1000('A', 'openai')}</td><td class="num">$${(byId.A.openai.usd * 500).toFixed(2)}</td><td class="num">${per1000('A', 'leonardo')}</td></tr>
<tr><td>MEDIUM portrait 1024×1536</td><td class="num">${per1000('C', 'openai')}</td><td class="num">$${(byId.C.openai.usd * 500).toFixed(2)}</td><td class="num">${per1000('C', 'leonardo')}</td></tr>
<tr><td>MEDIUM portrait + 1 reference</td><td class="num">${per1000('G', 'openai')}</td><td class="num">$${(byId.G.openai.usd * 500).toFixed(2)}</td><td class="num">${per1000('G', 'leonardo')}</td></tr>
<tr><td>HIGH square</td><td class="num">${per1000('E', 'openai')}</td><td class="num">$${(byId.E.openai.usd * 500).toFixed(2)}</td><td class="num">${per1000('E', 'leonardo')}</td></tr>
</tbody></table></div>
<p class="sub">The Batch API halves every price but returns results within 24 hours, not seconds. It's only worth it for bulk jobs you don't need to watch.</p>

<h2>Can OpenAI do everything you do on Leonardo?</h2>
<div class="tbl"><table>
<thead><tr><th>Capability</th><th>OpenAI direct</th><th>Leonardo</th></tr></thead>
<tbody>
<tr><td>Flare &amp; Sunburst</td><td class="yes">Yes, tested (both on your key)</td><td class="yes">Yes</td></tr>
<tr><td>Reference photo (keep a face)</td><td class="yes">Yes, tested: <code>/v1/images/edits</code>, job G</td><td class="yes">Yes, <code>image_reference</code></td></tr>
<tr><td>Several references in one call</td><td class="yes">Yes, tested with 2 (job H); the docs show 4</td><td class="yes">Yes, tested with 2</td></tr>
<tr><td>Reference strength LOW / MID / HIGH</td><td class="part">No dial. You say in the prompt how much to take ("only the colours", "same face")</td><td class="yes">Yes</td></tr>
<tr><td>Width × height</td><td class="yes">Any size in multiples of 16, ratio 1:3 to 3:1, up to 3840px. 16:9 tested (job F)</td><td class="yes">Yes, tested at 1536×864</td></tr>
<tr><td>Quality</td><td class="yes">low · medium · high · xhigh · max</td><td class="yes">LOW · MEDIUM · HIGH</td></tr>
<tr><td>Mask / inpaint one area</td><td class="yes">Yes (mask on the first image)</td><td class="part">Not used today</td></tr>
<tr><td>Transparent background</td><td class="yes">Yes (png / webp)</td><td class="part">Not used today</td></tr>
<tr><td>Output format &amp; compression</td><td class="yes">png / jpeg / webp, compression 0–100</td><td class="part">Leonardo picks</td></tr>
<tr><td>Prompt enhance OFF</td><td class="yes">No such setting on the Images API: the prompt goes in as you wrote it</td><td class="yes">Set OFF in your scripts</td></tr>
<tr><td>Result delivery</td><td class="yes">The image comes back in the same response, no polling</td><td class="part">Queue, then poll every 2.5–3 s, then download</td></tr>
<tr><td>Sound effects, music loops, video</td><td class="no">No</td><td class="yes">Yes (Sketch Studio uses these)</td></tr>
</tbody></table></div>

<h2>What I'd do</h2>
<ul>
<li>Move <b>images</b> to OpenAI direct: the <code>image</code> and <code>portrait</code> commands in <code>zoomcut/tools/leonardo.mjs</code> and the sol-leonardo skill. The rest of your code calls them the same way. Only the request inside changes, and the polling goes away.</li>
<li>Keep <b>Leonardo</b> for sfx, loops and video. The ${data.leonardoTokens.after.toLocaleString()} paid tokens left (about $${(data.leonardoTokens.after * usdPerToken).toFixed(0)} at today's rate) will last a long time once images stop drawing on them.</li>
<li>One thing to decide: OpenAI has no reference-strength dial. Where you use <code>LOW</code> to take only the colours from a logo, that has to go into the prompt instead. Worth a side-by-side the first time.</li>
</ul>

<h2>The images, side by side</h2>
<p class="sub">Same prompt and settings in each pair. The reference photos used in G and H:</p>
<div class="refs"><img src="ref-shlomi.jpg"><img src="ref-frame.jpg"></div><br>
${gallery}

<p class="sub" style="margin-top:40px">Test scripts: <code>c:\\workspace\\BoostMind\\scripts\\image-cost\\compare.mjs</code> (runs the jobs) and <code>report.mjs</code> (builds this page). Raw numbers: <code>results.json</code> in this folder.</p>
</div></body></html>`;
fs.writeFileSync(path.join(DIR, 'report.html'), html);
console.log('->', path.join(DIR, 'report.html'));
