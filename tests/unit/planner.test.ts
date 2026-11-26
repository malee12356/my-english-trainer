import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { draftToItem, parseImport } from '../../src/domain/importer';
import { builderSource, gapSource, indexProgress, itemStatus, planSession, weakness, type PlanOptions } from '../../src/domain/planner';
import { applyReview, deterministicEngine, newProgress, setEngineForTests } from '../../src/domain/scheduler';
import { activeDaySet, addDays, dailyStats, dayKey, longestStreak, methodStats, streak, weeklyErrorRate } from '../../src/domain/stats';
import { buildPrompt, DEFAULT_PROMPT_OPTIONS } from '../../src/domain/promptBuilder';
import { STARTER_CONTENT } from '../../src/data/starter';
import type { Item, Progress, ReviewLog } from '../../src/domain/types';

const NOW = new Date('2026-11-26T09:00:00');
beforeAll(() => setEngineForTests(deterministicEngine()));
afterAll(() => setEngineForTests(null));

const items: Item[] = parseImport(JSON.stringify(STARTER_CONTENT)).rows.map((r, i) =>
  draftToItem(r.draft!, `item-${i}`, new Date(NOW.getTime() - (100 - i) * 1000).toISOString()),
);
const seq = (() => {
  let s = 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
})();
const base: PlanOptions = {
  topic: 'all', method: 'auto', minutes: 10, now: NOW, newPerDay: 10, newIntroducedToday: 0,
  flashcardDirection: 'random', ttsAvailable: true, rnd: seq,
};

function reviewed(itemId: string, skill: Progress['skill'], daysAgo: number, grade: 1 | 2 | 3 | 4 = 3): Progress {
  const t = addDays(NOW, -daysAgo);
  return applyReview(newProgress(itemId, skill, t), grade, t, { alreadyAnsweredInSession: false, responseMs: 2000 }).progress;
}

describe('session planner', () => {
  it('introduces at most newPerDay new items and fits the time budget', () => {
    const tasks = planSession(items, new Map(), { ...base, minutes: 30 });
    const fresh = tasks.filter((t) => t.isNew);
    expect(fresh.length).toBe(10);
    expect(fresh.every((t) => t.method === 'flashcards' && t.direction === 'en-de' && t.skill === 'comprehension')).toBe(true);
    const tasks2 = planSession(items, new Map(), { ...base, minutes: 30, newIntroducedToday: 8 });
    expect(tasks2.filter((t) => t.isNew)).toHaveLength(2);
  });

  it('puts due reviews first and never schedules the same item twice', () => {
    const prog = indexProgress([reviewed('item-0', 'comprehension', 30), reviewed('item-1', 'recall', 30), reviewed('item-2', 'comprehension', 0)]);
    const tasks = planSession(items, prog, { ...base, minutes: 5 });
    const ids = tasks.map((t) => t.itemId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('item-0');
    expect(ids).toContain('item-1');
    const t1 = tasks.find((t) => t.itemId === 'item-1')!;
    expect(t1.skill).toBe('recall');
    expect(t1.direction).toBe('de-en');
    // item-2 was reviewed today and is not due → not a regular review
    const t2 = tasks.find((t) => t.itemId === 'item-2');
    if (t2) expect(t2.practice || t2.isNew).toBe(true);
  });

  it('respects the topic filter and archived items', () => {
    const archived = items.map((i) => (i.categories.includes('meeting') && i.english.startsWith('Could') ? { ...i, archived: true } : i));
    const tasks = planSession(archived, new Map(), { ...base, topic: 'meeting', minutes: 45, newPerDay: 100 });
    const byId = new Map(archived.map((i) => [i.id, i]));
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((t) => byId.get(t.itemId)!.categories.includes('meeting') && !byId.get(t.itemId)!.archived)).toBe(true);
  });

  it('fixed method mode: writing tasks use the writing skill; builder only for sentences', () => {
    const w = planSession(items, new Map(), { ...base, method: 'writing', minutes: 10 });
    expect(w.every((t) => t.method === 'writing' && t.skill === 'writing' && t.direction === 'de-en')).toBe(true);
    const b = planSession(items, new Map(), { ...base, method: 'builder', minutes: 45, newPerDay: 100 });
    expect(b.every((t) => builderSource(items.find((i) => i.id === t.itemId)!) !== null)).toBe(true);
  });

  it('listening is only planned when speech output is available', () => {
    expect(planSession(items, new Map(), { ...base, method: 'listening', ttsAvailable: false })).toHaveLength(0);
    expect(planSession(items, new Map(), { ...base, method: 'listening', ttsAvailable: true }).length).toBeGreaterThan(0);
  });

  it('weakness mode only contains weak items, weakest first', () => {
    const prog = indexProgress([reviewed('item-3', 'recall', 2, 1), reviewed('item-4', 'recall', 2, 2)]);
    const tasks = planSession(items, prog, { ...base, topic: 'weakness', minutes: 20 });
    const ids = tasks.map((t) => t.itemId);
    expect(ids[0]).toBe('item-3');
    for (const id of ids) {
      const it = items.find((i) => i.id === id)!;
      expect(weakness(it, prog.get(id)).score).toBeGreaterThan(0);
    }
  });

  it('unlocks the recall skill after comprehension was learned', () => {
    const prog = indexProgress([reviewed('item-5', 'comprehension', 0, 4)]);
    const tasks = planSession(items.filter((i) => i.id === 'item-5'), prog, { ...base, minutes: 5 });
    expect(tasks[0]).toMatchObject({ itemId: 'item-5', skill: 'recall', isNew: true });
  });
});

