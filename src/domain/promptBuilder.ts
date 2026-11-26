/** Generates the copy-ready prompt for the user's ChatGPT English project. */
import { TOPIC_MODES } from './topics';
import type { CefrLevel } from './types';

export type ContentKind = 'vocabulary' | 'phrases' | 'sentences' | 'grammar' | 'mistakes' | 'technical';

export const CONTENT_KINDS: { id: ContentKind; de: string; en: string }[] = [
  { id: 'vocabulary', de: 'Vokabeln', en: 'Vocabulary' },
  { id: 'phrases', de: 'Redewendungen', en: 'Phrases' },
  { id: 'sentences', de: 'Beispielsätze', en: 'Example sentences' },
  { id: 'grammar', de: 'Grammatik', en: 'Grammar' },
  { id: 'mistakes', de: 'Persönliche Fehler', en: 'Personal mistakes' },
  { id: 'technical', de: 'Technische Begriffe', en: 'Technical terms' },
];

export interface PromptOptions {
  count: number;
  topic: string; // topic mode id or 'mixed'
  focusMethod: 'flashcards' | 'writing' | 'speaking' | 'listening' | 'mixed';
  level: CefrLevel | 'auto';
  kinds: ContentKind[];
  extraNote?: string;
}

export const DEFAULT_PROMPT_OPTIONS: PromptOptions = {
  count: 30,
  topic: 'mixed',
  focusMethod: 'mixed',
  level: 'B1',
  kinds: ['vocabulary', 'phrases', 'sentences', 'mistakes'],
};

const KIND_TEXT: Record<ContentKind, string> = {
  vocabulary: 'single words and collocations (type "word")',
  phrases: 'useful phrases and chunks (type "phrase")',
  sentences: 'complete, natural example sentences I can reuse when speaking (type "sentence")',
  grammar: 'grammar patterns with a short explanation (type "grammar")',
  mistakes:
    'corrections of mistakes I actually made in our past conversations or exercises in this project (type "correction", put the wrong version in "common_mistake")',
  technical: 'technical terms embedded in complete technical sentences (type "phrase" or "sentence")',
};

const METHOD_TEXT: Record<PromptOptions['focusMethod'], string> = {
  mixed: 'a mix of flashcards, writing and speaking practice',
  flashcards: 'flashcard practice (short, clear translations)',
  writing: 'writing practice (precise spelling, list valid alternative answers)',
  speaking: 'speaking practice (natural spoken English, short sentences I can say out loud)',
  listening: 'listening practice (natural sentences that are good to hear)',
};

export function buildPrompt(o: PromptOptions): string {
  const topic = TOPIC_MODES.find((t) => t.id === o.topic);
  const topicLine = topic
    ? `Topic: ${topic.name} – ${topic.description}. Use "${topic.name}" as category.`
    : `Topic: mixed – choose from Everyday English, Business English, Engineering Mode, Meeting Mode and Handball Mode, whatever is most relevant for me. Use exactly these names as category values.`;
  const kinds = (o.kinds.length ? o.kinds : DEFAULT_PROMPT_OPTIONS.kinds).map((k) => `- ${KIND_TEXT[k]}`).join('\n');
  const level = o.level === 'auto' ? 'my current level (around A2–B1, target B2)' : `CEFR level ${o.level} (I am around A2–B1 and want to reach B2)`;
  const count = Math.max(1, Math.min(200, Math.round(o.count)));

  return `Please create learning content for my Personal English Trainer app.

Use ONLY information you can actually access in this project (our previous conversations, exercises, corrections and files in this project). Do not invent personal facts about me. If you do not have enough personal context, choose generally useful content for the topic and mark it with "source": "general".

What I need:
- ${count} entries
- ${topicLine}
- Level: ${level}
- Focus: ${METHOD_TEXT[o.focusMethod]}
- Include:
${kinds}
- Prioritise words, phrases and structures that I was missing, used incorrectly or hesitated with in our past conversations.
- Prefer complete, reusable sentences over isolated words, especially for meetings and technical discussions.
- Do not include confidential company information, names of real colleagues, customers or children.${o.extraNote ? `\n- Additional wishes: ${o.extraNote.trim()}` : ''}

Output format – IMPORTANT:
Return ONLY a JSON array (no explanation before or after), so I can save it as a .json file or paste it directly. Each entry:
{
  "english": "English word, phrase or sentence",
  "german": "German translation",
  "type": "word | phrase | sentence | grammar | correction",
  "category": "Everyday English | Business English | Engineering Mode | Meeting Mode | Handball Mode",
  "level": "A2 | B1 | B2 | C1",
  "example_en": "Natural English example sentence",
  "example_de": "German translation of the example",
  "alternatives_en": ["other correct English answers in THIS context only"],
  "alternatives_de": ["other correct German translations in THIS context only"],
  "ipa": "/IPA transcription/ (only for single words or short phrases, optional)",
  "common_mistake": "the wrong version I used (only for corrections)",
  "explanation": "short explanation in German why/when to use it (optional)",
  "tags": ["short", "keywords"],
  "source": "chatgpt-project"
}

Rules:
- "english" and "german" are required; all other fields are optional – leave them out instead of guessing.
- Alternatives must be correct in exactly this context (no loose synonyms).
- Use straight double quotes and valid JSON (no comments, no trailing commas).`;
}
