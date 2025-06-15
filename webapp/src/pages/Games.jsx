import GameCard from '../components/GameCard.jsx';

export default function Games() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-center">Games</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <GameCard title="Chess" icon="/assets/icons/horse.svg" link="/games/chess" />
        <GameCard title="Snakes & Ladders" icon="/assets/icons/snake.svg" link="/games/snake" />
        <GameCard title="Connect Four" icon="/assets/icons/connect4.svg" link="/games/connectfour" />
        <GameCard title="Dice Duel" icon="/assets/icons/dice.svg" link="/games/dice" />
      </div>
    </div>
  );
}
