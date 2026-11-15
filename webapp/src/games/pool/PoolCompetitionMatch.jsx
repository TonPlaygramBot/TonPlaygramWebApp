import { useCallback, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getTelegramId } from '../../utils/telegram.js';
import { getCareerRoadmap, markCareerStageCompleted } from '../../utils/poolRoyaleCareerProgress.js';
import { checkpointPoolFrame, completePoolFrame, createPoolCompetition, loadPoolCompetition, poolCompetitionKey, poolCompetitionScope, poolFrameId, poolOpponent, poolRaceTo, poolRoundName, savePoolCompetition } from './competition.js';
import './competition.css';
import { careerStageXp } from './careerRewards.js';

export function PoolBracket({ event, playerId = 'you' }) {
  const [selected, setSelected] = useState(null);
  if (!event?.draw) return null;
  const round = Math.min(selected ?? event.round ?? 0, event.totalRounds - 1);
  const name = (id, fallback) => event.entrants.find((entrant) => entrant.id === id)?.name || fallback;
  const pairs = event.draw[round] || Array.from({ length: event.entrants.length / 2 ** (round + 1) }, () => ({}));
  return <div className="pr-bracket" aria-label="Tournament bracket">
    <ol className="pr-round-path" aria-label="Road to the title">
      {Array.from({ length: event.totalRounds }, (_, index) => <li key={index} data-current={index === round}>
        <button type="button" aria-pressed={index === round} onClick={() => setSelected(index)}>
          <span aria-hidden="true">{index < event.round ? '✓' : index + 1}</span>
          <span>{poolRoundName(event, index)}<small>{index === event.totalRounds - 1 ? 'The title match' : `${event.entrants.length / 2 ** index} players · Winners advance`}</small></span>
        </button>
      </li>)}
    </ol>
    <section aria-label={poolRoundName(event, round)}>
      <h3>{poolRoundName(event, round)} · {pairs.length} {pairs.length === 1 ? 'match' : 'matches'}</h3>
      {pairs.map((pair, index) => <div className="pr-pair" key={index} data-current={[pair.a, pair.b].includes(playerId) && !pair.winner}>
        <div className="pr-match-label">Match {index + 1} · {pair.winner ? 'Complete' : pair.a && pair.b ? 'Ready to play' : 'Awaiting winners'}</div>
        {[pair.a, pair.b].map((id, seat) => <p key={seat} data-winner={Boolean(id && pair.winner === id)} data-you={id === playerId}>
          <span>{name(id, `Winner of match ${index * 2 + seat + 1}`)}{id === playerId ? ' · You' : ''}{id && pair.winner === id ? ' ✓' : ''}</span><strong>{pair.score?.[seat] ?? '–'}</strong>
        </p>)}
      </div>)}
    </section>
    {event.champion && <p className="pr-champion">🏆 {name(event.champion, 'Champion')}</p>}
  </div>;
}

export function PoolCompetitionMatch({ Game, options = {} }) {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  let telegramId = options.tgId;
  try { telegramId ||= getTelegramId(); } catch { /* Saving reports unavailable storage. */ }
  const scope = poolCompetitionScope(telegramId, options.accountId);
  const stageId = params.get('career') === '1' ? params.get('careerStageId') || '' : '';
  const storageKey = poolCompetitionKey(scope, stageId, options.variantKey);
  return <PoolCompetitionSession key={storageKey} Game={Game} options={options} storageKey={storageKey} />;
}

