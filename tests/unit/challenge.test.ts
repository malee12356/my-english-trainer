import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { challengeShareText, earnsReward, minutesEarnedToday, planChallenge } from '../../src/domain/challenge';
import { draftToItem, parseImport } from '../../src/domain/importer';
import { indexProgress } from '../../src/domain/planner';
import { applyReview, deterministicEngine, newProgress, setEngineForTests } from '../../src/domain/scheduler';
import type { Progress, StudySession } from '../../src/domain/types';

const NOW = new Date('2026-11-27T16:00:00');
beforeAll(() => setEngineForTests(deterministicEngine()));
afterAll(() => setEngineForTests(null));

const items = parseImport(JSON.stringify(Array.from({ length: 30 }, (_, i) => ({ english: `word${i}`, german: `Wort${i}` })))).rows.map((r, i) =>
  draftToItem(r.draft!, `w${i}`, new Date(NOW.getTime() - (100 - i) * 60_000).toISOString()),
);
const reviewed = (id: string, grade: 1 | 2 | 3 | 4, daysAgo: number, skill: Progress['skill'] = 'recall'): Progress => {
  const t = new Date(NOW.getTime() - daysAgo * 86_400_000);
  return applyReview(newProgress(id, skill, t), grade, t, { alreadyAnsweredInSession: false, responseMs: 1000 }).progress;
};
const strong = (id: string): Progress[] => (['comprehension', 'recall'] as const).map((s) => ({ ...reviewed(id, 4, 1, s), state: 2, stability: 60, lastGrade: 4 }));

describe('screen-time challenge', () => {
  it('picks weak words first, then unsure learned words, then new ones – never mastered words', () => {
    const progress = indexProgress([
      reviewed('w5', 1, 2), // weak (lapse/again)
      reviewed('w6', 3, 20), // learned, low recall probability
      reviewed('w7', 3, 1), // learned, still fresh
      ...strong('w8'), // mastered → excluded
    ]);
    const tasks = planChallenge(items, progress, NOW, 20);
    expect(tasks).toHaveLength(20);
    const ids = tasks.map((t) => t.itemId);
    expect(ids[0]).toBe('w5');
    expect(ids.indexOf('w6')).toBeLessThan(ids.indexOf('w7'));
    expect(ids.slice(3)).toEqual(expect.arrayContaining(['w0', 'w1']));
    expect(ids).not.toContain('w8');
    expect(tasks.every((t) => t.method === 'writing' && t.skill === 'writing' && t.direction === 'de-en')).toBe(true);
  });

  it('respects the number of words and the speaking answer mode', () => {
    const t = planChallenge(items, indexProgress([]), NOW, 5, 'speaking');
    expect(t).toHaveLength(5);
    expect(t.every((x) => x.method === 'speaking' && x.skill === 'speaking')).toBe(true);
    expect(planChallenge(items.map((i) => ({ ...i, archived: true })), indexProgress([]), NOW)).toHaveLength(0);
  });

  it('only exactly right written answers earn time; recognised speech counts', () => {
    expect([1, 2, 3, 4].map((g) => earnsReward(g as 1, 'writing'))).toEqual([false, false, true, true]);
    expect([1, 2, 3].map((g) => earnsReward(g as 1, 'speaking'))).toEqual([false, true, true]);
  });

  it('sums today’s earned minutes and builds the share text', () => {
    const s = (startedAt: string, rewardMinutes?: number, kind?: 'challenge'): StudySession => ({ id: startedAt, startedAt, activeMs: 0, topic: 'all', method: 'writing', answered: 20, correct: 10, kind, rewardMinutes });
    expect(minutesEarnedToday([s('2026-11-27T10:00:00', 12, 'challenge'), s('2026-11-27T12:00:00', 5, 'challenge'), s('2026-11-26T12:00:00', 9, 'challenge'), s('2026-11-27T13:00:00', 99)], NOW)).toBe(17);
    const text = challengeShareText({ total: 20, correct: 14, minutes: 14, wrong: [], answer: 'writing', finishedAt: NOW });
    expect(text).toContain('14 von 20 Wörtern richtig geschrieben');
    expect(text).toContain('Verdiente Spielzeit: 14 Minuten');
  });
});
