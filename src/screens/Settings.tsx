import { useEffect, useState } from 'react';
import { loadStarterContent, requestPersistentStorage } from '../db/repo';
import { DURATIONS } from '../domain/methods';
import { useApp } from '../state';
import { englishVoices, pickVoice, speak, ttsSupported } from '../speech/tts';
import { ListLink, Segmented, Toggle } from '../ui/components';

export function SettingsScreen() {
  const { L, settings, updateSettings, voices, caps, bump, toast } = useApp();
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<string>('');
  const tts = ttsSupported();
  const enVoices = englishVoices(voices).filter((v) => v.lang.replace('_', '-').toLowerCase() === settings.accent.toLowerCase());
  const otherVoices = englishVoices(voices).filter((v) => !enVoices.includes(v));

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
    navigator.storage?.estimate?.().then((e) => e.usage !== undefined && setUsage(`${(e.usage / 1024 / 1024).toFixed(1)} MB`)).catch(() => undefined);
  }, []);

  const testVoice = () => speak('The simulation results indicate that the maximum stress occurs near the contact area.', { lang: settings.accent, rate: settings.rate, voice: pickVoice(settings.accent, settings.voiceURI, voices) });

  const row = (label: string, control: React.ReactNode, sub?: string) => (
    <div className="list-item">
      <span className="main">
        <span className="primary" style={{ display: 'block', fontWeight: 500 }}>{label}</span>
        {sub && <span className="secondary small" style={{ display: 'block' }}>{sub}</span>}
      </span>
      {control}
    </div>
  );
  const numSelect = (value: number, values: number[], onChange: (n: number) => void, unit: string, label: string) => (
    <select className="select" style={{ width: 'auto', minHeight: 38, padding: '6px 32px 6px 10px', backgroundPosition: 'calc(100% - 18px) 16px, calc(100% - 12px) 16px' }} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label}>
      {values.map((v) => <option key={v} value={v}>{v}{unit}</option>)}
    </select>
  );

  return (
    <main className="page">
      <h1 className="large-title">{L('Einstellungen', 'Settings')}</h1>

      <h2 className="section-title">{L('Daten & Import', 'Data & import')}</h2>
      <div className="list">
        <ListLink to="/prompt" icon="🤖" title={L('ChatGPT-Import', 'ChatGPT import')} subtitle={L('Prompt kopieren, JSON zurück importieren', 'Copy prompt, import JSON back')} />
        <ListLink to="/import" icon="📥" title={L('Datei / Text importieren', 'Import file / text')} subtitle="JSON · CSV" />
        <ListLink to="/item/new" icon="✍️" title={L('Manuell hinzufügen', 'Add manually')} />
        <ListLink to="/backup" icon="💾" title={L('Backup & Wiederherstellung', 'Backup & restore')} subtitle={settings.lastBackupAt ? `${L('Letztes Backup', 'Last backup')}: ${new Date(settings.lastBackupAt).toLocaleDateString()}` : L('Noch kein Backup', 'No backup yet')} />
        <ListLink onClick={async () => { const r = await loadStarterContent(); bump(); toast(L(`${r.added} neue Starter-Einträge`, `${r.added} new starter items`)); }} icon="🌱" title={L('Starter-Inhalte laden', 'Load starter content')} subtitle={L('Allgemeine Beispiele für alle Themenmodi', 'Generic examples for all topic modes')} />
      </div>

      <h2 className="section-title">{L('Lernen', 'Learning')}</h2>
      <div className="list">
        {row(L('Tagesziel', 'Daily goal'), numSelect(settings.dailyGoalMin, DURATIONS, (v) => updateSettings({ dailyGoalMin: v }), ' min', L('Tagesziel', 'Daily goal')))}
        {row(L('Standard-Lernzeit', 'Default duration'), numSelect(settings.defaultDurationMin, DURATIONS, (v) => updateSettings({ defaultDurationMin: v }), ' min', L('Standard-Lernzeit', 'Default duration')))}
        {row(L('Neue Einträge pro Tag', 'New items per day'), numSelect(settings.newPerDay, [0, 5, 10, 15, 20, 30, 50], (v) => updateSettings({ newPerDay: v }), '', L('Neue Einträge pro Tag', 'New items per day')))}
        {row(L('Tippfehler-Toleranz', 'Typo tolerance'), <Toggle checked={settings.typoTolerance} onChange={(v) => updateSettings({ typoTolerance: v })} label={L('Tippfehler-Toleranz', 'Typo tolerance')} />, L('Kleine Tippfehler zählen als „Schwer“ statt „Falsch“', 'Small typos count as "Hard" instead of wrong'))}
        <div className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <span>{L('Lückentext-Schwierigkeit', 'Gap fill difficulty')}</span>
          <Segmented label={L('Lückentext-Schwierigkeit', 'Gap fill difficulty')} value={settings.gapDifficulty} onChange={(v) => updateSettings({ gapDifficulty: v })} options={[{ value: 'easy', label: L('Leicht', 'Easy') }, { value: 'medium', label: L('Mittel', 'Medium') }, { value: 'hard', label: L('Schwer', 'Hard') }]} />
        </div>
        {row(L('Backup-Erinnerung', 'Backup reminder'), numSelect(settings.backupReminderDays, [3, 7, 14, 30], (v) => updateSettings({ backupReminderDays: v }), L(' Tage', ' days'), L('Backup-Erinnerung', 'Backup reminder')))}
      </div>

      <h2 className="section-title">{L('Sprachausgabe', 'Speech output')}</h2>
      {!tts ? (
        <div className="banner">{L('Dieses Gerät/dieser Browser unterstützt keine Sprachausgabe. Hörübungen sind ausgeblendet.', 'This device/browser does not support speech output. Listening exercises are hidden.')}</div>
      ) : (
        <div className="list">
          <div className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <span>{L('Akzent', 'Accent')}</span>
            <Segmented label={L('Akzent', 'Accent')} value={settings.accent} onChange={(v) => updateSettings({ accent: v, voiceURI: undefined })} options={[{ value: 'en-GB', label: 'British English' }, { value: 'en-US', label: 'American English' }]} />
          </div>
          <div className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <label className="field"><span>{L('Stimme', 'Voice')}</span>
              <select className="select" value={settings.voiceURI ?? ''} onChange={(e) => updateSettings({ voiceURI: e.target.value || undefined })}>
                <option value="">{L('Automatisch', 'Automatic')} ({pickVoice(settings.accent, undefined, voices)?.name ?? '–'})</option>
                {enVoices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name}{v.localService ? '' : ' (online)'}</option>)}
                {otherVoices.length > 0 && <optgroup label={L('Andere englische Stimmen', 'Other English voices')}>{otherVoices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} · {v.lang}{v.localService ? '' : ' (online)'}</option>)}</optgroup>}
              </select>
            </label>
            <span className="tiny muted">{L('Weitere Stimmen: iPhone-Einstellungen → Bedienungshilfen → Gesprochene Inhalte → Stimmen → Englisch.', 'More voices: iPhone Settings → Accessibility → Spoken Content → Voices → English.')}</span>
          </div>
          <div className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <label className="field"><span>{L('Sprechgeschwindigkeit', 'Speech rate')}: {settings.rate.toFixed(2)}×</span>
              <input type="range" min={0.5} max={1.3} step={0.05} value={settings.rate} onChange={(e) => updateSettings({ rate: Number(e.target.value) })} />
            </label>
          </div>
          {row(L('Wiederholungen', 'Repetitions'), numSelect(settings.repeatCount, [1, 2, 3], (v) => updateSettings({ repeatCount: v }), '×', L('Wiederholungen', 'Repetitions')))}
          {row(L('Pause zwischen Wiederholungen', 'Pause between repetitions'), numSelect(settings.pauseMs, [500, 1000, 1500, 2500, 4000], (v) => updateSettings({ pauseMs: v }), ' ms', L('Pause', 'Pause')))}
          {row(L('Automatisch vorlesen', 'Auto-play audio'), <Toggle checked={settings.autoPlayAudio} onChange={(v) => updateSettings({ autoPlayAudio: v })} label={L('Automatisch vorlesen', 'Auto-play audio')} />, L('Englische Seite der Karteikarte vorlesen', 'Read the English side of flashcards'))}
          <div className="list-item"><button className="btn block secondary" onClick={testVoice}>{L('Stimme testen', 'Test voice')}</button></div>
        </div>
      )}

      <h2 className="section-title">{L('Darstellung & Bedienung', 'Appearance & controls')}</h2>
      <div className="list">
        <div className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <span>{L('Design', 'Theme')}</span>
          <Segmented label={L('Design', 'Theme')} value={settings.theme} onChange={(v) => updateSettings({ theme: v })} options={[{ value: 'system', label: 'System' }, { value: 'light', label: L('Hell', 'Light') }, { value: 'dark', label: L('Dunkel', 'Dark') }]} />
        </div>
        <div className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <span>{L('Sprache der Oberfläche', 'Interface language')}</span>
          <Segmented label={L('Sprache der Oberfläche', 'Interface language')} value={settings.uiLang} onChange={(v) => updateSettings({ uiLang: v })} options={[{ value: 'de', label: 'Deutsch' }, { value: 'en', label: 'English' }]} />
        </div>
        {row(L('Haptisches Feedback', 'Haptic feedback'), <Toggle checked={settings.haptics} onChange={(v) => updateSettings({ haptics: v })} label={L('Haptisches Feedback', 'Haptic feedback')} />, L('Auf dem iPhone erst ab iOS 18 und nur eingeschränkt', 'On iPhone only from iOS 18 and limited'))}
      </div>

      <h2 className="section-title">{L('Gerät & Speicher', 'Device & storage')}</h2>
      <div className="list small">
        {row(L('Dauerhafter Speicher', 'Persistent storage'), persisted ? <span className="badge green">{L('aktiv', 'active')}</span> : <button className="btn small secondary" onClick={async () => setPersisted(await requestPersistentStorage())}>{L('Anfordern', 'Request')}</button>, L('Schützt Daten vor automatischem Löschen (Browser entscheidet)', 'Protects data from eviction (browser decides)'))}
        {usage && row(L('Belegter Speicher', 'Storage used'), <span className="muted">{usage}</span>)}
        {row(L('Als App installiert', 'Installed as app'), <span className={`badge ${caps.standalone ? 'green' : ''}`}>{caps.standalone ? L('ja', 'yes') : L('nein', 'no')}</span>)}
        {row(L('Sprachausgabe', 'Speech output'), <span className={`badge ${caps.tts ? 'green' : 'red'}`}>{caps.tts ? L('verfügbar', 'available') : L('nicht verfügbar', 'unavailable')}</span>)}
        {row(L('Spracherkennung (Phase 2)', 'Speech recognition (phase 2)'), <span className="badge">{caps.recognition ? L('API vorhanden', 'API present') : L('nicht vorhanden', 'not present')}</span>, L('Benötigt i. d. R. Internet; wird vor Nutzung geprüft', 'Usually needs internet; checked before use'))}
        {row(L('Verbindung', 'Connection'), <span className={`badge ${caps.online ? 'green' : 'orange'}`}>{caps.online ? 'online' : 'offline'}</span>)}
      </div>

      <h2 className="section-title">{L('Info', 'About')}</h2>
      <div className="list">
        <ListLink to="/info" icon="ℹ️" title={L('Installation, Grenzen & Datenschutz', 'Installation, limits & privacy')} subtitle={`Version ${__APP_VERSION__}`} />
      </div>
    </main>
  );
}
