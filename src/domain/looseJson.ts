/**
 * Tolerant reader for JSON that was damaged by copy & paste (ChatGPT app,
 * notes apps, messengers). Used only when strict JSON.parse failed.
 *
 * Handles:
 * - Markdown escapes before brackets (\[ … \]) – removed beforehand
 * - typographic quotes “ ” „ ‟ ″ as string delimiters (mixed with " )
 * - lists whose [ ] brackets were lost:  "tags": "a", "b", "c", "next": …
 * - trailing / doubled commas, missing commas between entries
 * - quotes INSIDE text (e.g. German „Hallo“) – a closing quote only ends a
 *   string when it is followed by , : } ] or the end of the text
 */

const OPEN_QUOTES = new Set(['"', '“', '”', '„', '‟', '″']);
const CLOSE_QUOTES = new Set(['"', '“', '”', '‟', '″']);

type Tok =
  | { t: 'str'; v: string; pos: number }
  | { t: 'num' | 'lit'; v: unknown; pos: number }
  | { t: 'punct'; v: '{' | '}' | '[' | ']' | ':' | ','; pos: number };

export class LooseJsonError extends Error {
  constructor(message: string, public pos: number) {
    super(`${message} (Position ${pos})`);
  }
}

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const n = src.length;
  const isWs = (c: string) => c === ' ' || c === '\n' || c === '\r' || c === '\t' || c === ' ' || c === '﻿';
  while (i < n) {
    const c = src[i];
    if (isWs(c)) {
      i++;
      continue;
    }
    if ('{}[]:,'.includes(c)) {
      toks.push({ t: 'punct', v: c as '{', pos: i });
      i++;
      continue;
    }
    if (OPEN_QUOTES.has(c)) {
      const start = i;
      i++;
      let out = '';
      let closed = false;
      while (i < n) {
        const ch = src[i];
        if (ch === '\\' && i + 1 < n) {
          const e = src[i + 1];
          const map: Record<string, string> = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '"': '"', '\\': '\\', '/': '/' };
          if (e === 'u' && /^[0-9a-fA-F]{4}$/.test(src.slice(i + 2, i + 6))) {
            out += String.fromCharCode(parseInt(src.slice(i + 2, i + 6), 16));
            i += 6;
          } else {
            out += map[e] ?? e; // unknown escape like \_ → keep the character
            i += 2;
          }
          continue;
        }
        if (CLOSE_QUOTES.has(ch)) {
          // only a real end of string if followed by structure (or end of text)
          let j = i + 1;
          while (j < n && isWs(src[j])) j++;
          if (j >= n || ',:}]'.includes(src[j])) {
            i++;
            closed = true;
            break;
          }
        }
        out += ch;
        i++;
      }
      if (!closed) throw new LooseJsonError('Text ohne schließendes Anführungszeichen', start);
      toks.push({ t: 'str', v: out, pos: start });
      continue;
    }
    const m = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(src.slice(i, i + 40));
    if (m) {
      toks.push({ t: 'num', v: Number(m[0]), pos: i });
      i += m[0].length;
      continue;
    }
    const lit = /^(true|false|null)\b/.exec(src.slice(i, i + 6));
    if (lit) {
      toks.push({ t: 'lit', v: lit[1] === 'true' ? true : lit[1] === 'false' ? false : null, pos: i });
      i += lit[1].length;
      continue;
    }
    throw new LooseJsonError(`Unerwartetes Zeichen „${c}“`, i);
  }
  return toks;
}

export function parseLooseJson(src: string): unknown {
  const toks = tokenize(src);
  let p = 0;
  const peek = (o = 0) => toks[p + o];
  const isP = (tok: Tok | undefined, v: string) => !!tok && tok.t === 'punct' && tok.v === v;
  const skipCommas = () => {
    while (isP(peek(), ',')) p++;
  };

  function value(): unknown {
    const tok = peek();
    if (!tok) throw new LooseJsonError('Unerwartetes Ende', src.length);
    if (isP(tok, '{')) return object();
    if (isP(tok, '[')) return array();
    if (tok.t === 'str' || tok.t === 'num' || tok.t === 'lit') {
      p++;
      return tok.v;
    }
    throw new LooseJsonError(`Unerwartetes „${String(tok.v)}“`, tok.pos);
  }

  function array(): unknown[] {
    p++; // [
    const out: unknown[] = [];
    for (;;) {
      skipCommas();
      if (!peek()) return out; // tolerate a missing closing bracket at the very end
      if (isP(peek(), ']')) {
        p++;
        return out;
      }
      out.push(value());
    }
  }

  function object(): Record<string, unknown> {
    p++; // {
    const out: Record<string, unknown> = {};
    for (;;) {
      skipCommas();
      const tok = peek();
      if (!tok) return out;
      if (isP(tok, '}')) {
        p++;
        return out;
      }
      if (tok.t !== 'str') throw new LooseJsonError('Feldname erwartet', tok.pos);
      p++;
      if (!isP(peek(), ':')) throw new LooseJsonError(`„:“ nach „${tok.v}“ erwartet`, peek()?.pos ?? src.length);
      p++;
      let v = value();
      // Lost list brackets: "tags": "a", "b", "c", "next": …  → collect strings
      // until the next "key": or the end of the object.
      if (typeof v === 'string') {
        const items = [v];
        while (isP(peek(), ',') && peek(1)?.t === 'str' && !isP(peek(2), ':')) {
          p++;
          items.push(String(value()));
        }
        if (items.length > 1) v = items;
      }
      if (tok.v !== '__proto__' && tok.v !== 'constructor' && tok.v !== 'prototype') out[tok.v as string] = v;
    }
  }

  skipCommas();
  // A sequence of objects without surrounding brackets is read as a list.
  const first = value();
  skipCommas();
  if (p >= toks.length) return first;
  const list: unknown[] = [first];
  while (p < toks.length) {
    if (isP(peek(), ']') || isP(peek(), '}')) {
      p++;
      continue;
    }
    list.push(value());
    skipCommas();
  }
  return list;
}
