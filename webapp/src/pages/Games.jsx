import { useEffect, useMemo, useState } from 'react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import LeaderboardCard from '../components/LeaderboardCard.jsx';
import GameTransactionsCard from '../components/GameTransactionsCard.jsx';
import GamesHallway from '../components/GamesHallway.jsx';
import gamesCatalog from '../config/gamesCatalog.js';
import { refreshGltfAssets } from '../pwa/preloadGames.js';

export default function Games() {
  useTelegramBackButton();
  const [showHallway, setShowHallway] = useState(false);
  const baseUrl = useMemo(() => import.meta.env.BASE_URL || '/', []);

  useEffect(() => {
    const isTelegram = Boolean(window.Telegram?.WebApp);
    if (!isTelegram) return;

    refreshGltfAssets({ baseUrl, forceReload: true });
  }, [baseUrl]);

  return (
    <div className="relative space-y-4 text-text">
      <h2 className="text-2xl font-bold text-center mt-4">Games</h2>
      <p className="text-center text-sm text-subtext">Online games are under construction and will be available soon.</p>
      <div className="space-y-4">
        <div className="relative bg-surface border border-border rounded-xl p-6 shadow-lg overflow-hidden wide-card space-y-4 text-center">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">3D Hallway Experience</h3>
            <p className="text-sm text-subtext">
              Explore the luxury hallway and pick your favorite game by stepping through its golden door or tapping the illuminated sign.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowHallway(true)}
            className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-base font-semibold text-black shadow-lg shadow-primary/40"
          >
            Enter Games
          </button>
        </div>
      </div>
      <GameTransactionsCard />
      <LeaderboardCard />
      {showHallway && <GamesHallway games={gamesCatalog} onClose={() => setShowHallway(false)} />}
    </div>
  );
}
