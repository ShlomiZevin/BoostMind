# every screen inside the game in the start screen's kit: a wooden frame with a parchment face (9-slice, grows with its
# content), a sign plaque for its heading, the wooden signs as buttons; the record badge's words placed on its measured face
import os
G = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'public', 'night-guy-games', 'garden')
p = os.path.join(G, 'index.html'); s = open(p, encoding='utf-8').read()
def rep(a, b):
    global s
    assert a in s, 'MISSING ' + a[:90]
    s = s.replace(a, b, 1)

a = s.index('<div class="screen" id="night">'); b = s.index('<script src="game.js')
s = s[:a] + """<div class="screen kit" id="night">
  <div class="panel">
    <div class="sign head"><span id="nightBig">לילה 2</span></div>
    <p class="p-sub" id="nightDid"></p>
    <p class="p-goal" id="nightGoal"></p>
    <button class="sign play" id="nightBtn"><span>ממשיכים</span></button>
  </div>
</div>

<div class="screen kit" id="over">
  <div class="panel">
    <div class="sign head"><span id="overH">נתפסת!</span></div>
    <img class="p-pic" id="overImg" src="assets/guy-caught.webp" alt="">
    <p class="p-say" id="overLine"></p>
    <div class="p-score" id="overScore">0<small>נקודות</small></div>
    <div id="overRec"></div>
    <p class="p-sub" id="bestOver"></p>
    <button class="sign play" id="againBtn"><span>עוד לילה</span></button>
    <button class="sign mid" id="menuBtn"><span>לתפריט</span></button>
  </div>
</div>

<div class="screen kit" id="paused">
  <div class="panel">
    <div class="sign head"><span>עצרנו</span></div>
    <div class="p-quote"><img src="assets/face.jpg" alt=""><p>עצרנו? מעולה. אז תגידי, את אוהבת רילסים?</p></div>
    <button class="sign play" id="resumeBtn"><span>ממשיכים</span></button>
    <button class="sign mid" id="quitBtn"><span>יציאה לתפריט</span></button>
  </div>
</div>

<div id="tutDim"><div id="tutHole"></div></div>
<div id="tutCard" class="panel">
  <div id="tutText"></div>
  <div id="tutBar"><i></i></div>
  <div id="tutRow">
    <span id="tutCount"></span>
    <button id="tutSkip">דלגו <span class="keyhint">(Esc)</span></button>
    <button id="tutNext" class="sign mid">הבא <span class="keyhint">(רווח)</span></button>
  </div>
</div>
""" + s[b:]

