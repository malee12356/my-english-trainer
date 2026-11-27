/**
 * Import pipeline: parse (JSON/CSV) → validate → plan against existing data →
 * user confirms → apply (see db/repo.ts). Imported content is treated strictly
 * as data: only whitelisted fields are read, all strings are cleaned and length
 * limited, and nothing is ever rendered as HTML.
 */
import { parseCsvObjects } from './csv';
import { parseLooseJson } from './looseJson';
import { cleanText, itemKey, normalize } from './text';
import { resolveCategoryId } from './topics';
import { CEFR_LEVELS, ITEM_TYPES, type CefrLevel, type ExamplePair, type Item, type ItemType } from './types';

export const MAX_IMPORT_ROWS = 5000;
export const IMPORT_SCHEMA_ID = 'personal-english-trainer/import';
export const IMPORT_SCHEMA_VERSION = 1;

export interface CategoryRef {
  id: string;
  name: string;
  builtin: boolean;
}

export interface ItemDraft {
  externalId?: string;
  english: string;
  german: string;
  alternatives_en: string[];
  alternatives_de: string[];
  example_en?: string;
  example_de?: string;
  examples: ExamplePair[];
  ipa?: string;
  type: ItemType;
  typeInferred: boolean;
  level?: CefrLevel;
  categories: CategoryRef[];
  tags: string[];
  notes?: string;
  common_mistake?: string;
  explanation?: string;
  source?: string;
  unit?: string;
  page?: number;
  book?: string;
  created_at?: string;
}

export interface ParsedRow {
  /** 1-based position in the file (data rows; CSV header not counted). */
  index: number;
  draft?: ItemDraft;
  errors: string[];
  warnings: string[];
}

export type RowStatus = 'new' | 'update' | 'unchanged' | 'duplicate' | 'invalid';
export type RowAction = 'add' | 'update' | 'skip';

export interface PlannedRow extends ParsedRow {
  status: RowStatus;
  action: RowAction;
  existingId?: string;
  changes: string[];
}

export interface ImportPlan {
  format: 'json' | 'csv';
  rows: PlannedRow[];
  newCategories: CategoryRef[];
  counts: Record<RowStatus, number>;
  fatal?: string;
  /** Automatic repairs applied to pasted text (e.g. Markdown escapes). */
  repairs?: string[];
}

/* ------------------------------------------------------------------ parsing */

