import type { Category } from './types';

export interface TopicMode {
  id: string;
  name: string;
  nameDe: string;
  emoji: string;
  description: string;
  descriptionDe: string;
  /** Aliases (lower-case) that map an imported "category" string to this mode. */
  aliases: string[];
}

/** Built-in topic modes. They are categories, so items can belong to several. */
export const TOPIC_MODES: TopicMode[] = [
  {
    id: 'everyday',
    name: 'Everyday English',
    nameDe: 'Everyday English',
    emoji: '☕',
    description: 'Family, shopping, travel, small talk, opinions and feelings',
    descriptionDe: 'Familie, Einkaufen, Reisen, Small Talk, Meinungen, Gefühle',
    aliases: ['everyday', 'everyday english', 'everyday mode', 'alltag', 'daily life', 'small talk', 'general'],
  },
  {
    id: 'business',
    name: 'Business English',
    nameDe: 'Business English',
    emoji: '💼',
    description: 'Explaining tasks, e-mails, problems, decisions, suggestions',
    descriptionDe: 'Aufgaben erklären, E-Mails, Probleme, Entscheidungen, Vorschläge',
    aliases: ['business', 'business english', 'business mode', 'beruf', 'work', 'office', 'email', 'e-mail'],
  },
  {
    id: 'engineering',
    name: 'Engineering Mode',
    nameDe: 'Engineering Mode',
    emoji: '⚙️',
    description: 'Structural mechanics, FEM, simulation, validation, results',
    descriptionDe: 'Strukturmechanik, FEM, Simulation, Validierung, Ergebnisse',
    aliases: [
      'engineering', 'engineering mode', 'engineering english', 'technical', 'technical english',
      'fem', 'simulation', 'structural mechanics', 'technik',
    ],
  },
  {
    id: 'meeting',
    name: 'Meeting Mode',
    nameDe: 'Meeting Mode',
    emoji: '🗣️',
    description: 'Opening meetings, presenting, clarifying, agreeing, disagreeing',
    descriptionDe: 'Meetings eröffnen, präsentieren, nachfragen, zustimmen, widersprechen',
    aliases: ['meeting', 'meetings', 'meeting mode', 'meeting english', 'presentation', 'presentations', 'discussion'],
  },
  {
    id: 'handball',
    name: 'Handball Mode',
    nameDe: 'Handball Mode',
    emoji: '🤾',
    description: 'Coaching, drills, tactics, defence, feedback for young players',
    descriptionDe: 'Coaching, Übungen, Taktik, Abwehr, Feedback für Jugendliche',
    aliases: ['handball', 'handball mode', 'coaching', 'sport', 'sports', 'training'],
  },
];

export const SPECIAL_TOPICS = {
  all: 'all',
  weakness: 'weakness',
} as const;

export function builtinCategories(now = new Date().toISOString()): Category[] {
  return TOPIC_MODES.map((t) => ({
    id: t.id,
    name: t.name,
    builtin: true,
    description: t.description,
    created_at: now,
  }));
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Map a free-text category from an import to a category id.
 * Known topic modes are matched via aliases, everything else gets a stable
 * custom id (`c-<slug>`), which is created on import if missing.
 */
export function resolveCategoryId(raw: string): { id: string; name: string; builtin: boolean } | null {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name) return null;
  const lower = name.toLowerCase();
  for (const t of TOPIC_MODES) {
    if (t.id === lower || t.aliases.includes(lower)) return { id: t.id, name: t.name, builtin: true };
  }
  const slug = slugify(name);
  if (!slug) return null;
  return { id: `c-${slug}`, name: name.slice(0, 60), builtin: false };
}

export function topicLabel(id: string, categories: Category[], lang: 'de' | 'en'): string {
  if (id === 'all') return lang === 'de' ? 'Alle Themen' : 'All topics';
  if (id === 'weakness') return 'Personal Weakness Mode';
  const t = TOPIC_MODES.find((m) => m.id === id);
  if (t) return lang === 'de' ? t.nameDe : t.name;
  return categories.find((c) => c.id === id)?.name ?? id;
}
