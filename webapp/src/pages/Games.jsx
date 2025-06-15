import GameCard from '../components/GameCard.jsx';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';

export default function Games() {
  useTelegramBackButton();
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-center">Games</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <GameCard title="Ludo" icon="/assets/icons/ludo.svg" link="/games/ludo" />
      </div>
    </div>
  );
}
