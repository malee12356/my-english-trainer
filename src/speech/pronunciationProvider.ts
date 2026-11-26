/**
 * Optional interface for a PROFESSIONAL pronunciation assessment (Phase 4).
 *
 * Nothing is implemented or enabled yet. Any provider (e.g. Azure AI Speech
 * Pronunciation Assessment) must:
 *  - be disabled by default,
 *  - require explicit consent before audio leaves the device,
 *  - never embed API keys in the client bundle (use a user-provided key or a
 *    small proxy owned by the user),
 *  - report phoneme scores only when the service actually measured them.
 */
export interface PronunciationAssessment {
  provider: string;
  /** Scores exactly as returned by the service (0–100), never invented locally. */
  accuracy?: number;
  fluency?: number;
  completeness?: number;
  words: { word: string; accuracy?: number; error?: 'omission' | 'insertion' | 'mispronunciation' | 'none' }[];
}

export interface PronunciationProvider {
  id: string;
  name: string;
  requiresNetwork: true;
  /** Costs may occur with the provider – user consent is required. */
  paid: boolean;
  isConfigured(): boolean;
  assess(audio: Blob, referenceText: string, lang: string): Promise<PronunciationAssessment>;
}

const providers: PronunciationProvider[] = [];

export function registerPronunciationProvider(p: PronunciationProvider): void {
  if (!providers.some((x) => x.id === p.id)) providers.push(p);
}

export function availablePronunciationProviders(): PronunciationProvider[] {
  return providers.filter((p) => p.isConfigured());
}
