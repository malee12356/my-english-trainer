import { useEffect, useState } from 'react';
import { applySetup } from '../../db/repo';
import { gradeInfo, KID_GRADES, type KidGrade } from '../../domain/grades';
import { decodeSetup, makeLock, PIN_RE, setupMessage, type SetupConfig } from '../../domain/parental';
import { useApp } from '../../state';
import { Segmented, Sheet } from '../../ui/components';
import { copyText } from '../../ui/files';
import { whatsappUrl } from '../../ui/share';

function PinInput({ value, onChange, label, autoFocus }: { value: string; onChange: (v: string) => void; label: string; autoFocus?: boolean }) {
  return (
    <input
      className="input"
      type="password"
      inputMode="numeric"
      autoComplete="off"
      pattern="[0-9]*"
      maxLength={8}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
      aria-label={label}
      placeholder={label}
      autoFocus={autoFocus}
      style={value ? { fontSize: 24, letterSpacing: 8, textAlign: 'center' } : { textAlign: 'center' }}
    />
  );
}

/** Ask for the parent PIN; unlocks the parent area for 5 minutes. */
export function PinUnlockSheet({ open, onClose, onUnlocked }: { open: boolean; onClose: () => void; onUnlocked?: () => void }) {
  const { L, unlockParent } = useApp();
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (open) {
      setPin('');
      setMsg('');
    }
  }, [open]);
  const submit = async () => {
    const r = await unlockParent(pin);
    if (r === 'ok') {
      onClose();
      onUnlocked?.();
    } else {
      setPin('');
      setMsg(r === 'wait' ? L('Zu viele Versuche – bitte 1 Minute warten.', 'Too many attempts – please wait a minute.') : L('Falsche PIN.', 'Wrong PIN.'));
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title={L('Elternbereich entsperren', 'Unlock parent area')}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <PinInput value={pin} onChange={setPin} label={L('Eltern-PIN', 'Parent PIN')} autoFocus />
        {msg && <div className="banner error small" role="alert">{msg}</div>}
        <button className="btn block" type="submit" disabled={!PIN_RE.test(pin)}>{L('Entsperren', 'Unlock')}</button>
        <p className="tiny muted" style={{ margin: 0 }}>{L('PIN vergessen? Dann hilft nur: Backup erstellen, App-Daten in den iPhone-Einstellungen löschen und neu einrichten.', 'Forgot the PIN? Create a backup, delete the app data and set up again.')}</p>
      </form>
    </Sheet>
  );
}

/** Set or change the parent PIN on this device. */
export function SetPinSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { L, updateSettings, toast } = useApp();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  useEffect(() => {
    if (open) {
      setA('');
      setB('');
    }
  }, [open]);
  const ok = PIN_RE.test(a) && a === b;
  return (
    <Sheet open={open} onClose={onClose} title={L('Eltern-PIN festlegen', 'Set parent PIN')}>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!ok) return;
          await updateSettings({ parentLock: await makeLock(a) });
          toast(L('Eltern-PIN gespeichert 🔒', 'Parent PIN saved 🔒'));
          onClose();
        }}
      >
        <p className="small muted" style={{ margin: 0 }}>{L('Sperrt Profil, Klassenstufe, Spielzeit-Einstellungen, das Entfernen von Paketen und das Wiederherstellen von Backups.', 'Locks profile, grade, screen-time settings, removing packs and restoring backups.')}</p>
        <PinInput value={a} onChange={setA} label={L('Neue PIN (4–8 Ziffern)', 'New PIN (4–8 digits)')} autoFocus />
        <PinInput value={b} onChange={setB} label={L('PIN wiederholen', 'Repeat PIN')} />
        {b.length >= 4 && a !== b && <div className="small" style={{ color: 'var(--red)' }}>{L('Die PINs stimmen nicht überein.', 'PINs do not match.')}</div>}
        <button className="btn block" type="submit" disabled={!ok}>{L('PIN speichern', 'Save PIN')}</button>
      </form>
    </Sheet>
  );
}

