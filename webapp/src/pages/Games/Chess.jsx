import { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import ConnectWallet from '../../components/ConnectWallet.jsx';
import RoomSelector from '../../components/RoomSelector.jsx';

export default function ChessGame() {
  const [selection, setSelection] = useState({ token: 'TPC', amount: 100 });
  const [game, setGame] = useState(new Chess('8/8/8/3N4/8/8/8/8 w - - 0 1'));
  const [seconds, setSeconds] = useState(4 * 60 + 32);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const onDrop = (sourceSquare, targetSquare) => {
    const newGame = new Chess(game.fen());
    const move = newGame.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
    if (move === null) return false;
    setGame(newGame);
    return true;
  };

  const formatTime = (t) => {
    const m = String(Math.floor(t / 60)).padStart(2, '0');
    const s = String(t % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const highlight = {
    c3: { backgroundColor: 'rgba(161, 110, 40, 0.4)' },
    e3: { backgroundColor: 'rgba(161, 110, 40, 0.4)' },
    c5: { backgroundColor: 'rgba(161, 110, 40, 0.4)' },
  };

  return (
    <div className="p-4 space-y-4 text-white">
      <RoomSelector selected={selection} onSelect={setSelection} />
      <div className="flex items-center justify-between">
        <div className="text-center">
          <img src="https://placehold.co/64" alt="Player" className="player-avatar" />
          <p className="text-xs mt-1">0,5 TON</p>
        </div>
        <div className="text-xl font-bold">{formatTime(seconds)}</div>
        <div className="text-center">
          <img src="https://placehold.co/64" alt="Opponent" className="player-avatar" />
          <p className="text-xs mt-1">0,5 TON</p>
        </div>
      </div>
      <div className="mx-auto" style={{ maxWidth: '360px' }}>
        <Chessboard
          id="board"
          position={game.fen()}
          onPieceDrop={onDrop}
          boardWidth={360}
          customBoardStyle={{ boxShadow: '0 10px 20px rgba(0,0,0,0.5)', borderRadius: '8px' }}
          customDarkSquareStyle={{ backgroundColor: '#2b2b2b' }}
          customLightSquareStyle={{ backgroundColor: '#3b3b3b' }}
          customSquareStyles={highlight}
        />
      </div>
      <div className="flex items-center justify-between bg-gray-800 rounded-lg p-3 text-sm">
        <div className="flex items-center space-x-1">
          <span className="text-lg">♟</span>
          <span>Opponent</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="text-blue-500">🪙</span>
          <span>1,2 TON</span>
        </div>
        <button className="px-3 py-1 border border-yellow-500 rounded">LEAVE</button>
      </div>
      <ConnectWallet />
    </div>
  );
}
