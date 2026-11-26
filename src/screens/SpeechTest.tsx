import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state';
import { detectSpeechCapabilities, recognitionCtor } from '../speech/capabilities';
import { RecognitionError, startRecognition, type RecognitionHandle } from '../speech/recognition';
import { NavBar } from '../ui/components';
import { copyText } from '../ui/files';

/** Diagnostics: shows exactly which events the device's speech recognition reports. */
export function SpeechTestScreen() {
  const { L, settings, updateSettings, toast } = useApp();
  const caps = detectSpeechCapabilities();
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<string>('');
  const handle = useRef<RecognitionHandle | null>(null);
  const t0 = useRef(0);
  useEffect(() => () => handle.current?.abort(), []);

  const w = window as unknown as Record<string, unknown>;
  const api = recognitionCtor() ? ('SpeechRecognition' in w ? 'SpeechRecognition' : 'webkitSpeechRecognition') : L('keine', 'none');
  const env = [
    `App ${__APP_VERSION__}`,
    `API: ${api}`,
    `${L('installiert', 'installed')}: ${caps.standalone ? L('ja', 'yes') : L('nein (Browser)', 'no (browser)')}`,
    `iOS: ${caps.ios ? L('ja', 'yes') : L('nein', 'no')}`,
    `online: ${caps.online ? L('ja', 'yes') : L('nein', 'no')}`,
    `${L('Sprache', 'language')}: ${settings.accent}`,
    `${L('Zustimmung', 'consent')}: ${settings.sttConsent ?? L('nicht gefragt', 'not asked')}`,
    `UA: ${navigator.userAgent}`,
  ];

  const run = async () => {
    setLog([]);
    setOutcome('');
    setRunning(true);
    t0.current = performance.now();
    const add = (name: string, detail?: string) =>
      setLog((l) => [...l, `${String(Math.round(performance.now() - t0.current)).padStart(5)} ms  ${name}${detail ? `: ${detail}` : ''}`]);
    const h = startRecognition(settings.accent, { onEvent: add });
    handle.current = h;
    try {
      const r = await h.promise;
      setOutcome(`✅ ${L('Erkannt', 'Recognised')}: „${r.transcript}“${r.fromInterim ? L(' (nur Zwischenergebnis)', ' (interim only)') : ''}`);
    } catch (e) {
      const err = e as RecognitionError;
      setOutcome(`❌ ${err.code}${err.detail ? ` (${err.detail})` : ''}`);
    } finally {
      handle.current = null;
      setRunning(false);
    }
  };

  const report = [...env, '', ...log, '', outcome].join('\n');

  return (
    <main className="page">
      <NavBar title={L('Spracherkennung testen', 'Test speech recognition')} back="/settings" />
      <div className="stack">
        <p className="small muted" style={{ margin: 0 }}>
          {L('Starte den Test, sprich einen kurzen englischen Satz (z. B. „Could you clarify this point?“) und schick bei Problemen einen Screenshot des Protokolls.', 'Start the test, say a short English sentence and send a screenshot of the log if something fails.')}
        </p>
        {settings.sttConsent !== 'granted' ? (
          <div className="card stack small">
            <span className="muted">{L('Der Test nutzt die Spracherkennung des Geräts; die Aufnahme kann von Apple/Google verarbeitet werden. Die App speichert nichts.', 'The test uses the device speech recognition; audio may be processed by Apple/Google. The app stores nothing.')}</span>
            <button className="btn block" onClick={() => updateSettings({ sttConsent: 'granted' })}>{L('Zustimmen', 'Agree')}</button>
          </div>
        ) : (
          <button className="btn block big" onClick={running ? () => handle.current?.stop() : run} disabled={!recognitionCtor()}>
            {running ? L('Stopp', 'Stop') : L('Test starten', 'Start test')}
          </button>
        )}
        {outcome && <div className={`banner ${outcome.startsWith('✅') ? 'ok' : 'error'} break`} role="status">{outcome}</div>}
        <pre className="prompt" aria-label={L('Protokoll', 'Log')}>{report}</pre>
        <button className="btn block secondary" onClick={async () => toast((await copyText(report)) ? L('Protokoll kopiert', 'Log copied') : L('Kopieren nicht möglich', 'Copy failed'))}>
          {L('Protokoll kopieren', 'Copy log')}
        </button>
        <div className="card small muted">
          <strong style={{ color: 'var(--text)' }}>{L('Checkliste iPhone', 'iPhone checklist')}</strong>
          <ul style={{ paddingLeft: 18, margin: '6px 0 0' }}>
            <li>{L('Einstellungen → Allgemein → Tastatur → „Diktierfunktion aktivieren“ an', 'Settings → General → Keyboard → Enable Dictation on')}</li>
            <li>{L('Englische Tastatur hinzufügen (Einstellungen → Allgemein → Tastatur → Tastaturen)', 'Add an English keyboard')}</li>
            <li>{L('Einstellungen → Datenschutz & Sicherheit → Mikrofon bzw. Spracherkennung: Safari erlaubt', 'Privacy → Microphone / Speech Recognition: allowed for Safari')}</li>
            <li>{L('Zum Vergleich denselben Test in Safari (nicht installiert) ausführen', 'Compare: run the same test in Safari (not installed)')}</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
