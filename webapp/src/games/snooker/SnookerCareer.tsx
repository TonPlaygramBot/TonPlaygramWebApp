import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FrameState } from '../../../../src/types';
import {
  calendar,
  careerAimError,
  completeCareerFrame,
  createTournament,
  currentEvent,
  enterEvent,
  frameId,
  loadCareer,
  loadTournament,
  nextSeason,
  ranking,
  RIVALS,
  roundName,
  saveCareer,
  saveCheckpoint,
  saveTournament,
  TOURNAMENT_FORMATS,
  type Career,
  type Tier
} from './career';
import './career.css';

const profile = (career: Career, id: string) =>
  id === 'player'
    ? `${career.name} · You`
    : (RIVALS.find((r) => r.id === id)?.name ?? id);
const hub = (tournament: boolean) =>
  `/games/snookerroyale/${tournament ? 'tournament' : 'career'}`;
const skillLabel: Record<Tier, string> = {
  club: 'Club',
  qualifying: 'Challenger',
  professional: 'Professional'
};

function Draw({ career }: { career: Career }) {
  if (!career.draw) return null;
  return (
    <section className="sc-draw" aria-label="Tournament bracket">
      <div className="sc-section-heading">
        <h2>Tournament draw</h2>
        <span>8 players · Knockout</span>
      </div>
      <div className="sc-bracket">
        {[0, 1, 2].map((round) => (
          <section key={round} aria-label={roundName(round)}>
            <h3>{roundName(round)}</h3>
            {Array.from({ length: 4 / 2 ** round }, (_, index) => {
              const pair = career.draw?.[round]?.[index];
              return (
                <div
                  className="sc-pair"
                  key={index}
                  data-active={
                    career.match?.round === round &&
                    (pair?.a === 'player' || pair?.b === 'player')
                  }
                >
                  {(['a', 'b'] as const).map((side, seat) => (
                    <div
                      key={side}
                      data-winner={
                        pair?.winner === pair?.[side] && Boolean(pair?.winner)
                      }
                    >
                      <span>
                        {pair
                          ? profile(career, pair[side])
                          : `Winner ${round === 1 ? 'QF' : 'SF'} ${index * 2 + seat + 1}`}
                      </span>
                      <b>
                        {pair?.score?.[seat] ??
                          (career.match?.round === round &&
                          (pair?.a === 'player' || pair?.b === 'player')
                            ? career.match.frames[
                                pair?.[side] === 'player' ? 0 : 1
                              ]
                            : '–')}
                      </b>
                    </div>
                  ))}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </section>
  );
}

function CareerDashboard({ tournament = false }: { tournament?: boolean }) {
  const navigate = useNavigate();
  const load = tournament ? loadTournament : loadCareer;
  const save = tournament ? saveTournament : saveCareer;
  const [career, setCareer] = useState<Career>(load);
  const [name, setName] = useState(career.name);
  const [bestOf, setBestOf] = useState(career.competition?.bestOf ?? 3);
  const [tier, setTier] = useState<Tier>(tournament ? career.tier : 'club');
  const [error, setError] = useState('');
  const standings = ranking(career);
  const event = currentEvent(career);
  const rival = RIVALS.find((r) => r.id === career.match?.opponent);
  const resume = Boolean(career.match);
  const play = () => {
    const next = enterEvent(
      tournament && !career.match
        ? createTournament(name, bestOf, tier)
        : { ...career, name: name.trim().slice(0, 32) || 'Player' }
    );
    if (!save(next)) {
      setError(
        'Progress could not be saved. Free some device storage and try again.'
      );
      return;
    }
    navigate(
      `/games/snookerroyale?mode=${tournament ? 'tournament' : 'career'}`
    );
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
      <nav className="sc-tabs" aria-label="Competition mode">
        <button
          aria-current={!tournament ? 'page' : undefined}
          onClick={() => navigate(hub(false))}
        >
          Career
        </button>
        <button
          aria-current={tournament ? 'page' : undefined}
          onClick={() => navigate(hub(true))}
        >
          Tournament
        </button>
      </nav>
      <p className="sc-eyebrow">
        {tournament
          ? 'Royal Invitational · Local solo competition'
          : `Season ${career.season} · ${career.tier} circuit`}
      </p>
      <h1>
        {tournament ? (
          <>
            One draw.
            <br />
            <em>One champion.</em>
          </>
        ) : (
          <>
            Your road to the
            <br />
            <em>world title.</em>
          </>
        )}
      </h1>
      <div className="sc-stats">
        <div>
          <strong>
            {tournament
              ? '8'
              : `#${standings.findIndex((p) => p.id === 'player') + 1}`}
          </strong>
          <span>{tournament ? 'Competitors' : 'Circuit ranking'}</span>
        </div>
        <div>
          <strong>{career.highestBreak}</strong>
          <span>Highest break</span>
        </div>
        <div>
          <strong>
            {career.framesPlayed
              ? `${Math.round((100 * career.framesWon) / career.framesPlayed)}%`
              : '—'}
          </strong>
          <span>Frames won</span>
        </div>
      </div>
      <section className="sc-feature">
        <p className="sc-eyebrow">
          {resume
            ? 'Match in progress'
            : tournament
              ? 'Build your event'
              : event
                ? 'Next event'
                : 'Season complete'}
        </p>
        <h2>{event?.name ?? 'The next chapter'}</h2>
        <p>
          {resume
            ? `${roundName(career.match!.round)} · Frames ${career.match!.frames[0]}–${career.match!.frames[1]}`
            : event
              ? `${event.venue} · 8-player knockout`
              : 'Rankings carry over for two seasons.'}
        </p>
        {rival && (
          <div className="sc-rival">
            <span className="sc-avatar" aria-hidden="true">
              {rival.name
                .split(' ')
                .map((part) => part[0])
                .join('')}
            </span>
            <div>
              <strong>{rival.name}</strong>
              <small>
                {rival.style} · {skillLabel[career.tier]}
              </small>
            </div>
          </div>
        )}
        {resume ? (
          <p className="sc-resume">
            Best of {career.match!.bestOf} · Frame {career.match!.frameNumber}
            <br />
            {career.match!.checkpoint
              ? 'Resume from your last completed shot.'
              : 'The next frame is ready to break off.'}
          </p>
        ) : (
          <>
            <label className="sc-field">
              Player name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={32}
                autoComplete="nickname"
              />
            </label>
            {tournament && (
              <div className="sc-settings">
                <label className="sc-field">
                  Match length
                  <select
                    value={bestOf}
                    onChange={(e) => setBestOf(Number(e.target.value))}
                  >
                    {TOURNAMENT_FORMATS.map((n) => (
                      <option key={n} value={n}>
                        Best of {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="sc-field">
                  AI level
                  <select
                    value={tier}
                    onChange={(e) => setTier(e.target.value as Tier)}
                  >
                    <option value="club">Club</option>
                    <option value="qualifying">Challenger</option>
                    <option value="professional">Professional</option>
                  </select>
                </label>
              </div>
            )}
            {event && !tournament && (
              <p>Best of {event.rounds.join(' / ')} · Quarter-final to final</p>
            )}
          </>
        )}
        {tournament || event ? (
          <button className="sc-primary" onClick={play}>
            {resume
              ? 'Resume match'
              : tournament
                ? 'Start tournament'
                : 'Enter event'}
            <span aria-hidden="true">→</span>
          </button>
        ) : (
          <button
            className="sc-primary"
            onClick={() => {
              const next = nextSeason(career);
              if (save(next)) setCareer(next);
              else setError('Progress could not be saved.');
            }}
          >
            Start next season <span aria-hidden="true">→</span>
          </button>
        )}
        {error && <p role="alert">{error}</p>}
      </section>
      {career.lastResult && (
        <section className="sc-result">
          <strong>{career.lastResult.finish}</strong>
          <p>
            {career.lastResult.event} · Champion:{' '}
            {profile(career, career.lastResult.champion)}
            {!tournament &&
              ` · +${career.lastResult.points.toLocaleString()} ranking credits`}
          </p>
        </section>
      )}
      <Draw career={career} />
      {!tournament && (
        <>
          <div className="sc-section-heading">
            <h2>Season calendar</h2>
            <span>{career.eventIndex} / 4 complete</span>
          </div>
          <progress
            className="sc-progress"
            value={career.eventIndex}
            max={4}
            aria-label="Season progress"
          />
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
                <th scope="col">Rank</th>
                <th scope="col">Player</th>
                <th scope="col">Credits</th>
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
        </>
      )}
      <section className="sc-notes">
        <h2>
          {tournament ? 'Three rounds to the trophy' : 'Earn your tour card'}
        </h2>
        <p>
          {tournament
            ? 'Win your quarter-final, semi-final and final. The other matches resolve as each round completes. This solo event has its own save and does not change your career or wallet.'
            : 'Win one club title in a season to reach qualifying. Win two qualifying titles in a season to join the professional tour. Promotion happens at season end.'}
        </p>
        <p>
          Full 15-red frames, alternating break-off and ordered colour
          clearance. Progress saves after each completed shot. Leave between
          shots to resume at that position. No shot clock in these competitions.
        </p>
      </section>
    </main>
  );
}

export default function SnookerCareer() {
  return <CareerDashboard />;
}
export function SnookerTournament() {
  return <CareerDashboard tournament />;
}

type MatchProps = { Game: React.ComponentType<any> };
export function SnookerCareerMatch({ Game }: MatchProps) {
  return <CompetitionMatch Game={Game} />;
}
export function SnookerTournamentMatch({ Game }: MatchProps) {
  return <CompetitionMatch Game={Game} tournament />;
}
function CompetitionMatch({
  Game,
  tournament = false
}: MatchProps & { tournament?: boolean }) {
  const navigate = useNavigate();
  const load = tournament ? loadTournament : loadCareer;
  const save = tournament ? saveTournament : saveCareer;
  const [session, setSession] = useState<Career>(load);
  const [result, setResult] = useState<Career | null>(null);
  const [finishedFrame, setFinishedFrame] = useState<FrameState | null>(null);
  const [rewards, setRewards] = useState<{ frameId: string; unlocks?: { type?: string; optionId?: string; label?: string }[] } | null>(null);
  const [error, setError] = useState('');
  const completedRef = useRef('');
  const latestRef = useRef(session);
  const id = frameId(session);
  const matchConfig = useMemo(() => {
    const rival = RIVALS.find((r) => r.id === session.match?.opponent);
    return session.match
      ? {
          ...session.match,
          event: currentEvent(session).name,
          aimError: () => careerAimError(session),
          opponentRating:
            (rival?.rating ?? 0.5) *
            (session.tier === 'club'
              ? 0.6
              : session.tier === 'qualifying'
                ? 0.82
                : 1),
          opponentStyle: rival?.style,
          competition: tournament ? 'tournament' : 'career'
        }
      : null;
  }, [session, tournament]);
  const checkpoint = useCallback(
    (frame: FrameState, layout: unknown[]) => {
      if (completedRef.current === id) return;
      const persisted = load();
      if (frameId(persisted) !== id) {
        setError(
          'This match changed in another window. Return to the competition to resume it.'
        );
        return;
      }
      const local = latestRef.current;
      if (
        (persisted.match?.checkpoint?.revision ?? 0) >
        (local.match?.checkpoint?.revision ?? 0)
      ) {
        setError(
          'A newer shot was saved in another window. Return to the competition to resume it.'
        );
        return;
      }
      const revision = (local.match?.checkpoint?.revision ?? 0) + 1;
      const base =
        (local.match?.checkpoint?.revision ?? 0) >=
        (persisted.match?.checkpoint?.revision ?? 0)
          ? local
          : persisted;
      const next = saveCheckpoint(base, id, frame, layout, revision);
      if (next === base) return;
      latestRef.current = next;
      if (!save(next))
        setError(
          'The last shot could not be saved on this device. Keep this game open and retry.'
        );
      else setError('');
    },
    [id, load, save]
  );
  const complete = useCallback(
    (frame: FrameState) => {
      if (completedRef.current === id) return;
      const current = load();
      if (frameId(current) !== id) {
        setError(
          'This match changed in another window. Return to the competition to resume it.'
        );
        return;
      }
      const base = latestRef.current;
      if (
        (current.match?.checkpoint?.revision ?? 0) >
        (base.match?.checkpoint?.revision ?? 0)
      ) {
        setError(
          'A newer shot was saved in another window. Return to the competition to resume it.'
        );
        return;
      }
      const next = completeCareerFrame(base, id, frame);
      if (next === base) return;
      completedRef.current = id;
      latestRef.current = next;
      const saved = save(next);
      if (!saved)
        setError('Result is unsaved. Please retry saving before leaving.');
      else setError('');
      setFinishedFrame(frame);
      setResult(next);
      return saved ? {
        accepted: true,
        status: next.match ? 'active' : next.lastResult?.finish === 'Champion' ? 'champion' : 'eliminated',
        eventId: `${base.runId || 'legacy'}:s${base.season}:e${base.eventIndex}`,
        isTournament: tournament,
        stageId: '',
        frameId: id
      } : undefined;
    },
    [id, load, save, tournament]
  );
  if (!session.match)
    return (
      <CareerDashboard
        key={tournament ? 'tournament' : 'career'}
        tournament={tournament}
      />
    );
  const rival = RIVALS.find((r) => r.id === session.match!.opponent)!;
  const nextFrame = (leave = false) => {
    if (!result) return;
    const persisted = load();
    // A second tab may already have played the next frame. Never roll it back.
    const alreadySaved =
      persisted.runId === result.runId &&
      persisted.completedFrames.includes(id) &&
      persisted.framesPlayed >= result.framesPlayed;
    const next = alreadySaved ? persisted : result;
    if (!alreadySaved && (frameId(persisted) !== id || !save(next))) {
      setError(
        'Result could not be saved. Keep this game open and retry, or resume the newer competition.'
      );
      return;
    }
    if (leave || !next.match) {
      navigate(hub(tournament));
      return;
    }
    setSession(next);
    latestRef.current = next;
    setResult(null);
    setFinishedFrame(null);
    setRewards(null);
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
        onCareerRewards={(payload: { unlocks?: { type?: string; optionId?: string; label?: string }[] }) => setRewards({ ...payload, frameId: id })}
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
          aria-label="Save progress and return to competition"
          onClick={() => {
            const persisted = load();
            const local = latestRef.current;
            const newerSave =
              frameId(persisted) !== id ||
              (persisted.match?.checkpoint?.revision ?? 0) >
                (local.match?.checkpoint?.revision ?? 0);
            if (newerSave || save(local)) navigate(hub(tournament));
            else
              setError(
                'Progress is unsaved. Please free device storage and retry.'
              );
          }}
        >
          {tournament ? 'Draw' : 'Career'}
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
            <p className="sc-eyebrow">
              {finishedFrame?.winner === 'A' ? 'Frame won' : 'Frame lost'}
            </p>
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
                  ? `${roundName(result.match.round)} · ${profile(result, result.match.opponent)}`
                  : `${result.lastResult?.event}${tournament ? '' : ` · +${result.lastResult?.points} ranking credits`}`}
            </p>
            <div className="sc-frame-score">
              <span>
                {finishedFrame?.players.A.score}
                <small>{session.name}</small>
              </span>
              <b>–</b>
              <span>
                {finishedFrame?.players.B.score}
                <small>{rival.name}</small>
              </span>
            </div>
            <p>Highest break: {result.highestBreak}</p>
            {rewards?.frameId === id && Boolean(rewards.unlocks?.length) && <div className="sc-result"><strong>Rewards unlocked</strong>{rewards.unlocks?.map((reward, index) => <p key={`${reward.type}-${reward.optionId}-${index}`}>{reward.label || reward.optionId}</p>)}</div>}
            <button
              className="sc-primary"
              autoFocus
              onClick={() => nextFrame()}
            >
              {result.match
                ? 'Continue'
                : tournament
                  ? 'Back to tournament'
                  : 'Back to career'}{' '}
              →
            </button>
            {result.match && (
              <button className="sc-secondary" onClick={() => nextFrame(true)}>
                Save and leave
              </button>
            )}
          </section>
        </div>
      )}
    </>
  );
}
