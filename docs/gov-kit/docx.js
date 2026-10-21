// Builds an editable RTL Word file from a kit markdown source.
// Usage: NODE_PATH=<dir with docx>/node_modules node docs/gov-kit/docx.js <key> <slug> <out.docx>
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType,
  HeadingLevel, LevelFormat, AlignmentType, BorderStyle, Footer, PageNumber,
} = require('docx');
const FIG_DATA = require('./figs').DATA;
const HOURS = require('./hours');

const [key, slug, outFile] = process.argv.slice(2);
const ROOT = path.join(__dirname, '..', '..');
const md = fs.readFileSync(path.join(__dirname, 'out', key + '.md'), 'utf8').replace(/\r/g, '');
const FONT = 'Arial';
const W = 9638; // A4 minus 2cm margins, DXA

// inline **bold** -> runs; every run is RTL so Word lays the line out right-to-left
function runs(text, opts = {}) {
  return text.split(/(\*\*.+?\*\*)/).filter(Boolean).map(part => {
    const bold = /^\*\*.+\*\*$/.test(part);
    return new TextRun({
      text: bold ? part.slice(2, -2) : part, bold: bold || opts.bold, rightToLeft: true,
      font: { ascii: FONT, hAnsi: FONT, cs: FONT }, size: opts.size || 22, sizeComplexScript: opts.size || 22, color: opts.color,
    });
  });
}
const para = (text, o = {}) => new Paragraph({ bidirectional: true, spacing: { after: 120, line: 320 }, ...o.p, children: runs(text, o) });

function table(head, rows) {
  const n = head.length;
  const widths = n === 2 ? [2300, W - 2300] : n === 3 ? [2400, 2200, W - 4600] : n === 10 ? [W - 9 * 800, 800, 800, 800, 800, 800, 800, 800, 800, 800] : Array(n).fill(Math.floor(W / n));
  const border = { style: BorderStyle.SINGLE, size: 4, color: '9AA0AA' };
  const borders = { top: border, bottom: border, left: border, right: border };
  const cell = (t, i, isHead) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA }, borders,
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    shading: isHead ? { type: ShadingType.CLEAR, fill: 'EEF1F5', color: 'auto' } : undefined,
    children: [new Paragraph({ bidirectional: true, spacing: { after: 0, line: 290 }, children: runs(t || '', { bold: isHead || i === 0, size: 20 }) })],
  });
  return new Table({
    visuallyRightToLeft: true, width: { size: W, type: WidthType.DXA }, columnWidths: widths,
    rows: [new TableRow({ tableHeader: true, children: head.map((h, i) => cell(h, i, true)) }),
      ...rows.map(r => new TableRow({ cantSplit: true, children: head.map((_, i) => cell(r[i], i, false)) }))],
  });
}

// Timeline as a native table: one row per phase, one column per month, shaded cells for the phase span
function ganttTable({ months, rows }) {
  const n = months.length, labelW = 3000, mW = Math.floor((W - labelW) / n);
  const widths = [labelW, ...Array(n).fill(mW)];
  widths[0] = W - mW * n;
  const border = { style: BorderStyle.SINGLE, size: 4, color: '9AA0AA' };
  const borders = { top: border, bottom: border, left: border, right: border };
  const cell = (t, i, o = {}) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA }, borders, margins: { top: 50, bottom: 50, left: 60, right: 60 },
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined,
    children: [new Paragraph({ bidirectional: true, alignment: i === 0 ? undefined : AlignmentType.CENTER, spacing: { after: 0 }, children: runs(t || '', { bold: o.bold, size: i === 0 ? 19 : 16, color: o.color }) })],
  });
  return new Table({
    visuallyRightToLeft: true, width: { size: W, type: WidthType.DXA }, columnWidths: widths,
    rows: [new TableRow({ tableHeader: true, children: [cell('שלב', 0, { fill: 'EEF1F5', bold: true }), ...months.map((m, k) => cell(m, k + 1, { fill: 'EEF1F5', bold: true }))] }),
      ...rows.map(([label, a, b, note, kind]) => new TableRow({ cantSplit: true, children: [cell(label, 0, { bold: true }),
        ...months.map((_, k) => {
          const on = k + 1 >= a && k + 1 <= b;
          const fill = !on ? undefined : kind === 'ms' ? '14161A' : kind === 'soft' ? 'DCE7F5' : '3F6FB0';
          return cell(on && k + 1 === a ? (note || '') : '', k + 1, { fill, color: kind === 'soft' ? '14161A' : 'FFFFFF', bold: true });
        })] }))],
  });
}

