import React, { useEffect, useRef, useState } from 'react';
import {
  BowlingMatch,
  swipeInput,
  type BowlingState,
  type ThrowInput
} from '../../../../shared/bowling/engine';
import { frameIndex, symbols } from '../../../../shared/bowling/scoring';
import { createBowlingView } from './render';
import { bowlingAudio } from './audio';
import type { BowlingServices, Launch, RoomSnapshot } from './types';
import './game.css';

function Dialog({
  title,
  onClose,
  children
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="br-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-label={title}
    >
      <div className="br-dialog-head">
        <h2>{title}</h2>
        <button className="br-icon" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
export default function BowlingGame({
  launch,
  services,
  onLobby
}: {
  launch: Launch;
  services?: BowlingServices;
  onLobby: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    runtime = useRef<{ submit: (i: ThrowInput) => void } | null>(null);
  const initial = useState(() => new BowlingMatch({
    names: ['You', launch.mode === 'online' ? 'Opponent' : 'AI bowler']
  }).state)[0];
  const live = useRef<BowlingState>(initial),
    aim = useRef<ThrowInput | null>(null),
    paused = useRef(false),
    muted = useRef(false);
  const [state, setState] = useState<BowlingState>(initial),
    [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState(''),
    [menu, setMenu] = useState(false),
    [scorecard, setScorecard] = useState(false),
    [sound, setSound] = useState(true),
    [power, setPower] = useState(0),
    [reduced, setReduced] = useState(false),
    [restart, setRestart] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const online = launch.mode === 'online';
  paused.current = menu || scorecard;
  muted.current = !sound;
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const game = online
      ? null
      : new BowlingMatch({
          difficulty: launch.difficulty,
          names: [
            'You',
            ['Club AI', 'Tour AI', 'Pro AI'][launch.difficulty] || 'AI bowler'
          ]
        });
    const view = createBowlingView(el),
      audio = bowlingAudio();
    setReduced(view.reduced);
    let disposed = false,
      frame = 0,
      timer: ReturnType<typeof setTimeout> | undefined,
      snapshot: RoomSnapshot | null = null,
      busy = false,
      submitted = false,
      revision = -1;
    let previousTime = performance.now(),
      lastUI = 0,
      lastSoundTurn = 0,
      lastPhase = '',
      pointer: number | null = null,
      sx = 0,
      sy = 0;
    let keyboardStart = 0,
      keyboardTarget = 0.16;
    if (game) live.current = game.state;
    setState(structuredClone(live.current));
    setRoom(null);
    setError('');
    function accept(next: RoomSnapshot) {
      if (disposed || next.revision < revision) return;
      snapshot = next;
      revision = next.revision;
      live.current = next.state;
      setRoom(next);
      setError('');
    }
    async function sync() {
      if (disposed || !online || !services || !launch.tableId) return;
      try {
        accept(
          snapshot
            ? await services.sync(launch.tableId)
            : await services.join(launch.tableId)
        );
      } catch (e) {
        if (!disposed) setError((e as Error).message.replaceAll('_', ' '));
      } finally {
        if (!disposed) timer = setTimeout(sync, 125);
      }
    }
    if (online) {
      if (!services || !launch.tableId)
        setError('Open an online match from the Bowling Royal lobby.');
      else void sync();
    }
    const canBowl = () =>
      !disposed &&
      !paused.current &&
      !busy &&
      !submitted &&
      live.current.phase === 'ready' &&
      (online
        ? !!snapshot &&
          snapshot.joined &&
          snapshot.connected.every(Boolean) &&
          snapshot.seat === live.current.active
        : live.current.active === 0);
    function clearAim() {
      aim.current = null;
      setPower(0);
      pointer = null;
    }
    async function submit(input: ThrowInput) {
      if (!canBowl()) return;
      audio.unlock();
      audio.setEnabled(!muted.current);
      if (input.power < 0.08) {
        clearAim();
        return;
      }
      submitted = true;
      setError('');
      try {
        if (game) game.throwBall(0, game.state.turn, input);
        else {
          busy = true;
          accept(
            await services!.bowl(launch.tableId!, live.current.turn, input)
          );
        }
      } catch (e) {
        if (!disposed) setError((e as Error).message.replaceAll('_', ' '));
      } finally {
        busy = false;
        submitted = false;
        clearAim();
      }
    }
    runtime.current = { submit };
    const relative = (e: PointerEvent) => {
      const r = el!.getBoundingClientRect();
      return {
        x: e.clientX - r.left,
        y: e.clientY - r.top,
        w: r.width,
        h: r.height
      };
    };
    const down = (e: PointerEvent) => {
      if (!canBowl() || pointer !== null || e.button > 0) return;
      audio.unlock();
      const p = relative(e);
      pointer = e.pointerId;
      sx = p.x;
      sy = p.y;
      el!.setPointerCapture(e.pointerId);
      aim.current = swipeInput(p.w, p.h, sx, sy, p.x, p.y);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      const p = relative(e);
      aim.current = swipeInput(p.w, p.h, sx, sy, p.x, p.y);
      setPower(aim.current.power);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      const p = relative(e);
      const input = swipeInput(p.w, p.h, sx, sy, p.x, p.y);
      el!.releasePointerCapture(e.pointerId);
      clearAim();
      void submit(input);
    };
    const cancel = (e: PointerEvent) => {
      if (e.pointerId === pointer) clearAim();
    };
    const keydown = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement)?.closest('button,input,select,dialog') ||
        !canBowl()
      )
        return;
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();
        keyboardTarget = Math.max(
          -1.6,
          Math.min(
            1.6,
            keyboardTarget + (e.code === 'ArrowRight' ? 0.08 : -0.08)
          )
        );
        aim.current = {
          power: 0.8,
          releaseX: 0.2,
          targetX: keyboardTarget,
          hook: 0
        };
      }
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        keyboardStart = performance.now();
        audio.unlock();
      }
    };
    const keyup = (e: KeyboardEvent) => {
      if (e.code === 'Space' && keyboardStart) {
        e.preventDefault();
        const p = Math.min(
          1,
          Math.max(0.12, (performance.now() - keyboardStart) / 900)
        );
        keyboardStart = 0;
        void submit({
          power: p,
          releaseX: 0.2,
          targetX: keyboardTarget,
          hook: 0
        });
      }
    };
    const blur = () => {
      keyboardStart = 0;
      clearAim();
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', blur);
    function animate(now: number) {
      if (disposed) return;
      const dt = Math.min(0.1, (now - previousTime) / 1000);
      previousTime = now;
      if (game && !paused.current) {
        game.advance(dt);
        live.current = game.state;
      }
      const s = live.current;
      audio.setEnabled(!muted.current);
      if (s.phase === 'rolling' && lastPhase !== 'rolling') audio.roll();
      lastPhase = s.phase;
      if (s.lastShot && s.lastShot.turn !== lastSoundTurn) {
        lastSoundTurn = s.lastShot.turn;
        audio.pins(s.lastShot.pins);
        if (s.lastShot.strike || s.lastShot.spare) audio.celebrate();
      }
      if (keyboardStart) setPower(Math.min(1, (now - keyboardStart) / 900));
      view.draw(s, dt, aim.current);
      if (now - lastUI > 90) {
        setState(structuredClone(s));
        lastUI = now;
      }
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => {
      disposed = true;
      runtime.current = null;
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      view.dispose();
      audio.dispose();
      aim.current = null;
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', blur);
    };
  }, [launch, services, restart, online]);
  async function leave() {
    if (leaving) return;
    setLeaving(true);
    try {
      if (online && services && launch.tableId)
        await services.leave(launch.tableId);
      onLobby();
    } catch (e) {
      setError((e as Error).message.replaceAll('_', ' '));
      setMenu(false);
    } finally {
      setLeaving(false);
    }
  }
  const currentFrame = Math.max(
    1,
    Math.min(10, frameIndex(state.players[state.active]) + 1 || 10)
  );
  const myTurn =
    state.phase === 'ready' &&
    (online
      ? room?.seat === state.active &&
        room.joined &&
        room.connected.every(Boolean)
      : state.active === 0);
  const winnerName =
    state.winner === null
      ? 'Draw'
      : `${state.players[state.winner]?.name} wins`;
  return (
    <main className="br-game">
      <canvas
        ref={canvas}
        className="br-canvas"
        aria-label="Bowling lane. Swipe upward to bowl; move left or right to aim."
        tabIndex={0}
      />
      <header className="br-hud">
        <div className="br-topline">
          <button
            className="br-icon"
            onClick={() => setMenu(true)}
            aria-label="Match menu"
          >
            ☰
          </button>
          <strong>
            BOWLING <em>ROYAL</em>
          </strong>
          <button
            className="br-icon"
            onClick={() => setScorecard(true)}
            aria-label="Open scorecard"
          >
            ▦
          </button>
        </div>
        <div className="br-score-pair">
          {state.players.map((p, i) => (
            <div key={i} className={state.active === i ? 'is-active' : ''}>
              <span>{online && room?.seat === i ? 'You' : p.name}</span>
              <b>{p.total}</b>
              <small>
                {frameIndex(p) < 0
                  ? 'Final score'
                  : state.active === i
                    ? 'At the line'
                    : 'Next up'}
              </small>
            </div>
          ))}
        </div>
        <div className="br-frame-info">
          <span>FRAME {currentFrame} / 10</span>
          <span>
            {online
              ? 'ONLINE · ' + (room?.joined ? 'LIVE' : 'CONNECTING')
              : ['CLUB', 'TOUR', 'PRO'][launch.difficulty] + ' AI'}
          </span>
          <span>
            {online && state.phase === 'ready' && room?.joined
              ? `${Math.ceil(room.turnRemaining)}s to bowl`
              : `ROLL ${Math.min(3, (state.players[state.active].frames[Math.min(9, currentFrame - 1)]?.rolls.length || 0) + 1)}`}
          </span>
        </div>
      </header>
      <div className="br-bottom">
        {error && (
          <p className="br-error" role="alert">
            {error}
          </p>
        )}
        {online && room?.joined && !room.connected.every(Boolean) && (
          <p className="br-notice">
            Connection interrupted. Waiting for both players to reconnect…
          </p>
        )}
        <p className="br-callout" role="status">
          {online && !room
            ? 'Connecting to your match…'
            : myTurn
              ? 'Your turn'
              : state.message}
        </p>
        <div
          className="br-power"
          role="progressbar"
          aria-label="Throw power"
          aria-valuenow={Math.round(power * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <i style={{ width: `${power * 100}%` }} />
        </div>
        <div className="br-help">
          <span>
            Swipe up for power
            <br />
            Slide left or right to aim
          </span>
          <button
            disabled={!myTurn}
            onClick={() =>
              runtime.current?.submit({
                power: 0.8,
                releaseX: 0.2,
                targetX: 0.16,
                hook: 0
              })
            }
          >
            Bowl
          </button>
        </div>
        {reduced && <small className="br-reduced">Reduced graphics</small>}
      </div>
      {menu && (
        <Dialog
          title={online ? 'Match menu' : 'Paused'}
          onClose={() => setMenu(false)}
        >
          <p>
            {online
              ? 'Online play and the turn timer continue while this menu is open.'
              : 'Swipe upward, then release. A longer swipe gives more power; a sideways curve adds hook.'}
          </p>
          <button className="br-secondary" onClick={() => setSound((v) => !v)}>
            Sound {sound ? 'on' : 'off'}
          </button>
          <button className="br-primary" onClick={() => setMenu(false)}>
            Resume match
          </button>
          <button className="br-secondary" disabled={leaving} onClick={leave}>
            {leaving
              ? 'Leaving…'
              : online
                ? 'Retire and return to lobby'
                : 'Return to lobby'}
          </button>
          {online && (
            <small>
              Retiring after both players join awards the match to your
              opponent.
            </small>
          )}
        </Dialog>
      )}
      {scorecard && (
        <Dialog title="Scorecard" onClose={() => setScorecard(false)}>
          {state.players.map((p, seat) => (
            <section className="br-card-player" key={seat}>
              <h3>
                {p.name}
                <b>{p.total}</b>
              </h3>
              <div className="br-frame-grid">
                {p.frames.map((f, i) => (
                  <div key={i} className="br-frame">
                    <small>{i + 1}</small>
                    <div>
                      {symbols(f, i).map((symbol, j) => (
                        <span key={j}>{symbol || ' '}</span>
                      ))}
                    </div>
                    <b>{f.cumulative ?? '·'}</b>
                  </div>
                ))}
              </div>
            </section>
          ))}
          <p className="br-score-help">
            X = strike · / = spare · – = miss
            <br />
            Strike: next two rolls count as bonus. Spare: next roll counts as
            bonus. The tenth frame includes earned bonus rolls. Highest score
            wins; 300 is perfect.
          </p>
        </Dialog>
      )}
      {state.phase === 'over' && !scorecard && (
        <section className="br-result" aria-label="Match result">
          <span className="br-eyebrow">MATCH RESULT</span>
          <h1>{winnerName}</h1>
          <div className="br-final-scores">
            {state.players[0].total}
            <span>–</span>
            {state.players[1].total}
          </div>
          <p>{state.message}</p>
          {online && (
            <p role="status" className="br-settlement">
              {room?.settlement?.status === 'finished'
                ? `${room.settlement.amount} TPG awarded to the winner`
                : room?.settlement?.status === 'refunded'
                  ? `${room.settlement.amount} TPG returned to each player`
                  : 'Result confirmed · settling TPG…'}
            </p>
          )}
          <button className="br-secondary" onClick={() => setScorecard(true)}>
            View scorecard
          </button>
          {!online && (
            <button
              className="br-primary"
              onClick={() => {
                setMenu(false);
                setRestart((r) => r + 1);
              }}
            >
              Play again
            </button>
          )}
          <button
            className={online ? 'br-primary' : 'br-secondary'}
            onClick={onLobby}
          >
            Return to lobby
          </button>
        </section>
      )}
    </main>
  );
}
