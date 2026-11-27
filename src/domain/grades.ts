/** School grade bands for the kids/pupils profile. */
import type { CefrLevel } from './types';

export type KidGrade = '5-6' | '7-8' | '9-10';

export interface GradeInfo {
  id: KidGrade;
  years: string;
  de: string;
  en: string;
  cefr: string;
  levels: CefrLevel[];
  age: number;
  grammar: string;
  /** Source tag of this grade's default vocabulary pack. */
  source: string;
}

export const KID_GRADES: GradeInfo[] = [
  {
    id: '5-6', years: '5–6', de: 'Klasse 5–6', en: 'Years 5–6', cefr: 'A1–A2', levels: ['A1', 'A2', 'B1'], age: 11,
    grammar: 'simple present, have got, can, plural, possessive pronouns',
    source: 'starter-kids',
  },
  {
    id: '7-8', years: '7–8', de: 'Klasse 7–8', en: 'Years 7–8', cefr: 'A2–B1', levels: ['A2', 'B1', 'B2'], age: 13,
    grammar: 'simple past, present perfect, going to / will, comparatives and superlatives, adverbs',
    source: 'starter-kids-7-8',
  },
  {
    id: '9-10', years: '9–10', de: 'Klasse 9–10', en: 'Years 9–10', cefr: 'B1–B2', levels: ['B1', 'B2', 'C1'], age: 15,
    grammar: 'passive, if-clauses (types 1–3), reported speech, gerund and infinitive, relative clauses',
    source: 'starter-kids-9-10',
  },
];

export function gradeInfo(g: KidGrade | undefined): GradeInfo {
  return KID_GRADES.find((x) => x.id === g) ?? KID_GRADES[0];
}

/** Every source tag that belongs to a kids default vocabulary pack. */
export const KID_STARTER_SOURCES = KID_GRADES.map((g) => g.source);
