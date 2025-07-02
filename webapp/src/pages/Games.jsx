import GameCard from '../components/GameCard.jsx';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';

export default function Games() {
  useTelegramBackButton();
  return (
    <div className="relative space-y-4 text-text">
      <img
        src="/assets/SnakeLaddersbackground.png"
        className="background-behind-board object-cover"
        alt=""
      />
      <h2 className="text-2xl font-bold text-center mt-4">Games</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <GameCard title="Snake & Ladder" icon="🎲" link="/games/snake/lobby" />
      </div>
    </div>
  );
}
