/**
 * Gamification for the kids profile: XP, levels, robot stages, stars, badges
 * and daily missions. Everything is DERIVED from the existing learning data
 * (review logs, sessions, progress) – no extra storage, nothing can get out of
 * sync, and backups automatically contain it.
 */
import { activeDaySet, dayKey, longestStreak, startOfDay, streak } from './stats';
import type { Grade, Progress, ReviewLog, StudySession } from './types';

/* -------------------------------------------------------------------- XP */

export function xpForAnswer(grade: Grade): number {
  return grade >= 3 ? 10 : grade === 2 ? 6 : 2; // trying always counts a little
}
export const SESSION_BONUS_XP = 20;
export const MIN_ANSWERS_FOR_BONUS = 5;

export function totalXp(logs: ReviewLog[], sessions: StudySession[]): number {
  const answers = logs.reduce((a, l) => a + xpForAnswer(l.grade), 0);
  const bonus = sessions.filter((s) => s.answered >= MIN_ANSWERS_FOR_BONUS).length * SESSION_BONUS_XP;
  return answers + bonus;
}

/** XP needed to REACH a level: L1 = 0, L2 = 100, L3 = 300, L4 = 600, L5 = 1000 … */
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export interface LevelInfo {
  level: number;
  xp: number;
  xpInLevel: number;
  xpToNext: number;
  progress: number;
}

export function levelInfo(xp: number): LevelInfo {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, xp, xpInLevel: xp - base, xpToNext: next - xp, progress: (xp - base) / (next - base) };
}

/* ----------------------------------------------------------- robot stages */

export interface RobotStage {
  stage: 1 | 2 | 3 | 4 | 5;
  nameDe: string;
  nameEn: string;
  fromLevel: number;
}
export const ROBOT_STAGES: RobotStage[] = [
  { stage: 1, nameDe: 'Mini-Robo', nameEn: 'Mini Robo', fromLevel: 1 },
  { stage: 2, nameDe: 'Robo', nameEn: 'Robo', fromLevel: 3 },
  { stage: 3, nameDe: 'Super-Robo', nameEn: 'Super Robo', fromLevel: 5 },
  { stage: 4, nameDe: 'Mega-Robo', nameEn: 'Mega Robo', fromLevel: 8 },
  { stage: 5, nameDe: 'Robo-Champion', nameEn: 'Robo Champion', fromLevel: 12 },
];
export function robotStage(level: number): RobotStage {
  return [...ROBOT_STAGES].reverse().find((s) => level >= s.fromLevel) ?? ROBOT_STAGES[0];
}

/* ------------------------------------------------------------------ stars */

/** 1–3 stars for a finished session (0 if nothing was answered). */
export function sessionStars(answered: number, correct: number): 0 | 1 | 2 | 3 {
  if (answered === 0) return 0;
  const r = correct / answered;
  return r >= 0.9 ? 3 : r >= 0.7 ? 2 : 1;
}

/* ----------------------------------------------------------------- badges */

export interface BadgeStats {
  answers: number;
  correct: number;
  sessions: number;
  currentStreak: number;
  bestStreak: number;
  learnedItems: number;
  masteredItems: number;
  perfectSessions: number;
  listeningAnswers: number;
  speakingAnswers: number;
  topicsTried: number;
  level: number;
}

export interface Badge {
  id: string;
  emoji: string;
  de: string;
  en: string;
  descDe: string;
  descEn: string;
  earned: (s: BadgeStats) => boolean;
  /** 0..1 progress towards the badge (for locked badges). */
  progress: (s: BadgeStats) => number;
}

const p = (v: number, target: number) => Math.min(1, v / target);

