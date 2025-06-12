import GameCard from '../components/GameCard.jsx';

export default function Games() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-center">Games</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <GameCard title="Chess" icon="♟" link="/games/chess" />
        <GameCard title="Snakes & Ladders" icon="🐍" link="/games/snake" />
        <GameCard title="Dice Duel" icon="🎲" link="/games/dice" />
      </div>
    </div>
  );
}

