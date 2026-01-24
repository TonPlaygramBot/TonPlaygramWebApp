import { Link } from 'react-router-dom';
import { getGameThumbnail } from '../config/gameAssets.js';

export default function HomeGamesCard() {
  return (
    <div className="relative bg-surface border border-border rounded-xl p-4 space-y-2 overflow-hidden wide-card">
      <img
        src={getGameThumbnail('snake') || '/assets/icons/snakes_and_ladders.webp'}
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
            src={getGameThumbnail('texasholdem') || '/assets/icons/texas-holdem.svg'}
            alt=""
            className="h-20 w-20"
            onError={(event) => {
              event.currentTarget.src = '/assets/icons/texas-holdem.svg';
            }}
          />
          <h3 className="text-sm font-semibold text-center text-yellow-400">
            Texas Hold'em
          </h3>
        </Link>
        <Link
          to="/games/domino-royal/lobby"
          className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0 tetris-grid-bg"
        >
          <img
            src={getGameThumbnail('domino-royal') || '/assets/icons/domino-royal.svg'}
            alt=""
            className="h-20 w-20"
            onError={(event) => {
              event.currentTarget.src = '/assets/icons/domino-royal.svg';
            }}
          />
          <h3 className="text-sm font-semibold text-center text-yellow-400">
            Domino Royal 3D
          </h3>
        </Link>
        <Link
          to="/games/poolroyale/lobby"
          className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0 tetris-grid-bg"
        >
          <img
            src={getGameThumbnail('poolroyale') || '/assets/icons/pool-royale.svg'}
            alt=""
            className="h-20 w-20"
            onError={(event) => {
              event.currentTarget.src = '/assets/icons/pool-royale.svg';
            }}
          />
          <h3 className="text-sm font-semibold text-center text-yellow-400">
            Pool Royale
          </h3>
        </Link>
        <Link
          to="/games/snookerroyale/lobby"
          className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0 tetris-grid-bg"
        >
          <img
            src={getGameThumbnail('snookerroyale') || '/assets/icons/snooker-royale.svg'}
            alt=""
            className="h-20 w-20"
            onError={(event) => {
              event.currentTarget.src = '/assets/icons/snooker-royale.svg';
            }}
          />
          <h3 className="text-sm font-semibold text-center text-yellow-400">
            Snooker Royal
          </h3>
        </Link>
        <Link
          to="/games/goalrush/lobby"
          className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0 tetris-grid-bg"
        >
          <img
            src={getGameThumbnail('goalrush') || '/assets/icons/goal_rush_card_1200x675.webp'}
            alt=""
            className="h-20 w-20"
            onError={(event) => {
              event.currentTarget.src = '/assets/icons/goal_rush_card_1200x675.webp';
            }}
          />
          <h3 className="text-sm font-semibold text-center text-yellow-400">
            Goal Rush
          </h3>
        </Link>
        <Link
          to="/games/snake/lobby"
          className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0 tetris-grid-bg"
        >
          <img
            src={getGameThumbnail('snake') || '/assets/icons/snakes_and_ladders.webp'}
            alt=""
            className="h-20 w-20"
            onError={(event) => {
              event.currentTarget.src = '/assets/icons/snakes_and_ladders.webp';
            }}
          />
          <h3 className="text-sm font-semibold text-center text-yellow-400">
            Snake &amp; Ladder
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
