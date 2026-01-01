import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import LeaderboardCard from '../components/LeaderboardCard.jsx';
import GameTransactionsCard from '../components/GameTransactionsCard.jsx';
import gamesCatalog from '../config/gamesCatalog.js';

export default function Games() {
  useTelegramBackButton();
  const navigate = useNavigate();

  const catalog = useMemo(
    () =>
      gamesCatalog.map((game) => ({
        ...game,
        primaryActionLabel: 'Play',
        secondaryActionLabel: game.lobbyPath && game.lobbyPath !== game.playPath ? 'Lobby' : 'Details'
      })),
    []
  );

  const goTo = (path, params = {}) => {
    if (!path) return;
    const query = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value != null) query.set(key, value);
    });
    const suffix = query.toString();
    navigate(suffix ? `${path}?${query.toString()}` : path);
  };

  const renderCard = (game) => (
    <div
      key={game.id}
      className={`relative rounded-2xl border border-border/70 bg-gradient-to-br ${game.accent || 'from-primary/20 to-primary/5'} p-4 shadow-lg backdrop-blur-md flex flex-col gap-3`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-subtext">{game.variant || game.slug}</p>
          <h3 className="text-lg font-bold leading-tight">{game.name}</h3>
        </div>
        <span className="text-2xl">{game.emoji || '🎮'}</span>
      </div>
      {game.tagline && <p className="text-sm text-subtext leading-relaxed">{game.tagline}</p>}
      {Array.isArray(game.tags) && game.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {game.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-black/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-subtext border border-border/70"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      {Array.isArray(game.stats) && game.stats.length > 0 && (
        <div className="grid grid-cols-2 gap-2 text-xs text-subtext">
          {game.stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-border/60 bg-black/20 px-3 py-2">
              <p className="uppercase tracking-wide text-[10px]">{stat.label}</p>
              <p className="font-semibold text-sm text-text">{stat.value}</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        {game.playPath && (
          <button
            type="button"
            onClick={() => goTo(game.playPath, game.params)}
            className="flex-1 rounded-xl bg-primary px-4 py-2 text-black font-semibold shadow-md shadow-primary/40"
          >
            {game.primaryActionLabel}
          </button>
        )}
        {game.lobbyPath && (
          <button
            type="button"
            onClick={() => goTo(game.lobbyPath, game.params)}
            className="flex-1 rounded-xl border border-border bg-background/60 px-4 py-2 text-sm font-semibold text-text"
          >
            {game.secondaryActionLabel}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative space-y-4 text-text">
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-xl text-center space-y-2">
        <h2 className="text-2xl font-bold">Play Games</h2>
        <p className="text-sm text-subtext">
          Pick a game, hop into its lobby, and jump straight into the match. Built for mobile portrait flow.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {catalog.map(renderCard)}
      </div>

      <GameTransactionsCard />
      <LeaderboardCard />
    </div>
  );
}
