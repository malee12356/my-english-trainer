import { afterEach, describe, expect, it, vi } from 'vitest';
import { acceptedAnswers } from '../../src/domain/answerCheck';
import { evaluateSpeech, normalizeSpoken } from '../../src/domain/speech';
import { indexProgress, planSession } from '../../src/domain/planner';
import { draftToItem, parseImport } from '../../src/domain/importer';
import { mapRecognitionError, RecognitionError, startRecognition } from '../../src/speech/recognition';

const meeting = { english: "I'm not entirely sure about that.", german: 'Da bin ich mir nicht ganz sicher.', alternatives_en: ["I'm not completely sure about that."], alternatives_de: [] };

describe('normalizeSpoken', () => {
  it('expands contractions and small numbers, unifies apostrophes', () => {
    expect(normalizeSpoken('I’m sure we can’t do it')).toBe('i am sure we cannot do it');
    expect(normalizeSpoken("Don't worry, it's fine")).toBe('do not worry, it is fine');
    expect(normalizeSpoken('we need 2 more tests')).toBe('we need two more tests');
    expect(normalizeSpoken("Let's start")).toBe('let us start');
  });
});

describe('evaluateSpeech', () => {
  const acc = acceptedAnswers(meeting, 'de-en');

  it('accepts a transcript without punctuation and with expanded contractions', () => {
    const ev = evaluateSpeech(['I am not entirely sure about that'], acc, 1);
    expect(ev.check.verdict).toBe('correct');
    expect(ev.grade).toBe(3);
    expect(ev.check.target).toBe("I'm not entirely sure about that.");
  });

  it('accepts context alternatives', () => {
    expect(evaluateSpeech(["I'm not completely sure about that"], acc, 1).check.verdict).toBe('correct');
  });

  it('picks the best recogniser alternative', () => {
    const ev = evaluateSpeech(['I am not entire leash your about that', "I'm not entirely sure about that"], acc, 1);
    expect(ev.check.verdict).toBe('correct');
    expect(ev.transcript).toBe("I'm not entirely sure about that");
  });

  it('grades by attempt: first try Good, later Hard, wrong Again', () => {
    expect(evaluateSpeech(["I'm not entirely sure about that"], acc, 2).grade).toBe(2);
    const wrong = evaluateSpeech(['I am sure'], acc, 1);
    expect(wrong.check.verdict).toBe('wrong');
    expect(wrong.grade).toBe(1);
    expect(wrong.check.diff.some((d) => d.kind === 'missing')).toBe(true);
  });

  it('treats near-homophones as almost (Hard), not as correct', () => {
    const ev = evaluateSpeech(['boundary condition'], ['boundary conditions'], 1);
    expect(ev.check.verdict).toBe('almost');
    expect(ev.grade).toBe(2);
  });

  it('handles the infinitive "to" and an empty transcript', () => {
    expect(evaluateSpeech(['take into account'], ['to take into account'], 1).check.verdict).toBe('correct');
    expect(evaluateSpeech([''], ['to take into account'], 1).check.verdict).toBe('wrong');
  });
});