export function detectFormat(text: string): 'json' | 'csv' {
  const t = unescapeMarkdown(stripFences(text)).trimStart();
  if (t.startsWith('[') || t.startsWith('{')) return 'json';
  // JSON embedded in text ("Here is your file: [ ... ]")
  if (/"english"\s*:/.test(t) && /[[{]/.test(t)) return 'json';
  return 'csv';
}

/** ChatGPT often wraps JSON in ```json fences – remove them. */
export function stripFences(text: string): string {
  const m = text.match(/```(?:json|csv)?\s*\n([\s\S]*?)```/i);
  return (m ? m[1] : text).replace(/^\uFEFF/, '').trim();
}

/**
 * Copying a normal ChatGPT answer (instead of the code block) produces
 * Markdown escapes such as "\[ … \]" or "example\_en". JSON never contains
 * a backslash before these characters, so they can be removed safely.
 */
export function unescapeMarkdown(text: string): string {
  return text.replace(/(^|[^\\])\\([[\]_*#`~>|-])/g, '$1$2').replace(/(^|[^\\])\\([[\]_*#`~>|-])/g, '$1$2');
}

/** Cut the JSON part out of surrounding text. */
function extractJson(text: string): string {
  const start = text.search(/[[{]/);
  if (start < 0) return text;
  const open = text[start];
  const close = open === '[' ? ']' : '}';
  const end = text.lastIndexOf(close);
  return end > start ? text.slice(start, end + 1) : text.slice(start);
}

/**
 * Parse JSON leniently: strict first, then step-by-step repairs of typical
 * copy & paste damage. Returns which repairs were needed (shown as a hint).
 */
export function parseJsonLenient(text: string): { data?: unknown; repairs: string[]; error?: string } {
  const attempts: { repairs: string[]; text: () => string }[] = [
    { repairs: [], text: () => text },
    { repairs: ['markdown'], text: () => extractJson(unescapeMarkdown(text)) },
    { repairs: ['markdown', 'quotes'], text: () => extractJson(unescapeMarkdown(text)).replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"') },
    {
      repairs: ['markdown', 'quotes', 'commas'],
      text: () => extractJson(unescapeMarkdown(text)).replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"').replace(/,\s*([\]}])/g, '$1'),
    },
  ];
  for (const a of attempts) {
    try {
      return { data: JSON.parse(a.text()), repairs: a.repairs };
    } catch {
      /* try the next repair step */
    }
  }
  // Last resort: tolerant reader (typographic quotes, lost list brackets, …)
  try {
    return { data: parseLooseJson(extractJson(unescapeMarkdown(text))), repairs: ['markdown', 'quotes', 'structure'] };
  } catch (e) {
    return { repairs: [], error: (e as Error).message };
  }
}

export function parseImport(text: string, format: 'json' | 'csv' | 'auto' = 'auto'): { format: 'json' | 'csv'; rows: ParsedRow[]; fatal?: string; repairs?: string[] } {
  const body = stripFences(text);
  const fmt = format === 'auto' ? detectFormat(body) : format;
  if (!body) return { format: fmt, rows: [], fatal: 'empty' };
  let raw: unknown[];
  let repairs: string[] = [];
  if (fmt === 'json') {
    const parsed = parseJsonLenient(body);
    if (parsed.error !== undefined) return { format: fmt, rows: [], fatal: `json:${parsed.error}` };
    const data = parsed.data;
    repairs = parsed.repairs;
    if (Array.isArray(data)) raw = data;
    else if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)) raw = (data as { items: unknown[] }).items;
    else if (data && typeof data === 'object') raw = [data];
    else return { format: fmt, rows: [], fatal: 'json:not-an-array' };
  } else {
    raw = parseCsvObjects(body);
  }
  if (raw.length > MAX_IMPORT_ROWS) return { format: fmt, rows: [], fatal: `too-many:${raw.length}` };
  return { format: fmt, rows: inheritUnits(raw.map((r, i) => validateRow(r, i + 1))), repairs };
}

const STR_MAX = 1000;
const LONG_MAX = 4000;

function pick(o: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k];
  return undefined;
}

/** Remove a protective apostrophe that our own CSV export adds before = + - @. */
function unprotect(s: string): string {
  return /^'[=+\-@]/.test(s) ? s.slice(1) : s;
}

function str(v: unknown, max = STR_MAX, warnings?: string[], field?: string): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v === 'number' || typeof v === 'boolean') v = String(v);
  if (typeof v !== 'string') {
    warnings?.push(`${field}: ignored (not text)`);
    return undefined;
  }
  const raw = unprotect(v);
  if (raw.length > max) warnings?.push(`${field}: truncated to ${max} characters`);
  const c = cleanText(raw, max);
  return c || undefined;
}

function list(v: unknown, sep: RegExp = /\s*[|;]\s*/): string[] {
  if (v === undefined) return [];
  const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(sep) : [];
  const out = arr.map((x) => (typeof x === 'string' || typeof x === 'number' ? cleanText(unprotect(String(x)), 300) : '')).filter(Boolean);
  return Array.from(new Set(out)).slice(0, 30);
}

export function inferType(english: string): ItemType {
  const words = english.trim().split(/\s+/).length;
  if (/[.!?]$/.test(english.trim()) || words >= 7) return 'sentence';
  if (words === 1 || (words === 2 && /^to\s/i.test(english))) return 'word';
  return 'phrase';
}

function validDate(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function validateRow(input: unknown, index: number): ParsedRow {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { index, errors: ['not-an-object'], warnings };
  }
  // Lower-case keys, so "English" / "German" from spreadsheets also work.
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    o[k.trim().toLowerCase().replace(/[\s-]+/g, '_')] = v;
  }

  const english = str(pick(o, 'english', 'en', 'term', 'front'), STR_MAX, warnings, 'english');
  const german = str(pick(o, 'german', 'de', 'deutsch', 'translation', 'back'), STR_MAX, warnings, 'german');
  if (!english) errors.push('missing:english');
  if (!german) errors.push('missing:german');

  const levelRaw = str(pick(o, 'level', 'cefr'));
  let level: CefrLevel | undefined;
  if (levelRaw) {
    const m = levelRaw.toUpperCase().match(/[ABC][12]/);
    if (m && (CEFR_LEVELS as string[]).includes(m[0])) level = m[0] as CefrLevel;
    else warnings.push(`level: "${levelRaw}" unknown – ignored`);
  }

  const typeRaw = str(pick(o, 'type'))?.toLowerCase();
  let type: ItemType | undefined;
  if (typeRaw) {
    if ((ITEM_TYPES as string[]).includes(typeRaw)) type = typeRaw as ItemType;
    else warnings.push(`type: "${typeRaw}" unknown – inferred`);
  }

  const catNames = [...list(pick(o, 'category')), ...list(pick(o, 'categories', 'topics', 'topic'))];
  const categories: CategoryRef[] = [];
  for (const n of catNames) {
    const c = resolveCategoryId(n);
    if (c && !categories.some((x) => x.id === c.id)) categories.push(c);
  }

  const examples: ExamplePair[] = [];
  const exRaw = pick(o, 'examples');
  if (Array.isArray(exRaw)) {
    for (const ex of exRaw.slice(0, 10)) {
      if (typeof ex === 'string') {
        const en = cleanText(ex, STR_MAX);
        if (en) examples.push({ en });
      } else if (ex && typeof ex === 'object') {
        const e = ex as Record<string, unknown>;
        const en = str(pick(e, 'en', 'english', 'example_en'));
        const de = str(pick(e, 'de', 'german', 'example_de'));
        if (en) examples.push(de ? { en, de } : { en });
      }
    }
  } else if (exRaw !== undefined) warnings.push('examples: ignored (expected a list)');

  if (errors.length) return { index, errors, warnings };

  const draft: ItemDraft = {
    externalId: str(pick(o, 'id', 'external_id', 'uid'), 120),
    english: english!,
    german: german!,
    alternatives_en: list(pick(o, 'alternatives_en')).concat(list(pick(o, 'alternatives'))).filter((a, i, arr) => arr.indexOf(a) === i),
    alternatives_de: list(pick(o, 'alternatives_de')),
    example_en: str(pick(o, 'example_en', 'example'), STR_MAX, warnings, 'example_en'),
    example_de: str(pick(o, 'example_de'), STR_MAX, warnings, 'example_de'),
    examples,
    ipa: str(pick(o, 'ipa'), 200, warnings, 'ipa'),
    type: type ?? inferType(english!),
    typeInferred: !type,
    level,
    categories,
    tags: list(pick(o, 'tags'), /\s*[|;,]\s*/),
    notes: str(pick(o, 'notes', 'note'), LONG_MAX, warnings, 'notes'),
    common_mistake: str(pick(o, 'common_mistake', 'mistake'), STR_MAX, warnings, 'common_mistake'),
    explanation: str(pick(o, 'explanation'), LONG_MAX, warnings, 'explanation'),
    source: str(pick(o, 'source'), 200, warnings, 'source'),
    unit: normalizeUnit(str(pick(o, 'unit', 'lesson', 'lektion', 'kapitel', 'chapter'), 60)),
    page: parsePage(pick(o, 'page', 'seite', 'p')),
    book: str(pick(o, 'book', 'buch', 'schoolbook'), 80),
    created_at: validDate(pick(o, 'created_at')),
  };
  // alternatives identical to the main answer are pointless
  draft.alternatives_en = draft.alternatives_en.filter((a) => normalize(a) !== normalize(draft.english));
  draft.alternatives_de = draft.alternatives_de.filter((a) => normalize(a) !== normalize(draft.german));
  return { index, draft, errors, warnings };
}

/* ------------------------------------------------------------ units & pages */

/** "3" → "Unit 3", "unit 3" → "Unit 3"; other names (e.g. "Welcome", "Lektion 2") stay. */
export function normalizeUnit(u: string | undefined): string | undefined {
  if (!u) return undefined;
  const t = u.trim().replace(/\s+/g, ' ');
  if (/^\d{1,3}[a-z]?$/i.test(t)) return `Unit ${t}`;
  const m = t.match(/^unit\s*(\S+)$/i);
  return m ? `Unit ${m[1]}` : t;
}

/** 196, "196", "S. 196", "p. 196", "page 196f." → 196 */
export function parsePage(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isInteger(v) && v > 0 && v < 10000) return v;
  if (typeof v !== 'string') return undefined;
  const m = v.match(/\d{1,4}/);
  return m ? Number(m[0]) : undefined;
}

/**
 * Pages without a unit heading belong to the last unit before them: rows with a
 * page but no unit get the unit of the closest lower page (same book) in this file.
 */
export function inheritUnits(rows: ParsedRow[]): ParsedRow[] {
  const known = rows
    .map((r) => r.draft)
    .filter((d): d is ItemDraft => !!d && !!d.unit && d.page !== undefined)
    .sort((a, b) => a.page! - b.page!);
  if (!known.length) return rows;
  return rows.map((r) => {
    const d = r.draft;
    if (!d || d.unit || d.page === undefined) return r;
    const prev = known.filter((k) => k.page! <= d.page! && (k.book ?? '') === (d.book ?? '')).pop();
    if (!prev) return r;
    return { ...r, draft: { ...d, unit: prev.unit }, warnings: [...r.warnings, `unit: ${prev.unit} (von Seite ${prev.page} übernommen)`] };
  });
}

/* ----------------------------------------------------------------- planning */

const SCALAR_FIELDS = ['german', 'example_en', 'example_de', 'ipa', 'level', 'notes', 'common_mistake', 'explanation', 'source', 'unit', 'page', 'book'] as const;

/** Which fields of `existing` would change if `draft` were merged in. */
export function diffDraft(existing: Item, draft: ItemDraft): string[] {
  const changes: string[] = [];
  if (existing.english !== draft.english) changes.push('english');
  for (const f of SCALAR_FIELDS) {
    const v = draft[f];
    if (v !== undefined && v !== existing[f]) changes.push(f);
  }
  if (!draft.typeInferred && draft.type !== existing.type) changes.push('type');
  const addsTo = (a: string[], b: string[]) => b.some((x) => !a.map(normalize).includes(normalize(x)));
  if (addsTo(existing.alternatives_en, draft.alternatives_en)) changes.push('alternatives_en');
  if (addsTo(existing.alternatives_de, draft.alternatives_de)) changes.push('alternatives_de');
  if (addsTo(existing.tags, draft.tags)) changes.push('tags');
  if (draft.categories.some((c) => !existing.categories.includes(c.id))) changes.push('categories');
  if (draft.examples.some((e) => !existing.examples.some((x) => normalize(x.en) === normalize(e.en)))) changes.push('examples');
  return changes;
}

export function planImport(parsed: { format: 'json' | 'csv'; rows: ParsedRow[]; fatal?: string; repairs?: string[] }, existing: Item[], existingCategoryIds: string[]): ImportPlan {
  const byExt = new Map<string, Item>();
  const byKey = new Map<string, Item>();
  for (const it of existing) {
    if (it.externalId) byExt.set(it.externalId, it);
    if (!byKey.has(it.key)) byKey.set(it.key, it);
  }
  const seenInFile = new Set<string>();
  const newCats = new Map<string, CategoryRef>();
  const rows: PlannedRow[] = parsed.rows.map((r) => {
    if (!r.draft) return { ...r, status: 'invalid', action: 'skip', changes: [] };
    const d = r.draft;
    const key = itemKey(d.english);
    const fileKey = d.externalId ? `id:${d.externalId}` : `k:${key}`;
    if (seenInFile.has(fileKey) || seenInFile.has(`k:${key}`)) {
      return { ...r, status: 'duplicate', action: 'skip', changes: [], warnings: [...r.warnings, 'duplicate-in-file'] };
    }
    seenInFile.add(fileKey);
    seenInFile.add(`k:${key}`);
    for (const c of d.categories) if (!c.builtin && !existingCategoryIds.includes(c.id) && !newCats.has(c.id)) newCats.set(c.id, c);
    const match = (d.externalId && byExt.get(d.externalId)) || byKey.get(key);
    if (!match) return { ...r, status: 'new', action: 'add', changes: [] };
    const changes = diffDraft(match, d);
    return changes.length
      ? { ...r, status: 'update', action: 'update', existingId: match.id, changes }
      : { ...r, status: 'unchanged', action: 'skip', existingId: match.id, changes };
  });
  const counts: Record<RowStatus, number> = { new: 0, update: 0, unchanged: 0, duplicate: 0, invalid: 0 };
  rows.forEach((r) => counts[r.status]++);
  return { format: parsed.format, rows, newCategories: [...newCats.values()], counts, fatal: parsed.fatal, repairs: parsed.repairs };
}

/* ------------------------------------------------------------------ merging */

export function draftToItem(d: ItemDraft, id: string, now: string, origin: Item['origin'] = 'import'): Item {
  return {
    id,
    schemaVersion: 1,
    externalId: d.externalId,
    english: d.english,
    german: d.german,
    alternatives_en: d.alternatives_en,
    alternatives_de: d.alternatives_de,
    example_en: d.example_en,
    example_de: d.example_de,
    examples: d.examples,
    ipa: d.ipa,
    type: d.type,
    level: d.level,
    categories: d.categories.map((c) => c.id),
    tags: d.tags,
    notes: d.notes,
    common_mistake: d.common_mistake,
    explanation: d.explanation,
    source: d.source,
    unit: d.unit,
    page: d.page,
    book: d.book,
    favorite: false,
    archived: false,
    collections: [],
    origin,
    key: itemKey(d.english),
    created_at: d.created_at ?? now,
    updated_at: now,
  };
}

const unionText = (a: string[], b: string[]) => {
  const out = a.slice();
  for (const x of b) if (!out.some((y) => normalize(y) === normalize(x))) out.push(x);
  return out;
};

/** Merge imported content into an existing item. Never touches learning progress. */
export function mergeDraft(existing: Item, d: ItemDraft, now: string): Item {
  const merged: Item = { ...existing };
  merged.english = d.english;
  merged.key = itemKey(d.english);
  for (const f of SCALAR_FIELDS) {
    const v = d[f];
    if (v !== undefined) (merged as unknown as Record<string, unknown>)[f] = v;
  }
  if (!d.typeInferred) merged.type = d.type;
  if (d.externalId) merged.externalId = d.externalId;
  merged.alternatives_en = unionText(existing.alternatives_en, d.alternatives_en);
  merged.alternatives_de = unionText(existing.alternatives_de, d.alternatives_de);
  merged.tags = unionText(existing.tags, d.tags);
  merged.categories = Array.from(new Set([...existing.categories, ...d.categories.map((c) => c.id)]));
  const ex = existing.examples.slice();
  for (const e of d.examples) if (!ex.some((x) => normalize(x.en) === normalize(e.en))) ex.push(e);
  merged.examples = ex;
  merged.updated_at = now;
  return merged;
}
