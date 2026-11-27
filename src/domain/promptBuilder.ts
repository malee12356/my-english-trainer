/** Generates the copy-ready prompt for the user's ChatGPT English project. */
import { TOPIC_MODES } from './topics';
import type { CefrLevel } from './types';
import { gradeInfo, type GradeInfo, type KidGrade } from './grades';

export type ContentKind = 'vocabulary' | 'phrases' | 'sentences' | 'grammar' | 'mistakes' | 'technical' | 'booklist';

export const CONTENT_KINDS: { id: ContentKind; de: string; en: string }[] = [
  { id: 'vocabulary', de: 'Vokabeln', en: 'Vocabulary' },
  { id: 'phrases', de: 'Redewendungen', en: 'Phrases' },
  { id: 'sentences', de: 'Beispielsätze', en: 'Example sentences' },
  { id: 'grammar', de: 'Grammatik', en: 'Grammar' },
  { id: 'mistakes', de: 'Persönliche Fehler', en: 'Personal mistakes' },
  { id: 'technical', de: 'Technische Begriffe', en: 'Technical terms' },
  { id: 'booklist', de: 'Vokabelliste (Foto/Datei)', en: 'Word list (photo/file)' },
];

/** Content kinds offered per profile. */
export function contentKindsFor(audience: 'adult' | 'kid') {
  return CONTENT_KINDS.filter((k) => audience === 'adult' || k.id !== 'technical');
}

export interface PromptOptions {
  count: number;
  topic: string; // topic mode id or 'mixed'
  focusMethod: 'flashcards' | 'writing' | 'speaking' | 'listening' | 'mixed';
  level: CefrLevel | 'auto';
  kinds: ContentKind[];
  extraNote?: string;
  /** 'kid' = pupil (kids profile). */
  audience?: 'adult' | 'kid';
  /** School grade band for the kids profile. */
  grade?: KidGrade;
}

export const DEFAULT_PROMPT_OPTIONS: PromptOptions = {
  count: 30,
  topic: 'mixed',
  focusMethod: 'mixed',
  level: 'B1',
  kinds: ['vocabulary', 'phrases', 'sentences', 'mistakes'],
};

export const DEFAULT_KID_PROMPT_OPTIONS: PromptOptions = {
  count: 20,
  topic: 'mixed',
  focusMethod: 'mixed',
  level: 'auto',
  kinds: ['vocabulary', 'sentences', 'mistakes'],
  audience: 'kid',
};

const KIND_TEXT: Record<ContentKind, string> = {
  vocabulary: 'single words and collocations (type "word")',
  phrases: 'useful phrases and chunks (type "phrase")',
  sentences: 'complete, natural example sentences I can reuse when speaking (type "sentence")',
  grammar: 'grammar patterns with a short explanation (type "grammar")',
  mistakes:
    'corrections of mistakes I actually made in our past conversations or exercises in this project (type "correction", put the wrong version in "common_mistake")',
  technical: 'technical terms embedded in complete technical sentences (type "phrase" or "sentence")',
  booklist:
    'ALL entries of the vocabulary list, photo or file that I attach to this message or uploaded to this project (e.g. a page of my English book) – convert exactly those entries, do not add others',
};

const BOOK_RULES = `Rules for photos or pages of a school book / word list:
- Read the page number of every photo and put it into "page" (number only, e.g. 196).
- Detect unit headings (e.g. "Unit 3", "Welcome", "Lektion 2") and put them into "unit" (e.g. "Unit 3").
- A page WITHOUT a unit heading belongs to the last unit heading before it (by page number). Example: page 196 shows "Unit 1", pages 197 and 198 have no heading → also "Unit 1"; page 199 shows "Unit 2" → "Unit 2".
- If the book title is visible, put it into "book".
- Keep the order of the word list.`;

function kidKindText(k: ContentKind, g: GradeInfo): string {
  switch (k) {
    case 'vocabulary':
      return `single words from typical German school English books for years ${g.years} (type "word")`;
    case 'phrases':
      return 'useful phrases (type "phrase")';
    case 'sentences':
      return 'example sentences a pupil can say out loud (type "sentence")';
    case 'grammar':
      return `grammar patterns from years ${g.years} (e.g. ${g.grammar}) with a short explanation in German (type "grammar")`;
    case 'mistakes':
      return 'corrections of mistakes made in our previous conversations or exercises in this project (type "correction", wrong version in "common_mistake", explanation in simple German)';
    case 'booklist':
      return 'ALL entries of the vocabulary list, photo or file attached to this message or uploaded to this project (e.g. the word list of the current unit in the English book) – convert exactly those entries, do not add others';
    default:
      return '';
  }
}

