import { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import ConnectWallet from '../../components/ConnectWallet.jsx';
import RoomPopup from '../../components/RoomPopup.jsx';

export default function ChessGame() {
  const [selection, setSelection] = useState(null);
  const [showRoom, setShowRoom] = useState(true);
  const [game, setGame] = useState(new Chess());
  const [seconds, setSeconds] = useState(5 * 60); // 5-minute timer

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

  const resetGame = () => setGame(new Chess());

  const formatTime = (t) => {
    const m = String(Math.floor(t / 60)).padStart(2, '0');
    const s = String(t % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="p-4 space-y-4 text-text">
      <RoomPopup
        open={showRoom}
        selection={selection}
        setSelection={setSelection}
        onConfirm={() => setShowRoom(false)}
      />

      {/* Top Player Bar */}
      <div className="flex items-center justify-between">
        <div className="text-center">
          <img
            src="https://placehold.co/64"
            alt="Player"
            className="mx-auto w-16 h-16 object-cover hexagon hexagon-gold"
          />
          <p className="text-xs mt-1">0.5 {selection?.token}</p>
        </div>
        <div className="text-xl font-bold">{formatTime(seconds)}</div>
        <div className="text-center">
          <img
            src="https://placehold.co/64"
            alt="Opponent"
            className="mx-auto w-16 h-16 object-cover hexagon hexagon-gold"
          />
          <p className="text-xs mt-1">0.5 {selection?.token}</p>
        </div>
      </div>

      {/* Chessboard */}
      <div className="mx-auto" style={{ maxWidth: '360px' }}>
        <Chessboard
          id="tonplay-chess"
          position={game.fen()}
          onPieceDrop={onDrop}
          boardWidth={360}
          customBoardStyle={{
            boxShadow: '0 10px 20px rgba(0,0,0,0.5)',
            borderRadius: '8px',
          }}
          customDarkSquareStyle={{ backgroundColor: '#2b2b2b' }}
          customLightSquareStyle={{ backgroundColor: '#3b3b3b' }}
        />
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between bg-gray-800 rounded-lg p-3 text-sm">
        <div className="flex items-center space-x-1">
          <span className="text-lg">♟</span>
          <span>Opponent</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="text-yellow-400">🪙</span>
          <span>{(selection?.amount ?? 0) * 2} {selection?.token}</span>
        </div>
        <button className="px-3 py-1 border border-yellow-500 rounded text-yellow-500 hover:bg-yellow-500 hover:text-black transition">
          LEAVE
        </button>
      </div>

      {/* Wallet & Reset */}
      <ConnectWallet />
      <div className="text-center">
        <button
          onClick={resetGame}
          className="mt-2 px-4 py-1 border border-yellow-500 rounded text-yellow-500 hover:bg-yellow-500 hover:text-black"
        >
          Reset Game
        </button>
      </div>
    </div>
  );
}
