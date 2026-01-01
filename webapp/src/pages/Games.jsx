import { useMemo } from 'react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import LeaderboardCard from '../components/LeaderboardCard.jsx';
import GameTransactionsCard from '../components/GameTransactionsCard.jsx';
import gamesCatalog from '../config/gamesCatalog.js';
import GamesCatalogCard from '../components/GamesCatalogCard.jsx';

export default function Games() {
  useTelegramBackButton();

  const categories = useMemo(() => {
    const group = gamesCatalog.reduce((acc, game) => {
      acc[game.category] = acc[game.category] || [];
      acc[game.category].push(game);
      return acc;
    }, {});
    return Object.entries(group);
  }, []);

  return (
    <div className="relative space-y-4 text-text">
      <div className="wide-card">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-amber-500/10" aria-hidden />
          <div className="relative space-y-2 text-center">
            <h2 className="text-2xl font-extrabold">Games Hub</h2>
            <p className="text-sm text-subtext">
              Browse every game and jump straight into its lobby or a quick play session. Optimized for portrait mobile screens.
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs font-semibold">
              <span className="rounded-full bg-background px-3 py-1 border border-border">No 3D hallway—faster access</span>
              <span className="rounded-full bg-background px-3 py-1 border border-border">Dedicated Pool Royale variants</span>
              <span className="rounded-full bg-background px-3 py-1 border border-border">Mobile-friendly layout</span>
            </div>
          </div>
        </div>
      </div>

      <section className="space-y-6">
        {categories.map(([category, games]) => (
          <div key={category} className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-lg font-bold">{category}</h3>
              <span className="text-xs text-subtext">{games.length} games</span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {games.map((game) => (
                <GamesCatalogCard key={game.slug} game={game} />
              ))}
            </div>
          </div>
        ))}
      </section>

      <GameTransactionsCard />
      <LeaderboardCard />
    </div>
  );
}
