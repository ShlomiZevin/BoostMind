// Editable bank-of-hours calculator for the Telos page. Self-contained HTML + script; edits are kept in the viewer's browser.
const H = require('./hours');

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

module.exports = function hoursCalc(xlsxHref) {
  const rows = H.rows.map(([task, base, add, days], i) => `
      <tr data-i="${i}">
        <td class="c-task">${esc(task)}</td>
        <td><input type="number" min="0" step="1" data-f="base" value="${base}" aria-label="כמות בסיס"></td>
        <td><input type="number" min="0" step="1" data-f="add" value="${add}" aria-label="כמות נוספת"></td>
        <td class="c-out" data-o="qty"></td>
        <td><input type="number" min="0" step="any" data-f="price" value="" placeholder="₪" aria-label="מחיר יחידה"></td>
        <td class="c-out" data-o="ptotal"></td>
        <td class="c-out c-key" data-o="hours"></td>
        <td><input type="number" min="0" step="any" data-f="days" value="${days}" aria-label="ימים ליחידה"></td>
        <td class="c-out" data-o="dtotal"></td>
        <td class="c-out" data-o="hunit"></td>
      </tr>`).join('');

  return `
<div class="calc" id="hoursCalc">
  <div class="calc-bar">
    <label>שעות ליום עבודה <input type="number" min="1" step="0.5" id="hpd" value="${H.hoursPerDay}"></label>
    <div class="calc-actions">
      <button type="button" class="btn" id="calcCopy">העתקה לאקסל</button>
      <a class="btn" href="${xlsxHref}" download>הורדת Excel</a>
      <button type="button" class="btn" id="calcReset">איפוס</button>
    </div>
  </div>
  <div class="calc-wrap">
    <table class="calc-t">
      <thead><tr>
        <th>המשימה</th><th>כמות בסיס</th><th>כמות נוספת</th><th>סה"כ</th><th>מחיר יחידה</th><th>מחיר כולל</th>
        <th>שעות כולל תמיכה ובדיקות</th><th>ימים ליחידה (SLA)</th><th>ימים כולל (כמות × ימים)</th><th>שעות ליחידה</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr>
        <td>סה"כ</td><td data-t="base"></td><td data-t="add"></td><td data-t="qty"></td><td></td><td data-t="ptotal"></td>
        <td data-t="hours" class="c-key"></td><td></td><td data-t="days"></td><td></td>
      </tr></tfoot>
    </table>
  </div>
  <p class="calc-sum" id="calcSum"></p>
  <p class="calc-hint">התאים הלבנים ניתנים לעריכה. השינויים נשמרים בדפדפן שלך בלבד.</p>
</div>
<script>
(function(){
  var root=document.getElementById('hoursCalc'), K='telos-hours-v1', DEF=${JSON.stringify(H.rows.map(r => [r[1], r[2], r[3]]))}, HPD=${H.hoursPerDay};
  var nf=new Intl.NumberFormat('he-IL',{maximumFractionDigits:1});
  var money=new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS',maximumFractionDigits:0});
  var n=function(v){v=parseFloat(v);return isFinite(v)?v:0};
  var trs=[].slice.call(root.querySelectorAll('tbody tr')), hpd=document.getElementById('hpd');
  function save(){try{localStorage.setItem(K,JSON.stringify({hpd:hpd.value,rows:trs.map(function(tr){var o={};[].forEach.call(tr.querySelectorAll('input'),function(x){o[x.dataset.f]=x.value});return o})}))}catch(e){}}
  function load(){try{var s=JSON.parse(localStorage.getItem(K)||'null');if(!s)return;hpd.value=s.hpd;s.rows.forEach(function(o,i){if(!trs[i])return;[].forEach.call(trs[i].querySelectorAll('input'),function(x){if(o[x.dataset.f]!==undefined)x.value=o[x.dataset.f]})})}catch(e){}}
  function calc(){
    var h=n(hpd.value), T={base:0,add:0,qty:0,ptotal:0,hours:0,days:0}, anyPrice=false;
    trs.forEach(function(tr){
      var g=function(f){return n(tr.querySelector('[data-f="'+f+'"]').value)}, p=tr.querySelector('[data-f="price"]').value!=='';
      var base=g('base'),add=g('add'),qty=base+add,days=g('days'),price=g('price'),hu=days*h,hrs=qty*hu;
      var set=function(o,v){tr.querySelector('[data-o="'+o+'"]').textContent=v};
      set('qty',nf.format(qty));set('dtotal',nf.format(qty*days));set('hunit',nf.format(hu));set('hours',nf.format(hrs));set('ptotal',p?money.format(qty*price):'');
      T.base+=base;T.add+=add;T.qty+=qty;T.hours+=hrs;T.days+=qty*days;if(p){anyPrice=true;T.ptotal+=qty*price}
    });
    var st=function(k,v){root.querySelector('[data-t="'+k+'"]').textContent=v};
    st('base',nf.format(T.base));st('add',nf.format(T.add));st('qty',nf.format(T.qty));st('hours',nf.format(T.hours));
    st('days',nf.format(T.days)+' ימים');st('ptotal',anyPrice?money.format(T.ptotal):'');
    document.getElementById('calcSum').textContent='סה"כ '+nf.format(T.days)+' ימי עבודה, '+nf.format(T.hours)+' שעות'+(anyPrice?', '+money.format(T.ptotal):'')+'.';
  }
  root.addEventListener('input',function(){calc();save()});
  document.getElementById('calcReset').addEventListener('click',function(){
    hpd.value=HPD;trs.forEach(function(tr,i){tr.querySelector('[data-f="base"]').value=DEF[i][0];tr.querySelector('[data-f="add"]').value=DEF[i][1];tr.querySelector('[data-f="days"]').value=DEF[i][2];tr.querySelector('[data-f="price"]').value=''});
    try{localStorage.removeItem(K)}catch(e){}calc();
  });
  document.getElementById('calcCopy').addEventListener('click',function(){
    var head=['המשימה','כמות בסיס','כמות נוספת','סה"כ','מחיר יחידה','מחיר כולל','שעות כולל תמיכה ובדיקות'];
    var lines=[head.join('\\t')].concat(trs.map(function(tr){
      var v=function(f){return tr.querySelector('[data-f="'+f+'"]').value}, o=function(k){return tr.querySelector('[data-o="'+k+'"]').textContent.replace(/[^\\d.]/g,'')};
      return [tr.querySelector('.c-task').textContent,v('base'),v('add'),o('qty'),v('price'),o('ptotal'),o('hours')].join('\\t');
    }));
    var b=this, done=function(){b.textContent='הועתק';setTimeout(function(){b.textContent='העתקה לאקסל'},1600)};
    if(navigator.clipboard)navigator.clipboard.writeText(lines.join('\\n')).then(done,function(){});
  });
  load();calc();
})();
</script>`;
};
