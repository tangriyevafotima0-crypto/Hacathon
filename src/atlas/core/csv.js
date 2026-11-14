/** RFC 4180-style comma CSV; quoted commas/newlines/escaped quotes are supported. */
export function parseCSV(text) {
  if (typeof text !== 'string') throw new Error('CSV_TEXT_REQUIRED');
  const input = text.replace(/^\uFEFF/, '');
  const rows = []; let row = [], cell = '', quoted = false, closed = false;
  const field = () => { row.push(cell); cell = ''; closed = false; };
  const line = () => { field(); if (row.some(v => v !== '')) rows.push(row); row = []; };
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else cell += c;
    } else if (c === ',') field();
    else if (c === '\r' || c === '\n') { if (c === '\r' && input[i + 1] === '\n') i++; line(); }
    else if (c === '"') { if (cell || closed) throw new Error('CSV_UNEXPECTED_QUOTE'); quoted = true; }
    else { if (closed) throw new Error('CSV_CHAR_AFTER_QUOTE'); cell += c; }
  }
  if (quoted) throw new Error('CSV_UNCLOSED_QUOTE');
  if (cell || row.length || closed) line();
  if (!rows.length) throw new Error('CSV_EMPTY');
  const headers = rows.shift().map(h => h.trim());
  if (headers.some(h => !h || ['__proto__', 'constructor', 'prototype'].includes(h))) throw new Error('CSV_INVALID_HEADER');
  if (new Set(headers).size !== headers.length) throw new Error('CSV_DUPLICATE_HEADER');
  return rows.map((r, i) => {
    if (r.length !== headers.length) throw new Error(`CSV_COLUMN_COUNT:record ${i + 2}`);
    return Object.fromEntries(headers.map((h, j) => [h, r[j]]));
  });
}

export function writeCSV(rows) {
  if (!rows.length) return '';
  const headers = [...new Set(rows.flatMap(Object.keys))];
  const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [headers, ...rows.map(row => headers.map(h => row[h]))].map(r => r.map(quote).join(',')).join('\r\n') + '\r\n';
}
