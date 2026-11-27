/**
 * "Spielzeit verdienen" (screen-time challenge) for the pupils profile.
 *
 * - Picks the words the learner does NOT know well yet: weak words first,
 *   then learned-but-unsure words (lowest recall probability), then new ones.
 *   Mastered words are never used.
 * - Only active answers: writing (German → type English) or speaking.
 * - Reward: minutes per word answered correctly on the first try.
 */
import { itemStatus, weakness, type ProgressIndex } from './planner';
import { retrievability } from './scheduler';
import type { Grade, Item, Progress, StudySession, Task } from './types';
import { dayKey } from './stats';

export type ChallengeAnswer = 'writing' | 'speaking';

export const DEFAULT_CHALLENGE_WORDS = 20;
export const DEFAULT_MINUTES_PER_WORD = 1;

export function planChallenge(items: Item[], progress: ProgressIndex, now: Date, n = DEFAULT_CHALLENGE_WORDS, answer: ChallengeAnswer = 'writing'): Task[] {
  const scored = items
    .filter((i) => !i.archived)
    .map((item) => {
      const prog = progress.get(item.id);
      const status = itemStatus(item, prog, now).status;
      const learned = (Object.values(prog ?? {}) as (Progress | undefined)[]).filter((p): p is Progress => !!p && p.reps > 0);
      const r = learned.length ? Math.min(...learned.map((p) => retrievability(p, now))) : null;
      return { item, status, weak: weakness(item, prog).score, r };
    })
    .filter((x) => x.status !== 'mastered');
  const bucket = (x: (typeof scored)[number]) => (x.weak > 0 ? 0 : x.r !== null ? 1 : 2);
  scored.sort(
    (a, b) =>
      bucket(a) - bucket(b) ||
      b.weak - a.weak ||
      (a.r ?? 1) - (b.r ?? 1) ||
      a.item.created_at.localeCompare(b.item.created_at),
  );
  return scored.slice(0, Math.max(1, n)).map(({ item }) => ({
    itemId: item.id,
    method: answer,
    skill: answer === 'speaking' ? 'speaking' : 'writing',
    direction: 'de-en',
    practice: false,
    isNew: !progress.get(item.id),
  }));
}

/** Does an answer earn screen time? Writing: exactly right. Speaking: recognised (also after a retry). */
export function earnsReward(grade: Grade, answer: ChallengeAnswer): boolean {
  return answer === 'writing' ? grade >= 3 : grade >= 2;
}

export interface ChallengeResult {
  total: number;
  correct: number;
  minutes: number;
  wrong: { english: string; german: string }[];
  answer: ChallengeAnswer;
  finishedAt: Date;
}

export function challengeShareText(r: ChallengeResult, lang: 'de' | 'en' = 'de'): string {
  const date = r.finishedAt.toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  if (lang === 'en') {
    return `🤖 English challenge done!\n✅ ${r.correct} of ${r.total} words ${r.answer === 'writing' ? 'written' : 'spoken'} correctly\n🎮 Screen time earned: ${r.minutes} minutes\n📅 ${date}`;
  }
  return `🤖 English-Challenge geschafft!\n✅ ${r.correct} von ${r.total} Wörtern richtig ${r.answer === 'writing' ? 'geschrieben' : 'gesprochen'}\n🎮 Verdiente Spielzeit: ${r.minutes} Minuten\n📅 ${date}`;
}

/** Minutes of screen time earned today (all challenges). */
export function minutesEarnedToday(sessions: StudySession[], now = new Date()): number {
  const today = dayKey(now);
  return sessions.filter((s) => s.kind === 'challenge' && dayKey(s.startedAt) === today).reduce((a, s) => a + (s.rewardMinutes ?? 0), 0);
}
