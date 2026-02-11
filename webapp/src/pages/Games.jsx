import { Link } from 'react-router-dom';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import LeaderboardCard from '../components/LeaderboardCard.jsx';
import GameTransactionsCard from '../components/GameTransactionsCard.jsx';
import gamesCatalog from '../config/gamesCatalog.js';
import { getGameThumbnail } from '../config/gameAssets.js';

export default function Games() {
  useTelegramBackButton();

  return (
    <div className="relative space-y-4 text-text">
      <h2 className="text-2xl font-bold text-center mt-4">Games Lobby</h2>
      <p className="text-center text-sm text-subtext">
        Jump straight into a lobby. Tap any game to start your next match.
      </p>
      <div className="grid grid-cols-3 gap-3">
        {gamesCatalog.map((game) => {
          const thumbnail = getGameThumbnail(game.slug);
          return (
            <Link
              key={game.name}
              to={game.route}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface/90 shadow-lg transition hover:-translate-y-0.5 hover:border-primary/60"
            >
              <div className="relative h-24 overflow-hidden">
                <img
                  src={thumbnail || game.image}
                  alt={game.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  onError={(event) => {
                    event.currentTarget.src = game.image;
                  }}
                />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <span className="absolute bottom-1 left-1 right-1 text-center text-xs font-semibold text-white">
                {game.name}
              </span>
            </div>
            <div className="flex flex-1 flex-col items-center px-2 py-2 text-center">
              <p className="text-[10px] text-subtext line-clamp-2">{game.description}</p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                Enter Lobby
              </span>
            </div>
            </Link>
          );
        })}
      </div>
      <GameTransactionsCard />
      <LeaderboardCard />
    </div>
  );
}
