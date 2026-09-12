import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FrameState } from '../../../../src/types';
import {
  calendar,
  careerAimError,
  completeCareerFrame,
  currentEvent,
  enterEvent,
  frameId,
  loadCareer,
  nextSeason,
  ranking,
  RIVALS,
  roundName,
  saveCareer,
  saveCheckpoint,
  type Career
} from './career';
import './career.css';

export default function SnookerCareer() {
  const navigate = useNavigate();
  const [career, setCareer] = useState(loadCareer);
  const [error, setError] = useState('');
  const standings = ranking(career);
  const event = currentEvent(career);
  const play = () => {
    const next = enterEvent(career);
    if (!saveCareer(next)) {
      setError(
        'Progress could not be saved. Free some device storage and try again.'
      );
      return;
    }
    navigate('/games/snookerroyale?mode=career');
  };
  return (
    <main className="snooker-career">
      <header>
        <button
          className="sc-back"
          onClick={() => navigate('/games/snookerroyale/lobby')}
        >
          ‹ Lobby
        </button>
        <span>SNOOKER ROYAL</span>
      </header>
      <p className="sc-eyebrow">
        Season {career.season} · {career.tier} circuit
      </p>
      <h1>
        Your road to the
        <br />
        <em>world title.</em>
      </h1>
      <div className="sc-stats">
        <div>
          <strong>#{standings.findIndex((p) => p.id === 'player') + 1}</strong>
          <span>Circuit ranking</span>
        </div>
        <div>
          <strong>{career.highestBreak}</strong>
          <span>Highest break</span>
        </div>
        <div>
          <strong>{career.titles}</strong>
          <span>Titles</span>
        </div>
      </div>
      <section className="sc-feature">
        <p className="sc-eyebrow">
          {career.match
            ? 'Match in progress'
            : event
              ? 'Next event'
              : 'Season complete'}
        </p>
        <h2>{event?.name ?? 'The next chapter'}</h2>
        <p>
          {career.match
            ? `${roundName(career.match.round)} · ${career.match.frames[0]}–${career.match.frames[1]} vs ${RIVALS.find((r) => r.id === career.match?.opponent)?.name}`
            : event
              ? `${event.venue} · 8-player knockout`
              : 'Rankings carry over for two seasons.'}
        </p>
        {event && (
          <p>
            {career.match
              ? `Best of ${career.match.bestOf} · Frame ${career.match.frameNumber}`
              : `Best of ${event.rounds.join(' / ')} · Quarter-final to final`}
          </p>
        )}
        {event ? (
          <button className="sc-primary" onClick={play}>
            {career.match ? 'Resume match' : 'Enter tournament'} <span>→</span>
          </button>
        ) : (
          <button
            className="sc-primary"
            onClick={() => {
              const next = nextSeason(career);
              if (saveCareer(next)) setCareer(next);
              else setError('Progress could not be saved.');
            }}
          >
            Start next season <span>→</span>
          </button>
        )}
        {error && <p role="alert">{error}</p>}
      </section>
      {career.lastResult && (
        <p className="sc-result">
          {career.lastResult.event}: {career.lastResult.finish} · +
          {career.lastResult.points.toLocaleString()} ranking credits
        </p>
      )}
      <h2>Season calendar</h2>
      <ol className="sc-calendar">
        {calendar(career.tier).map((e, i) => (
          <li
            key={e.name}
            aria-current={i === career.eventIndex ? 'step' : undefined}
          >
            <span>
              {i < career.eventIndex ? '✓' : String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <strong>{e.name}</strong>
              <small>
                {e.venue} · Final: best of {e.rounds[2]}
              </small>
            </div>
            <b>
              {i < career.eventIndex
                ? 'Done'
                : i === career.eventIndex
                  ? 'Next'
                  : ''}
            </b>
          </li>
        ))}
      </ol>
      <h2>Tour standings</h2>
      <p className="sc-muted">
        Fictional circuit · two-season ranking credits, no cash value.
      </p>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Credits</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((p, i) => (
            <tr key={p.id} data-you={p.id === 'player'}>
              <td>{i + 1}</td>
              <td>
                {p.name}
                {p.id === 'player' ? ' · You' : ''}
              </td>
              <td>{p.points.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <section className="sc-notes">
        <h2>Earn your tour card</h2>
        <p>
          Win one club title in a season to reach qualifying. Win two qualifying
          titles in a season to join the professional tour. Promotion happens at
          season end.
        </p>
        <p>
          Full 15-red frames, alternating break-off, colour clearance and
          multi-frame matches. Progress saves after each settled shot. Standard
          career frames have no shot clock.
        </p>
      </section>
    </main>
  );
}

type MatchProps = { Game: React.ComponentType<any> };
export function SnookerCareerMatch({ Game }: MatchProps) {
  const navigate = useNavigate();
  const [session, setSession] = useState(loadCareer);
  const [result, setResult] = useState<Career | null>(null);
  const [finishedFrame, setFinishedFrame] = useState<FrameState | null>(null);
  const [error, setError] = useState('');
  const id = frameId(session);
  const matchConfig = useMemo(
    () =>
      session.match
        ? {
            ...session.match,
            event: currentEvent(session).name,
            aimError: () => careerAimError(session)
          }
        : null,
    [session]
  );
  const checkpoint = useCallback(
    (frame: FrameState, layout: unknown[]) => {
      const next = saveCheckpoint(loadCareer(), id, frame, layout);
      if (!saveCareer(next))
        setError('Progress could not be saved on this device.');
    },
    [id]
  );
  const complete = useCallback(
    (frame: FrameState) => {
      const next = completeCareerFrame(loadCareer(), id, frame);
      if (!saveCareer(next))
        setError('Result is unsaved. Please retry saving before leaving.');
      setFinishedFrame(frame);
      setResult(next);
    },
    [id]
  );
  if (!session.match) return <SnookerCareer />;
  const rival = RIVALS.find((r) => r.id === session.match!.opponent)!;
  const nextFrame = () => {
    if (!result || !saveCareer(result)) {
      setError('Result is unsaved. Please free device storage and retry.');
      return;
    }
    if (!result.match) {
      navigate('/games/snookerroyale/career');
      return;
    }
    setSession(result);
    setResult(null);
    setFinishedFrame(null);
    setError('');
  };
  return (
    <>
      <Game
        key={id}
        variantKey="snooker"
        mode="ai"
        playType="career"
        tableSizeKey="12ft"
        playerName={session.name}
        opponentName={rival.name}
        savedFrame={session.match.checkpoint}
        careerMatch={matchConfig}
        onCareerCheckpoint={checkpoint}
        onCareerFrameComplete={complete}
      />
      <div className="sc-match-strip">
        <span>
          {roundName(session.match.round)} · Best of {session.match.bestOf}
        </span>
        <strong>
          Frames {session.match.frames[0]} – {session.match.frames[1]}
        </strong>
      </div>
      {!result && (
        <button
          className="sc-leave"
          onClick={() => navigate('/games/snookerroyale/career')}
        >
          Career
        </button>
      )}
      {error && (
        <p className="sc-save-error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <div
          className="sc-frame-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Frame result"
        >
          <section>
            <p className="sc-eyebrow">Frame complete</p>
            <h2>
              {result.match?.id === session.match.id
                ? 'Keep the match going.'
                : result.match
                  ? 'Through to the next round.'
                  : result.lastResult?.finish}
            </h2>
            <p>
              {result.match?.id === session.match.id
                ? `${session.name} ${result.match.frames[0]} – ${result.match.frames[1]} ${rival.name}`
                : result.match
                  ? roundName(result.match.round)
                  : `${result.lastResult?.event} · +${result.lastResult?.points} ranking credits`}
            </p>
            <p>
              Frame points: {finishedFrame?.players.A.score} –{' '}
              {finishedFrame?.players.B.score}
            </p>
            <p>Highest career break: {result.highestBreak}</p>
            <button className="sc-primary" onClick={nextFrame}>
              {result.match ? 'Continue' : 'Back to career'} →
            </button>
            {result.match && (
              <button
                className="sc-secondary"
                onClick={() => {
                  if (saveCareer(result))
                    navigate('/games/snookerroyale/career');
                  else setError('Result is unsaved. Retry saving.');
                }}
              >
                Save and leave
              </button>
            )}
          </section>
        </div>
      )}
    </>
  );
}
