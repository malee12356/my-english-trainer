import { useState } from 'react';
import { decodeSetup } from '../../domain/parental';
import { SetupCodeSheet } from '../parent/ParentUI';
import { chooseProfile, saveSettings } from '../../db/repo';
import { navigate } from '../../state';
import { Robot } from '../../ui/Robot';
import { KID_GRADES, type KidGrade } from '../../domain/grades';

/** First start of an empty app: who is learning? (adult vs. kid profile) */
export function Welcome({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  // opened via a setup link (#/setup?c=…) → offer to apply it directly
  const linkText = typeof location !== 'undefined' && decodeSetup(location.href) ? location.href : '';
  const [codeOpen, setCodeOpen] = useState(!!linkText);
  const choose = async (p: 'adult' | 'kid', grade: KidGrade = '5-6') => {
    setBusy(true);
    await chooseProfile(p, grade);
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
        <div className="welcome-choice kid-card purple" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div className="row">
            <span style={{ fontSize: 40 }} aria-hidden="true">🎒</span>
            <span className="grow">
              <strong style={{ display: 'block', fontSize: 19 }}>Für Schüler</strong>
              <span className="small muted">Bunt, mit Roboter Robo, Sternen, Levels und Abzeichen. Wörter aus Schule, Familie, Tieren und Alltag.</span>
            </span>
          </div>
          <div className="grid-3" role="group" aria-label="Klassenstufe">
            {KID_GRADES.map((g) => (
              <button key={g.id} className="btn" disabled={busy} onClick={() => choose('kid', g.id)} aria-label={`Für Schüler, ${g.de}`}>
                {g.de}
              </button>
            ))}
          </div>
        </div>
        <button className="welcome-choice card" disabled={busy} onClick={() => choose('adult')}>
          <span style={{ fontSize: 40 }} aria-hidden="true">💼</span>
          <span className="grow">
            <strong style={{ display: 'block', fontSize: 19 }}>Für Erwachsene</strong>
            <span className="small muted">Alltag, Beruf, Meetings, Technik und Handball-Coaching.</span>
          </span>
        </button>
        <button className="btn block secondary" disabled={busy} onClick={() => setCodeOpen(true)}>
          🔑 Einrichtungscode von den Eltern einfügen
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
      <SetupCodeSheet open={codeOpen} onClose={() => setCodeOpen(false)} initialText={linkText} onApplied={() => { navigate('/home', true); onDone(); }} />
    </main>
  );
}
