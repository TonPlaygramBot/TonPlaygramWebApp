import { Link } from 'react-router-dom';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import LeaderboardCard from '../components/LeaderboardCard.jsx';

export default function Games() {
  useTelegramBackButton();
  return (
    <div className="relative space-y-4 text-text">
      <h2 className="text-2xl font-bold text-center mt-4">Games</h2>
      <div className="space-y-4">
          <div className="relative bg-surface border border-border rounded-xl p-4 shadow-lg overflow-hidden wide-card">
            <div className="flex justify-around items-center flex-wrap gap-4">
              <div className="flex flex-col items-center space-y-1">
                <img src="/assets/icons/snakes_and_ladders.webp" alt="" className="h-24 w-24" />
                <h3 className="text-lg font-bold">Snake &amp; Ladder</h3>
                <Link
                  to="/games/snake/lobby"
                  className="inline-block px-3 py-1 bg-primary rounded hover:bg-primary-hover text-white-shadow"
                >
                  Open
                </Link>
              </div>
              <div className="flex flex-col items-center space-y-1">
                <img src="/assets/icons/Crazy_Dice_Duel_Promo.webp" alt="" className="h-24 w-24" />
                <h3 className="text-lg font-bold">Crazy Dice Duel</h3>
                <Link
                  to="/games/crazydice/lobby"
                  className="inline-block px-3 py-1 bg-primary rounded hover:bg-primary-hover text-white-shadow"
                >
                  Open
                </Link>
              </div>
            <div className="flex flex-col items-center space-y-1">
              <img src="/assets/icons/falling_ball.svg" alt="" className="h-24 w-24" />
              <h3 className="text-lg font-bold">Falling Ball</h3>
              <Link
                to="/games/fallingball/lobby"
                className="inline-block px-3 py-1 bg-primary rounded hover:bg-primary-hover text-white-shadow"
              >
                Open
              </Link>
            </div>
            <div className="flex flex-col items-center space-y-1">
              <img src="/assets/icons/air_hockey.svg" alt="" className="h-24 w-24" />
              <h3 className="text-lg font-bold">Air Hockey</h3>
              <Link
                to="/games/airhockey/lobby"
                className="inline-block px-3 py-1 bg-primary rounded hover:bg-primary-hover text-white-shadow"
              >
                Open
              </Link>
            </div>
            <div className="flex flex-col items-center space-y-1">
              <img src="/assets/icons/brick_breaker.svg" alt="" className="h-24 w-24" />
              <h3 className="text-lg font-bold">Brick Breaker Royale</h3>
              <Link
                to="/games/brickbreaker/lobby"
                className="inline-block px-3 py-1 bg-primary rounded hover:bg-primary-hover text-white-shadow"
              >
                Open
              </Link>
            </div>
            <div className="flex flex-col items-center space-y-1">
              <img src="/assets/icons/bubble_pop.svg" alt="" className="h-24 w-24" />
              <h3 className="text-lg font-bold">Bubble Pop Royale</h3>
              <Link
                to="/games/bubblepoproyale/lobby"
                className="inline-block px-3 py-1 bg-primary rounded hover:bg-primary-hover text-white-shadow"
              >
                Open
              </Link>
            </div>
            <div className="flex flex-col items-center space-y-1">
              <img src="/assets/icons/tetris.svg" alt="" className="h-24 w-24" />
              <h3 className="text-lg font-bold">Tetris Royale</h3>
              <Link
                to="/games/tetrisroyale/lobby"
                className="inline-block px-3 py-1 bg-primary rounded hover:bg-primary-hover text-white-shadow"
              >
                Open
              </Link>
            </div>
          </div>
        </div>
        <LeaderboardCard />
      </div>
    </div>
  );
}
