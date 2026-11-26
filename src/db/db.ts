/**
 * IndexedDB schema (Dexie). Every schema change gets a NEW version number with
 * an upgrade function – existing data must survive app updates. Never edit an
 * existing version block; add a new one instead (see ARCHITECTURE.md).
 */
import Dexie, { type Table } from 'dexie';
import { itemKey } from '../domain/text';
import type { Category, Collection, Item, Progress, ReviewLog, Settings, StudySession } from '../domain/types';

export const DB_NAME = 'personal-english-trainer';

export class TrainerDB extends Dexie {
  items!: Table<Item, string>;
  progress!: Table<Progress, string>;
  reviewLogs!: Table<ReviewLog, number>;
  sessions!: Table<StudySession, string>;
  categories!: Table<Category, string>;
  collections!: Table<Collection, string>;
  settings!: Table<Settings, string>;

  constructor(name = DB_NAME) {
    super(name);
    // v1 – initial schema
    this.version(1).stores({
      items: 'id, english, *categories, *tags, level, type, created_at, updated_at',
      progress: 'id, itemId, skill, due',
      reviewLogs: '++id, itemId, ts, sessionId',
      sessions: 'id, startedAt',
      categories: 'id',
      collections: 'id',
      settings: 'id',
    });
    // v2 – duplicate-detection key, external ids, favourites/archive flags
    this.version(2)
      .stores({
        items: 'id, key, externalId, english, *categories, *tags, *collections, level, type, created_at, updated_at',
        progress: 'id, itemId, skill, due, [skill+due]',
      })
      .upgrade(async (tx) => {
        await tx
          .table('items')
          .toCollection()
          .modify((it: Partial<Item> & { english: string }) => {
            it.key = itemKey(it.english);
            it.favorite ??= false;
            it.archived ??= false;
            it.collections ??= [];
            it.alternatives_en ??= [];
            it.alternatives_de ??= [];
            it.examples ??= [];
            it.tags ??= [];
            it.categories ??= [];
            it.schemaVersion ??= 1;
          });
      });
  }
}

export const CURRENT_DB_VERSION = 2;

let instance: TrainerDB | null = null;
export function db(): TrainerDB {
  if (!instance) instance = new TrainerDB();
  return instance;
}
/** For tests: use a fresh, isolated database. */
export function setDbForTests(d: TrainerDB | null): void {
  instance = d;
}
