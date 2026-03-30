import React, { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';

const GRID_SIZE = 10;
const CELL_SIZE = 48;
const PLAYER_COLORS = ['#f97316', '#22c55e', '#0ea5e9', '#a855f7'];

const getCellLayout = (cell) => {
  const rowFromBottom = Math.floor((cell - 1) / GRID_SIZE);
  const colInRow = (cell - 1) % GRID_SIZE;
  const isLeftToRight = rowFromBottom % 2 === 0;
  const col = isLeftToRight ? colInRow : GRID_SIZE - 1 - colInRow;
  const inset = rowFromBottom * 6;
  const size = CELL_SIZE - rowFromBottom * 1.2;
  const x = col * CELL_SIZE + inset;
  const y = (GRID_SIZE - 1 - rowFromBottom) * CELL_SIZE + rowFromBottom * 2.4;

  return {
    x,
    y,
    width: size,
    height: size,
    rowFromBottom,
    col
  };
};

const getCellCenter = (cell) => {
  const { x, y, width, height } = getCellLayout(cell);
  return {
    x: x + width / 2,
    y: y + height / 2
  };
};

const boardShellStyle = {
  width: '100%',
  maxWidth: `${GRID_SIZE * CELL_SIZE + 24}px`,
  margin: '0 auto',
  padding: '12px',
  borderRadius: '26px',
  background:
    'linear-gradient(165deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.98) 48%, rgba(2,6,23,0.98) 100%)',
  border: '1px solid rgba(148,163,184,0.26)',
  boxShadow:
    '0 22px 55px rgba(2,6,23,0.55), inset 0 1px 0 rgba(148,163,184,0.2)'
};

export default function ReactClient({
  roomId = 'room1',
  playerName = 'Player',
  serverUrl = 'http://localhost:3000'
}) {
  const [state, setState] = useState(null);
  const [socket] = useState(() => io(serverUrl));

  useEffect(() => {
    socket.emit('joinRoom', { roomId, name: playerName });
    socket.on('gameStateUpdate', (game) => setState(game));
    return () => {
      socket.off('gameStateUpdate');
    };
  }, [roomId, playerName, socket]);

  const rollDice = () => socket.emit('rollDice', { roomId });

  const cells = useMemo(
    () => Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => i + 1),
    []
  );

  if (!state) return <div>Loading...</div>;

  const currentPlayer = state.players[state.currentPlayer];
  const current = currentPlayer?.id;
  const snakes = Object.entries(state.snakes || {});
  const ladders = Object.entries(state.ladders || {});

  return (
    <div
      style={{ fontFamily: 'Inter, system-ui, sans-serif', color: '#e2e8f0' }}
    >
      <h3 style={{ marginBottom: '8px' }}>Room: {state.roomId}</h3>
      <p style={{ margin: '4px 0' }}>
        Current Player: {current || 'Waiting...'}
      </p>
      <p style={{ margin: '4px 0 16px' }}>
        Last Dice Roll: {state.diceRoll ?? '—'}
      </p>

      <div style={boardShellStyle}>
        <div
          style={{
            position: 'relative',
            width: `${GRID_SIZE * CELL_SIZE}px`,
            height: `${GRID_SIZE * CELL_SIZE}px`,
            margin: '0 auto',
            borderRadius: '20px',
            overflow: 'hidden',
            border: '1px solid rgba(148,163,184,0.28)',
            background:
              'linear-gradient(180deg, rgba(30,41,59,0.35) 0%, rgba(15,23,42,0.6) 100%), radial-gradient(circle at top, rgba(56,189,248,0.22), transparent 55%)'
          }}
        >
          {cells.map((cell) => {
            const { x, y, width, height, rowFromBottom } = getCellLayout(cell);
            const shade =
              rowFromBottom % 2 === 0
                ? 'rgba(15,23,42,0.92)'
                : 'rgba(30,41,59,0.94)';

            return (
              <div
                key={cell}
                style={{
                  position: 'absolute',
                  left: `${x}px`,
                  top: `${y}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                  borderRadius: '10px',
                  border: '1px solid rgba(148,163,184,0.25)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-end',
                  padding: '4px 6px',
                  fontSize: '11px',
                  color: 'rgba(226,232,240,0.92)',
                  fontWeight: 600,
                  background: shade,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)'
                }}
              >
                {cell}
              </div>
            );
          })}

          <svg
            width={GRID_SIZE * CELL_SIZE}
            height={GRID_SIZE * CELL_SIZE}
            viewBox={`0 0 ${GRID_SIZE * CELL_SIZE} ${GRID_SIZE * CELL_SIZE}`}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              pointerEvents: 'none'
            }}
          >
            <defs>
              <linearGradient
                id="snakeStroke"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
              <linearGradient
                id="ladderStroke"
                x1="0%"
                y1="100%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>
            </defs>

            {ladders.map(([from, to]) => {
              const start = getCellCenter(Number(from));
              const end = getCellCenter(Number(to));
              return (
                <g key={`ladder-${from}-${to}`}>
                  <line
                    x1={start.x - 7}
                    y1={start.y}
                    x2={end.x - 7}
                    y2={end.y}
                    stroke="url(#ladderStroke)"
                    strokeWidth="3"
                  />
                  <line
                    x1={start.x + 7}
                    y1={start.y}
                    x2={end.x + 7}
                    y2={end.y}
                    stroke="url(#ladderStroke)"
                    strokeWidth="3"
                  />
                  {[0.2, 0.4, 0.6, 0.8].map((t) => (
                    <line
                      key={`${from}-${to}-rung-${t}`}
                      x1={(1 - t) * (start.x - 7) + t * (end.x - 7)}
                      y1={(1 - t) * start.y + t * end.y}
                      x2={(1 - t) * (start.x + 7) + t * (end.x + 7)}
                      y2={(1 - t) * start.y + t * end.y}
                      stroke="rgba(34,197,94,0.78)"
                      strokeWidth="2"
                    />
                  ))}
                </g>
              );
            })}

            {snakes.map(([from, to]) => {
              const start = getCellCenter(Number(from));
              const end = getCellCenter(Number(to));
              const midX = (start.x + end.x) / 2;
              const bendX = midX + (start.x < end.x ? -28 : 28);
              const bendY = (start.y + end.y) / 2;

              return (
                <path
                  key={`snake-${from}-${to}`}
                  d={`M ${start.x} ${start.y} C ${bendX} ${start.y - 18}, ${bendX} ${end.y + 18}, ${end.x} ${end.y}`}
                  fill="none"
                  stroke="url(#snakeStroke)"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              );
            })}
          </svg>

          {state.players.map((player, index) => {
            const cell = player.position > 0 ? player.position : 1;
            const center = getCellCenter(cell);
            const offsetX = (index % 2) * 12 - 6;
            const offsetY = Math.floor(index / 2) * 12 - 6;

            return (
              <div
                key={player.id}
                title={`${player.name} on ${player.position}`}
                style={{
                  position: 'absolute',
                  left: `${center.x + offsetX - 8}px`,
                  top: `${center.y + offsetY - 8}px`,
                  width: '16px',
                  height: '16px',
                  borderRadius: '9999px',
                  border: '2px solid rgba(255,255,255,0.95)',
                  background: PLAYER_COLORS[index % PLAYER_COLORS.length],
                  boxShadow: '0 2px 10px rgba(15,23,42,0.45)'
                }}
              />
            );
          })}
        </div>
      </div>

      <ul style={{ listStyle: 'none', padding: 0, marginTop: '14px' }}>
        {state.players.map((p, index) => (
          <li
            key={p.id}
            style={{
              margin: '6px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '9999px',
                background: PLAYER_COLORS[index % PLAYER_COLORS.length]
              }}
            />
            <span>
              {p.name}: {p.position}
            </span>
          </li>
        ))}
      </ul>

      <button
        onClick={rollDice}
        disabled={socket.id !== current || state.winner}
        style={{
          marginTop: '10px',
          border: 'none',
          borderRadius: '9999px',
          padding: '10px 18px',
          color: '#f8fafc',
          background: 'linear-gradient(90deg, #0ea5e9 0%, #22c55e 100%)',
          fontWeight: 700,
          cursor:
            socket.id !== current || state.winner ? 'not-allowed' : 'pointer',
          opacity: socket.id !== current || state.winner ? 0.55 : 1
        }}
      >
        Roll Dice
      </button>

      {state.winner && (
        <p style={{ marginTop: '12px', fontWeight: 700 }}>
          Winner: {state.winner}
        </p>
      )}
    </div>
  );
}
