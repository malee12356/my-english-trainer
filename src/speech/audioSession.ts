/**
 * Audio Session API (Safari / iOS 17+): tells iOS how the page uses audio.
 * - 'playback': spoken output goes to the loudspeaker/Bluetooth and is meant
 *   to play even when the ring/silent switch is on (WebKit behaviour; verify on device).
 * - 'auto': let WebKit decide (used before speech recognition so the
 *   microphone can be opened).
 * No-op on browsers without the API.
 */
type SessionType = 'auto' | 'playback' | 'transient' | 'transient-solo' | 'ambient' | 'play-and-record';

export function audioSessionSupported(): boolean {
  return typeof navigator !== 'undefined' && 'audioSession' in navigator;
}

export function setAudioSession(type: SessionType): void {
  try {
    const s = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (s && s.type !== type) s.type = type;
  } catch {
    /* ignore – unsupported or not allowed */
  }
}

export function currentAudioSession(): string | null {
  try {
    return (navigator as unknown as { audioSession?: { type: string } }).audioSession?.type ?? null;
  } catch {
    return null;
  }
}
