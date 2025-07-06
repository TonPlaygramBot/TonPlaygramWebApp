import { useState } from 'react';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import LudoBoardThree from '../../components/LudoBoardThree.jsx';
import DiceRoller from '../../components/DiceRoller.jsx';

export default function Ludo() {
  useTelegramBackButton();
  const [game] = useState(() => ({
    players: [
      { id: 0, color: '#ef4444', tokens: [-1, -1, -1, -1] },
      { id: 1, color: '#22c55e', tokens: [-1, -1, -1, -1] },
    ],
    turn: 0
  }));

  const handleRoll = (vals) => {
    const value = vals.reduce((a, b) => a + b, 0);
    const p = game.players[game.turn];
    for (let i = 0; i < p.tokens.length; i++) {
      if (p.tokens[i] === -1 && value === 6) {
        p.tokens[i] = 0;
        break;
      } else if (p.tokens[i] >= 0 && p.tokens[i] < 51) {
        p.tokens[i] += value;
        break;
      }
    }
    if (value !== 6) game.turn = (game.turn + 1) % game.players.length;
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold text-center">Ludo</h2>
      <div className="flex justify-center">
        <LudoBoardThree />
      </div>
      <DiceRoller numDice={2} onRollEnd={handleRoll} clickable />
    </div>
  );
}
