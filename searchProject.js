// xplace-to-telegram.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/* ---------- Telegram config ---------- */
const TELEGRAM_TOKEN   = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/* ---------- XPlace fetch config ---------- */
const COOKIE = process.env.XPLACE_COOKIE || `zoom_CompanyID=undefined; zoom_UserID=undefined; _ga=GA1.1.1132076401.1736327948; _fbp=fb.1.1736327948431.26451797477672416; intercom-id-ocq4u0mn=c0e391a7-733f-4279-911c-7bd8bb16dfa8; intercom-device-id-ocq4u0mn=760efaa4-2d64-4a3a-a6f3-4c091df48804; _hjSessionUser_58991=eyJpZCI6IjA5NjEzMDhhLTc3N2UtNWYwMi1iZTk3LThjMDUzZTIxNmNkYiIsImNyZWF0ZWQiOjE3MzYzMjc5NDc3MTQsImV4aXN0aW5nIjp0cnVlfQ==; MARKETPLACE_LOCALE=il_he; MARKETPLACE_CURRENCY=ILS; __za_cd_19763617=%7B%22visits%22%3A%22%5B1757479002%2C1750051891%2C1749108395%2C1746184853%2C1742233881%2C1742131512%2C1742116353%2C1741244066%2C1739345921%2C1738736112%2C1737450161%5D%22%2C%22campaigns_status%22%3A%7B%2295939%22%3A1737265347%2C%2296267%22%3A1737012518%2C%2296913%22%3A1749108420%2C%2296914%22%3A1750051930%2C%2297233%22%3A1740746391%2C%2298270%22%3A1743440914%2C%2298993%22%3A1746026671%2C%22102007%22%3A1757480372%2C%22102103%22%3A1756650072%7D%7D; __za_19763617=%7B%22sId%22%3A2580971%2C%22dbwId%22%3A%221%22%2C%22sCode%22%3A%22f96a595873f360dfd6d7e200bf7398b0%22%2C%22sInt%22%3A5000%2C%22na%22%3A1%2C%22td%22%3A0%2C%22ca%22%3A%221%22%7D; _gcl_au=1.1.1842612015.1755496468.1285667641.1757513722.1757513725; __za_cds_19763617=%7B%22data_for_campaign%22%3A%7B%22country%22%3A%22IL%22%2C%22language%22%3A%22EN%22%2C%22ip%22%3A%2287.71.147.229%22%2C%22start_time%22%3A%222025-09-10T04%3A36%3A40.000Z%22%2C%22session_campaigns%22%3A%7B%22102007%22%3A%7B%22type%22%3A%22slide-in%22%2C%22occur%22%3A1%7D%7D%2C%22session_groups%22%3A%7B%223919%22%3A%7B%22campaign_Id%22%3A%22102007%22%7D%7D%7D%7D; SPRING_SECURITY_REMEMBER_ME_COOKIE=c2hhemJhazoxNzYwMDA3MzI5NDA2OmUzMmU1NWI3NGM3ZTg5ZTI5MzViODA3NjJiMDRkMjVi; _clck=1p8qa8x%5E2%5Efzm%5E0%5E1834; JSESSIONID=B20D4238DC5C85E6ED4ED66512CBD37B; SESSIONID=NGEwN2VhY2MtMzUxYy00MjcxLThmNzMtMGNhMjk2MTkyZGYx; _hjSession_58991=eyJpZCI6Ijc4NGE3OWE0LWE5NTktNDcxZS1iNGYzLWY5MTJlZWViYWMyYiIsImMiOjE3NTg4MTcyMzg5NTgsInMiOjAsInIiOjAsInNiIjowLCJzciI6MCwic2UiOjAsImZzIjowLCJzcCI6MH0=; intercom-session-ocq4u0mn=K2dFOWxnb3czSmtUdUFPM2p3bDRuK1BJSmc2TFhWazZiOFk5MnByWGdIeGQvVVYvK0xGOWdVT1BiaFJ4Slg1VjZ0VzkvdTBaS255UGFJNFlLbDNlSHJ5M2RnMUNIK1k3TEZxWVd3MUd0TG89LS1ja2Jtd3BqemcrV0FnaXBvT2Y4NVNRPT0=--6b9c2af44cfeff1ffa714f951aa5c2f3d6f7e06e; _clsk=4c2vca%5E1758819221447%5E3%5E1%5Eq.clarity.ms%2Fcollect; _ga_8PTBFWQM9V=GS2.1.s1758817237$o982$g1$t1758819223$j57$l0$h0`;

