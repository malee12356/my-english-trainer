import { useMemo } from 'react';
import { BADGES, badgeStats, levelInfo, robotStage, totalXp, type BadgeStats } from '../../domain/gamification';
import { summarize } from '../../domain/summary';
import type { Snapshot } from '../../db/repo';
import { useApp } from '../../state';
import { Robot, type RobotMood } from '../../ui/Robot';

export interface KidProgress {
  xp: number;
  level: ReturnType<typeof levelInfo>;
  stage: ReturnType<typeof robotStage>;
  stats: BadgeStats;
}

export function useKidProgress(snap: Snapshot | null): KidProgress | null {
  return useMemo(() => {
    if (!snap) return null;
    const now = new Date();
    const sum = summarize(snap.items, snap.progress, snap.logs, snap.sessions, now);
    const xp = totalXp(snap.logs, snap.sessions);
    const level = levelInfo(xp);
    return { xp, level, stage: robotStage(level.level), stats: badgeStats(snap.logs, snap.sessions, snap.progress, sum.mastered, now) };
  }, [snap]);
}

/** Level card: robot + level + XP bar. */
export function LevelCard({ kp, mood = 'happy', children }: { kp: KidProgress; mood?: RobotMood; children?: React.ReactNode }) {
  const { L } = useApp();
  return (
    <section className="hero" aria-label={L('Dein Level', 'Your level')}>
      <div className="row" style={{ alignItems: 'center' }}>
        <Robot mood={mood} stage={kp.stage.stage} size={92} label={kp.stage.nameDe} />
        <div className="grow">
          <div className="muted small">{kp.stage.nameDe}</div>
          <div style={{ fontSize: 26, fontWeight: 850 }}>Level {kp.level.level}</div>
          <div className="xp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(kp.level.progress * 100)} aria-label="XP">
            <div style={{ width: `${Math.max(4, kp.level.progress * 100)}%` }} />
          </div>
          <div className="small" style={{ marginTop: 4 }}>
            ⭐ {kp.xp} XP · {L(`noch ${kp.level.xpToNext} bis Level ${kp.level.level + 1}`, `${kp.level.xpToNext} to level ${kp.level.level + 1}`)}
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}

export function BadgeGrid({ stats, highlight = [] }: { stats: BadgeStats; highlight?: string[] }) {
  const { lang } = useApp();
  return (
    <div className="badge-grid">
      {BADGES.map((b) => {
        const earned = b.earned(stats);
        return (
          <div key={b.id} className={`badge-tile ${earned ? '' : 'locked'} ${highlight.includes(b.id) ? 'new' : ''}`} title={lang === 'de' ? b.descDe : b.descEn}>
            <div className="emoji" aria-hidden="true">{b.emoji}</div>
            <div className="name">{lang === 'de' ? b.de : b.en}</div>
            <div className="desc">{earned ? (lang === 'de' ? b.descDe : b.descEn) : `${Math.round(b.progress(stats) * 100)} %`}</div>
            <span className="sr-only">{earned ? 'erreicht' : 'noch nicht erreicht'}</span>
          </div>
        );
      })}
    </div>
  );
}

const COLORS = ['#f472b6', '#facc15', '#38bdf8', '#34d399', '#a78bfa', '#fb923c'];
export function Confetti({ pieces = 60 }: { pieces?: number }) {
  const items = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        color: COLORS[i % COLORS.length],
        rotate: Math.random() * 360,
      })),
    [pieces],
  );
  return (
    <div className="confetti" aria-hidden="true">
      {items.map((p, i) => (
        <i key={i} style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s`, transform: `rotate(${p.rotate}deg)` }} />
      ))}
    </div>
  );
}
