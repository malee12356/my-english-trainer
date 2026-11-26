/**
 * Builds a study session (list of tasks) from due reviews, weaknesses, new
 * content and the available time budget. Pure function – easy to test.
 */
import { shuffle, tokenize } from './text';
import { isDue, retrievability } from './scheduler';
import type { Direction, Item, Method, Progress, Skill, Task } from './types';

export const METHOD_SKILL: Record<Method, Skill | null> = {
  flashcards: null, // depends on direction
  writing: 'writing',
  gapfill: 'writing',
  builder: 'recall',
  listening: 'listening',
  speaking: 'speaking',
  pronunciation: 'speaking',
  freespeaking: null,
};

/** Estimated seconds per task – used to fit the session into the time budget. */
export const SECONDS_PER_TASK: Record<Method, number> = {
  flashcards: 12,
  writing: 25,
  gapfill: 20,
  builder: 30,
  listening: 20,
  speaking: 25,
  pronunciation: 30,
  freespeaking: 120,
};
const NEW_ITEM_EXTRA_SEC = 10;

/** Methods available today (Phase 1/2). Speech-input methods are added once implemented. */
export const PLANNABLE_METHODS: Method[] = ['flashcards', 'writing', 'gapfill', 'builder', 'listening'];

export interface PlanOptions {
  topic: string; // 'all' | 'weakness' | category id
  method: Method | 'auto';
  minutes: number;
  now: Date;
  newPerDay: number;
  newIntroducedToday: number;
  flashcardDirection: Direction | 'random';
  ttsAvailable: boolean;
  rnd?: () => number;
}

export type ProgressIndex = Map<string, Partial<Record<Skill, Progress>>>;

export function indexProgress(progress: Progress[]): ProgressIndex {
  const idx: ProgressIndex = new Map();
  for (const p of progress) {
    const e = idx.get(p.itemId) ?? {};
    e[p.skill] = p;
    idx.set(p.itemId, e);
  }
  return idx;
}

/* --------------------------------------------------------------- weakness */

export interface WeaknessInfo {
  score: number;
  reasons: string[];
}

/**
 * Heuristic weakness score of an item, computed from its learning data:
 * lapses, error rate, slow answers, skips, last grade and imported mistakes.
 */
export function weakness(item: Item, prog: Partial<Record<Skill, Progress>> | undefined): WeaknessInfo {
  let score = 0;
  const reasons: string[] = [];
  if (item.type === 'correction' || item.common_mistake) {
    score += 1;
    reasons.push('known-mistake');
  }
  for (const p of Object.values(prog ?? {})) {
    if (!p) continue;
    if (p.lapses > 0) {
      score += p.lapses * 2;
      reasons.push(`lapses:${p.skill}`);
    }
    if (p.answered >= 2 && p.wrong / p.answered >= 0.34) {
      score += 3 * (p.wrong / p.answered);
      reasons.push(`errors:${p.skill}`);
    }
    if (p.answered > 0 && p.totalResponseMs / p.answered > 12_000) {
      score += 1;
      reasons.push(`slow:${p.skill}`);
    }
    if (p.skipped > 0) {
      score += Math.min(2, p.skipped * 0.5);
      reasons.push(`skipped:${p.skill}`);
    }
    if (p.lastGrade === 1) score += 2;
    else if (p.lastGrade === 2) score += 1;
  }
  return { score: Math.round(score * 10) / 10, reasons: Array.from(new Set(reasons)) };
}

export const WEAK_THRESHOLD = 2;

/* -------------------------------------------------------------- eligibility */