/** Paste a setup code (whole WhatsApp message, link or bare code) and apply it. */
export function SetupCodeSheet({ open, onClose, onApplied, initialText = '' }: { open: boolean; onClose: () => void; onApplied?: () => void; initialText?: string }) {
  const { L, settings, updateSettings, bump, toast, parentLocked } = useApp();
  const [text, setText] = useState(initialText);
  const [msg, setMsg] = useState('');
  const [unlock, setUnlock] = useState(false);
  useEffect(() => {
    if (open) {
      setText(initialText);
      setMsg('');
    }
  }, [open, initialText]);
  const cfg = decodeSetup(text);
  const needsPin = !!cfg && !!settings.parentLock && settings.parentLock.hash !== cfg.lock.hash && parentLocked;
  const apply = async (c: SetupConfig) => {
    await applySetup(c);
    await updateSettings({});
    bump();
    toast(L('Einrichtung übernommen 🎉', 'Setup applied 🎉'));
    onClose();
    onApplied?.();
  };
  return (
    <Sheet open={open} onClose={onClose} title={L('Einrichtungscode einfügen', 'Paste setup code')}>
      <div className="stack">
        <button className="btn block secondary" onClick={async () => { try { setText(await navigator.clipboard.readText()); } catch { setMsg(L('Zwischenablage nicht lesbar – bitte unten einfügen.', 'Clipboard not readable – please paste below.')); } }}>
          📋 {L('Aus Zwischenablage einfügen', 'Paste from clipboard')}
        </button>
        <textarea className="textarea" style={{ minHeight: 100, fontSize: 14 }} value={text} onChange={(e) => setText(e.target.value)} aria-label={L('Nachricht mit Einrichtungscode', 'Message with setup code')} placeholder="PET1-…" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        {text.trim() && !cfg && <div className="banner error small" role="alert">{L('Kein gültiger Einrichtungscode gefunden.', 'No valid setup code found.')}</div>}
        {msg && <div className="banner small">{msg}</div>}
        {cfg && (
          <div className="banner ok small">
            {L(
              `Schüler · ${gradeInfo(cfg.grade).de} · ${cfg.words} Wörter pro Challenge · ${String(cfg.minutesPerWord).replace('.', ',')} Min. pro Wort · mit Eltern-PIN`,
              `Pupil · ${gradeInfo(cfg.grade).en} · ${cfg.words} words · ${cfg.minutesPerWord} min per word · parent PIN`,
            )}
          </div>
        )}
        {needsPin && <div className="banner small">{L('Diese Einrichtung hat eine andere PIN. Bitte zuerst mit der bisherigen Eltern-PIN entsperren.', 'This setup uses a different PIN. Unlock with the current parent PIN first.')}</div>}
        <button className="btn block" disabled={!cfg} onClick={() => (needsPin ? setUnlock(true) : cfg && apply(cfg))}>
          {needsPin ? L('Mit bisheriger PIN entsperren', 'Unlock with current PIN') : L('Einrichtung übernehmen', 'Apply setup')}
        </button>
      </div>
      <PinUnlockSheet open={unlock} onClose={() => setUnlock(false)} onUnlocked={() => cfg && apply(cfg)} />
    </Sheet>
  );
}

