/** Data access layer. UI code talks to the database only through this module. */
import { db } from './db';
import { draftToItem, mergeDraft, parseImport, planImport, type ImportPlan } from '../domain/importer';
import { uuid } from '../domain/ids';
import { applyReview, newProgress, progressId } from '../domain/scheduler';
import { cleanText, itemKey } from '../domain/text';
import { builtinCategories, resolveCategoryId } from '../domain/topics';
import { dayKey } from '../domain/stats';
import { KID_STARTER_SOURCES, type KidGrade } from '../domain/grades';
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

/**
 * Read-modify-write in ONE transaction, so quick successive changes (e.g. grade
 * and then minutes) cannot overwrite each other with a stale copy.
 */
export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const d = db();
  return d.transaction('rw', d.settings, async () => {
    const cur = await d.settings.get('settings');
    const next = { ...DEFAULT_SETTINGS, ...(cur ?? {}), ...patch, id: 'settings' as const };
    await d.settings.put(next);
    return next;
  });
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
export async function autoLoadStarterOnFirstStart(profile: Profile = 'adult'): Promise<number> {
  if (readLocal('pet.skipStarter') === '1') return 0;
  const s = await getSettings();
  if (s.starterAutoLoaded) return 0;
  const count = await db().items.count();
  await saveSettings({ starterAutoLoaded: true });
  if (count > 0) return 0;
  return (await loadStarterContent(profile)).added;
}

type Profile = 'adult' | 'kid';

function readLocal(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

/** Kid defaults: shorter sessions, fewer new words per day. */
export const KID_DEFAULTS = { dailyGoalMin: 10, defaultDurationMin: 10, newPerDay: 8 } as const;

/** Save the learner profile and load the matching default vocabulary into an empty app. */
export async function chooseProfile(profile: Profile, grade: KidGrade = '5-6'): Promise<void> {
  await saveSettings({ profile, profileChosen: true, ...(profile === 'kid' ? { ...KID_DEFAULTS, kidGrade: grade } : {}) });
  await autoLoadStarterOnFirstStart(profile);
}

/**
 * Start-up: decide whether the "who is learning?" question is needed.
 * Existing installations with content keep the adult profile silently.
 * Test/dev preset: localStorage "pet.profile" = "adult" | "kid".
 */
export async function resolveProfileOnStart(): Promise<'ready' | 'needs-choice'> {
  const s = await getSettings();
  if (s.profileChosen) {
    await autoLoadStarterOnFirstStart(s.profile ?? 'adult');
    return 'ready';
  }
  const preset = readLocal('pet.profile');
  if (preset === 'adult' || preset === 'kid') {
    await chooseProfile(preset);
    return 'ready';
  }
  if ((await db().items.count()) > 0 || s.starterAutoLoaded) {
    await saveSettings({ profile: 'adult', profileChosen: true });
    return 'ready';
  }
  return 'needs-choice';
}

async function starterRows(profile: Profile, grade: KidGrade): Promise<Record<string, unknown>[]> {
  if (profile === 'adult') return (await import('../data/starter')).STARTER_CONTENT;
  if (grade === '7-8') return (await import('../data/starterKidsUpper')).STARTER_KIDS_7_8;
  if (grade === '9-10') return (await import('../data/starterKidsUpper')).STARTER_KIDS_9_10;
  return (await import('../data/starterKids')).STARTER_KIDS;
}

export async function loadStarterContent(profile?: Profile, grade?: KidGrade): Promise<ImportResult> {
  const s = await getSettings();
  const p = profile ?? s.profile ?? 'adult';
  const STARTER_CONTENT = await starterRows(p, grade ?? s.kidGrade ?? '5-6');
  const snap = await loadSnapshot();
  const plan = planImport(parseImport(JSON.stringify(STARTER_CONTENT)), snap.items, snap.categories.map((c) => c.id));
  // never overwrite the user's own content with starter content
  for (const r of plan.rows) if (r.action === 'update') r.action = 'skip';
  return applyImport(plan, 'starter', 'starter');
}

/* ------------------------------------------------- remove default packs */

export type StarterPack = 'kids' | 'adult';

function inPack(it: Item, pack: StarterPack): boolean {
  if (it.origin !== 'starter') return false;
  const src = it.source ?? '';
  return pack === 'kids' ? KID_STARTER_SOURCES.includes(src) : !KID_STARTER_SOURCES.includes(src);
}

/** Number of default-pack items and how many of them were already practised. */
export async function starterPackInfo(pack: StarterPack): Promise<{ count: number; practised: number }> {
  const d = db();
  const items = (await d.items.toArray()).filter((i) => inPack(i, pack));
  const ids = new Set(items.map((i) => i.id));
  const practised = new Set((await d.progress.toArray()).filter((p) => ids.has(p.itemId) && p.reps > 0).map((p) => p.itemId));
  return { count: items.length, practised: practised.size };
}

/**
 * Remove a default vocabulary pack (only items the app added as starter
 * content – own imports and manual items are never touched). Their learning
 * progress is removed too; review history stays for statistics.
 */
export async function removeStarterPack(pack: StarterPack): Promise<number> {
  const ids = (await db().items.toArray()).filter((i) => inPack(i, pack)).map((i) => i.id);
  await deleteItems(ids);
  return ids.length;
}

/* --------------------------------------------------------- parental setup */

/**
 * Apply a setup code from a parent's app. In an empty app the default pupil
 * vocabulary of the grade is loaded as well. Learning data is never touched.
 */
export async function applySetup(cfg: import('../domain/parental').SetupConfig): Promise<void> {
  const empty = (await db().items.count()) === 0;
  await saveSettings({
    profile: 'kid',
    profileChosen: true,
    kidGrade: cfg.grade,
    challengeWords: cfg.words,
    minutesPerWord: cfg.minutesPerWord,
    parentLock: cfg.lock,
    ...(empty ? KID_DEFAULTS : {}),
  });
  if (empty) await autoLoadStarterOnFirstStart('kid');
}
