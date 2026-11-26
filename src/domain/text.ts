/** Text helpers: normalisation, edit distance and word diffs. Pure functions. */

const APOSTROPHES = /[‘’‛′´`]/g;
const QUOTES = /[“”„‟«»"]/g;
const DASHES = /[‐-―]/g;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Strip control characters and normalise unicode for storage. */
export function cleanText(s: unknown, max = 2000): string {
  if (typeof s !== 'string') return '';
  return s.replace(CONTROL, '').normalize('NFC').replace(/[ \t]+/g, ' ').trim().slice(0, max);
}

/** Canonical form used for comparison and duplicate detection. */
export function normalize(s: string): string {
  return s
    .normalize('NFC')
    .replace(APOSTROPHES, "'")
    .replace(QUOTES, '"')
    .replace(DASHES, '-')
    .toLowerCase()
    .replace(/[.,!?;:"()[\]{}…]/g, ' ')
    .replace(/\s+-\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Key for duplicate detection: normalised text without a leading "to ". */
export function itemKey(english: string): string {
  return normalize(english).replace(/^to /, '');
}

export function tokenize(s: string): string[] {
  const n = normalize(s);
  return n ? n.split(' ') : [];
}

/** Optimal string alignment distance (Damerau-Levenshtein with adjacent swaps). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array<number>(n + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

/** How many character edits still count as a "small typo" for a target length. */
export function typoBudget(len: number): number {
  if (len <= 3) return 0;
  if (len <= 7) return 1;
  if (len <= 14) return 2;
  return Math.min(6, Math.floor(len * 0.12));
}

export type DiffKind = 'ok' | 'typo' | 'missing' | 'extra' | 'wrong';
export interface DiffToken {
  kind: DiffKind;
  /** What the learner wrote (for ok/typo/extra/wrong). */
  given?: string;
  /** What was expected (for ok/typo/missing/wrong). */
  expected?: string;
}

/**
 * Word-level diff between a given answer and the expected answer, based on
 * the longest common subsequence. Unmatched neighbours are paired as typo
 * (close) or wrong (different).
 */
export function wordDiff(given: string, expected: string): DiffToken[] {
  const g = tokenize(given);
  const e = tokenize(expected);
  const m = g.length;
  const n = e.length;
  const L: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      L[i][j] = g[i] === e[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    }
  }
  const out: DiffToken[] = [];
  let i = 0;
  let j = 0;
  const pendingExtra: string[] = [];
  const pendingMissing: string[] = [];
  const flush = () => {
    while (pendingExtra.length && pendingMissing.length) {
      const gx = pendingExtra.shift()!;
      const ex = pendingMissing.shift()!;
      const close = editDistance(gx, ex) <= Math.max(1, typoBudget(ex.length));
      out.push({ kind: close ? 'typo' : 'wrong', given: gx, expected: ex });
    }
    for (const gx of pendingExtra.splice(0)) out.push({ kind: 'extra', given: gx });
    for (const ex of pendingMissing.splice(0)) out.push({ kind: 'missing', expected: ex });
  };
  while (i < m && j < n) {
    if (g[i] === e[j]) {
      flush();
      out.push({ kind: 'ok', given: g[i], expected: e[j] });
      i++;
      j++;
    } else if (L[i + 1][j] >= L[i][j + 1]) {
      pendingExtra.push(g[i++]);
    } else {
      pendingMissing.push(e[j++]);
    }
  }
  while (i < m) pendingExtra.push(g[i++]);
  while (j < n) pendingMissing.push(e[j++]);
  flush();
  return out;
}

/** Expand optional parts in parentheses: "make (a) decision" → both variants. */
export function expandOptional(s: string): string[] {
  const m = s.match(/\(([^()]{1,30})\)/);
  if (!m || m.index === undefined) return [s];
  const before = s.slice(0, m.index);
  const after = s.slice(m.index + m[0].length);
  const withPart = expandOptional(before + m[1] + after);
  const withoutPart = expandOptional((before + after).replace(/\s+/g, ' '));
  return Array.from(new Set([...withPart, ...withoutPart]));
}

export function shuffle<T>(arr: T[], rnd: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
