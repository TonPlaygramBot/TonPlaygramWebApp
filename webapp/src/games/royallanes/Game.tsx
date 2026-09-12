import { useEffect, useRef, useState } from 'react';
import { BowlingScene } from './scene';
import { BowlingTouch } from './touch';
import { LocalBowlingSession } from './localSession';
import { frameTotals, rollSymbols } from './shared/scoring.mjs';
import type { BowlingSession, MatchView, Shot } from './types';
import './style.css';
export type BowlingGameProps = {
  mode: 'ai' | 'online';
  tableId?: string;
  difficulty?: string;
  playerName?: string;
  onExit: () => void;
  onSession?: (session: BowlingSession | null) => void;
  createOnlineSession?: (
    tableId: string,
    onConnection: (message: string) => void
  ) => BowlingSession;
  soundEnabled?: boolean;
};
export function RoyalLanesGame({
  mode,
  tableId = '',
  difficulty = 'club',
  playerName = 'You',
  onExit,
  onSession,
  createOnlineSession,
  soundEnabled = true
}: BowlingGameProps) {
  const stage = useRef<HTMLDivElement>(null),
    surface = useRef<HTMLDivElement>(null);
  const scene = useRef<BowlingScene | null>(null),
    session = useRef<BowlingSession | null>(null),
    touch = useRef<BowlingTouch | null>(null);
  const [view, setView] = useState<MatchView | null>(null),
    [progress, setProgress] = useState(0),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(''),
    [connection, setConnection] = useState(''),
    [paused, setPaused] = useState(false),
    [hint, setHint] = useState(true),
    [retry, setRetry] = useState(0),
    [aim, setAim] = useState(0.055);
  const latest = useRef({ view, paused, loaded, error, connection });
  latest.current = { view, paused, loaded, error, connection };
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;
  const onSessionRef = useRef(onSession);
  onSessionRef.current = onSession;
  useEffect(() => {
    let active = true,
      unsubscribe: (() => void) | undefined;
    let submitting = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const handleError = (message: string) => {
      if (active) setError(message);
    };
    const canRoll = () => {
      const { view, paused, error, connection } = latest.current;
      return (
        !submitting &&
        !!view &&
        view.phase === 'aiming' &&
        view.activeId === session.current?.localId &&
        !paused &&
        !error &&
        !connection &&
        view.connected?.[session.current.localId] !== false
      );
    };
    const updateAim = (value: number) => {
      if (!active) return;
      setAim(value);
      scene.current?.setAim(value);
    };
    const throwBall = (shot: Shot) => {
      if (!canRoll()) return;
      submitting = true;
      setHint(false);
      updateAim(shot.aim);
      const turnId = latest.current.view!.turnId;
      void session.current
        ?.roll(shot, turnId)
        .catch((e) => {
          if (active) {
            setConnection(e.message);
            timers.push(setTimeout(() => active && setConnection(''), 3500));
          }
        })
        .finally(() => {
          submitting = false;
        });
    };
    const pause = () => {
      if (mode !== 'ai') return;
      setPaused((value) => {
        const next = !value;
        session.current?.setPaused?.(next);
        scene.current?.setPaused(next);
        return next;
      });
    };
    const tap = () => {
      if (latest.current.error) {
        setError('');
        setLoaded(false);
        setProgress(0);
        setView(null);
        setPaused(false);
        setRetry((v) => v + 1);
      } else if (latest.current.paused) pause();
      else if (latest.current.view?.phase === 'finished') onExitRef.current();
    };
    try {
      const engine = new BowlingScene(stage.current!, {
        onProgress: (value) => active && setProgress(value),
        onError: handleError,
        onLoaded: () => {
          if (!active) return;
          setLoaded(true);
          setError('');
          if (mode === 'online' && !tableId) {
            setError(
              'Choose a TPG match from the Royal Lanes lobby. Use Back to return.'
            );
            return;
          }
          const game: BowlingSession =
            mode === 'online'
              ? createOnlineSession!(
                  tableId,
                  (message) => active && setConnection(message)
                )
              : new LocalBowlingSession(playerName, difficulty, handleError);
          session.current = game;
          onSessionRef.current?.(game);
          unsubscribe = game.subscribe((snapshot) => {
            if (active) {
              setView(snapshot);
              engine.setView(snapshot, game.localId);
            }
          });
        }
      });
      scene.current = engine;
      engine.audio.enabled = soundEnabled;
      void engine.load();
    } catch (e) {
      handleError(
        'This game needs WebGL 2. Enable graphics acceleration or open it in a recent browser. Tap to retry.'
      );
    }
    touch.current = new BowlingTouch(surface.current!, {
      ready: canRoll,
      onAim: updateAim,
      onRoll: throwBall,
      onPause: pause,
      onTap: tap,
      onInteraction: () => scene.current?.audio.unlock()
    });
    touch.current.setAim(0.055);
    const keyboard = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        pause();
        return;
      }
      if (e.key === 'Enter' && latest.current.view?.phase === 'finished') {
        onExitRef.current();
        return;
      }
      if (!canRoll()) return;
      if (e.code === 'Space') {
        e.preventDefault();
        throwBall({
          aim: Number(surface.current?.dataset.aim || 0.055),
          hook: 0,
          power: 78
        });
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const next = Math.max(
          -1.2,
          Math.min(
            1.2,
            Number(surface.current?.dataset.aim || 0.055) +
              (e.key === 'ArrowLeft' ? -0.025 : 0.025)
          )
        );
        updateAim(next);
        touch.current?.setAim(next);
      }
    };
    surface.current?.addEventListener('keydown', keyboard);
    const node = surface.current;
    return () => {
      active = false;
      timers.forEach(clearTimeout);
      node?.removeEventListener('keydown', keyboard);
      unsubscribe?.();
      session.current?.dispose();
      session.current = null;
      onSessionRef.current?.(null);
      touch.current?.dispose();
      touch.current = null;
      scene.current?.dispose();
      scene.current = null;
    };
  }, [mode, tableId, difficulty, playerName, retry, createOnlineSession]);
  useEffect(() => {
    scene.current?.audio.setEnabled(soundEnabled);
  }, [soundEnabled]);
  const localId = session.current?.localId || 'you',
    self = view?.players.find((p) => p.id === localId),
    opponent = view?.players.find((p) => p.id !== localId),
    current = view?.players.find((p) => p.id === view.activeId);
  const yourTurn = view?.activeId === localId;
  const ownTotals = self ? frameTotals(self.score) : [];
  const phase = view?.phase;
  const seconds = view?.turnDeadline
    ? Math.max(0, Math.ceil((view.turnDeadline - view.serverNow) / 1000))
    : 0;
  const result = view?.lastResult;
  return (
    <main className="rl-game" aria-label="Royal Lanes bowling match">
      <div ref={stage} className="rl-stage" />
      <div className="rl-shade" aria-hidden="true" />
      <div
        ref={surface}
        className="rl-touch"
        role="application"
        aria-label="Bowling lane. Drag sideways to aim. Swipe up to bowl. Curve your swipe for spin. Two-finger tap pauses AI matches. Keyboard: arrows aim, Space bowls."
        tabIndex={0}
        data-aim={aim}
      />
      <header className="rl-header">
        <span className="rl-brand">
          ROYAL <em>LANES</em>
        </span>
        <span className="rl-meta">
          {mode === 'online' ? 'TPG MATCH' : 'VS AI'} · LANE 01
        </span>
      </header>
      {view && (
        <section className="rl-scoreboard" aria-label="Match scores">
          <div className={yourTurn ? 'rl-player is-current' : 'rl-player'}>
            <span>{self?.name || 'You'}</span>
            <strong>{self?.total ?? 0}</strong>
          </div>
          <div className="rl-frame">
            <span>FRAME</span>
            <b>
              {Math.min(current?.score.frames.length || 1, 10)}
              <small> / 10</small>
            </b>
          </div>
          <div
            className={
              !yourTurn ? 'rl-player is-current opponent' : 'rl-player opponent'
            }
          >
            <span>{opponent?.name || 'Opponent'}</span>
            <strong>{opponent?.total ?? 0}</strong>
          </div>
        </section>
      )}
      {self && (
        <section
          className="rl-score-strip"
          aria-label="Your ten-frame scorecard"
        >
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              data-current={
                i === self.score.frames.length - 1 && !self.score.finished
              }
              aria-label={`Frame ${i + 1}: ${rollSymbols(self.score.frames[i] || [], i).join(', ') || 'not played'}, total ${ownTotals[i] ?? 'pending'}`}
            >
              <span>{i + 1}</span>
              <span className="rl-marks">
                {rollSymbols(self.score.frames[i] || [], i).join(' ') || '·'}
              </span>
              <b>{ownTotals[i] ?? '·'}</b>
            </div>
          ))}
        </section>
      )}
      {!loaded && !error && (
        <div className="rl-message">
          <span className="rl-eyebrow">PREPARING YOUR LANE</span>
          <h1>Step into the club.</h1>
          <p>Loading the lane and bowlers</p>
          <div
            className="rl-progress"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <i style={{ width: `${progress}%` }} />
          </div>
          <p>{progress}%</p>
        </div>
      )}
      {error && (
        <div className="rl-message" role="alert">
          <h2>The lane couldn’t open.</h2>
          <p>{error}</p>
        </div>
      )}
      {!error && connection && (
        <div className="rl-connection" role="status">
          {connection}
        </div>
      )}
      {loaded && !view && !error && !connection && (
        <div className="rl-message" role="status">
          <h2>Joining your lane…</h2>
        </div>
      )}
      {paused && (
        <div className="rl-message">
          <span className="rl-eyebrow">TAKE YOUR TIME</span>
          <h2>Game paused</h2>
          <p>Tap the lane to resume.</p>
        </div>
      )}
      {view && !paused && !error && (
        <>
          {phase === 'finished' ? (
            <div className="rl-result" role="status">
              <span className="rl-eyebrow">
                {view.reason.endsWith('refund')
                  ? 'MATCH REFUNDED'
                  : !view.winnerAccountId
                    ? 'LEVEL SCORES'
                    : view.winnerAccountId === localId
                      ? 'YOUR GAME'
                      : 'WELL PLAYED'}
              </span>
              <h2>
                {view.winnerAccountId === localId
                  ? 'You win'
                  : view.winnerAccountId
                    ? 'Opponent wins'
                    : view.reason === 'tie_refund'
                      ? 'A draw'
                      : 'Match ended'}
              </h2>
              <p>
                {self?.total} — {opponent?.total}
              </p>
              {mode === 'online' && (
                <p>
                  {view.settlement?.status === 'pending'
                    ? 'TPG settlement pending…'
                    : view.settlement?.status === 'refunded'
                      ? 'Your TPG stake was refunded.'
                      : view.settlement?.status === 'paid'
                        ? `${view.settlement.amount?.toLocaleString()} TPG paid to the winner.`
                        : ''}
                </p>
              )}
              <span className="rl-return">
                Tap the lane to return to the lobby
              </span>
            </div>
          ) : phase === 'result' && result ? (
            <div className="rl-result" role="status">
              <span className="rl-eyebrow">
                {result.actorId === localId
                  ? 'YOUR ROLL'
                  : `${opponent?.name || 'OPPONENT'}`}
              </span>
              <h2>{result.title}</h2>
              <p>
                {result.timedOut
                  ? 'Turn timed out.'
                  : result.standing.length
                    ? `${result.standing.length} pins left`
                    : 'All ten down.'}
              </p>
            </div>
          ) : null}
          <div className="rl-guidance" aria-live="polite">
            {phase === 'waiting' ? (
              <>
                <strong>Waiting for your opponent</strong>
                <span>Both bowlers must load before the match starts.</span>
              </>
            ) : phase === 'countdown' ? (
              <>
                <strong>Get ready</strong>
                <span>Ten frames. Make every roll count.</span>
              </>
            ) : phase === 'aiming' ? (
              <>
                <strong>
                  {yourTurn
                    ? 'Your turn'
                    : `${opponent?.name || 'Your opponent'} is lining up`}
                  {mode === 'online' && seconds > 0 ? ` · ${seconds}s` : ''}
                </strong>
                <span>
                  {yourTurn
                    ? hint
                      ? 'Drag sideways to aim. Swipe up to bowl. Curve for spin.'
                      : 'Drag to aim · Swipe up to bowl'
                    : 'Watch your opponent bowl.'}
                </span>
              </>
            ) : phase === 'calculating' ? (
              <>
                <strong>
                  {yourTurn ? 'Your delivery' : 'Opponent’s delivery'}
                </strong>
                <span>Getting into position…</span>
              </>
            ) : phase === 'rolling' ? (
              <strong>
                {view.roll?.actorId === localId
                  ? 'Watch your line'
                  : 'Opponent bowling'}
              </strong>
            ) : null}
          </div>
        </>
      )}
    </main>
  );
}