CSS = r"""
/* the inside screens - the same kit as the start screen */
.screen.kit{background:radial-gradient(ellipse at 50% 45%,#140d24aa,#0d0818ee 70%);gap:0}
.panel{box-sizing:border-box;position:relative;width:min(92vw,400px);border-style:solid;border-width:clamp(34px,5.4vh,46px);border-image:url(assets/ui/panel-tall.webp) 118 fill / clamp(34px,5.4vh,46px) stretch;
  display:flex;flex-direction:column;align-items:center;gap:clamp(8px,1.8vh,14px);padding:clamp(22px,4vh,34px) 6px 4px;color:#4a2410;text-align:center;filter:drop-shadow(0 14px 30px #000b)}
.sign.head{background-image:url(assets/ui/sign-mid.webp);position:absolute;top:calc(clamp(34px,5.4vh,46px) * -1 - 6px);left:50%;transform:translateX(-50%);width:min(60vw,240px);aspect-ratio:420/162;font-size:clamp(20px,3.6vh,28px);cursor:default}
.sign.head:active{transform:translateX(-50%)}
.p-sub{margin:0;font-size:clamp(14px,2.3vh,17px);font-weight:700;color:#6b3a17;line-height:1.35}
.p-sub b{color:#a0410d}
.p-goal{margin:0;font-size:clamp(17px,2.8vh,21px);font-weight:900;color:#4a2410;line-height:1.3}
.p-say,.p-quote p{margin:0;font-size:clamp(14px,2.3vh,17px);font-weight:700;line-height:1.4;color:#4a2410}
.p-quote{display:flex;align-items:center;gap:10px;text-align:right}
.p-quote img{width:48px;height:48px;border-radius:50%;object-fit:cover;border:3px solid #8a4a1c;flex:none}
.p-pic{height:clamp(80px,17vh,150px);object-fit:contain;filter:drop-shadow(0 6px 10px #0006)}
.p-score{font-size:clamp(40px,7.5vh,58px);font-weight:900;color:#b45309;text-shadow:0 2px 0 #fff8e6,0 3px 0 #7c2d12;line-height:1}
.p-score small{display:block;font-size:clamp(12px,1.9vh,15px);color:#6b3a17;text-shadow:none;font-weight:700;margin-top:4px}
.panel .newrec{background:#15803d;color:#fff;font-size:16px;padding:4px 14px;border-radius:12px;box-shadow:0 2px 0 #14532d}
.panel .sign.play{width:min(70vw,290px,42vh);font-size:clamp(22px,4.2vh,32px)}
.panel .sign.mid{width:min(48vw,190px,30vh)}
@media (max-height:600px){.p-pic{display:none}}
/* the tutorial card */
#tutCard.panel{display:none;right:auto;position:fixed;left:50%;transform:translateX(-50%);width:min(96vw,460px);padding:6px 4px 0;gap:6px;border-width:30px;border-image-width:30px;max-width:none;margin:0;background:none;box-shadow:none;border-radius:0}
#tutCard.panel.on{display:flex}
#tutCard.panel #tutText{font-size:15px;line-height:1.35;color:#4a2410;text-align:right;align-self:stretch;min-height:0}
#tutCard.panel #tutText b{color:#a0410d}
#tutCard.panel #tutBar{align-self:stretch;height:7px;background:#e8d5b0;border-radius:4px;margin:2px 0}
#tutCard.panel #tutBar i{background:linear-gradient(90deg,#b45309,#f59e0b)}
#tutCard.panel #tutRow{align-self:stretch;display:flex;align-items:center;gap:8px}
#tutCard.panel #tutCount{flex:1;color:#8a5a33;font-size:13px;font-weight:700;text-align:right}
#tutCard.panel #tutSkip{background:none;color:#8a5a33;font-size:14px;font-weight:700;padding:6px}
#tutCard.panel #tutNext{width:120px;font-size:17px;border-radius:0;padding:0;background-color:transparent}
#tutCard.panel #tutNext:disabled{filter:grayscale(.9) brightness(.8);cursor:default}
"""
rep("html:not(.in-verse) .verse-only{display:none!important}", CSS + "html:not(.in-verse) .verse-only{display:none!important}")
# the record badge: the words on the face measured in badge-record.webp (43%-85% across, 24%-78% down)
rep(".rec span{position:absolute;left:38%;right:11%;top:16%;bottom:16%;", ".rec span{position:absolute;left:43%;right:15%;top:24%;bottom:22%;")
s = s.replace('game.js?v=6"', 'game.js?v=7"')
open(p, 'w', encoding='utf-8').write(s)

j = os.path.join(G, 'game.js'); t = open(j, encoding='utf-8').read()
for a, b in [("'״כל הגינה מכירה אותי. אני שואל בשביל לדעת.״'", "'כל הגינה מכירה אותי. אני שואל בשביל לדעת.'"),
             ("'״היה לילה טוב. יש לי עוד המון שאלות קטנות.״'", "'היה לילה טוב. יש לי עוד המון שאלות קטנות.'"),
             ("'״אבל רק שאלתי שאלה קטנה!״'", "'אבל רק שאלתי שאלה קטנה!'")]:
    assert a in t, a; t = t.replace(a, b)
# words that must fit their painted piece shrink until they do
t = t.replace("layout(); hud(); showBest(); requestAnimationFrame(frame);",
"""// words on painted pieces: shrink until they fit the piece's face (the record badge, the signs)
function fitWords() {
  document.querySelectorAll('.rec span').forEach((el) => {
    el.style.fontSize = ''; el.querySelectorAll('small,b').forEach((x) => { x.style.fontSize = ''; });
    for (let k = 0; k < 12 && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1); k++) {
      const f = parseFloat(getComputedStyle(el).fontSize) * 0.92; el.style.fontSize = f + 'px';
      el.querySelectorAll('small,b').forEach((x) => { x.style.fontSize = parseFloat(getComputedStyle(x).fontSize) * 0.92 + 'px'; });
    }
  });
}
addEventListener('resize', fitWords);
layout(); hud(); showBest(); fitWords(); document.fonts && document.fonts.ready.then(fitWords); requestAnimationFrame(frame);""")
t = t.replace("function showBest() {", "function showBest() { setTimeout(fitWords, 0);")
open(j, 'w', encoding='utf-8').write(t)
print('ok')
