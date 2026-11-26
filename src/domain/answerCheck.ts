import type { Direction, Grade, Item } from './types';
import { editDistance, expandOptional, normalize, typoBudget, wordDiff, type DiffToken } from './text';

export type Verdict = 'correct' | 'almost' | 'wrong';

export interface CheckResult {
  verdict: Verdict;
  /** The accepted answer that matched best. */
  target: string;
  diff: DiffToken[];
  /** Human-readable hints (German + English keys resolved in UI). */
  notes: CheckNote[];
  /** Suggested FSRS grade derived from the verdict. */
  grade: Grade;
}

export type CheckNote = 'case' | 'punctuation' | 'missing-to' | 'alternative' | 'typo' | 'article';

/** All answers that are accepted for a given direction (context-specific!). */
export function acceptedAnswers(item: Pick<Item, 'english' | 'german' | 'alternatives_en' | 'alternatives_de'>, direction: Direction): string[] {
  const main = direction === 'de-en' ? item.english : item.german;
  const alts = direction === 'de-en' ? item.alternatives_en : item.alternatives_de;
  const all = [main, ...alts].flatMap(expandOptional).filter((s) => s.trim().length > 0);
  return Array.from(new Set(all));
}

const PUNCT = /[.,!?;:"'()…‘’“”]/g;
const DE_ARTICLE = /^(der|die|das|ein|eine) /;

/**
 * Compare a typed answer with the accepted answers.
 * - case is ignored (noted if it differs, e.g. proper nouns or "I")
 * - punctuation differences are ignored (noted)
 * - a missing infinitive "to" is accepted (noted)
 * - small typos are "almost" (graded Hard), never silently correct
 */
export function checkAnswer(
  given: string,
  accepted: string[],
  opts: { typoTolerance?: boolean; lang?: 'en' | 'de' } = {},
): CheckResult {
  const typoTolerance = opts.typoTolerance ?? true;
  const g = normalize(given);
  let best: { target: string; dist: number; notes: CheckNote[]; idx: number } | null = null;

  accepted.forEach((target, idx) => {
    const notes: CheckNote[] = [];
    let t = normalize(target);
    let gg = g;
    if (opts.lang !== 'de' && t.startsWith('to ') && !gg.startsWith('to ')) {
      t = t.slice(3);
      notes.push('missing-to');
    }
    if (opts.lang === 'de' && DE_ARTICLE.test(t) && !DE_ARTICLE.test(gg)) {
      t = t.replace(DE_ARTICLE, '');
      notes.push('article');
    }
    if (opts.lang === 'de' && !DE_ARTICLE.test(t) && DE_ARTICLE.test(gg)) {
      gg = gg.replace(DE_ARTICLE, '');
    }
    const dist = editDistance(gg, t);
    if (!best || dist < best.dist) best = { target, dist, notes, idx };
  });

  if (!best || !g) {
    const target = accepted[0] ?? '';
    return { verdict: 'wrong', target, diff: wordDiff(given, target), notes: [], grade: 1 };
  }
  const b = best as { target: string; dist: number; notes: CheckNote[]; idx: number };
  const notes = [...b.notes];
  if (b.idx > 0) notes.push('alternative');

  const rawGiven = given.trim().replace(/\s+/g, ' ');
  const rawTarget = b.target.trim();
  if (b.dist === 0) {
    if (rawGiven.replace(PUNCT, '').toLowerCase() === rawTarget.replace(PUNCT, '').toLowerCase()) {
      if (rawGiven.replace(PUNCT, '') !== rawTarget.replace(PUNCT, '') && /[A-Z]/.test(rawTarget)) notes.push('case');
    }
    if (rawGiven.replace(/[^.,!?;:]/g, '') !== rawTarget.replace(/[^.,!?;:]/g, '')) notes.push('punctuation');
    return { verdict: 'correct', target: b.target, diff: wordDiff(given, b.target), notes, grade: 3 };
  }

  const tn = normalize(b.target);
  if (typoTolerance && b.dist <= typoBudget(tn.length)) {
    notes.push('typo');
    return { verdict: 'almost', target: b.target, diff: wordDiff(given, b.target), notes, grade: 2 };
  }
  return { verdict: 'wrong', target: b.target, diff: wordDiff(given, b.target), notes, grade: 1 };
}

/** Compare a speech transcript with an expected sentence (word level only). */
export function compareTranscript(transcript: string, expected: string): { diff: DiffToken[]; matchedWords: number; totalWords: number } {
  const diff = wordDiff(transcript, expected);
  const totalWords = diff.filter((d) => d.expected !== undefined).length;
  const matchedWords = diff.filter((d) => d.kind === 'ok').length;
  return { diff, matchedWords, totalWords };
}
