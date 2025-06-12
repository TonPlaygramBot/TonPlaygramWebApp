import { useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import ConnectWallet from '../../components/ConnectWallet.jsx';
import RoomSelector from '../../components/RoomSelector.jsx';

export default function ChessGame() {
  const [selection, setSelection] = useState({ token: 'TPC', amount: 100 });
  const [game, setGame] = useState(new Chess());
  const [orientation, setOrientation] = useState('white');

  const onDrop = (sourceSquare, targetSquare) => {
    const newGame = new Chess(game.fen());
    const move = newGame.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
    if (move === null) return false;
    setGame(newGame);
    return true;
  };

  const resetGame = () => setGame(new Chess());

  const moves = game.history();

  return (
    <div className="p-4 text-text">
      <h2 className="text-2xl font-bold mb-4">Chessu</h2>
      <p className="mb-4 text-subtext">Select a room and challenge another player.</p>

      <RoomSelector selected={selection} onSelect={setSelection} />

      <div className="mt-4">
        <ConnectWallet />
      </div>

      <div className="mt-8 flex flex-col items-center space-y-2">
        <Chessboard
          id="chess-board"
          position={game.fen()}
          onPieceDrop={onDrop}
          boardWidth={350}
          boardOrientation={orientation}
        />
        <button
          onClick={resetGame}
          className="px-2 py-1 border rounded bg-primary hover:bg-primary-hover text-text"
        >
          Reset
        </button>
        <button
          onClick={() =>
            setOrientation((prev) => (prev === 'white' ? 'black' : 'white'))
          }
          className="px-2 py-1 border rounded bg-primary hover:bg-primary-hover text-text"
        >
          Flip Board
        </button>
      </div>

      <div className="mt-4">
        <h3 className="font-bold mb-2">Moves</h3>
        <ol className="list-decimal list-inside space-y-1">
          {moves.map((move, idx) => (
            <li key={idx}>{move}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}
