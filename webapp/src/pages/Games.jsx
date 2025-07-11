import GameCard from '../components/GameCard.jsx';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import LeaderboardCard from '../components/LeaderboardCard.jsx';

export default function Games() {
  useTelegramBackButton();
  return (
    <div className="relative space-y-4 text-text">
      <h2 className="text-2xl font-bold text-center mt-4">Games</h2>
      <div className="space-y-4">
        <GameCard title="Snake & Ladder" icon="🎲" link="/games/snake/lobby" />
        <GameCard title="Crazy Dice Duel" icon="🎲" link="/games/crazydice/lobby" />
        <LeaderboardCard />
      </div>
    </div>
  );
}
