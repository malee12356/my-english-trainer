import Dexie from 'dexie';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TrainerDB, setDbForTests } from '../../src/db/db';
import { createBackup, itemsToCsv, itemsToImportJson, restoreBackup, validateBackup } from '../../src/db/backup';
import { addItem, applyImport, autoLoadStarterOnFirstStart, deleteItems, ensureSetup, getSettings, loadSnapshot, recordAnswer, saveSettings, startSession } from '../../src/db/repo';
import { parseImport, planImport } from '../../src/domain/importer';
import { deterministicEngine, setEngineForTests } from '../../src/domain/scheduler';
import { STARTER_CONTENT } from '../../src/data/starter';
import type { Task } from '../../src/domain/types';

let n = 0;
let current: TrainerDB;
beforeAll(() => setEngineForTests(deterministicEngine()));
afterAll(() => setEngineForTests(null));
beforeEach(async () => {
  current = new TrainerDB(`test-db-${++n}`);
  setDbForTests(current);
  await ensureSetup();
});

async function importText(text: string) {
  const snap = await loadSnapshot();
  const plan = planImport(parseImport(text), snap.items, snap.categories.map((c) => c.id));
  return { plan, result: await applyImport(plan) };
}

const task = (itemId: string): Task => ({ itemId, method: 'flashcards', skill: 'recall', direction: 'de-en', practice: false, isNew: true });

describe('database & import integration', () => {
  it('creates built-in topic categories and default settings', async () => {
    const snap = await loadSnapshot();
    expect(snap.categories.map((c) => c.id).sort()).toEqual(['business', 'engineering', 'everyday', 'handball', 'meeting']);
    expect(snap.settings.uiLang).toBe('de');
  });

  it('re-import keeps learning progress and updates content', async () => {
    await importText(JSON.stringify([{ english: 'boundary conditions', german: 'Randbedingungen', category: 'Engineering Mode' }]));
    let snap = await loadSnapshot();
    const item = snap.items[0];
    const session = await startSession('all', 'auto');
    await recordAnswer({ task: task(item.id), grade: 3, responseMs: 3000, session, alreadyAnsweredInSession: false });
    const before = (await loadSnapshot()).progress[0];
    expect(before.reps).toBe(1);

    const { plan, result } = await importText(JSON.stringify([
      { english: 'Boundary conditions', german: 'Randbedingungen', alternatives_de: ['Lagerbedingungen'], category: 'Meeting Mode', notes: 'updated' },
      { english: 'mesh', german: 'Netz' },
    ]));
    expect(plan.counts.update).toBe(1);
    expect(result).toMatchObject({ added: 1, updated: 1 });
    snap = await loadSnapshot();
    const updated = snap.items.find((i) => i.id === item.id)!;
    expect(updated.notes).toBe('updated');
    expect(updated.categories).toEqual(['engineering', 'meeting']);
    expect(snap.progress).toHaveLength(1);
    expect(snap.progress[0]).toEqual(before);
  });

  it('skipped rows are not written; new categories are created', async () => {
    const snap = await loadSnapshot();
    const plan = planImport(parseImport(JSON.stringify([{ english: 'a', german: 'a', category: 'Cooking' }, { english: 'b', german: 'b' }])), snap.items, snap.categories.map((c) => c.id));
    plan.rows[1].action = 'skip';
    const res = await applyImport(plan);
    expect(res).toEqual({ added: 1, updated: 0, skipped: 1, categoriesCreated: 1 });
    expect((await loadSnapshot()).categories.some((c) => c.id === 'c-cooking')).toBe(true);
  });

  it('imports all starter content without errors or duplicates', async () => {
    const snap = await loadSnapshot();
    const plan = planImport(parseImport(JSON.stringify(STARTER_CONTENT)), snap.items, snap.categories.map((c) => c.id));
    expect(plan.counts.invalid).toBe(0);
    expect(plan.counts.duplicate).toBe(0);
    expect(plan.newCategories).toEqual([]);
    const res = await applyImport(plan, undefined, 'starter');
    expect(res.added).toBe(STARTER_CONTENT.length);
    const again = planImport(parseImport(JSON.stringify(STARTER_CONTENT)), (await loadSnapshot()).items, []);
    expect(again.counts.unchanged).toBe(STARTER_CONTENT.length);
  });

  it('delete removes progress but keeps history logs for statistics', async () => {
    const it1 = await addItem({ english: 'strain', german: 'Dehnung' });
    const session = await startSession('all', 'auto');
    await recordAnswer({ task: task(it1.id), grade: 1, responseMs: 1, session, alreadyAnsweredInSession: false });
    await deleteItems([it1.id]);
    const snap = await loadSnapshot();
    expect(snap.items).toHaveLength(0);
    expect(snap.progress).toHaveLength(0);
    expect(snap.logs).toHaveLength(1);
  });

  it('records answers, session counters and the "new" flag only once per item', async () => {
    const it1 = await addItem({ english: 'yield strength', german: 'Streckgrenze' });
    const session = await startSession('engineering', 'flashcards');
    await recordAnswer({ task: task(it1.id), grade: 1, responseMs: 1, session, alreadyAnsweredInSession: false });
    const r2 = await recordAnswer({ task: task(it1.id), grade: 3, responseMs: 1, session, alreadyAnsweredInSession: true });
    expect(r2.scheduled).toBe(false);
    const snap = await loadSnapshot();
    expect(snap.logs.map((l) => l.isNew)).toEqual([true, undefined]);
    expect(snap.sessions[0]).toMatchObject({ answered: 2, correct: 1 });
    expect(snap.settings.lastMode).toMatchObject({ topic: 'engineering', method: 'flashcards' });
  });
});

