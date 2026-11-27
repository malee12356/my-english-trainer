import { useMemo } from 'react';
import { DEFAULT_CHALLENGE_WORDS, DEFAULT_MINUTES_PER_WORD, minutesEarnedToday, planChallenge } from '../../domain/challenge';
import { indexProgress } from '../../domain/planner';
import { navigate, useApp, useSnapshot } from '../../state';
import { detectSpeechCapabilities } from '../../speech/capabilities';
import { NavBar } from '../../ui/components';
import { RobotSays } from '../../ui/Robot';

export function ChallengeStart() {
  const { L, settings } = useApp();
  const snap = useSnapshot();
  const words = settings.challengeWords ?? DEFAULT_CHALLENGE_WORDS;
  const mpw = settings.minutesPerWord ?? DEFAULT_MINUTES_PER_WORD;
  const stt = detectSpeechCapabilities();
  const available = useMemo(() => (snap ? planChallenge(snap.items, indexProgress(snap.progress), new Date(), words).length : 0), [snap, words]);
  if (!snap) return <main className="page" aria-busy="true" />;
  const today = minutesEarnedToday(snap.sessions);
  const max = available * mpw;

  return (
    <main className="page">
      <NavBar title={L('Spielzeit verdienen', 'Earn screen time')} back="/home" />
      <div className="stack">
        <RobotSays mood="happy" stage={3}>
          {L(
            `Übe ${available} Wörter, die du noch nicht gut kannst. Für jedes richtige Wort bekommst du ${mpw === 1 ? '1 Minute' : `${mpw} Minuten`} Spielzeit – bis zu ${max} Minuten!`,
            `Practise ${available} words you don't know well yet. Every correct word earns ${mpw} min of screen time – up to ${max} minutes!`,
          )}
        </RobotSays>
        <div className="kid-card yellow">
          <strong>📏 {L('So geht’s', 'How it works')}</strong>
          <ul className="small" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            <li>{L('Du siehst das deutsche Wort und schreibst (oder sprichst) das englische.', 'You see the German word and write (or say) the English one.')}</li>
            <li>{L('Nur genau richtig zählt – Tippfehler geben keine Minute.', 'Only exactly right counts – typos earn no minute.')}</li>
            <li>{L('Am Ende kannst du dein Ergebnis per WhatsApp schicken.', 'At the end you can send your result via WhatsApp.')}</li>
          </ul>
        </div>
        {today > 0 && <div className="banner ok small">🎮 {L(`Heute schon verdient: ${today} Minuten`, `Earned today: ${today} minutes`)}</div>}
        {available === 0 ? (
          <div className="banner">{L('Super – gerade gibt es keine unsicheren Wörter. Lade neue Vokabeln oder lerne erst neue Wörter.', 'Great – no unsure words right now. Load or learn new words first.')}</div>
        ) : (
          <>
            <button className="btn block big" onClick={() => navigate('/session?mode=challenge&answer=writing')}>
              ✍️ {L('Mit Schreiben starten', 'Start with writing')}
            </button>
            <button className="btn block big secondary" disabled={!stt.recognitionUsable || settings.sttConsent === 'denied'} onClick={() => navigate('/session?mode=challenge&answer=speaking')}>
              🎙️ {L('Mit Sprechen starten', 'Start with speaking')}
            </button>
            {!stt.recognitionUsable && <p className="tiny muted center" style={{ margin: 0 }}>{L('Sprechen geht nur mit Internet und Spracherkennung.', 'Speaking needs internet and speech recognition.')}</p>}
          </>
        )}
      </div>
    </main>
  );
}
