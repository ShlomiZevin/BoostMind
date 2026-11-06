import { createRequire } from 'node:module';
const require = createRequire('c:/workspace/BoostMind/zoomcut/render/package.json'); const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--allow-file-access-from-files'] });
const p = await b.newPage(); await p.setViewport({ width: 900, height: 900, deviceScaleFactor: 2 });
await p.goto('file:///C:/Users/shazbak/AppData/Local/Temp/claude/c--workspace-BoostMind/2b909074-3c8a-43f4-bdbb-2f2d5ceb7904/scratchpad/mk.html', { waitUntil: 'networkidle0' }); await p.evaluateHandle('document.fonts.ready');
const D = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/next-plan/img/';
await (await p.$('#q5')).screenshot({ path: D + 'Q5-result.jpg', type: 'jpeg', quality: 88 });
await (await p.$('#q6')).screenshot({ path: D + 'Q6-share.jpg', type: 'jpeg', quality: 88 });
await b.close(); console.log('ok');
