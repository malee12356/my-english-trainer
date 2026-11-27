import { useMemo, useState } from 'react';
import { buildPrompt, CONTENT_KINDS, DEFAULT_PROMPT_OPTIONS, type ContentKind, type PromptOptions } from '../domain/promptBuilder';
import { TOPIC_MODES } from '../domain/topics';
import { CEFR_LEVELS } from '../domain/types';
import { useApp } from '../state';
import { NavBar } from '../ui/components';
import { copyText } from '../ui/files';
import { IconCopy } from '../ui/icons';

const STORE_KEY = 'pet.promptOptions';
function loadOpts(): PromptOptions {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? { ...DEFAULT_PROMPT_OPTIONS, ...(JSON.parse(raw) as Partial<PromptOptions>) } : DEFAULT_PROMPT_OPTIONS;
  } catch {
    return DEFAULT_PROMPT_OPTIONS;
  }
}

export function PromptAssistant() {
  const { L, lang, toast } = useApp();
  const [o, setO] = useState<PromptOptions>(loadOpts);
  const prompt = useMemo(() => buildPrompt(o), [o]);
  const set = (patch: Partial<PromptOptions>) => {
    const next = { ...o, ...patch };
    setO(next);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {
      /* per-device convenience only */
    }
  };
  const toggleKind = (k: ContentKind) => set({ kinds: o.kinds.includes(k) ? o.kinds.filter((x) => x !== k) : [...o.kinds, k] });

  return (
    <main className="page">
      <NavBar title={L('ChatGPT-Import', 'ChatGPT import')} back="/settings" />
      <ol className="small muted" style={{ paddingLeft: 20, margin: '4px 0 16px' }}>
        <li>{L('Prompt unten konfigurieren und kopieren.', 'Configure and copy the prompt below.')}</li>
        <li>{L('In deinem English-Projekt in ChatGPT einfügen.', 'Paste it into your English project in ChatGPT.')}</li>
        <li>{L('In der Antwort beim Codeblock (dunkler Kasten) oben rechts auf „Kopieren“ tippen – nicht die ganze Nachricht kopieren.', 'In the answer, tap “Copy” at the top right of the code block – do not copy the whole message.')}</li>
        <li>{L('Hier „Zum Import“ → „Einfügen“ → „Aus Zwischenablage einfügen“ → Vorschau prüfen → bestätigen.', 'Here: “To import” → “Paste” → “Paste from clipboard” → check preview → confirm.')}</li>
      </ol>

      <div className="card stack">
        <div className="grid-2">
          <label className="field"><span>{L('Anzahl', 'Count')}</span>
            <select className="select" value={o.count} onChange={(e) => set({ count: Number(e.target.value) })}>
              {[10, 20, 30, 40, 50, 75, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="field"><span>{L('Niveau', 'Level')}</span>
            <select className="select" value={o.level} onChange={(e) => set({ level: e.target.value as PromptOptions['level'] })}>
              <option value="auto">{L('automatisch', 'automatic')}</option>
              {CEFR_LEVELS.filter((l) => l !== 'A1' && l !== 'C2').map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
        </div>
        <label className="field"><span>{L('Thema', 'Topic')}</span>
          <select className="select" value={o.topic} onChange={(e) => set({ topic: e.target.value })}>
            <option value="mixed">{L('Gemischt', 'Mixed')}</option>
            {TOPIC_MODES.map((t) => <option key={t.id} value={t.id}>{lang === 'de' ? t.nameDe : t.name}</option>)}
          </select>
        </label>
        <label className="field"><span>{L('Lernmodus-Fokus', 'Practice focus')}</span>
          <select className="select" value={o.focusMethod} onChange={(e) => set({ focusMethod: e.target.value as PromptOptions['focusMethod'] })}>
            <option value="mixed">{L('Gemischt', 'Mixed')}</option>
            <option value="flashcards">{L('Karteikarten', 'Flashcards')}</option>
            <option value="writing">Writing</option>
            <option value="speaking">Speaking</option>
            <option value="listening">Listening</option>
          </select>
        </label>
        <div className="field">
          <span>{L('Inhalte', 'Content')}</span>
          <div className="chips wrap">
            {CONTENT_KINDS.map((k) => (
              <button key={k.id} type="button" className="chip" aria-pressed={o.kinds.includes(k.id)} onClick={() => toggleKind(k.id)}>
                {lang === 'de' ? k.de : k.en}
              </button>
            ))}
          </div>
        </div>
        <label className="field"><span>{L('Zusätzliche Wünsche (optional)', 'Additional wishes (optional)')}</span>
          <input className="input" value={o.extraNote ?? ''} onChange={(e) => set({ extraNote: e.target.value })} placeholder={L('z. B. Fokus auf Konvergenzprobleme', 'e.g. focus on convergence problems')} />
        </label>
      </div>

      <h2 className="section-title">Prompt</h2>
      <pre className="prompt" lang="en" tabIndex={0}>{prompt}</pre>
      <div className="sticky-actions">
        <button className="btn grow" onClick={async () => toast((await copyText(prompt)) ? L('Prompt kopiert ✓', 'Prompt copied ✓') : L('Kopieren nicht möglich – Text bitte markieren.', 'Copy failed – please select the text.'))}>
          <IconCopy size={20} /> {L('Prompt kopieren', 'Copy prompt')}
        </button>
        <a className="btn secondary" href="#/import">{L('Zum Import', 'To import')}</a>
      </div>
      <p className="tiny muted">{L('Die App sendet nichts an ChatGPT. Es gibt keine API-Verbindung – du kopierst nur Text.', 'The app sends nothing to ChatGPT. There is no API connection – you only copy text.')}</p>
    </main>
  );
}