describe('item helpers', () => {
  const meet = items.find((i) => i.english === 'to take into account')!;
  it('builds gap-fill and builder sources', () => {
    expect(gapSource(meet)).toMatchObject({ before: 'We need to take this into ', answer: 'account', after: '.' });
    const bc = items.find((i) => i.english === 'boundary conditions')!;
    expect(gapSource(bc)).toMatchObject({ before: 'We need to check the ', answer: 'boundary conditions', after: ' before we rerun the model.' });
    const sent = items.find((i) => i.english === 'The solution has not converged yet.')!;
    expect(gapSource(sent)).toMatchObject({ answer: 'converged' });
    expect(builderSource(meet)).toEqual({ sentence: 'to take into account', german: 'berücksichtigen' });
    const single = items.find((i) => i.english === 'warm-up')!;
    expect(gapSource(single)).toBeNull();
  });
  it('classifies item status', () => {
    expect(itemStatus(meet, undefined, NOW).status).toBe('new');
    const weak = indexProgress([reviewed(meet.id, 'recall', 1, 1)]);
    expect(itemStatus(meet, weak.get(meet.id), NOW).status).toBe('difficult');
    const learning = indexProgress([reviewed(meet.id, 'recall', 1, 3)]);
    expect(itemStatus(meet, learning.get(meet.id), NOW).status).toBe('learning');
    const strong = (skill: Progress['skill']): Progress => ({ ...reviewed(meet.id, skill, 1, 4), state: 2, stability: 40, lastGrade: 4 });
    const mastered = indexProgress([strong('comprehension'), strong('recall')]);
    expect(itemStatus(meet, mastered.get(meet.id), NOW).status).toBe('mastered');
  });
});

describe('statistics', () => {
  const log = (daysAgo: number, correct: boolean, extra: Partial<ReviewLog> = {}): ReviewLog => ({
    itemId: 'x', skill: 'recall', method: 'flashcards', topic: 'all', grade: correct ? 3 : 1, scheduled: true,
    correct, responseMs: 1000, sessionId: 's', ts: addDays(NOW, -daysAgo).toISOString(), ...extra,
  });

  it('computes current and longest streak (today pending does not break it)', () => {
    const days = activeDaySet([log(1, true), log(2, true), log(3, true), log(6, true), log(7, true)]);
    expect(streak(days, NOW)).toBe(3);
    expect(streak(activeDaySet([log(0, true), log(1, true)]), NOW)).toBe(2);
    expect(streak(activeDaySet([log(2, true)]), NOW)).toBe(0);
    expect(longestStreak(days)).toBe(3);
  });

  it('aggregates daily stats, methods and weekly error rate', () => {
    const logs = [log(0, true, { isNew: true }), log(0, false), log(1, true, { method: 'writing' })];
    const sessions = [{ id: 's', startedAt: NOW.toISOString(), activeMs: 300_000, topic: 'all', method: 'auto' as const, answered: 2, correct: 1 }];
    const d = dailyStats(logs, sessions, 7, NOW);
    expect(d).toHaveLength(7);
    expect(d[6]).toMatchObject({ day: dayKey(NOW), answered: 2, correct: 1, newItems: 1, activeMs: 300_000 });
    expect(methodStats(logs)).toEqual([
      { method: 'flashcards', answered: 2, correct: 1 },
      { method: 'writing', answered: 1, correct: 1 },
    ]);
    const w = weeklyErrorRate(logs, 4, NOW);
    expect(w[3].answered).toBe(3);
    expect(w[3].errorRate).toBeCloseTo(1 / 3);
    expect(w[0].errorRate).toBeNull();
  });
});

describe('ChatGPT prompt', () => {
  it('contains the schema, topic, count and data-honesty rules', () => {
    const p = buildPrompt({ ...DEFAULT_PROMPT_OPTIONS, count: 25, topic: 'engineering', kinds: ['technical', 'mistakes'] });
    expect(p).toContain('25 entries');
    expect(p).toContain('Engineering Mode');
    expect(p).toContain('"english"');
    expect(p).toContain('ONLY information you can actually access');
    expect(p).toContain('common_mistake');
    expect(p).toMatch(/JSON array/);
  });
  it('clamps the count', () => {
    expect(buildPrompt({ ...DEFAULT_PROMPT_OPTIONS, count: 5000 })).toContain('200 entries');
  });
});
