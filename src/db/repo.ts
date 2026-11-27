/** Data access layer. UI code talks to the database only through this module. */
import { db } from './db';
import { draftToItem, mergeDraft, parseImport, planImport, type ImportPlan } from '../domain/importer';
import { uuid } from '../domain/ids';
import { applyReview, newProgress, progressId } from '../domain/scheduler';
import { cleanText, itemKey } from '../domain/text';
import { builtinCategories, resolveCategoryId } from '../domain/topics';
import { dayKey } from '../domain/stats';
import {
  DEFAULT_SETTINGS,
  type Category,
  type Collection,
  type Grade,
  type Item,
  type Method,
  type Progress,
  type ReviewLog,
  type Settings,
  type StudySession,
  type Task,
} from '../domain/types';

export async function ensureSetup(): Promise<void> {
  const d = db();
  await d.transaction('rw', d.categories, d.settings, async () => {
    const existing = new Set((await d.categories.toArray()).map((c) => c.id));
    const missing = builtinCategories().filter((c) => !existing.has(c.id));
    if (missing.length) await d.categories.bulkAdd(missing);
    if (!(await d.settings.get('settings'))) await d.settings.put({ ...DEFAULT_SETTINGS });
  });
}

/* ---------------------------------------------------------------- settings */

export async function getSettings(): Promise<Settings> {
  const s = await db().settings.get('settings');
  return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch, id: 'settings' as const };
  await db().settings.put(next);
  return next;
}

/* ------------------------------------------------------------------- items */

export type ItemInput = Pick<Item, 'english' | 'german'> & Partial<Omit<Item, 'id' | 'key' | 'created_at' | 'updated_at' | 'schemaVersion'>>;

export function buildItem(input: ItemInput, origin: Item['origin'], now = new Date().toISOString()): Item {
  const english = cleanText(input.english, 1000);
  return {
    id: uuid(),
    schemaVersion: 1,
    english,
    german: cleanText(input.german, 1000),
    alternatives_en: (input.alternatives_en ?? []).map((s) => cleanText(s, 300)).filter(Boolean),
    alternatives_de: (input.alternatives_de ?? []).map((s) => cleanText(s, 300)).filter(Boolean),
    example_en: input.example_en ? cleanText(input.example_en) : undefined,
    example_de: input.example_de ? cleanText(input.example_de) : undefined,
    examples: input.examples ?? [],
    ipa: input.ipa ? cleanText(input.ipa, 200) : undefined,
    type: input.type ?? 'phrase',
    level: input.level,
    categories: input.categories ?? [],
    tags: input.tags ?? [],
    notes: input.notes ? cleanText(input.notes, 4000) : undefined,
    common_mistake: input.common_mistake ? cleanText(input.common_mistake) : undefined,
    explanation: input.explanation ? cleanText(input.explanation, 4000) : undefined,
    source: input.source,
    favorite: input.favorite ?? false,
    archived: input.archived ?? false,
    collections: input.collections ?? [],
    origin,
    externalId: input.externalId,
    key: itemKey(english),
    created_at: now,
    updated_at: now,
  };
}

export async function addItem(input: ItemInput): Promise<Item> {
  const it = buildItem(input, 'manual');
  await db().items.add(it);
  return it;
}

export async function updateItem(id: string, patch: Partial<Item>): Promise<void> {
  const cur = await db().items.get(id);
  if (!cur) throw new Error('not-found');
  const next: Item = { ...cur, ...patch, id: cur.id, updated_at: new Date().toISOString() };
  next.key = itemKey(next.english);
  await db().items.put(next);
}

export async function bulkUpdate(ids: string[], fn: (it: Item) => Item): Promise<void> {
  const d = db();
  await d.transaction('rw', d.items, async () => {
    const items = (await d.items.bulkGet(ids)).filter((x): x is Item => !!x);
    const now = new Date().toISOString();
    await d.items.bulkPut(items.map((it) => ({ ...fn(it), updated_at: now })));
  });
}

/** Deletes items and their learning progress. Review logs stay for statistics. */
export async function deleteItems(ids: string[]): Promise<void> {
  const d = db();
  await d.transaction('rw', d.items, d.progress, async () => {
    await d.items.bulkDelete(ids);
    await d.progress.where('itemId').anyOf(ids).delete();
  });
}

export async function createCategory(name: string): Promise<Category> {
  const r = resolveCategoryId(name);
  if (!r) throw new Error('invalid-name');
  const cat: Category = { id: r.id, name: r.name, builtin: r.builtin, created_at: new Date().toISOString() };
  if (!(await db().categories.get(cat.id))) await db().categories.add(cat);
  return cat;
}

export async function createCollection(name: string): Promise<string> {
  const id = uuid();
  await db().collections.add({ id, name: cleanText(name, 60), created_at: new Date().toISOString() });
  return id;
}

/* ------------------------------------------------------------------ import */

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
  categoriesCreated: number;
}

/**
 * Apply a confirmed import plan in one transaction. Only item CONTENT is
 * written; learning progress (separate table) is never touched.
 */
