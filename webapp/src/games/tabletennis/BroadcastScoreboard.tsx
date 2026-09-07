import React, { useState } from 'react';
import type { MatchState, Seat } from './engine';

export type PlayerIdentity = { name: string; avatar?: string };
function Avatar({ player }: { player: PlayerIdentity }) {
  const [failed, setFailed] = useState('');
  return (
    <span className="tt-avatar" aria-hidden="true">
      {player.avatar && failed !== player.avatar ? (
        <img
          src={player.avatar}
          alt=""
          onError={() => setFailed(player.avatar!)}
        />
      ) : (
        player.name.replace(/^@/, '').slice(0, 2).toUpperCase()
      )}
    </span>
  );
}

export function BroadcastScoreboard({
  state,
  players,
  seat,
  label
}: {
  state: MatchState;
  players: [PlayerIdentity, PlayerIdentity];
  seat: Seat;
  label: string;
}) {
  const { score, config } = state;
  return (
    <section className="tt-broadcast" aria-label="Match score">
      <div className="tt-broadcast-heading">
        <span>
          <i /> {label} · SINGLES
        </span>
        <span>BEST OF {config.gamesToWin * 2 - 1}</span>
      </div>
      <div className="tt-score-columns" aria-hidden="true">
        <span>
          GAME{' '}
          {state.phase === 'over'
            ? Math.max(1, score.history.length)
            : score.history.length + 1}
        </span>
        <span>GAMES</span>
        <span>PTS</span>
      </div>
      {[seat, (1 - seat) as Seat].map((n) => (
        <div
          className="tt-score-row"
          key={n}
          data-seat={n}
          data-leading={score.points[n] > score.points[1 - n]}
        >
          <div className="tt-score-player">
            <Avatar player={players[n]} />
            <span title={players[n].name}>{players[n].name}</span>
            <i
              className="tt-server"
              data-serving={score.server === n}
              aria-label={score.server === n ? 'Serving' : undefined}
            />
          </div>
          <span
            className="tt-game-count"
            aria-label={`${score.games[n]} games`}
          >
            {score.games[n]}
          </span>
          <strong aria-label={`${score.points[n]} points`}>
            {score.points[n]}
          </strong>
        </div>
      ))}
      {score.expedite && (
        <div className="tt-expedite">EXPEDITE · ONE SERVE EACH</div>
      )}
    </section>
  );
}
