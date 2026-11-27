// The Reader's script parser - ONE copy, used by the Reader page (render/reader/index.html) and by sessions
// (`node tools/reader_check.mjs <project|script.txt>` prints exactly what the Reader will show).
// Splits a pasted script into speakers and lines. Understands "Name: text", "**Name:** text", lines that
// wrap onto the next line, [stage directions] / (stage directions), and screenplay layout (the name alone on a line,
// the text under it). Every line keeps `rows`: the rows of the file it came from - so editing, moving or deleting a
// line changes only those rows and the rest of the file stays as it was written (notes, blank rows, layout).
// A monologue (no "Name:" lines) = every line its own bubble - the Reader becomes a prompter.
// 2026-11-27 (frankfurt-flight - "I don't have any text", the second time that week): a direction with a colon in it,
// "(ברקע: כריזה ...)", counted as a "Name:" line, the script became a dialogue and every plain spoken line vanished.
// Now a direction never counts as a speaker, and a script is a dialogue only when "Name:" lines are a real part of
// what is said (at least a quarter of the spoken rows) - a stray colon in one line ("שימו לב: ...") stays a line.
(function (root) {
  const isDir = (r) => /^\[.*\]$/.test(r) || /^\(.*\)$/.test(r);
  const nameOf = (r) => { const m = r.replace(/\*\*/g, '').match(/^([^:：]{1,24})[:：]/); return m && m[1].trim().split(/\s+/).length <= 3 ? m : null; };
  function parse(text) {
    const rows = text.split(/\r?\n/).map((r, k) => ({ r: r.trim(), k })).filter(({ r }) => r && !r.startsWith('#'));
    const spoken = rows.filter(({ r }) => !isDir(r));
    const named = spoken.filter(({ r }) => nameOf(r));
    if (rows.length && (named.length === 0 || named.length < spoken.length / 4))
      return rows.map(({ r, k }) => (isDir(r) ? { dir: true, text: r.slice(1, -1), rows: [k] } : { who: '', text: r, solo: true, rows: [k] }));
    const out = [];
    let pending = null;  // a name standing alone on its line, waiting for its text {who, k}
    for (const { r: raw, k } of rows) {
      if (isDir(raw)) { out.push({ dir: true, text: raw.slice(1, -1), rows: [k] }); continue; }
      const clean = raw.replace(/\*\*/g, '');
      const m = clean.match(/^([^:：]{1,24})[:：]\s*(.*)$/);
      if (m && m[1].trim().split(/\s+/).length <= 3) {
        if (m[2].trim()) { out.push({ who: m[1].trim(), text: m[2].trim(), rows: [k] }); pending = null; }
        else pending = { who: m[1].trim(), k };  // "Name:" alone - the text comes next
        continue;
      }
      if (pending) { out.push({ who: pending.who, text: clean, rows: [pending.k, k] }); pending = null; continue; }
      const words = clean.split(/\s+/);
      if (words.length <= 2 && !/[.!?,—–-]$/.test(clean) && clean.length <= 18) { pending = { who: clean, k }; continue; }  // screenplay name
      const last = out[out.length - 1];
      if (last && !last.dir) { last.text += ' ' + clean; last.rows.push(k); }  // a wrapped line
    }
    return out;
  }
  root.parseScript = parse;
})(typeof window !== 'undefined' ? window : globalThis);
