import { useMemo, useState } from 'react';
import { methodLabel } from '../domain/methods';
import { activeDaySet, addDays, dailyStats, dayKey, formatMinutes, longestStreak, methodStats, startOfDay, sumActiveMs, weeklyErrorRate } from '../domain/stats';
import { summarize, weakItems } from '../domain/summary';
import { navigate, useApp, useSnapshot } from '../state';
import { BarChart, Empty, Segmented } from '../ui/components';

export function Stats() {
  const { L, lang } = useApp();
  const snap = useSnapshot();
  const [range, setRange] = useState<7 | 30 | 90>(7);
  const now = useMemo(() => new Date(), [snap]);
  const data = useMemo(() => {
    if (!snap) return null;
    const sum = summarize(snap.items, snap.progress, snap.logs, snap.sessions, now);
    const days = dailyStats(snap.logs, snap.sessions, range, now);
    const from = addDays(startOfDay(now), -(range - 1));
    const logsInRange = snap.logs.filter((l) => new Date(l.ts) >= from);
    const active = activeDaySet(snap.logs);
    const weekStart = addDays(startOfDay(now), -((now.getDay() + 6) % 7));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const tomorrow = addDays(startOfDay(now), 1);
    const perCat = snap.categories
      .map((c) => {
        const its = snap.items.filter((i) => !i.archived && i.categories.includes(c.id));
        const count = { new: 0, learning: 0, mastered: 0, difficult: 0 };
        for (const i of its) count[sum.statusById.get(i.id)?.status ?? 'new']++;
        return { c, total: its.length, count };
      })
      .filter((x) => x.total > 0);
    // calendar: last 18 weeks, aligned to Monday
    const calStart = addDays(startOfDay(now), -(17 * 7 + ((now.getDay() + 6) % 7)));
    const perDay = new Map<string, number>();
    for (const l of snap.logs) perDay.set(dayKey(l.ts), (perDay.get(dayKey(l.ts)) ?? 0) + 1);
    const cal: { day: string; n: number; future: boolean }[] = [];
    for (let d = calStart; d < addDays(startOfDay(now), 7 - ((now.getDay() + 6) % 7)); d = addDays(d, 1)) {
      cal.push({ day: dayKey(d), n: perDay.get(dayKey(d)) ?? 0, future: d > now });
    }
    const speechLogs = logsInRange.filter((l) => l.skill === 'speaking');
    return {
      sum, days, logsInRange, cal,
      streakNow: sum.streak,
      streakBest: longestStreak(active),
      timeRange: days.reduce((a, d) => a + d.activeMs, 0),
      timeWeek: sumActiveMs(snap.sessions, weekStart, tomorrow),
      timeMonth: sumActiveMs(snap.sessions, monthStart, tomorrow),
      correct: logsInRange.filter((l) => l.correct).length,
      methods: methodStats(logsInRange),
      weekly: weeklyErrorRate(snap.logs, 12, now),
      weak: weakItems(snap.items, sum.index, 5),
      perCat,
      newLearned: logsInRange.filter((l) => l.isNew).length,
      speechCount: speechLogs.length,
      speechCorrect: speechLogs.filter((l) => l.correct).length,
      speechFirstTry: speechLogs.filter((l) => l.grade >= 3).length,
    };
  }, [snap, range, now]);

  if (!snap || !data) return <main className="page" aria-busy="true" />;
  const locale = lang === 'de' ? 'de-DE' : 'en-GB';
  const label = (d: string) => (range === 7 ? new Date(`${d}T12:00:00`).toLocaleDateString(locale, { weekday: 'short' }).slice(0, 2) : new Date(`${d}T12:00:00`).getDate().toString());
  const rate = data.logsInRange.length ? Math.round((data.correct / data.logsInRange.length) * 100) : null;
  const maxCal = Math.max(1, ...data.cal.map((c) => c.n));

  if (snap.logs.length === 0) {
    return (
      <main className="page">
        <h1 className="large-title">{L('Statistik', 'Statistics')}</h1>
        <Empty emoji="📈" title={L('Noch keine Lerndaten', 'No learning data yet')} text={L('Nach deiner ersten Lerneinheit erscheinen hier Lernzeit, Erfolgsquoten und Fortschritt.', 'After your first session you will see study time, success rates and progress here.')}>
          <button className="btn block" onClick={() => navigate('/learn')}>{L('Jetzt lernen', 'Start learning')}</button>
        </Empty>
      </main>
    );
  }

  return (
    <main className="page">
      <h1 className="large-title">{L('Statistik', 'Statistics')}</h1>
      <Segmented label={L('Zeitraum', 'Range')} value={range} onChange={setRange} options={[{ value: 7, label: L('7 Tage', '7 days') }, { value: 30, label: L('30 Tage', '30 days') }, { value: 90, label: L('90 Tage', '90 days') }]} />

      <div className="grid-2 wide-4 mt">
        <div className="card stat"><span className="value">{formatMinutes(data.timeRange)}</span><span className="label">{L('Lernzeit', 'Study time')} · {L('gemessen', 'measured')}</span></div>
        <div className="card stat"><span className="value">{data.logsInRange.length}</span><span className="label">{L('Antworten', 'Answers')}</span></div>
        <div className="card stat"><span className="value">{rate === null ? '–' : `${rate}%`}</span><span className="label">{L('Erfolgsquote', 'Success rate')}</span></div>
        <div className="card stat"><span className="value">🔥 {data.streakNow}</span><span className="label">{L(`Serie · Rekord ${data.streakBest}`, `Streak · best ${data.streakBest}`)}</span></div>
      </div>

      <div className="grid-3 mt">
        <div className="card stat"><span className="value" style={{ fontSize: 20 }}>{formatMinutes(data.timeWeek)}</span><span className="label">{L('diese Woche', 'this week')}</span></div>
        <div className="card stat"><span className="value" style={{ fontSize: 20 }}>{formatMinutes(data.timeMonth)}</span><span className="label">{L('dieser Monat', 'this month')}</span></div>
        <div className="card stat"><span className="value" style={{ fontSize: 20 }}>{data.newLearned}</span><span className="label">{L('neu gelernt', 'newly learned')}</span></div>
      </div>

      <h2 className="section-title">{L('Lernzeit pro Tag (Minuten)', 'Study time per day (minutes)')}</h2>
      <div className="card">
        <BarChart data={data.days.map((d) => ({ label: label(d.day), value: Math.round(d.activeMs / 60000) }))} unit=" min" ariaLabel={L('Lernminuten pro Tag', 'Study minutes per day')} />
      </div>

      <h2 className="section-title">{L('Antworten pro Tag', 'Answers per day')}</h2>
      <div className="card">
        <BarChart data={data.days.map((d) => ({ label: label(d.day), value: d.answered, title: `${d.day}: ${d.correct}/${d.answered}` }))} color="var(--green)" ariaLabel={L('Antworten pro Tag', 'Answers per day')} />
        <p className="tiny muted" style={{ margin: '8px 0 0' }}>{L('Richtig', 'Correct')}: {data.correct} · {L('Falsch', 'Wrong')}: {data.logsInRange.length - data.correct}</p>
      </div>

      <h2 className="section-title">{L('Aktivitätskalender', 'Activity calendar')}</h2>
      <div className="card">
        <div className="heatmap" role="img" aria-label={L('Aktivität der letzten 18 Wochen', 'Activity of the last 18 weeks')}>
          {data.cal.map((c) => (
            <div key={c.day} title={`${c.day}: ${c.n}`} style={{ background: c.future ? 'transparent' : c.n ? `color-mix(in srgb, var(--accent) ${Math.round(25 + (c.n / maxCal) * 75)}%, transparent)` : undefined }} />
          ))}
        </div>
      </div>

      <h2 className="section-title">{L('Vokabelbestand', 'Vocabulary')}</h2>
      <div className="grid-2 wide-4">
        <div className="card stat"><span className="value">{data.sum.total}</span><span className="label">{L('gesamt', 'total')}</span></div>
        <div className="card stat"><span className="value">{data.sum.newCount}</span><span className="label">{L('neu', 'new')}</span></div>
        <div className="card stat"><span className="value" style={{ color: 'var(--green)' }}>{data.sum.mastered}</span><span className="label">{L('sicher', 'mastered')}</span></div>
        <div className="card stat"><span className="value" style={{ color: 'var(--accent)' }}>{data.sum.dueItems}</span><span className="label">{L('heute fällig', 'due today')}</span></div>
      </div>

      <h2 className="section-title">{L('Fortschritt je Kategorie', 'Progress by category')}</h2>
      <div className="card stack">
        {data.perCat.map(({ c, total, count }) => (
          <div key={c.id}>
            <div className="row small" style={{ justifyContent: 'space-between' }}><strong>{c.name}</strong><span className="muted">{count.mastered}/{total} {L('sicher', 'mastered')}</span></div>
            <div className="hbar" style={{ marginTop: 6 }} aria-hidden="true">
              <div style={{ width: `${(count.mastered / total) * 100}%`, background: 'var(--green)' }} />
              <div style={{ width: `${(count.learning / total) * 100}%`, background: 'var(--accent)' }} />
              <div style={{ width: `${(count.difficult / total) * 100}%`, background: 'var(--red)' }} />
            </div>
          </div>
        ))}
        <div className="legend"><span><i style={{ background: 'var(--green)' }} />{L('sicher', 'mastered')}</span><span><i style={{ background: 'var(--accent)' }} />{L('in Arbeit', 'learning')}</span><span><i style={{ background: 'var(--red)' }} />{L('schwierig', 'difficult')}</span><span><i style={{ background: 'var(--surface-3)' }} />{L('neu', 'new')}</span></div>
      </div>

      <h2 className="section-title">{L('Erfolgsquote nach Lernmethode', 'Success rate by method')}</h2>
      <div className="card stack">
        {data.methods.length === 0 && <span className="small muted">{L('Keine Antworten im Zeitraum.', 'No answers in this range.')}</span>}
        {data.methods.map((m) => (
          <div key={m.method}>
            <div className="row small" style={{ justifyContent: 'space-between' }}><span>{methodLabel(m.method, lang)}</span><span className="muted">{Math.round((m.correct / m.answered) * 100)}% · {m.answered}</span></div>
            <div className="hbar" style={{ marginTop: 6 }}><div style={{ width: `${(m.correct / m.answered) * 100}%`, background: 'var(--green)' }} /></div>
          </div>
        ))}
      </div>

      <h2 className="section-title">{L('Schwachstellen – Fehlerquote pro Woche', 'Weak spots – error rate per week')}</h2>
      <div className="card">
        <BarChart data={data.weekly.map((w) => ({ label: new Date(`${w.week}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'numeric' }), value: w.errorRate === null ? 0 : Math.round(w.errorRate * 100), title: `${w.week}: ${w.answered}` }))} color="var(--red)" unit="%" ariaLabel={L('Fehlerquote der letzten 12 Wochen', 'Error rate of the last 12 weeks')} height={100} />
        <p className="tiny muted" style={{ margin: '8px 0 0' }}>{L('Sinkende Balken = weniger Fehler.', 'Lower bars = fewer mistakes.')}</p>
        {data.weak.length > 0 && (
          <div className="list mt" style={{ boxShadow: 'none', background: 'var(--surface-2)' }}>
            {data.weak.map(({ item, score }) => (
              <a key={item.id} className="list-item" href={`#/item/${item.id}`}>
                <span className="main"><span className="primary" style={{ display: 'block' }}>{item.english}</span><span className="secondary">{item.german}</span></span>
                <span className="badge red">{score}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      <h2 className="section-title">{L('Sprechen & Aussprache', 'Speaking & pronunciation')}</h2>
      <div className="card small muted">
        {data.speechCount > 0 ? (
          <>
            <div className="grid-3" style={{ color: 'var(--text)' }}>
              <div className="stat"><span className="value" style={{ fontSize: 22 }}>{data.speechCount}</span><span className="label">{L('Sprechübungen', 'speaking exercises')}</span></div>
              <div className="stat"><span className="value" style={{ fontSize: 22 }}>{Math.round((data.speechCorrect / data.speechCount) * 100)}%</span><span className="label">{L('richtig erkannt', 'recognised correctly')}</span></div>
              <div className="stat"><span className="value" style={{ fontSize: 22 }}>{data.speechFirstTry}</span><span className="label">{L('beim 1. Versuch', 'first attempt')}</span></div>
            </div>
            <p style={{ margin: '10px 0 0' }}>{L('Gemessen wird, ob die Spracherkennung die erwarteten Wörter erkannt hat – keine Bewertung der Aussprache.', 'Measured: whether speech recognition recognised the expected words – not a pronunciation score.')}</p>
          </>
        ) : (
          L('Im Zeitraum keine Sprechübungen. Angezeigt wird nur, ob die Spracherkennung die Wörter erkannt hat – keine erfundene Lautbewertung.', 'No speaking exercises in this range. Only recognition results are shown, no invented phoneme scores.')
        )}
      </div>

      <p className="tiny muted mt">
        {L(
          'Gemessen: Lernzeit (aktive Zeit, Leerlauf je Karte max. 60 s), Antworten, Erfolgsquoten. Geschätzt: Erinnerungswahrscheinlichkeit und Intervalle (FSRS-Modell). Die App leitet kein offizielles CEFR-Niveau ab.',
          'Measured: study time (active time, idle capped at 60 s per card), answers, success rates. Estimated: recall probability and intervals (FSRS model). The app does not infer an official CEFR level.',
        )}
      </p>
    </main>
  );
}
