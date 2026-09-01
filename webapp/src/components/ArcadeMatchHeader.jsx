import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ArcadeMatchHeader({ title, score, opponentScore, online, startsAt, endsAt, accent = 'text-cyan-200' }) {
  const navigate = useNavigate();
  const [, tick] = useState(0);
  useEffect(() => {
    if (!online) return undefined;
    const timer = window.setInterval(() => tick((value) => value + 1), 250);
    return () => window.clearInterval(timer);
  }, [online]);
  const now = Date.now();
  const remaining = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 120;
  const waiting = startsAt && now < startsAt;
  return (
    <header className="relative z-20 grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
      <button type="button" onClick={() => navigate('/games')} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/30" aria-label="Back to games">‹</button>
      <div className="min-w-0 text-center">
        <h1 className="truncate text-sm font-black uppercase tracking-[0.14em]">{title}</h1>
        <p className={`text-xs font-bold ${accent}`}>{online ? waiting ? 'Get ready…' : `${remaining}s remaining` : 'Solo practice'}</p>
      </div>
      <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5 text-right text-xs">
        <span className="block text-white/45">YOU · RIVAL</span>
        <strong>{score.toLocaleString()} · {online ? opponentScore.toLocaleString() : '—'}</strong>
      </div>
    </header>
  );
}
