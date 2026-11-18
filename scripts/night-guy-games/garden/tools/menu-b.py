# the start screen, design B: the tall painting full screen, title on top, the buttons as wooden park signs, spaced
import os, re
D = os.path.dirname(__file__)
G = os.path.join(D, '..', '..', '..', '..', 'public', 'night-guy-games', 'garden')
p = os.path.join(G, 'index.html'); s = open(p, encoding='utf-8').read()
# CSS: drop the old start-screen rules (lines 100-111 region), keep the rest
a = s.index("#start{gap:clamp(8px,2vh,18px)}"); b = s.index("@media (max-height:460px){#start .sub{display:none}}") + len("@media (max-height:460px){#start .sub{display:none}}")
CSS = r"""/* the start screen - design B: the painting is the screen, the buttons are signs from the night park */
#start{justify-content:space-between;gap:8px;padding:calc(var(--safe-t) + 8px) 12px calc(var(--safe-b) + 12px);background:url(assets/ui/start-bg.jpg) center 30%/cover no-repeat,#0d0818}
#start::after{content:'';position:absolute;inset:0;background:linear-gradient(#0d081870,transparent 24%,transparent 50%,#0d0818cc 86%,#0d0818f0);pointer-events:none}
#start>*{position:relative;z-index:1}
@media (min-aspect-ratio:4/5){#start{background:url(assets/ui/start-bg.jpg) center top/auto 100% no-repeat,radial-gradient(ellipse at 50% 40%,#2a1850,#0d0818 70%)}}
.st-top{display:flex;flex-direction:column;align-items:center;gap:2px}
.st-title{width:min(78vw,380px,46vh);filter:drop-shadow(0 6px 14px #000c)}
.st-bottom{display:flex;flex-direction:column;align-items:center;gap:clamp(10px,2.2vh,20px);width:100%}
.st-row{display:flex;gap:clamp(10px,3vw,18px);justify-content:center;align-items:center}
.st-foot{display:flex;justify-content:space-between;align-items:center;width:min(100%,420px);padding:0 2px}
.sign{all:unset;box-sizing:border-box;position:relative;display:grid;place-items:center;background:center/100% 100% no-repeat;cursor:pointer;color:#fff4dc;font-family:Rubik,system-ui,sans-serif;font-weight:900;line-height:1;text-shadow:0 2px 0 #5a2a0a,0 3px 8px #000b;transition:transform .12s;-webkit-tap-highlight-color:transparent;text-decoration:none}
.sign:active{transform:scale(.94)}
.sign:focus-visible{outline:3px solid #facc15;outline-offset:3px;border-radius:20px}
.sign.play{background-image:url(assets/ui/sign-play.webp);width:min(78vw,370px,50vh);aspect-ratio:640/213;font-size:clamp(26px,5.4vh,42px);animation:breathe 2.4s ease-in-out infinite}
.sign.play span{margin-top:-4%}
.sign.mid{background-image:url(assets/ui/sign-mid.webp);width:min(42vw,190px,30vh);aspect-ratio:420/162;font-size:clamp(14px,2.4vh,18px)}
.sign.back{background-image:url(assets/ui/sign-back.webp);width:min(46vw,215px,33vh);aspect-ratio:520/161;font-size:clamp(13px,2.2vh,16px)}
.sign.back span{padding:0 33% 0 10%;text-align:center;line-height:1.05}
.sign.thin{background-image:url(assets/ui/sign-thin.webp);width:min(52vw,230px,34vh);aspect-ratio:420/115;font-size:clamp(13px,2.2vh,16px);cursor:default;margin-top:-6px}
.sign.thin:active{transform:none}
.rec{background:url(assets/ui/badge-record.webp) center/100% 100% no-repeat;width:min(33vw,140px,22vh);aspect-ratio:420/198;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 8% 0 34%;color:#fff4dc;font-weight:900;text-shadow:0 2px 0 #5a2a0a;line-height:1.05}
.rec small{font-size:clamp(10px,1.7vh,12px);font-weight:700;opacity:.92}
.rec b{font-size:clamp(15px,2.8vh,21px);color:#fde68a}
.sign.snd{background-image:url(assets/ui/btn-sound.webp);width:clamp(48px,9vh,64px);aspect-ratio:420/344}
.sign.snd.off{filter:grayscale(.8) brightness(.75)}
.sign.snd.off::after{content:'';position:absolute;left:22%;right:22%;top:48%;height:9%;background:#ef4444;border-radius:4px;transform:rotate(-40deg);box-shadow:0 0 0 2px #5a2a0a}
@media (max-height:520px){.sign.thin{display:none}}"""
s = s[:a] + CSS + s[b:]
a = s.index('<div class="screen on" id="start">'); b = s.index('<div class="screen" id="night">')
HTML = """<div class="screen on" id="start">
  <div class="st-top">
    <img class="st-title" src="assets/title.png" alt="פסיכופת גינה">
    <div class="sign thin"><span>יש לו שאלה קטנה</span></div>
  </div>
  <div class="st-bottom">
    <button class="sign play" id="playBtn"><span>שחקו</span></button>
    <div class="st-row">
      <button class="sign mid" id="howBtn"><span>איך משחקים</span></button>
      <button class="sign back verse-only" data-verse-back aria-label="חזרה למשחקים"><span>חזרה<br>למשחקים</span></button>
      <a class="sign mid verse-hide" href="/c/night-guy" target="_top"><span>בשלומיוורס ←</span></a>
    </div>
    <div class="st-foot">
      <div class="rec" id="bestStart"></div>
      <button class="sign snd sndBtn painted" aria-label="צליל"></button>
    </div>
  </div>
</div>

"""
s = s[:a] + HTML + s[b:]
s = s.replace('game.js?v=3"', 'game.js?v=4"')
open(p, 'w', encoding='utf-8').write(s)
# game.js: the painted sound button toggles a class; the record badge shows a short number
j = os.path.join(G, 'game.js'); t = open(j, encoding='utf-8').read()
old = "function sndIcons() { document.querySelectorAll('.sndBtn').forEach((b) => { b.innerHTML = SND.on ? SPK : MUTE; }); }"
assert old in t
t = t.replace(old, "function sndIcons() { document.querySelectorAll('.sndBtn').forEach((b) => { if (b.classList.contains('painted')) b.classList.toggle('off', !SND.on); else b.innerHTML = SND.on ? SPK : MUTE; }); }")
old = "$('bestStart').innerHTML = b ? `השיא שלכם: <b>${b}</b>` + (td ? ` · היום: <b>${td}</b>` : '') : 'כמה מהגינה יהיה שלו הלילה?';"
assert old in t
t = t.replace(old, "$('bestStart').innerHTML = `<small>${td ? 'השיא היום' : 'השיא שלך'}</small><b>${(td || b || 0).toLocaleString('en-US')}</b>`;")
open(j, 'w', encoding='utf-8').write(t)
print('ok')
