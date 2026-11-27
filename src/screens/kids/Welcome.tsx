import { useState } from 'react';
import { chooseProfile, saveSettings } from '../../db/repo';
import { navigate } from '../../state';
import { Robot } from '../../ui/Robot';

/** First start of an empty app: who is learning? (adult vs. kid profile) */
export function Welcome({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const choose = async (p: 'adult' | 'kid') => {
    setBusy(true);
    await chooseProfile(p);
    onDone();
  };
  return (
    <main className="page no-tabbar">
      <div className="center" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Robot mood="happy" stage={2} size={110} label="Robo" />
        </div>
        <h1 className="large-title">Hallo! 👋</h1>
        <p className="subtitle">Wer lernt mit dieser App?</p>
      </div>
      <div className="stack">
        <button className="welcome-choice kid-card purple" disabled={busy} onClick={() => choose('kid')}>
          <span style={{ fontSize: 40 }} aria-hidden="true">🎒</span>
          <span className="grow">
            <strong style={{ display: 'block', fontSize: 19 }}>Für Kinder (Klasse 5–6)</strong>
            <span className="small muted">Bunt, mit Roboter Robo, Sternen, Levels und Abzeichen. Wörter aus Schule, Familie, Tieren und Alltag.</span>
          </span>
        </button>
        <button className="welcome-choice card" disabled={busy} onClick={() => choose('adult')}>
          <span style={{ fontSize: 40 }} aria-hidden="true">💼</span>
          <span className="grow">
            <strong style={{ display: 'block', fontSize: 19 }}>Für Erwachsene</strong>
            <span className="small muted">Alltag, Beruf, Meetings, Technik und Handball-Coaching.</span>
          </span>
        </button>
        <button
          className="btn block ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            // restoring a backup replaces everything – no default vocabulary needed
            await saveSettings({ profile: 'adult', profileChosen: true, starterAutoLoaded: true });
            navigate('/backup', true);
            onDone();
          }}
        >
          💾 Ich habe ein Backup – wiederherstellen
        </button>
        <p className="tiny muted center">Das lässt sich später in den Einstellungen ändern. Alle Daten bleiben auf diesem Gerät.</p>
      </div>
    </main>
  );
}
