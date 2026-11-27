import { useRef, useState } from 'react';
import { applyImport, loadSnapshot, requestPersistentStorage } from '../db/repo';
import { parseImport, planImport, type ImportPlan, type PlannedRow, type RowAction } from '../domain/importer';
import { navigate, useApp } from '../state';
import { NavBar, Segmented } from '../ui/components';
import { readFileAsText } from '../ui/files';

const STATUS_STYLE: Record<PlannedRow['status'], string> = { new: 'green', update: 'accent', unchanged: '', duplicate: 'orange', invalid: 'red' };

export function ImportScreen() {
  const { L, bump, toast } = useApp();
  const [mode, setMode] = useState<'file' | 'paste'>('file');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const statusLabel: Record<PlannedRow['status'], string> = {
    new: L('neu', 'new'), update: L('Aktualisierung', 'update'), unchanged: L('unverändert', 'unchanged'),
    duplicate: L('Duplikat in Datei', 'duplicate in file'), invalid: L('fehlerhaft', 'invalid'),
  };

  const analyse = async (content: string) => {
    setError(null);
    setPlan(null);
    const parsed = parseImport(content);
    if (parsed.fatal) {
      const f = parsed.fatal;
      setError(
        f === 'empty' ? L('Kein Inhalt gefunden.', 'No content found.')
          : f.startsWith('json:') ? L(`Ungültiges JSON: ${f.slice(5)}`, `Invalid JSON: ${f.slice(5)}`)
          : f.startsWith('too-many') ? L('Zu viele Einträge (max. 5000 pro Import).', 'Too many entries (max. 5000 per import).')
          : f,
      );
      return;
    }
    if (parsed.rows.length === 0) {
      setError(L('Keine Einträge gefunden. Erwartet wird ein JSON-Array oder eine CSV mit Kopfzeile (english, german, …). Tipp: In ChatGPT den Kopier-Knopf des Codeblocks verwenden.', 'No entries found. Expected a JSON array or CSV with header (english, german, …). Tip: use the copy button of the code block in ChatGPT.'));
      return;
    }
    const snap = await loadSnapshot();
    setPlan(planImport(parsed, snap.items, snap.categories.map((c) => c.id)));
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setFileName(f.name);
    try {
      await analyse(await readFileAsText(f));
    } catch (e) {
      setError((e as Error).message === 'file-too-large' ? L('Datei ist zu groß (max. 15 MB).', 'File too large (max. 15 MB).') : String(e));
    }
  };

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      setText(t);
      if (t.trim()) await analyse(t);
    } catch {
      toast(L('Zugriff auf Zwischenablage nicht möglich – bitte manuell einfügen.', 'Clipboard not accessible – please paste manually.'));
    }
  };

  const setAction = (i: number, action: RowAction) => {
    if (!plan) return;
    const rows = plan.rows.slice();
    rows[i] = { ...rows[i], action };
    setPlan({ ...plan, rows });
  };

  const confirm = async () => {
    if (!plan) return;
    setBusy(true);
    const res = await applyImport(plan, fileName ? `import:${fileName}` : 'import:clipboard');
    await requestPersistentStorage();
    setBusy(false);
    bump();
    toast(L(`Import abgeschlossen: ${res.added} neu, ${res.updated} aktualisiert`, `Import done: ${res.added} added, ${res.updated} updated`));
    navigate('/vocab', true);
  };

  const toApply = plan?.rows.filter((r) => r.action !== 'skip').length ?? 0;
  const rows = plan ? (showAll ? plan.rows : plan.rows.filter((r) => r.status !== 'unchanged').slice(0, 200)) : [];

  return (
    <main className="page">
      <NavBar title={L('Importieren', 'Import')} back="/settings" />
      {!plan && (
        <div className="stack">
          <Segmented label={L('Quelle', 'Source')} value={mode} onChange={setMode} options={[{ value: 'file', label: L('Datei', 'File') }, { value: 'paste', label: L('Einfügen', 'Paste') }]} />
          {mode === 'file' ? (
            <div className="card stack center">
              <p className="muted small" style={{ margin: 0 }}>{L('JSON- oder CSV-Datei, z. B. aus der Dateien-App (iCloud Drive, „Auf meinem iPhone“).', 'JSON or CSV file, e.g. from the Files app.')}</p>
              <input ref={fileRef} type="file" accept=".json,.csv,.txt,application/json,text/csv,text/plain" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} aria-label={L('Datei wählen', 'Choose file')} />
              <button className="btn block big" onClick={() => fileRef.current?.click()}>{L('Datei auswählen', 'Choose file')}</button>
              {fileName && <span className="small muted">{fileName}</span>}
            </div>
          ) : (
            <div className="stack">
              <button className="btn block secondary" onClick={paste}>{L('Aus Zwischenablage einfügen', 'Paste from clipboard')}</button>
              <textarea className="textarea" style={{ minHeight: 200, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 14 }} value={text} onChange={(e) => setText(e.target.value)} placeholder={'[\n  { "english": "…", "german": "…" }\n]'} aria-label={L('JSON oder CSV einfügen', 'Paste JSON or CSV')} spellCheck={false} autoCapitalize="off" autoCorrect="off" />
              <button className="btn block" disabled={!text.trim()} onClick={() => analyse(text)}>{L('Prüfen & Vorschau', 'Check & preview')}</button>
            </div>
          )}
          {error && <div className="banner error" role="alert">{error}</div>}
          <div className="card small">
            <strong>{L('Formate', 'Formats')}</strong>
            <p className="muted" style={{ margin: '6px 0' }}>{L('Pflichtfelder: english, german. Optional: example_en, example_de, alternatives, alternatives_en, alternatives_de, ipa, category, level, type, tags, notes, common_mistake, explanation, source, examples.', 'Required: english, german. Optional: example_en, example_de, alternatives, alternatives_en, alternatives_de, ipa, category, level, type, tags, notes, common_mistake, explanation, source, examples.')}</p>
            <div className="row wrap">
              <a className="btn small secondary" href="examples/sample-import.json" download>{L('Beispiel JSON', 'Sample JSON')}</a>
              <a className="btn small secondary" href="examples/sample-import.csv" download>{L('Beispiel CSV', 'Sample CSV')}</a>
              <a className="btn small ghost" href="#/prompt">{L('ChatGPT-Prompt', 'ChatGPT prompt')}</a>
            </div>
          </div>
        </div>
      )}

      {plan && (
        <div className="stack">
          <div className="card">
            <h3>{L('Vorschau', 'Preview')} · {plan.format.toUpperCase()} · {plan.rows.length} {L('Zeilen', 'rows')}</h3>
            <div className="chips wrap">
              <span className="badge green">{plan.counts.new} {L('neu', 'new')}</span>
              <span className="badge accent">{plan.counts.update} {L('Aktualisierungen', 'updates')}</span>
              <span className="badge">{plan.counts.unchanged} {L('vorhanden & unverändert', 'existing & unchanged')}</span>
              <span className="badge orange">{plan.counts.duplicate} {L('Duplikate', 'duplicates')}</span>
              <span className="badge red">{plan.counts.invalid} {L('fehlerhaft', 'invalid')}</span>
            </div>
            {plan.newCategories.length > 0 && (
              <p className="small" style={{ marginBottom: 0 }}>{L('Neue Kategorien werden angelegt:', 'New categories will be created:')} {plan.newCategories.map((c) => c.name).join(', ')}</p>
            )}
            {plan.repairs && plan.repairs.length > 0 && (
              <p className="small" style={{ marginBottom: 0, color: 'var(--orange)' }}>
                {L('Der eingefügte Text wurde automatisch repariert (z. B. Zeichen aus dem Kopieren der ganzen ChatGPT-Nachricht). Bitte Vorschau kurz prüfen.', 'The pasted text was repaired automatically (e.g. characters from copying the whole ChatGPT message). Please check the preview.')}
              </p>
            )}
            <p className="tiny muted" style={{ marginBottom: 0 }}>{L('Lernfortschritt bestehender Einträge bleibt in jedem Fall erhalten.', 'Learning progress of existing items is always kept.')}</p>
          </div>

          <div className="list">
            {rows.map((r) => {
              const i = plan.rows.indexOf(r);
              return (
                <div key={i} className="list-item" style={{ alignItems: 'flex-start' }}>
                  <span className="main">
                    <span className="row wrap" style={{ gap: 6 }}>
                      <span className="tiny muted">#{r.index}</span>
                      <span className={`badge ${STATUS_STYLE[r.status]}`}>{statusLabel[r.status]}</span>
                      {r.draft?.level && <span className="badge">{r.draft.level}</span>}
                    </span>
                    {r.draft ? (
                      <>
                        <span className="primary" style={{ display: 'block' }}>{r.draft.english}</span>
                        <span className="secondary" style={{ display: 'block' }}>{r.draft.german}</span>
                      </>
                    ) : (
                      <span className="secondary" style={{ display: 'block', color: 'var(--red)' }}>{r.errors.join(', ')}</span>
                    )}
                    {r.status === 'update' && <span className="tiny muted" style={{ display: 'block' }}>{L('Ändert', 'Changes')}: {r.changes.join(', ')}</span>}
                    {r.warnings.length > 0 && <span className="tiny" style={{ display: 'block', color: 'var(--orange)' }}>⚠︎ {r.warnings.join(' · ')}</span>}
                  </span>
                  {(r.status === 'new' || r.status === 'update') && (
                    <select className="select" style={{ width: 'auto', minHeight: 36, padding: '4px 30px 4px 8px', fontSize: 14, backgroundPosition: 'calc(100% - 16px) 15px, calc(100% - 10px) 15px' }} value={r.action} onChange={(e) => setAction(i, e.target.value as RowAction)} aria-label={L('Aktion', 'Action')}>
                      {r.status === 'new' && <option value="add">{L('Hinzufügen', 'Add')}</option>}
                      {r.status === 'update' && <option value="update">{L('Aktualisieren', 'Update')}</option>}
                      {r.status === 'update' && <option value="add">{L('Als neu anlegen', 'Add as new')}</option>}
                      <option value="skip">{L('Überspringen', 'Skip')}</option>
                    </select>
                  )}
                </div>
              );
            })}
            {rows.length === 0 && <div className="list-item muted small">{L('Alle Einträge sind bereits vorhanden und unverändert.', 'All entries already exist unchanged.')}</div>}
          </div>
          {!showAll && plan.rows.length > rows.length && <button className="btn ghost" onClick={() => setShowAll(true)}>{L('Alle Zeilen anzeigen', 'Show all rows')}</button>}

          <div className="sticky-actions">
            <button className="btn secondary" onClick={() => setPlan(null)}>{L('Abbrechen', 'Cancel')}</button>
            <button className="btn grow" disabled={toApply === 0 || busy} onClick={confirm}>
              {L(`Import bestätigen (${toApply})`, `Confirm import (${toApply})`)}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
