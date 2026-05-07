import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const PYRAMID_ROW_LENGTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15];
const BOARD_SIZE = 100;
const PLAYER_SEATS = ['top', 'right', 'bottom', 'left'];
const PLAYER_COLORS = ['#fbbf24', '#22d3ee', '#f472b6', '#34d399'];
const DICE_FACE_ROTATIONS = {
  1: 'rotateX(0deg) rotateY(0deg)',
  2: 'rotateX(0deg) rotateY(-90deg)',
  3: 'rotateX(90deg) rotateY(0deg)',
  4: 'rotateX(-90deg) rotateY(0deg)',
  5: 'rotateX(0deg) rotateY(90deg)',
  6: 'rotateX(180deg) rotateY(0deg)'
};
const PIPS_BY_FACE = {
  1: ['center'],
  2: ['top-left', 'bottom-right'],
  3: ['top-left', 'center', 'bottom-right'],
  4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
  5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
  6: ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right']
};

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

function DiceFace({ value, transform }) {
  return (
    <div className="royal-dice-face" style={{ transform }}>
      {PIPS_BY_FACE[value].map((pip) => (
        <span key={`${value}-${pip}`} className={`royal-dice-pip pip-${pip}`} />
      ))}
    </div>
  );
}

function RoyalDice({ value = 1, rolling, disabled, onRoll }) {
  const safeValue = Number.isInteger(value) && value >= 1 && value <= 6 ? value : 1;
  const landingTransform = DICE_FACE_ROTATIONS[safeValue];

  return (
    <button
      type="button"
      className={`royal-dice-button${rolling ? ' is-rolling' : ''}`}
      onClick={onRoll}
      disabled={disabled}
      aria-label={`Roll dice${value ? `, last result ${value}` : ''}`}
    >
      <span className="royal-dice-table-shadow" />
      <span className="royal-dice-scene">
        <span className="royal-dice-cube" style={{ transform: rolling ? undefined : landingTransform }}>
          <DiceFace value={1} transform="translateZ(28px)" />
          <DiceFace value={6} transform="rotateY(180deg) translateZ(28px)" />
          <DiceFace value={2} transform="rotateY(90deg) translateZ(28px)" />
          <DiceFace value={5} transform="rotateY(-90deg) translateZ(28px)" />
          <DiceFace value={3} transform="rotateX(-90deg) translateZ(28px)" />
          <DiceFace value={4} transform="rotateX(90deg) translateZ(28px)" />
        </span>
      </span>
      <span className="royal-dice-label">{rolling ? 'Rolling...' : `Roll ${safeValue}`}</span>
    </button>
  );
}

function TableWeapon({ seat }) {
  const vertical = seat === 'left' || seat === 'right';
  return (
    <span className={`table-weapon table-weapon-${seat}${vertical ? ' is-vertical' : ' is-horizontal'}`} aria-hidden="true">
      <span className="weapon-barrel" />
      <span className="weapon-body" />
      <span className="weapon-trigger" />
      <span className="weapon-grip" />
    </span>
  );
}

function PlayerStation({ player, seat, index, active }) {
  const color = PLAYER_COLORS[index % PLAYER_COLORS.length];
  const initial = player?.name?.slice(0, 1).toUpperCase() || `${index + 1}`;
  const name = player?.name || `Open Player ${index + 1}`;

  return (
    <div className={`player-station player-station-${seat}${active ? ' is-active' : ''}`} style={{ '--player-color': color }}>
      <div className="tabletop-slot">
        {(seat === 'left' || seat === 'top') && <TableWeapon seat={seat} />}
        <span className="human-character" title={name}>
          <span className="human-head">{initial}</span>
          <span className="human-body" />
          <span className="human-right-hand" />
        </span>
        {(seat === 'right' || seat === 'bottom') && <TableWeapon seat={seat} />}
      </div>
      <div className="player-name">{name}</div>
    </div>
  );
}

function PlayerWeaponTable({ players, currentId }) {
  return (
    <div className="weapon-table" aria-label="Player weapons laid flat on the table">
      {PLAYER_SEATS.map((seat, index) => (
        <PlayerStation
          key={seat}
          seat={seat}
          index={index}
          player={players[index]}
          active={players[index]?.id === currentId}
        />
      ))}
    </div>
  );
}

