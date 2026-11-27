/** Practise a part of the school book: one unit or a page range ("homework"). */
import { shuffle } from './text';
import type { ProgressIndex } from './planner';
import type { Direction, Item, Method, Task } from './types';

export interface Scope {
  unit?: string;
  pageFrom?: number;
  pageTo?: number;
}

export function inScope(item: Item, s: Scope): boolean {
  if (item.archived) return false;
  if (s.unit && item.unit !== s.unit) return false;
  if (s.pageFrom !== undefined || s.pageTo !== undefined) {
    if (item.page === undefined) return false;
    if (s.pageFrom !== undefined && item.page < s.pageFrom) return false;
    if (s.pageTo !== undefined && item.page > s.pageTo) return false;
  }
  return true;
}

export function hasScope(s: Scope): boolean {
  return !!s.unit || s.pageFrom !== undefined || s.pageTo !== undefined;
}

/** Units in natural order ("Unit 2" before "Unit 10"), with word count and page range. */
export function listUnits(items: Item[]): { unit: string; count: number; minPage?: number; maxPage?: number }[] {
  const map = new Map<string, { unit: string; count: number; minPage?: number; maxPage?: number }>();
  for (const it of items) {
    if (it.archived || !it.unit) continue;
    const e = map.get(it.unit) ?? { unit: it.unit, count: 0 };
    e.count++;
    if (it.page !== undefined) {
      e.minPage = Math.min(e.minPage ?? it.page, it.page);
      e.maxPage = Math.max(e.maxPage ?? it.page, it.page);
    }
    map.set(it.unit, e);
  }
  return [...map.values()].sort((a, b) => a.unit.localeCompare(b.unit, 'de', { numeric: true }));
}

export function pageBounds(items: Item[]): { min: number; max: number } | null {
  const pages = items.filter((i) => !i.archived && i.page !== undefined).map((i) => i.page!);
  return pages.length ? { min: Math.min(...pages), max: Math.max(...pages) } : null;
}

export function scopeFromQuery(q: URLSearchParams): Scope {
  const num = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : undefined);
  return { unit: q.get('unit') ?? undefined, pageFrom: num(q.get('from')), pageTo: num(q.get('to')) };
}

export function scopeQuery(s: Scope): string {
  const p = new URLSearchParams();
  if (s.unit) p.set('unit', s.unit);
  if (s.pageFrom !== undefined) p.set('from', String(s.pageFrom));
  if (s.pageTo !== undefined) p.set('to', String(s.pageTo));
  return p.toString();
}

export function scopeLabel(s: Scope, lang: 'de' | 'en' = 'de'): string {
  const parts: string[] = [];
  if (s.unit) parts.push(s.unit);
  if (s.pageFrom !== undefined && s.pageTo !== undefined) parts.push(s.pageFrom === s.pageTo ? `${lang === 'de' ? 'S.' : 'p.'} ${s.pageFrom}` : `${lang === 'de' ? 'S.' : 'pp.'} ${s.pageFrom}–${s.pageTo}`);
  else if (s.pageFrom !== undefined) parts.push(`${lang === 'de' ? 'ab S.' : 'from p.'} ${s.pageFrom}`);
  else if (s.pageTo !== undefined) parts.push(`${lang === 'de' ? 'bis S.' : 'to p.'} ${s.pageTo}`);
  return parts.join(' · ');
}

/**
 * Homework: ALL words of the scope (no "new words per day" limit), mixed order.
 * Flashcards ask German → English (active recall), writing asks the same in written form.
 */
export function planHomework(items: Item[], progress: ProgressIndex, s: Scope, method: Extract<Method, 'flashcards' | 'writing'>, rnd: () => number = Math.random): Task[] {
  const direction: Direction = 'de-en';
  return shuffle(items.filter((i) => inScope(i, s)), rnd).map((item) => ({
    itemId: item.id,
    method,
    skill: method === 'writing' ? 'writing' : 'recall',
    direction,
    practice: false,
    isNew: !progress.get(item.id),
  }));
}
