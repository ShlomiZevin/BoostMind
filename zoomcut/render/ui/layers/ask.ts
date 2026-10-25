// Our own "are you sure?" window (never the browser's confirm box - his ask, 2026-10-25): a title, a line, Cancel and
// one button. Enter = yes, Esc or a click outside = no. Resolves true / false.
//   if (await ask({ title: 'Delete the layer "Music"?', text: '1 clip goes with it. Ctrl+Z brings it back.', ok: 'Delete' })) ...
import './ask.css';

export function ask({ title, text = '', ok = 'OK', danger = true }: { title: string; text?: string; ok?: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'ask';
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
    wrap.innerHTML = `<div class="ask-box" role="dialog" aria-modal="true">
      <div class="ask-t">${esc(title)}</div>${text ? `<div class="ask-x">${esc(text)}</div>` : ''}
      <div class="ask-b"><button class="btn ask-no">Cancel</button><button class="btn ${danger ? 'ask-danger' : 'primary'} ask-yes">${esc(ok)}</button></div></div>`;
    const done = (v: boolean) => { removeEventListener('keydown', key, true); wrap.remove(); resolve(v); };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); }
      else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); done(true); }
      else e.stopPropagation();  // (the editor's own keys - Delete, Space - wait while it's open)
    };
    wrap.onmousedown = (e) => { if (e.target === wrap) done(false); };
    (wrap.querySelector('.ask-no') as HTMLElement).onclick = () => done(false);
    (wrap.querySelector('.ask-yes') as HTMLElement).onclick = () => done(true);
    addEventListener('keydown', key, true);
    document.body.appendChild(wrap);
    (wrap.querySelector('.ask-yes') as HTMLElement).focus();
  });
}
