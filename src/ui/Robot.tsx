/**
 * "Robo" – the mascot of the kids profile. Pure SVG, no external assets.
 * The robot evolves with the learner's level (stage 1–5) and shows moods.
 */
export type RobotMood = 'happy' | 'cheer' | 'think' | 'encourage' | 'sleep';

const STAGE_COLORS = [
  { body: '#7dd3fc', dark: '#0284c7', accent: '#fde047' }, // 1 Mini-Robo: light blue
  { body: '#60a5fa', dark: '#1d4ed8', accent: '#f472b6' }, // 2 Robo: blue
  { body: '#a78bfa', dark: '#6d28d9', accent: '#34d399' }, // 3 Super-Robo: purple
  { body: '#fb923c', dark: '#c2410c', accent: '#22d3ee' }, // 4 Mega-Robo: orange
  { body: '#facc15', dark: '#a16207', accent: '#f43f5e' }, // 5 Champion: gold
];

export function Robot({ mood = 'happy', stage = 1, size = 120, label }: { mood?: RobotMood; stage?: number; size?: number; label?: string }) {
  const s = Math.min(5, Math.max(1, stage));
  const c = STAGE_COLORS[s - 1];
  const armsUp = mood === 'cheer';
  const eyes = (() => {
    switch (mood) {
      case 'sleep':
        return (
          <g stroke="#0f172a" strokeWidth="3" strokeLinecap="round" fill="none">
            <path d="M42 58 q6 5 12 0" />
            <path d="M66 58 q6 5 12 0" />
          </g>
        );
      case 'cheer':
        return (
          <g fill="#0f172a">
            <path d="M48 50 l2.4 5 5.4.6-4 3.7 1.1 5.3-4.9-2.7-4.9 2.7 1.1-5.3-4-3.7 5.4-.6z" fill={c.accent} stroke="#0f172a" strokeWidth="1" />
            <path d="M72 50 l2.4 5 5.4.6-4 3.7 1.1 5.3-4.9-2.7-4.9 2.7 1.1-5.3-4-3.7 5.4-.6z" fill={c.accent} stroke="#0f172a" strokeWidth="1" />
          </g>
        );
      case 'think':
        return (
          <g fill="#0f172a">
            <circle cx="50" cy="55" r="6" />
            <circle cx="74" cy="55" r="6" />
            <circle cx="52" cy="52" r="2" fill="#fff" />
            <circle cx="76" cy="52" r="2" fill="#fff" />
          </g>
        );
      default:
        return (
          <g fill="#0f172a">
            <circle cx="50" cy="57" r="6.5" />
            <circle cx="74" cy="57" r="6.5" />
            <circle cx="52.5" cy="54.5" r="2.2" fill="#fff" />
            <circle cx="76.5" cy="54.5" r="2.2" fill="#fff" />
          </g>
        );
    }
  })();
  const mouth = (() => {
    switch (mood) {
      case 'cheer':
        return <path d="M47 68 q15 16 30 0 z" fill="#0f172a" />;
      case 'think':
        return <path d="M55 72 h14" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />;
      case 'encourage':
        return <path d="M50 72 q12 7 24 0" stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" />;
      case 'sleep':
        return <ellipse cx="62" cy="71" rx="4" ry="3" fill="#0f172a" />;
      default:
        return <path d="M48 68 q14 12 28 0" stroke="#0f172a" strokeWidth="3.5" fill="none" strokeLinecap="round" />;
    }
  })();

  return (
    <svg
      width={size}
      height={size * (140 / 124)}
      viewBox="0 0 124 140"
      role="img"
      aria-label={label ?? 'Robo'}
      className={`robot robot-${mood}`}
    >
      {/* jetpack flames for stage 4+ */}
      {s >= 4 && (
        <g className="robot-flame">
          <path d="M30 112 q4 16 8 0 z" fill="#fb923c" />
          <path d="M86 112 q4 16 8 0 z" fill="#fb923c" />
        </g>
      )}
      {/* antenna */}
      <line x1="62" y1="22" x2="62" y2="10" stroke={c.dark} strokeWidth="4" strokeLinecap="round" />
      <circle cx="62" cy="8" r={s >= 2 ? 6 : 4.5} fill={c.accent} className={s >= 2 ? 'robot-blink' : undefined} />
      {/* crown for the champion */}
      {s >= 5 && <path d="M44 22 l6-12 6 8 6-10 6 10 6-8 6 12 z" fill="#facc15" stroke="#a16207" strokeWidth="2" strokeLinejoin="round" />}
      {/* ears */}
      <rect x="14" y="44" width="10" height="24" rx="5" fill={c.dark} />
      <rect x="100" y="44" width="10" height="24" rx="5" fill={c.dark} />
      {/* head */}
      <rect x="22" y="22" width="80" height="66" rx="24" fill={c.body} stroke={c.dark} strokeWidth="3" />
      {/* face screen */}
      <rect x="32" y="36" width="60" height="44" rx="16" fill="#e0f2fe" />
      {eyes}
      {mouth}
      {(mood === 'happy' || mood === 'cheer') && (
        <g fill="#fda4af" opacity="0.8">
          <ellipse cx="40" cy="70" rx="4.5" ry="3" />
          <ellipse cx="84" cy="70" rx="4.5" ry="3" />
        </g>
      )}
      {/* body */}
      <rect x="36" y="90" width="52" height="34" rx="12" fill={c.body} stroke={c.dark} strokeWidth="3" />
      <circle cx="62" cy="106" r="7" fill={c.accent} stroke={c.dark} strokeWidth="2" />
      {s >= 3 && <path d="M62 101 l2 4 4.5.5-3.3 3 .9 4.4-4.1-2.3-4.1 2.3.9-4.4-3.3-3 4.5-.5z" fill="#fff" />}
      {/* arms */}
      {armsUp ? (
        <g stroke={c.dark} strokeWidth="6" strokeLinecap="round">
          <line x1="36" y1="96" x2="18" y2="78" />
          <line x1="88" y1="96" x2="106" y2="78" />
        </g>
      ) : (
        <g stroke={c.dark} strokeWidth="6" strokeLinecap="round">
          <line x1="36" y1="98" x2="22" y2="112" />
          <line x1="88" y1="98" x2="102" y2="112" />
        </g>
      )}
      {/* feet */}
      <rect x="42" y="124" width="14" height="10" rx="4" fill={c.dark} />
      <rect x="68" y="124" width="14" height="10" rx="4" fill={c.dark} />
      {mood === 'sleep' && (
        <text x="98" y="26" fontSize="16" fontWeight="800" fill={c.dark}>
          z
        </text>
      )}
    </svg>
  );
}

/** Robot with a speech bubble. */
export function RobotSays({ mood, stage, children, size = 96 }: { mood?: RobotMood; stage?: number; children: React.ReactNode; size?: number }) {
  return (
    <div className="robot-says">
      <Robot mood={mood} stage={stage} size={size} />
      <div className="bubble" role="status">
        {children}
      </div>
    </div>
  );
}
