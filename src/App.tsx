import { lazy, Suspense, useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { ensureSetup, resolveProfileOnStart } from './db/repo';
import { Welcome } from './screens/kids/Welcome';
import { useApp } from './state';
import { IconCards, IconChart, IconGear, IconHome, IconLearn } from './ui/icons';
import { Home } from './screens/Home';
import { Learn } from './screens/Learn';
import { SessionScreen } from './screens/Session';
import { Vocab } from './screens/Vocab';
import { SettingsScreen } from './screens/Settings';

const ItemEditor = lazy(() => import('./screens/ItemEditor').then((m) => ({ default: m.ItemEditor })));
const Stats = lazy(() => import('./screens/Stats').then((m) => ({ default: m.Stats })));
const ImportScreen = lazy(() => import('./screens/Import').then((m) => ({ default: m.ImportScreen })));
const PromptAssistant = lazy(() => import('./screens/PromptAssistant').then((m) => ({ default: m.PromptAssistant })));
const BackupScreen = lazy(() => import('./screens/Backup').then((m) => ({ default: m.BackupScreen })));
const InfoScreen = lazy(() => import('./screens/Info').then((m) => ({ default: m.InfoScreen })));
const SpeechTestScreen = lazy(() => import('./screens/SpeechTest').then((m) => ({ default: m.SpeechTestScreen })));

function UpdateBanner() {
  const { L } = useApp();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      // check for a new version every hour and whenever the app is reopened
      setInterval(() => reg.update().catch(() => undefined), 60 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => undefined);
      });
    },
  });
  if (!needRefresh) return null;
  return (
    <div className="toast-wrap" style={{ pointerEvents: 'auto' }}>
      <div className="banner info card" role="alert" style={{ maxWidth: 520, width: '100%' }}>
        <span className="grow small">
          <strong>{L('Neue Version verfügbar.', 'New version available.')}</strong>{' '}
          {L('Deine Lerndaten bleiben erhalten.', 'Your learning data is kept.')}
        </span>
        <button className="btn small" onClick={() => updateServiceWorker(true)}>
          {L('Aktualisieren', 'Update')}
        </button>
        <button className="btn small ghost" onClick={() => setNeedRefresh(false)} aria-label={L('Später', 'Later')}>
          {L('Später', 'Later')}
        </button>
      </div>
    </div>
  );
}

const TABS = [
  { path: 'home', de: 'Home', en: 'Home', Icon: IconHome },
  { path: 'learn', de: 'Lernen', en: 'Learn', Icon: IconLearn },
  { path: 'vocab', de: 'Vokabeln', en: 'Vocabulary', Icon: IconCards },
  { path: 'stats', de: 'Statistik', en: 'Stats', Icon: IconChart },
  { path: 'settings', de: 'Einstellungen', en: 'Settings', Icon: IconGear },
];
const TAB_OF: Record<string, string> = {
  home: 'home', learn: 'learn', vocab: 'vocab', item: 'vocab', stats: 'stats', settings: 'settings',
  import: 'settings', prompt: 'settings', backup: 'settings', info: 'settings', 'speech-test': 'settings',
};

export function App() {
  const { route, L, settings, updateSettings } = useApp();
  const [ready, setReady] = useState(false);
  const [needsChoice, setNeedsChoice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureSetup()
      .then(() => resolveProfileOnStart())
      .then(async (r) => {
        await updateSettings({}); // reload settings (profile may have been set during start-up)
        if (r === 'needs-choice') setNeedsChoice(true);
        else setReady(true);
      })
      .catch((e: Error) => setError(e.message || String(e)));
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.path]);

  if (error) {
    return (
      <main className="page no-tabbar">
        <div className="banner error">
          {L(
            'Die lokale Datenbank konnte nicht geöffnet werden. Im privaten Modus von Safari ist Speichern eventuell nicht möglich.',
            'The local database could not be opened. Private browsing may block storage.',
          )}{' '}
          ({error})
        </div>
      </main>
    );
  }
  if (needsChoice) {
    return (
      <Welcome
        onDone={async () => {
          await updateSettings({});
          setNeedsChoice(false);
          setReady(true);
        }}
      />
    );
  }
  if (!ready) return <main className="page" aria-busy="true" />;

  const section = route.parts[0] ?? 'home';
  const inSession = section === 'session';
  let screen;
  switch (section) {
    case 'learn': screen = <Learn />; break;
    case 'session': screen = <SessionScreen />; break;
    case 'vocab': screen = <Vocab />; break;
    case 'item': screen = <ItemEditor id={route.parts[1] ?? 'new'} />; break;
    case 'stats': screen = <Stats />; break;
    case 'settings': screen = <SettingsScreen />; break;
    case 'import': screen = <ImportScreen />; break;
    case 'prompt': screen = <PromptAssistant />; break;
    case 'backup': screen = <BackupScreen />; break;
    case 'info': screen = <InfoScreen />; break;
    case 'speech-test': screen = <SpeechTestScreen />; break;
    default: screen = <Home />;
  }
  const activeTab = TAB_OF[section] ?? 'home';

  return (
    <div className="app">
      <UpdateBanner />
      <Suspense fallback={<main className="page" aria-busy="true" />}>{screen}</Suspense>
      {!inSession && (
        <div className="tabbar">
          <nav aria-label={L('Hauptnavigation', 'Main navigation')}>
            {TABS.map(({ path, de, en, Icon }) => (
              <a key={path} href={`#/${path}`} aria-current={activeTab === path ? 'page' : undefined}>
                <Icon size={25} />
                <span>{settings.profile === 'kid' && path === 'stats' ? L('Erfolge', 'Awards') : L(de, en)}</span>
              </a>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
