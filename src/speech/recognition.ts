/**
 * One-shot speech recognition (Web Speech API) with explicit error codes.
 *
 * - The microphone is only used between start() and the end of the utterance.
 *   No continuous listening, nothing is recorded or stored by the app.
 * - On iOS/Safari and Chrome the browser usually sends the audio to the
 *   platform's speech service (Apple/Google). The UI asks for consent first.
 *
 * WebKit quirks handled here (installed iOS web apps in particular):
 * - final results sometimes never arrive → interim results are collected and
 *   used when the engine ends without a final result,
 * - the engine may keep listening after the speaker stopped → stop() on speechend,
 * - the permission prompt can delay "start" → generous start timeout, any
 *   audio event counts as started.
 */
import { recognitionCtor } from './capabilities';

export type RecognitionErrorCode = 'unsupported' | 'denied' | 'network' | 'no-speech' | 'no-mic' | 'aborted' | 'language' | 'failed';

export class RecognitionError extends Error {
  constructor(public code: RecognitionErrorCode, public detail?: string) {
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
  /** true when only interim results were delivered (WebKit quirk). */
  fromInterim: boolean;
}

export interface RecognitionHandle {
  promise: Promise<RecognitionResult>;
  /** Stop listening and evaluate what was heard so far. */
  stop: () => void;
  /** Cancel without result (e.g. component unmounted). */
  abort: () => void;
}

export interface RecognitionOptions {
  timeoutMs?: number;
  startTimeoutMs?: number;
  /** Live transcript while speaking (interim results). */
  onInterim?: (text: string) => void;
  /** Every engine event – used by the diagnostics screen. */
  onEvent?: (name: string, detail?: string) => void;
}

type SpeechResultList = ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }>;
type Engine = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: SpeechResultList; resultIndex?: number }) => void) | null;
  onerror: ((e: { error: string; message?: string }) => void) | null;
  onend: (() => void) | null;
  onstart?: (() => void) | null;
  onaudiostart?: (() => void) | null;
  onsoundstart?: (() => void) | null;
  onspeechstart?: (() => void) | null;
  onspeechend?: (() => void) | null;
  onnomatch?: (() => void) | null;
};

export function startRecognition(lang: string, opts: RecognitionOptions = {}): RecognitionHandle {
  const Ctor = recognitionCtor();
  const log = (n: string, d?: string) => opts.onEvent?.(n, d);
  if (!Ctor) {
    log('unsupported');
    return { promise: Promise.reject(new RecognitionError('unsupported')), stop: () => undefined, abort: () => undefined };
  }
  const r = new Ctor() as unknown as Engine;
  r.lang = lang;
  r.interimResults = true;
  r.maxAlternatives = 3;
  r.continuous = false;
  let settled = false;
  let started = false;
  let finalAlts: string[] = [];
  let interim = '';
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
  const markStarted = (name: string) => () => {
    started = true;
    log(name);
  };
  r.onstart = markStarted('start');
  r.onaudiostart = markStarted('audiostart');
  r.onsoundstart = markStarted('soundstart');
  r.onspeechstart = markStarted('speechstart');
  r.onspeechend = () => {
    log('speechend');
    try { r.stop(); } catch { /* ignore */ }
  };
  r.onnomatch = () => log('nomatch');
  r.onresult = (e) => {
    started = true;
    const parts: string[] = [];
    let isFinal = false;
    for (let i = 0; i < e.results.length; i++) {
      const res = e.results[i];
      if (res?.[0]) parts.push(res[0].transcript);
      if (res?.isFinal) isFinal = true;
    }
    const text = parts.join(' ').replace(/\s+/g, ' ').trim();
    log(isFinal ? 'result-final' : 'result-interim', text);
    if (isFinal) {
      const last = e.results[e.results.length - 1];
      const alts = Array.from({ length: last?.length ?? 0 }, (_, i) => last[i].transcript.trim()).filter(Boolean);
      // with several result segments the joined text is the main hypothesis
      finalAlts = e.results.length > 1 ? [text, ...alts.slice(1)] : alts.length ? alts : [text];
      finish(() => resolveFn({ transcript: finalAlts[0], alternatives: finalAlts, fromInterim: false }));
      try { r.stop(); } catch { /* ignore */ }
    } else if (text) {
      interim = text;
      opts.onInterim?.(text);
    }
  };
  r.onerror = (e) => {
    log('error', e.error + (e.message ? ` – ${e.message}` : ''));
    // WebKit reports "no-speech"/"aborted" after we already heard something → use it
    if (interim && (e.error === 'no-speech' || e.error === 'aborted')) {
      finish(() => resolveFn({ transcript: interim, alternatives: [interim], fromInterim: true }));
      return;
    }
    finish(() => rejectFn(new RecognitionError(mapRecognitionError(e.error), e.error)));
  };
  r.onend = () => {
    log('end');
    if (interim) finish(() => resolveFn({ transcript: interim, alternatives: [interim], fromInterim: true }));
    else finish(() => rejectFn(new RecognitionError(started ? 'no-speech' : 'failed', started ? undefined : 'ended-before-start')));
  };
  // Hard limit for one answer, and a guard for engines that never start.
  timers.push(setTimeout(() => {
    log('timeout');
    try { r.stop(); } catch { /* ignore */ }
  }, opts.timeoutMs ?? 12_000));
  timers.push(setTimeout(() => {
    if (!started) {
      log('start-timeout');
      try { r.abort(); } catch { /* ignore */ }
      finish(() => rejectFn(new RecognitionError('failed', 'start-timeout')));
    }
  }, opts.startTimeoutMs ?? 15_000));
  try {
    log('start-called', lang);
    r.start();
  } catch (err) {
    log('start-exception', (err as Error).message);
    finish(() => rejectFn(new RecognitionError('failed', (err as Error).message)));
  }
  return {
    promise,
    stop: () => {
      log('stop-called');
      try { r.stop(); } catch { /* ignore */ }
    },
    abort: () => {
      try { r.abort(); } catch { /* ignore */ }
      finish(() => rejectFn(new RecognitionError('aborted')));
    },
  };
}
