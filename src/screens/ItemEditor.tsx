import { useEffect, useMemo, useState } from 'react';
import { addItem, deleteItems, updateItem } from '../db/repo';
import { retrievability, STATE } from '../domain/scheduler';
import { itemKey } from '../domain/text';
import { CEFR_LEVELS, ITEM_TYPES, SKILLS, type CefrLevel, type Item, type ItemType, type Skill } from '../domain/types';
import { navigate, useApp, useSnapshot } from '../state';
import { NavBar, SpeakButton, Toggle, useConfirm } from '../ui/components';

interface Form {
  english: string;
  german: string;
  type: ItemType;
  level: CefrLevel | '';
  categories: string[];
  tags: string;
  alternatives_en: string;
  alternatives_de: string;
  example_en: string;
  example_de: string;
  ipa: string;
  notes: string;
  common_mistake: string;
  explanation: string;
  favorite: boolean;
  archived: boolean;
}

const empty: Form = {
  english: '', german: '', type: 'phrase', level: '', categories: [], tags: '', alternatives_en: '', alternatives_de: '',
  example_en: '', example_de: '', ipa: '', notes: '', common_mistake: '', explanation: '', favorite: false, archived: false,
};

const toForm = (i: Item): Form => ({
  english: i.english, german: i.german, type: i.type, level: i.level ?? '', categories: i.categories, tags: i.tags.join(', '),
  alternatives_en: i.alternatives_en.join('\n'), alternatives_de: i.alternatives_de.join('\n'), example_en: i.example_en ?? '',
  example_de: i.example_de ?? '', ipa: i.ipa ?? '', notes: i.notes ?? '', common_mistake: i.common_mistake ?? '',
  explanation: i.explanation ?? '', favorite: i.favorite, archived: i.archived,
});

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const opt = (s: string) => (s.trim() ? s.trim() : undefined);

const SKILL_LABEL: Record<Skill, [string, string]> = {
  comprehension: ['Verstehen (EN→DE)', 'Comprehension (EN→DE)'],
  recall: ['Abrufen (DE→EN)', 'Recall (DE→EN)'],
  writing: ['Schreiben', 'Writing'],
  listening: ['Hören', 'Listening'],
  speaking: ['Sprechen', 'Speaking'],
};

