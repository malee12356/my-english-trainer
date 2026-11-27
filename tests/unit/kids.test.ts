import { beforeEach, describe, expect, it } from 'vitest';
import { TrainerDB, setDbForTests } from '../../src/db/db';
import { chooseProfile, ensureSetup, getSettings, loadSnapshot, resolveProfileOnStart, addItem } from '../../src/db/repo';
import { STARTER_KIDS } from '../../src/data/starterKids';
import { parseImport, planImport } from '../../src/domain/importer';
import { BADGES, badgeStats, dailyMissions, earnedBadges, levelInfo, robotStage, sessionStars, totalXp, xpForAnswer, xpForLevel } from '../../src/domain/gamification';
import { buildPrompt, DEFAULT_KID_PROMPT_OPTIONS, DEFAULT_PROMPT_OPTIONS, contentKindsFor } from '../../src/domain/promptBuilder';
import { resolveCategoryId, topicsFor } from '../../src/domain/topics';
import type { ReviewLog, StudySession } from '../../src/domain/types';

const NOW = new Date('2026-11-27T17:00:00');
const log = (daysAgo: number, grade: 1 | 2 | 3 | 4, extra: Partial<ReviewLog> = {}): ReviewLog => ({
  itemId: 'x', skill: 'recall', method: 'flashcards', topic: 'school', grade, scheduled: true, correct: grade >= 2,
  responseMs: 1000, sessionId: 's', ts: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(), ...extra,
});
const session = (answered: number, correct: number, topic = 'school'): StudySession => ({ id: Math.random().toString(), startedAt: NOW.toISOString(), activeMs: 60_000, topic, method: 'auto', answered, correct });

describe('XP, levels and robot stages', () => {
  it('gives XP for every answer and a bonus for real sessions', () => {
    expect([xpForAnswer(4), xpForAnswer(3), xpForAnswer(2), xpForAnswer(1)]).toEqual([10, 10, 6, 2]);
    expect(totalXp([log(0, 3), log(0, 1)], [session(2, 1), session(5, 5)])).toBe(12 + 20);
  });
  it('computes levels with growing thresholds', () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 100, 300, 600, 1000]);
    expect(levelInfo(0)).toMatchObject({ level: 1, xpToNext: 100, progress: 0 });
    expect(levelInfo(150)).toMatchObject({ level: 2, xpInLevel: 50, xpToNext: 150 });
    expect(levelInfo(1000).level).toBe(5);
  });
  it('lets the robot grow with the level', () => {
    expect(robotStage(1).stage).toBe(1);
    expect(robotStage(3).stage).toBe(2);
    expect(robotStage(5).nameDe).toBe('Super-Robo');
    expect(robotStage(20).stage).toBe(5);
  });
  it('awards 1–3 stars by accuracy', () => {
    expect(sessionStars(0, 0)).toBe(0);
    expect(sessionStars(10, 9)).toBe(3);
    expect(sessionStars(10, 7)).toBe(2);
    expect(sessionStars(10, 3)).toBe(1);
  });
});

describe('badges and missions', () => {
  it('derives badges from learning data', () => {
    const logs = [log(2, 3), log(1, 3), log(0, 3, { method: 'listening' })];
    const sessions = [session(10, 10), session(3, 2, 'family'), session(3, 3, 'daily')];
    const stats = badgeStats(logs, sessions, [], 0, NOW);
    expect(stats).toMatchObject({ sessions: 3, bestStreak: 3, currentStreak: 3, perfectSessions: 1, topicsTried: 3, listeningAnswers: 1 });
    const ids = earnedBadges(stats).map((b) => b.id);
    expect(ids).toEqual(expect.arrayContaining(['first-steps', 'streak-3', 'perfect', 'explorer']));
    expect(ids).not.toContain('streak-7');
    const week = BADGES.find((b) => b.id === 'streak-7')!;
    expect(week.progress(stats)).toBeCloseTo(3 / 7);
  });
  it('tracks the three daily missions for today only', () => {
    const logs = [...Array.from({ length: 20 }, () => log(0, 3)), log(0, 3, { isNew: true }), log(1, 3, { method: 'listening' })];
    const m = dailyMissions(logs, NOW);
    expect(m.map((x) => [x.id, x.progress, x.done])).toEqual([
      ['answers', 20, true],
      ['new', 1, false],
      ['ears', 0, false],
    ]);
  });
});

describe('kids topics, content and prompt', () => {
  it('has kid topics separate from adult topics', () => {
    expect(topicsFor('kid').map((t) => t.id)).toEqual(['school', 'family', 'daily']);
    expect(topicsFor('adult').map((t) => t.id)).toEqual(['everyday', 'business', 'engineering', 'meeting', 'handball']);
    expect(resolveCategoryId('Daily Life')?.id).toBe('daily');
    expect(resolveCategoryId('Schule & Unterricht')?.id).toBe('school');
    expect(resolveCategoryId('Everyday English')?.id).toBe('everyday');
  });
  it('kid default vocabulary is valid, unique and covers all kid topics', () => {
    const plan = planImport(parseImport(JSON.stringify(STARTER_KIDS)), [], []);
    expect(plan.counts.invalid).toBe(0);
    expect(plan.counts.duplicate).toBe(0);
    expect(plan.newCategories).toEqual([]);
    expect(STARTER_KIDS.length).toBeGreaterThanOrEqual(110);
    const cats = new Set(plan.rows.flatMap((r) => r.draft!.categories.map((c) => c.id)));
    expect([...cats].sort()).toEqual(['daily', 'family', 'school']);
  });
  it('builds a pupil-oriented prompt with kid categories and a code block instruction', () => {
    const p = buildPrompt({ ...DEFAULT_KID_PROMPT_OPTIONS, kinds: ['vocabulary', 'booklist'] });
    expect(p).toContain('school years 5–6');
    expect(p).toContain('School & Classroom | Family & Animals | Daily Life');
    expect(p).toContain('ONE single code block');
    expect(p).toContain('vocabulary list, photo or file');
    expect(p).toContain('Child-friendly');
    expect(p).not.toContain('Engineering');
    expect(contentKindsFor('kid').some((k) => k.id === 'technical')).toBe(false);
    expect(buildPrompt(DEFAULT_PROMPT_OPTIONS)).toContain('Engineering Mode');
  });
});

describe('profile on first start', () => {
  let n = 0;
  beforeEach(async () => {
    setDbForTests(new TrainerDB(`kids-${++n}`));
    await ensureSetup();
  });
  it('asks in an empty app, then loads the matching default vocabulary', async () => {
    expect(await resolveProfileOnStart()).toBe('needs-choice');
    await chooseProfile('kid');
    const s = await getSettings();
    expect(s).toMatchObject({ profile: 'kid', profileChosen: true, dailyGoalMin: 10, newPerDay: 8 });
    const snap = await loadSnapshot();
    expect(snap.items.length).toBe(STARTER_KIDS.length);
    expect(snap.items.every((i) => i.categories.some((c) => ['school', 'family', 'daily'].includes(c)))).toBe(true);
    expect(await resolveProfileOnStart()).toBe('ready');
  });
  it('keeps existing installations on the adult profile without asking', async () => {
    await addItem({ english: 'strain', german: 'Dehnung' });
    expect(await resolveProfileOnStart()).toBe('ready');
    expect(await getSettings()).toMatchObject({ profile: 'adult', profileChosen: true });
    expect((await loadSnapshot()).items).toHaveLength(1);
  });
});