describe('recognition wrapper', () => {
  type Handler = { onresult?: unknown; onerror?: unknown; onend?: unknown; onstart?: unknown };
  let lastInstance: Handler & { lang?: string; aborted?: boolean } = {};
  function install(behaviour: (r: Record<string, (...a: unknown[]) => void>) => void) {
    class FakeRecognition {
      lang = '';
      interimResults = false;
      maxAlternatives = 1;
      continuous = false;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onstart: (() => void) | null = null;
      aborted = false;
      constructor() {
        lastInstance = this as unknown as typeof lastInstance;
      }
      start() {
        setTimeout(() => behaviour(this as unknown as Record<string, (...a: unknown[]) => void>), 0);
      }
      stop() {
        this.onend?.();
      }
      abort() {
        this.aborted = true;
      }
    }
    (globalThis as unknown as { window: unknown }).window = { webkitSpeechRecognition: FakeRecognition };
  }
  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
    vi.useRealTimers();
  });

  it('maps browser error codes', () => {
    expect(mapRecognitionError('not-allowed')).toBe('denied');
    expect(mapRecognitionError('service-not-allowed')).toBe('denied');
    expect(mapRecognitionError('network')).toBe('network');
    expect(mapRecognitionError('audio-capture')).toBe('no-mic');
    expect(mapRecognitionError('something-new')).toBe('failed');
  });

  it('rejects with "unsupported" when there is no API', async () => {
    await expect(startRecognition('en-GB').promise).rejects.toMatchObject({ code: 'unsupported' });
  });

  it('resolves with all alternatives and sets the language', async () => {
    install((r) => {
      r.onstart?.();
      r.onresult?.({ results: [[{ transcript: ' hello world ', confidence: 0.9 }, { transcript: 'hello word', confidence: 0.5 }]] });
      r.onend?.();
    });
    const res = await startRecognition('en-US').promise;
    expect(res).toEqual({ transcript: 'hello world', alternatives: ['hello world', 'hello word'] });
    expect(lastInstance.lang).toBe('en-US');
  });

  it('rejects with mapped errors and with no-speech when the engine ends silently', async () => {
    install((r) => {
      r.onstart?.();
      r.onerror?.({ error: 'not-allowed' });
      r.onend?.();
    });
    const e1 = await startRecognition('en-GB').promise.catch((e) => e);
    expect(e1).toBeInstanceOf(RecognitionError);
    expect(e1.code).toBe('denied');
    install((r) => {
      r.onstart?.();
      r.onend?.();
    });
    await expect(startRecognition('en-GB').promise).rejects.toMatchObject({ code: 'no-speech' });
  });

  it('fails fast when the engine never starts (guard for broken web-app builds)', async () => {
    vi.useFakeTimers();
    install(() => undefined);
    const p = startRecognition('en-GB', { startTimeoutMs: 1000 }).promise.catch((e) => e);
    await vi.advanceTimersByTimeAsync(1100);
    expect((await p).code).toBe('failed');
    expect(lastInstance.aborted).toBe(true);
  });

  it('abort() releases the recogniser and rejects with aborted', async () => {
    install((r) => r.onstart?.());
    const h = startRecognition('en-GB');
    h.abort();
    await expect(h.promise).rejects.toMatchObject({ code: 'aborted' });
    expect(lastInstance.aborted).toBe(true);
  });
});

describe('planner and speaking', () => {
  const items = parseImport(JSON.stringify([
    { english: 'to take into account', german: 'berücksichtigen', category: 'Meeting Mode' },
    { english: 'stress', german: 'Spannung', category: 'Engineering Mode' },
  ])).rows.map((r, i) => draftToItem(r.draft!, `i${i}`, '2026-11-01T00:00:00.000Z'));
  const base = { topic: 'all', minutes: 10, now: new Date('2026-11-26T10:00:00Z'), newPerDay: 10, newIntroducedToday: 0, flashcardDirection: 'random' as const, ttsAvailable: true };

  it('plans speaking tasks only when recognition is usable', () => {
    expect(planSession(items, indexProgress([]), { ...base, method: 'speaking', sttAvailable: false })).toHaveLength(0);
    const tasks = planSession(items, indexProgress([]), { ...base, method: 'speaking', sttAvailable: true });
    expect(tasks.length).toBe(2);
    expect(tasks.every((t) => t.method === 'speaking' && t.skill === 'speaking' && t.direction === 'de-en')).toBe(true);
  });

  it('never puts speaking into automatic sessions', () => {
    const tasks = planSession(items, indexProgress([]), { ...base, method: 'auto', sttAvailable: true, minutes: 45 });
    expect(tasks.some((t) => t.method === 'speaking')).toBe(false);
  });
});
