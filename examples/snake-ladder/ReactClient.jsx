import React, { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';

const PYRAMID_ROW_LENGTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15];
const BOARD_SIZE = 100;

function buildPyramidRows() {
  const rows = [];
  let value = 1;

  for (let row = PYRAMID_ROW_LENGTHS.length - 1; row >= 0; row -= 1) {
    const rowSize = PYRAMID_ROW_LENGTHS[row];
    const values = [];

    for (let col = 0; col < rowSize; col += 1) {
      if (value <= BOARD_SIZE) values.push(value);
      value += 1;
    }

    if (row % 2 === 1) values.reverse();
    rows.unshift(values);
  }

  return rows;
}

function getCellAccent(value) {
  if (value === BOARD_SIZE) return '#17b26a';
  if (value <= 10) return '#3b82f6';
  if (value % 10 === 0) return '#f59e0b';
  return '#7c3aed';
}

export default function ReactClient({
  roomId = 'room1',
  playerName = 'Player',
  serverUrl = 'http://localhost:3000'
}) {
  const [state, setState] = useState(null);
  const [socket] = useState(() => io(serverUrl));

  const rows = useMemo(() => buildPyramidRows(), []);
  const playersByTile = useMemo(() => {
    if (!state) return {};

    return state.players.reduce((acc, player) => {
      if (!acc[player.position]) acc[player.position] = [];
      acc[player.position].push(player);
      return acc;
    }, {});
  }, [state]);

  useEffect(() => {
    socket.emit('joinRoom', { roomId, name: playerName });
    socket.on('gameStateUpdate', (game) => setState(game));
    return () => {
      socket.off('gameStateUpdate');
    };
  }, [roomId, playerName, socket]);

  const rollDice = () => socket.emit('rollDice', { roomId });

  if (!state) return <div style={{ color: '#fff' }}>Loading...</div>;

  const current = state.players[state.currentPlayer]?.id;
  const isMyTurn = socket.id === current && !state.winner;
  const rolledSix = state.diceRoll === 6 && socket.id === current;

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '16px 12px 24px',
        background: 'radial-gradient(circle at top, #1e293b 0%, #020617 70%)',
        color: '#e2e8f0',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}
    >
      <div
        style={{
          margin: '0 auto 16px',
          maxWidth: 900,
          background:
            'linear-gradient(145deg, rgba(30,41,59,0.92), rgba(15,23,42,0.96))',
          border: '1px solid rgba(148,163,184,0.35)',
          borderRadius: 16,
          padding: 14,
          boxShadow: '0 18px 30px rgba(2,6,23,0.45)'
        }}
      >
        <h3 style={{ margin: '0 0 8px', letterSpacing: 0.4 }}>
          Room: {state.roomId}
        </h3>
        <p style={{ margin: '4px 0' }}>Current Player: {current}</p>
        <p style={{ margin: '4px 0 12px' }}>Last Dice Roll: {state.diceRoll}</p>
        {rolledSix && (
          <p style={{ margin: '4px 0 12px', color: '#86efac', fontWeight: 700 }}>
            You rolled a 6 — tap the dice to roll again.
          </p>
        )}
        <button
          onClick={rollDice}
          disabled={!isMyTurn}
          style={{
            border: 'none',
            borderRadius: 999,
            padding: '10px 16px',
            fontWeight: 700,
            background: 'linear-gradient(90deg, #22c55e, #14b8a6)',
            color: '#082f49',
            cursor: !isMyTurn ? 'not-allowed' : 'pointer',
            opacity: !isMyTurn ? 0.45 : 1
          }}
        >
          Roll Dice
        </button>
        <button
          onClick={rollDice}
          disabled={!isMyTurn}
          aria-label="Roll Dice"
          style={{
            marginLeft: 10,
            width: 42,
            height: 42,
            borderRadius: '50%',
            border: '1px solid rgba(148,163,184,0.4)',
            background: isMyTurn
              ? 'linear-gradient(180deg, #f8fafc, #cbd5e1)'
              : 'linear-gradient(180deg, #94a3b8, #64748b)',
            color: '#0f172a',
            fontSize: 22,
            lineHeight: 1,
            cursor: !isMyTurn ? 'not-allowed' : 'pointer',
            opacity: !isMyTurn ? 0.5 : 1,
            verticalAlign: 'middle'
          }}
          title="Tap dice to roll"
        >
          🎲
        </button>
        {state.winner && (
          <p style={{ margin: '12px 0 0' }}>Winner: {state.winner}</p>
        )}
      </div>

      <div style={{ margin: '0 auto', maxWidth: 900 }}>
        {rows.map((row, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            style={{
              display: 'grid',
              gap: 6,
              gridTemplateColumns: `repeat(${row.length}, minmax(18px, 1fr))`,
              marginBottom: 6,
              width: `${(row.length / PYRAMID_ROW_LENGTHS[PYRAMID_ROW_LENGTHS.length - 1]) * 100}%`,
              marginInline: 'auto'
            }}
          >
            {row.map((tile) => {
              const snakeTo = state.snakes[tile];
              const ladderTo = state.ladders[tile];
              const players = playersByTile[tile] || [];

              return (
                <div
                  key={tile}
                  style={{
                    position: 'relative',
                    minHeight: 42,
                    borderRadius: 10,
                    border: `1px solid ${getCellAccent(tile)}99`,
                    background:
                      'linear-gradient(180deg, rgba(15,23,42,0.95), rgba(30,41,59,0.92))',
                    boxShadow: `inset 0 0 0 1px ${getCellAccent(tile)}33`
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 5,
                      left: 6,
                      fontSize: 11,
                      opacity: 0.95
                    }}
                  >
                    {tile}
                  </span>
                  {snakeTo && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 6,
                        fontSize: 12
                      }}
                      title={`Snake to ${snakeTo}`}
                    >
                      🐍
                    </span>
                  )}
                  {ladderTo && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 6,
                        fontSize: 12
                      }}
                      title={`Ladder to ${ladderTo}`}
                    >
                      🪜
                    </span>
                  )}
                  <div
                    style={{
                      position: 'absolute',
                      left: 4,
                      right: 4,
                      bottom: 4,
                      display: 'flex',
                      gap: 4,
                      flexWrap: 'wrap'
                    }}
                  >
                    {players.map((player, idx) => (
                      <span
                        key={player.id}
                        title={player.name}
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 9,
                          fontWeight: 700,
                          color: '#020617',
                          background: idx % 2 === 0 ? '#fbbf24' : '#22d3ee'
                        }}
                      >
                        {player.name.slice(0, 1).toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
