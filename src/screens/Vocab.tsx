import { useMemo, useState } from 'react';
import { itemsToCsv, itemsToImportJson } from '../db/backup';
import { bulkUpdate, createCategory, createCollection, deleteItems, updateItem } from '../db/repo';
import { weakness } from '../domain/planner';
import { summarize } from '../domain/summary';
import { normalize } from '../domain/text';
import { listUnits } from '../domain/scope';
import { CEFR_LEVELS, ITEM_TYPES, type Collection, type Item } from '../domain/types';
import { navigate, useApp, useSnapshot } from '../state';
import { Empty, Sheet, SpeakButton, useConfirm } from '../ui/components';
import { dateStamp, saveFile } from '../ui/files';
import { IconPlus, IconSearch, IconStar } from '../ui/icons';

type StatusFilter = 'all' | 'new' | 'learning' | 'mastered' | 'difficult' | 'due' | 'favorites' | 'archived';
type Sort = 'recent' | 'az' | 'due' | 'difficulty';
const PAGE = 100;

export function Vocab() {
  const { L, lang, route, bump, toast } = useApp();
  const snap = useSnapshot();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>((route.query.get('status') as StatusFilter) ?? 'all');
  const [cat, setCat] = useState(route.query.get('cat') ?? '');
  const [level, setLevel] = useState('');
  const [type, setType] = useState('');
  const [coll, setColl] = useState('');
  const [unitF, setUnitF] = useState(route.query.get('unit') ?? '');
  const [sort, setSort] = useState<Sort>('recent');
  const [limit, setLimit] = useState(PAGE);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState<null | 'filter' | 'category' | 'collection' | 'export'>(null);
  const [newName, setNewName] = useState('');
  const { confirm, dialog } = useConfirm();
  const now = useMemo(() => new Date(), [snap]);
  const sum = useMemo(() => (snap ? summarize(snap.items, snap.progress, snap.logs, snap.sessions, now) : null), [snap, now]);

  const filtered = useMemo(() => {
    if (!snap || !sum) return [];
    const nq = normalize(q);
    let list = snap.items.filter((it) => {
      if (status === 'archived') {
        if (!it.archived) return false;
      } else if (it.archived) return false;
      const st = sum.statusById.get(it.id);
      if (status === 'favorites' && !it.favorite) return false;
      if (status === 'due' && !st?.dueSkills.length) return false;
      if (['new', 'learning', 'mastered', 'difficult'].includes(status) && st?.status !== status) return false;
      if (cat && !it.categories.includes(cat)) return false;
      if (level && it.level !== level) return false;
      if (type && it.type !== type) return false;
      if (coll && !it.collections.includes(coll)) return false;
      if (unitF && it.unit !== unitF) return false;
      if (nq) {
        const hay = normalize([it.english, it.german, ...it.tags, ...it.alternatives_en, ...it.alternatives_de, it.notes ?? '', it.example_en ?? ''].join(' '));
        if (!hay.includes(nq)) return false;
      }
      return true;
    });
    const dueOf = (it: Item) => Math.min(...snap.progress.filter((p) => p.itemId === it.id && p.reps > 0).map((p) => +new Date(p.due)), Infinity);
    if (sort === 'az') list = list.sort((a, b) => a.english.localeCompare(b.english, 'en', { sensitivity: 'base' }));
    else if (sort === 'due') list = list.sort((a, b) => dueOf(a) - dueOf(b));
    else if (sort === 'difficulty') list = list.sort((a, b) => weakness(b, sum.index.get(b.id)).score - weakness(a, sum.index.get(a.id)).score);
    else list = list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return list;
  }, [snap, sum, q, status, cat, level, type, coll, sort, unitF]);

  if (!snap || !sum) return <main className="page" aria-busy="true" />;

  const toggle = (id: string) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelected(s);
  };
  const ids = [...selected];
  const selItems = snap.items.filter((i) => selected.has(i.id));
  const done = (msg: string) => {
    bump();
    toast(msg);
    setSheet(null);
  };

  const statusChips: { id: StatusFilter; de: string; en: string }[] = [
    { id: 'all', de: 'Alle', en: 'All' },
    { id: 'due', de: 'Fällig', en: 'Due' },
    { id: 'new', de: 'Neu', en: 'New' },
    { id: 'learning', de: 'Lernen', en: 'Learning' },
    { id: 'mastered', de: 'Sicher', en: 'Mastered' },
    { id: 'difficult', de: 'Schwierig', en: 'Difficult' },
    { id: 'favorites', de: 'Favoriten', en: 'Favourites' },
    { id: 'archived', de: 'Archiv', en: 'Archive' },
  ];
  const statusBadge = (id: string) => {
    const st = sum.statusById.get(id)?.status;
    if (st === 'mastered') return <span className="badge green">{L('sicher', 'mastered')}</span>;
    if (st === 'difficult') return <span className="badge red">{L('schwierig', 'difficult')}</span>;
    if (st === 'new') return <span className="badge accent">{L('neu', 'new')}</span>;
    return null;
  };
  const activeFilters = [cat, level, type, coll, unitF].filter(Boolean).length;

  return (
    <main className="page">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 className="large-title">{L('Vokabeln', 'Vocabulary')}</h1>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn ghost" onClick={() => { setSelecting(!selecting); setSelected(new Set()); }}>
            {selecting ? L('Fertig', 'Done') : L('Auswählen', 'Select')}
          </button>
          <a className="icon-btn" href="#/item/new" aria-label={L('Neuer Eintrag', 'New item')}><IconPlus size={22} /></a>
        </div>
      </div>

      <div className="search">
        <IconSearch />
        <input className="input" type="search" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder={L('Suchen (Englisch, Deutsch, Tags …)', 'Search (English, German, tags …)')} aria-label={L('Suchen', 'Search')} />
      </div>

      <div className="chips" style={{ marginTop: 12 }} role="group" aria-label={L('Status', 'Status')}>
        {statusChips.map((c) => (
          <button key={c.id} className="chip" aria-pressed={status === c.id} onClick={() => { setStatus(c.id); setLimit(PAGE); }}>
            {lang === 'de' ? c.de : c.en}
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
        <span className="small muted">{filtered.length} {L('Einträge', 'items')}</span>
        <div className="row" style={{ gap: 6 }}>
          <select className="select" style={{ minHeight: 38, padding: '6px 32px 6px 10px', fontSize: 15, width: 'auto', backgroundPosition: 'calc(100% - 18px) 16px, calc(100% - 12px) 16px' }} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label={L('Sortieren', 'Sort')}>
            <option value="recent">{L('Neueste', 'Newest')}</option>
            <option value="az">A–Z</option>
            <option value="due">{L('Fälligkeit', 'Due date')}</option>
            <option value="difficulty">{L('Schwierigkeit', 'Difficulty')}</option>
          </select>
          <button className="btn small secondary" onClick={() => setSheet('filter')}>
            {L('Filter', 'Filter')}{activeFilters ? ` (${activeFilters})` : ''}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        {snap.items.length === 0 ? (
          <Empty emoji="🗂️" title={L('Noch keine Vokabeln', 'No vocabulary yet')}>
            <div className="stack">
              <a className="btn block" href="#/import">{L('Importieren', 'Import')}</a>
              <a className="btn block secondary" href="#/item/new">{L('Manuell hinzufügen', 'Add manually')}</a>
            </div>
          </Empty>
        ) : filtered.length === 0 ? (
          <Empty emoji="🔍" title={L('Keine Treffer', 'No results')} />
        ) : (
          <div className="list">
            {filtered.slice(0, limit).map((it) => (
              <div key={it.id} className="list-item">
                {selecting && (
                  <input type="checkbox" className="check" checked={selected.has(it.id)} onChange={() => toggle(it.id)} aria-label={`${L('Auswählen', 'Select')}: ${it.english}`} />
                )}
                <button
                  className="main"
                  style={{ background: 'none', border: 0, textAlign: 'left', padding: 0, cursor: 'pointer', minHeight: 44 }}
                  onClick={() => (selecting ? toggle(it.id) : navigate(`/item/${it.id}`))}
                >
                  <span className="primary" style={{ display: 'block' }} lang="en">{it.english}</span>
                  <span className="secondary" style={{ display: 'block' }} lang="de">{it.german}</span>
                  <span className="row wrap" style={{ gap: 4, marginTop: 4 }}>
                    {statusBadge(it.id)}
                    {it.level && <span className="badge">{it.level}</span>}
                    {it.unit && <span className="badge accent">{it.unit}</span>}
                    {it.page !== undefined && <span className="badge">S. {it.page}</span>}
                    {it.categories.slice(0, 2).map((c) => (
                      <span key={c} className="badge">{snap.categories.find((x) => x.id === c)?.name ?? c}</span>
                    ))}
                  </span>
                </button>
                {!selecting && (
                  <>
                    <SpeakButton text={it.english} size={38} />
                    <button className="icon-btn plain" style={{ color: it.favorite ? 'var(--orange)' : 'var(--text-3)' }} aria-pressed={it.favorite} aria-label={L('Favorit', 'Favourite')} onClick={async () => { await updateItem(it.id, { favorite: !it.favorite }); bump(); }}>
                      <IconStar filled={it.favorite} size={22} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        {filtered.length > limit && (
          <button className="btn block secondary mt" onClick={() => setLimit(limit + PAGE)}>{L('Mehr anzeigen', 'Show more')} ({filtered.length - limit})</button>
        )}
      </div>

      {selecting && (
        <div className="sticky-actions" role="toolbar" aria-label={L('Aktionen für Auswahl', 'Actions for selection')}>
          <button className="btn small secondary" onClick={() => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((i) => i.id)))}>
            {selected.size === filtered.length ? L('Keine', 'None') : L('Alle', 'All')}
          </button>
          <button className="btn small secondary" disabled={!ids.length} onClick={() => setSheet('category')}>{L('Kategorie', 'Category')}</button>
          <button className="btn small secondary" disabled={!ids.length} onClick={() => setSheet('collection')}>{L('Sammlung', 'Collection')}</button>
          <button className="btn small secondary" disabled={!ids.length} onClick={async () => {
            const arch = status !== 'archived';
            await bulkUpdate(ids, (i) => ({ ...i, archived: arch }));
            setSelected(new Set());
            done(arch ? L(`${ids.length} archiviert`, `${ids.length} archived`) : L(`${ids.length} wiederhergestellt`, `${ids.length} restored`));
          }}>
            {status === 'archived' ? L('Zurückholen', 'Unarchive') : L('Archivieren', 'Archive')}
          </button>
          <button className="btn small secondary" disabled={!ids.length} onClick={() => setSheet('export')}>{L('Export', 'Export')}</button>
          <button className="btn small danger" disabled={!ids.length} onClick={async () => {
            if (await confirm(L(`${ids.length} Einträge löschen?`, `Delete ${ids.length} items?`), L('Inhalte und Lernfortschritt dieser Einträge werden dauerhaft gelöscht. Archivieren ist die umkehrbare Alternative.', 'Content and learning progress will be deleted permanently. Archiving is the reversible alternative.'), { danger: true, ok: L('Endgültig löschen', 'Delete permanently') })) {
              await deleteItems(ids);
              setSelected(new Set());
              done(L('Gelöscht', 'Deleted'));
            }
          }}>
            {L('Löschen', 'Delete')} {ids.length ? `(${ids.length})` : ''}
          </button>
        </div>
      )}

      <Sheet open={sheet === 'filter'} onClose={() => setSheet(null)} title={L('Filter', 'Filter')}>
        <div className="stack">
          <label className="field"><span>{L('Kategorie / Themenmodus', 'Category / topic mode')}</span>
            <select className="select" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">{L('Alle', 'All')}</option>
              {snap.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="field"><span>{L('Sprachniveau', 'Level')}</span>
            <select className="select" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">{L('Alle', 'All')}</option>
              {CEFR_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <label className="field"><span>{L('Typ', 'Type')}</span>
            <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">{L('Alle', 'All')}</option>
              {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          {listUnits(snap.items).length > 0 && (
            <label className="field"><span>Unit</span>
              <select className="select" value={unitF} onChange={(e) => setUnitF(e.target.value)}>
                <option value="">{L('Alle', 'All')}</option>
                {listUnits(snap.items).map((u) => <option key={u.unit} value={u.unit}>{u.unit} ({u.count})</option>)}
              </select>
            </label>
          )}
          <label className="field"><span>{L('Eigene Sammlung', 'Collection')}</span>
            <select className="select" value={coll} onChange={(e) => setColl(e.target.value)}>
              <option value="">{L('Alle', 'All')}</option>
              {snap.collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <button className="btn block" onClick={() => setSheet(null)}>{L('Anwenden', 'Apply')}</button>
          <button className="btn block secondary" onClick={() => { setCat(''); setLevel(''); setType(''); setColl(''); setUnitF(''); }}>{L('Zurücksetzen', 'Reset')}</button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'category'} onClose={() => setSheet(null)} title={L('Kategorien ändern', 'Change categories')}>
        <p className="small muted">{L(`${ids.length} ausgewählte Einträge`, `${ids.length} selected items`)}</p>
        <div className="list">
          {snap.categories.map((c) => {
            const has = selItems.filter((i) => i.categories.includes(c.id)).length;
            return (
              <div key={c.id} className="list-item">
                <span className="main"><span className="primary">{c.name}</span> <span className="tiny muted">{has}/{ids.length}</span></span>
                <button className="btn small secondary" onClick={async () => { await bulkUpdate(ids, (i) => ({ ...i, categories: Array.from(new Set([...i.categories, c.id])) })); done(L('Kategorie hinzugefügt', 'Category added')); }}>+</button>
                <button className="btn small secondary" onClick={async () => { await bulkUpdate(ids, (i) => ({ ...i, categories: i.categories.filter((x) => x !== c.id) })); done(L('Kategorie entfernt', 'Category removed')); }}>−</button>
              </div>
            );
          })}
        </div>
        <form className="row mt" onSubmit={async (e) => { e.preventDefault(); if (!newName.trim()) return; const c = await createCategory(newName); await bulkUpdate(ids, (i) => ({ ...i, categories: Array.from(new Set([...i.categories, c.id])) })); setNewName(''); done(L('Neue Kategorie angelegt', 'New category created')); }}>
          <input className="input grow" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={L('Neue Kategorie …', 'New category …')} aria-label={L('Neue Kategorie', 'New category')} />
          <button className="btn" type="submit">{L('Anlegen', 'Create')}</button>
        </form>
      </Sheet>

      <Sheet open={sheet === 'collection'} onClose={() => setSheet(null)} title={L('Zu Sammlung hinzufügen', 'Add to collection')}>
        <CollectionPicker ids={ids} cols={snap.collections} onDone={done} />
      </Sheet>

      <Sheet open={sheet === 'export'} onClose={() => setSheet(null)} title={L('Auswahl exportieren', 'Export selection')}>
        <div className="stack">
          <button className="btn block" onClick={async () => { await saveFile(`vocabulary-${dateStamp()}.json`, itemsToImportJson(selItems, snap.categories), 'application/json'); setSheet(null); }}>JSON ({L('Importformat', 'import format')})</button>
          <button className="btn block secondary" onClick={async () => { await saveFile(`vocabulary-${dateStamp()}.csv`, itemsToCsv(selItems, snap.categories), 'text/csv'); setSheet(null); }}>CSV</button>
          <p className="tiny muted">{L('Exportiert nur Inhalte ohne Lernfortschritt. Für eine vollständige Sicherung: Einstellungen → Backup.', 'Exports content only, no progress. For a full backup: Settings → Backup.')}</p>
        </div>
      </Sheet>
      {dialog}
    </main>
  );
}

function CollectionPicker({ ids, cols, onDone }: { ids: string[]; cols: Collection[]; onDone: (msg: string) => void }) {
  const { L } = useApp();
  const [name, setName] = useState('');
  const add = async (cid: string) => {
    await bulkUpdate(ids, (i) => ({ ...i, collections: Array.from(new Set([...i.collections, cid])) }));
    onDone(L('Zur Sammlung hinzugefügt', 'Added to collection'));
  };
  return (
    <div className="stack">
      {cols.length > 0 && (
        <div className="list">
          {cols.map((c) => (
            <button key={c.id} className="list-item" onClick={() => add(c.id)}>
              <span className="main primary">{c.name}</span>
            </button>
          ))}
        </div>
      )}
      <form className="row" onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) return; const id = await createCollection(name); await add(id); }}>
        <input className="input grow" value={name} onChange={(e) => setName(e.target.value)} placeholder={L('Neue Sammlung …', 'New collection …')} aria-label={L('Neue Sammlung', 'New collection')} />
        <button className="btn" type="submit">{L('Anlegen', 'Create')}</button>
      </form>
    </div>
  );
}
