/**
 * Capability detection for speech input (Phase 2 preparation).
 *
 * Important distinction (documented in ARCHITECTURE.md):
 * - Speech RECOGNITION turns speech into text. A successful transcript only
 *   shows that the system understood the words – it is NOT a phonetic
 *   pronunciation assessment and must never be shown as a percentage score.
 * - A real pronunciation assessment needs a dedicated service (e.g. Azure AI
 *   Speech Pronunciation Assessment) – see pronunciationProvider.ts.
 */

type RecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart?: (() => void) | null;
};

export function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export interface SpeechCapabilities {
  tts: boolean;
  recognition: boolean;
  /** Recognition on iOS/Chrome uses server-side dictation → needs network. */
  recognitionNeedsNetwork: boolean;
  /** Recognition can be used right now (API present and online). */
  recognitionUsable: boolean;
  mediaRecorder: boolean;
  recorderMime: string | null;
  microphoneApi: boolean;
  standalone: boolean;
  ios: boolean;
  online: boolean;
}

export function recorderMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const t of ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/aac']) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t;
    } catch {
      /* ignore */
    }
  }
  return '';
}

export function detectSpeechCapabilities(): SpeechCapabilities {
  const hasWindow = typeof window !== 'undefined';
  return {
    tts: hasWindow && 'speechSynthesis' in window,
    recognition: recognitionCtor() !== null,
    recognitionNeedsNetwork: true,
    recognitionUsable: recognitionCtor() !== null && (typeof navigator === 'undefined' || navigator.onLine),
    mediaRecorder: typeof MediaRecorder !== 'undefined',
    recorderMime: recorderMimeType(),
    microphoneApi: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
    standalone: isStandalone(),
    ios: isIOS(),
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
  };
}
