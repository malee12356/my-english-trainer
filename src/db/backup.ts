/**
 * Versioned full backup (content + learning data + settings) and restore.
 * Format documented in DATA_SCHEMA.md ("Backup format").
 */
import { db, CURRENT_DB_VERSION } from './db';
import { getSettings, saveSettings } from './repo';
import { toCsv } from '../domain/csv';
import type { Category, Collection, Item, Progress, ReviewLog, Settings, StudySession } from '../domain/types';
import { itemKey } from '../domain/text';

export const BACKUP_FORMAT = 'personal-english-trainer-backup';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  appVersion: string;
  dbVersion: number;
  exportedAt: string;
  data: {
    items: Item[];
    progress: Progress[];
    reviewLogs: ReviewLog[];
    sessions: StudySession[];
    categories: Category[];
    collections: Collection[];
    settings: Settings | null;
  };
}

export async function createBackup(appVersion: string): Promise<BackupFile> {
  const d = db();
  return d.transaction('r', [d.items, d.progress, d.reviewLogs, d.sessions, d.categories, d.collections, d.settings], async () => ({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    appVersion,
    dbVersion: CURRENT_DB_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      items: await d.items.toArray(),
      progress: await d.progress.toArray(),
      reviewLogs: await d.reviewLogs.toArray(),
      sessions: await d.sessions.toArray(),
      categories: await d.categories.toArray(),
      collections: await d.collections.toArray(),
      settings: (await d.settings.get('settings')) ?? null,
    },
  }));
}

export async function markBackupDone(): Promise<void> {
  await saveSettings({ lastBackupAt: new Date().toISOString() });
}

export interface BackupCheck {
  ok: boolean;
  errors: string[];
  warnings: string[];
  meta?: { exportedAt: string; appVersion: string; version: number };
  counts?: { items: number; progress: number; reviewLogs: number; sessions: number; categories: number; collections: number };
  backup?: BackupFile;
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

export function validateBackup(text: string): BackupCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['not-json'], warnings };
  }
  if (!isObj(data) || data.format !== BACKUP_FORMAT) return { ok: false, errors: ['wrong-format'], warnings };
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) errors.push('unsupported-version');
  const d = data.data;
  if (!isObj(d)) return { ok: false, errors: [...errors, 'missing-data'], warnings };
  const arrays = ['items', 'progress', 'reviewLogs', 'sessions', 'categories', 'collections'] as const;
  for (const k of arrays) if (!Array.isArray(d[k])) errors.push(`missing:${k}`);
  if (errors.length) return { ok: false, errors, warnings };

  const items = d.items as unknown[];
  const badItems = items.filter((i) => !isObj(i) || typeof i.id !== 'string' || typeof i.english !== 'string' || typeof i.german !== 'string');
  if (badItems.length) errors.push(`invalid-items:${badItems.length}`);
  const ids = new Set(items.filter(isObj).map((i) => i.id as string));
  const progress = d.progress as unknown[];
  const badProg = progress.filter((p) => !isObj(p) || typeof p.id !== 'string' || typeof p.itemId !== 'string' || typeof p.due !== 'string');
  if (badProg.length) errors.push(`invalid-progress:${badProg.length}`);
  const orphan = progress.filter((p) => isObj(p) && !ids.has(p.itemId as string)).length;
  if (orphan) warnings.push(`orphan-progress:${orphan}`);

  const backup = data as unknown as BackupFile;
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    meta: { exportedAt: String(data.exportedAt ?? ''), appVersion: String(data.appVersion ?? ''), version: data.version as number },
    counts: {
      items: items.length,
      progress: progress.length,
      reviewLogs: (d.reviewLogs as unknown[]).length,
      sessions: (d.sessions as unknown[]).length,
      categories: (d.categories as unknown[]).length,
      collections: (d.collections as unknown[]).length,
    },
    backup: errors.length === 0 ? backup : undefined,
  };
}

/** Replace ALL local data with the backup (after the user confirmed the preview). */
export async function restoreBackup(b: BackupFile): Promise<void> {
  const d = db();
  const keepBackupDate = (await getSettings()).lastBackupAt;
  await d.transaction('rw', [d.items, d.progress, d.reviewLogs, d.sessions, d.categories, d.collections, d.settings], async () => {
    await Promise.all([d.items.clear(), d.progress.clear(), d.reviewLogs.clear(), d.sessions.clear(), d.categories.clear(), d.collections.clear()]);
    // normalise items from older versions
    const items = b.data.items.map((it) => ({
      ...it,
      key: it.key ?? itemKey(it.english),
      alternatives_en: it.alternatives_en ?? [],
      alternatives_de: it.alternatives_de ?? [],
      examples: it.examples ?? [],
      tags: it.tags ?? [],
      categories: it.categories ?? [],
      collections: it.collections ?? [],
      favorite: it.favorite ?? false,
      archived: it.archived ?? false,
    }));
    await d.items.bulkAdd(items);
    await d.progress.bulkAdd(b.data.progress);
    await d.reviewLogs.bulkAdd(b.data.reviewLogs.map((l) => ({ ...l })));
    await d.sessions.bulkAdd(b.data.sessions);
    await d.categories.bulkAdd(b.data.categories);
    await d.collections.bulkAdd(b.data.collections);
    if (b.data.settings) await d.settings.put({ ...b.data.settings, id: 'settings', lastBackupAt: b.data.settings.lastBackupAt ?? keepBackupDate });
  });
}

/* ----------------------------------------------------------- content export */

export const CSV_COLUMNS = [
  'id', 'english', 'german', 'type', 'level', 'categories', 'tags', 'alternatives_en', 'alternatives_de',
  'example_en', 'example_de', 'ipa', 'notes', 'common_mistake', 'explanation', 'source',
] as const;

export function itemsToCsv(items: Item[], categories: Category[]): string {
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;
  const rows = items.map((it) => [
    it.externalId ?? it.id, it.english, it.german, it.type, it.level ?? '', it.categories.map(catName).join('|'),
    it.tags.join('|'), it.alternatives_en.join('|'), it.alternatives_de.join('|'), it.example_en ?? '', it.example_de ?? '',
    it.ipa ?? '', it.notes ?? '', it.common_mistake ?? '', it.explanation ?? '', it.source ?? '',
  ]);
  return toCsv([...CSV_COLUMNS], rows);
}

/** Export items in the documented import format (re-importable, without learning data). */
export function itemsToImportJson(items: Item[], categories: Category[]): string {
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;
  const out = items.map((it) => {
    const o: Record<string, unknown> = {
      id: it.externalId ?? it.id,
      english: it.english,
      german: it.german,
      type: it.type,
      level: it.level,
      categories: it.categories.map(catName),
      alternatives_en: it.alternatives_en.length ? it.alternatives_en : undefined,
      alternatives_de: it.alternatives_de.length ? it.alternatives_de : undefined,
      example_en: it.example_en,
      example_de: it.example_de,
      examples: it.examples.length ? it.examples : undefined,
      ipa: it.ipa,
      tags: it.tags.length ? it.tags : undefined,
      notes: it.notes,
      common_mistake: it.common_mistake,
      explanation: it.explanation,
      source: it.source,
      created_at: it.created_at,
      updated_at: it.updated_at,
    };
    Object.keys(o).forEach((k) => o[k] === undefined && delete o[k]);
    return o;
  });
  return JSON.stringify(out, null, 2);
}
