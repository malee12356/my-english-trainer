import { useMemo, useState } from 'react';
import { builderSource } from '../../domain/planner';
import { normalize, shuffle, wordDiff } from '../../domain/text';
import { useApp } from '../../state';
import { SpeakButton } from '../../ui/components';
import { DiffView, ItemExtras, type ExerciseProps } from './shared';

interface Chip {
  id: number;
  text: string;
}

/** Sentence Builder: put the shuffled words into the right order. */
export function Builder({ item, onDone }: ExerciseProps) {
  const { L, haptic } = useApp();
  const src = useMemo(() => builderSource(item), [item]);
  const { chips, endPunct } = useMemo(() => {
    const s = (src?.sentence ?? item.english).trim();
    const m = s.match(/[.!?…]+$/);
    const body = m ? s.slice(0, -m[0].length) : s;
    const words = body.split(/\s+/).map((text, id) => ({ id, text }));
    let sh = shuffle(words);
    for (let i = 0; i < 5 && sh.map((c) => c.id).join() === words.map((c) => c.id).join() && words.length > 1; i++) sh = shuffle(words);
    return { chips: sh, endPunct: m?.[0] ?? '' };
  }, [src, item.english]);
  const [placed, setPlaced] = useState<Chip[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [state, setState] = useState<'open' | 'correct' | 'wrong'>('open');
  const target = (src?.sentence ?? item.english).trim();
  const answer = placed.map((c) => c.text).join(' ') + endPunct;
  const remaining = chips.filter((c) => !placed.some((p) => p.id === c.id));

  const check = () => {
    const ok = normalize(answer) === normalize(target);
    setAttempts((a) => a + 1);
    setState(ok ? 'correct' : 'wrong');
    haptic();
  };

  return (
    <div className="stack">
      <div className="card center">
        <span className="badge">{L('Satzbau', 'Sentence builder')}</span>
        <div style={{ fontSize: 19, fontWeight: 650, marginTop: 10 }} lang="de" className="break">{src?.german ?? item.german}</div>
      </div>
      <div className="answer-line" aria-label={L('Deine Antwort', 'Your answer')} aria-live="polite">
        {placed.length === 0 && <span className="muted small">{L('Wörter antippen …', 'Tap the words …')}</span>}
        {placed.map((c) => (
          <button key={c.id} className="word-chip placed" disabled={state === 'correct'} onClick={() => { setPlaced(placed.filter((p) => p.id !== c.id)); setState('open'); }} lang="en">
            {c.text}
          </button>
        ))}
        {placed.length > 0 && endPunct && <span style={{ fontSize: 20 }}>{endPunct}</span>}
      </div>
      <div className="word-bank" aria-label={L('Verfügbare Wörter', 'Available words')}>
        {remaining.map((c) => (
          <button key={c.id} className="word-chip" onClick={() => { setPlaced([...placed, c]); setState('open'); }} lang="en">
            {c.text}
          </button>
        ))}
      </div>
      {state === 'open' && (
        <div className="row">
          <button className="btn secondary" onClick={() => { setPlaced([]); }} disabled={!placed.length}>{L('Zurücksetzen', 'Reset')}</button>
          <button className="btn grow" onClick={check} disabled={remaining.length > 0}>{L('Prüfen', 'Check')}</button>
        </div>
      )}
      {state !== 'open' && (
        <div className={`feedback ${state === 'correct' ? 'correct' : 'wrong'}`} role="status">
          <strong style={{ fontSize: 18 }}>{state === 'correct' ? L('Richtig!', 'Correct!') : L('Noch nicht ganz', 'Not quite')}</strong>
          {state === 'wrong' && <DiffView diff={wordDiff(answer, target)} label={L('Vergleich', 'Comparison')} />}
          <div className="row" style={{ marginTop: 10 }}>
            <div className="grow" style={{ fontWeight: 700 }} lang="en">{state === 'correct' || attempts >= 2 ? target : '…'}</div>
            {(state === 'correct' || attempts >= 2) && <SpeakButton text={target} />}
          </div>
          {state === 'correct' && <ItemExtras item={item} />}
          <div className="stack" style={{ marginTop: 10 }}>
            {state === 'wrong' && attempts < 2 && (
              <button className="btn block secondary" onClick={() => setState('open')}>{L('Nochmal versuchen', 'Try again')}</button>
            )}
            {(state === 'correct' || attempts >= 2) && (
              <button className="btn block" onClick={() => onDone(state === 'correct' ? (attempts === 1 ? 3 : 2) : 1, answer)}>{L('Weiter', 'Next')}</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
