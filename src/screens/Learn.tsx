import { useMemo, useState } from 'react';
import { indexProgress, planSession, weakness } from '../domain/planner';
import { DURATIONS, METHODS } from '../domain/methods';
import { topicsFor } from '../domain/topics';
import type { Method } from '../domain/types';
import { navigate, useApp, useSnapshot } from '../state';
import { Segmented } from '../ui/components';
import { ttsSupported } from '../speech/tts';
import { detectSpeechCapabilities } from '../speech/capabilities';

export function Learn() {
  const { L, lang, settings, updateSettings, route } = useApp();
  const kid = settings.profile === 'kid';
  const snap = useSnapshot();
  const [topic, setTopic] = useState(route.query.get('topic') ?? 'all');
  const [method, setMethod] = useState<Method | 'auto'>((route.query.get('method') as Method) ?? 'auto');
  const [minutes, setMinutes] = useState(settings.defaultDurationMin);
  const tts = ttsSupported();
  const stt = detectSpeechCapabilities();

  const counts = useMemo(() => {
    if (!snap) return null;
    const idx = indexProgress(snap.progress);
    const c: Record<string, number> = { all: 0, weakness: 0 };
    for (const it of snap.items) {
      if (it.archived) continue;
      c.all++;
      for (const cat of it.categories) c[cat] = (c[cat] ?? 0) + 1;
      if (weakness(it, idx.get(it.id)).score > 0) c.weakness++;
    }
    return c;
  }, [snap]);

  const planned = useMemo(() => {
    if (!snap) return 0;
    return planSession(snap.items, indexProgress(snap.progress), {
      topic, method, minutes, now: new Date(), newPerDay: settings.newPerDay, newIntroducedToday: 0,
      flashcardDirection: settings.flashcardDirection, ttsAvailable: tts, sttAvailable: stt.recognitionUsable,
    }).length;
  }, [snap, topic, method, minutes, settings.newPerDay, settings.flashcardDirection, tts, stt.recognitionUsable]);

  if (!snap || !counts) return <main className="page" aria-busy="true" />;
  const customCats = snap.categories.filter((c) => !c.builtin);

  const topicCard = (id: string, emoji: string, title: string, desc: string, disabled = false, badge?: string) => (
    <button
      key={id}
      type="button"
      className="card"
      aria-pressed={topic === id}
      disabled={disabled}
      onClick={() => setTopic(id)}
      style={{
        border: 0, textAlign: 'left', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1,
        boxShadow: topic === id ? 'inset 0 0 0 2px var(--accent)' : undefined, display: 'flex', flexDirection: 'column', gap: 4, minHeight: 112,
      }}
    >
      <span style={{ fontSize: 26 }} aria-hidden="true">{emoji}</span>
      <strong style={{ fontSize: 15 }}>{title}</strong>
      <span className="tiny muted">{badge ?? desc}</span>
    </button>
  );

  return (
    <main className="page">
      <h1 className="large-title">{L('Lernen', 'Learn')}</h1>
      <p className="subtitle">{L('Thema und Lernmethode frei kombinieren.', 'Combine any topic with any method.')}</p>

      <a className="card row" href="#/homework" style={{ textDecoration: 'none', color: 'inherit', marginBottom: 4 }}>
        <span className="icon-badge" aria-hidden="true">📚</span>
        <span className="grow">
          <strong style={{ display: 'block' }}>{L('Nach Unit / Seite üben', 'Practise by unit / page')}</strong>
          <span className="small muted">{L('z. B. Hausaufgabe „Unit 3“ oder Seiten 196–198', 'e.g. homework “Unit 3” or pages 196–198')}</span>
        </span>
      </a>
      <h2 className="section-title">{L('Themenmodus', 'Topic mode')}</h2>
      <div className="grid-2">
        {topicCard('all', '🌍', L('Alle Themen', 'All topics'), `${counts.all} ${L('Einträge', 'items')}`)}
        {topicsFor(kid ? 'kid' : 'adult').map((t) => topicCard(t.id, t.emoji, lang === 'de' ? t.nameDe : t.name, `${counts[t.id] ?? 0} ${L('Einträge', 'items')}`))}
        {topicCard('weakness', '🎯', kid ? L('Schwere Wörter üben', 'Practise hard words') : 'Personal Weakness', counts.weakness ? `${counts.weakness} ${L('Schwachstellen', 'weak spots')}` : L('Noch keine Daten', 'No data yet'), counts.weakness === 0)}
        {!kid && topicCard('driving', '🚗', 'Driving Mode', '', true, L('Phase 3 · in Vorbereitung', 'Phase 3 · planned'))}
        {customCats.map((c) => topicCard(c.id, '🏷️', c.name, `${counts[c.id] ?? 0} ${L('Einträge', 'items')}`))}
      </div>

      <h2 className="section-title">{L('Lernmethode', 'Method')}</h2>
      <div className="list" role="radiogroup" aria-label={L('Lernmethode', 'Method')}>
        <button type="button" role="radio" aria-checked={method === 'auto'} className="list-item" onClick={() => setMethod('auto')}>
          <span className="icon-badge" aria-hidden="true">✨</span>
          <span className="main">
            <span className="primary" style={{ display: 'block' }}>{L('Automatisch (empfohlen)', 'Automatic (recommended)')}</span>
            <span className="secondary" style={{ display: 'block' }}>{L('Mix aus fälligen Wiederholungen, Schwachstellen und Neuem', 'Mix of due reviews, weak spots and new content')}</span>
          </span>
          {method === 'auto' && <span className="badge accent">✓</span>}
        </button>
        {METHODS.filter((m) => !kid || m.status === 'ready').map((m) => {
          const sttMissing = m.needsStt && !stt.recognitionUsable;
          const unavailable = m.status !== 'ready' || (m.needsTts && !tts) || sttMissing;
          return (
            <button key={m.id} type="button" role="radio" aria-checked={method === m.id} className="list-item" disabled={unavailable} onClick={() => setMethod(m.id)} style={{ opacity: unavailable ? 0.55 : 1 }}>
              <span className="icon-badge" aria-hidden="true">{m.emoji}</span>
              <span className="main">
                <span className="primary" style={{ display: 'block' }}>{lang === 'de' ? m.de : m.en}</span>
                <span className="secondary" style={{ display: 'block' }}>
                  {m.status === 'planned'
                    ? L(`Phase ${m.phase} · noch nicht verfügbar`, `Phase ${m.phase} · not available yet`)
                    : m.needsTts && !tts
                      ? L('Keine Sprachausgabe auf diesem Gerät', 'No speech output on this device')
                      : sttMissing
                        ? !stt.recognition
                          ? L('Keine Spracherkennung auf diesem Gerät/Browser', 'No speech recognition on this device/browser')
                          : L('Benötigt eine Internetverbindung', 'Needs an internet connection')
                        : lang === 'de' ? m.descDe : m.descEn}
                </span>
              </span>
              {method === m.id && <span className="badge accent">✓</span>}
            </button>
          );
        })}
      </div>

      {method === 'flashcards' && (
        <>
          <h2 className="section-title">{L('Richtung', 'Direction')}</h2>
          <Segmented
            label={L('Richtung', 'Direction')}
            value={settings.flashcardDirection}
            onChange={(v) => updateSettings({ flashcardDirection: v })}
            options={[
              { value: 'en-de', label: 'EN → DE' },
              { value: 'de-en', label: 'DE → EN' },
              { value: 'random', label: L('Zufällig', 'Random') },
            ]}
          />
        </>
      )}

      <h2 className="section-title">{L('Dauer', 'Duration')}</h2>
      <div className="chips wrap" role="group" aria-label={L('Dauer', 'Duration')}>
        {DURATIONS.map((d) => (
          <button key={d} className="chip" aria-pressed={d === minutes} onClick={() => setMinutes(d)}>
            {d} min
          </button>
        ))}
      </div>

      <div className="sticky-actions">
        <button className="btn block big" disabled={planned === 0} onClick={() => navigate(`/session?topic=${encodeURIComponent(topic)}&method=${method}&min=${minutes}`)}>
          {planned === 0 ? L('Keine passenden Übungen', 'No matching exercises') : L(`Starten · ${planned} Übungen`, `Start · ${planned} exercises`)}
        </button>
      </div>
    </main>
  );
}
