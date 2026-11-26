import { indexProgress, itemStatus, weakness, WEAK_THRESHOLD, type ProgressIndex } from './planner';
import { activeDaySet, dailyStats, dayKey, startOfDay, streak, type DayStat } from './stats';
import type { Item, Progress, ReviewLog, StudySession } from './types';

export interface Summary {
  total: number;
  newCount: number;
  learning: number;
  mastered: number;
  difficult: number;
  dueItems: number;
  dueByTopic: Record<string, number>;
  todayMs: number;
  todayAnswered: number;
  todayNew: number;
  streak: number;
  last7: DayStat[];
  index: ProgressIndex;
  statusById: Map<string, ReturnType<typeof itemStatus>>;
}

export function summarize(items: Item[], progress: Progress[], logs: ReviewLog[], sessions: StudySession[], now: Date): Summary {
  const index = indexProgress(progress);
  const active = items.filter((i) => !i.archived);
  const statusById = new Map<string, ReturnType<typeof itemStatus>>();
  let newCount = 0, learning = 0, mastered = 0, difficult = 0, dueItems = 0;
  const dueByTopic: Record<string, number> = {};
  for (const it of active) {
    const st = itemStatus(it, index.get(it.id), now);
    statusById.set(it.id, st);
    if (st.status === 'new') newCount++;
    else if (st.status === 'mastered') mastered++;
    else if (st.status === 'difficult') difficult++;
    else learning++;
    if (st.dueSkills.length) {
      dueItems++;
      for (const c of it.categories) dueByTopic[c] = (dueByTopic[c] ?? 0) + 1;
    }
  }
  const today = dayKey(now);
  const start = startOfDay(now).getTime();
  const todayLogs = logs.filter((l) => new Date(l.ts).getTime() >= start);
  return {
    total: active.length,
    newCount,
    learning,
    mastered,
    difficult,
    dueItems,
    dueByTopic,
    todayMs: sessions.filter((s) => dayKey(s.startedAt) === today).reduce((a, s) => a + s.activeMs, 0),
    todayAnswered: todayLogs.length,
    todayNew: todayLogs.filter((l) => l.isNew).length,
    streak: streak(activeDaySet(logs), now),
    last7: dailyStats(logs, sessions, 7, now),
    index,
    statusById,
  };
}

export function weakItems(items: Item[], index: ProgressIndex, limit = 5): { item: Item; score: number }[] {
  return items
    .filter((i) => !i.archived)
    .map((item) => ({ item, score: weakness(item, index.get(item.id)).score }))
    .filter((x) => x.score >= WEAK_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
