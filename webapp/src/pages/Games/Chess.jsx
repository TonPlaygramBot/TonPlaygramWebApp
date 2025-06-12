import { useState } from 'react';

import { Chess } from 'chess.js';

import { Chessboard } from 'react-chessboard';

import ConnectWallet from '../../components/ConnectWallet.jsx';

export default function ChessGame() {

  const [stake, setStake] = useState(100);

  const [game, setGame] = useState(new Chess());

  const onDrop = (sourceSquare, targetSquare) => {

    const newGame = new Chess(game.fen());

    const move = newGame.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });

    if (move === null) return false;

    setGame(newGame);

    return true;

  };

  const resetGame = () => setGame(new Chess());

  return (

    <div className="p-4">

      <h2 className="text-2xl font-bold mb-4 text-text">Chessu</h2>

      <p className="mb-4 text-subtext">Stake TPC and challenge another player.</p>

      <div className="space-x-2 mb-4">

        {[100, 500, 1000, 5000, 10000].map((amt) => (

          <button

            key={amt}

            onClick={() => setStake(amt)}

            className={`px-2 py-1 border rounded ${

              stake === amt ? 'bg-accent text-background' : 'bg-surface text-text'

            }`}

          >

            {amt} TPC

          </button>

        ))}

      </div>

      <ConnectWallet />

      <div className="mt-8 flex flex-col items-center space-y-2">

        <Chessboard

          id="chess-board"

          position={game.fen()}

          onPieceDrop={onDrop}

          boardWidth={350}

          boardOrientation="white"

        />

        <button

          onClick={resetGame}

          className="px-2 py-1 border rounded bg-primary hover:bg-primary-hover text-text"

        >

          Reset

        </button>

      </div>

    </div>

  );

}