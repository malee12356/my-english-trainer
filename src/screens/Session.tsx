import { useEffect, useMemo, useRef, useState } from 'react';
import { loadSnapshot, newItemsIntroducedToday, recordAnswer, startSession, updateSession, type Snapshot } from '../db/repo';
import { methodLabel } from '../domain/methods';
import { indexProgress, planSession } from '../domain/planner';
import { progressId } from '../domain/scheduler';
import { topicLabel } from '../domain/topics';
import type { Grade, Method, StudySession, Task } from '../domain/types';
import { navigate, useApp } from '../state';
import { stopSpeaking, ttsSupported } from '../speech/tts';
import { Empty, useConfirm } from '../ui/components';
import { IconClose } from '../ui/icons';
import { Builder } from './exercises/Builder';
import { Flashcard } from './exercises/Flashcard';
import { Listening } from './exercises/Listening';
import { GapFill, Writing } from './exercises/Writing';
import { Speaking } from './exercises/Speaking';
import { detectSpeechCapabilities } from '../speech/capabilities';
import type { ExerciseProps } from './exercises/shared';
import { xpForAnswer, SESSION_BONUS_XP, MIN_ANSWERS_FOR_BONUS } from '../domain/gamification';
import { KidSummary } from './kids/KidSummary';
import { createSnapshot } from '../db/snapshots';
import { BackupNudge } from '../ui/BackupNudge';
import { ChallengeSummary } from './kids/ChallengeSummary';
import { hasScope, inScope, planHomework, scopeFromQuery, scopeLabel, scopeQuery } from '../domain/scope';
import { DEFAULT_CHALLENGE_WORDS, DEFAULT_MINUTES_PER_WORD, earnsReward, planChallenge, type ChallengeAnswer, type ChallengeResult } from '../domain/challenge';

const MAX_IDLE_MS = 60_000;
const MAX_REPEATS = 2;

