import { useEffect, useState, useMemo } from 'react';
import ConnectWallet from '../../components/ConnectWallet.jsx';
import RoomPopup from '../../components/RoomPopup.jsx';
import Dice from '../../components/Dice.jsx';
import GameResult from '../../components/GameResult.jsx';

const opponents = [
  'CryptoKing',
  'BlockQueen',
  'MetaMage',
  'ChainMaster',
  'TokenGuru'
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default function DiceGame() {
  const [selection, setSelection] = useState(null);
  const [showRoom, setShowRoom] = useState(true);
  const [phase, setPhase] = useState('lobby');
  const [timer, setTimer] = useState(3);
  const [playerDice, setPlayerDice] = useState([1, 1]);
  const [oppDice, setOppDice] = useState([1, 1]);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState(null);

  const opponent = useMemo(() => {
    const name = opponents[randomInt(0, opponents.length - 1)];
    return { name, avatar: '/assets/icons/profile.svg', balance: randomInt(50, 500) };
  }, [phase]);

  useEffect(() => {
    if (phase === 'waiting') {
      setTimer(3);
      const id = setInterval(() => {
        setTimer((t) => {
          if (t <= 1) {
            clearInterval(id);
            setPhase('playing');
            return 0;
          }
          return t - 1;
        });
      }, 1000);
      return () => clearInterval(id);
    }
  }, [phase]);

  const startGame = () => {
    setShowRoom(false);
    setPhase('waiting');
  };

  const roll = () => {
    if (rolling) return;
    setRolling(true);
    setTimeout(() => {
      const pd1 = randomInt(1, 6);
      const pd2 = randomInt(1, 6);
      const od1 = randomInt(1, 6);
      const od2 = randomInt(1, 6);
      setPlayerDice([pd1, pd2]);
      setOppDice([od1, od2]);
      setRolling(false);
      const playerTotal = pd1 + pd2;
      const oppTotal = od1 + od2;
      let outcome = 'draw';
      if (playerTotal > oppTotal) outcome = 'win';
      else if (playerTotal < oppTotal) outcome = 'lose';
      setResult({ outcome, pot: selection.amount * 2 });
      setPhase('result');
    }, 700);
  };

  const rematch = () => {
    setResult(null);
    setPhase('waiting');
  };

  return (
    <div className="p-4 space-y-4 text-text">
      <h2 className="text-xl font-bold">Dice Duel</h2>
      <RoomPopup
        open={showRoom}
        selection={selection}
        setSelection={setSelection}
        onConfirm={startGame}
      />
      <ConnectWallet />
      {phase === 'waiting' && (
        <p className="text-center text-subtext">Waiting for opponent... {timer}</p>
      )}
      {phase === 'playing' && (
        <div className="space-y-4">
          <div className="flex justify-around items-center">
            <div className="space-y-2 text-center">
              <p className="font-semibold">You</p>
              <div className="flex space-x-2">
                <Dice value={playerDice[0]} rolling={rolling} />
                <Dice value={playerDice[1]} rolling={rolling} />
              </div>
            </div>
            <div className="space-y-2 text-center">
              <p className="font-semibold">{opponent.name}</p>
              <div className="flex space-x-2">
                <Dice value={oppDice[0]} rolling={rolling} />
                <Dice value={oppDice[1]} rolling={rolling} />
              </div>
            </div>
          </div>
          <button
            onClick={roll}
            disabled={rolling}
            className="w-full px-4 py-2 bg-primary hover:bg-primary-hover rounded text-white"
          >
            Roll Dice
          </button>
        </div>
      )}
      <GameResult result={result} onRematch={rematch} />
    </div>
  );
}