const METHOD_TEXT: Record<PromptOptions['focusMethod'], string> = {
  mixed: 'a mix of flashcards, writing and speaking practice',
  flashcards: 'flashcard practice (short, clear translations)',
  writing: 'writing practice (precise spelling, list valid alternative answers)',
  speaking: 'speaking practice (natural spoken English, short sentences I can say out loud)',
  listening: 'listening practice (natural sentences that are good to hear)',
};

export function buildPrompt(o: PromptOptions): string {
  if (o.audience === 'kid') return buildKidPrompt(o);
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
- Do not include confidential company information, names of real colleagues, customers or children.${o.extraNote ? `\n- Additional wishes: ${o.extraNote.trim()}` : ''}${o.kinds.includes('booklist') ? `\n\n${BOOK_RULES}` : ''}

Output format – IMPORTANT:
Put the complete JSON array into ONE single code block marked as json (\`\`\`json … \`\`\`), with no other text inside the code block, so I can copy it with the code block's copy button. Each entry:
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
  "unit": "Unit 3 (only for school book / word list photos)",
  "page": 196,
  "book": "book title, if visible (optional)",
  "source": "chatgpt-project"
}

Rules:
- "english" and "german" are required; all other fields are optional – leave them out instead of guessing.
- Alternatives must be correct in exactly this context (no loose synonyms).
- Use straight double quotes and valid JSON (no comments, no trailing commas).
- Do not split the array into several code blocks.`;
}

const KID_TOPICS = TOPIC_MODES.filter((t) => t.audience === 'kid');

function buildKidPrompt(o: PromptOptions): string {
  const g = gradeInfo(o.grade);
  const topic = KID_TOPICS.find((t) => t.id === o.topic);
  const topicLine = topic
    ? `Topic: ${topic.name} – ${topic.description}. Use "${topic.name}" as category.`
    : `Topic: mixed – choose from ${KID_TOPICS.map((t) => `"${t.name}"`).join(', ')}. Use exactly these names as category values.`;
  const kinds = (o.kinds.length ? o.kinds : DEFAULT_KID_PROMPT_OPTIONS.kinds)
    .filter((k) => k !== 'technical')
    .map((k) => `- ${kidKindText(k, g)}`)
    .join('\n');
  const level = o.level === 'auto' ? `school years ${g.years} in Germany (about CEFR ${g.cefr})` : `CEFR level ${o.level} (school years ${g.years} in Germany)`;
  const count = Math.max(1, Math.min(200, Math.round(o.count)));

  return `Please create English learning content for a pupil (school years ${g.years} in Germany) for the Personal English Trainer app.

Use ONLY information you can actually access in this project (our previous conversations, exercises, corrections, word lists and files in this project). Do not invent personal facts. If there is not enough context, choose typical vocabulary from German school English books for years ${g.years} and mark it with "source": "general".

What I need:
- ${count} entries
- ${topicLine}
- Level: ${level}
- Focus: ${METHOD_TEXT[o.focusMethod]}
- Include:
${kinds}
- Prefer words and sentences that were difficult or wrong in our previous exercises.
- Child-friendly content only. No names of real people, no addresses, no school names.
- Explanations ("explanation") in short, simple German that a ${g.age}-year-old understands.${o.extraNote ? `\n- Additional wishes: ${o.extraNote.trim()}` : ''}${o.kinds.includes('booklist') ? `\n\n${BOOK_RULES}` : ''}

Output format – IMPORTANT:
Put the complete JSON array into ONE single code block marked as json (\`\`\`json … \`\`\`), with no other text inside the code block, so it can be copied with the code block's copy button. Each entry:
{
  "english": "English word, phrase or sentence",
  "german": "German translation",
  "type": "word | phrase | sentence | grammar | correction",
  "category": "${KID_TOPICS.map((t) => t.name).join(' | ')}",
  "level": "${g.levels.join(' | ')}",
  "example_en": "Short, simple English example sentence",
  "example_de": "German translation of the example",
  "alternatives_en": ["other correct English answers in THIS context only"],
  "alternatives_de": ["other correct German translations in THIS context only"],
  "common_mistake": "the wrong version (only for corrections)",
  "explanation": "very short explanation in simple German (optional)",
  "unit": "Unit 3 (only for school book / word list photos)",
  "page": 196,
  "book": "book title, if visible (optional)",
  "source": "chatgpt-project"
}

Rules:
- "english" and "german" are required; leave out other fields instead of guessing.
- For verbs write "to …" (e.g. "to read").
- British English spelling (as in German school books); American spelling may go into "alternatives_en".
- Use straight double quotes and valid JSON (no comments, no trailing commas).
- Do not split the array into several code blocks.`;
}
