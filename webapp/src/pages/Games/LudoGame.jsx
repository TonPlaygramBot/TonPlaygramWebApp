import { useState, useEffect } from 'react';
import { Ludo } from '@ayshrj/ludo.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

const COLOR_MAP = {
  red: '#FF0000',
  green: '#00FF00',
  blue: '#0000FF',
  yellow: '#FFFF00',
};

const STARTING_POSITIONS = {
  red: [
    [1, 1],
    [1, 4],
    [4, 1],
    [4, 4],
  ],
  green: [
    [1, 10],
    [1, 13],
    [4, 10],
    [4, 13],
  ],
  blue: [
    [10, 1],
    [10, 4],
    [13, 1],
    [13, 4],
  ],
  yellow: [
    [10, 10],
    [10, 13],
    [13, 10],
    [13, 13],
  ],
};

function LudoBoard({ game, state }) {
  const getTokensAt = (r, c) => {
    const tokens = [];
    state.players.forEach((color) => {
      state.tokenPositions[color].forEach((pos, i) => {
        if (pos === -1) {
          const [hr, hc] = STARTING_POSITIONS[color][i];
          if (hr === r && hc === c) tokens.push({ color, index: i });
        } else {
          const [rr, cc] = game.colorPaths[color][pos];
          if (rr === r && cc === c) tokens.push({ color, index: i });
        }
      });
    });
    return tokens;
  };

  const groupTokens = (tokens) => {
    const map = {};
    tokens.forEach(({ color, index }) => {
      if (!map[color]) map[color] = [];
      map[color].push(index);
    });
    return Object.entries(map).map(([color, indices]) => ({
      color,
      indices,
    }));
  };

  const handleTokenClick = (color, index) => {
    if (state.gameState !== 'playerHasToSelectAPosition') return;
    if (color !== state.turn) return;
    if (!game.validTokenIndices.includes(index)) return;
    game.selectToken(index);
  };

  return (
    <div className="w-full space-y-2">
      <div
        style={{
          width: '100%',
          aspectRatio: '1/1',
          overflow: 'hidden',
          background: '#f0f0f0',
          borderRadius: '8px',
        }}
      >
        <div
          style={{
            display: 'grid',
            width: '100%',
            height: '100%',
            gridTemplateColumns: 'repeat(15,1fr)',
            gridTemplateRows: 'repeat(15,1fr)',
          }}
        >
          {game.board.map((row, ri) =>
            row.map((col, ci) => {
              const raw = getTokensAt(ri, ci);
              const groups = groupTokens(raw);
              const bg = col === null ? '#f8f8f8' : undefined;
              return (
                <div
                  key={`${ri}-${ci}`}
                  style={{
                    position: 'relative',
                    borderBottom: '1px solid #ccc',
                    borderRight: '1px solid #ccc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: bg,
                    ...(col?.isOnPathToFinalPosition
                      ? { backgroundColor: COLOR_MAP[col.isOnPathToFinalPosition] }
                      : {}),
                    ...(col?.isStartingPosition
                      ? { backgroundColor: COLOR_MAP[col.isStartingPosition] }
                      : {}),
                    ...(col?.isFinalPosition
                      ? { backgroundColor: COLOR_MAP[col.isFinalPosition] }
                      : {}),
                  }}
                >
                  {groups.map(({ color, indices }, i) => (
                    <div
                      key={`${color}-${i}`}
                      onClick={() => handleTokenClick(color, indices[0])}
                      style={{
                        position: 'absolute',
                        transform: `translate(${i * 10 - 10}px, ${i * -10 + 10}px)`,
                        width: `${40 + indices.length * 10}%`,
                        height: `${40 + indices.length * 10}%`,
                        backgroundColor: COLOR_MAP[color],
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                      }}
                    >
                      {indices.length > 1 ? indices.length : ''}
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          className="px-3 py-1 bg-primary text-white rounded disabled:opacity-50"
          onClick={() => game.rollDiceForCurrentPiece()}
          disabled={state.gameState !== 'playerHasToRollADice'}
        >
          Roll Dice
        </button>
        <button
          className="px-3 py-1 bg-green-600 text-white rounded"
          onClick={() => game.reset()}
        >
          Reset
        </button>
      </div>
      <div className="text-center font-semibold">
        {state.ranking.length === state.players.length && state.players.length > 0
          ? `Game finished! Final ranking: ${state.ranking.join(' -> ')}`
          : `${state.turn.toUpperCase()}'s turn${
              state.lastDiceRoll ? ` (Last roll: ${state.lastDiceRoll})` : ''
            }`}
      </div>
    </div>
  );
}

export default function LudoGame() {
  useTelegramBackButton();
  const [ludo] = useState(() => new Ludo(4));
  const [gameState, setGameState] = useState(ludo.getCurrentState());

  useEffect(() => {
    const handler = (s) => setGameState({ ...s });
    ludo.on('stateChange', handler);
    ludo.reset();
    return () => ludo.off('stateChange', handler);
  }, [ludo]);

  return (
    <div className="p-4 space-y-4 text-text">
      <h2 className="text-xl font-bold">Ludo Game</h2>
      <LudoBoard game={ludo} state={gameState} />
    </div>
  );
}
