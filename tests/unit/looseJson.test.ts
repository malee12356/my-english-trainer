import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseImport } from '../../src/domain/importer';
import { parseLooseJson } from '../../src/domain/looseJson';

const DAMAGED = readFileSync(new URL('../fixtures/chatgpt-damaged-paste.txt', import.meta.url), 'utf8');

describe('tolerant JSON reader (copy & paste damage)', () => {
  it('imports a ChatGPT message with escapes, typographic quotes and lost list brackets', () => {
    expect(() => JSON.parse(DAMAGED)).toThrow();
    const r = parseImport(DAMAGED);
    expect(r.fatal).toBeUndefined();
    expect(r.repairs).toEqual(['markdown', 'quotes', 'structure']);
    expect(r.rows).toHaveLength(4);
    expect(r.rows.every((x) => x.errors.length === 0)).toBe(true);
    const [a, b, c, d] = r.rows.map((x) => x.draft!);
    expect(a.tags).toEqual(['modal-verbs', 'negation']);
    expect(a.source).toBe('chatgpt-project');
    expect(b.english).toBe('She doesn’t like coffee.');
    expect(b.tags).toEqual(['do-does', 'negation', 'food']);
    expect(b.common_mistake).toBe('She don’t like coffee.');
    expect(c.ipa).toBe('/ət liːst/');
    expect(c.alternatives_de).toEqual(['wenigstens']);
    expect(d.alternatives_en).toEqual(['We can carry on tomorrow.', 'We can pick this up again tomorrow.']);
    expect(d.explanation).toBe('Er sagte „Bis morgen“ – continue und carry on passen hier.');
    expect(d.categories.map((x) => x.id)).toEqual(['meeting']);
  });

  it('keeps quotes inside text and handles escapes', () => {
    expect(parseLooseJson('{“a”: “He said “yes” to me”, “b”: "x\\ny"}')).toEqual({ a: 'He said “yes” to me', b: 'x\ny' });
  });

  it('accepts trailing/doubled commas, missing outer brackets and a missing final bracket', () => {
    expect(parseLooseJson('[{"a":1,,}, {"a":2},]')).toEqual([{ a: 1 }, { a: 2 }]);
    expect(parseLooseJson('{"a":1}, {"a":2}')).toEqual([{ a: 1 }, { a: 2 }]);
    expect(parseLooseJson('[{"a": "x"}')).toEqual([{ a: 'x' }]);
  });

  it('collects lost list items only until the next key', () => {
    expect(parseLooseJson('{"tags": "a", "b", "c", "next": "d"}')).toEqual({ tags: ['a', 'b', 'c'], next: 'd' });
    expect(parseLooseJson('{"tags": "a", "b"}')).toEqual({ tags: ['a', 'b'] });
    expect(parseLooseJson('{"one": "a", "two": "b"}')).toEqual({ one: 'a', two: 'b' });
  });

  it('rejects prototype keys and reports a readable position on real garbage', () => {
    expect(parseLooseJson('{"__proto__": {"x": 1}, "a": 1}')).toEqual({ a: 1 });
    expect(() => parseLooseJson('{"a" 1}')).toThrow(/Position/);
    expect(parseImport('[{"english": "pet", "german": ').fatal).toMatch(/^json:/);
  });

  it('leaves valid JSON to the strict parser (no repairs reported)', () => {
    expect(parseImport('[{"english":"pet","german":"Haustier","tags":["a"]}]').repairs).toEqual([]);
  });
});
