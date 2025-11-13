import { useState } from 'react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import LeaderboardCard from '../components/LeaderboardCard.jsx';
import GameTransactionsCard from '../components/GameTransactionsCard.jsx';
import GamesHallway from '../components/GamesHallway.jsx';

const gamesCatalog = [
  { name: "Texas Hold'em", route: '/games/texasholdem/lobby' },
  { name: 'Domino Royal 3D', route: '/games/domino-royal/lobby' },
  { name: 'Black Jack Multiplayer', route: '/games/blackjack/lobby' },
  { name: 'Pool Royale', route: '/games/pollroyale/lobby' },
  { name: '3D Snooker', route: '/games/snooker/lobby' },
  { name: 'Goal Rush', route: '/games/goalrush/lobby' },
  { name: 'Tirana 2040', route: '/games/tirana2040/lobby' },
  { name: 'Air Hockey', route: '/games/airhockey/lobby' },
  { name: 'Table Tennis', route: '/games/tabletennis/lobby' },
  { name: 'Free Kick', route: '/games/freekick/lobby' },
  { name: 'Snake & Ladder', route: '/games/snake/lobby' },
  { name: 'Falling Ball', route: '/games/fallingball/lobby' },
  { name: 'Murlan Royale', route: '/games/murlanroyale/lobby' },
  { name: 'Chess Battle Royal', route: '/games/chessbattleroyal/lobby' },
  { name: 'Ludo Battle Royal', route: '/games/ludobattleroyal/lobby' }
];

export default function Games() {
  useTelegramBackButton();
  const [showHallway, setShowHallway] = useState(false);
  return (
    <div className="relative space-y-4 text-text">
      <h2 className="text-2xl font-bold text-center mt-4">Games</h2>
      <p className="text-center text-sm text-subtext">Online games are under construction and will be available soon.</p>
      <div className="mx-auto max-w-md rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary text-center">
        New: Stake on the Royal Walnut & Royal Obsidian snooker tables directly from the lobby.
      </div>
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