/** Parent's app: create a setup message for the pupil's app. */
export function SetupGeneratorSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { L, toast } = useApp();
  const [grade, setGrade] = useState<KidGrade>('5-6');
  const [words, setWords] = useState(20);
  const [mpw, setMpw] = useState(1);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (open) {
      setA('');
      setB('');
      setMessage('');
    }
  }, [open]);
  const ok = PIN_RE.test(a) && a === b;
  const appUrl = `${location.origin}${location.pathname}`;
  const create = async () => {
    const cfg: SetupConfig = { v: 1, profile: 'kid', grade, words, minutesPerWord: mpw, lock: await makeLock(a) };
    setMessage(setupMessage(cfg, appUrl));
  };
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ text: message, title: 'English Trainer – Einrichtung' });
      else toast((await copyText(message)) ? L('Kopiert', 'Copied') : L('Kopieren nicht möglich', 'Copy failed'));
    } catch {
      /* cancelled */
    }
  };
  const sel = { width: 'auto', minHeight: 38, padding: '6px 32px 6px 10px', backgroundPosition: 'calc(100% - 18px) 16px, calc(100% - 12px) 16px' } as const;
  return (
    <Sheet open={open} onClose={onClose} title={L('Schüler-App einrichten', 'Set up pupil app')}>
      {!message ? (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); if (ok) void create(); }}>
          <p className="small muted" style={{ margin: 0 }}>{L('Erzeugt eine Nachricht für das Handy deines Kindes. Dort „Einrichtungscode einfügen“ – dann sind Profil, Klassenstufe und Spielzeit-Regeln eingestellt und mit deiner PIN gesperrt.', "Creates a message for your child's phone. There, “Paste setup code” sets profile, grade and screen-time rules, locked with your PIN.")}</p>
          <Segmented label={L('Klassenstufe', 'School year')} value={grade} onChange={setGrade} options={KID_GRADES.map((g) => ({ value: g.id, label: L(g.de, g.en) }))} />
          <div className="row wrap">
            <span className="grow small">🎮 {L('Spielzeit-Challenge', 'Screen-time challenge')}</span>
            <select className="select" style={sel} value={words} onChange={(e) => setWords(Number(e.target.value))} aria-label={L('Wörter pro Challenge', 'Words per challenge')}>
              {[10, 15, 20, 25, 30].map((n) => <option key={n} value={n}>{n} {L('Wörter', 'words')}</option>)}
            </select>
            <select className="select" style={sel} value={mpw} onChange={(e) => setMpw(Number(e.target.value))} aria-label={L('Minuten pro richtigem Wort', 'Minutes per correct word')}>
              {[0.5, 1, 2].map((n) => <option key={n} value={n}>{String(n).replace('.', ',')} {L('Min/Wort', 'min/word')}</option>)}
            </select>
          </div>
          <PinInput value={a} onChange={setA} label={L('Eltern-PIN (4–8 Ziffern)', 'Parent PIN (4–8 digits)')} />
          <PinInput value={b} onChange={setB} label={L('PIN wiederholen', 'Repeat PIN')} />
          {b.length >= 4 && a !== b && <div className="small" style={{ color: 'var(--red)' }}>{L('Die PINs stimmen nicht überein.', 'PINs do not match.')}</div>}
          <button className="btn block" type="submit" disabled={!ok}>{L('Einrichtungs-Nachricht erzeugen', 'Create setup message')}</button>
          <p className="tiny muted" style={{ margin: 0 }}>{L('Die PIN steht nicht im Klartext in der Nachricht. Später geänderte Regeln mit derselben PIN übernimmt die Schüler-App ohne PIN-Abfrage.', 'The PIN is not in the message in plain text. Later changes with the same PIN are accepted without asking for the PIN.')}</p>
        </form>
      ) : (
        <div className="stack">
          <pre className="prompt" aria-label={L('Einrichtungs-Nachricht', 'Setup message')}>{message}</pre>
          <button className="btn block" onClick={share}>📤 {L('Teilen', 'Share')}</button>
          <a className="btn block secondary" href={whatsappUrl(message)} target="_blank" rel="noopener noreferrer">💬 {L('Per WhatsApp senden', 'Send via WhatsApp')}</a>
          <button className="btn block ghost" onClick={async () => toast((await copyText(message)) ? L('Kopiert', 'Copied') : L('Kopieren nicht möglich', 'Copy failed'))}>📋 {L('Kopieren', 'Copy')}</button>
        </div>
      )}
    </Sheet>
  );
}
