import { useState, useEffect } from 'react';
import { Ludo } from '@ayshrj/ludo.js';
import { useNavigate } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import GameEndPopup from '../../components/GameEndPopup.jsx';

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
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const ai = Math.min(4, Math.max(1, Number(params.get('ai') || '1')));
  const totalPlayers = Math.min(4, ai + 1);
  const COLORS = ['blue', 'red', 'green', 'yellow'];
  const chosenColors = COLORS.slice(0, totalPlayers);

  const [playerTypes] = useState(() => {
    const obj = {};
    chosenColors.forEach((c, i) => {
      obj[c] = i === 0 ? 'human' : 'bot';
    });
    return obj;
  });

  const [ludo] = useState(() => {
    const g = new Ludo(totalPlayers);
    g.players = chosenColors;
    g.reset();
    return g;
  });

  const [gameState, setGameState] = useState(ludo.getCurrentState());

  const gameOver =
    gameState.ranking.length === gameState.players.length &&
    gameState.players.length > 0;

  useEffect(() => {
    if (gameOver) return;
    if (playerTypes[gameState.turn] !== 'bot') return;
    if (gameState.gameState !== 'playerHasToRollADice') return;
    const t = setTimeout(() => {
      ludo.rollDiceForCurrentPiece();
    }, 800);
    return () => clearTimeout(t);
  }, [gameState, ludo, playerTypes, gameOver]);

  useEffect(() => {
    if (gameOver) return;
    if (playerTypes[gameState.turn] !== 'bot') return;
    if (
      gameState.gameState !== 'playerHasToSelectAPosition' ||
      gameState.diceRoll === null
    )
      return;
    const t = setTimeout(() => {
      const best = ludo.bestMove();
      if (best >= 0) ludo.selectToken(best);
    }, 600);
    return () => clearTimeout(t);
  }, [gameState, ludo, playerTypes, gameOver]);

  useEffect(() => {
    const STORAGE_KEY = `ludoGameState_${ai}`;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        ludo.reset();
        ludo.players = data.players;
        ludo.tokenPositions = data.tokenPositions;
        ludo.currentPiece = data.turn;
        ludo.ranking = data.ranking;
        ludo.currentBoardStatus = data.boardStatus;
        ludo.currentDiceRoll = data.diceRoll;
        ludo.lastDiceRoll = data.lastDiceRoll;
        ludo.gameState = data.gameState;
      } catch (err) {
        console.error('Failed to load saved game', err);
        ludo.reset();
      }
    } else {
      ludo.reset();
    }
    setGameState(ludo.getCurrentState());

    const handler = (s) => {
      setGameState({ ...s });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    };
    ludo.on('stateChange', handler);
    return () => ludo.off('stateChange', handler);
  }, [ludo, ai]);

  const handlePlayAgain = () => {
    localStorage.removeItem(`ludoGameState_${ai}`);
    ludo.reset();
  };

  const handleReturn = () => {
    localStorage.removeItem(`ludoGameState_${ai}`);
    navigate('/games/ludo/lobby');
  };

  return (
    <div className="p-4 space-y-4 text-text">
      <h2 className="text-xl font-bold">Ludo Game</h2>
      <LudoBoard game={ludo} state={gameState} />
      <GameEndPopup
        open={gameOver}
        ranking={gameState.ranking}
        onPlayAgain={handlePlayAgain}
        onReturn={handleReturn}
      />
    </div>
  );
}