export function SessionScreen() {
  const { route, L, lang, settings, bump, haptic } = useApp();
  const topic = route.query.get('topic') ?? 'all';
  const method = (route.query.get('method') ?? 'auto') as Method | 'auto';
  const minutes = Number(route.query.get('min') ?? settings.defaultDurationMin) || 15;
  const challenge = route.query.get('mode') === 'challenge';
  const homework = route.query.get('mode') === 'homework';
  const scopeKey = scopeQuery(scopeFromQuery(route.query));
  const answerMode: ChallengeAnswer = route.query.get('answer') === 'speaking' ? 'speaking' : 'writing';

  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [queue, setQueue] = useState<Task[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [session, setSession] = useState<StudySession | null>(null);
  const [stats, setStats] = useState({ answered: 0, correct: 0, activeMs: 0, xp: 0 });
  const kid = settings.profile === 'kid';
  const [saving, setSaving] = useState(false);
  const answered = useRef(new Set<string>());
  const repeats = useRef(new Map<string, number>());
  /** Challenge: first answer per item → earns screen time? */
  const rewards = useRef(new Map<string, boolean>());
  const [challengeResult, setChallengeResult] = useState<ChallengeResult | null>(null);
  const taskStart = useRef(Date.now());
  const snapshotDone = useRef(false);
  // automatic in-app copy as soon as the session is complete (also if the app is closed on the summary)
  useEffect(() => {
    if (queue && queue.length > 0 && idx >= queue.length && !snapshotDone.current) {
      snapshotDone.current = true;
      void createSnapshot('Nach einer Lerneinheit');
    }
  }, [idx, queue]);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    let alive = true;
    (async () => {
      const [s, introduced] = await Promise.all([loadSnapshot(), newItemsIntroducedToday()]);
      if (!alive) return;
      const sttUsable = detectSpeechCapabilities().recognitionUsable;
      const scope = scopeFromQuery(new URLSearchParams(scopeKey));
      const scopedItems = hasScope(scope) ? s.items.filter((i) => inScope(i, scope)) : s.items;
      const tasks = challenge
        ? planChallenge(scopedItems, indexProgress(s.progress), new Date(), s.settings.challengeWords ?? DEFAULT_CHALLENGE_WORDS, answerMode === 'speaking' && sttUsable ? 'speaking' : 'writing')
        : homework
          ? planHomework(scopedItems, indexProgress(s.progress), scope, method === 'writing' ? 'writing' : 'flashcards')
          : planSession(s.items, indexProgress(s.progress), {
            topic, method, minutes, now: new Date(), newPerDay: s.settings.newPerDay, newIntroducedToday: introduced,
            flashcardDirection: s.settings.flashcardDirection, ttsAvailable: ttsSupported(),
            sttAvailable: sttUsable,
          });
      setSnap(s);
      setQueue(tasks);
      if (tasks.length) {
        const st = await startSession(challenge ? 'all' : topic, challenge ? (tasks[0].method as Method) : method);
        if (challenge) {
          await updateSession(st.id, { kind: 'challenge', rewardMinutes: 0 });
          st.kind = 'challenge';
        }
        setSession(st);
      }
      taskStart.current = Date.now();
    })();
    return () => {
      alive = false;
      stopSpeaking();
    };
  }, [topic, method, minutes, challenge, answerMode, homework, scopeKey]);

  const itemsById = useMemo(() => new Map((snap?.items ?? []).map((i) => [i.id, i])), [snap]);
  const progressById = useMemo(() => new Map((snap?.progress ?? []).map((p) => [p.id, p])), [snap]);
  const pool = useMemo(() => (snap?.items ?? []).filter((i) => !i.archived), [snap]);

  if (!queue || !snap) return <main className="page no-tabbar" aria-busy="true" />;

  const done = idx >= queue.length;
  const task = queue[idx];
  const item = task ? itemsById.get(task.itemId) : undefined;

  const finish = () => {
    if (stats.answered > 0 && !snapshotDone.current) void createSnapshot('Nach einer Lerneinheit');
    snapshotDone.current = true;
    stopSpeaking();
    bump();
    navigate('/home', true);
  };

  const onClose = async () => {
    if (done || stats.answered === 0 || (await confirm(L('Sitzung beenden?', 'End session?'), L('Alle bisherigen Antworten sind bereits gespeichert.', 'All answers so far are already saved.'), { ok: L('Beenden', 'End') }))) finish();
  };

  const onDone = async (grade: Grade, given?: string) => {
    if (!session || !task || saving) return;
    setSaving(true);
    stopSpeaking();
    const responseMs = Date.now() - taskStart.current;
    const key = progressId(task.itemId, task.skill);
    const already = answered.current.has(key);
    const res = await recordAnswer({ task, grade, responseMs, session, alreadyAnsweredInSession: already, given });
    answered.current.add(key);
    progressById.set(key, res.progress);
    const activeMs = stats.activeMs + Math.min(responseMs, MAX_IDLE_MS);
    await updateSession(session.id, { activeMs, endedAt: new Date().toISOString() });
    setStats((s) => ({ answered: s.answered + 1, correct: s.correct + (grade >= 2 ? 1 : 0), activeMs, xp: s.xp + xpForAnswer(grade) }));
    if (challenge && !rewards.current.has(task.itemId)) {
      rewards.current.set(task.itemId, earnsReward(grade, task.method === 'speaking' ? 'speaking' : 'writing'));
    }
    // Re-ask forgotten items later in this session (practice only – schedule is protected).
    // Not in the challenge: it is exactly N words.
    if (grade === 1 && !challenge) {
      const n = repeats.current.get(key) ?? 0;
      if (n < MAX_REPEATS) {
        repeats.current.set(key, n + 1);
        const pos = Math.min(queue.length, idx + 4);
        const next = queue.slice();
        next.splice(pos, 0, { ...task, practice: true, isNew: false });
        setQueue(next);
      }
    }
    if (challenge && idx + 1 >= queue.length) {
      const results = [...rewards.current.entries()];
      const correct = results.filter(([, ok]) => ok).length;
      const result: ChallengeResult = {
        total: queue.length,
        correct,
        minutes: correct * (settings.minutesPerWord ?? DEFAULT_MINUTES_PER_WORD),
        wrong: results.filter(([, ok]) => !ok).map(([id]) => itemsById.get(id)).filter((i): i is NonNullable<typeof i> => !!i).map((i) => ({ english: i.english, german: i.german })),
        answer: queue.some((t) => t.method === 'speaking') ? 'speaking' : 'writing',
        finishedAt: new Date(),
      };
      await updateSession(session.id, { rewardMinutes: result.minutes });
      setChallengeResult(result);
    }
    haptic();
    setIdx((i) => i + 1);
    taskStart.current = Date.now();
    setSaving(false);
  };

  const progress = queue.length ? Math.min(1, idx / queue.length) : 0;
  // Speech not possible → same item as a writing exercise (recorded under the writing skill).
  const onFallback = () => {
    if (!task) return;
    const next = queue.slice();
    next[idx] = { ...task, method: 'writing', skill: 'writing' };
    setQueue(next);
  };
  const props: ExerciseProps | null = task && item ? { item, task, progress: progressById.get(progressId(task.itemId, task.skill)), pool, settings, onDone, onFallback, strict: challenge } : null;

  return (
    <main className="page no-tabbar">
      <div className="session-top">
        <button className="icon-btn" onClick={onClose} aria-label={L('Sitzung schließen', 'Close session')}>
          <IconClose size={22} />
        </button>
        <div className="grow">
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={queue.length} aria-valuenow={idx} aria-label={L('Fortschritt', 'Progress')}>
            <div style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="tiny muted" style={{ marginTop: 4 }}>
            {challenge ? L('🎮 Spielzeit-Challenge', '🎮 Screen-time challenge') : homework ? `📚 ${methodLabel(method, lang)}` : `${topicLabel(topic, snap.categories, lang)} · ${methodLabel(method, lang)}`}
            {scopeKey && ` · ${scopeLabel(scopeFromQuery(new URLSearchParams(scopeKey)), lang)}`} · {Math.min(idx + 1, queue.length)}/{queue.length}
          </div>
        </div>
        {challenge ? (
          <span key={stats.answered} className="xp-pill xp-pop" aria-label={L('verdiente Minuten', 'minutes earned')}>
            🎮 {[...rewards.current.values()].filter(Boolean).length * (settings.minutesPerWord ?? DEFAULT_MINUTES_PER_WORD)} min
          </span>
        ) : (
          kid && (
            <span key={stats.xp} className="xp-pill xp-pop" aria-label={`${stats.xp} XP`}>
              ⭐ {stats.xp}
            </span>
          )
        )}
      </div>

      {queue.length === 0 && (
        <Empty emoji="🌿" title={L('Gerade nichts zu tun', 'Nothing to do right now')} text={L('Für diese Auswahl gibt es keine fälligen oder neuen Übungen. Wähle ein anderes Thema oder importiere neue Inhalte.', 'No due or new exercises for this selection. Pick another topic or import new content.')}>
          <div className="stack">
            <a className="btn block" href="#/learn">{L('Andere Auswahl', 'Choose something else')}</a>
            <a className="btn block secondary" href="#/import">{L('Inhalte importieren', 'Import content')}</a>
          </div>
        </Empty>
      )}

      {!done && props && (
        <div key={`${idx}-${task.itemId}-${task.method}`} style={{ animation: 'fade-in .2s ease-out' }}>
          {task.method === 'flashcards' && <Flashcard {...props} />}
          {task.method === 'writing' && <Writing {...props} />}
          {task.method === 'gapfill' && <GapFill {...props} />}
          {task.method === 'builder' && <Builder {...props} />}
          {task.method === 'listening' && <Listening {...props} />}
          {task.method === 'speaking' && <Speaking {...props} />}
        </div>
      )}
      {!done && task && !item && (
        <div className="banner">
          {L('Dieser Eintrag wurde gelöscht.', 'This item was deleted.')}{' '}
          <button className="btn small" onClick={() => setIdx(idx + 1)}>{L('Überspringen', 'Skip')}</button>
        </div>
      )}

      {done && challenge && challengeResult && <ChallengeSummary result={challengeResult} onDone={finish} />}
      {done && queue.length > 0 && kid && !challenge && (
        <KidSummary before={snap} answered={stats.answered} correct={stats.correct} xpGained={stats.xp + (stats.answered >= MIN_ANSWERS_FOR_BONUS ? SESSION_BONUS_XP : 0)} onDone={finish} />
      )}
      {done && queue.length > 0 && !kid && !challenge && (
        <div className="stack" style={{ marginTop: 12 }}>
          <div className="hero center">
            <div style={{ fontSize: 48 }} aria-hidden="true">🎉</div>
            <h2 style={{ margin: '4px 0' }}>{L('Einheit abgeschlossen', 'Session complete')}</h2>
            <p className="muted" style={{ margin: 0 }}>{L('Stark – dranbleiben lohnt sich!', 'Great – keep it up!')}</p>
          </div>
          <div className="grid-3">
            <div className="card stat"><span className="value">{stats.answered}</span><span className="label">{L('Antworten', 'Answers')}</span></div>
            <div className="card stat"><span className="value">{stats.answered ? Math.round((stats.correct / stats.answered) * 100) : 0}%</span><span className="label">{L('richtig', 'correct')}</span></div>
            <div className="card stat"><span className="value">{Math.max(1, Math.round(stats.activeMs / 60000))}</span><span className="label">{L('Minuten', 'minutes')}</span></div>
          </div>
          <BackupNudge />
          <button className="btn block big" onClick={finish}>{L('Fertig', 'Done')}</button>
          <a className="btn block secondary" href="#/learn">{L('Weiter lernen', 'Keep learning')}</a>
        </div>
      )}
      {dialog}
    </main>
  );
}