describe('default vocabulary on first start', () => {
  it('loads once into an empty app and never again, also not after deleting', async () => {
    const added = await autoLoadStarterOnFirstStart();
    expect(added).toBe(STARTER_CONTENT.length);
    expect(added).toBeGreaterThanOrEqual(150);
    const snap = await loadSnapshot();
    expect(snap.items.every((i) => i.origin === 'starter')).toBe(true);
    expect(await autoLoadStarterOnFirstStart()).toBe(0);
    await deleteItems(snap.items.map((i) => i.id));
    expect(await autoLoadStarterOnFirstStart()).toBe(0);
    expect((await loadSnapshot()).items).toHaveLength(0);
  });

  it('does not add anything when the user already has content', async () => {
    await addItem({ english: 'strain', german: 'Dehnung' });
    expect(await autoLoadStarterOnFirstStart()).toBe(0);
    expect((await loadSnapshot()).items).toHaveLength(1);
    expect((await getSettings()).starterAutoLoaded).toBe(true);
  });
});

describe('backup & restore', () => {
  it('round-trips all data including learning progress', async () => {
    await importText(JSON.stringify(STARTER_CONTENT.slice(0, 5)));
    const snap = await loadSnapshot();
    const session = await startSession('all', 'auto');
    await recordAnswer({ task: task(snap.items[0].id), grade: 3, responseMs: 1, session, alreadyAnsweredInSession: false });
    await saveSettings({ dailyGoalMin: 30, accent: 'en-US' });
    const backup = await createBackup('0.1.0');
    const text = JSON.stringify(backup);

    const check = validateBackup(text);
    expect(check.ok).toBe(true);
    expect(check.counts).toMatchObject({ items: 5, progress: 1, reviewLogs: 1, sessions: 1 });

    // wipe and restore into a fresh database
    setDbForTests(new TrainerDB(`restore-${n}`));
    await ensureSetup();
    await restoreBackup(check.backup!);
    const after = await loadSnapshot();
    expect(after.items.map((i) => i.id).sort()).toEqual(snap.items.map((i) => i.id).sort());
    expect(after.progress).toEqual(backup.data.progress);
    expect(after.logs).toHaveLength(1);
    expect((await getSettings()).dailyGoalMin).toBe(30);
  });

  it('rejects invalid or foreign files with clear errors', () => {
    expect(validateBackup('nope').errors).toEqual(['not-json']);
    expect(validateBackup('{"format":"other"}').errors).toEqual(['wrong-format']);
    expect(validateBackup(JSON.stringify({ format: 'personal-english-trainer-backup', version: 99, data: {} })).ok).toBe(false);
    const bad = { format: 'personal-english-trainer-backup', version: 1, data: { items: [{ id: 1 }], progress: [], reviewLogs: [], sessions: [], categories: [], collections: [] } };
    expect(validateBackup(JSON.stringify(bad)).errors).toEqual(['invalid-items:1']);
  });

  it('exports items as CSV and re-importable JSON', async () => {
    await importText(JSON.stringify(STARTER_CONTENT.slice(0, 3)));
    const snap = await loadSnapshot();
    const csv = itemsToCsv(snap.items, snap.categories);
    expect(csv.split('\r\n')[0]).toMatch(/^id,english,german/);
    const reimport = planImport(parseImport(csv), snap.items, snap.categories.map((c) => c.id));
    expect(reimport.counts.unchanged + reimport.counts.update).toBe(3);
    const json = itemsToImportJson(snap.items, snap.categories);
    const plan = planImport(parseImport(json), snap.items, snap.categories.map((c) => c.id));
    expect(plan.counts.unchanged).toBe(3);
  });
});

describe('database migration', () => {
  it('upgrades a v1 database to the current schema without data loss', async () => {
    const name = `migrate-${n}`;
    const v1 = new Dexie(name);
    v1.version(1).stores({
      items: 'id, english, *categories, *tags, level, type, created_at, updated_at',
      progress: 'id, itemId, skill, due',
      reviewLogs: '++id, itemId, ts, sessionId',
      sessions: 'id, startedAt',
      categories: 'id',
      collections: 'id',
      settings: 'id',
    });
    await v1.table('items').add({ id: 'old-1', english: 'To consider', german: 'berücksichtigen', categories: ['meeting'], tags: [], created_at: 'x', updated_at: 'x' });
    await v1.table('progress').add({ id: 'old-1:recall', itemId: 'old-1', skill: 'recall', due: '2026-01-01T00:00:00.000Z', reps: 3 });
    v1.close();

    const upgraded = new TrainerDB(name);
    await upgraded.open();
    expect(upgraded.verno).toBe(2);
    const it1 = await upgraded.items.get('old-1');
    expect(it1).toMatchObject({ key: 'consider', favorite: false, archived: false, alternatives_en: [], collections: [] });
    expect(await upgraded.items.where('key').equals('consider').count()).toBe(1);
    expect((await upgraded.progress.get('old-1:recall'))?.reps).toBe(3);
    upgraded.close();
  });
});
