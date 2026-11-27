import { useMemo, useState } from 'react';
import { loadStarterContent, requestPersistentStorage } from '../db/repo';
import { DURATIONS, methodLabel } from '../domain/methods';
import { formatMinutes } from '../domain/stats';
import { summarize } from '../domain/summary';
import { TOPIC_MODES, topicLabel } from '../domain/topics';
import { navigate, useApp, useSnapshot } from '../state';
import { BarChart, Empty, ProgressRing } from '../ui/components';
import { IconFlame, IconPlay } from '../ui/icons';

export function Home() {
  const { L, lang, settings, updateSettings, bump, toast } = useApp();
  const snap = useSnapshot();
  const [busy, setBusy] = useState(false);
  const now = useMemo(() => new Date(), [snap]);
  const sum = useMemo(() => (snap ? summarize(snap.items, snap.progress, snap.logs, snap.sessions, now) : null), [snap, now]);
  if (!snap || !sum) return <main className="page" aria-busy="true" />;

  const duration = settings.defaultDurationMin;
  const hour = now.getHours();
  const greeting = hour < 11 ? L('Guten Morgen', 'Good morning') : hour < 18 ? L('Hallo', 'Hello') : L('Guten Abend', 'Good evening');
  const goalMs = settings.dailyGoalMin * 60_000;
  const goalPct = Math.min(1, sum.todayMs / goalMs);

  const backupDays = settings.lastBackupAt ? Math.floor((now.getTime() - new Date(settings.lastBackupAt).getTime()) / 86_400_000) : null;
  const needsBackup = sum.total > 0 && (backupDays === null || backupDays >= settings.backupReminderDays);

  const loadStarter = async () => {
    setBusy(true);
    const r = await loadStarterContent();
    await requestPersistentStorage();
    setBusy(false);
    bump();
    toast(L(`${r.added} Standardvokabeln geladen`, `${r.added} default items loaded`));
  };

  // Recommendation
  const topDueTopic = Object.entries(sum.dueByTopic).sort((a, b) => b[1] - a[1])[0];
  let rec: { title: string; text: string; to: string };
  if (sum.dueItems > 0) {
    rec = {
      title: L(`${sum.dueItems} Wiederholungen fällig`, `${sum.dueItems} reviews due`),
      text: topDueTopic ? L(`Die meisten in ${topicLabel(topDueTopic[0], snap.categories, lang)}`, `Most of them in ${topicLabel(topDueTopic[0], snap.categories, lang)}`) : L('Gemischte Wiederholung', 'Mixed review'),
      to: `/session?topic=all&method=auto&min=${duration}`,
    };
  } else if (sum.difficult >= 3) {
    rec = { title: 'Personal Weakness Mode', text: L(`${sum.difficult} schwierige Einträge gezielt üben`, `Practise ${sum.difficult} difficult items`), to: `/session?topic=weakness&method=auto&min=10` };
  } else if (sum.newCount > 0) {
    const t = TOPIC_MODES.find((m) => snap.items.some((i) => !i.archived && i.categories.includes(m.id) && sum.statusById.get(i.id)?.status === 'new'));
    rec = {
      title: L('Neue Inhalte lernen', 'Learn new content'),
      text: t ? (lang === 'de' ? t.nameDe : t.name) : L('Gemischt', 'Mixed'),
      to: `/session?topic=${t?.id ?? 'all'}&method=flashcards&min=${duration}`,
    };
  } else {
    rec = { title: L('Alles erledigt 🎉', 'All done 🎉'), text: L('Freies Üben im Writing Mode', 'Free practice in Writing Mode'), to: `/session?topic=all&method=writing&min=10` };
  }

  const weekday = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { weekday: 'short' }).slice(0, 2);

  return (
    <main className="page">
      <p className="subtitle" style={{ margin: '8px 0 0' }}>
        {now.toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>
      <h1 className="large-title">{greeting}</h1>

      <div className="stack mt">
        {needsBackup && (
          <a className="banner" href="#/backup" style={{ textDecoration: 'none' }}>
            <span aria-hidden="true">💾</span>
            <span className="grow">
              {backupDays === null
                ? L('Noch kein Backup erstellt. iOS kann Web-App-Daten in seltenen Fällen löschen.', 'No backup yet. iOS may delete web app data in rare cases.')
                : L(`Letztes Backup vor ${backupDays} Tagen.`, `Last backup ${backupDays} days ago.`)}
            </span>
            <strong style={{ color: 'var(--accent)' }}>{L('Sichern', 'Back up')}</strong>
          </a>
        )}

        {sum.total === 0 ? (
          <Empty emoji="📚" title={L('Noch keine Lerninhalte', 'No learning content yet')} text={L('Importiere Inhalte aus deinem ChatGPT-Projekt oder starte mit allgemeinen Starter-Inhalten.', 'Import content from your ChatGPT project or start with generic starter content.')}>
            <div className="stack">
              <button className="btn block" onClick={loadStarter} disabled={busy}>
                {L('Standardvokabeln laden (≈ 160)', 'Load default vocabulary (≈ 160)')}
              </button>
              <a className="btn block secondary" href="#/prompt">{L('ChatGPT-Import einrichten', 'Set up ChatGPT import')}</a>
              <a className="btn block secondary" href="#/import">{L('Datei importieren', 'Import file')}</a>
            </div>
          </Empty>
        ) : (
          <section className="hero" aria-label={L('Tagesziel', 'Daily goal')}>
            <div className="row">
              <ProgressRing value={goalPct}>
                <span style={{ fontSize: 18 }}>{Math.round(goalPct * 100)}%</span>
              </ProgressRing>
              <div className="grow">
                <div style={{ fontSize: 20, fontWeight: 750 }}>
                  {Math.round(sum.todayMs / 60000)} / {settings.dailyGoalMin} min
                </div>
                <div className="muted small">{L('Tagesziel', 'Daily goal')} · {sum.todayAnswered} {L('Antworten heute', 'answers today')}</div>
                <div className="row small" style={{ marginTop: 6, gap: 6 }}>
                  <IconFlame size={18} />
                  <strong>{sum.streak}</strong> {L(sum.streak === 1 ? 'Tag in Folge' : 'Tage in Folge', sum.streak === 1 ? 'day streak' : 'day streak')}
                </div>
              </div>
            </div>
            <div className="chips" style={{ marginTop: 16 }} role="group" aria-label={L('Lernzeit wählen', 'Choose duration')}>
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  className="chip"
                  aria-pressed={d === duration}
                  style={d === duration ? { background: '#fff', color: '#3730a3' } : { background: 'rgba(255,255,255,.16)', color: '#fff', boxShadow: 'none' }}
                  onClick={() => updateSettings({ defaultDurationMin: d })}
                >
                  {d} min
                </button>
              ))}
            </div>
            <button className="btn white block big" style={{ marginTop: 14 }} onClick={() => navigate(`/session?topic=all&method=auto&min=${duration}`)}>
              <IconPlay size={20} /> {L('Jetzt lernen', 'Start learning')}
            </button>
          </section>
        )}

        {sum.total > 0 && (
          <>
            <div className="grid-2 wide-4">
              <a className="card stat" href="#/vocab?status=due" style={{ textDecoration: 'none', color: 'inherit' }}>
                <span className="value" style={{ color: 'var(--accent)' }}>{sum.dueItems}</span>
                <span className="label">{L('Heute fällig', 'Due today')}</span>
              </a>
              <a className="card stat" href="#/vocab?status=new" style={{ textDecoration: 'none', color: 'inherit' }}>
                <span className="value">{sum.newCount}</span>
                <span className="label">{L('Neu', 'New')}</span>
              </a>
              <a className="card stat" href="#/vocab?status=mastered" style={{ textDecoration: 'none', color: 'inherit' }}>
                <span className="value" style={{ color: 'var(--green)' }}>{sum.mastered}</span>
                <span className="label">{L('Sicher beherrscht', 'Mastered')}</span>
              </a>
              <a className="card stat" href="#/vocab?status=difficult" style={{ textDecoration: 'none', color: 'inherit' }}>
                <span className="value" style={{ color: 'var(--red)' }}>{sum.difficult}</span>
                <span className="label">{L('Schwierig', 'Difficult')}</span>
              </a>
            </div>

            <h2 className="section-title">{L('Empfohlen', 'Recommended')}</h2>
            <a className="card row" href={`#${rec.to}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="icon-badge" aria-hidden="true">✨</span>
              <span className="grow">
                <strong style={{ display: 'block' }}>{rec.title}</strong>
                <span className="muted small">{rec.text}</span>
              </span>
              <span className="btn small">{L('Start', 'Start')}</span>
            </a>

            {settings.lastMode && (
              <a className="card row" href={`#/session?topic=${encodeURIComponent(settings.lastMode.topic)}&method=${settings.lastMode.method}&min=${duration}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <span className="icon-badge" aria-hidden="true">↺</span>
                <span className="grow">
                  <strong style={{ display: 'block' }}>{L('Zuletzt verwendet', 'Last used')}</strong>
                  <span className="muted small">
                    {topicLabel(settings.lastMode.topic, snap.categories, lang)} · {methodLabel(settings.lastMode.method, lang)}
                  </span>
                </span>
                <span className="btn small secondary">{L('Fortsetzen', 'Continue')}</span>
              </a>
            )}

            <h2 className="section-title">{L('Letzte 7 Tage', 'Last 7 days')}</h2>
            <div className="card">
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                <span className="small muted">{L('Lernzeit (gemessen)', 'Study time (measured)')}</span>
                <strong className="small">{formatMinutes(sum.last7.reduce((a, d) => a + d.activeMs, 0))}</strong>
              </div>
              <BarChart
                data={sum.last7.map((d) => ({ label: weekday(d.day), value: Math.round(d.activeMs / 60000) }))}
                unit=" min"
                ariaLabel={L('Lernminuten der letzten sieben Tage', 'Study minutes for the last seven days')}
              />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
