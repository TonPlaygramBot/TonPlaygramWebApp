import { useState } from 'react';
import DiceRoller from '../../components/DiceRoller.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function DiceDuel() {
  useTelegramBackButton();
  const TARGET = 20;
  const [scores, setScores] = useState([0, 0]);
  const [turn, setTurn] = useState(0); // 0 -> player1, 1 -> player2
  const [winner, setWinner] = useState(null);

  const handleRoll = (values) => {
    const value = Array.isArray(values) ? values.reduce((a, b) => a + b, 0) : values;
    setScores((prev) => {
      const next = [...prev];
      next[turn] += value;
      if (next[turn] >= TARGET) setWinner(turn);
      return next;
    });
    setTurn((t) => (t === 0 ? 1 : 0));
  };

  return (
    <div className="p-4 space-y-4 text-text">
      <h2 className="text-xl font-bold">Dice Duel</h2>
      <p className="text-center">First to {TARGET} points wins.</p>
      <div className="flex justify-center space-x-8 text-lg font-semibold">
        <div>Player 1: {scores[0]}</div>
        <div>Player 2: {scores[1]}</div>
      </div>
      {winner !== null ? (
        <div className="text-center text-accent font-bold">
          Player {winner + 1} wins!
        </div>
      ) : (
        <div className="text-center font-semibold">
          Player {turn + 1}'s turn
        </div>
      )}
      {winner === null && <DiceRoller onRollEnd={handleRoll} />}
    </div>
  );
}