/* ---------- Storage for sent project IDs ---------- */
const SENT_FILE = path.join(__dirname, 'sent-projects.json');
let sentProjects = new Set();

// Load previously sent IDs
if (fs.existsSync(SENT_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(SENT_FILE, 'utf-8'));
    if (Array.isArray(data)) sentProjects = new Set(data);
  } catch (e) {
    console.error('⚠️ Failed to parse sent-projects.json, starting fresh.');
  }
}

function saveSentProjects() {
  fs.writeFileSync(SENT_FILE, JSON.stringify([...sentProjects], null, 2));
}

/* ---------- Telegram ---------- */
async function telegramNotifier(message) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  try {
    await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'Markdown'
    });
    console.log('✅ Sent to Telegram');
  } catch (err) {
    console.error('❌ Telegram notify failed:', err.response?.data || err.message);
  }
}

/* ---------- Helpers ---------- */
function cleanText(s = '') {
  return s
    .replace(/\r?\n|\r/g, ' ')        // remove line breaks
    .replace(/\s+/g, ' ')             // collapse whitespace
    .replace(/[^\p{L}\p{N}\p{P}\p{Z}]/gu, '') // strip weird Unicode
    .trim();
}

function formatProject(p) {
  const title = cleanText(p.searchRecommendedProjectTitle || 'ללא כותרת');
  const desc  = cleanText((p.searchRecommendedProjectDescription || '').trim()).slice(0, 1200);
  return `*${title}*\n${desc}`;
}

/* ---------- XPlace fetch ---------- */
async function fetchXPlaceProjects() {
  // Keep _ param dynamic to avoid caching
  const ts = Date.now();
  const url = `https://www.xplace.com/il/rest/user/v2/83673/projects/search/recommend/0/10?usg=WEB_SITE&brtz=Asia%2FJerusalem&_=${ts}`;

  try {
    const res = await axios.get(url, {
      headers: {
        "accept": "application/json",
        "accept-language": "en-US,en;q=0.9",
        "content-type": "application/json",
        "priority": "u=1, i",
        "sec-ch-ua": "\"Chromium\";v=\"140\", \"Not=A?Brand\";v=\"24\", \"Google Chrome\";v=\"140\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "x-requested-with": "XMLHttpRequest",
        "cookie": COOKIE,
        "Referer": "https://www.xplace.com/il/rec"
      }
    });

    return res.data?.responsePayload?.recommendedProjectsCollection || [];
  } catch (err) {
    console.error("❌ Error fetching projects:", err.response?.data || err.message);
    return [];
  }
}

/* ---------- Main ---------- */
async function runOnce() {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('❌ Missing TELEGRAM_TOKEN or TELEGRAM_CHAT_ID in .env');
    process.exit(1);
  }

  const projects = await fetchXPlaceProjects();
  if (!projects.length) {
    console.log('⚠️ No projects found.');
    return;
  }

  let newCount = 0;
  for (const p of projects) {
    const id = p.searchRecommendedProjectId;
    if (sentProjects.has(id)) continue; // skip already sent

    const msg = formatProject(p);
    await telegramNotifier(msg);

    sentProjects.add(id);
    newCount++;
  }

  if (newCount > 0) {
    saveSentProjects();
    console.log(`💾 Stored ${newCount} new projects.`);
  } else {
    console.log('ℹ️ No new projects.');
  }
}

/* ---------- Scheduler ---------- */
async function schedule() {
  await runOnce();

  const min = 10, max = 20;
  const minutes = Math.floor(Math.random() * (max - min + 1)) + min;
  const ms = minutes * 60 * 1000;

  console.log(`⏳ Next run in ${minutes} minutes`);
  setTimeout(schedule, ms);
}

/* ---------- Start ---------- */
schedule();
