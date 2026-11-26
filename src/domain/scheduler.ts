/**
 * Spaced repetition with FSRS (library: ts-fsrs, MIT licence).
 *
 * Session guard – repeated exercises must not inflate long-term intervals:
 *  1. Only the FIRST answer for an (item, skill) pair within a study session
 *     may change the FSRS memory state. Re-asks inside the same session
 *     (e.g. after "Again") are logged as practice only.
 *  2. Cards that are not yet due ("practice ahead") only update the schedule
 *     when the answer was wrong (grade 1 = forgotten, which is real evidence).
 *     A correct early answer does not push the interval further out.
 *  3. Cards in short-term learning/relearning steps are scheduled normally.
 */
import { createEmptyCard, fsrs, generatorParameters, type Card, type FSRS, State } from 'ts-fsrs';
import type { Grade, Progress, Skill } from './types';

let engine: FSRS | null = null;
export function getEngine(): FSRS {
  if (!engine) engine = fsrs(generatorParameters({ enable_fuzz: true, request_retention: 0.9, maximum_interval: 365 }));
  return engine;
}
/** Deterministic engine for tests. */
export function setEngineForTests(e: FSRS | null): void {
  engine = e;
}
export function deterministicEngine(): FSRS {
  return fsrs(generatorParameters({ enable_fuzz: false, request_retention: 0.9, maximum_interval: 365 }));
}

export function progressId(itemId: string, skill: Skill): string {
  return `${itemId}:${skill}`;
}

export function newProgress(itemId: string, skill: Skill, now: Date): Progress {
  const c = createEmptyCard(now);
  return {
    id: progressId(itemId, skill),
    itemId,
    skill,
    ...cardToFields(c),
    correct: 0,
    wrong: 0,
    skipped: 0,
    totalResponseMs: 0,
    answered: 0,
  };
}

function cardToFields(c: Card) {
  return {
    due: new Date(c.due).toISOString(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: (c as Card & { elapsed_days?: number }).elapsed_days ?? 0,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps ?? 0,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state as 0 | 1 | 2 | 3,
    last_review: c.last_review ? new Date(c.last_review).toISOString() : undefined,
  };
}

export function progressToCard(p: Progress): Card {
  return {
    due: new Date(p.due),
    stability: p.stability,
    difficulty: p.difficulty,
    elapsed_days: p.elapsed_days,
    scheduled_days: p.scheduled_days,
    learning_steps: p.learning_steps,
    reps: p.reps,
    lapses: p.lapses,
    state: p.state as State,
    last_review: p.last_review ? new Date(p.last_review) : undefined,
  } as Card;
}

export function isDue(p: Progress, now: Date): boolean {
  return new Date(p.due).getTime() <= now.getTime();
}

export interface ReviewOutcome {
  progress: Progress;
  /** Whether the long-term schedule was changed. */
  scheduled: boolean;
}

/**
 * Apply an answer to a progress record.
 * @param alreadyAnsweredInSession true if this (item, skill) was answered earlier in the same session.
 */
export function applyReview(
  prev: Progress,
  grade: Grade,
  now: Date,
  opts: { alreadyAnsweredInSession: boolean; responseMs: number },
): ReviewOutcome {
  const correct = grade >= 2;
  const stats = {
    correct: prev.correct + (correct ? 1 : 0),
    wrong: prev.wrong + (correct ? 0 : 1),
    totalResponseMs: prev.totalResponseMs + Math.min(Math.max(opts.responseMs, 0), 120_000),
    answered: prev.answered + 1,
    lastGrade: grade,
  };
  const inShortTermSteps = prev.state === State.Learning || prev.state === State.Relearning;
  const due = isDue(prev, now);
  const allow =
    !opts.alreadyAnsweredInSession && (prev.state === State.New || due || inShortTermSteps || grade === 1);
  if (!allow) return { progress: { ...prev, ...stats }, scheduled: false };
  const res = getEngine().next(progressToCard(prev), now, grade);
  return { progress: { ...prev, ...cardToFields(res.card), ...stats }, scheduled: true };
}

/** Estimated probability of recall right now (FSRS model estimate, not a measurement). */
export function retrievability(p: Progress, now: Date): number {
  if (p.state === State.New || !p.last_review) return 0;
  return getEngine().retrievability(progressToCard(p), now);
}

/** Preview of the next interval for each grade (for button labels). */
export function previewIntervals(p: Progress, now: Date): Record<Grade, number> {
  const rec = getEngine().repeat(progressToCard(p), now);
  const out = {} as Record<Grade, number>;
  for (const g of [1, 2, 3, 4] as Grade[]) {
    out[g] = new Date(rec[g].card.due).getTime() - now.getTime();
  }
  return out;
}

export function formatInterval(ms: number, lang: 'de' | 'en'): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  if (d < 31) return lang === 'de' ? `${d} T` : `${d} d`;
  const mo = Math.round(d / 30);
  if (mo < 12) return lang === 'de' ? `${mo} Mon` : `${mo} mo`;
  return lang === 'de' ? `${(d / 365).toFixed(1)} J` : `${(d / 365).toFixed(1)} y`;
}

export const STATE = State;
