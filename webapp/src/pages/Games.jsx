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
              to="/games/pollroyale/lobby"
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
                8 Poll Royale
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
              to="/games/penaltykick/lobby"
              className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0 tetris-grid-bg"
            >
              <div className="h-20 w-20 flex items-center justify-center text-5xl">⚽</div>
              <h3
                className="text-sm font-semibold text-center text-yellow-400"
                style={{ WebkitTextStroke: '1px black' }}
              >
                Penalty Kick
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
              to="/games/fruitsliceroyale/lobby"
              className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0 tetris-grid-bg"
            >
              <img
                src="/assets/icons/Fruit Slice Royale .png"
                alt=""
                className="h-20 w-20"
              />
              <h3
                className="text-sm font-semibold text-center text-yellow-400"
                style={{ WebkitTextStroke: '1px black' }}
              >
                Fruit Slice Royale
              </h3>
            </Link>
            <Link
              to="/games/brickbreaker/lobby"
              className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0 tetris-grid-bg"
            >
              <img
                src="/assets/icons/Brick Breaker Royale .png"
                alt=""
                className="h-20 w-20"
              />
              <h3
                className="text-sm font-semibold text-center text-yellow-400"
                style={{ WebkitTextStroke: '1px black' }}
              >
                Brick Breaker Royale
              </h3>
            </Link>
            <Link
              to="/games/tetrisroyale/lobby"
              className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0 tetris-grid-bg"
            >
              <img
                src="/assets/icons/file_00000000240061f4abd28311d76970a5.png"
                alt=""
                className="h-20 w-20"
              />
              <h3
                className="text-sm font-semibold text-center text-yellow-400"
                style={{ WebkitTextStroke: '1px black' }}
              >
                Tetris Royale
              </h3>
            </Link>
            <Link
              to="/games/bubblesmashroyale/lobby"
              className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0 tetris-grid-bg"
            >
              <img
                src="/assets/icons/Bubble Smash Royale .png"
                alt=""
                className="h-20 w-20"
              />
              <h3
                className="text-sm font-semibold text-center text-yellow-400"
                style={{ WebkitTextStroke: '1px black' }}
              >
                Bubble Smash Royale
              </h3>
            </Link>
            <Link
              to="/games/crazydice/lobby"
              className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0 tetris-grid-bg"
            >
              <img
                src="/assets/icons/Crazy_Dice_Duel_Promo.webp"
                alt=""
                className="h-20 w-20"
              />
              <h3
                className="text-sm font-semibold text-center text-yellow-400"
                style={{ WebkitTextStroke: '1px black' }}
              >
                Crazy Dice Duel
              </h3>
            </Link>
            <Link
              to="/games/bubblepoproyale/lobby"
              className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0 tetris-grid-bg"
            >
              <img
                src="/assets/icons/Bubble Pop Royale .png"
                alt=""
                className="h-20 w-20"
              />
              <h3
                className="text-sm font-semibold text-center text-yellow-400"
                style={{ WebkitTextStroke: '1px black' }}
              >
                Bubble Pop Royale
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
              to="/games/pingpong/lobby"
              className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0 tetris-grid-bg"
            >
              <div className="h-20 w-20 flex items-center justify-center text-5xl">🏓</div>
              <h3
                className="text-sm font-semibold text-center text-yellow-400"
                style={{ WebkitTextStroke: '1px black' }}
              >
                Ping Pong
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
