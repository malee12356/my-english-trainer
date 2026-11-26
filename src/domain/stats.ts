/** Statistics derived from review logs and study sessions (all measured, local). */
import type { Method, ReviewLog, StudySession } from './types';

export function dayKey(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export interface DayStat {
  day: string;
  activeMs: number;
  answered: number;
  correct: number;
  newItems: number;
}

export function dailyStats(logs: ReviewLog[], sessions: StudySession[], days: number, now: Date): DayStat[] {
  const map = new Map<string, DayStat>();
  for (let i = days - 1; i >= 0; i--) {
    const k = dayKey(addDays(now, -i));
    map.set(k, { day: k, activeMs: 0, answered: 0, correct: 0, newItems: 0 });
  }
  for (const s of sessions) {
    const e = map.get(dayKey(s.startedAt));
    if (e) e.activeMs += s.activeMs;
  }
  for (const l of logs) {
    const e = map.get(dayKey(l.ts));
    if (!e) continue;
    e.answered++;
    if (l.correct) e.correct++;
    if (l.isNew) e.newItems++;
  }
  return [...map.values()];
}

/** Consecutive days with at least one answered exercise. Today counts once done; an
 *  unfinished today does not break a streak that ran until yesterday. */
export function streak(activeDays: Set<string>, now: Date): number {
  let n = 0;
  let d = startOfDay(now);
  if (!activeDays.has(dayKey(d))) d = addDays(d, -1);
  while (activeDays.has(dayKey(d))) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function longestStreak(activeDays: Set<string>): number {
  const sorted = [...activeDays].sort();
  let best = 0;
  let cur = 0;
  let prev: Date | null = null;
  for (const k of sorted) {
    const d = new Date(`${k}T12:00:00`);
    cur = prev && Math.round((d.getTime() - prev.getTime()) / 86_400_000) === 1 ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = d;
  }
  return best;
}

export function activeDaySet(logs: ReviewLog[]): Set<string> {
  return new Set(logs.map((l) => dayKey(l.ts)));
}

export interface MethodStat {
  method: Method;
  answered: number;
  correct: number;
}

export function methodStats(logs: ReviewLog[]): MethodStat[] {
  const m = new Map<Method, MethodStat>();
  for (const l of logs) {
    const e = m.get(l.method) ?? { method: l.method, answered: 0, correct: 0 };
    e.answered++;
    if (l.correct) e.correct++;
    m.set(l.method, e);
  }
  return [...m.values()].sort((a, b) => b.answered - a.answered);
}

/** Error rate per week (last n weeks) – development of personal weaknesses. */
export function weeklyErrorRate(logs: ReviewLog[], weeks: number, now: Date): { week: string; answered: number; errorRate: number | null }[] {
  const out: { week: string; answered: number; wrong: number }[] = [];
  const end = startOfDay(addDays(now, 1)).getTime();
  for (let i = weeks - 1; i >= 0; i--) {
    out.push({ week: dayKey(addDays(now, -7 * i - 6)), answered: 0, wrong: 0 });
  }
  for (const l of logs) {
    const t = new Date(l.ts).getTime();
    const weeksAgo = Math.floor((end - t) / (7 * 86_400_000));
    const idx = weeks - 1 - weeksAgo;
    if (idx < 0 || idx >= weeks) continue;
    out[idx].answered++;
    if (!l.correct) out[idx].wrong++;
  }
  return out.map((w) => ({ week: w.week, answered: w.answered, errorRate: w.answered ? w.wrong / w.answered : null }));
}

export function sumActiveMs(sessions: StudySession[], from: Date, to: Date): number {
  return sessions
    .filter((s) => {
      const t = new Date(s.startedAt).getTime();
      return t >= from.getTime() && t < to.getTime();
    })
    .reduce((a, s) => a + s.activeMs, 0);
}

export function formatMinutes(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}
