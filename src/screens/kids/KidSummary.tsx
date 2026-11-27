import { useEffect, useMemo, useState } from 'react';
import { loadSnapshot, type Snapshot } from '../../db/repo';
import { BADGES, sessionStars } from '../../domain/gamification';
import { useApp } from '../../state';
import { RobotSays } from '../../ui/Robot';
import { BackupNudge } from '../../ui/BackupNudge';
import { BadgeGrid, Confetti, LevelCard, useKidProgress } from './KidParts';

/** End-of-session celebration for kids: stars, XP, level-up, new badges. */
export function KidSummary({ before, answered, correct, xpGained, onDone }: { before: Snapshot; answered: number; correct: number; xpGained: number; onDone: () => void }) {
  const { L, lang } = useApp();
  const [after, setAfter] = useState<Snapshot | null>(null);
  useEffect(() => {
    loadSnapshot().then(setAfter);
  }, []);
  const kpBefore = useKidProgress(before);
  const kpAfter = useKidProgress(after);
  const stars = sessionStars(answered, correct);
  const newBadges = useMemo(() => {
    if (!kpBefore || !kpAfter) return [];
    return BADGES.filter((b) => b.earned(kpAfter.stats) && !b.earned(kpBefore.stats)).map((b) => b.id);
  }, [kpBefore, kpAfter]);
  const levelUp = kpBefore && kpAfter && kpAfter.level.level > kpBefore.level.level;
  const msg =
    stars === 3
      ? L('Fantastisch! Fast alles richtig! 🤩', 'Fantastic! Almost everything right! 🤩')
      : stars === 2
        ? L('Gut gemacht! Weiter so! 😃', 'Well done! Keep it up! 😃')
        : L('Toll, dass du geübt hast! Beim nächsten Mal klappt noch mehr. 💪', 'Great that you practised! Next time even more will work. 💪');

  return (
    <div className="stack" style={{ marginTop: 12 }}>
      {stars >= 2 && <Confetti />}
      <RobotSays mood={stars >= 2 ? 'cheer' : 'encourage'} stage={kpAfter?.stage.stage ?? kpBefore?.stage.stage ?? 1}>
        {msg}
      </RobotSays>
      <div className="card center">
        <div className="stars" role="img" aria-label={L(`${stars} von 3 Sternen`, `${stars} of 3 stars`)}>
          {[1, 2, 3].map((i) => (
            <span key={i} className={`star ${i <= stars ? 'on' : ''}`} aria-hidden="true">⭐</span>
          ))}
        </div>
        <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
          <span className="xp-pill xp-pop">+{xpGained} XP</span>
          <span className="small muted">{correct}/{answered} {L('richtig', 'correct')}</span>
        </div>
      </div>
      {levelUp && kpAfter && (
        <div className="kid-card yellow center" role="status">
          <div style={{ fontSize: 34 }} aria-hidden="true">🆙</div>
          <strong style={{ fontSize: 20 }}>{L(`Level ${kpAfter.level.level} erreicht!`, `Level ${kpAfter.level.level} reached!`)}</strong>
          {kpBefore && kpAfter.stage.stage > kpBefore.stage.stage && (
            <div className="small">{L(`Robo ist gewachsen: ${kpAfter.stage.nameDe}!`, `Robo has grown: ${kpAfter.stage.nameEn}!`)}</div>
          )}
        </div>
      )}
      {kpAfter && <LevelCard kp={kpAfter} mood={stars >= 2 ? 'cheer' : 'happy'} />}
      {kpAfter && newBadges.length > 0 && (
        <section className="stack" aria-label={L('Neue Abzeichen', 'New badges')}>
          <h2 className="section-title" style={{ margin: '8px 4px 0' }}>🏅 {L('Neues Abzeichen!', 'New badge!')}</h2>
          <BadgeGrid stats={kpAfter.stats} highlight={newBadges} />
          <p className="tiny muted" style={{ margin: 0 }}>{newBadges.map((id) => BADGES.find((b) => b.id === id)).map((b) => (lang === 'de' ? b?.de : b?.en)).join(', ')}</p>
        </section>
      )}
      <BackupNudge />
      <button className="btn block big" onClick={onDone}>{L('Fertig', 'Done')}</button>
      <a className="btn block secondary" href="#/learn">{L('Noch eine Runde', 'One more round')}</a>
    </div>
  );
}