export async function applyImport(plan: ImportPlan, source?: string, origin: Item['origin'] = 'import'): Promise<ImportResult> {
  const d = db();
  const now = new Date().toISOString();
  const res: ImportResult = { added: 0, updated: 0, skipped: 0, categoriesCreated: 0 };
  await d.transaction('rw', d.items, d.categories, async () => {
    const existingCats = new Set((await d.categories.toArray()).map((c) => c.id));
    for (const c of plan.newCategories) {
      if (!existingCats.has(c.id)) {
        await d.categories.add({ id: c.id, name: c.name, builtin: false, created_at: now });
        existingCats.add(c.id);
        res.categoriesCreated++;
      }
    }
    for (const row of plan.rows) {
      if (!row.draft || row.action === 'skip') {
        res.skipped++;
        continue;
      }
      const draft = source && !row.draft.source ? { ...row.draft, source } : row.draft;
      if (row.action === 'update' && row.existingId) {
        const cur = await d.items.get(row.existingId);
        if (cur) {
          await d.items.put(mergeDraft(cur, draft, now));
          res.updated++;
          continue;
        }
      }
      await d.items.add(draftToItem(draft, uuid(), now, origin));
      res.added++;
    }
  });
  return res;
}

/* ---------------------------------------------------------------- learning */

export async function startSession(topic: string, method: Method | 'auto'): Promise<StudySession> {
  const s: StudySession = { id: uuid(), startedAt: new Date().toISOString(), activeMs: 0, topic, method, answered: 0, correct: 0 };
  await db().sessions.add(s);
  await saveSettings({ lastMode: { topic, method, at: s.startedAt } });
  return s;
}

export async function updateSession(id: string, patch: Partial<StudySession>): Promise<void> {
  await db().sessions.update(id, patch);
}

export interface AnswerInput {
  task: Task;
  grade: Grade;
  responseMs: number;
  session: StudySession;
  alreadyAnsweredInSession: boolean;
  given?: string;
  now?: Date;
}

export async function recordAnswer(a: AnswerInput): Promise<{ progress: Progress; scheduled: boolean }> {
  const d = db();
  const now = a.now ?? new Date();
  return d.transaction('rw', d.progress, d.reviewLogs, d.sessions, async () => {
    const pid = progressId(a.task.itemId, a.task.skill);
    const prev = (await d.progress.get(pid)) ?? newProgress(a.task.itemId, a.task.skill, now);
    const isNewItem = (await d.progress.where('itemId').equals(a.task.itemId).count()) === 0;
    const out = applyReview(prev, a.grade, now, { alreadyAnsweredInSession: a.alreadyAnsweredInSession, responseMs: a.responseMs });
    await d.progress.put(out.progress);
    const log: ReviewLog = {
      itemId: a.task.itemId,
      skill: a.task.skill,
      method: a.task.method,
      topic: a.session.topic,
      grade: a.grade,
      scheduled: out.scheduled,
      correct: a.grade >= 2,
      responseMs: Math.round(a.responseMs),
      sessionId: a.session.id,
      ts: now.toISOString(),
      isNew: isNewItem || undefined,
      given: a.given ? a.given.slice(0, 200) : undefined,
    };
    await d.reviewLogs.add(log);
    const s = await d.sessions.get(a.session.id);
    if (s) await d.sessions.update(s.id, { answered: s.answered + 1, correct: s.correct + (a.grade >= 2 ? 1 : 0) });
    return out;
  });
}

export async function recordSkip(task: Task): Promise<void> {
  const pid = progressId(task.itemId, task.skill);
  const p = await db().progress.get(pid);
  if (p) await db().progress.update(pid, { skipped: p.skipped + 1 });
}

export async function newItemsIntroducedToday(now = new Date()): Promise<number> {
  const today = dayKey(now);
  const start = new Date(`${today}T00:00:00`).toISOString();
  return db().reviewLogs.where('ts').aboveOrEqual(start).filter((l) => !!l.isNew).count();
}

/* --------------------------------------------------------------- snapshot */

export interface Snapshot {
  items: Item[];
  progress: Progress[];
  logs: ReviewLog[];
  sessions: StudySession[];
  categories: Category[];
  collections: Collection[];
  settings: Settings;
}

export async function loadSnapshot(): Promise<Snapshot> {
  const d = db();
  const [items, progress, logs, sessions, categories, collections, settings] = await Promise.all([
    d.items.toArray(),
    d.progress.toArray(),
    d.reviewLogs.toArray(),
    d.sessions.toArray(),
    d.categories.toArray(),
    d.collections.toArray(),
    getSettings(),
  ]);
  return { items, progress, logs, sessions, categories, collections, settings };
}

/** Ask the browser to keep our data (reduces the risk of iOS evicting it). */
export async function requestPersistentStorage(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

/* ----------------------------------------------------------------- starter */

/**
 * First start: load the built-in starter content once into an empty app.
 * Never runs again (flag), so deleted starter items do not come back.
 * Test/dev escape hatch: localStorage "pet.skipStarter" = "1".
 */
export async function autoLoadStarterOnFirstStart(): Promise<number> {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('pet.skipStarter') === '1') return 0;
  } catch {
    /* storage blocked – ignore */
  }
  const s = await getSettings();
  if (s.starterAutoLoaded) return 0;
  const count = await db().items.count();
  await saveSettings({ starterAutoLoaded: true });
  if (count > 0) return 0;
  return (await loadStarterContent()).added;
}

export async function loadStarterContent(): Promise<ImportResult> {
  const { STARTER_CONTENT } = await import('../data/starter');
  const snap = await loadSnapshot();
  const plan = planImport(parseImport(JSON.stringify(STARTER_CONTENT)), snap.items, snap.categories.map((c) => c.id));
  // never overwrite the user's own content with starter content
  for (const r of plan.rows) if (r.action === 'update') r.action = 'skip';
  return applyImport(plan, 'starter', 'starter');
}
