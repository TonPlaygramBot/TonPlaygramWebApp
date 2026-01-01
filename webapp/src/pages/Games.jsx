import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import LeaderboardCard from '../components/LeaderboardCard.jsx';
import GameTransactionsCard from '../components/GameTransactionsCard.jsx';
import GameCard from '../components/GameCard.jsx';
import gamesCatalog from '../config/gamesCatalog.js';

const poolVariants = [
  { id: 'uk', label: '8 Pool UK', note: 'Classic reds & yellows', route: '/games/poolroyale/lobby?variant=uk' },
  { id: 'american', label: 'American', note: 'Solids & stripes visuals', route: '/games/poolroyale/lobby?variant=american' },
  { id: '9ball', label: '9-Ball', note: 'Texas Express rules', route: '/games/poolroyale/lobby?variant=9ball' }
];

export default function Games() {
  useTelegramBackButton();

  const poolRoyale = useMemo(() => gamesCatalog.find((g) => g.slug === 'poolroyale'), []);
  const otherGames = useMemo(() => gamesCatalog.filter((g) => g.slug !== 'poolroyale'), []);

  return (
    <div className="relative space-y-5 text-text pb-16">
      <div className="relative mt-4 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/20 via-background to-surface shadow-xl">
        <div className="p-5 space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-subtext">Main gamer hub</p>
          <h2 className="text-2xl font-extrabold leading-tight">
            Pick a game, enter its lobby, and play instantly.
          </h2>
          <p className="text-sm text-subtext leading-snug">
            Designed for portrait play on your phone: responsive controls, quick onboarding, and crisp UI that stays readable on the go.
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            {['One-hand friendly', 'Low latency', 'TPC stakes ready', 'Touch + swipe tuned'].map((tag) => (
              <span key={tag} className="rounded-full border border-border bg-black/40 px-3 py-1">{tag}</span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-subtext">Online players</p>
              <p className="text-lg font-semibold">Live lobbies</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-subtext">Game modes</p>
              <p className="text-lg font-semibold">Solo • 1v1 • Tournaments</p>
            </div>
          </div>
        </div>
      </div>

      {poolRoyale && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-subtext">Featured</p>
              <h3 className="text-xl font-bold">Pool Royale variants</h3>
              <p className="text-sm text-subtext leading-snug">Choose a rule-set and jump straight into its lobby.</p>
            </div>
            <Link
              to={poolRoyale.route}
              className="shrink-0 rounded-full border border-border bg-primary px-4 py-2 text-black text-sm font-semibold shadow-lg shadow-primary/40"
            >
              Open Pool Royale lobby
            </Link>
          </div>
          <GameCard
            title={poolRoyale.name}
            description={poolRoyale.summary}
            link={poolRoyale.route}
            icon={poolRoyale.icon}
            genre={poolRoyale.genre}
            meta={poolRoyale.meta}
            features={poolRoyale.features}
            inlineActions={(
              <div className="flex flex-wrap gap-2">
                {poolVariants.map((variant) => (
                  <Link
                    key={variant.id}
                    to={variant.route}
                    className="rounded-full border border-border bg-background/70 px-3 py-2 text-sm font-semibold hover:border-primary"
                  >
                    {variant.label}
                    <span className="block text-[11px] font-normal text-subtext">{variant.note}</span>
                  </Link>
                ))}
              </div>
            )}
          />
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-subtext">All games</p>
            <h3 className="text-xl font-bold">Jump into any lobby</h3>
          </div>
          <Link to="/games/transactions" className="text-sm text-primary underline">View game history</Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {otherGames.map((game) => (
            <GameCard
              key={game.route}
              title={game.name}
              description={game.summary}
              link={game.route}
              icon={game.icon}
              genre={game.genre}
              meta={game.meta}
              features={game.features}
            />
          ))}
        </div>
      </div>

      <GameTransactionsCard />
      <LeaderboardCard />
    </div>
  );
}
