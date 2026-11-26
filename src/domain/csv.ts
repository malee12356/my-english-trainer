/** Minimal RFC 4180 CSV parser/serialiser (comma, semicolon or tab separated). */

export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const counts = [',', ';', '\t'].map((d) => ({ d, n: countOutsideQuotes(firstLine, d) }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 0 ? counts[0].d : ',';
}

function countOutsideQuotes(line: string, d: string): number {
  let inQ = false;
  let n = 0;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === d && !inQ) n++;
  }
  return n;
}

export function parseCsv(input: string, delimiter?: string): string[][] {
  const text = input.replace(/^﻿/, '');
  const d = delimiter ?? detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === '') inQuotes = true;
    else if (ch === d) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Parse CSV with a header row into objects keyed by (lower-cased) header. */
export function parseCsvObjects(input: string): Record<string, string>[] {
  const rows = parseCsv(input);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return rows.slice(1).map((r) => {
    const o: Record<string, string> = {};
    header.forEach((h, i) => {
      if (h) o[h] = (r[i] ?? '').trim();
    });
    return o;
  });
}

function escapeCell(v: string): string {
  // Neutralise spreadsheet formula injection when the file is opened in Excel/Numbers.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",;\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(header: string[], rows: string[][]): string {
  return [header, ...rows].map((r) => r.map((c) => escapeCell(c ?? '')).join(',')).join('\r\n') + '\r\n';
}