export function ItemEditor({ id }: { id: string }) {
  const { L, lang, bump, toast } = useApp();
  const snap = useSnapshot();
  const isNew = id === 'new';
  const item = snap?.items.find((i) => i.id === id);
  const [form, setForm] = useState<Form>(empty);
  const [loaded, setLoaded] = useState(isNew);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    if (item && !loaded) {
      setForm(toForm(item));
      setLoaded(true);
    }
  }, [item, loaded]);

  const duplicate = useMemo(() => {
    if (!snap || !form.english.trim()) return null;
    const k = itemKey(form.english);
    return snap.items.find((i) => i.key === k && i.id !== id) ?? null;
  }, [snap, form.english, id]);

  if (!snap) return <main className="page" aria-busy="true" />;
  if (!isNew && !item) {
    return (
      <main className="page">
        <NavBar title="" back="/vocab" />
        <p className="muted">{L('Eintrag nicht gefunden.', 'Item not found.')}</p>
      </main>
    );
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.english.trim() && form.german.trim();

  const save = async () => {
    if (!valid) return;
    const data = {
      english: form.english, german: form.german, type: form.type, level: form.level || undefined, categories: form.categories,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean), alternatives_en: lines(form.alternatives_en),
      alternatives_de: lines(form.alternatives_de), example_en: opt(form.example_en), example_de: opt(form.example_de),
      ipa: opt(form.ipa), notes: opt(form.notes), common_mistake: opt(form.common_mistake), explanation: opt(form.explanation),
      favorite: form.favorite, archived: form.archived,
    };
    if (isNew) await addItem(data);
    else await updateItem(id, data);
    bump();
    toast(L('Gespeichert', 'Saved'));
    navigate('/vocab', true);
  };

  const remove = async () => {
    if (await confirm(L('Eintrag löschen?', 'Delete item?'), L('Inhalt und Lernfortschritt werden dauerhaft gelöscht.', 'Content and learning progress will be deleted permanently.'), { danger: true, ok: L('Löschen', 'Delete') })) {
      await deleteItems([id]);
      bump();
      navigate('/vocab', true);
    }
  };

  const progress = snap.progress.filter((p) => p.itemId === id);
  const now = new Date();
  const text = (k: keyof Form, label: string, o: { area?: boolean; lang?: string; placeholder?: string } = {}) => (
    <label className="field">
      <span>{label}</span>
      {o.area ? (
        <textarea className="textarea" style={{ minHeight: 80 }} value={form[k] as string} onChange={(e) => set(k, e.target.value as never)} lang={o.lang} placeholder={o.placeholder} />
      ) : (
        <input className="input" value={form[k] as string} onChange={(e) => set(k, e.target.value as never)} lang={o.lang} placeholder={o.placeholder} autoCapitalize="off" autoCorrect="off" />
      )}
    </label>
  );

  return (
    <main className="page">
      <NavBar title={isNew ? L('Neuer Eintrag', 'New item') : L('Bearbeiten', 'Edit')} back="/vocab" right={<button className="btn ghost" onClick={save} disabled={!valid}>{L('Sichern', 'Save')}</button>} />
      <div className="stack">
        <div className="row">
          <div className="grow">{text('english', L('Englisch *', 'English *'), { lang: 'en' })}</div>
          <div style={{ paddingTop: 20 }}><SpeakButton text={form.english} /></div>
        </div>
        {duplicate && (
          <div className="banner small">
            {L('Ähnlicher Eintrag existiert bereits:', 'A similar item already exists:')} <a href={`#/item/${duplicate.id}`}>{duplicate.english}</a>
          </div>
        )}
        {text('german', L('Deutsch *', 'German *'), { lang: 'de' })}
        <div className="grid-2">
          <label className="field"><span>{L('Typ', 'Type')}</span>
            <select className="select" value={form.type} onChange={(e) => set('type', e.target.value as ItemType)}>
              {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="field"><span>{L('Niveau', 'Level')}</span>
            <select className="select" value={form.level} onChange={(e) => set('level', e.target.value as CefrLevel | '')}>
              <option value="">–</option>
              {CEFR_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
        </div>
        <div className="field">
          <span>{L('Themenmodi / Kategorien', 'Topic modes / categories')}</span>
          <div className="chips wrap">
            {snap.categories.map((c) => (
              <button key={c.id} type="button" className="chip" aria-pressed={form.categories.includes(c.id)} onClick={() => set('categories', form.categories.includes(c.id) ? form.categories.filter((x) => x !== c.id) : [...form.categories, c.id])}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
        {text('example_en', L('Beispielsatz (EN)', 'Example (EN)'), { lang: 'en' })}
        {text('example_de', L('Beispielsatz (DE)', 'Example (DE)'), { lang: 'de' })}
        {text('alternatives_en', L('Alternative englische Antworten (eine pro Zeile)', 'Alternative English answers (one per line)'), { area: true, lang: 'en' })}
        {text('alternatives_de', L('Alternative deutsche Antworten (eine pro Zeile)', 'Alternative German answers (one per line)'), { area: true, lang: 'de' })}
        {text('ipa', 'IPA', { placeholder: '/ˈɪɡ.zæm.pəl/' })}
        {text('tags', L('Tags (kommagetrennt)', 'Tags (comma separated)'))}
        {text('common_mistake', L('Typischer Fehler', 'Common mistake'))}
        {text('explanation', L('Erklärung', 'Explanation'), { area: true })}
        {text('notes', L('Notizen', 'Notes'), { area: true })}
        <div className="list">
          <div className="list-item"><span className="main">{L('Favorit', 'Favourite')}</span><Toggle checked={form.favorite} onChange={(v) => set('favorite', v)} label={L('Favorit', 'Favourite')} /></div>
          <div className="list-item"><span className="main">{L('Archiviert', 'Archived')}</span><Toggle checked={form.archived} onChange={(v) => set('archived', v)} label={L('Archiviert', 'Archived')} /></div>
        </div>
        <button className="btn block big" onClick={save} disabled={!valid}>{L('Speichern', 'Save')}</button>

        {!isNew && item && (
          <>
            <h2 className="section-title">{L('Lernfortschritt', 'Learning progress')}</h2>
            {progress.length === 0 ? (
              <p className="small muted">{L('Noch nicht gelernt.', 'Not learned yet.')}</p>
            ) : (
              <div className="list">
                {SKILLS.filter((s) => progress.some((p) => p.skill === s)).map((s) => {
                  const p = progress.find((x) => x.skill === s)!;
                  const r = retrievability(p, now);
                  const state = [L('neu', 'new'), L('lernt', 'learning'), L('wiederholen', 'review'), L('neu lernen', 'relearning')][p.state];
                  return (
                    <div key={s} className="list-item" style={{ alignItems: 'flex-start' }}>
                      <span className="main">
                        <span className="primary" style={{ display: 'block' }}>{lang === 'de' ? SKILL_LABEL[s][0] : SKILL_LABEL[s][1]}</span>
                        <span className="secondary small" style={{ display: 'block' }}>
                          {state} · {p.reps}× {L('wiederholt', 'reviewed')} · {p.lapses} {L('vergessen', 'lapses')} · {p.correct}/{p.answered} {L('richtig', 'correct')}
                        </span>
                        <span className="secondary small" style={{ display: 'block' }}>
                          {L('Fällig', 'Due')}: {new Date(p.due).toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                          {p.state === STATE.Review && ` · ${L('Stabilität', 'Stability')} ${p.stability.toFixed(1)} ${L('T', 'd')}`}
                        </span>
                        {p.state !== STATE.New && (
                          <span className="secondary tiny" style={{ display: 'block' }}>
                            {L('Erinnerungswahrscheinlichkeit (FSRS-Schätzung)', 'Recall probability (FSRS estimate)')}: {Math.round(r * 100)}%
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="tiny muted">
              {L('Quelle', 'Source')}: {item.source ?? item.origin} · {L('angelegt', 'created')} {new Date(item.created_at).toLocaleDateString()} · {L('geändert', 'updated')} {new Date(item.updated_at).toLocaleDateString()}
            </p>
            <button className="btn block danger" onClick={remove}>{L('Eintrag löschen', 'Delete item')}</button>
          </>
        )}
      </div>
      {dialog}
    </main>
  );
}
