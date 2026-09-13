import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getTabletopGame,
  PLAYER_COLORS,
  TILE_COLORS,
  RESOURCE_NAMES,
  GEM_NAMES,
  CITY_NAMES
} from './shared/catalog.mjs';
import { LocalTabletopSession } from './localSession';
import { OnlineTabletopSession } from './onlineSession';
import { getTelegramFirstName } from '../../utils/telegram.js';
import { isGameMuted, getGameVolume, setGameMuted } from '../../utils/sound.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import Room from './Room';
import type { GameSession, GameView } from './types';
import './tabletop.css';
class RoomBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p className="tt-status">
        3D room unavailable. You can play using the controls below.
      </p>
    ) : (
      this.props.children
    );
  }
}
export default function TabletopGame({ gameId }: { gameId: string }) {
  const game = getTabletopGame(gameId)!,
    navigate = useNavigate(),
    [params] = useSearchParams();
  const mode = params.get('mode') === 'online' ? 'online' : 'ai',
    tableId = params.get('tableId') || '',
    room = params.get('room') || 'club',
    count = [2, 3, 4].includes(Number(params.get('players')))
      ? Number(params.get('players'))
      : 2,
    difficulty = params.get('difficulty') === 'casual' ? 'casual' : 'club';
  const session = useRef<GameSession | null>(null),
    [view, setView] = useState<GameView | null>(null),
    [localId, setLocalId] = useState('you'),
    [connection, setConnection] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [help, setHelp] = useState(false),
    [leave, setLeave] = useState(false),
    [muted, setMuted] = useState(isGameMuted()),
    [selected, setSelected] = useState<number | null>(null),
    [draft, setDraft] = useState<{ source: number; color: number } | null>(
      null
    ),
    [now, setNow] = useState(Date.now());
  const audio = useRef<HTMLAudioElement | null>(null),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    setView(null);
    setConnection(mode === 'online' ? 'Connecting to your table…' : '');
    const s: GameSession =
      mode === 'online'
        ? new OnlineTabletopSession(tableId, gameId, setConnection)
        : new LocalTabletopSession(
            gameId,
            count,
            difficulty,
            getTelegramFirstName() || 'You'
          );
    session.current = s;
    const unsub = s.subscribe((v) => {
      setLocalId(s.localId);
      setView(v);
    });
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive.current = false;
      clearInterval(clock);
      unsub();
      s.dispose();
      session.current = null;
    };
  }, [gameId, mode, tableId, count, difficulty]);
  useEffect(() => {
    const sound = new Audio('/assets/sounds/pounding-cards-on-table-99355.mp3');
    sound.preload = 'none';
    audio.current = sound;
    return () => {
      sound.pause();
      audio.current = null;
    };
  }, []);
  function exit() {
    session.current?.leave?.();
    if (mode === 'online')
      try {
        sessionStorage.removeItem(`${gameId}-match`);
      } catch {}
    navigate(`/games/${gameId}/lobby`);
  }
  useTelegramBackButton(() => {
    if (view?.done || mode === 'ai') exit();
    else setLeave(true);
  });
  async function act(id: string) {
    if (!view || busy) return;
    setBusy(true);
    setError('');
    try {
      await session.current?.act(id, view.revision);
      if (!isGameMuted() && audio.current) {
        audio.current.volume = getGameVolume() * 0.28;
        audio.current.currentTime = 0;
        void audio.current.play().catch(() => {});
      }
      setSelected(null);
      setDraft(null);
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : 'Move failed.');
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  const viewer = view
      ? Math.max(
          0,
          view.players.findIndex((p) => p.id === localId)
        )
      : 0,
    p = view?.players[viewer],
    actor = view?.players[view.auction?.seat ?? view.turn],
    myTurn =
      (actor?.id === localId && !view?.done && mode === 'ai') ||
      (actor?.id === localId && view?.status === 'playing' && !view?.done);
  let actions = view?.actions || [];
  if (gameId === 'mosaicroyal')
    actions = draft
      ? actions.filter(
          (a) => a.source === draft.source && a.color === draft.color
        )
      : [];
  else if (
    selected !== null &&
    ['oligarchs', 'harborempires'].includes(gameId)
  ) {
    const matches = actions.filter(
      (a) => a.cell === selected || a.cell === undefined
    );
    if (matches.length) actions = matches;
  }
  // Clock offset is captured from each server snapshot; wall clocks need not agree.
  const received = useRef({ revision: -1, serverNow: 0, localNow: 0 });
  if (
    view &&
    (received.current.revision !== view.revision ||
      received.current.serverNow !== view.serverNow)
  ) {
    received.current = {
      revision: view.revision,
      serverNow: view.serverNow || 0,
      localNow: Date.now()
    };
  }
  const seconds = view?.turnDeadline
    ? Math.max(
        0,
        Math.ceil(
          (view.turnDeadline -
            received.current.serverNow -
            (now - received.current.localNow)) /
            1000
        )
      )
    : 0;
  const selectedCell = selected !== null ? view?.board?.[selected] : null,
    selectedCard = selected !== null ? view?.market?.[selected] : null;
  return (
    <main
      className="tt-game"
      style={{ '--tt-accent': game.color } as React.CSSProperties}
    >
      <header className="tt-game-header">
        <button
          aria-label="Leave game"
          onClick={() =>
            view?.done || mode === 'ai' ? exit() : setLeave(true)
          }
        >
          ←
        </button>
        <div>
          <span className="tt-eyebrow">
            TONPLAYGRAM · {mode === 'ai' ? 'AI PRACTICE' : 'TPG ONLINE'}
          </span>
          <h1>{game.name}</h1>
        </div>
        <button aria-label="Game rules" onClick={() => setHelp(true)}>
          ?
        </button>
        <button
          aria-label={muted ? 'Enable sound' : 'Mute sound'}
          onClick={() => {
            setGameMuted(!muted);
            setMuted(!muted);
          }}
        >
          {muted ? '♪ Off' : '♪ On'}
        </button>
      </header>
      {view ? (
        <>
          <section
            className="tt-scoreboard"
            style={{ '--players': view.players.length } as React.CSSProperties}
            aria-label="Players and scores"
          >
            {view.players.map((player, i) => (
              <div
                key={player.id}
                className={`tt-player ${actor?.id === player.id ? 'active' : ''}`}
                style={
                  { '--player-color': PLAYER_COLORS[i] } as React.CSSProperties
                }
              >
                <strong>{player.id === localId ? 'You' : player.name}</strong>
                <span>
                  {view.values[i]} {gameId === 'oligarchs' ? '¤' : 'pts'}
                </span>
                <small>
                  {player.out
                    ? 'Forfeited'
                    : mode === 'online' && view.connected?.[player.id] === false
                      ? 'Reconnecting'
                      : actor?.id === player.id
                        ? 'Playing'
                        : 'At the table'}
                </small>
              </div>
            ))}
          </section>
          <RoomBoundary>
            <Room
              view={view}
              roomId={room}
              viewer={viewer}
              onSelect={setSelected}
            />
          </RoomBoundary>
          <section className="tt-panel">
            {view.done ? (
              <div className="tt-result">
                <span className="tt-eyebrow">MATCH COMPLETE</span>
                <h2>
                  {view.winnerAccountId === localId
                    ? 'You win'
                    : view.winnerAccountId
                      ? `${view.players.find((q) => q.id === view.winnerAccountId)?.name} wins`
                      : 'Draw'}
                </h2>
                <p className="tt-status">
                  {view.reason?.includes('refund')
                    ? 'This match was refunded.'
                    : gameId === 'oligarchs'
                      ? 'Final standings are based on net worth.'
                      : 'Final standings are shown above.'}
                </p>
                {mode === 'online' && (
                  <p role="status" className="tt-status">
                    {view.settlement?.status === 'pending'
                      ? 'Settling TPG…'
                      : view.settlement?.status === 'refunded'
                        ? `${view.settlement.amount} TPG returned to every player.`
                        : view.settlement?.status === 'paid'
                          ? `${view.settlement.amount} TPG paid to the winner.`
                          : 'Awaiting settlement.'}
                  </p>
                )}
                <button className="tt-primary" onClick={exit}>
                  Back to lobby
                </button>
              </div>
            ) : (
              <>
                <div className="tt-turn">
                  <strong>
                    {view.status === 'waiting'
                      ? 'Waiting for players'
                      : myTurn
                        ? 'Your turn'
                        : `${actor?.name} is playing`}
                  </strong>
                  <span>
                    Round {Math.min(view.round, game.rounds)}/{game.rounds}
                    {mode === 'online' && view.status === 'playing'
                      ? ` · ${seconds}s`
                      : ''}
                  </span>
                </div>
                {gameId === 'oligarchs' && (
                  <div className="tt-resource-row">
                    <span>Cash {p!.cash} ¤</span>
                    <span>{view.board![p!.position].name}</span>
                    {view.dice && <span>Dice {view.dice.join(' + ')}</span>}
                  </div>
                )}
                {['harborempires', 'railkingdoms'].includes(gameId) && (
                  <div className="tt-resource-row">
                    {p!.resources.map((n, i) => (
                      <span key={i}>
                        {gameId === 'harborempires'
                          ? RESOURCE_NAMES[i]
                          : GEM_NAMES[i]}{' '}
                        {n}
                      </span>
                    ))}
                    {gameId === 'harborempires' && view.dice && (
                      <span>Rolled {view.dice[0]}</span>
                    )}
                  </div>
                )}
                {gameId === 'railkingdoms' && (
                  <p className="tt-status">
                    Deliveries:{' '}
                    {p!.contracts
                      ?.map(
                        (c) =>
                          `${CITY_NAMES[c.a]} → ${CITY_NAMES[c.b]} ${c.done ? '✓' : '(+6)'}`
                      )
                      .join(' · ')}
                  </p>
                )}
                {gameId === 'gemsyndicate' && (
                  <>
                    <div className="tt-resource-row">
                      {p!.gems.map((n, i) => (
                        <span key={i}>
                          {GEM_NAMES[i]} {n} · discount {p!.bonuses[i]}
                        </span>
                      ))}
                    </div>
                    <p className="tt-status">
                      Bank: {view.bank?.join(' / ')} · Reserved:{' '}
                      {p!.reserved
                        .map(
                          (c) =>
                            `${c.name} (${c.points} pts; cost ${c.cost.join('/')})`
                        )
                        .join(', ') || 'None'}
                    </p>
                  </>
                )}
                {selectedCell && (
                  <div className="tt-selection">
                    <strong>{selectedCell.name}</strong> ·{' '}
                    {selectedCell.owner >= 0
                      ? view.players[selectedCell.owner].name
                      : 'Unowned'}
                    {gameId === 'oligarchs'
                      ? ` · Price ${selectedCell.price} · Level ${selectedCell.level}`
                      : ` · ${RESOURCE_NAMES[selectedCell.resource!]} on ${selectedCell.number}`}
                    <button
                      className="tt-text-button"
                      onClick={() => setSelected(null)}
                    >
                      Show all moves
                    </button>
                  </div>
                )}
                {selectedCard && (
                  <div className="tt-selection">
                    <strong>{selectedCard.name}</strong> · {selectedCard.points}{' '}
                    prestige · {GEM_NAMES[selectedCard.color]} discount. Cost:{' '}
                    {selectedCard.cost
                      .map((n, i) => `${n} ${GEM_NAMES[i]}`)
                      .join(', ')}
                    .
                  </div>
                )}
                {gameId === 'mosaicroyal' && (
                  <>
                    <p className="tt-status">
                      Your rows:{' '}
                      {p!.rows
                        .map(
                          (r, i) =>
                            `${i + 1}: ${r.count}/${i + 1}${r.color >= 0 ? ` color ${r.color + 1}` : ''}`
                        )
                        .join(' · ')}
                    </p>
                    {myTurn && (
                      <>
                        <p className="tt-status">
                          Choose a tray color, then a row.
                        </p>
                        <div className="tt-tile-picker">
                          {[...view.factories!, view.center || []].flatMap(
                            (tiles, source) =>
                              [...new Set(tiles)].map((color) => (
                                <button
                                  key={`${source}-${color}`}
                                  aria-label={`${source === view.factories!.length ? 'Center' : `Tray ${source + 1}`} color ${color + 1}`}
                                  aria-pressed={
                                    draft?.source === source &&
                                    draft?.color === color
                                  }
                                  onClick={() => setDraft({ source, color })}
                                >
                                  <span
                                    className="tt-tile-dot"
                                    style={{ background: TILE_COLORS[color] }}
                                  />
                                  {source === view.factories!.length
                                    ? 'C'
                                    : source + 1}{' '}
                                  · {tiles.filter((c) => c === color).length}
                                </button>
                              ))
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}
                {myTurn ? (
                  <div className="tt-actions">
                    {actions.map((a) => (
                      <button
                        key={a.id}
                        disabled={busy || Boolean(connection)}
                        onClick={() => act(a.id)}
                        className={a.id === 'end' ? 'tt-end' : ''}
                      >
                        {gameId === 'mosaicroyal'
                          ? a.row === 5
                            ? 'Discard tiles'
                            : `Place in row ${a.row! + 1}`
                          : a.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="tt-status">
                    {view.status === 'waiting'
                      ? 'Everyone enters the same table before play begins.'
                      : p?.out
                        ? 'You can watch the rest of this match.'
                        : 'Watch the board. Your controls appear when your turn begins.'}
                  </p>
                )}
              </>
            )}
            {(connection || error) && (
              <p
                role={error ? 'alert' : 'status'}
                className={`tt-status ${error ? 'tt-error' : ''}`}
              >
                {error || connection}
              </p>
            )}
          </section>
          <details className="tt-history">
            <summary>Last move: {view.log.at(-1)}</summary>
            <ol>
              {view.log.map((entry, i) => (
                <li key={`${view.revision}-${i}`}>{entry}</li>
              ))}
            </ol>
          </details>
        </>
      ) : (
        <section className="tt-panel">
          <p role="status">{connection || 'Preparing your table…'}</p>
          {mode === 'online' && !tableId && (
            <p className="tt-error">
              Enter through the lobby to join an online table.
            </p>
          )}
          <button className="tt-text-button" onClick={exit}>
            Return to lobby
          </button>
        </section>
      )}
      {(help || leave) && (
        <div
          className="tt-help"
          role="dialog"
          aria-modal="true"
          aria-label={help ? 'Game rules' : 'Leave match'}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setHelp(false);
              setLeave(false);
            }
          }}
        >
          <div className="tt-help-content">
            {help ? (
              <>
                <h2>{game.name}</h2>
                <ol>
                  {game.rules.map((r: string) => (
                    <li key={r}>{r}</li>
                  ))}
                </ol>
                <button
                  autoFocus
                  className="tt-primary"
                  onClick={() => setHelp(false)}
                >
                  Back to game
                </button>
              </>
            ) : (
              <>
                <h2>Leave this match?</h2>
                <p className="tt-status">
                  Leaving an active TPG match forfeits your seat. A match that
                  has not started is refunded.
                </p>
                <button
                  autoFocus
                  className="tt-primary"
                  onClick={() => setLeave(false)}
                >
                  Keep playing
                </button>
                <button className="tt-text-button" onClick={exit}>
                  Leave match
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
