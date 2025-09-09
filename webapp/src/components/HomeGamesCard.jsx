import { Link } from 'react-router-dom';

export default function HomeGamesCard() {
  return (
    <div className="relative bg-surface border border-border rounded-xl p-4 space-y-2 overflow-hidden wide-card">
      <img
        src="/assets/icons/snakes_and_ladders.webp"
        className="background-behind-board object-cover"
        alt=""
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
      <h3 className="text-lg font-bold text-center">Games</h3>
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
          <h3 className="text-sm font-semibold text-center text-yellow-400">
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
          <h3 className="text-xs font-semibold text-center text-yellow-400">
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
          <h3 className="text-sm font-semibold text-center text-yellow-400">
            Pool Royale
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
          <h3 className="text-sm font-semibold text-center text-yellow-400">
            Goal Rush
          </h3>
        </Link>
          <Link
            to="/games/tabletennis/lobby"
            className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0 tetris-grid-bg"
          >
            <img
              src="/assets/icons/air_hockey.svg"
              alt=""
              className="h-20 w-20"
            />
            <h3 className="text-sm font-semibold text-center text-yellow-400">
              Table Tennis
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
          <h3 className="text-sm font-semibold text-center text-yellow-400">
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
          <h3 className="text-sm font-semibold text-center text-yellow-400">
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
          <h3 className="text-sm font-semibold text-center text-yellow-400">
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
          <h3 className="text-sm font-semibold text-center text-yellow-400">
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
          <h3 className="text-sm font-semibold text-center text-yellow-400">
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
          <h3 className="text-sm font-semibold text-center text-yellow-400">
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
          <h3 className="text-sm font-semibold text-center text-yellow-400">
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
          <h3 className="text-sm font-semibold text-center text-yellow-400">
            Bubble Pop Royale
          </h3>
        </Link>
      </div>
      <Link
        to="/games"
        className="mx-auto block w-48 px-3 py-1 bg-primary hover:bg-primary-hover rounded text-white-shadow text-center"
      >
        Open Games
      </Link>
    </div>
  );
}
