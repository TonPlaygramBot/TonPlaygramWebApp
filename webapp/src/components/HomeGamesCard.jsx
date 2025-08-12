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
            to="/games/snake/lobby"
            className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0"
          >
            <img src="/assets/icons/snakes_and_ladders.webp" alt="" className="h-20 w-20" />
            <h3 className="text-sm font-semibold text-center">Snake &amp; Ladder</h3>
          </Link>
          <Link
            to="/games/crazydice/lobby"
            className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0"
          >
            <img src="/assets/icons/Crazy_Dice_Duel_Promo.webp" alt="" className="h-20 w-20" />
            <h3 className="text-sm font-semibold text-center">Crazy Dice Duel</h3>
          </Link>
          <Link
            to="/games/fallingball/lobby"
            className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0"
          >
            <img src="/assets/icons/falling_ball.svg" alt="" className="h-20 w-20" />
            <h3 className="text-sm font-semibold text-center">Falling Ball</h3>
          </Link>
          <Link
            to="/games/airhockey/lobby"
            className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0"
          >
            <img src="/assets/icons/air_hockey.svg" alt="" className="h-20 w-20" />
            <h3 className="text-sm font-semibold text-center">Air Hockey</h3>
          </Link>
          <Link
            to="/games/brickbreaker/lobby"
            className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0"
          >
            <img src="/assets/icons/brick_breaker.svg" alt="" className="h-20 w-20" />
            <h3 className="text-sm font-semibold text-center">Brick Breaker Royale</h3>
          </Link>
          <Link
            to="/games/bubblepoproyale/lobby"
            className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0"
          >
            <img src="/assets/icons/bubble_pop.svg" alt="" className="h-20 w-20" />
            <h3 className="text-sm font-semibold text-center">Bubble Pop Royale</h3>
          </Link>
          <Link
            to="/games/bubblesmashroyale/lobby"
            className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0"
          >
            <img src="/assets/icons/bubble_smash.svg" alt="" className="h-20 w-20" />
            <h3 className="text-sm font-semibold text-center">Bubble Smash Royale</h3>
          </Link>
          <Link
            to="/games/tetrisroyale/lobby"
            className="flex flex-col items-center space-y-1 border border-border rounded-lg p-2 flex-shrink-0"
          >
            <img src="/assets/icons/tetris.svg" alt="" className="h-20 w-20" />
            <h3 className="text-sm font-semibold text-center">Tetris Royale</h3>
          </Link>
        </div>
      <Link
        to="/games"
        className="mx-auto block px-3 py-1 bg-primary rounded hover:bg-primary-hover text-white-shadow"
      >
        Open Games
      </Link>
    </div>
  );
}
