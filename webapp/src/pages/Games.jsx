import { Link } from 'react-router-dom';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import LeaderboardCard from '../components/LeaderboardCard.jsx';
import GameTransactionsCard from '../components/GameTransactionsCard.jsx';

export default function Games() {
  useTelegramBackButton();
  return (
    <div className="relative space-y-4 text-text">
      <h2 className="text-2xl font-bold text-center mt-4">Games</h2>
      <p className="text-center text-sm text-subtext">Online games are under construction and will be available soon.</p>
      <div className="space-y-4">
        <div className="relative bg-surface border border-border rounded-xl p-4 shadow-lg overflow-hidden wide-card">
          <div className="flex overflow-x-auto space-x-4 items-center pb-2">
            <Link
              to="/games/texasholdem/lobby"
              className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0 tetris-grid-bg"
            >
              <img
                src="/assets/icons/texas-holdem.svg"
                alt=""
                className="h-20 w-20"
              />
              <h3
                className="text-sm font-semibold text-center text-yellow-400"
                style={{ WebkitTextStroke: '1px black' }}
              >
                Texas Hold'em
              </h3>
            </Link>
            <Link
              to="/games/blackjack/lobby"
              className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0 tetris-grid-bg"
            >
              <img
                src="/assets/icons/blackjack.svg"
                alt=""
                className="h-20 w-20"
              />
              <h3
                className="text-xs font-semibold text-center text-yellow-400"
                style={{ WebkitTextStroke: '1px black' }}
              >
                Black Jack Multiplayer
              </h3>
            </Link>
            <Link
              to="/games/american-billiards/lobby"
              className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0 tetris-grid-bg"
            >
              <img
                src="/assets/icons/pool-royale.svg"
                alt=""
                className="h-20 w-20"
              />
              <h3
                className="text-sm font-semibold text-center text-yellow-400"
                style={{ WebkitTextStroke: '1px black' }}
              >
                American Billiards
              </h3>
            </Link>
            <Link
              to="/games/nine-ball/lobby"
              className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0 tetris-grid-bg"
            >
              <img
                src="/assets/icons/pool-royale.svg"
                alt=""
                className="h-20 w-20"
              />
              <h3
                className="text-sm font-semibold text-center text-yellow-400"
                style={{ WebkitTextStroke: '1px black' }}
              >
                9-Ball
              </h3>
            </Link>
            <Link
              to="/games/uk-eight-ball/lobby"
              className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0 tetris-grid-bg"
            >
              <img
                src="/assets/icons/pool-royale.svg"
                alt=""
                className="h-20 w-20"
              />
              <h3
                className="text-sm font-semibold text-center text-yellow-400"
                style={{ WebkitTextStroke: '1px black' }}
              >
                8 Pool UK
              </h3>
            </Link>
            <Link
              to="/games/snooker/lobby"
              className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0 tetris-grid-bg"
            >
              <img
                src="/assets/icons/white_ball.svg"
                alt=""
                className="h-20 w-20"
              />
              <h3
                className="text-sm font-semibold text-center text-yellow-400"
                style={{ WebkitTextStroke: '1px black' }}
              >
                3D Snooker
              </h3>
            </Link>
            <Link
              to="/games/goalrush/lobby"
              className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0 tetris-grid-bg"
            >
              <img
                src="/assets/icons/goal_rush_card_1200x675.webp"
                alt=""
                className="h-20 w-20"
              />
              <h3
                className="text-sm font-semibold text-center text-yellow-400"
                style={{ WebkitTextStroke: '1px black' }}
              >
                Goal Rush
              </h3>
            </Link>
            <Link
              to="/games/airhockey/lobby"
              className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0 tetris-grid-bg"
            >
              <img
                src="/assets/icons/white_ball.svg"
                alt=""
                className="h-20 w-20"
              />
              <h3
                className="text-sm font-semibold text-center text-yellow-400"
                style={{ WebkitTextStroke: '1px black' }}
              >
                Air Hockey
              </h3>
            </Link>
            <Link
              to="/games/tabletennis/lobby"
              className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0 tetris-grid-bg"
            >
              <div className="h-20 w-20 flex items-center justify-center text-5xl">🏓</div>
              <h3
                className="text-sm font-semibold text-center text-yellow-400"
                style={{ WebkitTextStroke: '1px black' }}
              >
                Table Tennis
              </h3>
            </Link>
            <Link
              to="/games/freekick/lobby"
              className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0 tetris-grid-bg"
            >
              <div className="h-20 w-20 flex items-center justify-center text-5xl">⚽</div>
              <h3
                className="text-sm font-semibold text-center text-yellow-400"
                style={{ WebkitTextStroke: '1px black' }}
              >
                Free Kick
              </h3>
            </Link>
            <Link
              to="/games/snake/lobby"
              className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0 tetris-grid-bg"
            >
              <img
                src="/assets/icons/snakes_and_ladders.webp"
                alt=""
                className="h-20 w-20"
              />
              <h3
                className="text-sm font-semibold text-center text-yellow-400"
                style={{ WebkitTextStroke: '1px black' }}
              >
                Snake &amp; Ladder
              </h3>
            </Link>
            <Link
              to="/games/fallingball/lobby"
              className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0 tetris-grid-bg"
            >
              <img
                src="/assets/icons/Falling Ball .png"
                alt=""
                className="h-20 w-20"
              />
              <h3
                className="text-sm font-semibold text-center text-yellow-400"
                style={{ WebkitTextStroke: '1px black' }}
              >
                Falling Ball
              </h3>
            </Link>
            <Link
              to="/games/murlanroyale/lobby"
              className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0 tetris-grid-bg"
            >
              <img
                src="/assets/icons/murlan-royale.svg"
                alt=""
                className="h-20 w-20"
              />
              <h3
                className="text-sm font-semibold text-center text-yellow-400"
                style={{ WebkitTextStroke: '1px black' }}
              >
                Murlan Royale
              </h3>
            </Link>
            <Link
              to="/games/chessbattleroyal/lobby"
              className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0 tetris-grid-bg"
            >
              <div className="h-20 w-20 flex items-center justify-center text-5xl">♟️</div>
              <h3
                className="text-sm font-semibold text-center text-yellow-400"
                style={{ WebkitTextStroke: '1px black' }}
              >
                Chess Battle Royal
              </h3>
            </Link>
            <Link
              to="/games/ludobattleroyal/lobby"
              className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0 tetris-grid-bg"
            >
              <div className="h-20 w-20 flex items-center justify-center text-5xl">🎲</div>
              <h3
                className="text-sm font-semibold text-center text-yellow-400"
                style={{ WebkitTextStroke: '1px black' }}
              >
                Ludo Battle Royal
              </h3>
            </Link>
          </div>
        </div>
      </div>
      <GameTransactionsCard />
      <LeaderboardCard />
    </div>
  );
}
