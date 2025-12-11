// xplace-to-telegram-ai.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
require('dotenv').config();

/* ---------- Config ---------- */
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_ID = 'asst_cQ0rUZM3uHQXa5O6LXEMuNlW';
const COOKIE = process.env.XPLACE_COOKIE || `JSESSIONID=FCBEDB7D92FEDD2E256B456C08BFBFEA; SESSIONID=Zjk0ZmY2ZGUtNGVkZC00YzAyLWFhODctNmUxZjQ3YTFjNTY0; _hjSession_58991=eyJpZCI6ImRjODhlY2RmLTJjMTMtNDBkZS1hZTZiLTAyYjU4YmRhNGRhZCIsImMiOjE3NjAwNzM1NTQ5OTIsInMiOjAsInIiOjAsInNiIjowLCJzciI6MCwic2UiOjAsImZzIjoxLCJzcCI6MH0=; _ga=GA1.1.202707057.1760073555; _fbp=fb.1.1760073555373.65448866490917858; _clck=1t3s8a3%5E2%5Eg01%5E0%5E2109; __za_cd_19763617=%7B%22visits%22%3A%22%5B1760073555%5D%22%7D; __za_cds_19763617=%7B%22data_for_campaign%22%3A%7B%22country%22%3A%22IL%22%2C%22language%22%3A%22EN%22%2C%22ip%22%3A%225.29.12.68%22%2C%22start_time%22%3A%222025-10-10T05%3A19%3A14.000Z%22%2C%22session_groups%22%3A%7B%223919%22%3A%7B%22campaign_Id%22%3A%22102007%22%7D%7D%7D%7D; intercom-id-ocq4u0mn=2e52d1fe-244e-4819-9c7e-d2e1b9154c1f; intercom-device-id-ocq4u0mn=b7e8695c-c27c-4b19-a675-0ae62a910d08; __za_19763617=%7B%22sId%22%3A2642788%2C%22dbwId%22%3A%221%22%2C%22sCode%22%3A%22220e2270b5695682107594d110c37313%22%2C%22sInt%22%3A5000%2C%22na%22%3A1%2C%22td%22%3A1%2C%22ca%22%3A%221%22%7D; _gcl_au=1.1.578423436.1760073559.1145853252.1760073559.1760073561; SPRING_SECURITY_REMEMBER_ME_COOKIE=c2hhemJhazoxNzYxMjgzMTYxMjczOmJhNTA3Y2M3MmRhZjdjMDY3ZDIyYmJmMjBiMDg0ZWY1; MARKETPLACE_LOCALE=il_he; MARKETPLACE_CURRENCY=ILS; _hjSessionUser_58991=eyJpZCI6IjhkNjkzNWIwLTBjZjMtNTExNS04OGM4LWI3OWYyNWJmNzhjMCIsImNyZWF0ZWQiOjE3NjAwNzM1NTQ5OTIsImV4aXN0aW5nIjp0cnVlfQ==; _clsk=1f42vbp%5E1760073570921%5E3%5E1%5Ei.clarity.ms%2Fcollect; intercom-session-ocq4u0mn=N25aM1hpbHBaT1BNYkFDOVhEeDJwZE0wUjhBdkRzczFreHVGSGttd0ZRV28vUERBQ1FsLzduM1Q0dkIwcUYxWHBRWVB0WGxhUFcrQ2tIcmpTMlZyTWQ5bEtWZjRLd0pjeWFQV2lYUE5XMkk9LS0vZHlDc0FnK1VHZVB4VncxRW9OeXV3PT0=--b1cb25c355112bd891c9a871117557781e0f880f; _ga_8PTBFWQM9V=GS2.1.s1760073555$o1$g1$t1760073583$j32$l0$h0`;

/* ---------- Init ---------- */
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const headers = { headers: { 'OpenAI-Beta': 'assistants=v2' } };

/* ---------- Storage for sent project IDs ---------- */
const SENT_FILE = path.join(__dirname, 'sent-projects.json');
let sentProjects = new Set();

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
    .replace(/\r?\n|\r/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\p{P}\p{Z}]/gu, '')
    .trim();
}

function formatProject(p) {
  const title = cleanText(p.searchRecommendedProjectTitle || 'ללא כותרת');
  const desc = cleanText((p.searchRecommendedProjectDescription || '').trim()).slice(0, 1200);
  return `*${title}*\n${desc}`;
}

