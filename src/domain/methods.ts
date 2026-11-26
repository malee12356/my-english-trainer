import type { Method } from './types';

export interface MethodInfo {
  id: Method;
  emoji: string;
  de: string;
  en: string;
  descDe: string;
  descEn: string;
  /** ready = usable now; planned = shown transparently as not yet available. */
  status: 'ready' | 'planned';
  phase?: number;
  needsTts?: boolean;
}

export const METHODS: MethodInfo[] = [
  { id: 'flashcards', emoji: '🃏', de: 'Karteikarten', en: 'Flashcards', descDe: 'Umdrehen und selbst bewerten', descEn: 'Flip and rate yourself', status: 'ready' },
  { id: 'writing', emoji: '⌨️', de: 'Writing Mode', en: 'Writing Mode', descDe: 'Englische Antwort tippen, Fehler werden markiert', descEn: 'Type the English answer, mistakes are highlighted', status: 'ready' },
  { id: 'gapfill', emoji: '🧩', de: 'Lückentext', en: 'Gap Fill', descDe: 'Fehlendes Wort im Beispielsatz ergänzen', descEn: 'Fill in the missing word', status: 'ready' },
  { id: 'builder', emoji: '🧱', de: 'Satzbau', en: 'Sentence Builder', descDe: 'Satz aus Wörtern zusammensetzen', descEn: 'Build the sentence from words', status: 'ready' },
  { id: 'listening', emoji: '🎧', de: 'Listening', en: 'Listening', descDe: 'Nur hören, verstehen, mitschreiben', descEn: 'Listen only, understand, write', status: 'ready', needsTts: true },
  { id: 'speaking', emoji: '🎙️', de: 'Speaking', en: 'Speaking', descDe: 'Übersetzung sprechen, Text wird erkannt', descEn: 'Say the translation, speech is recognised', status: 'planned', phase: 2 },
  { id: 'pronunciation', emoji: '👄', de: 'Aussprache', en: 'Pronunciation', descDe: 'Nachsprechen, aufnehmen, vergleichen', descEn: 'Repeat, record, compare', status: 'planned', phase: 2 },
  { id: 'freespeaking', emoji: '💬', de: 'Free Speaking', en: 'Free Speaking', descDe: 'Frei antworten, Transkript für ChatGPT', descEn: 'Answer freely, transcript for ChatGPT', status: 'planned', phase: 3 },
];

export function methodLabel(id: Method | 'auto', lang: 'de' | 'en'): string {
  if (id === 'auto') return lang === 'de' ? 'Automatisch' : 'Automatic';
  const m = METHODS.find((x) => x.id === id);
  return m ? (lang === 'de' ? m.de : m.en) : id;
}

export const DURATIONS = [5, 10, 15, 20, 30, 45];
