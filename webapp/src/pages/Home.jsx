import GameCard from '../components/GameCard.jsx';

export default function Home() {
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">TonPlaygram</h1>
      <GameCard title="Mining" description="Earn tokens over time." />
      <GameCard title="Dice Duel" description="Play dice against friends." />
    </div>
  );
}
