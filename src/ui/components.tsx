import { useEffect, useRef, useState, type ReactNode } from 'react';
import { navigate, useApp } from '../state';
import { chosenVoice, sleep, speak, stopSpeaking, ttsSupported } from '../speech/tts';
import { IconBack, IconChevron, IconSpeaker } from './icons';

export function NavBar({ title, back, right }: { title: string; back?: string | (() => void); right?: ReactNode }) {
  const { L } = useApp();
  const onBack = () => (typeof back === 'function' ? back() : back ? navigate(back) : window.history.back());
  return (
    <div className="nav-bar">
      <div className="spacer">
        {back !== undefined && (
          <button className="btn ghost" onClick={onBack} aria-label={L('Zurück', 'Back')}>
            <IconBack size={22} /> {L('Zurück', 'Back')}
          </button>
        )}
      </div>
      <div className="title">{title}</div>
      <div className="spacer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {right}
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <span className="toggle">
      <input type="checkbox" role="switch" checked={checked} aria-label={label} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
    </span>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="grabber" />
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** Promise-based confirm dialog. */
export function useConfirm() {
  const { L } = useApp();
  const [state, setState] = useState<{ title: string; text: string; danger?: boolean; ok: string; resolve: (v: boolean) => void } | null>(null);
  const confirm = (title: string, text: string, opts: { danger?: boolean; ok?: string } = {}) =>
    new Promise<boolean>((resolve) => setState({ title, text, danger: opts.danger, ok: opts.ok ?? L('Bestätigen', 'Confirm'), resolve }));
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  const dialog = (
    <Sheet open={!!state} onClose={() => close(false)} title={state?.title ?? ''}>
      <p className="muted break">{state?.text}</p>
      <div className="stack">
        <button className={`btn block ${state?.danger ? 'danger' : ''}`} onClick={() => close(true)}>
          {state?.ok}
        </button>
        <button className="btn block secondary" onClick={() => close(false)}>
          {L('Abbrechen', 'Cancel')}
        </button>
      </div>
    </Sheet>
  );
  return { confirm, dialog };
}

/** Speaks English text with the configured voice. Hidden when TTS is unsupported. */
export function SpeakButton({ text, lang = 'en', label, size = 44, className = '' }: { text: string; lang?: 'en' | 'de'; label?: string; size?: number; className?: string }) {
  const { settings, voices, L, toast } = useApp();
  const [busy, setBusy] = useState(false);
  if (!ttsSupported() || !text) return null;
  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) {
      stopSpeaking();
      setBusy(false);
      return;
    }
    setBusy(true);
    const voice = lang === 'en' ? chosenVoice(settings.voiceURI, voices) : undefined;
    for (let i = 0; i < Math.max(1, settings.repeatCount); i++) {
      if (i > 0) await sleep(settings.pauseMs);
      const r = await speak(text, { lang: lang === 'en' ? settings.accent : 'de-DE', rate: settings.rate, voice });
      if (r.status === 'error') {
        toast(
          r.error === 'not-allowed'
            ? L('Vorlesen blockiert – bitte direkt auf den Lautsprecher tippen.', 'Speech blocked – tap the speaker button directly.')
            : r.error === 'no-start'
              ? L('Kein Ton? Stummschalter und Lautstärke prüfen, ggf. in Einstellungen eine andere Stimme wählen.', 'No sound? Check silent switch and volume, or choose another voice in Settings.')
              : L(`Vorlesen fehlgeschlagen (${r.error ?? 'Fehler'}). Einstellungen → Sprache testen → Vorlesen testen.`, `Speech failed (${r.error ?? 'error'}).`),
        );
        break;
      }
    }
    setBusy(false);
  };
  return (
    <button
      type="button"
      className={`icon-btn ${className}`}
      style={{ width: size, height: size }}
      onClick={onClick}
      aria-label={label ?? L('Vorlesen', 'Listen')}
      aria-pressed={busy}
    >
      <IconSpeaker size={Math.round(size * 0.5)} />
    </button>
  );
}

export function ProgressRing({ value, size = 76, stroke = 8, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} className="ring" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.25)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#fff" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontWeight: 750 }}>{children}</div>
    </div>
  );
}

export interface BarDatum {
  label: string;
  value: number;
  title?: string;
}
export function BarChart({ data, color, unit = '', ariaLabel, height = 120 }: { data: BarDatum[]; color?: string; unit?: string; ariaLabel: string; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const showEvery = data.length > 14 ? Math.ceil(data.length / 7) : 1;
  return (
    <figure style={{ margin: 0 }}>
      <div className="bars" style={{ height, gap: data.length > 30 ? 2 : 6 }} role="img" aria-label={ariaLabel}>
        {data.map((d, i) => (
          <div className="bar-col" key={i} title={d.title ?? `${d.label}: ${d.value}${unit}`}>
            <div className={`bar ${d.value === 0 ? 'empty' : ''}`} style={{ height: `${Math.max(3, (d.value / max) * (height - 22))}px`, background: d.value ? color : undefined }} />
            <span className="bar-label">{i % showEvery === 0 ? d.label : ' '}</span>
          </div>
        ))}
      </div>
      <figcaption className="sr-only">
        {data.map((d) => `${d.label}: ${d.value}${unit}`).join(', ')}
      </figcaption>
    </figure>
  );
}

export function ListLink({ to, icon, title, subtitle, right, onClick }: { to?: string; icon?: ReactNode; title: string; subtitle?: string; right?: ReactNode; onClick?: () => void }) {
  const content = (
    <>
      {icon && <span className="icon-badge">{icon}</span>}
      <span className="main">
        <span className="primary" style={{ display: 'block' }}>{title}</span>
        {subtitle && <span className="secondary" style={{ display: 'block' }}>{subtitle}</span>}
      </span>
      {right}
      <IconChevron className="chevron" />
    </>
  );
  if (to) return <a className="list-item" href={`#${to}`}>{content}</a>;
  return <button type="button" className="list-item" onClick={onClick}>{content}</button>;
}

export function Empty({ emoji, title, text, children }: { emoji: string; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="empty card flat">
      <div className="emoji" aria-hidden="true">{emoji}</div>
      <h3 style={{ color: 'var(--text)' }}>{title}</h3>
      {text && <p className="small">{text}</p>}
      {children}
    </div>
  );
}
