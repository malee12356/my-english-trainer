import { useEffect, useRef, useState } from 'react';
import { createBackup, itemsToCsv, itemsToImportJson, markBackupDone, restoreBackup, validateBackup, type BackupCheck } from '../db/backup';
import { getSettings, loadSnapshot } from '../db/repo';
import { useApp } from '../state';
import { NavBar, useConfirm } from '../ui/components';
import { createSnapshot, listSnapshots, restoreSnapshot } from '../db/snapshots';
import type { Snapshot } from '../db/db';
import { dateStamp, readFileAsText, saveFile } from '../ui/files';
import { IconDownload, IconUpload } from '../ui/icons';
import { PinUnlockSheet } from './parent/ParentUI';

export function BackupScreen() {
  const { L, settings, bump, toast, updateSettings, parentLocked } = useApp();
  const [unlock, setUnlock] = useState(false);
  const [check, setCheck] = useState<BackupCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { confirm, dialog } = useConfirm();
  const [copies, setCopies] = useState<Omit<Snapshot, 'data'>[] | null>(null);
  const reloadCopies = () => listSnapshots().then(setCopies, () => setCopies([]));
  useEffect(() => {
    void reloadCopies();
  }, []);

  const restoreCopy = async (c: Omit<Snapshot, 'data'>) => {
    const when = new Date(c.createdAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
    const ok = await confirm(
      L('Auto-Kopie zurückholen?', 'Restore automatic copy?'),
      L(`Der Stand vom ${when} (${c.reason}) ersetzt alle aktuellen Daten. Der jetzige Stand wird vorher selbst als Kopie gesichert.`, `The state from ${when} (${c.reason}) replaces all current data. The current state is saved as a copy first.`),
      { danger: true, ok: L('Zurückholen', 'Restore') },
    );
    if (!ok || c.id == null) return;
    setBusy(true);
    try {
      await restoreSnapshot(c.id);
      await updateSettings(await getSettings());
      bump();
      toast(L('Stand zurückgeholt ✓', 'State restored ✓'));
    } catch (e) {
      toast(L(`Zurückholen fehlgeschlagen: ${(e as Error).message}`, `Restore failed: ${(e as Error).message}`));
    }
    setBusy(false);
    void reloadCopies();
  };

  const exportFull = async () => {
    setBusy(true);
    const b = await createBackup(__APP_VERSION__);
    const r = await saveFile(`english-trainer-backup-${dateStamp()}.json`, JSON.stringify(b), 'application/json');
    setBusy(false);
    if (r !== 'cancelled') {
      await markBackupDone();
      await updateSettings({ lastBackupAt: new Date().toISOString() });
      toast(L('Backup erstellt ✓', 'Backup created ✓'));
    }
  };
  const exportContent = async (kind: 'csv' | 'json') => {
    const s = await loadSnapshot();
    if (kind === 'csv') await saveFile(`vocabulary-${dateStamp()}.csv`, itemsToCsv(s.items, s.categories), 'text/csv');
    else await saveFile(`vocabulary-${dateStamp()}.json`, itemsToImportJson(s.items, s.categories), 'application/json');
  };

  const onFile = async (f?: File) => {
    if (!f) return;
    try {
      setCheck(validateBackup(await readFileAsText(f, 100 * 1024 * 1024)));
    } catch (e) {
      setCheck({ ok: false, errors: [String((e as Error).message)], warnings: [] });
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const restore = async () => {
    if (!check?.backup) return;
    const ok = await confirm(
      L('Alle Daten ersetzen?', 'Replace all data?'),
      L('Alle aktuellen Inhalte, Lernfortschritte und Einstellungen auf diesem Gerät werden durch das Backup ersetzt. Tipp: Vorher ein aktuelles Backup exportieren.', 'All current content, progress and settings on this device will be replaced by the backup. Tip: export a current backup first.'),
      { danger: true, ok: L('Wiederherstellen', 'Restore') },
    );
    if (!ok) return;
    setBusy(true);
    await createSnapshot('Vor dem Wiederherstellen eines Backups');
    await restoreBackup(check.backup);
    await updateSettings(await getSettings());
    setBusy(false);
    setCheck(null);
    bump();
    void reloadCopies();
    toast(L('Backup wiederhergestellt ✓', 'Backup restored ✓'));
  };

  const errText = (e: string) =>
    ({ 'not-json': L('Keine gültige JSON-Datei.', 'Not a valid JSON file.'), 'wrong-format': L('Das ist keine Backup-Datei dieser App (für Vokabellisten bitte „Importieren“ nutzen).', 'Not a backup file of this app (use "Import" for vocabulary lists).'), 'unsupported-version': L('Backup stammt aus einer neueren App-Version.', 'Backup is from a newer app version.') })[e] ?? e;

  return (
    <main className="page">
      <NavBar title={L('Backup', 'Backup')} back="/settings" />
      <div className="banner info small">
        {L('Deine Daten liegen nur lokal auf diesem Gerät. iOS kann Daten von Web-Apps in seltenen Fällen löschen (z. B. bei Speichermangel oder langer Nichtnutzung). Sichere regelmäßig – z. B. in iCloud Drive.', 'Your data lives only on this device. iOS may delete web app data in rare cases (e.g. low storage or long inactivity). Back up regularly – e.g. to iCloud Drive.')}
      </div>

      <h2 className="section-title">{L('Sichern', 'Back up')}</h2>
      <div className="card stack">
        <div className="small muted">{L('Letztes Backup', 'Last backup')}: <strong>{settings.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleString() : L('noch keines', 'none yet')}</strong></div>
        <button className="btn block big" onClick={exportFull} disabled={busy}><IconDownload size={20} /> {L('Vollständiges Backup exportieren', 'Export full backup')}</button>
        <p className="tiny muted" style={{ margin: 0 }}>{L('Enthält Inhalte, Lernfortschritt, Statistik und Einstellungen (versioniertes JSON). Auf dem iPhone: „In Dateien sichern“ wählen.', 'Contains content, progress, statistics and settings (versioned JSON). On iPhone choose "Save to Files".')}</p>
        <div className="row">
          <button className="btn secondary grow" onClick={() => exportContent('csv')}>{L('Vokabeln als CSV', 'Vocabulary as CSV')}</button>
          <button className="btn secondary grow" onClick={() => exportContent('json')}>{L('Vokabeln als JSON', 'Vocabulary as JSON')}</button>
        </div>
      </div>

      <h2 className="section-title">{L('Wiederherstellen', 'Restore')}</h2>
      {parentLocked ? (
        <div className="card stack">
          <span className="small muted">🔒 {L('Wiederherstellen ist durch die Eltern-PIN geschützt.', 'Restoring is protected by the parent PIN.')}</span>
          <button className="btn block secondary" onClick={() => setUnlock(true)}>🔓 {L('Elternbereich entsperren', 'Unlock parent area')}</button>
          <PinUnlockSheet open={unlock} onClose={() => setUnlock(false)} />
        </div>
      ) : (
      <div className="card stack">
        <input ref={fileRef} type="file" accept=".json,application/json" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} aria-label={L('Backup-Datei wählen', 'Choose backup file')} />
        <button className="btn block secondary" onClick={() => fileRef.current?.click()}><IconUpload size={20} /> {L('Backup-Datei wählen', 'Choose backup file')}</button>
        {check && !check.ok && <div className="banner error" role="alert">{check.errors.map(errText).join(' ')}</div>}
        {check?.ok && check.counts && check.meta && (
          <div className="stack">
            <div className="banner ok small">
              <span>
                <strong>{L('Backup gültig', 'Backup valid')}</strong> · {L('erstellt', 'created')} {new Date(check.meta.exportedAt).toLocaleString()} · App {check.meta.appVersion}
                <br />
                {check.counts.items} {L('Einträge', 'items')}, {check.counts.progress} {L('Lernstände', 'progress records')}, {check.counts.reviewLogs} {L('Antworten', 'answers')}, {check.counts.sessions} {L('Sitzungen', 'sessions')}, {check.counts.categories} {L('Kategorien', 'categories')}
              </span>
            </div>
            {check.warnings.length > 0 && <div className="tiny muted">⚠︎ {check.warnings.join(', ')}</div>}
            <button className="btn block danger" onClick={restore} disabled={busy}>{L('Alle Daten durch Backup ersetzen', 'Replace all data with backup')}</button>
            <button className="btn block ghost" onClick={() => setCheck(null)}>{L('Abbrechen', 'Cancel')}</button>
          </div>
        )}
      </div>
      )}

      <h2 className="section-title">{L('Automatische Kopien', 'Automatic copies')}</h2>
      <div className="card stack" aria-label={L('Automatische Kopien', 'Automatic copies')}>
        <p className="tiny muted" style={{ margin: 0 }}>
          {L('Die App legt nach jeder Lerneinheit und vor riskanten Aktionen (Import, Löschen, Wiederherstellen, Einrichtungscode) automatisch eine Kopie an. Die letzten 10 bleiben erhalten. Sie liegen auf diesem Gerät in der App – wird die App gelöscht, sind sie auch weg. Darum zusätzlich ab und zu ein Backup in Dateien sichern.', 'After every study session and before risky actions (import, delete, restore, setup code) the app saves a copy automatically. The last 10 are kept. They live inside the app on this device – if the app is deleted they are gone too, so also save a backup to Files now and then.')}
        </p>
        {copies === null ? null : copies.length === 0 ? (
          <span className="small muted">{L('Noch keine automatische Kopie.', 'No automatic copy yet.')}</span>
        ) : (
          <ul className="list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {copies.map((c) => (
              <li key={c.id} className="row" style={{ alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid var(--line, rgba(0,0,0,.08))' }} data-testid="snapshot">
                <span className="grow small">
                  <strong style={{ display: 'block' }}>{new Date(c.createdAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</strong>
                  <span className="muted">{c.reason} · {c.items} {L('Einträge', 'items')}, {c.logs} {L('Antworten', 'answers')}</span>
                </span>
                {parentLocked ? (
                  <span className="tiny muted" aria-label={L('Durch Eltern-PIN geschützt', 'Protected by parent PIN')}>🔒</span>
                ) : (
                  <button className="btn small secondary" onClick={() => restoreCopy(c)} disabled={busy}>{L('Zurückholen', 'Restore')}</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {dialog}
    </main>
  );
}
