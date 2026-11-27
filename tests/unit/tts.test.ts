import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chosenVoice, speak, stopSpeaking } from '../../src/speech/tts';

interface FakeUtterance {
  text: string;
  lang: string;
  voice: unknown;
  rate: number;
  volume: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

let calls: string[];
let spoken: FakeUtterance[];
let behaviour: (u: FakeUtterance) => void;
const session = { type: 'auto' };
const voices = [
  { name: 'Daniel', lang: 'en-GB', voiceURI: 'daniel', localService: true, default: true },
  { name: 'Samantha', lang: 'en-US', voiceURI: 'samantha', localService: true, default: false },
  { name: 'Anna', lang: 'de-DE', voiceURI: 'anna', localService: true, default: false },
] as unknown as SpeechSynthesisVoice[];

beforeEach(() => {
  calls = [];
  spoken = [];
  session.type = 'auto';
  behaviour = (u) => {
    u.onstart?.();
    u.onend?.();
  };
  const synth = {
    speaking: false,
    pending: false,
    paused: false,
    speak(u: FakeUtterance) {
      calls.push('speak');
      spoken.push(u);
      setTimeout(() => behaviour(u), 0);
    },
    cancel() {
      calls.push('cancel');
    },
    resume() {
      calls.push('resume');
    },
    getVoices: () => voices,
  };
  class Utterance {
    lang = '';
    voice: unknown = null;
    rate = 1;
    volume = 1;
    onstart = null;
    onend = null;
    onerror = null;
    constructor(public text: string) {}
  }
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = { speechSynthesis: synth, SpeechSynthesisUtterance: Utterance };
  g.SpeechSynthesisUtterance = Utterance;
  Object.defineProperty(globalThis, 'navigator', { value: { audioSession: session }, configurable: true });
});
afterEach(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  delete g.window;
  delete g.SpeechSynthesisUtterance;
});

describe('speak (iOS-safe behaviour)', () => {
  it('uses only the language (system voice) when no voice was chosen', async () => {
    const r = await speak('Hello', { lang: 'en-GB', rate: 0.9 });
    expect(r).toEqual({ status: 'ended', started: true });
    expect(spoken[0].lang).toBe('en-GB');
    expect(spoken[0].voice).toBeNull();
    expect(spoken[0].volume).toBe(1);
  });

  it('switches the audio session to playback before speaking', async () => {
    await speak('Hello', { lang: 'en-GB' });
    expect(session.type).toBe('playback');
  });

  it('does not cancel when nothing is playing (WebKit drops cancel+speak)', async () => {
    await speak('Hello', { lang: 'en-GB' });
    expect(calls).toEqual(['speak']);
    const synth = (globalThis as unknown as { window: { speechSynthesis: { speaking: boolean; paused: boolean } } }).window.speechSynthesis;
    synth.speaking = true;
    synth.paused = true;
    await speak('Again', { lang: 'en-GB' });
    expect(calls).toEqual(['speak', 'cancel', 'resume', 'speak']);
  });

  it('reports engine errors, but treats our own interruption as ended', async () => {
    behaviour = (u) => u.onerror?.({ error: 'not-allowed' });
    expect(await speak('Hello', { lang: 'en-GB' })).toEqual({ status: 'error', error: 'not-allowed', started: false });
    behaviour = (u) => {
      u.onstart?.();
      u.onerror?.({ error: 'interrupted' });
    };
    expect(await speak('Hello', { lang: 'en-GB' })).toEqual({ status: 'ended', started: true });
  });

  it('logs events for diagnostics', async () => {
    const ev: string[] = [];
    await speak('Hello', { lang: 'en-US', onEvent: (n) => ev.push(n) });
    expect(ev).toEqual(['speak-called', 'start', 'end']);
  });

  it('stopSpeaking only cancels while speaking', () => {
    stopSpeaking();
    expect(calls).toEqual([]);
  });

  it('returns unsupported for empty text', async () => {
    expect(await speak('  ', { lang: 'en-GB' })).toEqual({ status: 'unsupported', started: false });
  });
});

describe('chosenVoice', () => {
  it('returns only an explicitly chosen English voice', () => {
    expect(chosenVoice(undefined, voices)).toBeUndefined();
    expect(chosenVoice('samantha', voices)?.name).toBe('Samantha');
    expect(chosenVoice('anna', voices)).toBeUndefined();
    expect(chosenVoice('missing', voices)).toBeUndefined();
  });
});
