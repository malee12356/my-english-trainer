import { useMemo, useRef, useState } from 'react';
import { acceptedAnswers, checkAnswer, type CheckResult } from '../../domain/answerCheck';
import { gapSource } from '../../domain/planner';
import { shuffle } from '../../domain/text';
import { updateItem } from '../../db/repo';
import { useApp } from '../../state';
import { distractors, FeedbackBox, type ExerciseProps } from './shared';

function AnswerInput({ value, onChange, onSubmit, disabled, label, placeholder }: { value: string; onChange: (v: string) => void; onSubmit: () => void; disabled: boolean; label: string; placeholder: string }) {
  const { L } = useApp();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="stack"
    >
      <input
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={label}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="done"
        lang="en"
        autoFocus
        style={{ fontSize: 19, minHeight: 54 }}
      />
      {!disabled && (
        <button className="btn block big" type="submit" disabled={!value.trim()}>
          {L('Prüfen', 'Check')}
        </button>
      )}
    </form>
  );
}

/** Writing Mode: German prompt → type the English answer. */
export function Writing({ item, settings, onDone }: ExerciseProps) {
  const { L, bump, toast } = useApp();
  const [value, setValue] = useState('');
  const [result, setResult] = useState<CheckResult | null>(null);
  const [hint, setHint] = useState(false);
  const accepted = useMemo(() => acceptedAnswers(item, 'de-en'), [item]);

  const submit = () => {
    if (result) return;
    setResult(checkAnswer(value, accepted, { typoTolerance: settings.typoTolerance }));
  };
  const addAlternative = async () => {
    await updateItem(item.id, { alternatives_en: [...item.alternatives_en, value.trim()] });
    bump();
    toast(L('Als alternative Antwort gespeichert', 'Saved as alternative answer'));
    onDone(3, value);
  };

  return (
    <div className="stack">
      <div className="card center" style={{ padding: '24px 16px' }}>
        <span className="badge">Deutsch → English · {L('schreiben', 'write')}</span>
        <div className={`term ${item.german.length > 40 ? 'long' : ''}`} style={{ marginTop: 10 }} lang="de">{item.german}</div>
        {item.example_de && !hint && !result && (
          <button className="btn ghost small" onClick={() => setHint(true)}>{L('Hinweis zeigen', 'Show hint')}</button>
        )}
        {hint && !result && (
          <div className="small muted" style={{ marginTop: 6 }}>
            {item.example_de} · {L('beginnt mit', 'starts with')} „{item.english.replace(/^to\s+/i, '').charAt(0)}…“
          </div>
        )}
      </div>
      <AnswerInput value={value} onChange={setValue} onSubmit={submit} disabled={!!result} label={L('Englische Antwort', 'English answer')} placeholder={L('Auf Englisch eingeben …', 'Type in English …')} />
      {!result && (
        <button className="btn ghost block" onClick={() => setResult(checkAnswer('', accepted))}>{L('Weiß ich nicht', "I don't know")}</button>
      )}
      {result && (
        <FeedbackBox
          result={result}
          item={item}
          expected={item.english}
          given={value}
          onNext={() => onDone(result.grade, value)}
          onOverride={() => onDone(3, value)}
          onAddAlternative={value.trim() ? addAlternative : undefined}
        />
      )}
    </div>
  );
}

/** Gap fill with three difficulty levels (easy = choice, medium = hint, hard = no hint). */
export function GapFill({ item, settings, pool, onDone }: ExerciseProps) {
  const { L } = useApp();
  const src = useMemo(() => gapSource(item), [item]);
  const [value, setValue] = useState('');
  const [result, setResult] = useState<CheckResult | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const level = settings.gapDifficulty;
  const options = useMemo(() => {
    if (!src || level !== 'easy') return [];
    const others = distractors(pool, item, (i) => gapSource(i)?.answer ?? i.english.replace(/^to\s+/i, ''), 3);
    return shuffle([src.answer, ...others]);
  }, [src, level, pool, item]);
  const decided = useRef(false);
  if (!src) {
    // should not happen (planner checks eligibility) – fall back gracefully
    return <Writing item={item} settings={settings} pool={pool} onDone={onDone} task={{ itemId: item.id, method: 'writing', skill: 'writing', direction: 'de-en', practice: false, isNew: false }} />;
  }
  const translation = item.example_en && src.sentence === item.example_en ? item.example_de : src.sentence === item.english ? item.german : undefined;
  const check = (given: string) => {
    if (decided.current) return;
    decided.current = true;
    setResult(checkAnswer(given, [src.answer], { typoTolerance: settings.typoTolerance }));
  };
  const hintText = level === 'medium' ? `${src.answer.charAt(0)}${src.answer.slice(1).replace(/[A-Za-z]/g, '_')}` : '';

  return (
    <div className="stack">
      <div className="card" style={{ padding: '22px 16px' }}>
        <span className="badge">{L('Lückentext', 'Gap fill')} · {level === 'easy' ? L('leicht', 'easy') : level === 'medium' ? L('mittel', 'medium') : L('schwer', 'hard')}</span>
        <p style={{ fontSize: 21, lineHeight: 1.5, margin: '12px 0 6px' }} lang="en" className="break">
          {src.before}
          <span className="gap">{result ? src.answer : picked ?? (hintText || '      ')}</span>
          {src.after}
        </p>
        {translation && <div className="small muted">{translation}</div>}
        {!translation && <div className="small muted">{item.german}</div>}
      </div>
      {level === 'easy' ? (
        <div className="option-grid">
          {options.map((o) => {
            const state = result ? (o === src.answer ? 'correct' : o === picked ? 'wrong' : '') : '';
            return (
              <button key={o} className={`option ${state}`} disabled={!!result} onClick={() => { setPicked(o); check(o); }} lang="en">
                {o}
              </button>
            );
          })}
        </div>
      ) : (
        <AnswerInput value={value} onChange={setValue} onSubmit={() => check(value)} disabled={!!result} label={L('Fehlendes Wort', 'Missing word')} placeholder={L('Fehlendes Wort …', 'Missing word …')} />
      )}
      {result && (
        <FeedbackBox
          result={result}
          item={item}
          expected={src.answer}
          given={level === 'easy' ? picked ?? '' : value}
          onNext={() => onDone(result.grade, level === 'easy' ? picked ?? '' : value)}
          onOverride={level === 'easy' ? undefined : () => onDone(3, value)}
        />
      )}
    </div>
  );
}