function PoolCompetitionSession({ Game, options, storageKey }) {
  const { search } = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(search);
  const stageId = params.get('career') === '1' ? params.get('careerStageId') || '' : '';
  const key = storageKey;
  const home = stageId ? '/games/poolroyale/career' : '/games/poolroyale/lobby?type=tournament';
  const stage = stageId ? getCareerRoadmap().find((entry) => entry.id === stageId) : null;
  const newEvent = () => createPoolCompetition({ stageId, players: params.get('players'), variant: options.variantKey, name: options.playerName, options });
  const [session, setSession] = useState(() => loadPoolCompetition(key) || (stageId && (!stage || stage.locked || stage.type === 'training') ? null : newEvent()));
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [rewards, setRewards] = useState(null);
  const latestRef = useRef(session);
  const id = poolFrameId(session);
  const persist = useCallback((next) => {
    const stored = loadPoolCompetition(key);
    const previous = latestRef.current;
    if (stored && previous && (stored.id !== previous.id || (stored.revision || 0) > (previous.revision || 0))) {
      setConflict(true);
      setError('This event advanced in another window. Return to the lobby and resume the latest save.');
      return false;
    }
    latestRef.current = next;
    const saved = savePoolCompetition(key, next);
    setError(saved ? '' : 'Your progress could not be saved. Free some device storage, then retry before leaving.');
    return saved;
  }, [key]);
  const checkpoint = useCallback((frame, layout) => {
    const current = loadPoolCompetition(key) || latestRef.current;
    if (current?.id !== latestRef.current?.id || (current?.revision || 0) > (latestRef.current?.revision || 0)) {
      setConflict(true);
      setError('This event advanced in another window. Return to the lobby and resume the latest save.');
      return;
    }
    const base = latestRef.current;
    const next = checkpointPoolFrame(base, id, frame, layout);
    if (next !== base) persist(next);
  }, [id, key, persist]);
  const complete = useCallback((frame) => {
    const current = loadPoolCompetition(key) || latestRef.current;
    if (current?.id !== latestRef.current?.id || (current?.revision || 0) > (latestRef.current?.revision || 0)) {
      setConflict(true);
      setError('This event advanced in another window. Return to the lobby and resume the latest save.');
      return;
    }
    const base = latestRef.current;
    const next = completePoolFrame(base, id, frame);
    if (next === base) return;
    const saved = persist(next);
    if (saved && next.status === 'champion' && next.stageId) markCareerStageCompleted(next.stageId);
    setResult(next);
    return saved ? { accepted: true, status: next.status, eventId: next.id, isTournament: next.totalRounds > 1, stageId: next.stageId, frameId: id } : undefined;
  }, [id, key, persist]);
  if (!session) return <main className="pr-tour"><h1>Complete the previous stage first.</h1><button className="pr-primary" onClick={() => navigate(home)}>Back to career</button></main>;
  const opponent = poolOpponent(session);
  const next = result || session;
  const continueEvent = () => {
    if (!persist(next)) return;
    if (next.status === 'champion' && next.stageId) markCareerStageCompleted(next.stageId);
    setSession(next);
    setResult(null);
    setRewards(null);
    setPlaying(next.status === 'active');
  };
  const leave = () => {
    if (conflict) { navigate(home); return; }
    if (!persist(result || latestRef.current)) return;
    if (next.status === 'champion' && next.stageId) markCareerStageCompleted(next.stageId);
    navigate(home);
  };
  const restart = () => {
    const fresh = newEvent();
    if (!persist(fresh)) return;
    setSession(fresh);
    setResult(null);
    setPlaying(false);
  };
  const panel = <>
    <p className="pr-eyebrow">{next.stageId ? 'Career event' : 'Royal tournament'} · {next.entrants.length} players</p>
    <h1>{next.status === 'champion' ? 'The title is yours.' : next.status === 'eliminated' ? 'Your run is complete.' : result ? (next.round !== session.round ? 'Through to the next round.' : 'Every rack matters.') : next.title}</h1>
    <p className="pr-muted">{next.status === 'active' ? `${poolRoundName(next)} · Race to ${poolRaceTo(next)} · Alternate break` : next.status === 'champion' ? `${next.matchesWon} matches won · ${next.framesWon} racks won` : `Eliminated in the ${poolRoundName(next).toLowerCase()}. Your next run starts with a fresh draw.`}</p>
    {next.status === 'active' && <section className="pr-feature">
      <p className="pr-eyebrow">{next.checkpoint ? 'Saved rack ready to resume' : `Rack ${next.frameNumber}`}</p>
      <div className="pr-versus"><span>{next.name}</span><strong>{next.frames[0]} <small>—</small> {next.frames[1]}</strong><span>{poolOpponent(next)?.name}</span></div>
      <p className="pr-muted">{poolOpponent(next)?.style} · {Math.round((poolOpponent(next)?.rating || 0.5) * 100)} skill</p>
      <button className="pr-primary" onClick={continueEvent}>{next.checkpoint ? 'Resume saved rack' : result ? 'Play next rack' : 'Start match'} <span>→</span></button>
    </section>}
    {next.status === 'champion' && stage && <section className="pr-feature"><p className="pr-eyebrow">Career bonus earned</p><h2>+{careerStageXp(stage)} career XP</h2>{stage.level % 5 === 0 && <p className="pr-muted">🎁 A milestone gift is ready to open in your career rewards club.</p>}</section>}
    {next.status !== 'active' && <div className="pr-actions"><button className="pr-primary" onClick={leave}>{stageId ? 'Continue career' : 'Back to lobby'} →</button>{(next.status === 'eliminated' || !stageId) && <button className="pr-secondary" onClick={restart}>{next.status === 'champion' ? 'Start a new tournament' : 'Try event again'}</button>}</div>}
    {rewards?.frameId === id && (rewards.unlocks?.length > 0 || rewards.nftReward) && <section className="pr-feature"><p className="pr-eyebrow">Rewards unlocked</p>{rewards.unlocks?.map((reward, index) => <p key={`${reward.type}-${reward.optionId}-${index}`}>{reward.label || reward.optionId}</p>)}{rewards.nftReward && <p>{rewards.nftReward.name || 'Bonus collectible'} · Added to your rewards</p>}</section>}
    {next.totalRounds > 1 && <><h2>The draw</h2><PoolBracket event={next} /></>}
    <p className="pr-muted">Matches save after each settled shot. Win the required racks to advance; losing a match ends your run.</p>
    {next.status === 'active' && <button className="pr-secondary" onClick={leave}>Save and return</button>}
  </>;
  return <>
    {playing && session.status === 'active' ? <>
      <Game {...options} {...session.options} key={id} mode="ai" playType="series" playerName={session.name} opponentName={opponent?.name} competitionMatch={{ id: session.id, frameNumber: session.frameNumber, round: session.round, raceTo: poolRaceTo(session), frames: session.frames, difficulty: opponent?.rating || 0.5 }} savedFrame={session.checkpoint} onCompetitionCheckpoint={checkpoint} onCompetitionFrameComplete={complete} onCompetitionRewards={(payload) => setRewards({ ...payload, frameId: id })} />
      <div className="pr-series-strip"><span>{poolRoundName(session)} · Race to {poolRaceTo(session)}</span><strong>Racks {session.frames[0]} — {session.frames[1]}</strong></div>
      {!result && <button className="pr-series-leave" onClick={leave}>Save & exit</button>}
      {result && <div className="pr-result-overlay" role="dialog" aria-modal="true" aria-label="Rack result"><main className="pr-tour pr-result-panel">{panel}</main></div>}
    </> : <main className="pr-tour"><button className="pr-back" onClick={() => navigate(home)}>‹ {stageId ? 'Career' : 'Lobby'}</button>{panel}</main>}
    {error && <div className="pr-save-error" role="alert">{error}<button onClick={() => conflict ? navigate(home) : persist(result || latestRef.current)}>{conflict ? 'Return to lobby' : 'Retry save'}</button></div>}
  </>;
}
