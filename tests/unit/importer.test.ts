import { describe, expect, it } from 'vitest';
import { parseCsv, parseCsvObjects, toCsv } from '../../src/domain/csv';
import { draftToItem, inferType, mergeDraft, parseImport, planImport, stripFences } from '../../src/domain/importer';
import type { Item } from '../../src/domain/types';

const SPEC_EXAMPLE = `[
  {
    "english": "to take into account",
    "german": "berücksichtigen",
    "example_en": "We need to take this into account.",
    "example_de": "Wir müssen das berücksichtigen.",
    "alternatives": ["to consider"],
    "ipa": "/tə teɪk ˈɪntuː əˈkaʊnt/",
    "category": "Meeting Mode",
    "level": "B2"
  }
]`;

const NOW = '2026-11-26T10:00:00.000Z';

describe('JSON import', () => {
  it('accepts the documented minimal structure (backwards compatible field names)', () => {
    const r = parseImport(SPEC_EXAMPLE);
    expect(r.format).toBe('json');
    expect(r.rows).toHaveLength(1);
    const d = r.rows[0].draft!;
    expect(d.english).toBe('to take into account');
    expect(d.alternatives_en).toEqual(['to consider']);
    expect(d.alternatives_de).toEqual([]);
    expect(d.categories).toEqual([{ id: 'meeting', name: 'Meeting Mode', builtin: true }]);
    expect(d.level).toBe('B2');
    expect(d.ipa).toContain('ˈɪntuː');
  });

  it('accepts code fences, wrapper objects and extended fields', () => {
    const text = '```json\n' + JSON.stringify({
      schema: 'personal-english-trainer/import', version: 1,
      items: [{
        id: 'gpt-1', english: 'make a decision', german: 'eine Entscheidung treffen', type: 'correction',
        common_mistake: 'do a decision', categories: ['Business English', 'Meeting Mode'], tags: 'work, verbs',
        alternatives_de: ['sich entscheiden'], examples: [{ en: 'We must make a decision.', de: 'Wir müssen entscheiden.' }, 'Plain example.'],
      }],
    }) + '\n```';
    const r = parseImport(text);
    const d = r.rows[0].draft!;
    expect(d.externalId).toBe('gpt-1');
    expect(d.type).toBe('correction');
    expect(d.categories.map((c) => c.id)).toEqual(['business', 'meeting']);
    expect(d.tags).toEqual(['work', 'verbs']);
    expect(d.examples).toHaveLength(2);
  });

  it('flags invalid rows and broken JSON', () => {
    expect(parseImport('[{"english": "x"').fatal).toMatch(/^json:/);
    const r = parseImport('[{"english":"ok","german":"gut"},{"english":""},42,{"german":"nur deutsch"}]');
    expect(r.rows.map((x) => x.errors.length > 0)).toEqual([false, true, true, true]);
    expect(r.rows[1].errors).toContain('missing:english');
    expect(r.rows[2].errors).toContain('not-an-object');
  });

  it('warns about unknown level/type and creates custom categories', () => {
    const r = parseImport('[{"english":"gear ratio","german":"Übersetzungsverhältnis","level":"expert","type":"noun","category":"Cars & Bikes"}]');
    const row = r.rows[0];
    expect(row.warnings.join(' ')).toMatch(/level/);
    expect(row.warnings.join(' ')).toMatch(/type/);
    expect(row.draft!.type).toBe('phrase');
    expect(row.draft!.categories[0]).toEqual({ id: 'c-cars-bikes', name: 'Cars & Bikes', builtin: false });
  });

  it('treats content strictly as data (no prototype pollution, HTML kept as plain text)', () => {
    const r = parseImport('[{"english":"<img src=x onerror=alert(1)>","german":"x","__proto__":{"polluted":true}}]');
    expect(r.rows[0].draft!.english).toBe('<img src=x onerror=alert(1)>');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('strips control characters and truncates overlong fields', () => {
    const r = parseImport(JSON.stringify([{ english: 'a\u0000b', german: 'x'.repeat(1500) }]));
    expect(r.rows[0].draft!.english).toBe('ab');
    expect(r.rows[0].draft!.german).toHaveLength(1000);
    expect(r.rows[0].warnings.join()).toMatch(/truncated/);
  });

  it('infers item types', () => {
    expect(inferType('stress')).toBe('word');
    expect(inferType('to consider')).toBe('word');
    expect(inferType('take into account')).toBe('phrase');
    expect(inferType('Could you clarify this point?')).toBe('sentence');
  });

  it('strips code fences only when present', () => {
    expect(stripFences('[1]')).toBe('[1]');
    expect(stripFences('Here you go:\n```json\n[2]\n```\nEnjoy')).toBe('[2]');
  });
});

describe('CSV import', () => {
  it('parses quoted fields, embedded delimiters, newlines and semicolons', () => {
    expect(parseCsv('a,b\n"x, y","he said ""hi"""\n')).toEqual([['a', 'b'], ['x, y', 'he said "hi"']]);
    expect(parseCsv('a;b\r\n1;"multi\nline"')).toEqual([['a', 'b'], ['1', 'multi\nline']]);
    expect(parseCsvObjects('﻿English\tGerman\nhello\thallo')).toEqual([{ english: 'hello', german: 'hallo' }]);
  });

  it('imports CSV with pipe-separated lists', () => {
    const csv = 'english,german,alternatives,category,tags,level\n"to consider",berücksichtigen,"to take into account|to bear in mind","Meeting Mode|Business English","verbs|meetings",B1\n';
    const r = parseImport(csv);
    expect(r.format).toBe('csv');
    const d = r.rows[0].draft!;
    expect(d.alternatives_en).toEqual(['to take into account', 'to bear in mind']);
    expect(d.categories.map((c) => c.id)).toEqual(['meeting', 'business']);
    expect(d.tags).toEqual(['verbs', 'meetings']);
  });

  it('round-trips through our CSV writer including formula protection', () => {
    const csv = toCsv(['english', 'german'], [['-ing form', '=SUM(A1)'], ['a, b', 'c']]);
    expect(csv).toContain("'-ing form");
    const r = parseImport(csv);
    expect(r.rows[0].draft!.english).toBe('-ing form');
    expect(r.rows[0].draft!.german).toBe('=SUM(A1)');
    expect(r.rows[1].draft!.english).toBe('a, b');
  });
});

describe('duplicate detection & planning', () => {
  const existing: Item[] = [
    draftToItem(parseImport(SPEC_EXAMPLE).rows[0].draft!, 'item-1', NOW),
  ];

  it('detects new, unchanged, updated and in-file duplicates', () => {
    const text = JSON.stringify([
      { english: 'to take into account', german: 'berücksichtigen', category: 'Meeting Mode', level: 'B2', alternatives: ['to consider'],
        example_en: 'We need to take this into account.', example_de: 'Wir müssen das berücksichtigen.', ipa: '/tə teɪk ˈɪntuː əˈkaʊnt/' },
      { english: 'Take into account', german: 'beachten' },
      { english: 'mesh', german: 'Netz' },
      { english: 'Mesh.', german: 'Netz' },
      { foo: 'bar' },
    ]);
    const plan = planImport(parseImport(text), existing, ['everyday', 'business', 'engineering', 'meeting', 'handball']);
    expect(plan.rows.map((r) => r.status)).toEqual(['unchanged', 'duplicate', 'new', 'duplicate', 'invalid']);
    expect(plan.counts).toEqual({ new: 1, update: 0, unchanged: 1, duplicate: 2, invalid: 1 });
  });

  it('marks changed content as update and lists changed fields', () => {
    const text = JSON.stringify([{ english: 'to take into account', german: 'berücksichtigen, beachten', alternatives_de: ['beachten'], category: 'Business English' }]);
    const plan = planImport(parseImport(text), existing, []);
    expect(plan.rows[0].status).toBe('update');
    expect(plan.rows[0].existingId).toBe('item-1');
    expect(plan.rows[0].changes).toEqual(expect.arrayContaining(['german', 'alternatives_de', 'categories']));
  });

  it('matches by external id even when the English text changed', () => {
    const withExt = { ...existing[0], externalId: 'gpt-42' };
    const plan = planImport(parseImport(JSON.stringify([{ id: 'gpt-42', english: 'to take sth. into account', german: 'berücksichtigen' }])), [withExt], []);
    expect(plan.rows[0].status).toBe('update');
    expect(plan.rows[0].existingId).toBe('item-1');
  });

  it('collects new custom categories once', () => {
    const plan = planImport(parseImport(JSON.stringify([
      { english: 'a', german: 'a', category: 'Cooking' },
      { english: 'b', german: 'b', category: 'cooking' },
    ])), [], []);
    expect(plan.newCategories).toEqual([{ id: 'c-cooking', name: 'Cooking', builtin: false }]);
  });

  it('merge keeps id, favourites and unions alternatives/categories', () => {
    const cur = { ...existing[0], favorite: true };
    const d = parseImport(JSON.stringify([{ english: 'to take into account', german: 'berücksichtigen', alternatives: ['to bear in mind', 'To consider'], category: 'Business English' }])).rows[0].draft!;
    const m = mergeDraft(cur, d, '2026-12-01T00:00:00.000Z');
    expect(m.id).toBe('item-1');
    expect(m.favorite).toBe(true);
    expect(m.alternatives_en).toEqual(['to consider', 'to bear in mind']);
    expect(m.categories).toEqual(['meeting', 'business']);
    expect(m.example_en).toBe('We need to take this into account.');
    expect(m.created_at).toBe(NOW);
  });

  it('rejects files with too many rows', () => {
    const big = JSON.stringify(Array.from({ length: 5001 }, (_, i) => ({ english: `w${i}`, german: `w${i}` })));
    expect(parseImport(big).fatal).toMatch(/too-many/);
  });
});
