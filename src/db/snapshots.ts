/**
 * Automatic restore points inside the app ("Auto-Kopien").
 *
 * Created after every study session and BEFORE every risky action (import,
 * restore, setup code, removing packs, deleting). The newest MAX_SNAPSHOTS are
 * kept. They live in the same browser storage as the data, so they protect
 * against mistakes inside the app – NOT against deleting the home-screen app
 * or iOS clearing website data. For that, the file backup is needed.
 */
import { db, type Snapshot } from './db';
import { createBackup, restoreBackup, validateBackup, type BackupFile } from './backup';

// Build constant from vite (undefined in unit tests); module-scoped declaration.
declare const __APP_VERSION__: string | undefined;

export const MAX_SNAPSHOTS = 10;

export async function createSnapshot(reason: string): Promise<number | null> {
  try {
    const b = await createBackup(typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev');
    if (b.data.items.length === 0 && b.data.reviewLogs.length === 0) return null; // nothing worth keeping
    const id = await db().snapshots.add({
      createdAt: b.exportedAt,
      reason,
      appVersion: b.appVersion,
      items: b.data.items.length,
      logs: b.data.reviewLogs.length,
      data: JSON.stringify(b),
    });
    await pruneSnapshots();
    return id as number;
  } catch {
    return null; // a failed snapshot must never block the user
  }
}

export async function pruneSnapshots(keep = MAX_SNAPSHOTS): Promise<void> {
  const all = await db().snapshots.orderBy('createdAt').primaryKeys();
  const ids = all as number[];
  if (ids.length > keep) await db().snapshots.bulkDelete(ids.slice(0, ids.length - keep));
}

/** Newest first, without the (large) data payload. */
export async function listSnapshots(): Promise<Omit<Snapshot, 'data'>[]> {
  const all = await db().snapshots.orderBy('createdAt').reverse().toArray();
  return all.map(({ data: _data, ...meta }) => meta);
}

/** Restore a snapshot; the current state is saved as a snapshot first (undo). */
export async function restoreSnapshot(id: number): Promise<void> {
  const s = await db().snapshots.get(id);
  if (!s) throw new Error('not-found');
  const check = validateBackup(s.data);
  if (!check.ok || !check.backup) throw new Error(check.errors.join(','));
  await createSnapshot('Vor dem Zurückholen einer Auto-Kopie');
  await restoreBackup(check.backup as BackupFile);
}
