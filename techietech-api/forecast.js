// "How will today end?" - his ask (2026-11-06): today's numbers in /backstage/ always look smaller than yesterday's,
// because the day isn't over. This learns, from the days before, how much of a day has usually come by each hour, and
// projects today's end - fresh on every load, so it gets better as days pile up (a rolling window, nothing stored).
//
//   the shape   analytics_days.h[<metric>][<hour>] (analytics.js counts every event per Israel hour): for every past day,
//               the share of its total that had come by the end of each hour. Recent days weigh more; Friday and
//               Saturday get their own shape, pulled toward the other days while there are only a few of them.
//   the level   what a day usually totals: the recent days (recent ones weigh more), times the weekday's factor.
//   today       F = the share of a day that has usually come by now; so far = what came. The day's total is
//               so far + (1 - F) x rate, where the rate blends the level and so far / F (Gamma-Poisson: early in the
//               day it trusts the level, late in the day it trusts what came).
//   learning    walk-forward: each of the last weeks' days is predicted at every hour only from the days before it,
//               and the blend's two knobs are picked by the smallest error. The same errors give the range (lo-hi)
//               and "usually right within ±X%" at this hour.
// Pure functions, no database - verse.js (op stats) hands it the day docs and the accounts' sign-up times.
const H = 24;
const WINDOW = 84;            // days it learns from
const EVAL = 21;              // days it tests itself on
const SHAPE_HL = 21;          // a day's weight in the shape halves every 21 days back
const GROUP_M = 2;            // pseudo-days pulling Friday's / Saturday's shape toward all days
const FACTOR_M = 4;           // the same for the weekday's level factor
const HLS = [2, 4, 7, 14];    // the level: half-life in days (picked by the backtest)
const KS = [0.15, 0.3, 0.6, 1.2];   // how many days' worth of trust the level gets against today's own count (picked too;
                                    // up to 10 was tried on 2026-11-06's replay - a stronger pull to the level did worse)

const DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }), HM = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const dayIL = (d) => DAY.format(d);
const hmIL = (d) => HM.format(d).split(':').map(Number);
const dayNo = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 864e5;
const fromNo = (n) => new Date(n * 864e5).toISOString().slice(0, 10);
const groupOf = (d) => { const w = new Date(d + 'T12:00:00Z').getUTCDay(); return w === 5 ? 'fri' : w === 6 ? 'sat' : 'week'; };

// what the page shows (backstage METRICS): the day's total and its hours
const ev = (e) => ({ total: (d) => d.n?.[e] || 0, hours: (d) => d.h?.[e] });
const METRICS = {
  visitors: { total: (d) => d.visitors || 0, hours: (d) => d.h?.visitors },
  new_visitors: { total: (d) => d.new_visitors || 0, hours: (d) => d.h?.new_visitors },
  joined: null,   // from the accounts' sign-up times
  ...Object.fromEntries(['chat_message', 'chat_open', 'video', 'view', 'game_start', 'sign_in', 'comment', 'site'].map((e) => [e, ev(e)])),
};

// a day's hours -> the share of its total by the end of each hour (null when too few to have a shape)
function cumOf(hours) {
  if (!hours) return null;
  const a = Array.from({ length: H }, (_, i) => Math.max(0, +hours[i] || 0)), s = a.reduce((x, y) => x + y, 0);
  if (s < 3) return null;
  let run = 0;
  return a.map((v) => (run += v) / s);
}
// the share by time t (hours, 0-24), straight between the hours' ends
const cumAt = (cum, t) => { if (t >= H) return 1; const i = Math.floor(t), prev = i ? cum[i - 1] : 0; return prev + (cum[i] - prev) * (t - i); };

// the share a day of group g has usually reached by t, learned from `train` (days before `ref`)
function shareAt(train, ref, g, t) {
  let sw = 0, sv = 0, gw = 0, gv = 0;
  for (const r of train) {
    if (!r.cum) continue;
    const w = 0.5 ** ((ref - r.no) / SHAPE_HL) * Math.min(1, r.T / 30), v = cumAt(r.cum, t);
    sw += w; sv += w * v;
    if (r.g === g) { gw += w; gv += w * v; }
  }
  if (!sw) return t / H;
  const all = sv / sw;
  return (gv + GROUP_M * all) / (gw + GROUP_M);
}
// the weekday factor: each day against the 7 before it, the group's mean over all groups' mean, shrunk to 1
function factorsOf(train) {
  const by = {}, ratios = [];
  for (const r of train) {
    const prev = train.filter((x) => x.no < r.no && r.no - x.no <= 7);
    const m = prev.length >= 4 ? prev.reduce((a, x) => a + x.T, 0) / prev.length : 0;
    if (m > 0) { ratios.push(r.T / m); (by[r.g] ||= []).push(r.T / m); }
  }
  const mean = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 1;
  const f = {};
  for (const g of ['week', 'fri', 'sat']) { const l = by[g] || []; f[g] = mean > 0 ? ((l.reduce((a, b) => a + b, 0) + FACTOR_M * mean) / (l.length + FACTOR_M)) / mean : 1; }
  return f;
}
// what a day of group g usually totals: recent days by half-life hl, times the weekday's factor
function levelOf(train, ref, g, hl, f = factorsOf(train)) {
  const recent = train.filter((r) => ref - r.no <= 28);
  if (!recent.length) return 0;
  let sw = 0, sv = 0, sf = 0;
  for (const r of recent) { const w = 0.5 ** ((ref - r.no) / hl); sw += w; sv += w * r.T; sf += w * f[r.g]; }
  return (sv / sw) / (sf / sw) * f[g];
}
const project = (sofar, F, P, k) => { F = Math.min(1, Math.max(0, F)); return sofar + (1 - F) * (k * P + sofar) / (k + F); };
const q = (a, p) => { const s = [...a].sort((x, y) => x - y), i = (s.length - 1) * p, lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };

