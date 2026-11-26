/**
 * One-shot speech recognition (Web Speech API) with explicit error codes.
 *
 * - The microphone is only used between start() and the first result/error.
 *   No continuous listening, nothing is recorded or stored by the app.
 * - On iOS/Safari and Chrome the browser usually sends the audio to the
 *   platform's speech service (Apple/Google). The UI asks for consent first.
 */
import { recognitionCtor } from './capabilities';

export type RecognitionErrorCode = 'unsupported' | 'denied' | 'network' | 'no-speech' | 'no-mic' | 'aborted' | 'language' | 'failed';

export class RecognitionError extends Error {
  constructor(public code: RecognitionErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

/** Map Web Speech API error strings to our codes. */
export function mapRecognitionError(error: string | undefined): RecognitionErrorCode {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'denied';
    case 'network':
      return 'network';
    case 'no-speech':
      return 'no-speech';
    case 'audio-capture':
      return 'no-mic';
    case 'aborted':
      return 'aborted';
    case 'language-not-supported':
    case 'bad-grammar':
      return 'language';
    default:
      return 'failed';
  }
}

export interface RecognitionResult {
  transcript: string;
  /** All alternatives, best first (includes transcript). */
  alternatives: string[];
}

export interface RecognitionHandle {
  promise: Promise<RecognitionResult>;
  /** Stop listening and evaluate what was heard so far. */
  stop: () => void;
  /** Cancel without result (e.g. component unmounted). */
  abort: () => void;
}

export function startRecognition(lang: string, opts: { timeoutMs?: number; startTimeoutMs?: number } = {}): RecognitionHandle {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    return { promise: Promise.reject(new RecognitionError('unsupported')), stop: () => undefined, abort: () => undefined };
  }
  const r = new Ctor() as InstanceType<NonNullable<ReturnType<typeof recognitionCtor>>> & { onstart?: (() => void) | null };
  r.lang = lang;
  r.interimResults = false;
  r.maxAlternatives = 3;
  r.continuous = false;
  let settled = false;
  let started = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  let resolveFn!: (v: RecognitionResult) => void;
  let rejectFn!: (e: RecognitionError) => void;
  const promise = new Promise<RecognitionResult>((res, rej) => {
    resolveFn = res;
    rejectFn = rej;
  });
  const finish = (fn: () => void) => {
    if (settled) return;
    settled = true;
    timers.forEach(clearTimeout);
    fn();
  };
  r.onstart = () => {
    started = true;
  };
  r.onresult = (e) => {
    const res = e.results[0];
    const alternatives = Array.from({ length: res?.length ?? 0 }, (_, i) => res[i].transcript.trim()).filter(Boolean);
    finish(() => (alternatives.length ? resolveFn({ transcript: alternatives[0], alternatives }) : rejectFn(new RecognitionError('no-speech'))));
  };
  r.onerror = (e) => finish(() => rejectFn(new RecognitionError(mapRecognitionError(e.error), e.error)));
  r.onend = () => finish(() => rejectFn(new RecognitionError('no-speech')));
  // Hard limit for one answer, and a guard for engines that never start (seen in some iOS web-app builds).
  timers.push(setTimeout(() => { try { r.stop(); } catch { /* ignore */ } }, opts.timeoutMs ?? 10_000));
  timers.push(setTimeout(() => {
    if (!started) {
      try { r.abort(); } catch { /* ignore */ }
      finish(() => rejectFn(new RecognitionError('failed', 'start-timeout')));
    }
  }, opts.startTimeoutMs ?? 5_000));
  try {
    r.start();
  } catch (err) {
    finish(() => rejectFn(new RecognitionError('failed', (err as Error).message)));
  }
  return {
    promise,
    stop: () => {
      try { r.stop(); } catch { /* ignore */ }
    },
    abort: () => {
      try { r.abort(); } catch { /* ignore */ }
      finish(() => rejectFn(new RecognitionError('aborted')));
    },
  };
}
