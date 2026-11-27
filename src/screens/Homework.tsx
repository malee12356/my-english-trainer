import { useMemo, useState } from 'react';
import { inScope, listUnits, pageBounds, scopeLabel, scopeQuery, type Scope } from '../domain/scope';
import { navigate, useApp, useSnapshot } from '../state';
import { NavBar } from '../ui/components';

/** Practise one unit or a page range of the school book. */
export function HomeworkScreen() {
  const { L, lang, settings } = useApp();
  const snap = useSnapshot();
  const [unit, setUnit] = useState<string | undefined>(undefined);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const units = useMemo(() => (snap ? listUnits(snap.items) : []), [snap]);
  const bounds = useMemo(() => (snap ? pageBounds(snap.items) : null), [snap]);
  if (!snap) return <main className="page" aria-busy="true" />;

  const scope: Scope = {
    unit,
    pageFrom: from ? Number(from) : undefined,
    pageTo: to ? Number(to) : from ? Number(from) : undefined,
  };
  const count = snap.items.filter((i) => inScope(i, scope)).length;
  const q = scopeQuery(scope);
  const empty = units.length === 0 && !bounds;
  const kid = settings.profile === 'kid';

  return (
    <main className="page">
      <NavBar title={L('Hausaufgabe üben', 'Practise homework')} back="/home" />
      {empty ? (
        <div className="stack">
          <div className="card small">
            <strong>{L('Noch keine Units oder Seiten gespeichert', 'No units or pages saved yet')}</strong>
            <p className="muted" style={{ margin: '6px 0 0' }}>
              {L(
                'Fotografiere die Vokabelseiten im Englischbuch, schick sie mit dem ChatGPT-Prompt („Nur aus meinen Fotos“) an ChatGPT und importiere das Ergebnis. Dann stehen hier Units und Seiten zur Auswahl.',
                'Photograph the vocabulary pages, send them to ChatGPT with the prompt (“Only from my photos”) and import the result.',
              )}
            </p>
          </div>
          <a className="btn block" href="#/prompt?mode=photos">📸 {L('Zum ChatGPT-Prompt', 'To the ChatGPT prompt')}</a>
        </div>
      ) : (
        <div className="stack">
          {units.length > 0 && (
            <>
              <h2 className="section-title" style={{ marginTop: 4 }}>{L('Unit wählen', 'Choose a unit')}</h2>
              <div className="chips wrap" role="group" aria-label="Unit">
                {units.map((u) => (
                  <button key={u.unit} className="chip" aria-pressed={unit === u.unit} onClick={() => { setUnit(unit === u.unit ? undefined : u.unit); setFrom(''); setTo(''); }}>
                    {u.unit} <span className="tiny" style={{ opacity: 0.75 }}>({u.count}{u.minPage !== undefined ? ` · S. ${u.minPage}${u.maxPage !== u.minPage ? `–${u.maxPage}` : ''}` : ''})</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {bounds && (
            <>
              <h2 className="section-title">{units.length ? L('… oder Seiten', '… or pages') : L('Seiten', 'Pages')}</h2>
              <div className="row">
                <label className="field grow">
                  <span>{L('von Seite', 'from page')}</span>
                  <input className="input" inputMode="numeric" pattern="[0-9]*" value={from} placeholder={String(bounds.min)} onChange={(e) => { setFrom(e.target.value.replace(/\D/g, '')); setUnit(undefined); }} aria-label={L('von Seite', 'from page')} />
                </label>
                <label className="field grow">
                  <span>{L('bis Seite', 'to page')}</span>
                  <input className="input" inputMode="numeric" pattern="[0-9]*" value={to} placeholder={from || String(bounds.max)} onChange={(e) => { setTo(e.target.value.replace(/\D/g, '')); setUnit(undefined); }} aria-label={L('bis Seite', 'to page')} />
                </label>
              </div>
            </>
          )}
          <div className={`banner ${count ? 'ok' : ''} small`} role="status">
            {q ? L(`${scopeLabel(scope, lang)}: ${count} Wörter`, `${scopeLabel(scope, lang)}: ${count} words`) : L('Bitte eine Unit oder Seiten wählen.', 'Please choose a unit or pages.')}
          </div>
          <button className="btn block big" disabled={!q || !count} onClick={() => navigate(`/session?mode=homework&method=writing&${q}`)}>
            ✍️ {L('Alle Wörter schreiben', 'Write all words')}
          </button>
          <button className="btn block secondary" disabled={!q || !count} onClick={() => navigate(`/session?mode=homework&method=flashcards&${q}`)}>
            🃏 {L('Mit Karteikarten üben', 'Practise with flashcards')}
          </button>
          {kid && (
            <button className="btn block secondary" disabled={!q || !count} onClick={() => navigate(`/session?mode=challenge&answer=writing&${q}`)}>
              🎮 {L('Als Spielzeit-Challenge', 'As screen-time challenge')}
            </button>
          )}
          <p className="tiny muted" style={{ margin: 0 }}>{L('Geübt wird Deutsch → Englisch, alle Wörter des Bereichs in gemischter Reihenfolge.', 'German → English, all words of the range in mixed order.')}</p>
        </div>
      )}
    </main>
  );
}
