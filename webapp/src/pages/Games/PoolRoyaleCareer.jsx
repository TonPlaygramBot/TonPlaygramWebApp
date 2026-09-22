import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { CAREER_LEVEL_COUNT, getCareerRoadmap, loadCareerProgress } from '../../utils/poolRoyaleCareerProgress.js';
import { getTelegramId } from '../../utils/telegram.js';
import { loadPoolCompetition, poolCompetitionKey, poolCompetitionScope, poolOpponent, poolRaceTo, poolStageFormat } from '../../games/pool/competition.js';
import { PoolBracket } from '../../games/pool/PoolCompetitionMatch.jsx';
import '../../games/pool/competition.css';

const labels = { training: 'Academy drill', friendly: 'Friendly match', league: 'League fixture', showdown: 'Rival showdown', tournament: 'Knockout tournament' };

export default function PoolRoyaleCareer() {
  useTelegramBackButton('/games/poolroyale/lobby?type=career');
  const navigate = useNavigate();
  const [progress, setProgress] = useState(loadCareerProgress);
  const roadmap = useMemo(() => getCareerRoadmap(undefined, progress), [progress]);
  const nextStage = roadmap.find((stage) => stage.playable);
  const [phase, setPhase] = useState(() => nextStage?.phase || 1);
  const [variant, setVariant] = useState('american');
  const completed = roadmap.filter((stage) => stage.completed).length;
  const scope = poolCompetitionScope(getTelegramId());
  const activeEvent = nextStage ? loadPoolCompetition(poolCompetitionKey(scope, nextStage.id, variant)) : null;
  useEffect(() => {
    const refresh = () => setProgress(loadCareerProgress());
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh); };
  }, []);
  const launch = (stage) => {
    if (!stage || stage.locked) return;
    const params = new URLSearchParams({ mode: 'ai', career: '1', careerStageId: stage.id, careerStageTitle: stage.title, variant: stage.type === 'training' ? 'uk' : variant, type: stage.type === 'training' ? 'training' : 'regular' });
    if (stage.type === 'training') params.set('trainingLevel', String(stage.trainingLevel));
    else params.set('competition', '1');
    if (stage.players) params.set('players', String(stage.players));
    const tgId = getTelegramId();
    if (tgId) params.set('tgId', String(tgId));
    navigate(`/games/poolroyale?${params.toString()}`);
  };
  const shownStages = roadmap.filter((stage) => stage.phase === phase);
  const phaseInfo = shownStages[0];
  return <main className="pr-tour">
    <header className="flex items-center justify-between gap-3"><button className="pr-back" onClick={() => navigate('/games/poolroyale/lobby?type=career')}>‹ Lobby</button><p className="pr-eyebrow">Pool Royal · Career</p></header>
    <p className="pr-eyebrow">From the academy to the final table</p>
    <h1>Build your game.<br /><span style={{ color: '#dfc48b' }}>Earn your place.</span></h1>
    <p className="pr-muted">A hundred stages of cue control, match play and knockout competition. Every match has a rival. Every title has a path.</p>
    <div className="pr-stat-grid"><div><strong>{completed}<small style={{ fontSize: 14, color: '#8ba393' }}> / {CAREER_LEVEL_COUNT}</small></strong><span>Stages completed</span></div><div><strong>{roadmap.filter((stage) => stage.completed && stage.type === 'tournament').length}</strong><span>Tournament titles</span></div><div><strong>{nextStage?.difficulty || 'Legend'}</strong><span>Current circuit</span></div></div>
    <div className="pr-progress" role="progressbar" aria-label="Career progress" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={CAREER_LEVEL_COUNT}><span style={{ width: `${completed}%` }} /></div>
    {nextStage ? <section className="pr-feature">
      <p className="pr-eyebrow">{activeEvent?.status === 'active' ? 'Event in progress' : 'Your next challenge'} · Stage {String(nextStage.level).padStart(2, '0')}</p>
      <h2 style={{ marginTop: 8 }}>{nextStage.title}</h2><p className="pr-muted">{nextStage.objective}</p>
      <span className="pr-chip">{labels[nextStage.type]}</span><span className="pr-chip">{poolStageFormat(nextStage).label}</span>{nextStage.players > 2 && <span className="pr-chip">{nextStage.players} players</span>}
      {activeEvent?.status === 'active' && <p className="pr-muted">{activeEvent.frames[0]} — {activeEvent.frames[1]} vs {poolOpponent(activeEvent)?.name} · Race to {poolRaceTo(activeEvent)}</p>}
      {nextStage.type !== 'training' && !activeEvent && <div className="pr-filter" aria-label="Career pool rules" style={{ marginTop: 12 }}>{[['american', '8-ball'], ['9ball', '9-ball'], ['uk', 'UK pool']].map(([value, label]) => <button key={value} aria-pressed={variant === value} onClick={() => setVariant(value)}>{label}</button>)}</div>}
      <button className="pr-primary" onClick={() => launch(nextStage)}>{activeEvent?.status === 'active' ? 'Resume event' : 'Play next stage'} <span>→</span></button>
      {nextStage.type !== 'training' && <p className="pr-mini">Alternate break · Progress saves after settled shots</p>}
      {activeEvent?.draw && activeEvent.totalRounds > 1 && <details><summary>View your tournament draw</summary><PoolBracket event={activeEvent} /></details>}
    </section> : <section className="pr-feature"><h2>Legend circuit complete.</h2><p className="pr-muted">All 100 stages cleared. Return to the lobby to start another Royal tournament.</p><button className="pr-primary" onClick={() => navigate('/games/poolroyale/lobby?type=tournament')}>Enter a tournament →</button></section>}
    <h2>Your career route</h2>
    <div className="pr-filter" aria-label="Career phase">{Array.from({ length: 5 }, (_, index) => <button key={index} aria-pressed={phase === index + 1} onClick={() => setPhase(index + 1)}>Phase {index + 1}</button>)}</div>
    <div className="pr-phase-note"><h2 style={{ marginTop: 0 }}>{phaseInfo?.phaseTitle}</h2><p>{phaseInfo?.phaseSummary}</p></div>
    {shownStages.map((stage) => <article className="pr-stage" key={stage.id} data-locked={stage.locked} data-complete={stage.completed} aria-current={stage.playable ? 'step' : undefined}>
      <span aria-label={stage.completed ? 'Completed' : stage.locked ? 'Locked' : 'Next stage'}>{stage.completed ? '✓' : String(stage.level).padStart(2, '0')}</span>
      <div><h3>{stage.title}</h3><p>{labels[stage.type]} · {poolStageFormat(stage).label}{stage.players > 2 ? ` · ${stage.players} players` : ''}</p><p>{stage.objective}</p>
        {stage.playable && <button className="pr-primary" onClick={() => launch(stage)}>Play this stage <span>→</span></button>}
        {!stage.locked && <details><summary>Stage details</summary><p>{stage.detailBrief}</p><p>{stage.type === 'training' ? stage.winCondition : stage.type === 'tournament' ? 'Win every match, then the final. A match loss eliminates you from this event.' : `Win ${poolStageFormat(stage).raceTo} racks before your rival to complete this stage.`}</p><p>Stage reward: {stage.reward}</p>{stage.type === 'training' && <p>Career drills use the existing heart allowance. Missed attempts deduct hearts; practice remains unlimited.</p>}</details>}
      </div>
    </article>)}
  </main>;
}
