/**
 * Text-to-speech via the Web Speech API (SpeechSynthesis). Free, on-device on
 * iOS (system voices work offline). Degrades gracefully when unsupported.
 *
 * iOS notes (see ARCHITECTURE.md → "iOS limits"):
 * - The first utterance must be triggered by a user tap.
 * - Speech stops when the screen locks / the PWA goes to the background.
 * - Voices are the iOS system voices (Settings → Accessibility → Spoken Content).
 */
import type { Accent } from '../domain/types';
import { setAudioSession } from './audioSession';

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

let voicesCache: SpeechSynthesisVoice[] = [];

export function loadVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  if (!ttsSupported()) return Promise.resolve([]);
  const now = window.speechSynthesis.getVoices();
  if (now.length) {
    voicesCache = now;
    return Promise.resolve(now);
  }
  return new Promise((resolve) => {
    const done = () => {
      voicesCache = window.speechSynthesis.getVoices();
      resolve(voicesCache);
    };
    window.speechSynthesis.addEventListener?.('voiceschanged', done, { once: true });
    setTimeout(done, timeoutMs);
  });
}

const normLang = (l: string) => l.replace('_', '-').toLowerCase();

export function englishVoices(voices: SpeechSynthesisVoice[] = voicesCache): SpeechSynthesisVoice[] {
  return voices.filter((v) => normLang(v.lang).startsWith('en'));
}

export function pickVoice(accent: Accent, voiceURI: string | undefined, voices: SpeechSynthesisVoice[] = voicesCache): SpeechSynthesisVoice | undefined {
  const en = englishVoices(voices);
  if (voiceURI) {
    const v = en.find((x) => x.voiceURI === voiceURI);
    if (v) return v;
  }
  const want = accent.toLowerCase();
  const sameAccent = en.filter((v) => normLang(v.lang) === want);
  // Prefer on-device voices (work offline), then the default voice.
  return sameAccent.find((v) => v.localService && v.default) ?? sameAccent.find((v) => v.localService) ?? sameAccent[0] ?? en.find((v) => v.localService) ?? en[0];
}

export function germanVoice(voices: SpeechSynthesisVoice[] = voicesCache): SpeechSynthesisVoice | undefined {
  const de = voices.filter((v) => normLang(v.lang).startsWith('de'));
  return de.find((v) => v.localService) ?? de[0];
}

export interface SpeakOptions {
  lang: string;
  rate?: number;
  voice?: SpeechSynthesisVoice;
}

export interface SpeakResult {
  status: 'ended' | 'error' | 'unsupported';
  /** SpeechSynthesisErrorEvent.error, e.g. "not-allowed", "interrupted", "synthesis-failed". */
  error?: string;
  /** Whether the engine reported that it actually started speaking. */
  started: boolean;
}

// Keep a strong reference: WebKit may garbage-collect a running utterance and never fire onend.
let current: SpeechSynthesisUtterance | null = null;

/**
 * Speak a text; resolves when finished (or immediately if unsupported).
 *
 * iOS notes:
 * - must be called synchronously inside a tap handler for the first utterance
 *   → no awaits/timeouts before synth.speak();
 * - cancel() immediately followed by speak() can drop the utterance in WebKit
 *   → only cancel when something is actually playing;
 * - without an explicitly chosen voice only `lang` is set, so iOS uses the
 *   installed system voice (some listed voices are not usable from the web and stay silent);
 * - the audio session is switched to "playback" (loudspeaker, also after microphone use).
 */
export function speak(text: string, o: SpeakOptions & { onEvent?: (name: string, detail?: string) => void }): Promise<SpeakResult> {
  if (!ttsSupported() || !text.trim()) return Promise.resolve({ status: 'unsupported', started: false });
  const log = o.onEvent ?? (() => undefined);
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    setAudioSession('playback');
    const u = new SpeechSynthesisUtterance(text);
    u.lang = o.voice?.lang ?? o.lang;
    if (o.voice) u.voice = o.voice;
    u.rate = Math.min(2, Math.max(0.5, o.rate ?? 1));
    u.volume = 1;
    let settled = false;
    let started = false;
    const finish = (r: SpeakResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      if (current === u) current = null;
      resolve(r);
    };
    u.onstart = () => {
      started = true;
      log('start');
    };
    u.onend = () => {
      log('end');
      finish({ status: 'ended', started: true });
    };
    u.onerror = (e) => {
      const err = (e as SpeechSynthesisErrorEvent).error;
      log('error', err);
      // "interrupted"/"canceled" = we stopped it ourselves → not a failure
      if (err === 'interrupted' || err === 'canceled') finish({ status: 'ended', started });
      else finish({ status: 'error', error: err, started });
    };
    // Safety net: some engines never fire onend (e.g. interrupted by the OS).
    const guard = setTimeout(() => {
      log('timeout', started ? 'no end event' : 'never started');
      finish(started ? { status: 'ended', started } : { status: 'error', error: 'no-start', started });
    }, Math.max(5000, (text.length * 180) / (u.rate || 1)));
    if (synth.speaking || synth.pending) synth.cancel();
    if (synth.paused) synth.resume();
    current = u;
    log('speak-called', `${u.lang}${o.voice ? ` · ${o.voice.name}` : ' · system voice'}`);
    synth.speak(u);
  });
}

export function stopSpeaking(): void {
  if (!ttsSupported()) return;
  const synth = window.speechSynthesis;
  if (synth.speaking || synth.pending) synth.cancel();
}

/**
 * The voice to use for English output: only an explicitly chosen voice.
 * Otherwise undefined → iOS/the browser uses its default voice for the language.
 */
export function chosenVoice(voiceURI: string | undefined, voices: SpeechSynthesisVoice[] = voicesCache): SpeechSynthesisVoice | undefined {
  return voiceURI ? englishVoices(voices).find((v) => v.voiceURI === voiceURI) : undefined;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
