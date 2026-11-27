/**
 * iOS ring/silent-switch workaround.
 *
 * Web speech output on iOS uses an "ambient"-like audio session and stays
 * silent while the iPhone is muted. Playing an HTML <audio> element at the same
 * time switches the page to media playback, which is audible in silent mode
 * (same technique as the "unmute-ios-audio" approach for Web Audio).
 * The audio is pure silence, generated locally (blob URL, allowed by the CSP),
 * and stopped as soon as speaking ends.
 */
let el: HTMLAudioElement | null = null;
let url: string | null = null;
let generation = 0;

function silentWav(seconds = 0.5, rate = 8000): Blob {
  const samples = Math.round(seconds * rate);
  const buf = new ArrayBuffer(44 + samples);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  v.setUint32(4, 36 + samples, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true); // 8 bit
  w(36, 'data');
  v.setUint32(40, samples, true);
  for (let i = 0; i < samples; i++) v.setUint8(44 + i, 128); // 8-bit silence
  return new Blob([buf], { type: 'audio/wav' });
}

export function unmuteSupported(): boolean {
  return typeof window !== 'undefined' && typeof Audio !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
}

/**
 * Start silent media playback. Must be called synchronously inside a tap
 * handler (together with speechSynthesis.speak). Returns a stop function.
 */
export function startUnmute(onEvent?: (name: string, detail?: string) => void): () => void {
  if (!unmuteSupported()) return () => undefined;
  try {
    if (!el) {
      url = URL.createObjectURL(silentWav());
      el = new Audio(url);
      el.loop = true;
      el.preload = 'auto';
      el.setAttribute('playsinline', '');
    }
    const audio = el;
    const mine = ++generation;
    audio.currentTime = 0;
    const p = audio.play();
    if (p && typeof p.then === 'function') {
      p.then(() => onEvent?.('unmute', 'playing')).catch((e: Error) => onEvent?.('unmute', `blocked: ${e.name}`));
    }
    return () => {
      if (mine !== generation) return; // a newer utterance owns the playback
      try {
        audio.pause();
      } catch {
        /* ignore */
      }
    };
  } catch (e) {
    onEvent?.('unmute', `error: ${(e as Error).message}`);
    return () => undefined;
  }
}
