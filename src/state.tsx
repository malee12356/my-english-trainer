/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getSettings, loadSnapshot, saveSettings, type Snapshot } from './db/repo';
import { DEFAULT_SETTINGS, type Settings } from './domain/types';
import { detectSpeechCapabilities, type SpeechCapabilities } from './speech/capabilities';
import { loadVoices } from './speech/tts';

export interface Route {
  path: string;
  parts: string[];
  query: URLSearchParams;
}

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/home';
  const [path, qs] = raw.split('?');
  return { path, parts: path.split('/').filter(Boolean), query: new URLSearchParams(qs ?? '') };
}

export function navigate(to: string, replace = false): void {
  const url = `#${to}`;
  if (replace) window.history.replaceState(null, '', url);
  else window.history.pushState(null, '', url);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

interface AppCtx {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  L: (de: string, en: string) => string;
  lang: 'de' | 'en';
  route: Route;
  dataVersion: number;
  bump: () => void;
  toast: (msg: string) => void;
  caps: SpeechCapabilities;
  voices: SpeechSynthesisVoice[];
  haptic: () => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('AppProvider missing');
  return c;
}

/** Loads a snapshot of all data and reloads after every write (bump()). */
export function useSnapshot(): Snapshot | null {
  const { dataVersion } = useApp();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  useEffect(() => {
    let alive = true;
    loadSnapshot().then((s) => alive && setSnap(s));
    return () => {
      alive = false;
    };
  }, [dataVersion]);
  return snap;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [route, setRoute] = useState<Route>(parseHash);
  const [dataVersion, setDataVersion] = useState(0);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [caps, setCaps] = useState<SpeechCapabilities>(detectSpeechCapabilities);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const toastTimer = useRef<number | undefined>(undefined);
  const hapticRef = useRef<HTMLLabelElement>(null);

  useEffect(() => {
    getSettings().then(setSettings);
    loadVoices().then(setVoices);
    const onHash = () => setRoute(parseHash());
    const onNet = () => setCaps(detectSpeechCapabilities());
    window.addEventListener('hashchange', onHash);
    window.addEventListener('popstate', onHash);
    window.addEventListener('online', onNet);
    window.addEventListener('offline', onNet);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('popstate', onHash);
      window.removeEventListener('online', onNet);
      window.removeEventListener('offline', onNet);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
    root.lang = settings.uiLang;
    if (settings.profile === 'kid') root.dataset.profile = 'kid';
    else delete root.dataset.profile;
  }, [settings.theme, settings.uiLang, settings.profile]);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const next = await saveSettings(patch);
    setSettings(next);
  }, []);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2800);
  }, []);

  const haptic = useCallback(() => {
    if (!settings.haptics) return;
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(10);
      return;
    }
    // iOS 18+ Safari: toggling a native switch triggers the system haptic.
    hapticRef.current?.click();
  }, [settings.haptics]);

  const value = useMemo<AppCtx>(
    () => ({
      settings,
      updateSettings,
      lang: settings.uiLang,
      L: (de: string, en: string) => (settings.uiLang === 'en' ? en : de),
      route,
      dataVersion,
      bump: () => setDataVersion((v) => v + 1),
      toast,
      caps,
      voices,
      haptic,
    }),
    [settings, updateSettings, route, dataVersion, toast, caps, voices, haptic],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <label ref={hapticRef} className="haptic-switch" aria-hidden="true">
        {/* @ts-expect-error – non-standard iOS "switch" attribute */}
        <input type="checkbox" switch="" tabIndex={-1} />
      </label>
      {toastMsg && (
        <div className="toast-wrap" role="status" aria-live="polite">
          <div className="toast">{toastMsg}</div>
        </div>
      )}
    </Ctx.Provider>
  );
}