export default function ReactClient({
  roomId = 'room1',
  playerName = 'Player',
  serverUrl = 'http://localhost:3000'
}) {
  const [state, setState] = useState(null);
  const [socket] = useState(() => io(serverUrl));
  const [diceRolling, setDiceRolling] = useState(false);
  const rollTimeoutRef = useRef(null);
  const previousDiceRollRef = useRef(null);

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
      if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
    };
  }, [roomId, playerName, socket]);

  useEffect(() => {
    if (!state?.diceRoll || state.diceRoll === previousDiceRollRef.current) return;
    previousDiceRollRef.current = state.diceRoll;
    setDiceRolling(true);
    if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
    rollTimeoutRef.current = setTimeout(() => setDiceRolling(false), 820);
  }, [state?.diceRoll]);

  const rollDice = () => {
    if (diceRolling) return;
    setDiceRolling(true);
    socket.emit('rollDice', { roomId });
    if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
    rollTimeoutRef.current = setTimeout(() => setDiceRolling(false), 1400);
  };

  if (!state) return <div style={{ color: '#fff' }}>Loading...</div>;

  const current = state.players[state.currentPlayer]?.id;
  const diceDisabled = socket.id !== current || state.winner || diceRolling;

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
      <style>{`
        .game-hud {
          margin: 0 auto 16px;
          max-width: 900px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
          align-items: center;
          background: linear-gradient(145deg, rgba(30,41,59,0.92), rgba(15,23,42,0.96));
          border: 1px solid rgba(148,163,184,0.35);
          border-radius: 16px;
          padding: 14px;
          box-shadow: 0 18px 30px rgba(2,6,23,0.45);
        }
        .royal-dice-button {
          position: relative;
          border: 0;
          width: 118px;
          min-height: 122px;
          border-radius: 24px;
          display: grid;
          place-items: center;
          background: radial-gradient(circle at 35% 20%, rgba(255,255,255,.28), rgba(15,23,42,.72) 46%, rgba(2,6,23,.96));
          color: #fef3c7;
          cursor: pointer;
          overflow: hidden;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.25), 0 16px 28px rgba(0,0,0,.36);
        }
        .royal-dice-button:disabled { cursor: not-allowed; opacity: .52; }
        .royal-dice-table-shadow {
          position: absolute;
          width: 72px;
          height: 18px;
          bottom: 24px;
          border-radius: 999px;
          background: rgba(0,0,0,.42);
          filter: blur(7px);
        }
        .royal-dice-scene { width: 56px; height: 56px; perspective: 520px; transform-style: preserve-3d; }
        .royal-dice-cube {
          position: relative;
          width: 56px;
          height: 56px;
          transform-style: preserve-3d;
          transition: transform 360ms cubic-bezier(.2,.9,.2,1.18);
        }
        .royal-dice-button.is-rolling .royal-dice-cube {
          animation: royalDiceTumble 820ms cubic-bezier(.16,.85,.24,1.05) both;
        }
        .royal-dice-face {
          position: absolute;
          inset: 0;
          border: 2px solid rgba(254,243,199,.72);
          border-radius: 14px;
          background: linear-gradient(145deg, #fef3c7 0%, #f59e0b 52%, #b45309 100%);
          box-shadow: inset -8px -8px 14px rgba(120,53,15,.32), inset 5px 5px 10px rgba(255,255,255,.32);
        }
        .royal-dice-pip {
          position: absolute;
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #111827;
          box-shadow: 0 1px 1px rgba(255,255,255,.18);
        }
        .pip-top-left { top: 12px; left: 12px; }
        .pip-top-right { top: 12px; right: 12px; }
        .pip-middle-left { top: 23px; left: 12px; }
        .pip-middle-right { top: 23px; right: 12px; }
        .pip-center { top: 23px; left: 23px; }
        .pip-bottom-left { bottom: 12px; left: 12px; }
        .pip-bottom-right { bottom: 12px; right: 12px; }
        .royal-dice-label { font-size: 12px; font-weight: 900; letter-spacing: .04em; text-transform: uppercase; z-index: 1; }
        @keyframes royalDiceTumble {
          0% { transform: translateY(-4px) rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
          35% { transform: translateY(-28px) rotateX(330deg) rotateY(250deg) rotateZ(110deg); }
          72% { transform: translateY(4px) rotateX(690deg) rotateY(560deg) rotateZ(220deg); }
          100% { transform: translateY(0) rotateX(720deg) rotateY(720deg) rotateZ(360deg); }
        }
        .weapon-table {
          position: relative;
          margin: 0 auto 14px;
          max-width: 900px;
          min-height: 184px;
          border-radius: 28px;
          background: radial-gradient(circle at center, rgba(120,53,15,.38), rgba(30,41,59,.58) 58%, rgba(15,23,42,.9));
          border: 1px solid rgba(251,191,36,.24);
          box-shadow: inset 0 0 46px rgba(15,23,42,.8), 0 18px 34px rgba(0,0,0,.28);
        }
        .player-station { position: absolute; display: grid; gap: 4px; place-items: center; font-size: 11px; font-weight: 800; color: #e2e8f0; }
        .player-station-top { top: 8px; left: 50%; transform: translateX(-50%); }
        .player-station-bottom { bottom: 8px; left: 50%; transform: translateX(-50%); }
        .player-station-left { left: 10px; top: 50%; transform: translateY(-50%); }
        .player-station-right { right: 10px; top: 50%; transform: translateY(-50%); }
        .tabletop-slot { display: flex; align-items: center; justify-content: center; gap: 8px; min-width: 138px; min-height: 54px; padding: 5px 8px; border-radius: 18px; background: rgba(2,6,23,.34); border: 1px solid rgba(148,163,184,.2); }
        .player-station-left .tabletop-slot, .player-station-right .tabletop-slot { min-width: 58px; min-height: 136px; flex-direction: column; }
        .is-active .tabletop-slot { border-color: var(--player-color); box-shadow: 0 0 20px color-mix(in srgb, var(--player-color) 44%, transparent); }
        .human-character { position: relative; width: 38px; height: 42px; display: inline-block; }
        .human-head { position: absolute; left: 7px; top: 0; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; background: var(--player-color); color: #020617; font-size: 12px; font-weight: 950; }
        .human-body { position: absolute; left: 10px; bottom: 0; width: 18px; height: 22px; border-radius: 9px 9px 5px 5px; background: linear-gradient(180deg, rgba(255,255,255,.72), rgba(148,163,184,.88)); }
        .human-right-hand { position: absolute; right: -2px; bottom: 13px; width: 9px; height: 9px; border-radius: 50%; background: #f8d2a3; border: 1px solid rgba(120,53,15,.45); z-index: 2; }
        .table-weapon { position: relative; display: inline-block; width: 70px; height: 22px; filter: drop-shadow(0 4px 5px rgba(0,0,0,.42)); }
        .table-weapon.is-vertical { width: 24px; height: 72px; }
        .weapon-barrel { position: absolute; background: #cbd5e1; border-radius: 999px; }
        .is-horizontal .weapon-barrel { width: 34px; height: 6px; right: 0; top: 8px; }
        .is-vertical .weapon-barrel { width: 6px; height: 34px; left: 9px; top: 0; }
        .weapon-body { position: absolute; background: linear-gradient(135deg, #334155, #020617); border: 1px solid rgba(226,232,240,.42); border-radius: 7px; }
        .is-horizontal .weapon-body { width: 38px; height: 16px; left: 8px; top: 3px; }
        .is-vertical .weapon-body { width: 16px; height: 38px; left: 4px; top: 24px; }
        .weapon-grip { position: absolute; background: #78350f; border-radius: 5px; }
        .is-horizontal .weapon-grip { width: 10px; height: 18px; left: 10px; top: 14px; transform: rotate(-18deg); transform-origin: top center; }
        .is-vertical .weapon-grip { width: 18px; height: 10px; left: -5px; bottom: 10px; transform: rotate(-18deg); transform-origin: right center; }
        .weapon-trigger { position: absolute; border: 2px solid #fef3c7; border-radius: 50%; z-index: 3; }
        .is-horizontal .weapon-trigger { width: 10px; height: 9px; left: 20px; top: 12px; }
        .is-vertical .weapon-trigger { width: 9px; height: 10px; left: 1px; bottom: 22px; }
        .player-name { max-width: 128px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: .9; }
        @media (max-width: 640px) {
          .game-hud { grid-template-columns: 1fr; }
          .royal-dice-button { width: 100%; min-height: 116px; }
          .weapon-table { min-height: 202px; }
          .tabletop-slot { min-width: 114px; }
          .player-station-left .player-name, .player-station-right .player-name { max-width: 74px; }
        }
      `}</style>

      <div className="game-hud">
        <div>
          <h3 style={{ margin: '0 0 8px', letterSpacing: 0.4 }}>Room: {state.roomId}</h3>
          <p style={{ margin: '4px 0' }}>Current Player: {current}</p>
          <p style={{ margin: '4px 0 0' }}>Last Dice Roll: {state.diceRoll || '—'}</p>
          {state.winner && <p style={{ margin: '12px 0 0' }}>Winner: {state.winner}</p>}
        </div>
        <RoyalDice value={state.diceRoll || 1} rolling={diceRolling} disabled={diceDisabled} onRoll={rollDice} />
      </div>

      <PlayerWeaponTable players={state.players} currentId={current} />

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
                          background: PLAYER_COLORS[idx % PLAYER_COLORS.length]
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
