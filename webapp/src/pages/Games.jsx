import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import GameTransactionsCard from '../components/GameTransactionsCard.jsx';
import LeaderboardCard from '../components/LeaderboardCard.jsx';
import useAppDownload from '../hooks/useAppDownload.js';
import gamesCatalog from '../config/gamesCatalog.js';
import { getGameThumbnail } from '../config/gameAssets.js';
import {
  getOnlineReadiness,
  fetchOnlineReadinessMap,
  ONLINE_READINESS_BY_GAME
} from '../config/onlineContract.js';

const REQUIRE_GAME_PACKS = import.meta.env.VITE_REQUIRE_GAME_PACKS === 'true';

const BADGE_STYLES = {
  'Online Ready': 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
  'Single Player': 'bg-cyan-500/20 text-cyan-200 border-cyan-300/40',
  Beta: 'bg-amber-500/20 text-amber-200 border-amber-300/40',
  Alpha: 'bg-lime-500/20 text-lime-200 border-lime-300/40',
  'Coming Soon': 'bg-slate-500/20 text-slate-200 border-slate-300/30'
};

export default function Games() {
  useTelegramBackButton();
  const [readinessMap, setReadinessMap] = useState(ONLINE_READINESS_BY_GAME);
  const { status: downloadStatus } = useAppDownload();
  const appReady = ['installed', 'update-available'].includes(downloadStatus);
  const packRequired = REQUIRE_GAME_PACKS && !appReady;
  const downloadLink = (
    <Link to="/#app-download" className="block rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm leading-5 text-subtext focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
      <span className="block font-semibold text-primary">
        {appReady ? 'Manage saved game files' : packRequired ? 'Download required game files' : 'Check download options'}
      </span>
      <span>{packRequired ? 'This build needs the game files before you enter a lobby.' : 'See download availability and storage on Home.'}</span>
    </Link>
  );

  useEffect(() => {
    let active = true;
    fetchOnlineReadinessMap().then((map) => {
      if (active && map) setReadinessMap(map);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="games-page app-theme-page relative space-y-4 text-text">
      <h1 className="text-2xl font-bold text-center mt-4">Games Lobby</h1>
      <p className="text-center text-sm text-subtext">
        Choose a game to see its modes and enter the lobby.
      </p>
      {packRequired && downloadLink}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {gamesCatalog.map((game) => {
          const thumbnail = getGameThumbnail(game.slug);
          const readiness = game.badge
            ? { label: game.badge }
            : getOnlineReadiness(game.slug, readinessMap);
          const badgeTone =
            BADGE_STYLES[readiness.label] || BADGE_STYLES['Coming Soon'];
          const titleId = `game-title-${game.slug}`;
          const descriptionId = `game-description-${game.slug}`;
          const statusId = `game-status-${game.slug}`;
          const readinessLabel = readiness.label === 'Online Ready' ? 'Online play' : readiness.label;
          const cardClass = `group relative flex w-full flex-col overflow-hidden rounded-2xl border bg-surface/90 text-left shadow-lg motion-safe:transition motion-safe:hover:-translate-y-0.5 hover:border-primary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${game.featured ? 'col-span-2 sm:col-span-1 border-lime-400/40' : 'border-border'}`;
          const cardContent = (
            <>
              <div
                className={`relative overflow-hidden ${game.featured ? 'h-44 sm:h-32' : 'h-24'}`}
              >
                <img
                  src={thumbnail || game.image}
                  alt=""
                  loading={game.featured ? 'eager' : 'lazy'}
                  decoding="async"
                  className="h-full w-full object-cover motion-safe:transition motion-safe:duration-300 motion-safe:group-hover:scale-105"
                  onError={(event) => {
                    if (event.currentTarget.getAttribute('src') !== game.image) {
                      event.currentTarget.src = game.image;
                    }
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                {game.attribution && <span className="absolute top-1 right-1 rounded bg-black/60 px-1 text-[9px] text-white">{game.attribution}</span>}
                <span id={titleId} className="absolute bottom-1 left-1 right-1 text-center text-sm font-semibold leading-tight text-white">
                  {game.name}
                </span>
              </div>
              <div className="flex flex-1 flex-col items-center px-2 py-2 text-center">
                <p id={descriptionId} className="text-xs text-subtext line-clamp-2">
                  {game.description}
                </p>
                {game.modes && (
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    {game.modes.map((mode) => (
                      <span
                        key={mode}
                        className="rounded bg-lime-400/10 px-2 py-1 text-[10px] font-semibold text-lime-200"
                      >
                        {mode}
                      </span>
                    ))}
                  </div>
                )}
                <span
                  id={statusId}
                  className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] ${badgeTone}`}
                >
                  {readinessLabel}
                </span>
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {packRequired ? 'Download app on Home' : game.launchLabel || 'Enter Lobby'}
                </span>
              </div>
            </>
          );

          return (
            <Link
              key={game.slug}
              aria-labelledby={titleId}
              aria-describedby={`${descriptionId} ${statusId}`}
              to={packRequired ? `/?returnTo=${encodeURIComponent(game.route)}#app-download` : game.route}
              reloadDocument={!packRequired && Boolean(game.standalone)}
              className={cardClass}
            >
              {cardContent}
            </Link>
          );
        })}
      </div>
      {!packRequired && downloadLink}
      <LeaderboardCard />
      <GameTransactionsCard />
    </div>
  );
}
