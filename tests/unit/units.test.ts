import { describe, expect, it } from 'vitest';
import { draftToItem, inheritUnits, normalizeUnit, parseImport, parsePage, planImport } from '../../src/domain/importer';
import { indexProgress } from '../../src/domain/planner';
import { buildPrompt, DEFAULT_KID_PROMPT_OPTIONS, DEFAULT_PROMPT_OPTIONS } from '../../src/domain/promptBuilder';
import { inScope, listUnits, pageBounds, planHomework, scopeFromQuery, scopeLabel, scopeQuery } from '../../src/domain/scope';
import { itemsToCsv } from '../../src/db/backup';

const BOOK = [
  { english: 'pencil', german: 'Bleistift', unit: 'Unit 1', page: 196 },
  { english: 'ruler', german: 'Lineal', page: 197 }, // no heading on this page → Unit 1
  { english: 'rubber', german: 'Radiergummi', page: '198' },
  { english: 'dog', german: 'Hund', unit: '2', page: 'S. 199' },
  { english: 'cat', german: 'Katze', page: 200 }, // → Unit 2
  { english: 'hello', german: 'hallo' }, // no page at all
];

describe('units and pages in the import', () => {
  it('normalises unit names and page numbers', () => {
    expect(normalizeUnit('3')).toBe('Unit 3');
    expect(normalizeUnit('unit 3')).toBe('Unit 3');
    expect(normalizeUnit('UNIT 4b')).toBe('Unit 4b');
    expect(normalizeUnit('Welcome')).toBe('Welcome');
    expect(parsePage(196)).toBe(196);
    expect(parsePage('S. 196')).toBe(196);
    expect(parsePage('page 197f.')).toBe(197);
    expect(parsePage('none')).toBeUndefined();
    expect(parsePage(-3)).toBeUndefined();
  });

  it('pages without a unit heading get the unit of the previous page', () => {
    const rows = parseImport(JSON.stringify(BOOK)).rows;
    expect(rows.map((r) => [r.draft!.english, r.draft!.unit, r.draft!.page])).toEqual([
      ['pencil', 'Unit 1', 196],
      ['ruler', 'Unit 1', 197],
      ['rubber', 'Unit 1', 198],
      ['dog', 'Unit 2', 199],
      ['cat', 'Unit 2', 200],
      ['hello', undefined, undefined],
    ]);
    expect(rows[1].warnings.join()).toMatch(/Unit 1 \(von Seite 196/);
  });

  it('does not inherit across different books', () => {
    const rows = inheritUnits(parseImport(JSON.stringify([
      { english: 'a', german: 'a', unit: 'Unit 1', page: 10, book: 'Book A' },
      { english: 'b', german: 'b', page: 11, book: 'Book B' },
    ])).rows);
    expect(rows[1].draft!.unit).toBeUndefined();
  });

  it('updates unit/page of existing words on re-import and exports them to CSV', () => {
    const items = parseImport(JSON.stringify([{ english: 'pencil', german: 'Bleistift' }])).rows.map((r, i) => draftToItem(r.draft!, `i${i}`, '2026-11-27T10:00:00Z'));
    const plan = planImport(parseImport(JSON.stringify([{ english: 'pencil', german: 'Bleistift', unit: 'Unit 1', page: 196 }])), items, []);
    expect(plan.rows[0].status).toBe('update');
    expect(plan.rows[0].changes).toEqual(expect.arrayContaining(['unit', 'page']));
    const csv = itemsToCsv([{ ...items[0], unit: 'Unit 1', page: 196, book: 'Green' }], []);
    expect(csv.split('\r\n')[0]).toMatch(/,unit,page,book$/);
    expect(csv).toContain(',Unit 1,196,Green');
    expect(parseImport(csv).rows[0].draft).toMatchObject({ unit: 'Unit 1', page: 196, book: 'Green' });
  });
});

describe('practise by unit / pages', () => {
  const items = parseImport(JSON.stringify(BOOK)).rows.map((r, i) => draftToItem(r.draft!, `w${i}`, '2026-11-27T10:00:00Z'));

  it('lists units in natural order with counts and page ranges', () => {
    expect(listUnits(items)).toEqual([
      { unit: 'Unit 1', count: 3, minPage: 196, maxPage: 198 },
      { unit: 'Unit 2', count: 2, minPage: 199, maxPage: 200 },
    ]);
    expect(pageBounds(items)).toEqual({ min: 196, max: 200 });
  });

  it('filters by unit or by page range', () => {
    const pick = (s: Parameters<typeof inScope>[1]) => items.filter((i) => inScope(i, s)).map((i) => i.english);
    expect(pick({ unit: 'Unit 1' })).toEqual(['pencil', 'ruler', 'rubber']);
    expect(pick({ pageFrom: 197, pageTo: 199 })).toEqual(['ruler', 'rubber', 'dog']);
    expect(pick({ pageFrom: 200 })).toEqual(['cat']);
    expect(pick({ unit: 'Unit 2', pageFrom: 200, pageTo: 200 })).toEqual(['cat']);
  });

  it('plans ALL words of the scope as homework (no new-per-day limit)', () => {
    const t = planHomework(items, indexProgress([]), { unit: 'Unit 1' }, 'writing');
    expect(t.map((x) => x.itemId).sort()).toEqual(['w0', 'w1', 'w2']);
    expect(t.every((x) => x.method === 'writing' && x.skill === 'writing' && x.direction === 'de-en')).toBe(true);
    expect(planHomework(items, indexProgress([]), { pageFrom: 196, pageTo: 200 }, 'flashcards').every((x) => x.skill === 'recall')).toBe(true);
  });

  it('round-trips the scope through the URL and labels it', () => {
    const q = scopeQuery({ unit: 'Unit 3', pageFrom: 196, pageTo: 198 });
    expect(scopeFromQuery(new URLSearchParams(q))).toEqual({ unit: 'Unit 3', pageFrom: 196, pageTo: 198 });
    expect(scopeLabel({ pageFrom: 196, pageTo: 198 })).toBe('S. 196–198');
    expect(scopeLabel({ unit: 'Unit 3' })).toBe('Unit 3');
  });
});

describe('prompt: unit and page detection', () => {
  it('adds the book rules when the photo word list option is chosen', () => {
    const kid = buildPrompt({ ...DEFAULT_KID_PROMPT_OPTIONS, kinds: ['booklist'] });
    expect(kid).toContain('A page WITHOUT a unit heading belongs to the last unit heading before it');
    expect(kid).toContain('"page": 196');
    const adult = buildPrompt({ ...DEFAULT_PROMPT_OPTIONS, kinds: ['booklist'] });
    expect(adult).toContain('Read the page number of every photo');
    expect(buildPrompt(DEFAULT_PROMPT_OPTIONS)).not.toContain('Read the page number');
  });
});
