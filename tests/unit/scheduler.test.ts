import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyReview, deterministicEngine, formatInterval, isDue, newProgress, retrievability, setEngineForTests, STATE } from '../../src/domain/scheduler';

const T0 = new Date('2026-01-01T08:00:00Z');
const plus = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000);

beforeAll(() => setEngineForTests(deterministicEngine()));
afterAll(() => setEngineForTests(null));

describe('FSRS scheduling', () => {
  it('schedules a new card and tracks reps, stability and statistics', () => {
    const p0 = newProgress('i1', 'recall', T0);
    expect(p0.state).toBe(STATE.New);
    const { progress: p1, scheduled } = applyReview(p0, 3, T0, { alreadyAnsweredInSession: false, responseMs: 4000 });
    expect(scheduled).toBe(true);
    expect(p1.reps).toBe(1);
    expect(p1.stability).toBeGreaterThan(0);
    expect(p1.correct).toBe(1);
    expect(p1.answered).toBe(1);
    expect(new Date(p1.due).getTime()).toBeGreaterThan(T0.getTime());
  });

  it('gives longer intervals for Easy than Good than Hard, and Again is a lapse', () => {
    let p = newProgress('i1', 'recall', T0);
    // graduate to review state
    p = applyReview(p, 3, T0, { alreadyAnsweredInSession: false, responseMs: 1 }).progress;
    p = applyReview(p, 3, new Date(p.due), { alreadyAnsweredInSession: false, responseMs: 1 }).progress;
    expect(p.state).toBe(STATE.Review);
    const at = new Date(p.due);
    const due = (g: 1 | 2 | 3 | 4) => new Date(applyReview(p, g, at, { alreadyAnsweredInSession: false, responseMs: 1 }).progress.due).getTime();
    expect(due(4)).toBeGreaterThan(due(3));
    expect(due(3)).toBeGreaterThan(due(2));
    expect(due(2)).toBeGreaterThan(due(1));
    const again = applyReview(p, 1, at, { alreadyAnsweredInSession: false, responseMs: 1 }).progress;
    expect(again.lapses).toBe(1);
    expect(again.wrong).toBe(1);
    expect(again.state).toBe(STATE.Relearning);
  });

  it('determines due status', () => {
    const p = applyReview(newProgress('i', 'recall', T0), 4, T0, { alreadyAnsweredInSession: false, responseMs: 1 }).progress;
    expect(isDue(p, T0)).toBe(false);
    expect(isDue(p, plus(T0, 400))).toBe(true);
  });

  it('session guard: repeated answers in the same session do not change the schedule', () => {
    const p1 = applyReview(newProgress('i', 'recall', T0), 1, T0, { alreadyAnsweredInSession: false, responseMs: 1 }).progress;
    const r2 = applyReview(p1, 4, new Date(T0.getTime() + 60_000), { alreadyAnsweredInSession: true, responseMs: 1 });
    expect(r2.scheduled).toBe(false);
    expect(r2.progress.due).toBe(p1.due);
    expect(r2.progress.stability).toBe(p1.stability);
    expect(r2.progress.answered).toBe(2); // still counted as practice
  });

  it('practice ahead of time: correct answers do not inflate intervals, wrong answers count', () => {
    let p = applyReview(newProgress('i', 'recall', T0), 3, T0, { alreadyAnsweredInSession: false, responseMs: 1 }).progress;
    p = applyReview(p, 3, new Date(p.due), { alreadyAnsweredInSession: false, responseMs: 1 }).progress; // review state
    const early = new Date(new Date(p.last_review!).getTime() + 3600_000);
    expect(isDue(p, early)).toBe(false);
    const good = applyReview(p, 4, early, { alreadyAnsweredInSession: false, responseMs: 1 });
    expect(good.scheduled).toBe(false);
    expect(good.progress.due).toBe(p.due);
    const bad = applyReview(p, 1, early, { alreadyAnsweredInSession: false, responseMs: 1 });
    expect(bad.scheduled).toBe(true);
    expect(bad.progress.lapses).toBe(1);
  });

  it('estimates retrievability (model estimate) that decreases over time', () => {
    const p = applyReview(newProgress('i', 'recall', T0), 4, T0, { alreadyAnsweredInSession: false, responseMs: 1 }).progress;
    const r1 = retrievability(p, plus(T0, 1));
    const r2 = retrievability(p, plus(T0, 30));
    expect(r1).toBeGreaterThan(r2);
    expect(r1).toBeLessThanOrEqual(1);
    expect(retrievability(newProgress('x', 'recall', T0), T0)).toBe(0);
  });

  it('caps response time in statistics', () => {
    const p = applyReview(newProgress('i', 'recall', T0), 3, T0, { alreadyAnsweredInSession: false, responseMs: 10 * 60_000 }).progress;
    expect(p.totalResponseMs).toBe(120_000);
  });

  it('formats intervals', () => {
    expect(formatInterval(5 * 60_000, 'de')).toBe('5 min');
    expect(formatInterval(3 * 86_400_000, 'de')).toBe('3 T');
    expect(formatInterval(3 * 86_400_000, 'en')).toBe('3 d');
  });
});
