import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getCareerRoadmap,
  getCareerAthlete,
  loadCareerProgress
} from '../../utils/poolRoyaleCareerProgress.js';
import {
  TRAINING_LEVELS,
  loadTrainingProgress
} from '../../utils/poolRoyaleTrainingProgress.js';
import './poolRoyalCareer.css';

export default function PoolRoyalCareerHub() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'career' | 'training'>(() =>
    new URLSearchParams(window.location.search).get('tab') === 'training'
      ? 'training'
      : 'career'
  );
  const progress = useMemo(() => loadCareerProgress(), []);
  const training = useMemo(() => loadTrainingProgress(), []);
  const stages = useMemo(
    () => getCareerRoadmap(training, progress),
    [training, progress]
  );
  const athlete = getCareerAthlete(progress);
  const next = stages.find((stage) => stage.playable);
  const [season, setSeason] = useState(next?.season || 1);
  const launch = (stage: (typeof stages)[number]) => {
    if (stage.locked) return;
    const params = new URLSearchParams({
      type: stage.type,
      mode: 'ai',
      career: '1',
      careerStageId: stage.id,
      careerStageTitle: stage.title,
      variant: '8ball',
      opponent: stage.opponent.name,
      playerModel: 'alex',
      opponentModel: stage.opponent.id
    });
    if (stage.trainingLevel)
      params.set('trainingLevel', String(stage.trainingLevel));
    if (stage.players && stage.type === 'tournament')
      params.set('players', String(stage.players));
    navigate(`/games/poolroyale?${params}`);
  };
  const train = (level: number) =>
    navigate(
      `/games/poolroyale?type=training&mode=local&trainingLevel=${level}&variant=8ball`
    );
  return (
    <main className="pr-career">
      <header className="pr-career-header">
        <button onClick={() => navigate('/games/poolroyale/lobby')}>
          ‹ Lobby
        </button>
        <span>POOL ROYAL</span>
        <span className="pr-career-ball">8</span>
      </header>
      <div className="pr-athlete">
        <p className="pr-eyebrow">YOUR PLAYER CAREER</p>
        <h1>{athlete.rank}</h1>
        <p>Build your game. Earn your place on the tour.</p>
        <div className="pr-athlete-stats">
          <div>
            <strong>{athlete.rankingPoints}</strong>
            <span>Ranking points</span>
          </div>
          <div>
            <strong>{athlete.fixturesWon}</strong>
            <span>Fixtures won</span>
          </div>
          <div>
            <strong>{athlete.titles}</strong>
            <span>Titles</span>
          </div>
        </div>
      </div>
      <nav className="pr-career-tabs" aria-label="Pool progression">
        <button
          aria-pressed={tab === 'career'}
          onClick={() => setTab('career')}
        >
          Your career
        </button>
        <button
          aria-pressed={tab === 'training'}
          onClick={() => setTab('training')}
        >
          Training centre
        </button>
      </nav>
      {tab === 'career' ? (
        <>
          {next ? (
            <section className="pr-next">
              <p className="pr-eyebrow">NEXT APPOINTMENT · WEEK {next.week}</p>
              <h2>{next.title}</h2>
              <p>{next.objective}</p>
              <div className="pr-coach">
                <span>
                  {next.type === 'training'
                    ? 'COACH'
                    : next.opponent.name.toUpperCase()}
                </span>
                <p>
                  {next.type === 'training'
                    ? next.coachingFocus
                    : `${next.opponent.country} · ${next.opponent.style}`}
                </p>
              </div>
              <button className="pr-primary" onClick={() => launch(next)}>
                {next.type === 'training'
                  ? 'Start coaching session'
                  : next.type === 'tournament'
                    ? 'Enter tournament'
                    : 'Play fixture'}
              </button>
            </section>
          ) : (
            <section className="pr-next">
              <h2>World title campaign complete</h2>
              <p>Return to training to improve your shot control.</p>
            </section>
          )}
          <div className="pr-season-picker">
            <label htmlFor="pr-season">Season calendar</label>
            <select
              id="pr-season"
              value={season}
              onChange={(event) => setSeason(Number(event.target.value))}
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  Season {value}
                </option>
              ))}
            </select>
          </div>
          <ol className="pr-fixtures">
            {stages
              .filter((stage) => stage.season === season)
              .map((stage) => (
                <li key={stage.id} className={stage.playable ? 'is-next' : ''}>
                  <div className="pr-week">
                    {stage.completed
                      ? '✓'
                      : String(stage.week).padStart(2, '0')}
                  </div>
                  <div className="pr-fixture-copy">
                    <span className="pr-eyebrow">{stage.competitionLabel}</span>
                    <h3>{stage.title}</h3>
                    <p>{stage.winCondition}</p>
                    <small>
                      {stage.rankingPoints} ranking points ·{' '}
                      {stage.estimatedDurationMins} min
                    </small>
                  </div>
                  <button
                    disabled={stage.locked || stage.completed}
                    onClick={() => launch(stage)}
                    aria-label={`${stage.locked ? 'Locked: ' : 'Play: '}${stage.title}`}
                  >
                    {stage.completed
                      ? 'Done'
                      : stage.locked
                        ? 'Locked'
                        : 'Play'}
                  </button>
                </li>
              ))}
          </ol>
        </>
      ) : (
        <>
          <section className="pr-next">
            <p className="pr-eyebrow">PRACTISE WITH PURPOSE</p>
            <h2>One skill at a time</h2>
            <p>
              Choose a drill, follow the coach, and earn up to three stars. Your
              cue-ball position counts as well as the pot.
            </p>
            <button
              className="pr-secondary"
              onClick={() =>
                navigate('/games/poolroyale?type=training&mode=local')
              }
            >
              Open free practice
            </button>
          </section>
          <div className="pr-drills">
            {TRAINING_LEVELS.map((drill) => (
              <button
                key={drill.level}
                className="pr-drill"
                onClick={() => train(drill.level)}
              >
                <span className="pr-eyebrow">
                  {drill.difficulty} · {drill.skill}
                </span>
                <strong>{drill.title}</strong>
                <span>{drill.objective}</span>
                <small>
                  {drill.shotLimit} shots ·{' '}
                  {training.mastery?.[drill.level]
                    ? '★'.repeat(training.mastery[drill.level])
                    : training.completed.includes(drill.level)
                      ? '✓ Passed'
                      : 'Start drill'}
                </small>
              </button>
            ))}
          </div>
        </>
      )}
      <footer>Career and coaching progress are saved on this device.</footer>
    </main>
  );
}
