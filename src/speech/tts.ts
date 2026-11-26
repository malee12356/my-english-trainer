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

/** Speak a text; resolves when finished (or immediately if unsupported). */
export function speak(text: string, o: SpeakOptions): Promise<'ended' | 'error' | 'unsupported'> {
  if (!ttsSupported() || !text.trim()) return Promise.resolve('unsupported');
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = o.voice?.lang ?? o.lang;
    if (o.voice) u.voice = o.voice;
    u.rate = Math.min(2, Math.max(0.5, o.rate ?? 1));
    let settled = false;
    const finish = (r: 'ended' | 'error') => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      resolve(r);
    };
    u.onend = () => finish('ended');
    u.onerror = () => finish('error');
    // Safety net: some engines never fire onend (e.g. interrupted by the OS).
    const guard = setTimeout(() => finish('ended'), Math.max(4000, text.length * 180 / (u.rate || 1)));
    synth.cancel();
    synth.speak(u);
  });
}

export function stopSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.cancel();
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
