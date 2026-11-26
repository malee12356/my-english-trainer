import { describe, expect, it } from 'vitest';
import { acceptedAnswers, checkAnswer, compareTranscript } from '../../src/domain/answerCheck';
import { editDistance, expandOptional, itemKey, wordDiff } from '../../src/domain/text';

const item = {
  english: 'to take into account',
  german: 'berücksichtigen',
  alternatives_en: ['to consider', 'to bear (something) in mind'],
  alternatives_de: ['beachten'],
};

describe('accepted answers depend on direction', () => {
  it('uses English alternatives only for DE→EN and German ones only for EN→DE', () => {
    expect(acceptedAnswers(item, 'de-en')).toEqual(['to take into account', 'to consider', 'to bear something in mind', 'to bear in mind']);
    expect(acceptedAnswers(item, 'en-de')).toEqual(['berücksichtigen', 'beachten']);
  });
});

describe('checkAnswer', () => {
  const de2en = acceptedAnswers(item, 'de-en');
  it('accepts exact answers ignoring case, punctuation and surrounding spaces', () => {
    const r = checkAnswer('  To take into account. ', de2en);
    expect(r.verdict).toBe('correct');
    expect(r.grade).toBe(3);
    expect(r.notes).toContain('punctuation');
  });
  it('accepts a missing infinitive "to" with a note', () => {
    const r = checkAnswer('take into account', de2en);
    expect(r.verdict).toBe('correct');
    expect(r.notes).toContain('missing-to');
  });
  it('accepts context-specific alternatives and notes it', () => {
    const r = checkAnswer('to consider', de2en);
    expect(r.verdict).toBe('correct');
    expect(r.notes).toContain('alternative');
    expect(r.target).toBe('to consider');
  });
  it('accepts optional parts in brackets', () => {
    expect(checkAnswer('to bear in mind', de2en).verdict).toBe('correct');
  });
  it('marks small typos as "almost" (graded Hard), never silently correct', () => {
    const r = checkAnswer('to take into acount', de2en);
    expect(r.verdict).toBe('almost');
    expect(r.grade).toBe(2);
    expect(r.diff.find((d) => d.kind === 'typo')).toEqual({ kind: 'typo', given: 'acount', expected: 'account' });
  });
  it('does not accept typos when typo tolerance is off', () => {
    expect(checkAnswer('to take into acount', de2en, { typoTolerance: false }).verdict).toBe('wrong');
  });
  it('rejects wrong answers and unrelated synonyms', () => {
    expect(checkAnswer('to calculate', de2en).verdict).toBe('wrong');
    expect(checkAnswer('', de2en).verdict).toBe('wrong');
  });
  it('treats short words strictly (no typo budget for ≤3 letters)', () => {
    expect(checkAnswer('cat', ['car']).verdict).toBe('wrong');
  });
  it('handles typographic apostrophes', () => {
    expect(checkAnswer('I’m not entirely sure about that', ["I'm not entirely sure about that."]).verdict).toBe('correct');
  });
  it('handles German articles leniently in EN→DE', () => {
    expect(checkAnswer('Spannung', ['die Spannung'], { lang: 'de' }).verdict).toBe('correct');
    expect(checkAnswer('die Dehnung', ['Dehnung'], { lang: 'de' }).verdict).toBe('correct');
  });
  it('notes case differences in proper nouns', () => {
    const r = checkAnswer('ansys', ['ANSYS']);
    expect(r.verdict).toBe('correct');
    expect(r.notes).toContain('case');
  });
});

describe('text helpers', () => {
  it('computes edit distance with transpositions', () => {
    expect(editDistance('recieve', 'receive')).toBe(1);
    expect(editDistance('', 'abc')).toBe(3);
  });
  it('builds a word diff with missing, extra and wrong words', () => {
    const d = wordDiff('we need take this in account', 'We need to take this into account.');
    expect(d.map((x) => x.kind)).toEqual(['ok', 'ok', 'missing', 'ok', 'ok', 'wrong', 'ok']);
    expect(wordDiff('we need to tak this', 'we need to take this')[3]).toEqual({ kind: 'typo', given: 'tak', expected: 'take' });
    const e = wordDiff('the stress is very high', 'the stress is high');
    expect(e.filter((x) => x.kind === 'extra')).toEqual([{ kind: 'extra', given: 'very' }]);
  });
  it('expands nested optional parts', () => {
    expect(expandOptional('make (a) decision').sort()).toEqual(['make a decision', 'make decision']);
  });
  it('produces stable duplicate keys', () => {
    expect(itemKey('To take into account.')).toBe(itemKey('take into account'));
  });
  it('compares transcripts word by word without scoring pronunciation', () => {
    const r = compareTranscript('the maximum stress occurs near the contact', 'The maximum stress occurs near the contact area.');
    expect(r.matchedWords).toBe(7);
    expect(r.totalWords).toBe(8);
    expect(r.diff.at(-1)).toEqual({ kind: 'missing', expected: 'area' });
  });
});