/* ---------- XPlace fetch ---------- */
async function fetchXPlaceProjects() {
  const ts = Date.now();
  const url = `https://www.xplace.com/il/rest/user/v2/83673/projects/search/recommend/0/50?usg=WEB_SITE&brtz=Asia%2FJerusalem&_=${ts}`;

  try {
    const res = await axios.get(url, {
      headers: {
        "accept": "application/json",
        "accept-language": "en-US,en;q=0.9",
        "content-type": "application/json",
        "priority": "u=1, i",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "x-requested-with": "XMLHttpRequest",
        "cookie": "zoom_CompanyID=undefined; zoom_UserID=undefined; _ga=GA1.1.202707057.1760073555; _fbp=fb.1.1760073555373.65448866490917858; intercom-id-ocq4u0mn=2e52d1fe-244e-4819-9c7e-d2e1b9154c1f; intercom-device-id-ocq4u0mn=b7e8695c-c27c-4b19-a675-0ae62a910d08; MARKETPLACE_LOCALE=il_he; MARKETPLACE_CURRENCY=ILS; _hjSessionUser_58991=eyJpZCI6IjhkNjkzNWIwLTBjZjMtNTExNS04OGM4LWI3OWYyNWJmNzhjMCIsImNyZWF0ZWQiOjE3NjAwNzM1NTQ5OTIsImV4aXN0aW5nIjp0cnVlfQ==; za_cookies_accepted=1; __za_19763617=%7B%22sId%22%3A2642788%2C%22dbwId%22%3A%221%22%2C%22sCode%22%3A%22220e2270b5695682107594d110c37313%22%2C%22sInt%22%3A5000%2C%22na%22%3A4%2C%22td%22%3A1%2C%22ca%22%3A%221%22%7D; _clck=1t3s8a3%5E2%5Eg19%5E0%5E2109; JSESSIONID=6CD87D2463F774B7F9BDEF7DAA134A87; SESSIONID=NjJiYjc1OTMtNjk2Yy00MjBjLTkyZjItMDJkZTE5N2VlNDE1; _hjSession_58991=eyJpZCI6ImQ5MDJjM2JiLTI5ODItNGI1OC04ODMyLWQ3NDQzZWQ4YWVhOCIsImMiOjE3NjM4OTk2MTQ0MzcsInMiOjAsInIiOjAsInNiIjowLCJzciI6MCwic2UiOjAsImZzIjowLCJzcCI6MH0=; _gcl_au=1.1.578423436.1760073559.856505380.1763899619.1763899622; SPRING_SECURITY_REMEMBER_ME_COOKIE=c2hhemJhazoxNzY1MTA5MjIyMDI1OmRlYWVmNmM3ZWYxOGM3OTRiNmE0Yjk0ZGUzNTE3N2Yy; _clsk=1a7qro0%5E1763899624457%5E2%5E1%5Eb.clarity.ms%2Fcollect; __za_cds_19763617=%7B%22data_for_campaign%22%3A%7B%22country%22%3A%22IL%22%2C%22language%22%3A%22EN%22%2C%22ip%22%3A%225.29.12.68%22%2C%22start_time%22%3A%222025-10-10T05%3A19%3A14.000Z%22%2C%22session_groups%22%3A%7B%223919%22%3A%7B%22campaign_Id%22%3A%22102007%22%7D%7D%2C%22session_campaigns%22%3A%7B%22102007%22%3A%7B%22type%22%3A%22slide-in%22%2C%22occur%22%3A1%7D%2C%22104237%22%3A%7B%22type%22%3A%22top-bar%22%2C%22occur%22%3A11%7D%7D%7D%7D; __za_cd_19763617=%7B%22visits%22%3A%22%5B1760073555%5D%22%2C%22historical_goals%22%3A%7B%226440.6442%22%3A1%7D%2C%22campaigns_status%22%3A%7B%22102007%22%3A1760789041%2C%22104237%22%3A1763899624%7D%7D; intercom-session-ocq4u0mn=ODB0RHluMkMzUEdRUXk2WmFHZEQzOUtldERkNkcwUzAvZDFrUVRkSnRIU00vZTVvdUo4NHNmWk4rSVRZNnZ3RU91anlJdjJvRzNSREl1a1IrNnF4N2J3WVAzS0VIdFdvTnlmN2lUMC84ZUk9LS13Q0xySHpJc1NEY1V6ZWdoaVRmN1pRPT0=--16c261c2af59018acb2d6e2b59e1fe09c07ff493; _ga_8PTBFWQM9V=GS2.1.s1763899613$o46$g1$t1763899640$j33$l0$h0",
        "Referer": "https://www.xplace.com/il/rec"
      }
    });

    return res.data?.responsePayload?.recommendedProjectsCollection || [];
  } catch (err) {
    console.error("❌ Error fetching projects:", err.response?.data || err.message);
    return [];
  }
}

/* ---------- OpenAI Assistant ---------- */
async function askAssistant(message) {
  try {
    // יצירת thread חדש
    const thread = await openai.beta.threads.create({}, headers);

    // מוסיפים את הטקסט של הפרויקט
    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: message
    }, headers);

    // מריצים את ה־assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANT_ID
    }, headers);

    // ממתינים שיסתיים
    for (let i = 0; i < 100; i++) {
      const status = await openai.beta.threads.runs.retrieve(thread.id, run.id, headers);
      if (status.status === 'completed') break;
      if (status.status === 'failed') throw new Error('Assistant run failed');
      await new Promise(r => setTimeout(r, 200));
    }

    // מקבלים את התשובה
    const messages = await openai.beta.threads.messages.list(thread.id, {
      order: 'desc',
      limit: 1
    }, headers);

    return messages.data[0].content
      .filter(item => item.type === 'text')
      .map(item => item.text.value)
      .join('\n');
  } catch (err) {
    console.error('❌ OpenAI Assistant error:', err.message);
    return null;
  }
}

/* ---------- Main ---------- */
async function runOnce() {
  const projects = await fetchXPlaceProjects();
  if (!projects.length) {
    console.log('⚠️ No projects found.');
    return;
  }

  let newCount = 0;
  for (const p of projects) {
    const id = p.searchRecommendedProjectId;
    if (sentProjects.has(id)) continue;

    const msg = formatProject(p);

    // 1. Send the project info
    await telegramNotifier(msg);

    // 2. Small delay before asking assistant
    await new Promise(r => setTimeout(r, 1000));

    // 3. Ask assistant
    const aiReply = await askAssistant(msg);

    if (aiReply) {
      await telegramNotifier(`🤖 *Assistant Reply:*\n${aiReply}`);
    }

    sentProjects.add(id);
    newCount++;

    // 4. Delay before moving to next project (avoid overlap in Telegram)
    await new Promise(r => setTimeout(r, 1000));
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

  const min = 3, max = 6;
  const minutes = Math.floor(Math.random() * (max - min + 1)) + min;
  const ms = minutes * 60 * 1000;

  console.log(`⏳ Next run in ${minutes} minutes`);
  setTimeout(schedule, ms);
}

/* ---------- Start ---------- */
schedule();
