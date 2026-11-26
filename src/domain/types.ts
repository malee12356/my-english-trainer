/**
 * Core data model. See DATA_SCHEMA.md for the documented, versioned schema.
 *
 * Imported/learning CONTENT (Item) is stored separately from internally
 * generated LEARNING DATA (Progress, ReviewLog, StudySession). A re-import only
 * ever touches Item rows; progress is keyed by item id + skill and survives.
 */

export const ITEM_SCHEMA_VERSION = 1;

export type ItemType = 'word' | 'phrase' | 'sentence' | 'grammar' | 'correction';
export const ITEM_TYPES: ItemType[] = ['word', 'phrase', 'sentence', 'grammar', 'correction'];

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export const CEFR_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export type ItemOrigin = 'import' | 'manual' | 'starter';

export interface ExamplePair {
  en: string;
  de?: string;
}

export interface Item {
  /** Stable internal id (uuid). Never changes, also not on re-import. */
  id: string;
  schemaVersion: number;
  /** Optional id supplied by the import source (e.g. ChatGPT). Used for matching. */
  externalId?: string;
  english: string;
  german: string;
  /** Accepted alternative English answers (DE → EN direction). */
  alternatives_en: string[];
  /** Accepted alternative German answers (EN → DE direction). */
  alternatives_de: string[];
  example_en?: string;
  example_de?: string;
  examples: ExamplePair[];
  ipa?: string;
  type: ItemType;
  level?: CefrLevel;
  /** Category ids (an item can belong to several topic modes). */
  categories: string[];
  tags: string[];
  notes?: string;
  common_mistake?: string;
  explanation?: string;
  source?: string;
  favorite: boolean;
  archived: boolean;
  collections: string[];
  origin: ItemOrigin;
  /** Normalised English text – used for duplicate detection (indexed). */
  key: string;
  created_at: string;
  updated_at: string;
}

/**
 * Separately tracked abilities. One FSRS memory state per item AND skill, so
 * "I understand it" and "I can produce it" are scheduled independently.
 */
export type Skill = 'comprehension' | 'recall' | 'writing' | 'listening' | 'speaking';
export const SKILLS: Skill[] = ['comprehension', 'recall', 'writing', 'listening', 'speaking'];

export type Method =
  | 'flashcards'
  | 'writing'
  | 'gapfill'
  | 'builder'
  | 'listening'
  | 'speaking'
  | 'pronunciation'
  | 'freespeaking';

export type Direction = 'en-de' | 'de-en';

/** 1 = Again (nicht gewusst), 2 = Hard, 3 = Good, 4 = Easy – identical to FSRS. */
export type Grade = 1 | 2 | 3 | 4;

export interface Progress {
  /** `${itemId}:${skill}` */
  id: string;
  itemId: string;
  skill: Skill;
  // FSRS memory state (dates stored as ISO strings)
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: 0 | 1 | 2 | 3; // New, Learning, Review, Relearning
  last_review?: string;
  // Additional learning statistics
  correct: number;
  wrong: number;
  skipped: number;
  totalResponseMs: number;
  answered: number;
  lastGrade?: Grade;
}

export interface ReviewLog {
  id?: number;
  itemId: string;
  skill: Skill;
  method: Method;
  topic: string;
  grade: Grade;
  /** Whether this answer changed the long-term schedule (see scheduler.ts). */
  scheduled: boolean;
  correct: boolean;
  responseMs: number;
  sessionId: string;
  ts: string;
  /** First ever answer for this item (counts towards "new per day"). */
  isNew?: boolean;
  /** Typed/recognised answer for weakness analysis (short, optional). */
  given?: string;
}

export interface StudySession {
  id: string;
  startedAt: string;
  endedAt?: string;
  /** Measured active time (idle gaps per card capped). */
  activeMs: number;
  topic: string;
  method: Method | 'auto';
  answered: number;
  correct: number;
}

export interface Category {
  id: string;
  name: string;
  builtin: boolean;
  description?: string;
  created_at: string;
}

export interface Collection {
  id: string;
  name: string;
  created_at: string;
}

export type ThemePref = 'system' | 'light' | 'dark';
export type UiLang = 'de' | 'en';
export type Accent = 'en-GB' | 'en-US';

export interface Settings {
  id: 'settings';
  uiLang: UiLang;
  theme: ThemePref;
  dailyGoalMin: number;
  defaultDurationMin: number;
  newPerDay: number;
  flashcardDirection: Direction | 'random';
  accent: Accent;
  voiceURI?: string;
  rate: number;
  repeatCount: number;
  pauseMs: number;
  autoPlayAudio: boolean;
  haptics: boolean;
  typoTolerance: boolean;
  gapDifficulty: 'easy' | 'medium' | 'hard';
  backupReminderDays: number;
  lastBackupAt?: string;
  lastMode?: { topic: string; method: Method | 'auto'; at: string };
  /**
   * Consent for browser speech recognition. The platform recogniser (Apple /
   * Google) may process the audio on its servers. undefined = not asked yet.
   */
  sttConsent?: 'granted' | 'denied';
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  uiLang: 'de',
  theme: 'system',
  dailyGoalMin: 15,
  defaultDurationMin: 15,
  newPerDay: 10,
  flashcardDirection: 'random',
  accent: 'en-GB',
  rate: 0.95,
  repeatCount: 1,
  pauseMs: 1500,
  autoPlayAudio: false,
  haptics: true,
  typoTolerance: true,
  gapDifficulty: 'medium',
  backupReminderDays: 7,
  onboarded: false,
};

/** A single exercise inside a study session. */
export interface Task {
  itemId: string;
  method: Method;
  skill: Skill;
  direction: Direction;
  /** true when this card is not due – practice must not inflate intervals. */
  practice: boolean;
  isNew: boolean;
}
