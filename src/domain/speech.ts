/**
 * Evaluation of speech-recognition transcripts (Speaking Mode).
 *
 * IMPORTANT: this compares RECOGNISED WORDS with the expected answer. It is not
 * a pronunciation assessment and must never be presented as one (no scores
 * for sounds, no percentages for pronunciation quality).
 */
import { checkAnswer, type CheckResult } from './answerCheck';
import type { Grade } from './types';

const CONTRACTIONS: [RegExp, string][] = [
  [/\bcan't\b/g, 'cannot'],
  [/\bcan not\b/g, 'cannot'],
  [/\bwon't\b/g, 'will not'],
  [/\bshan't\b/g, 'shall not'],
  [/\blet's\b/g, 'let us'],
  [/\b(\w+)n't\b/g, '$1 not'],
  [/\bi'm\b/g, 'i am'],
  [/\b(you|we|they)'re\b/g, '$1 are'],
  [/\b(i|you|we|they)'ve\b/g, '$1 have'],
  [/\b(i|you|we|they|he|she|it|that|there)'ll\b/g, '$1 will'],
  [/\b(i|you|we|they|he|she)'d\b/g, '$1 would'],
  [/\b(it|that|what|there|here|who|he|she)'s\b/g, '$1 is'],
];

const NUMBERS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

/** Canonical spoken form: lower case, straight apostrophes, contractions expanded, small numbers as words. */
export function normalizeSpoken(s: string): string {
  let t = s.toLowerCase().replace(/[‘’ʼ`´]/g, "'");
  for (const [re, rep] of CONTRACTIONS) t = t.replace(re, rep);
  t = t.replace(/\b(\d{1,2})\b/g, (m, d: string) => NUMBERS[Number(d)] ?? m);
  return t;
}

export interface SpeechEvaluation {
  /** The transcript alternative that matched best. */
  transcript: string;
  check: CheckResult;
  /** FSRS grade proposal: correct on 1st attempt → Good, later → Hard, wrong → Again. */
  grade: Grade;
}

const RANK = { correct: 0, almost: 1, wrong: 2 } as const;

/**
 * Pick the best of the recogniser's alternatives and compare it with all
 * accepted answers. Typo tolerance stays on, because recognisers sometimes
 * pick a near-homophone (e.g. "there"/"their").
 */
export function evaluateSpeech(transcripts: string[], accepted: string[], attempt: number): SpeechEvaluation {
  const candidates = transcripts.map((t) => t.trim()).filter(Boolean);
  const targets = accepted.map(normalizeSpoken);
  let best: SpeechEvaluation | null = null;
  for (const t of candidates.length ? candidates : ['']) {
    const check = checkAnswer(normalizeSpoken(t), targets, { typoTolerance: true });
    // show the original accepted spelling instead of the normalised one
    const idx = targets.indexOf(check.target);
    const shown = { ...check, target: idx >= 0 ? accepted[idx] : check.target };
    if (!best || RANK[shown.verdict] < RANK[best.check.verdict]) {
      best = { transcript: t, check: shown, grade: 1 };
    }
  }
  const b = best!;
  b.grade = b.check.verdict === 'correct' ? (attempt <= 1 ? 3 : 2) : b.check.verdict === 'almost' ? 2 : 1;
  return b;
}
