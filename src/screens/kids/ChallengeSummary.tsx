import { useState } from 'react';
import { challengeShareText, type ChallengeResult } from '../../domain/challenge';
import { useApp } from '../../state';
import { copyText } from '../../ui/files';
import { RobotSays } from '../../ui/Robot';
import { shareResult, whatsappUrl } from '../../ui/share';
import { Confetti } from './KidParts';

/** End of the screen-time challenge: earned minutes + share with a parent. */
export function ChallengeSummary({ result, onDone }: { result: ChallengeResult; onDone: () => void }) {
  const { L, toast } = useApp();
  const [shared, setShared] = useState(false);
  const text = challengeShareText(result);
  const great = result.correct >= result.total * 0.7;

  const share = async () => {
    const r = await shareResult(result);
    if (r === 'shared') {
      setShared(true);
      toast(L('Geteilt ✓', 'Shared ✓'));
    } else if (r === 'unsupported') {
      toast((await copyText(text)) ? L('Text kopiert – jetzt in WhatsApp einfügen', 'Text copied – paste it in WhatsApp') : L('Teilen nicht möglich', 'Sharing not possible'));
    }
  };

  return (
    <div className="stack" style={{ marginTop: 12 }}>
      {result.minutes > 0 && <Confetti />}
      <RobotSays mood={great ? 'cheer' : 'encourage'} stage={3}>
        {result.minutes > 0
          ? L(`Super! Du hast ${result.minutes} Minuten Spielzeit verdient! 🎮`, `Great! You earned ${result.minutes} minutes of screen time! 🎮`)
          : L('Diesmal noch keine Minuten – probier es gleich nochmal! 💪', 'No minutes this time – try again! 💪')}
      </RobotSays>

      <div className="hero center" aria-label={L('Ergebnis', 'Result')}>
        <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1 }}>🎮 {result.minutes} min</div>
        <div style={{ fontSize: 20, fontWeight: 750, marginTop: 8 }}>
          {L(`${result.correct} von ${result.total} Wörtern richtig`, `${result.correct} of ${result.total} words correct`)}
        </div>
        <div className="muted small">{result.finishedAt.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}</div>
      </div>

      <button className="btn block big" onClick={share}>
        📤 {L('Fortschritt teilen', 'Share progress')}
      </button>
      <a className="btn block secondary" href={whatsappUrl(text)} target="_blank" rel="noopener noreferrer">
        💬 {L('Per WhatsApp senden', 'Send via WhatsApp')}
      </a>
      {shared && <p className="small muted center" style={{ margin: 0 }}>{L('Jetzt auf die Freigabe der Spielzeit warten 😉', 'Now wait for your screen time to be unlocked 😉')}</p>}

      {result.wrong.length > 0 && (
        <section className="card" aria-label={L('Diese Wörter üben wir noch', 'Words to practise')}>
          <h3>📝 {L('Diese Wörter üben wir noch', 'Words to practise')}</h3>
          <div className="list" style={{ boxShadow: 'none', background: 'var(--surface-2)' }}>
            {result.wrong.map((w) => (
              <div key={w.english} className="list-item">
                <span className="main">
                  <span className="primary" style={{ display: 'block' }} lang="en">{w.english}</span>
                  <span className="secondary" lang="de">{w.german}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
      <button className="btn block secondary" onClick={onDone}>{L('Fertig', 'Done')}</button>
    </div>
  );
}
