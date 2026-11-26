import { useRef, useState } from 'react';
import { createBackup, itemsToCsv, itemsToImportJson, markBackupDone, restoreBackup, validateBackup, type BackupCheck } from '../db/backup';
import { getSettings, loadSnapshot } from '../db/repo';
import { useApp } from '../state';
import { NavBar, useConfirm } from '../ui/components';
import { dateStamp, readFileAsText, saveFile } from '../ui/files';
import { IconDownload, IconUpload } from '../ui/icons';

export function BackupScreen() {
  const { L, settings, bump, toast, updateSettings } = useApp();
  const [check, setCheck] = useState<BackupCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { confirm, dialog } = useConfirm();

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
    await restoreBackup(check.backup);
    await updateSettings(await getSettings());
    setBusy(false);
    setCheck(null);
    bump();
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
      {dialog}
    </main>
  );
}
