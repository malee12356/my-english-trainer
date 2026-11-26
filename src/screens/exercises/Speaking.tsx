import { useEffect, useMemo, useRef, useState } from 'react';
import { acceptedAnswers } from '../../domain/answerCheck';
import { evaluateSpeech, type SpeechEvaluation } from '../../domain/speech';
import { useApp } from '../../state';
import { RecognitionError, startRecognition, type RecognitionErrorCode, type RecognitionHandle } from '../../speech/recognition';
import { stopSpeaking } from '../../speech/tts';
import { Sheet, SpeakButton } from '../../ui/components';
import { DiffView, ItemExtras, type ExerciseProps } from './shared';

const MAX_ATTEMPTS = 3;

/** Share of expected words that were recognised – a word diff only helps when the answers overlap. */
const overlap = (ev: SpeechEvaluation) => {
  const expected = ev.check.diff.filter((d) => d.expected !== undefined).length;
  return expected ? ev.check.diff.filter((d) => d.kind === 'ok' || d.kind === 'typo').length / expected : 0;
};

type Phase = 'idle' | 'listening' | 'result' | 'error';

function MicIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v4" />
    </svg>
  );
}

/**
 * Speaking Mode: German prompt → say the English translation → the recognised
 * words are compared with the expected answer. This is word recognition, not a
 * pronunciation assessment.
 */
