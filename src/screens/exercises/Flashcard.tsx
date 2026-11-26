import { useEffect, useMemo, useState } from 'react';
import { formatInterval, newProgress, previewIntervals } from '../../domain/scheduler';
import type { Grade } from '../../domain/types';
import { useApp } from '../../state';
import { SpeakButton } from '../../ui/components';
import { ItemExtras, useAutoSpeak, type ExerciseProps } from './shared';

export function Flashcard({ item, task, progress, settings, onDone }: ExerciseProps) {
  const { L, lang, haptic } = useApp();
  const [flipped, setFlipped] = useState(false);
  const enFront = task.direction === 'en-de';
  const front = enFront ? item.english : item.german;
  const back = enFront ? item.german : item.english;
  const alts = enFront ? item.alternatives_de : item.alternatives_en;

  const intervals = useMemo(() => {
    try {
      return previewIntervals(progress ?? newProgress(item.id, task.skill, new Date()), new Date());
    } catch {
      return null;
    }
  }, [progress, item.id, task.skill]);

  useAutoSpeak(item.english, settings.autoPlayAudio && (enFront ? !flipped : flipped), settings, [flipped, item.id]);

  const flip = () => {
    setFlipped((f) => !f);
    haptic();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        flip();
      } else if (flipped && ['1', '2', '3', '4'].includes(e.key)) onDone(Number(e.key) as Grade);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const grades: { g: Grade; de: string; en: string }[] = [
    { g: 1, de: 'Nicht gewusst', en: 'Again' },
    { g: 2, de: 'Schwer', en: 'Hard' },
    { g: 3, de: 'Gut', en: 'Good' },
    { g: 4, de: 'Einfach', en: 'Easy' },
  ];
  const long = (s: string) => s.length > 40;

  return (
    <div>
      <div
        className={`flashcard ${flipped ? 'flipped' : ''}`}
        onClick={flip}
        role="button"
        tabIndex={0}
        aria-label={flipped ? L('Karte umdrehen (Vorderseite)', 'Flip card (front)') : L('Karte umdrehen und Lösung zeigen', 'Flip card to reveal answer')}
        aria-pressed={flipped}
      >
        <div className="flashcard-inner">
          <div className="face front" aria-hidden={flipped}>
            <span className="badge">{enFront ? 'English → Deutsch' : 'Deutsch → English'}</span>
            <div className={`term ${long(front) ? 'long' : ''}`} lang={enFront ? 'en' : 'de'}>{front}</div>
            {enFront && <SpeakButton text={item.english} />}
            {!enFront && item.type !== 'word' && <span className="hint-line">{item.type}</span>}
            <span className="hint-line">{L('Tippen zum Umdrehen', 'Tap to flip')}</span>
          </div>
          <div className="face back" aria-hidden={!flipped}>
            <div className="small muted break" lang={enFront ? 'en' : 'de'}>{front}</div>
            <div className={`term ${long(back) ? 'long' : ''}`} lang={enFront ? 'de' : 'en'}>{back}</div>
            {!enFront && <SpeakButton text={item.english} />}
            {item.ipa && <div className="ipa">{item.ipa}</div>}
            {alts.length > 0 && (
              <div className="small muted break">
                {L('auch', 'also')}: {alts.join(' · ')}
              </div>
            )}
            <div style={{ width: '100%', textAlign: 'left' }} onClick={(e) => e.stopPropagation()}>
              <ItemExtras item={item} />
            </div>
          </div>
        </div>
      </div>

      {flipped ? (
        <div className="grade-grid" role="group" aria-label={L('Wie gut wusstest du es?', 'How well did you know it?')}>
          {grades.map(({ g, de, en }) => (
            <button key={g} className={`grade-btn g${g}`} onClick={() => onDone(g)}>
              {lang === 'de' ? de : en}
              {intervals && <small>{formatInterval(intervals[g], lang)}</small>}
            </button>
          ))}
        </div>
      ) : (
        <button className="btn block big secondary" style={{ marginTop: 14 }} onClick={flip}>
          {L('Lösung zeigen', 'Show answer')}
        </button>
      )}
      {task.practice && <p className="tiny muted center">{L('Zusatzübung – verändert den Wiederholungsplan nur bei Fehlern.', 'Extra practice – only changes the schedule if you get it wrong.')}</p>}
    </div>
  );
}