export const BADGES: Badge[] = [
  { id: 'first-steps', emoji: '🚀', de: 'Erster Start', en: 'First steps', descDe: 'Erste Lerneinheit geschafft', descEn: 'First session done', earned: (s) => s.sessions >= 1, progress: (s) => p(s.sessions, 1) },
  { id: 'streak-3', emoji: '🔥', de: '3 Tage am Stück', en: '3-day streak', descDe: '3 Tage hintereinander gelernt', descEn: 'Learned 3 days in a row', earned: (s) => s.bestStreak >= 3, progress: (s) => p(s.bestStreak, 3) },
  { id: 'streak-7', emoji: '🌟', de: 'Wochen-Held', en: 'Week hero', descDe: '7 Tage hintereinander gelernt', descEn: '7 days in a row', earned: (s) => s.bestStreak >= 7, progress: (s) => p(s.bestStreak, 7) },
  { id: 'words-25', emoji: '📗', de: '25 Wörter', en: '25 words', descDe: '25 Wörter angefangen', descEn: 'Started 25 words', earned: (s) => s.learnedItems >= 25, progress: (s) => p(s.learnedItems, 25) },
  { id: 'words-100', emoji: '📚', de: '100 Wörter', en: '100 words', descDe: '100 Wörter angefangen', descEn: 'Started 100 words', earned: (s) => s.learnedItems >= 100, progress: (s) => p(s.learnedItems, 100) },
  { id: 'correct-100', emoji: '🎯', de: '100 richtig', en: '100 correct', descDe: '100 richtige Antworten', descEn: '100 correct answers', earned: (s) => s.correct >= 100, progress: (s) => p(s.correct, 100) },
  { id: 'perfect', emoji: '💯', de: 'Perfekt!', en: 'Perfect!', descDe: 'Eine Runde mit mind. 10 Aufgaben ohne Fehler', descEn: 'A session of 10+ without mistakes', earned: (s) => s.perfectSessions >= 1, progress: (s) => p(s.perfectSessions, 1) },
  { id: 'master-10', emoji: '🏆', de: 'Profi', en: 'Pro', descDe: '10 Wörter sicher gelernt', descEn: '10 words mastered', earned: (s) => s.masteredItems >= 10, progress: (s) => p(s.masteredItems, 10) },
  { id: 'listener', emoji: '🎧', de: 'Gute Ohren', en: 'Good ears', descDe: '20 Hörübungen', descEn: '20 listening exercises', earned: (s) => s.listeningAnswers >= 20, progress: (s) => p(s.listeningAnswers, 20) },
  { id: 'speaker', emoji: '🎙️', de: 'Sprech-Star', en: 'Speaking star', descDe: '10 Sprechübungen', descEn: '10 speaking exercises', earned: (s) => s.speakingAnswers >= 10, progress: (s) => p(s.speakingAnswers, 10) },
  { id: 'explorer', emoji: '🧭', de: 'Entdecker', en: 'Explorer', descDe: '3 verschiedene Themen geübt', descEn: 'Practised 3 topics', earned: (s) => s.topicsTried >= 3, progress: (s) => p(s.topicsTried, 3) },
  { id: 'level-5', emoji: '🤖', de: 'Super-Robo', en: 'Super Robo', descDe: 'Level 5 erreicht', descEn: 'Reached level 5', earned: (s) => s.level >= 5, progress: (s) => p(s.level, 5) },
];

export function badgeStats(logs: ReviewLog[], sessions: StudySession[], progress: Progress[], masteredItems: number, now: Date): BadgeStats {
  const days = activeDaySet(logs);
  const learned = new Set(progress.filter((x) => x.reps > 0).map((x) => x.itemId));
  return {
    answers: logs.length,
    correct: logs.filter((l) => l.correct).length,
    sessions: sessions.filter((s) => s.answered > 0).length,
    currentStreak: streak(days, now),
    bestStreak: longestStreak(days),
    learnedItems: learned.size,
    masteredItems,
    perfectSessions: sessions.filter((s) => s.answered >= 10 && s.correct === s.answered).length,
    listeningAnswers: logs.filter((l) => l.method === 'listening').length,
    speakingAnswers: logs.filter((l) => l.skill === 'speaking').length,
    topicsTried: new Set(sessions.filter((s) => s.answered > 0 && s.topic !== 'all' && s.topic !== 'weakness').map((s) => s.topic)).size,
    level: levelInfo(totalXp(logs, sessions)).level,
  };
}

export function earnedBadges(stats: BadgeStats): Badge[] {
  return BADGES.filter((b) => b.earned(stats));
}

/* --------------------------------------------------------- daily missions */

export interface Mission {
  id: 'answers' | 'new' | 'ears';
  emoji: string;
  de: string;
  en: string;
  target: number;
  progress: number;
  done: boolean;
}

export function dailyMissions(logs: ReviewLog[], now: Date): Mission[] {
  const start = startOfDay(now).getTime();
  const today = logs.filter((l) => new Date(l.ts).getTime() >= start && dayKey(l.ts) === dayKey(now));
  const m = (id: Mission['id'], emoji: string, de: string, en: string, target: number, progress: number): Mission => ({
    id, emoji, de, en, target, progress: Math.min(progress, target), done: progress >= target,
  });
  return [
    m('answers', '✏️', '20 Aufgaben lösen', 'Solve 20 tasks', 20, today.length),
    m('new', '✨', '5 neue Wörter lernen', 'Learn 5 new words', 5, today.filter((l) => l.isNew).length),
    m('ears', '🎧', '1 Hör- oder Sprechübung', '1 listening or speaking task', 1, today.filter((l) => l.method === 'listening' || l.skill === 'speaking').length),
  ];
}