export function Speaking({ item, settings, onDone, onFallback }: ExerciseProps) {
  const { L, updateSettings, haptic } = useApp();
  const accepted = useMemo(() => acceptedAnswers(item, 'de-en'), [item]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [attempt, setAttempt] = useState(0);
  const [evaluation, setEvaluation] = useState<SpeechEvaluation | null>(null);
  const [error, setError] = useState<RecognitionErrorCode | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [hint, setHint] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [interim, setInterim] = useState('');
  const [dictation, setDictation] = useState(false);
  const [dictValue, setDictValue] = useState('');
  const handle = useRef<RecognitionHandle | null>(null);

  const evaluate = (alternatives: string[]) => {
    const n = attempt + 1;
    setAttempt(n);
    const ev = evaluateSpeech(alternatives, accepted, n);
    setEvaluation(ev);
    if (ev.check.verdict !== 'wrong' || n >= MAX_ATTEMPTS) setRevealed(true);
    setPhase('result');
    haptic();
  };

  // never leave the microphone running when the exercise is left
  useEffect(() => () => handle.current?.abort(), []);

  const listen = async () => {
    if (settings.sttConsent !== 'granted') {
      setConsentOpen(true);
      return;
    }
    stopSpeaking();
    setError(null);
    setInterim('');
    setPhase('listening');
    const h = startRecognition(settings.accent, { onInterim: setInterim });
    handle.current = h;
    try {
      const res = await h.promise;
      evaluate(res.alternatives);
    } catch (e) {
      const code = e instanceof RecognitionError ? e.code : 'failed';
      if (code === 'aborted') {
        setPhase('idle');
        return;
      }
      setError(code);
      setPhase('error');
    } finally {
      handle.current = null;
    }
  };

  const errorText: Record<RecognitionErrorCode, string> = {
    unsupported: L('Dieses Gerät/dieser Browser unterstützt keine Spracherkennung.', 'This device/browser does not support speech recognition.'),
    denied: L('Kein Zugriff auf Mikrofon oder Spracherkennung. iPhone: Einstellungen → Safari → Mikrofon sowie Einstellungen → Allgemein → Tastaturen → Diktierfunktion prüfen.', 'No access to microphone or speech recognition. Check microphone permission and dictation settings.'),
    network: L('Die Spracherkennung braucht eine Internetverbindung.', 'Speech recognition needs an internet connection.'),
    'no-speech': L('Nichts gehört. Tippe auf das Mikrofon und sprich direkt los.', 'Nothing heard. Tap the microphone and start speaking right away.'),
    'no-mic': L('Kein Mikrofon gefunden.', 'No microphone found.'),
    aborted: '',
    language: L('Diese Sprache wird von der Spracherkennung nicht unterstützt.', 'This language is not supported by the recogniser.'),
    failed: L('Die Spracherkennung hat nicht reagiert. Das kommt in installierten Web-Apps unter iOS vor. Zuverlässige Alternative: mit der Diktierfunktion der iPhone-Tastatur antworten.', 'Speech recognition did not respond. This can happen in installed web apps on iOS. Reliable alternative: answer with the iPhone keyboard dictation.'),
  };
  const retryable = error === 'no-speech' || error === 'failed' || error === 'network';
  const verdict = evaluation?.check.verdict;
  const canRetry = phase === 'result' && verdict !== 'correct' && attempt < MAX_ATTEMPTS && !revealed;

  return (
    <div className="stack">
      <div className="card center" style={{ padding: '24px 16px' }}>
        <span className="badge">Deutsch → English · {L('sprechen', 'speak')}</span>
        <div className={`term ${item.german.length > 40 ? 'long' : ''}`} style={{ marginTop: 10 }} lang="de">{item.german}</div>
        {item.example_de && !hint && phase !== 'result' && (
          <button className="btn ghost small" onClick={() => setHint(true)}>{L('Hinweis zeigen', 'Show hint')}</button>
        )}
        {hint && phase !== 'result' && (
          <div className="small muted" style={{ marginTop: 6 }}>
            {item.example_de} · {L('beginnt mit', 'starts with')} „{item.english.replace(/^to\s+/i, '').charAt(0)}…“
          </div>
        )}
      </div>

      {settings.sttConsent === 'denied' && phase === 'idle' && (
        <div className="banner small">
          <span className="grow">{L('Du hast der Spracherkennung nicht zugestimmt. Ändern: Einstellungen → Sprachausgabe & Erkennung.', 'You declined speech recognition. Change it in Settings.')}</span>
        </div>
      )}

      {dictation && phase !== 'result' && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (dictValue.trim()) {
              evaluate([dictValue]);
              setDictValue('');
            }
          }}
        >
          <div className="banner info small">
            {L('Tippe ins Feld und dann auf der Tastatur auf 🎤 (bei Bedarf mit 🌐 zur englischen Tastatur wechseln). Sprich den englischen Satz und tippe auf „Prüfen“.', 'Tap the field, then the 🎤 key on the keyboard (switch to an English keyboard with 🌐 if needed). Say the sentence and tap "Check".')}
          </div>
          <input className="input" value={dictValue} onChange={(e) => setDictValue(e.target.value)} aria-label={L('Diktierte Antwort', 'Dictated answer')} placeholder={L('Hier diktieren …', 'Dictate here …')} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} lang="en" style={{ fontSize: 19, minHeight: 54 }} />
          <button className="btn block big" type="submit" disabled={!dictValue.trim()}>{L('Prüfen', 'Check')}</button>
          {attempt > 0 && <div className="small muted center">{L(`Versuch ${attempt + 1} von ${MAX_ATTEMPTS}`, `Attempt ${attempt + 1} of ${MAX_ATTEMPTS}`)}</div>}
        </form>
      )}

      {!dictation && (phase === 'idle' || phase === 'listening' || canRetry || (phase === 'error' && retryable)) && (
        <div className="center stack" style={{ alignItems: 'center' }}>
          {phase === 'listening' ? (
            <>
              <button className="btn mic listening" onClick={() => handle.current?.stop()} aria-label={L('Zuhören beenden', 'Stop listening')}>
                <MicIcon />
              </button>
              <div className="small" role="status" aria-live="polite">
                {interim ? <span lang="en" className="break">„{interim}“</span> : L('Ich höre zu … sprich jetzt Englisch.', 'Listening … speak English now.')}
              </div>
              <div className="tiny muted">{L('Zum Beenden tippen', 'Tap to finish')}</div>
            </>
          ) : (
            <>
              <button className="btn mic" onClick={listen} aria-label={attempt ? L('Nochmal sprechen', 'Speak again') : L('Sprechen', 'Speak')}>
                <MicIcon />
              </button>
              <div className="small muted">
                {attempt ? L(`Versuch ${attempt + 1} von ${MAX_ATTEMPTS}`, `Attempt ${attempt + 1} of ${MAX_ATTEMPTS}`) : L('Antippen und die englische Übersetzung sprechen', 'Tap and say the English translation')}
              </div>
            </>
          )}
        </div>
      )}

      {phase === 'error' && error && (
        <div className="feedback wrong" role="alert">
          <strong>{error === 'no-speech' ? L('Nichts erkannt', 'Nothing recognised') : L('Spracherkennung nicht möglich', 'Speech recognition unavailable')}</strong>
          <p className="small" style={{ margin: '6px 0 0' }}>{errorText[error]}</p>
        </div>
      )}

      {phase === 'result' && evaluation && (
        <div className={`feedback ${verdict}`} role="status" aria-live="polite">
          <strong style={{ fontSize: 18 }}>
            {verdict === 'correct' ? L('Richtig erkannt!', 'Correctly recognised!') : verdict === 'almost' ? L('Fast – fast alle Wörter erkannt', 'Almost – nearly all words recognised') : L('Nicht ganz', 'Not quite')}
          </strong>
          <div style={{ marginTop: 8 }}>
            <div className="tiny muted">{L('Erkannt', 'Recognised')}</div>
            <div className="break" lang="en" style={{ fontSize: 18 }}>{evaluation.transcript ? `„${evaluation.transcript}“` : '–'}</div>
          </div>
          {verdict !== 'correct' && revealed && evaluation.transcript && overlap(evaluation) >= 0.5 && (
            <div style={{ marginTop: 8 }}>
              <DiffView diff={evaluation.check.diff} label={L('Vergleich mit der Lösung', 'Comparison with the answer')} />
            </div>
          )}
          {revealed && (
            <div className="row" style={{ marginTop: 10 }}>
              <div className="grow">
                <div className="tiny muted">{L('Lösung', 'Solution')}</div>
                <div style={{ fontWeight: 700, fontSize: 19 }} className="break" lang="en">{item.english}</div>
              </div>
              <SpeakButton text={item.english} label={L('Lösung anhören', 'Listen to the answer')} />
            </div>
          )}
          {revealed && <ItemExtras item={item} />}
          <p className="tiny muted" style={{ margin: '10px 0 0' }}>
            {L('Verglichen werden die erkannten Wörter – das ist keine Bewertung deiner Aussprache.', 'Only recognised words are compared – this is not a pronunciation score.')}
          </p>
        </div>
      )}

      <div className="stack">
        {phase === 'result' && !revealed && (
          <button className="btn block secondary" onClick={() => setRevealed(true)}>{L('Lösung zeigen', 'Show answer')}</button>
        )}
        {phase === 'result' && revealed && (
          <button className="btn block" autoFocus onClick={() => onDone(revealed && verdict === 'wrong' ? 1 : evaluation!.grade, evaluation!.transcript)}>
            {L('Weiter', 'Next')}
          </button>
        )}
        {phase === 'result' && revealed && verdict !== 'correct' && (
          <button className="btn small secondary" onClick={() => onDone(attempt <= 1 ? 3 : 2, evaluation!.transcript)}>
            {L('Erkennung lag falsch – ich hatte es richtig', 'Recognition was wrong – I said it correctly')}
          </button>
        )}
        {phase !== 'listening' && (phase !== 'result' || canRetry) && (
          <button className="btn block secondary" onClick={() => { handle.current?.abort(); setDictation(!dictation); setPhase('idle'); }}>
            {dictation ? L('Zurück zum Mikrofon-Knopf', 'Back to the microphone button') : L('Mit iPhone-Diktierfunktion antworten', 'Answer with keyboard dictation')}
          </button>
        )}
        {phase !== 'listening' && phase !== 'result' && onFallback && (
          <button className="btn block ghost" onClick={onFallback}>{L('Stattdessen schreiben', 'Type instead')}</button>
        )}
        {phase === 'idle' && attempt === 0 && (
          <button className="btn block ghost" onClick={() => { setEvaluation(evaluateSpeech([''], accepted, 1)); setRevealed(true); setPhase('result'); }}>
            {L('Weiß ich nicht', "I don't know")}
          </button>
        )}
      </div>

      <Sheet open={consentOpen} onClose={() => setConsentOpen(false)} title={L('Spracherkennung erlauben?', 'Allow speech recognition?')}>
        <div className="stack small">
          <p className="muted" style={{ margin: 0 }}>
            {L(
              'Für Sprechübungen nutzt die App die Spracherkennung deines Geräts bzw. Browsers. Dabei kann deine Aufnahme vom Anbieter (auf dem iPhone Apple, in Chrome Google) auf dessen Servern verarbeitet werden. Die App selbst speichert keine Aufnahmen und sendet nichts an eigene Server – gespeichert wird nur der erkannte Text als Lernergebnis.',
              'Speaking exercises use the speech recognition of your device/browser. Your audio may be processed on the provider’s servers (Apple on iPhone, Google in Chrome). The app itself stores no recordings and sends nothing to its own servers – only the recognised text is kept as a learning result.',
            )}
          </p>
          <p className="muted" style={{ margin: 0 }}>{L('Das Mikrofon ist nur aktiv, während du sprichst. Du kannst die Zustimmung jederzeit in den Einstellungen widerrufen.', 'The microphone is only active while you speak. You can revoke consent in Settings at any time.')}</p>
          <button className="btn block" onClick={async () => { await updateSettings({ sttConsent: 'granted' }); setConsentOpen(false); }}>
            {L('Zustimmen', 'Agree')}
          </button>
          <button className="btn block secondary" onClick={async () => { await updateSettings({ sttConsent: 'denied' }); setConsentOpen(false); onFallback?.(); }}>
            {L('Ablehnen – stattdessen schreiben', 'Decline – type instead')}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