export interface GapSource {
  sentence: string;
  before: string;
  answer: string;
  after: string;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function blank(sentence: string, needle: string): GapSource | null {
  const re = new RegExp(`(^|[^A-Za-z'])(${escapeRe(needle)})(?![A-Za-z'])`, 'i');
  const m = re.exec(sentence);
  if (!m) return null;
  const start = m.index + m[1].length;
  const end = start + m[2].length;
  return { sentence, before: sentence.slice(0, start), answer: sentence.slice(start, end), after: sentence.slice(end) };
}

/**
 * Gap fill source: an example sentence with the term (or, for separable phrases
 * like "take this into account", the term's most distinctive word) blanked.
 * Sentence items blank their longest word. Returns null if nothing sensible.
 */
export function gapSource(item: Item): GapSource | null {
  const term = item.english.replace(/^to\s+/i, '').replace(/[.!?…]+$/, '').trim();
  const termWords = term.split(/\s+/).map((w) => w.replace(/[^A-Za-z'-]/g, '')).filter((w) => w.length >= 3);
  const key = termWords.slice().sort((a, b) => b.length - a.length)[0];
  const candidates = [item.example_en, ...item.examples.map((e) => e.en)].filter(Boolean) as string[];
  for (const s of candidates) {
    if (tokenize(s).length <= tokenize(term).length) continue;
    const whole = blank(s, term);
    if (whole) return whole;
  }
  if (key) {
    for (const s of candidates) {
      const part = blank(s, key);
      if (part && tokenize(s).length > 2) return part;
    }
  }
  if (item.type === 'sentence' || /[.!?]$/.test(item.english.trim())) {
    const words = item.english.split(/\s+/).map((w) => w.replace(/[^A-Za-z'-]/g, '')).filter((w) => w.length >= 4);
    const longest = words.sort((a, b) => b.length - a.length)[0];
    if (longest) return blank(item.english, longest);
  }
  return null;
}

/** Sentence used for the sentence builder (needs at least 3 words). */
export function builderSource(item: Item): { sentence: string; german?: string } | null {
  if (tokenize(item.english).length >= 3 && tokenize(item.english).length <= 18) {
    return { sentence: item.english, german: item.german };
  }
  if (item.example_en && tokenize(item.example_en).length >= 3 && tokenize(item.example_en).length <= 18) {
    return { sentence: item.example_en, german: item.example_de };
  }
  return null;
}

export function eligible(item: Item, method: Method, ttsAvailable: boolean): boolean {
  switch (method) {
    case 'gapfill':
      return gapSource(item) !== null;
    case 'builder':
      return builderSource(item) !== null;
    case 'listening':
      return ttsAvailable;
    case 'flashcards':
    case 'writing':
      return true;
    default:
      return false;
  }
}

/* ----------------------------------------------------------------- planning */

function taskFor(item: Item, method: Method, direction: Direction, practice: boolean, isNew: boolean): Task {
  const skill = method === 'flashcards' ? (direction === 'en-de' ? 'comprehension' : 'recall') : (METHOD_SKILL[method] as Skill);
  return { itemId: item.id, method, skill, direction, practice, isNew };
}

function methodForSkill(skill: Skill, item: Item, ttsAvailable: boolean, rnd: () => number): { method: Method; direction: Direction } {
  switch (skill) {
    case 'comprehension':
      return { method: 'flashcards', direction: 'en-de' };
    case 'recall':
      return builderSource(item) && rnd() < 0.3 ? { method: 'builder', direction: 'de-en' } : { method: 'flashcards', direction: 'de-en' };
    case 'writing':
      return gapSource(item) && rnd() < 0.4 ? { method: 'gapfill', direction: 'de-en' } : { method: 'writing', direction: 'de-en' };
    case 'listening':
      return ttsAvailable ? { method: 'listening', direction: 'en-de' } : { method: 'flashcards', direction: 'en-de' };
    default:
      return { method: 'flashcards', direction: 'de-en' };
  }
}

/** Skill progression for an item in automatic mode: understand → recall → write/listen. */
function nextSkillToUnlock(prog: Partial<Record<Skill, Progress>> | undefined, ttsAvailable: boolean): Skill | null {
  const has = (s: Skill) => !!prog?.[s];
  const seen = (s: Skill) => (prog?.[s]?.reps ?? 0) > 0;
  if (!has('comprehension')) return 'comprehension';
  if (seen('comprehension') && !has('recall')) return 'recall';
  if (seen('recall') && !has('writing')) return 'writing';
  if (ttsAvailable && seen('recall') && !has('listening')) return 'listening';
  return null;
}

export function itemMatchesTopic(item: Item, topic: string): boolean {
  if (item.archived) return false;
  if (topic === 'all' || topic === 'weakness') return true;
  return item.categories.includes(topic);
}

export function planSession(items: Item[], progress: ProgressIndex, o: PlanOptions): Task[] {
  const rnd = o.rnd ?? Math.random;
  const budget = Math.max(1, o.minutes) * 60;
  let used = 0;
  const tasks: Task[] = [];
  const usedItems = new Set<string>();
  const cost = (m: Method, isNew: boolean) => SECONDS_PER_TASK[m] + (isNew ? NEW_ITEM_EXTRA_SEC : 0);
  const push = (t: Task): boolean => {
    const c = cost(t.method, t.isNew);
    if (used + c > budget && tasks.length > 0) return false;
    tasks.push(t);
    usedItems.add(t.itemId);
    used += c;
    return true;
  };

  let pool = items.filter((i) => itemMatchesTopic(i, o.topic));
  if (o.topic === 'weakness') {
    pool = pool
      .map((i) => ({ i, w: weakness(i, progress.get(i.id)).score }))
      .filter((x) => x.w > 0)
      .sort((a, b) => b.w - a.w)
      .map((x) => x.i);
  }
  const auto = o.method === 'auto';
  const pickDirection = (): Direction =>
    o.flashcardDirection === 'random' ? (rnd() < 0.5 ? 'en-de' : 'de-en') : o.flashcardDirection;

  // Fixed-method mode: decide the skill once per item.
  const fixed = (item: Item): { method: Method; direction: Direction; skill: Skill } | null => {
    if (auto) return null;
    const m = o.method as Method;
    if (!eligible(item, m, o.ttsAvailable)) return null;
    const direction = m === 'flashcards' ? pickDirection() : m === 'listening' ? 'en-de' : 'de-en';
    const t = taskFor(item, m, direction, false, false);
    return { method: m, direction, skill: t.skill };
  };

  // 1) Due reviews – most overdue first.
  const due: { item: Item; p: Progress }[] = [];
  for (const item of pool) {
    const prog = progress.get(item.id);
    if (!prog) continue;
    if (auto) {
      const skills = (Object.values(prog).filter(Boolean) as Progress[]).filter(
        (p) => p.reps > 0 && p.skill !== 'speaking' && (p.skill !== 'listening' || o.ttsAvailable) && isDue(p, o.now),
      );
      skills.sort((a, b) => +new Date(a.due) - +new Date(b.due));
      if (skills[0]) due.push({ item, p: skills[0] });
    } else {
      const f = fixed(item);
      const p = f && prog[f.skill];
      if (p && p.reps > 0 && isDue(p, o.now)) due.push({ item, p });
    }
  }
  due.sort((a, b) => +new Date(a.p.due) - +new Date(b.p.due));
  const reviewTasks: Task[] = [];
  for (const { item, p } of due) {
    if (auto) {
      const m = methodForSkill(p.skill, item, o.ttsAvailable, rnd);
      reviewTasks.push({ ...taskFor(item, m.method, m.direction, false, false), skill: p.skill });
    } else {
      const f = fixed(item)!;
      reviewTasks.push(taskFor(item, f.method, f.direction, false, false));
    }
  }

  // 2) New content (brand-new items limited by newPerDay) and skill unlocks.
  let newLeft = Math.max(0, o.newPerDay - o.newIntroducedToday);
  const unlockTasks: Task[] = [];
  const newTasks: Task[] = [];
  const newPool = pool
    .filter((i) => !usedItems.has(i.id) && !due.some((d) => d.item.id === i.id))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.created_at.localeCompare(b.created_at));
  for (const item of newPool) {
    const prog = progress.get(item.id);
    const brandNew = !prog || Object.keys(prog).length === 0;
    if (auto) {
      const s = nextSkillToUnlock(prog, o.ttsAvailable);
      if (!s) continue;
      if (brandNew) {
        if (newLeft <= 0) continue;
        newLeft--;
        newTasks.push(taskFor(item, 'flashcards', 'en-de', false, true));
      } else {
        const m = methodForSkill(s, item, o.ttsAvailable, rnd);
        unlockTasks.push({ ...taskFor(item, m.method, m.direction, false, true), skill: s });
      }
    } else {
      const f = fixed(item);
      if (!f || prog?.[f.skill]) continue;
      if (brandNew) {
        if (newLeft <= 0) continue;
        newLeft--;
      }
      newTasks.push({ ...taskFor(item, f.method, f.direction, false, true), skill: f.skill });
    }
  }

  // Interleave: reviews first, with new material mixed in so the session stays
  // varied; new items take at most ~1/3 of the budget while reviews are pending.
  const unlockCap = Math.max(2, Math.floor(budget / 60));
  const nt = newTasks.slice();
  const ut = unlockTasks.slice(0, unlockCap);
  const newBudget = budget / 3;
  let newUsed = 0;
  const mixed: Task[] = [];
  reviewTasks.forEach((t, i) => {
    mixed.push(t);
    if (i % 3 === 2 && nt.length && newUsed < newBudget) {
      const n = nt.shift()!;
      newUsed += cost(n.method, true);
      mixed.push(n);
    }
    if (i % 4 === 3 && ut.length) mixed.push(ut.shift()!);
  });
  mixed.push(...ut, ...nt);
  for (const t of mixed) {
    if (usedItems.has(t.itemId)) continue;
    if (!push(t)) break;
  }

  // 3) Weak items & lowest-retrievability items as practice (no interval inflation).
  if (used < budget) {
    const practice = pool
      .filter((i) => !usedItems.has(i.id) && progress.get(i.id))
      .map((i) => {
        const prog = progress.get(i.id)!;
        const ps = Object.values(prog).filter((p): p is Progress => !!p && p.reps > 0);
        const r = ps.length ? Math.min(...ps.map((p) => retrievability(p, o.now))) : 1;
        return { i, w: weakness(i, prog).score, r };
      })
      .filter((x) => x.r < 1)
      .sort((a, b) => b.w - a.w || a.r - b.r);
    for (const { i } of practice) {
      const f = auto ? null : fixed(i);
      if (!auto && !f) continue;
      const t = auto ? taskFor(i, 'flashcards', 'de-en', true, false) : { ...taskFor(i, f!.method, f!.direction, true, false), skill: f!.skill };
      if (!push(t)) break;
    }
  }
  return o.topic === 'weakness' ? tasks : lightShuffle(tasks, rnd);
}

/** Shuffle within small windows so due order is mostly preserved. */
function lightShuffle<T>(arr: T[], rnd: () => number): T[] {
  const out: T[] = [];
  for (let i = 0; i < arr.length; i += 5) out.push(...shuffle(arr.slice(i, i + 5), rnd));
  return out;
}

/* ------------------------------------------------------------ summaries */

export interface ItemStatus {
  status: 'new' | 'learning' | 'mastered' | 'difficult';
  dueSkills: Skill[];
}

export const MASTERED_STABILITY_DAYS = 21;

/**
 * Item status used for dashboard and filters (documented in DATA_SCHEMA.md):
 * - new: no progress yet
 * - difficult: weakness score ≥ WEAK_THRESHOLD
 * - mastered: comprehension AND recall in review state with stability ≥ 21 days
 * - learning: everything else
 */
export function itemStatus(item: Item, prog: Partial<Record<Skill, Progress>> | undefined, now: Date): ItemStatus {
  const ps = Object.values(prog ?? {}).filter((p): p is Progress => !!p);
  const dueSkills = ps.filter((p) => p.reps > 0 && isDue(p, now)).map((p) => p.skill);
  if (ps.length === 0 || ps.every((p) => p.reps === 0)) return { status: 'new', dueSkills };
  if (weakness(item, prog).score >= WEAK_THRESHOLD) return { status: 'difficult', dueSkills };
  const ok = (s: Skill) => prog?.[s] && prog[s]!.state === 2 && prog[s]!.stability >= MASTERED_STABILITY_DAYS;
  if (ok('comprehension') && ok('recall')) return { status: 'mastered', dueSkills };
  return { status: 'learning', dueSkills };
}