function one(recs, today, t) {
  const ref = dayNo(today), g = groupOf(today), past = recs.filter((r) => r.no < ref), now = recs.find((r) => r.no === ref);
  // walk-forward over the last EVAL days: each predicted at 6:00..23:00 from the days before it only
  const errs = {}, res = {};
  for (const E of past.filter((r) => ref - r.no <= EVAL && r.cum && r.T >= 3)) {
    const train = past.filter((r) => r.no < E.no);
    if (train.filter((r) => r.cum).length < 3) continue;
    const f = factorsOf(train), P = Object.fromEntries(HLS.map((hl) => [hl, levelOf(train, E.no, E.g, hl, f)]));
    for (let tt = 6; tt < H; tt++) {
      const F = shareAt(train, E.no, E.g, tt), sofar = E.T * cumAt(E.cum, tt);
      for (const hl of HLS) for (const k of KS) {
        const c = hl + '|' + k, r = Math.log((E.T + 1) / (project(sofar, F, P[hl], k) + 1));
        errs[c] = (errs[c] || 0) + Math.abs(r);
        ((res[c] ||= {})[tt] ||= []).push(r);
      }
    }
  }
  const best = Object.keys(errs).sort((a, b) => errs[a] - errs[b])[0] || '4|0.6';
  const [hl, k] = best.split('|').map(Number);
  const sofar = now ? now.T : 0, F = shareAt(past, ref, g, t), P = levelOf(past, ref, g, hl);
  // the range (the middle 60%) and the usual miss at this hour, from the backtest's misses within 1.5 hours of now
  // (correcting the projection by their middle was tried on 2026-11-06 - it made it worse; only their spread is used)
  const near = Object.entries(res[best] || {}).filter(([tt]) => Math.abs(+tt - t) <= 1.5).flatMap(([, l]) => l);
  const proj = project(sofar, F, P, k);
  const band = near.length >= 8 ? [Math.max(sofar, (proj + 1) * Math.exp(q(near, 0.2)) - 1), Math.max(sofar, (proj + 1) * Math.exp(q(near, 0.8)) - 1)] : null;
  const usual = near.length >= 8 ? q(near.map((r) => Math.abs(Math.exp(r) - 1)), 0.5) : null;
  // the days to compare with at the same time: yesterday and a week ago
  const at = (r) => (r ? (r.cum ? r.T * cumAt(r.cum, t) : null) : 0);
  const y = recs.find((r) => r.no === ref - 1), w = recs.find((r) => r.no === ref - 7);
  const curve = (r) => (r && r.cum ? r.cum.map((c) => Math.round(c * r.T * 10) / 10) : null);
  const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
  return {
    sofar, proj: r1(proj), lo: band && r1(band[0]), hi: band && r1(band[1]), share: Math.round(F * 1000) / 1000, level: r1(P), usual: usual == null ? null : Math.round(usual * 100) / 100,
    yAt: r1(at(y)), yTotal: y ? y.T : 0, wAt: r1(at(w)), wTotal: w ? w.T : 0,
    learned: past.filter((r) => r.cum).length, knobs: { hl, k },
    today: now && now.cum ? now.cum.slice(0, Math.ceil(t)).map((c) => Math.round(c * now.T * 10) / 10) : null,
    yest: curve(y), week: curve(w),
    shape: Array.from({ length: H }, (_, i) => Math.round(shareAt(past, ref, g, i + 1) * 1000) / 1000),
  };
}

// days: analytics_days docs ({d, n, h, visitors, ...}); joined: sign-up times (ms) of the accounts the page counts
exports.forecast = ({ days, joined = [], now = Date.now() }) => {
  const today = dayIL(new Date(now)), [hh, mm] = hmIL(new Date(now)), t = hh + mm / 60, ref = dayNo(today);
  const have = Object.fromEntries(days.map((d) => [d.d, d]));
  const first = Math.max(ref - WINDOW, Math.min(...days.map((d) => dayNo(d.d)), ref));
  // the accounts as day docs of their own: total + hours
  const jd = {};
  for (const ms of joined) {
    const d = dayIL(new Date(ms)), [h] = hmIL(new Date(ms));
    (jd[d] ||= { T: 0, h: {} }).T++;
    jd[d].h[h] = (jd[d].h[h] || 0) + 1;
  }
  const out = {};
  for (const [m, spec] of Object.entries(METRICS)) {
    const recs = [];
    for (let no = first; no <= ref; no++) {
      const d = fromNo(no), doc = have[d] || { d, n: {} };
      const T = spec ? spec.total(doc) : jd[d]?.T || 0, hours = spec ? spec.hours(doc) : jd[d]?.h;
      recs.push({ no, d, g: groupOf(d), T, cum: cumOf(hours) });
    }
    out[m] = one(recs, today, t);
  }
  return { at: now, day: today, t: Math.round(t * 100) / 100, metrics: out };
};
exports._test = { cumOf, cumAt, shareAt, levelOf, project };
