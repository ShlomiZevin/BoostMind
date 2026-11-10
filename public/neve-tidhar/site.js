// the phone menu on the inner pages (the home page has its own copy inline)
const burger = document.getElementById('burger'), menu = document.getElementById('menu');
burger.onclick = () => { const on = menu.classList.toggle('on'); burger.setAttribute('aria-expanded', on); burger.setAttribute('aria-label', on ? 'סגירת תפריט ניווט' : 'פתיחת תפריט ניווט'); };
menu.addEventListener('click', (e) => { if (e.target.closest('a') && innerWidth < 760) { menu.classList.remove('on'); burger.setAttribute('aria-expanded', false); } });