(async () => {
  const lines = md.split('\n');
  const out = [];
  let i = 0, h2n = 0;
  while (i < lines.length) {
    const l = lines[i].trim();
    if (!l) { i++; continue; }
    if (l.startsWith('# ')) { out.push(new Paragraph({ bidirectional: true, spacing: { after: 80 }, children: runs(l.slice(2), { bold: true, size: 40 }) })); i++; continue; }
    if (l.startsWith('>> ')) { out.push(para(l.slice(3), { size: 24, color: '555B66', p: { spacing: { after: 280 } } })); i++; continue; }
    if (l.startsWith('## ')) {
      h2n++;
      out.push(new Paragraph({ heading: HeadingLevel.HEADING_1, bidirectional: true, pageBreakBefore: h2n > 1, spacing: { before: 240, after: 160 }, children: runs(l.slice(3), { bold: true, size: 30, color: '1F3B63' }) }));
      i++; continue;
    }
    if (l.startsWith('### ')) {
      const t = l.slice(4);
      const newPage = /^פרויקט \d|^פרויקטים נוספים/.test(t) && !/^פרויקט 1/.test(t);
      out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, bidirectional: true, pageBreakBefore: newPage, keepNext: true, spacing: { before: 280, after: 120 }, children: runs(t, { bold: true, size: 25, color: '14161A' }) }));
      i++; continue;
    }
    if (l.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const r = lines[i].trim();
        if (!/^\|[\s:|-]+\|$/.test(r)) rows.push(r.replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
        i++;
      }
      out.push(table(rows[0], rows.slice(1).filter(r => r.join('|') !== rows[0].join('|'))));
      out.push(new Paragraph({ bidirectional: true, spacing: { after: 120 }, children: [] }));
      continue;
    }
    if (l.startsWith('- ') || l.startsWith('+ ')) {
      while (i < lines.length && /^[-+] /.test(lines[i].trim())) {
        out.push(new Paragraph({ bidirectional: true, numbering: { reference: 'bul', level: 0 }, spacing: { after: 60, line: 310 }, children: runs(lines[i].trim().slice(2)) }));
        i++;
      }
      continue;
    }
    if (l === '[[calc:hours]]') {
      const hpd = HOURS.hoursPerDay, nf = v => v.toLocaleString('en-US');
      let tq = 0, th = 0, td = 0;
      const body = HOURS.rows.map(([t, b, a, d]) => { const q = b + a; tq += q; th += q * d * hpd; td += q * d; return [t, b, a, q, '', '', nf(q * d * hpd), d, q * d, d * hpd]; });
      out.push(new Paragraph({ bidirectional: true, spacing: { after: 100 }, children: runs('שעות ליום עבודה: ' + hpd, { bold: true, size: 20 }) }));
      out.push(table(['המשימה', 'כמות בסיס', 'כמות נוספת', 'סה"כ', 'מחיר יחידה', 'מחיר כולל', 'שעות כולל תמיכה ובדיקות', 'ימים ליחידה (SLA)', 'ימים כולל', 'שעות ליחידה'],
        [...body.map(r => r.map(String)), ['סה"כ', '', '', String(tq), '', '', nf(th), '', nf(td), '']]));
      out.push(new Paragraph({ bidirectional: true, spacing: { after: 120 }, children: [] }));
      i++; continue;
    }
    const fm = l.match(/^\[\[fig:([\w-]+)\]\]$/);
    if (fm) {
      const f = FIG_DATA[fm[1]];
      if (f) {
        out.push(new Paragraph({ bidirectional: true, keepNext: true, spacing: { before: 200, after: 100 }, children: runs(f.title, { bold: true, size: 21, color: '555B66' }) }));
        out.push(f.type === 'gantt' ? ganttTable(f) : table(['שכבה', 'רכיבים'], f.layers.map(([name, boxes]) => [name, boxes.join(' · ')])));
        out.push(new Paragraph({ bidirectional: true, spacing: { after: 120 }, children: [] }));
      }
      i++; continue;
    }
    if (l.startsWith(':::')) { i++; continue; }
    out.push(para(l)); i++;
  }

  const doc = new Document({
    creator: 'Shlomi Zevin', title: 'שלומי זוין: כלים, ניסיון ופרויקטים',
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    numbering: { config: [{ reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 500, hanging: 260 } } } }] }] },
    sections: [{
      properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ['שלומי זוין · shlomi@boostart.io · 054-5567213 · ', PageNumber.CURRENT], size: 16, color: '777777', rightToLeft: true, font: { ascii: FONT, hAnsi: FONT, cs: FONT } })] })] }) },
      children: out,
    }],
  });
  fs.writeFileSync(outFile, await Packer.toBuffer(doc));
  console.log('wrote', outFile, 'blocks:', out.length);
})();
