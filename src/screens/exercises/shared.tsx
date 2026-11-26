import { useEffect, useRef } from 'react';
import type { CheckNote, CheckResult } from '../../domain/answerCheck';
import type { DiffToken } from '../../domain/text';
import { shuffle } from '../../domain/text';
import type { Grade, Item, Progress, Settings, Task } from '../../domain/types';
import { useApp } from '../../state';
import { SpeakButton } from '../../ui/components';
import { pickVoice, speak } from '../../speech/tts';

export interface ExerciseProps {
  item: Item;
  task: Task;
  progress?: Progress;
  pool: Item[];
  settings: Settings;
  onDone: (grade: Grade, given?: string) => void;
}

export function DiffView({ diff, label }: { diff: DiffToken[]; label: string }) {
  return (
    <div className="diff" aria-label={label}>
      {diff.map((d, i) => {
        const text = d.kind === 'missing' ? d.expected : d.given;
        const title =
          d.kind === 'typo' ? `→ ${d.expected}` : d.kind === 'wrong' ? `→ ${d.expected}` : d.kind === 'missing' ? 'missing' : d.kind === 'extra' ? 'extra' : '';
        return (
          <span key={i} className={`d-${d.kind}`} title={title}>
            {text}
            {(d.kind === 'typo' || d.kind === 'wrong') && <span className="sr-only"> ({d.expected})</span>}
          </span>
        );
      })}
    </div>
  );
}

export function NotesView({ notes }: { notes: CheckNote[] }) {
  const { L } = useApp();
  const text: Record<CheckNote, string> = {
    case: L('Groß-/Kleinschreibung beachten.', 'Mind the capitalisation.'),
    punctuation: L('Satzzeichen weichen ab (nicht gewertet).', 'Punctuation differs (not counted).'),
    'missing-to': L('Bei Verben wird oft „to“ mitgelernt.', 'Verbs are often learned with "to".'),
    alternative: L('Alternative Antwort akzeptiert.', 'Alternative answer accepted.'),
    typo: L('Kleiner Tippfehler – als „Schwer“ gewertet.', 'Small typo – rated "Hard".'),
    article: L('Artikel fehlt (nicht gewertet).', 'Article missing (not counted).'),
  };
  if (!notes.length) return null;
  return (
    <ul className="small" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
      {notes.map((n) => (
        <li key={n}>{text[n]}</li>
      ))}
    </ul>
  );
}

export function ItemExtras({ item }: { item: Item }) {
  const { L } = useApp();
  return (
    <div className="stack small" style={{ gap: 6, marginTop: 8 }}>
      {item.example_en && (
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="grow">
            <div className="example" style={{ fontStyle: 'italic' }}>„{item.example_en}“</div>
            {item.example_de && <div className="muted tiny">{item.example_de}</div>}
          </div>
          <SpeakButton text={item.example_en} size={36} label={L('Beispiel vorlesen', 'Play example')} />
        </div>
      )}
      {item.common_mistake && (
        <div><span className="badge red">{L('Typischer Fehler', 'Common mistake')}</span> <span className="break">{item.common_mistake}</span></div>
      )}
      {item.explanation && <div className="muted break">{item.explanation}</div>}
    </div>
  );
}

export function FeedbackBox({ result, item, expected, onNext, onOverride, onAddAlternative, given }: {
  result: CheckResult;
  item: Item;
  expected: string;
  given: string;
  onNext: () => void;
  onOverride?: () => void;
  onAddAlternative?: () => void;
}) {
  const { L } = useApp();
  const head = {
    correct: L('Richtig!', 'Correct!'),
    almost: L('Fast richtig', 'Almost'),
    wrong: L('Leider falsch', 'Not quite'),
  }[result.verdict];
  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => nextRef.current?.focus(), []);
  return (
    <div className={`feedback ${result.verdict}`} role="status" aria-live="polite">
      <strong style={{ fontSize: 18 }}>{head}</strong>
      {result.verdict !== 'correct' && given && (
        <div style={{ marginTop: 8 }}>
          <div className="tiny muted">{L('Deine Antwort', 'Your answer')}</div>
          <DiffView diff={result.diff} label={L('Vergleich deiner Antwort', 'Comparison of your answer')} />
        </div>
      )}
      <div className="row" style={{ marginTop: 10 }}>
        <div className="grow">
          <div className="tiny muted">{L('Lösung', 'Solution')}</div>
          <div style={{ fontWeight: 700, fontSize: 19 }} className="break">{expected}</div>
          {result.target !== expected && result.verdict !== 'wrong' && <div className="tiny muted">{L('erkannt als', 'matched')}: {result.target}</div>}
        </div>
        <SpeakButton text={expected} />
      </div>
      <NotesView notes={result.notes} />
      <ItemExtras item={item} />
      <div className="stack" style={{ marginTop: 12 }}>
        <button ref={nextRef} className="btn block" onClick={onNext}>
          {L('Weiter', 'Next')}
        </button>
        {result.verdict !== 'correct' && onOverride && (
          <div className="row">
            <button className="btn small secondary grow" onClick={onOverride}>{L('War doch richtig', 'I was right')}</button>
            {onAddAlternative && given.trim() && (
              <button className="btn small secondary grow" onClick={onAddAlternative}>{L('Als Alternative speichern', 'Save as alternative')}</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Distractor options for multiple choice, preferring items of the same type. */
export function distractors(pool: Item[], item: Item, get: (i: Item) => string, n = 3): string[] {
  const correct = get(item).toLowerCase();
  const same = shuffle(pool.filter((p) => p.id !== item.id && p.type === item.type));
  const other = shuffle(pool.filter((p) => p.id !== item.id && p.type !== item.type));
  const out: string[] = [];
  for (const p of [...same, ...other]) {
    const v = get(p);
    if (!v || v.toLowerCase() === correct || out.some((o) => o.toLowerCase() === v.toLowerCase())) continue;
    out.push(v);
    if (out.length >= n) break;
  }
  return out;
}

export function useAutoSpeak(text: string, enabled: boolean, settings: Settings, deps: unknown[]) {
  const { voices } = useApp();
  useEffect(() => {
    if (!enabled || !text) return;
    const t = setTimeout(() => {
      speak(text, { lang: settings.accent, rate: settings.rate, voice: pickVoice(settings.accent, settings.voiceURI, voices) });
    }, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
