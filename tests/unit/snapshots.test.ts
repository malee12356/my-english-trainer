import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TrainerDB, setDbForTests, db } from '../../src/db/db';
import { addItem, applyImport, deleteItems, ensureSetup, loadSnapshot } from '../../src/db/repo';
import { createSnapshot, listSnapshots, MAX_SNAPSHOTS, pruneSnapshots, restoreSnapshot } from '../../src/db/snapshots';
import { parseImport, planImport } from '../../src/domain/importer';
import { deterministicEngine, setEngineForTests } from '../../src/domain/scheduler';

let n = 0;
beforeAll(() => setEngineForTests(deterministicEngine()));
afterAll(() => setEngineForTests(null));
beforeEach(async () => {
  setDbForTests(new TrainerDB(`snap-db-${++n}`));
  await ensureSetup();
});

describe('automatic in-app copies (snapshots)', () => {
  it('skips an empty database', async () => {
    expect(await createSnapshot('test')).toBeNull();
    expect(await listSnapshots()).toEqual([]);
  });

  it('creates, lists (newest first, without payload) and restores', async () => {
    await addItem({ english: 'gear', german: 'Zahnrad' });
    const id = await createSnapshot('Nach einer Lerneinheit');
    expect(id).not.toBeNull();
    await addItem({ english: 'bolt', german: 'Schraube' });
    await createSnapshot('zweite');
    const list = await listSnapshots();
    expect(list.map((s) => s.reason)).toEqual(['zweite', 'Nach einer Lerneinheit']);
    expect(list[0].items).toBe(2);
    expect('data' in list[0]).toBe(false);

    await restoreSnapshot(id!);
    expect((await loadSnapshot()).items.map((i) => i.english)).toEqual(['gear']);
    // the state before restoring is kept as a copy (undo)
    expect((await listSnapshots())[0].reason).toBe('Vor dem Zurückholen einer Auto-Kopie');
    expect((await listSnapshots())[0].items).toBe(2);
  });

  it(`keeps only the newest ${MAX_SNAPSHOTS}`, async () => {
    await addItem({ english: 'nut', german: 'Mutter' });
    for (let i = 0; i < MAX_SNAPSHOTS + 3; i++) await createSnapshot(`s${i}`);
    const list = await listSnapshots();
    expect(list).toHaveLength(MAX_SNAPSHOTS);
    expect(list[0].reason).toBe(`s${MAX_SNAPSHOTS + 2}`);
    await pruneSnapshots(2);
    expect(await db().snapshots.count()).toBe(2);
  });

  it('saves a copy before deleting items and before an import', async () => {
    const a = await addItem({ english: 'shaft', german: 'Welle' });
    await deleteItems([a.id]);
    expect((await listSnapshots())[0]).toMatchObject({ reason: 'Vor dem Löschen von Einträgen', items: 1 });

    await addItem({ english: 'spring', german: 'Feder' });
    const snap = await loadSnapshot();
    const plan = planImport(parseImport(JSON.stringify([{ english: 'washer', german: 'Unterlegscheibe' }])), snap.items, snap.categories.map((c) => c.id));
    await applyImport(plan);
    expect((await listSnapshots())[0]).toMatchObject({ reason: 'Vor dem Import', items: 1 });
  });

  it('restoring does not touch the copies themselves', async () => {
    await addItem({ english: 'axle', german: 'Achse' });
    const id = await createSnapshot('a');
    await restoreSnapshot(id!);
    expect(await db().snapshots.count()).toBe(2);
  });

  it('rejects an unknown id', async () => {
    await expect(restoreSnapshot(999)).rejects.toThrow('not-found');
  });
});
