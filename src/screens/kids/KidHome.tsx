import { useMemo } from 'react';
import { dailyMissions, earnedBadges } from '../../domain/gamification';
import { summarize } from '../../domain/summary';
import { topicsFor } from '../../domain/topics';
import { navigate, useApp, useSnapshot } from '../../state';
import { RobotSays } from '../../ui/Robot';
import { LevelCard, useKidProgress } from './KidParts';
import { DEFAULT_MINUTES_PER_WORD, minutesEarnedToday } from '../../domain/challenge';

const TOPIC_COLORS = ['purple', 'teal', 'orange', 'pink', 'blue', 'yellow'];

/** Home screen of the kids profile: robot, level, missions, topics. */
export function KidHome() {
  const { L, lang, settings, updateSettings } = useApp();
  const snap = useSnapshot();
  const kp = useKidProgress(snap);
  const now = useMemo(() => new Date(), [snap]);
  const sum = useMemo(() => (snap ? summarize(snap.items, snap.progress, snap.logs, snap.sessions, now) : null), [snap, now]);
  if (!snap || !kp || !sum) return <main className="page" aria-busy="true" />;

  const missions = dailyMissions(snap.logs, now);
  const allDone = missions.every((m) => m.done);
  const badges = earnedBadges(kp.stats);
  const minutes = settings.defaultDurationMin;
  const counts: Record<string, number> = {};
  for (const it of snap.items) if (!it.archived) for (const c of it.categories) counts[c] = (counts[c] ?? 0) + 1;

  const greeting = allDone
    ? L('Wow, alle Missionen für heute geschafft! 🎉', 'Wow, all missions done for today! 🎉')
    : sum.streak >= 2
      ? L(`Schon ${sum.streak} Tage am Stück – weiter so! 🔥`, `${sum.streak} days in a row – keep going! 🔥`)
      : sum.todayAnswered > 0
        ? L('Super! Noch eine Runde? 💪', 'Great! One more round? 💪')
        : L('Hi! Lust auf eine Runde Englisch? 🚀', "Hi! Ready for some English? 🚀");

  const backupDays = settings.lastBackupAt ? Math.floor((now.getTime() - new Date(settings.lastBackupAt).getTime()) / 86_400_000) : null;
  const needsBackup = snap.logs.length > 20 && (backupDays === null || backupDays >= settings.backupReminderDays);

  return (
    <main className="page">
      <div style={{ marginTop: 8 }}>
        <RobotSays mood={allDone ? 'cheer' : 'happy'} stage={kp.stage.stage} size={84}>
          {greeting}
        </RobotSays>
      </div>

      <div className="stack mt">
        <LevelCard kp={kp} mood={allDone ? 'cheer' : 'happy'}>
          <div className="chips" style={{ marginTop: 14 }} role="group" aria-label={L('Lernzeit wählen', 'Choose duration')}>
            {[5, 10, 15].map((d) => (
              <button
                key={d}
                className="chip"
                aria-pressed={d === minutes}
                style={d === minutes ? { background: '#fff', color: '#7c3aed' } : { background: 'rgba(255,255,255,.18)', color: '#fff', boxShadow: 'none' }}
                onClick={() => updateSettings({ defaultDurationMin: d })}
              >
                {d} min
              </button>
            ))}
          </div>
          <button className="btn white block big" style={{ marginTop: 12, color: '#7c3aed' }} onClick={() => navigate(`/session?topic=all&method=auto&min=${minutes}`)}>
            🚀 {L("Los geht's!", "Let's go!")}
          </button>
        </LevelCard>

        <button className="kid-card teal" style={{ border: 0, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }} onClick={() => navigate('/challenge')}>
          <span style={{ fontSize: 40 }} aria-hidden="true">🎮</span>
          <span className="grow">
            <strong style={{ display: 'block', fontSize: 19 }}>{L('Spielzeit verdienen', 'Earn screen time')}</strong>
            <span className="small muted">
              {minutesEarnedToday(snap.sessions, now) > 0
                ? L(`Heute schon ${minutesEarnedToday(snap.sessions, now)} Minuten verdient`, `${minutesEarnedToday(snap.sessions, now)} minutes earned today`)
                : L(`Schwierige Wörter schreiben – ${String(settings.minutesPerWord ?? DEFAULT_MINUTES_PER_WORD).replace('.', ',')} Min. pro richtigem Wort`, `Write tricky words – ${settings.minutesPerWord ?? DEFAULT_MINUTES_PER_WORD} min per correct word`)}
            </span>
          </span>
          <span className="btn small">{L('Los', 'Go')}</span>
        </button>

        <section className="kid-card yellow" aria-label={L('Tagesmissionen', 'Daily missions')}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <strong style={{ fontSize: 18 }}>🎯 {L('Missionen für heute', "Today's missions")}</strong>
            <span className="small muted">{missions.filter((m) => m.done).length}/{missions.length}</span>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {missions.map((m) => (
              <div key={m.id} className={`mission ${m.done ? 'done' : ''}`}>
                <span className="emoji" aria-hidden="true">{m.done ? '✅' : m.emoji}</span>
                <span className="grow">
                  <span className="label" style={{ display: 'block', fontWeight: 700 }}>{lang === 'de' ? m.de : m.en}</span>
                  <div className="progress" style={{ background: 'rgba(0,0,0,.08)', marginTop: 4 }} role="progressbar" aria-valuemin={0} aria-valuemax={m.target} aria-valuenow={m.progress}>
                    <div style={{ width: `${(m.progress / m.target) * 100}%`, background: m.done ? '#16a34a' : '#f59e0b' }} />
                  </div>
                </span>
                <span className="small muted">{m.progress}/{m.target}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="grid-2 wide-4">
          <a className="kid-card blue stat" href="#/vocab?status=due" style={{ textDecoration: 'none' }}>
            <span className="value">🔁 {sum.dueItems}</span>
            <span className="label muted">{L('Wiederholen', 'To review')}</span>
          </a>
          <a className="kid-card teal stat" href="#/vocab?status=new" style={{ textDecoration: 'none' }}>
            <span className="value">✨ {sum.newCount}</span>
            <span className="label muted">{L('Neue Wörter', 'New words')}</span>
          </a>
          <div className="kid-card pink stat">
            <span className="value">🔥 {sum.streak}</span>
            <span className="label muted">{L('Tage am Stück', 'Day streak')}</span>
          </div>
          <a className="kid-card orange stat" href="#/stats" style={{ textDecoration: 'none' }}>
            <span className="value">🏅 {badges.length}</span>
            <span className="label muted">{L('Abzeichen', 'Badges')}</span>
          </a>
        </div>

        <h2 className="section-title">{L('Themen', 'Topics')}</h2>
        <div className="grid-2">
          {topicsFor('kid').map((t, i) => (
            <button key={t.id} className={`kid-card ${TOPIC_COLORS[i % TOPIC_COLORS.length]}`} style={{ border: 0, textAlign: 'left', cursor: 'pointer', minHeight: 104 }} onClick={() => navigate(`/session?topic=${t.id}&method=auto&min=${minutes}`)}>
              <div style={{ fontSize: 30 }} aria-hidden="true">{t.emoji}</div>
              <strong style={{ display: 'block' }}>{lang === 'de' ? t.nameDe : t.name}</strong>
              <span className="tiny muted">{counts[t.id] ?? 0} {L('Wörter', 'words')}</span>
            </button>
          ))}
          <button className="kid-card purple" style={{ border: 0, textAlign: 'left', cursor: 'pointer', minHeight: 104 }} onClick={() => navigate('/learn')}>
            <div style={{ fontSize: 30 }} aria-hidden="true">🎮</div>
            <strong style={{ display: 'block' }}>{L('Spielart wählen', 'Choose a game')}</strong>
            <span className="tiny muted">{L('Karten, Schreiben, Hören, Sprechen …', 'Cards, writing, listening, speaking …')}</span>
          </button>
        </div>

        {needsBackup && (
          <a className="banner small" href="#/backup" style={{ textDecoration: 'none' }}>
            <span aria-hidden="true">💾</span>
            <span className="grow">{L('Für Eltern: Bitte ein Backup erstellen, damit Fortschritt und Abzeichen sicher sind.', 'For parents: please create a backup to keep progress and badges safe.')}</span>
          </a>
        )}
      </div>
    </main>
  );
}
