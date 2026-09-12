import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import GameTransactionsCard from '../components/GameTransactionsCard.jsx';
import LeaderboardCard from '../components/LeaderboardCard.jsx';
import GamePackManager from '../components/GamePackManager.jsx';
import useGamePacks from '../hooks/useGamePacks.js';
import { formatBytes } from '../pwa/gamePackManager.js';
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
  const { packs: gamePacks, install: installGamePack, supported: gamePacksSupported, error: downloadError } = useGamePacks();
  const packBySlug = useMemo(() => {
    const map = new Map();
    for (const pack of gamePacks) {
      for (const slug of pack.gameSlugs || []) map.set(slug, pack);
    }
    return map;
  }, [gamePacks]);

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
      <h2 className="text-2xl font-bold text-center mt-4">Games Lobby</h2>
      <p className="text-center text-sm text-subtext">
        Jump straight into a lobby. Tap any game to start your next match.
      </p>
      <GamePackManager />
      {downloadError && <p role="alert" className="text-sm text-red-300">{downloadError}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {gamesCatalog.map((game) => {
          const thumbnail = getGameThumbnail(game.slug);
          const readiness = game.badge
            ? { label: game.badge }
            : getOnlineReadiness(game.slug, readinessMap);
          const badgeTone =
            BADGE_STYLES[readiness.label] || BADGE_STYLES['Coming Soon'];
          const gamePack = packBySlug.get(game.slug);
          const packReady = ['installed', 'update-available'].includes(gamePack?.status);
          const packRequired = REQUIRE_GAME_PACKS && gamePack && !packReady;
          const packDownloading = gamePack?.status === 'downloading';
          const packPercent = gamePack?.progress?.percent || 0;
          const cardClass = `group relative flex w-full flex-col overflow-hidden rounded-2xl border bg-surface/90 text-left shadow-lg transition hover:-translate-y-0.5 hover:border-primary/60 ${game.featured ? 'col-span-2 sm:col-span-1 border-lime-400/40' : 'border-border'}`;
          const cardContent = (
            <>
              <div
                className={`relative overflow-hidden ${game.featured ? 'h-44 sm:h-32' : 'h-24'}`}
              >
                <img
                  src={thumbnail || game.image}
                  alt={game.name}
                  loading={game.featured ? 'eager' : 'lazy'}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  onError={(event) => {
                    event.currentTarget.src = game.image;
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                {game.attribution && <span className="absolute top-1 right-1 rounded bg-black/60 px-1 text-[9px] text-white">{game.attribution}</span>}
                <span className="absolute bottom-1 left-1 right-1 text-center text-xs font-semibold text-white">
                  {game.name}
                </span>
              </div>
              <div className="flex flex-1 flex-col items-center px-2 py-2 text-center">
                <p className="text-[10px] text-subtext line-clamp-2">
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
                  className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] ${badgeTone}`}
                >
                  {readiness.label}
                </span>
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {packRequired
                    ? packDownloading
                      ? `Downloading ${packPercent}%`
                      : gamePack.status === 'partial' || gamePack.status === 'failed'
                        ? 'Resume download'
                        : gamePack.totalBytes
                          ? `Download ${formatBytes(gamePack.totalBytes)}`
                          : 'Download game'
                    : game.launchLabel || 'Enter Lobby'}
                </span>
              </div>
            </>
          );

          if (packRequired) {
            return (
              <button
                key={game.name}
                type="button"
                className={cardClass}
                disabled={!gamePacksSupported || packDownloading}
                onClick={() => void installGamePack(gamePack.id)}
                aria-label={`Download ${gamePack.title} before playing ${game.name}`}
              >
                {cardContent}
              </button>
            );
          }

          return (
            <div key={game.name} className={cardClass}>
            <Link
              to={game.route}
              reloadDocument={Boolean(game.standalone)}
              className="flex flex-1 flex-col"
            >
              {cardContent}
            </Link>
            {gamePack && <Link
              to={`/games?downloadPack=${encodeURIComponent(gamePack.id)}&returnTo=${encodeURIComponent(game.route)}`}
              className="flex min-h-11 items-center justify-center border-t border-border px-2 py-3 text-sm font-semibold text-primary"
              aria-label={`Manage download for ${game.name}`}
            >{packDownloading ? `Downloading ${packPercent}%` : packReady ? 'Manage download' : 'Download game'}</Link>}
            </div>
          );
        })}
      </div>
      <LeaderboardCard />
      <GameTransactionsCard />
    </div>
  );
}
