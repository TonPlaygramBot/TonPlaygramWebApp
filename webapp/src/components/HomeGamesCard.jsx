import { Link } from 'react-router-dom';

export default function HomeGamesCard() {
  return (
    <div className="relative bg-surface border border-border rounded-xl p-4 space-y-2 overflow-hidden wide-card">
      <img
        src="/assets/SnakeLaddersbackground.png"
        className="background-behind-board object-cover"
        alt=""
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
      <h3 className="text-lg font-bold text-center">Games</h3>
        <div className="flex justify-center space-x-4">
          <Link to="/games/snake/lobby" className="flex-shrink-0">
            <img
              src="/assets/icons/snakes_and_ladders.webp"
              alt="Snake & Ladder"
              className="w-24 h-24"
            />
          </Link>
          <Link to="/games/crazydice/lobby" className="flex-shrink-0">
            <img
              src="/assets/icons/Crazy_Dice_Duel_Promo.webp"
              alt="Crazy Dice Duel"
              className="w-24 h-24"
            />
          </Link>
          <Link to="/games/fallingball" className="flex-shrink-0">
            <img
              src="/assets/icons/falling_ball.svg"
              alt="Falling Ball"
              className="w-24 h-24"
            />
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
