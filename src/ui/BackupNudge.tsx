import { useState } from 'react';
import { createBackup, markBackupDone } from '../db/backup';
import { useApp } from '../state';
import { dateStamp, saveFile } from './files';

/**
 * One-tap file backup after a study session. On the iPhone this opens the
 * share sheet → "Save to Files" (e.g. iCloud Drive). Protects against losing
 * the app data completely (unlike the automatic in-app copies).
 */
export function BackupNudge() {
  const { L, settings, updateSettings, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const last = settings.lastBackupAt ? new Date(settings.lastBackupAt) : null;
  const today = last && last.toDateString() === new Date().toDateString();
  const save = async () => {
    setBusy(true);
    const b = await createBackup(__APP_VERSION__);
    const r = await saveFile(`english-trainer-backup-${dateStamp()}.json`, JSON.stringify(b), 'application/json');
    setBusy(false);
    if (r !== 'cancelled') {
      await markBackupDone();
      await updateSettings({ lastBackupAt: new Date().toISOString() });
      toast(L('Backup gesichert ✓', 'Backup saved ✓'));
    }
  };
  return (
    <div className={`banner ${today ? 'ok' : ''} small`} style={{ alignItems: 'center' }}>
      <span aria-hidden="true" style={{ fontSize: 22 }}>💾</span>
      <span className="grow">
        <strong style={{ display: 'block' }}>{today ? L('Heute schon gesichert', 'Saved today') : L('Fortschritt sichern', 'Save your progress')}</strong>
        {last ? L(`Letztes Backup: ${last.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}`, `Last backup: ${last.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}`) : L('Noch kein Backup – ein Tipp, dann „In Dateien sichern“.', 'No backup yet – one tap, then “Save to Files”.')}
      </span>
      <button className="btn small" onClick={save} disabled={busy}>{L('Sichern', 'Save')}</button>
    </div>
  );
}
