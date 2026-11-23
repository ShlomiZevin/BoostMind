// Travel agent's SerpApi helper (Google Flights + Google Hotels). Prices in ILS.
// Key: env SERPAPI_KEY, else c:\tmp\flight-scan\key.txt (NEVER put the key in git).
//   node serp.mjs quota
//   node serp.mjs flights TLV FRA 2026-12-15 2026-12-18 [--adults 1] [--any-stops]
//       every nonstop outbound, every return for it, and the airline's own fare options (fare name, bags) for the 2 cheapest returns
//   node serp.mjs hotels "Strasbourg, France" 2026-12-15 2026-12-18 --center 48.5818,7.7509 [--km 1.5] [--min 4.3] [--stars 4,5]
//       good hotels for 2 adults, cheapest first, price per person; lists the hotels Google shows WITHOUT a price (usually sold out)
// Google prices are a lead, not the truth: validate the pick on the airline's / hotel's own site or Booking before reporting it.
import fs from 'node:fs';

const KEY = process.env.SERPAPI_KEY || (() => { try { return fs.readFileSync('c:/tmp/flight-scan/key.txt', 'utf8').trim(); } catch { return ''; } })();
if (!KEY) { console.error('No SerpApi key: set SERPAPI_KEY or put it in c:/tmp/flight-scan/key.txt'); process.exit(1); }
const [cmd, ...rest] = process.argv.slice(2);
const flag = (n, d) => { const i = rest.indexOf('--' + n); return i < 0 ? d : (rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[i + 1] : true); };
const pos = rest.filter((a, i) => !a.startsWith('--') && !(i > 0 && rest[i - 1].startsWith('--') && rest[i - 1] !== '--any-stops'));
const get = async p => (await fetch('https://serpapi.com/search.json?' + new URLSearchParams({ ...p, api_key: KEY }))).json();
const km = (a, b, c, d) => { const r = x => x * Math.PI / 180; const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2; return 2 * 6371 * Math.asin(Math.sqrt(h)); };
const hm = t => (t || '').slice(11);

async function quota() {
  const j = await (await fetch('https://serpapi.com/account.json?api_key=' + KEY)).json();
  console.log(`searches left this month: ${j.plan_searches_left} of ${j.searches_per_month} (renews ${j.plan_renewal_date})`);
}

async function flights() {
  const [from, to, out, back] = pos;
  const base = { engine: 'google_flights', departure_id: from, arrival_id: to, outbound_date: out, return_date: back, type: '1', adults: String(flag('adults', 1)), currency: 'ILS', hl: 'en', gl: 'il' };
  if (!flag('any-stops', false)) base.stops = '1';            // stops=1 means NONSTOP in SerpApi
  const j = await get(base);
  if (j.error) return console.log(j.error);
  const outs = [].concat(j.best_flights || [], j.other_flights || []).filter(i => i.price);
  for (const it of outs) {
    const f = it.flights[0];
    console.log(`\nOUT ${f.airline} ${f.flight_number} ${out} ${hm(f.departure_airport.time)} -> ${hm(f.arrival_airport.time)}  (round trip from ₪${it.price} pp)`);
    const rj = await get({ ...base, departure_token: it.departure_token });
    const rets = [].concat(rj.best_flights || [], rj.other_flights || []).filter(i => i.price).sort((a, b) => a.price - b.price);
    for (const [n, x] of rets.entries()) {
      const g = x.flights[0];
      console.log(`   back ${g.airline} ${g.flight_number} ${back} ${hm(g.departure_airport.time)} -> ${hm(g.arrival_airport.time)}  ₪${x.price} pp`);
      if (n < 2 && x.booking_token) {
        const b = await get({ ...base, booking_token: x.booking_token });
        for (const bo of b.booking_options || []) {
          const t = bo.together || bo.departing || {};
          console.log(`        ${t.book_with}: ₪${t.price} ${t.option_title || ''} ${(t.baggage_prices || []).join(', ')}`);
        }
      }
    }
  }
  console.log(`\nGoogle Flights: ${(j.search_metadata || {}).google_flights_url || ''}`);
}

async function hotels() {
  const [q, ci, co] = pos;
  const [la, ln] = String(flag('center', '')).split(',').map(Number);
  const maxKm = +flag('km', 2.5), minR = +flag('min', 4.3);
  const p = new URLSearchParams({ engine: 'google_hotels', q, check_in_date: ci, check_out_date: co, adults: '2', currency: 'ILS', hl: 'en', gl: 'il', hotel_class: String(flag('stars', '3,4,5')), rating: '8', api_key: KEY });
  const all = [];
  for (let page = 0; page < 3; page++) {
    const j = await (await fetch('https://serpapi.com/search.json?' + p)).json();
    if (j.error) { console.log(j.error); break; }
    for (const h of j.properties || []) {
      const g = h.gps_coordinates || {};
      all.push({ name: h.name, rating: h.overall_rating, reviews: h.reviews, cls: h.extracted_hotel_class, total: (h.total_rate || {}).extracted_lowest,
        km: la && g.latitude ? +km(la, ln, g.latitude, g.longitude).toFixed(2) : null, link: h.link, bfast: (h.amenities || []).filter(a => /breakfast/i.test(a)).join('/') });
    }
    const t = (j.serpapi_pagination || {}).next_page_token; if (!t) break; p.set('next_page_token', t);
  }
  const seen = new Set();
  const ok = all.filter(h => !seen.has(h.name) && seen.add(h.name))
    .filter(h => (h.rating || 0) >= minR && (h.reviews || 0) >= 100 && (h.km == null || h.km <= maxKm) && !/hostel|apart|adagio|résidence|residence|citadines/i.test(h.name));
  console.log(`${ci} -> ${co}, 2 adults, ${flag('stars', '3,4,5')}★, Google ${minR}+, <= ${maxKm} km (prices = whole stay; pp = half a room)\n`);
  ok.filter(h => h.total).sort((a, b) => a.total - b.total)
    .forEach(h => console.log(`  ₪${Math.round(h.total / 2)} pp (room ₪${h.total})  ${h.cls || '?'}★ ${h.rating} (${h.reviews})  ${h.km ?? '?'} km  ${h.name}  [${h.bfast}]  ${h.link || ''}`));
  const none = ok.filter(h => !h.total);
  if (none.length) console.log(`\n  No price on Google (usually sold out - check Booking / their site): ${none.map(h => h.name).join('; ')}`);
}

const run = { quota, flights, hotels }[cmd];
if (!run) { console.log('usage: node serp.mjs quota | flights FROM TO OUT BACK | hotels "City" IN OUT --center lat,lng'); process.exit(1); }
await run();
