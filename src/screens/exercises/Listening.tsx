import { useEffect, useMemo, useRef, useState } from 'react';
import { acceptedAnswers, checkAnswer, type CheckResult } from '../../domain/answerCheck';
import { shuffle, tokenize } from '../../domain/text';
import { useApp } from '../../state';
import { pickVoice, speak } from '../../speech/tts';
import { IconPlay } from '../../ui/icons';
import { distractors, FeedbackBox, ItemExtras, type ExerciseProps } from './shared';

/** Listening: English audio only → choose the translation or write what you hear. */
export function Listening({ item, settings, pool, onDone }: ExerciseProps) {
  const { L, voices } = useApp();
  const mode = useMemo<'choice' | 'dictation'>(() => (tokenize(item.english).length >= 3 && Math.random() < 0.5 ? 'dictation' : 'choice'), [item.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const options = useMemo(() => shuffle([item.german, ...distractors(pool, item, (i) => i.german, 3)]), [item, pool]);
  const [rate, setRate] = useState(settings.rate);
  const [playing, setPlaying] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [result, setResult] = useState<CheckResult | null>(null);
  const plays = useRef(0);

  const play = async (r = rate) => {
    setPlaying(true);
    plays.current++;
    await speak(item.english, { lang: settings.accent, rate: r, voice: pickVoice(settings.accent, settings.voiceURI, voices) });
    setPlaying(false);
  };
  useEffect(() => {
    const t = setTimeout(() => play(), 250);
    return () => clearTimeout(t);
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (o: string) => {
    if (picked) return;
    setPicked(o);
  };
  const choiceCorrect = picked === item.german;

  return (
    <div className="stack">
      <div className="card center" style={{ padding: '24px 16px' }}>
        <span className="badge">{mode === 'choice' ? L('Hören & verstehen', 'Listen & understand') : L('Hören & schreiben', 'Listen & write')}</span>
        <button className="btn big" style={{ margin: '16px auto 8px', width: 96, height: 96, borderRadius: 48 }} onClick={() => play()} aria-label={L('Abspielen', 'Play')} aria-pressed={playing}>
          <IconPlay size={36} />
        </button>
        <div className="row" style={{ justifyContent: 'center', gap: 6 }} role="group" aria-label={L('Geschwindigkeit', 'Speed')}>
          {[0.6, 0.8, 1].map((r) => (
            <button key={r} className="chip" aria-pressed={rate === r} onClick={() => { setRate(r); play(r); }}>
              {r === 1 ? '1×' : `${r}×`}
            </button>
          ))}
        </div>
        {(picked || result) && (
          <div style={{ marginTop: 12 }}>
            <div className="term long" lang="en">{item.english}</div>
            <div className="muted">{item.german}</div>
          </div>
        )}
      </div>

      {mode === 'choice' ? (
        <>
          <div className="option-grid">
            {options.map((o) => {
              const st = picked ? (o === item.german ? 'correct' : o === picked ? 'wrong' : '') : '';
              return (
                <button key={o} className={`option ${st}`} onClick={() => choose(o)} disabled={!!picked} lang="de">
                  {o}
                </button>
              );
            })}
          </div>
          {picked && (
            <div className={`feedback ${choiceCorrect ? 'correct' : 'wrong'}`} role="status">
              <strong>{choiceCorrect ? L('Richtig!', 'Correct!') : L('Leider falsch', 'Not quite')}</strong>
              <ItemExtras item={item} />
              <button className="btn block" style={{ marginTop: 12 }} autoFocus onClick={() => onDone(choiceCorrect ? (plays.current > 2 ? 2 : 3) : 1, picked)}>
                {L('Weiter', 'Next')}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); if (!result) setResult(checkAnswer(value, acceptedAnswers(item, 'de-en'), { typoTolerance: settings.typoTolerance })); }}>
            <input className="input" value={value} onChange={(e) => setValue(e.target.value)} disabled={!!result} aria-label={L('Was hörst du?', 'What do you hear?')} placeholder={L('Was hörst du? (Englisch)', 'What do you hear?')} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} lang="en" style={{ fontSize: 19, minHeight: 54 }} />
            {!result && <button className="btn block big" type="submit">{L('Prüfen', 'Check')}</button>}
          </form>
          {result && <FeedbackBox result={result} item={item} expected={item.english} given={value} onNext={() => onDone(result.grade, value)} onOverride={() => onDone(3, value)} />}
        </>
      )}
    </div>
  );
}
