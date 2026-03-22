import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AiOutlineMessage } from 'react-icons/ai';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import LeaderboardCard from '../components/LeaderboardCard.jsx';
import GameTransactionsCard from '../components/GameTransactionsCard.jsx';
import LiveVideoChatPanel from '../components/LiveVideoChatPanel.jsx';
import gamesCatalog from '../config/gamesCatalog.js';
import { getGameThumbnail } from '../config/gameAssets.js';
import {
  getOnlineReadiness,
  fetchOnlineReadinessMap,
  ONLINE_READINESS_BY_GAME
} from '../config/onlineContract.js';
import useLiveVideoChat from '../hooks/useLiveVideoChat.js';

const BADGE_STYLES = {
  'Online Ready': 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
  Beta: 'bg-amber-500/20 text-amber-200 border-amber-300/40',
  'Coming Soon': 'bg-slate-500/20 text-slate-200 border-slate-300/30'
};

export default function Games() {
  useTelegramBackButton();
  const [readinessMap, setReadinessMap] = useState(ONLINE_READINESS_BY_GAME);
  const [liveMode, setLiveMode] = useState(false);
  const [showLivePanel, setShowLivePanel] = useState(false);
  const [liveGameSlug, setLiveGameSlug] = useState('');

  const liveDisplayName = useMemo(() => {
    if (typeof window === 'undefined') return 'Player';
    const username = window.localStorage.getItem('telegramUsername');
    const firstName = window.localStorage.getItem('telegramFirstName');
    const lastName = window.localStorage.getItem('telegramLastName');
    return (
      username || `${firstName || ''} ${lastName || ''}`.trim() || 'Player'
    );
  }, []);

  const liveChatRoomId = useMemo(() => {
    if (!liveGameSlug) return '';
    const accountId =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('accountId') || 'guest'
        : 'guest';
    return `game-live-${liveGameSlug}-${accountId}`;
  }, [liveGameSlug]);

  const liveChat = useLiveVideoChat({
    roomId: liveChatRoomId,
    displayName: liveDisplayName,
    enabled: liveMode
  });

  useEffect(() => {
    let active = true;
    fetchOnlineReadinessMap().then((map) => {
      if (active && map) setReadinessMap(map);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (liveMode) {
      liveChat.startLiveChat();
      return;
    }
    liveChat.stopLiveChat();
  }, [liveMode, liveChat.startLiveChat, liveChat.stopLiveChat]);

  return (
    <div className="relative space-y-4 text-text">
      <h2 className="text-2xl font-bold text-center mt-4">Games Lobby</h2>
      <p className="text-center text-sm text-subtext">
        Jump straight into a lobby. Tap any game to start your next match.
      </p>
      <div className="grid grid-cols-3 gap-3">
        {gamesCatalog.map((game) => {
          const thumbnail = getGameThumbnail(game.slug);
          const readiness = getOnlineReadiness(game.slug, readinessMap);
          const badgeTone =
            BADGE_STYLES[readiness.label] || BADGE_STYLES['Coming Soon'];
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
                <button
                  type="button"
                  aria-label={
                    liveMode && liveGameSlug === game.slug
                      ? `Disable live chat for ${game.name}`
                      : `Enable live chat for ${game.name}`
                  }
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (liveMode && liveGameSlug === game.slug) {
                      liveChat.stopLiveChat();
                      setLiveMode(false);
                      setShowLivePanel(false);
                      return;
                    }
                    setLiveGameSlug(game.slug);
                    setLiveMode(true);
                    setShowLivePanel(true);
                  }}
                  className={`absolute left-1 top-1 z-10 flex flex-col items-center rounded px-2 py-1 text-[10px] font-semibold ${
                    liveMode && liveGameSlug === game.slug
                      ? 'bg-emerald-500/25 text-emerald-100'
                      : 'bg-black/35 text-white hover:bg-white/10'
                  }`}
                >
                  <AiOutlineMessage className="text-xl" />
                  <span>
                    {liveMode && liveGameSlug === game.slug ? 'Avatar' : 'Live'}
                  </span>
                </button>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <span className="absolute bottom-1 left-1 right-1 text-center text-xs font-semibold text-white">
                  {game.name}
                </span>
              </div>
              <div className="flex flex-1 flex-col items-center px-2 py-2 text-center">
                <p className="text-[10px] text-subtext line-clamp-2">
                  {game.description}
                </p>
                <span
                  className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] ${badgeTone}`}
                >
                  {readiness.label}
                </span>
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  Enter Lobby
                </span>
              </div>
            </Link>
          );
        })}
      </div>
      <LiveVideoChatPanel
        open={showLivePanel && Boolean(liveGameSlug)}
        onClose={() => {
          setShowLivePanel(false);
        }}
        roomId={liveChatRoomId}
        localStream={liveChat.localStream}
        localMediaState={liveChat.mediaState}
        remotePeers={liveChat.remotePeers}
        isConnected={liveChat.isConnected}
        error={liveChat.error}
        onStart={() => {
          if (!liveGameSlug) return;
          setLiveMode(true);
          liveChat.startLiveChat();
        }}
        onStop={() => {
          liveChat.stopLiveChat();
          setLiveMode(false);
          setShowLivePanel(false);
        }}
        onToggleMicrophone={liveChat.toggleMicrophone}
        onToggleCamera={liveChat.toggleCamera}
      />
      <GameTransactionsCard />
      <LeaderboardCard />
    </div>
  );
}
