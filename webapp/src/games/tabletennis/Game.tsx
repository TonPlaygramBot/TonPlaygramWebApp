import React, { useEffect, useRef, useState } from 'react';
import { TableTennisRenderer } from './render';
import { TableTennisAudio } from './audio';
import {
  advance,
  createMatch,
  neutralInput,
  setInput,
  Input,
  MatchState,
  Seat,
  Shot
} from './engine';
import {
  Career,
  GameServices,
  RoomSnapshot,
  freshCareer,
  normalizeCareer,
  TOUR,
  careerRound,
  rallyGoal
} from './career';
import { CHARACTERS, ARENAS, type AppearanceChoices } from './options';
import { TAP_POWER } from '../../../../shared/tabletennis/swipe';
import { TableTouches, touchShot, type TouchResult } from './touch';
import {
  BroadcastScoreboard,
  type PlayerIdentity
} from './BroadcastScoreboard';
export type Launch = {
  mode: string;
  arena: string;
  format: string;
  difficulty: number;
  character: string;
  tableId?: string;
};
export default function TableTennisGame({
  services,
  launch,
  onLobby,
  profile = { name: 'You' },
  appearanceChoices,
  inline = false
}: {
  services: GameServices;
  launch?: Launch;
  onLobby?: () => void;
  profile?: PlayerIdentity;
  appearanceChoices?: AppearanceChoices;
  inline?: boolean;
}) {
  const characterChoices = appearanceChoices?.characters || CHARACTERS;
  const arenaChoices = appearanceChoices?.arenas || ARENAS;
  const host = useRef<HTMLDivElement>(null),
    renderer = useRef<TableTennisRenderer | null>(null),
    audio = useRef<TableTennisAudio | null>(null);
  const frame = useRef<MatchState>(createMatch()),
    input = useRef<Input>(neutralInput()),
    room = useRef<RoomSnapshot | null>(null),
    modeRef = useRef('ai'),
    careerId = useRef(''),
    matchCareer = useRef<Career>(freshCareer()),
    saved = useRef(false),
    syncing = useRef(false),
    epoch = useRef(0);
  const [view, setView] = useState('home'),
    [score, setScore] = useState(frame.current),
    [career, setCareer] = useState<Career>(freshCareer()),
    [arena, setArena] = useState(launch?.arena || 'dancingHall'),
    [character, setCharacter] = useState(launch?.character || 'athlete-male'),
    [difficulty, setDifficulty] = useState(launch?.difficulty ?? 1),
    [format, setFormat] = useState(launch?.format || 'quick');
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [paused, setPaused] = useState(false),
    [sound, setSound] = useState(true),
    [auto, setAuto] = useState(false),
    [shot, setShot] = useState<Shot>('drive'),
    [power, setPower] = useState(TAP_POWER),
    [touchActive, setTouchActive] = useState(false),
    [trail, setTrail] = useState<{ x: number; y: number }[]>([]),
    [feedbackUntil, setFeedbackUntil] = useState(0),
    [network, setNetwork] = useState(''),
    [careerSaved, setCareerSaved] = useState(false),
    [help, setHelp] = useState(false),
    [graphics, setGraphics] = useState(true);
  const active = useRef(false),
    pauseRef = useRef(false),
    mounted = useRef(true),
    lastEvent = useRef(0),
    seat = room.current?.seat ?? 0;
  const touches = useRef(new TableTouches());
  const captured = useRef(new Map<number, HTMLElement>());
  const drag = useRef<{
    x: number;
    y: number;
    playerX: number;
    playerZ: number;
    canPlay: boolean;
  } | null>(null);
  const previousPhase = useRef(frame.current.phase);
  function releaseCapture(id: number) {
    const element = captured.current.get(id);
    captured.current.delete(id);
    if (element?.hasPointerCapture(id)) element.releasePointerCapture(id);
  }
  function cancelGesture() {
    touches.current.clear();
    drag.current = null;
    for (const id of captured.current.keys()) releaseCapture(id);
    input.current.assist = true;
    input.current.moveX = null;
    input.current.moveZ = null;
    setTouchActive(false);
    setTrail([]);
  }
  function resume() {
    cancelGesture();
    pauseRef.current = false;
    setPaused(false);
  }
  function canSwing() {
    const s = frame.current,
      n = room.current?.seat ?? 0;
    return (
      active.current &&
      !pauseRef.current &&
      ((s.phase === 'rally' && s.ball.last !== n) ||
        (s.phase === 'serve' && s.score.server === n))
    );
  }
  function pause() {
    cancelGesture();
    pauseRef.current = !room.current;
    setPaused(true);
  }
  async function saveCareer() {
    if (saved.current || !careerId.current) return;
    saved.current = true;
    try {
      const c = await services.finishCareer(
        careerId.current,
        frame.current.winner === 0,
        frame.current.bestRally
      );
      if (mounted.current) {
        setCareer(normalizeCareer(c));
        setCareerSaved(true);
      }
    } catch {
      if (mounted.current)
        setError('Result not saved. Retry save: tap the screen.');
    }
  }
  async function start(mode = 'ai') {
    if (busy) return;
    audio.current?.unlock();
    setBusy(true);
    setError('');
    setNotice('');
    setPaused(false);
    pauseRef.current = false;
    const generation = ++epoch.current;
    try {
      let config = {
        ai: true,
        difficulty,
        gamesToWin: format === 'quick' ? 1 : format === 'full' ? 3 : 2,
        upgrades: [0, 0, 0],
        firstServer: (inline || Math.random() < 0.5 ? 0 : 1) as Seat,
        seed: Date.now() >>> 0
      };
      let startingPoints: number[] | null = null;
      if (mode === 'career') {
        const r = await services.startCareer();
        if (generation !== epoch.current) return;
        careerId.current = r.id;
        r.career = normalizeCareer(r.career);
        setCareer(r.career);
        matchCareer.current = r.career;
        const tour = TOUR[r.career.tour];
        const round = careerRound(r.career);
        startingPoints = round.points;
        setArena(tour.arena);
        config = {
          ...config,
          difficulty: tour.difficulty,
          gamesToWin: round.gamesToWin,
          firstServer: 0,
          upgrades: r.career.upgrades
        };
      } else careerId.current = '';
      if (mode === 'online') {
        const r = await services.joinRoom(launch?.tableId || '');
        if (generation !== epoch.current) {
          void services.leaveRoom(r.code);
          return;
        }
        room.current = r;
        frame.current = r.state;
        setNetwork(r.joined ? 'Connected' : 'Waiting for opponent');
      } else {
        room.current = null;
        frame.current = createMatch(config);
        if (startingPoints)
          frame.current.score.points = [...startingPoints] as [number, number];
      }
      saved.current = false;
      setCareerSaved(false);
      modeRef.current = mode;
      lastEvent.current = 0;
      input.current = {
        ...neutralInput(),
        shot,
        aim: 0,
        power,
        autoHit: auto
      };
      active.current = true;
      setScore({ ...frame.current });
      setView('match');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  function exit() {
    cancelGesture();
    epoch.current++;
    active.current = false;
    pauseRef.current = false;
    setPaused(false);
    if (room.current) {
      void services.leaveRoom(room.current.code).catch(() => {});
      room.current = null;
    }
    if (modeRef.current === 'career') setView('career');
    else if (onLobby) onLobby();
    else setView('home');
  }
  function hit() {
    if (!canSwing()) return;
    audio.current?.unlock();
    input.current.direction = null;
    input.current.power = TAP_POWER;
    input.current.shot = 'drive';
    setShot('drive');
    setPower(TAP_POWER);
    setFeedbackUntil(frame.current.time + 0.8);
    input.current.swing++;
  }
  useEffect(() => {
    mounted.current = true;
    audio.current = new TableTennisAudio();
    let raf = 0,
      last = performance.now(),
      ui = 0,
      nextSync = 0;
    try {
      if (host.current)
        renderer.current = new TableTennisRenderer(host.current, (m) =>
          setNotice(m)
        );
    } catch {
      setGraphics(false);
      setError(
        'This browser could not start 3D graphics. Open the game in a WebGL-capable browser.'
      );
    }
    const tick = (t: number) => {
      if (!mounted.current) return;
      const dt = Math.max(0, Math.min(0.25, (t - last) / 1000));
      last = t;
      if (active.current) {
        if (
          previousPhase.current !== frame.current.phase &&
          (frame.current.phase === 'point' || frame.current.phase === 'over')
        ) {
          cancelGesture();
          input.current.direction = null;
        }
        previousPhase.current = frame.current.phase;
        if (room.current) {
          if (!syncing.current && t > nextSync) {
            nextSync = t + 50;
            syncing.current = true;
            const current = room.current.code,
              generation = epoch.current;
            services
              .syncRoom(current, input.current)
              .then((r) => {
                if (generation !== epoch.current) return;
                room.current = r;
                frame.current = r.state;
                setNetwork(
                  r.joined
                    ? Date.now() - r.peerSeen > 12000
                      ? 'Opponent reconnecting'
                      : 'Connected'
                    : 'Waiting for opponent'
                );
              })
              .catch(() => {
                if (generation === epoch.current) setNetwork('Reconnecting…');
              })
              .finally(() => {
                syncing.current = false;
              });
          }
        } else if (!pauseRef.current) {
          setInput(frame.current, 0, input.current);
          for (let elapsed = dt; elapsed > 0; elapsed -= 0.1)
            advance(frame.current, Math.min(0.1, elapsed));
        }
        for (const e of frame.current.events)
          if (e.id > lastEvent.current) {
            const eventState = frame.current;
            const cameraSide = (room.current?.seat ?? 0) === 0 ? 1 : -1;
            const end = eventState.endsSwapped ? -1 : 1;
            audio.current?.play(
              e.type,
              Math.min(
                1,
                Math.hypot(
                  eventState.ball.vx,
                  eventState.ball.vy,
                  eventState.ball.vz
                ) / 10
              ),
              eventState.ball.x * cameraSide * end
            );
            lastEvent.current = e.id;
          }
        if (
          frame.current.phase === 'over' &&
          modeRef.current === 'career' &&
          !saved.current
        )
          void saveCareer();
      }
      renderer.current?.draw(
        frame.current,
        room.current?.seat ?? 0,
        active.current
      );
      if (t - ui > 100) {
        ui = t;
        setScore({
          ...frame.current,
          score: {
            ...frame.current.score,
            points: [...frame.current.score.points],
            games: [...frame.current.score.games]
          }
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const hidden = () => {
      if (document.hidden) cancelGesture();
      if (document.hidden && !room.current && active.current) {
        pauseRef.current = true;
        setPaused(true);
      }
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      mounted.current = false;
      cancelGesture();
      epoch.current++;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', hidden);
      renderer.current?.dispose();
      renderer.current = null;
      audio.current?.dispose();
    };
  }, [services]);
  const actor0 = room.current
    ? room.current.players?.[0]?.character || 'athlete-male'
    : character;
  const actor1 = room.current
    ? room.current.players?.[1]?.character || 'athlete-female'
    : character === 'athlete-female'
      ? 'athlete-male-gold'
      : 'athlete-female';
  useEffect(() => {
    void renderer.current?.appearance(arena, [actor0, actor1]);
  }, [arena, actor0, actor1, graphics]);
  useEffect(() => {
    let alive = true;
    if (launch?.mode === 'career') {
      services
        .career()
        .then((c) => {
          if (alive) {
            setCareer(normalizeCareer(c));
            setView('career');
          }
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    } else if (launch) {
      void start(launch.mode);
    }
    return () => {
      alive = false;
    };
  }, [launch, services]);
  const openCareer = async () => {
    audio.current?.unlock();
    setBusy(true);
    try {
      setCareer(normalizeCareer(await services.career()));
      setView('career');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  function finishTouch(stroke: TouchResult, canPlay: boolean) {
    if (paused) {
      if (
        stroke.fingers === 2 &&
        stroke.kind === 'swipe' &&
        stroke.travelY > 80
      )
        exit();
      else if (stroke.kind === 'tap' || stroke.kind === 'menu') resume();
      return;
    }
    if (frame.current.phase === 'over') {
      if (error.includes('Retry save')) {
        saved.current = false;
        setError('');
        void saveCareer();
        return;
      }
      if (stroke.kind === 'menu' || modeRef.current !== 'ai') exit();
      else if (stroke.kind === 'tap') void start();
      return;
    }
    if (stroke.kind === 'menu') {
      pause();
      return;
    }
    if (!canPlay || !canSwing()) return;
    const selected = touchShot(
      stroke,
      frame.current.phase === 'rally' && frame.current.ball.y > 1.12
    );
    audio.current?.play('swish', stroke.power);
    input.current.power = stroke.power;
    input.current.shot = selected;
    input.current.direction =
      renderer.current?.shotDirection(stroke.dx, stroke.dy, frame.current) ??
      null;
    input.current.swing++;
    setPower(stroke.power);
    setShot(selected);
    setFeedbackUntil(frame.current.time + 0.8);
  }
  const pointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (
      view !== 'match' ||
      e.button !== 0 ||
      (e.target as HTMLElement).closest('input,select,option,label,a,button')
    )
      return;
    audio.current?.unlock();
    if (!touches.current.fingers.size) {
      const p = frame.current.players[room.current?.seat ?? 0];
      drag.current = {
        x: e.clientX,
        y: e.clientY,
        playerX: p.x,
        playerZ: p.z,
        canPlay: !paused && canSwing()
      };
    }
    touches.current.down(
      e.pointerId,
      e.clientX,
      e.clientY,
      e.timeStamp,
      e.currentTarget.clientWidth
    );
    if (e.pointerId === touches.current.primary) {
      const bounds = e.currentTarget.getBoundingClientRect();
      setTrail([{ x: e.clientX - bounds.left, y: e.clientY - bounds.top }]);
    }
    captured.current.set(e.pointerId, e.currentTarget);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (!paused && frame.current.phase !== 'over') {
      setTouchActive(true);
      setPower(TAP_POWER);
    }
  };
  const pointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!touches.current.fingers.has(e.pointerId)) return;
    const samples = e.nativeEvent.getCoalescedEvents?.() || [];
    for (const sample of samples)
      touches.current.move(
        e.pointerId,
        sample.clientX,
        sample.clientY,
        sample.timeStamp
      );
    touches.current.move(e.pointerId, e.clientX, e.clientY, e.timeStamp);
    if (e.pointerId === touches.current.primary) {
      const bounds = e.currentTarget.getBoundingClientRect();
      setTrail((points) => [
        ...points.slice(-18),
        { x: e.clientX - bounds.left, y: e.clientY - bounds.top }
      ]);
    }
    const stroke = touches.current.read();
    if (stroke) setPower(stroke.power);
    const d = drag.current,
      n = room.current?.seat ?? 0;
    if (
      d &&
      active.current &&
      e.pointerId === touches.current.primary &&
      frame.current.phase === 'rally' &&
      frame.current.ball.last === n &&
      !d.canPlay &&
      !paused
    ) {
      const s = frame.current;
      const offset = renderer.current?.moveOffset(
        {
          ...s,
          players: s.players.map((p, i) =>
            i === n ? { ...p, x: d.playerX, z: d.playerZ } : p
          )
        },
        n,
        e.clientX - d.x,
        e.clientY - d.y
      );
      if (offset) {
        input.current.assist = false;
        input.current.moveX = d.playerX + offset.x;
        input.current.moveZ = d.playerZ + offset.z;
      }
    }
  };
  const pointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const canPlay = drag.current?.canPlay ?? false;
    const stroke = touches.current.up(
      e.pointerId,
      e.clientX,
      e.clientY,
      e.timeStamp
    );
    releaseCapture(e.pointerId);
    if (!touches.current.fingers.size) {
      cancelGesture();
      if (stroke) finishTouch(stroke, canPlay);
    }
  };
  const keyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (view !== 'match' || (e.target as HTMLElement).closest('input,select'))
      return;
    if (e.key === 'Escape') {
      e.preventDefault();
      paused ? resume() : pause();
    }
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      if (paused) resume();
      else if (frame.current.phase === 'over')
        modeRef.current === 'ai' ? void start() : exit();
      else hit();
    }
  };
  const currentTour = TOUR[career.tour],
    r = score,
    other = 1 - seat,
    online = modeRef.current === 'online' && view === 'match';
  return (
    <div
      className={`tt-game ${inline ? 'tt-inline' : ''}`}
      data-view={view}
      tabIndex={view === 'match' ? 0 : undefined}
      aria-label="Table tennis touch court"
      aria-describedby="tt-touch-help"
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onKeyDown={keyDown}
      onPointerCancel={() => cancelGesture()}
      onLostPointerCapture={(e) => {
        if (captured.current.has(e.pointerId)) cancelGesture();
      }}
      onContextMenu={(e) => {
        if (view === 'match') e.preventDefault();
      }}
    >
      {view !== 'match' && (
        <header className="tt-header">
          <button
            className="tt-brand"
            onClick={() => {
              if (view === 'match') {
                pause();
              } else if (onLobby) onLobby();
              else setView('home');
            }}
          >
            TABLE TENNIS <b>ROYAL</b>
          </button>
          <button
            className="tt-icon"
            aria-label={sound ? 'Mute sound' : 'Enable sound'}
            onClick={() => {
              audio.current?.unlock();
              setSound(!sound);
              if (audio.current) audio.current.enabled = !sound;
            }}
          >
            {sound ? 'Sound on' : 'Muted'}
          </button>
        </header>
      )}
      <div className="tt-scene" ref={host} />
      <div className="tt-vignette" />
      {view === 'home' && (
        <>
          <div className="tt-hero">
            <span className="tt-eyebrow">THE NEXT RALLY IS YOURS</span>
            <h1>
              Small table.
              <br />
              <em>Big game.</em>
            </h1>
            <p>Real spin. Human rivals.</p>
          </div>
          <div className="tt-home-actions">
            <button
              className="tt-primary"
              disabled={busy || !graphics}
              onClick={() => start()}
            >
              PLAY VS AI <span>↗</span>
            </button>
            <div className="tt-two">
              <button
                className="tt-secondary"
                disabled={busy}
                onClick={openCareer}
              >
                Career tour
              </button>
              <button
                className="tt-secondary"
                onClick={() => {
                  if (onLobby) onLobby();
                  else setView('online');
                }}
              >
                Online · TPC
              </button>
            </div>
            <div className="tt-links">
              <button onClick={() => setView('setup')}>Players & arena</button>
              <button onClick={() => setHelp(true)}>How to play</button>
              <button onClick={() => setView('credits')}>Credits</button>
            </div>
          </div>
        </>
      )}
      {view === 'match' && (
        <>
          <button
            className="tt-match-menu"
            aria-label="Pause and settings"
            onClick={pause}
          >
            Ⅱ
          </button>
          {trail.length > 1 && (
            <svg className="tt-swipe-trail" aria-hidden="true">
              <polyline
                points={trail.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx={trail[trail.length - 1].x}
                cy={trail[trail.length - 1].y}
                r="8"
                fill="currentColor"
              />
            </svg>
          )}
          <BroadcastScoreboard
            state={r}
            seat={seat}
            label={
              online
                ? 'TPC MATCH'
                : modeRef.current === 'career'
                  ? 'ROYAL TOUR'
                  : 'EXHIBITION'
            }
            players={
              online
                ? [
                    room.current?.players?.[0] || { name: 'Player 1' },
                    room.current?.players?.[1] || { name: 'Player 2' }
                  ]
                : [
                    profile,
                    {
                      name:
                        modeRef.current === 'career'
                          ? TOUR[matchCareer.current.tour].opponents[
                              Math.min(2, matchCareer.current.round)
                            ]
                          : ['Club AI', 'Tour AI', 'Pro AI'][difficulty]
                    }
                  ]
            }
          />
          <div className="tt-call" role="status">
            {r.phase === 'serve'
              ? r.score.server === seat
                ? 'Your serve · tap softly or swipe'
                : 'Opponent serves'
              : r.message}
            {r.phase === 'rally' && <small>{r.rally} shot rally</small>}
          </div>
          <p
            id="tt-touch-help"
            className="tt-touch-help"
            data-visible={r.time < 8 || paused}
          >
            Swipe toward your target · faster = harder · tap = soft
          </p>
          {(touchActive || r.time < feedbackUntil) &&
            !paused &&
            r.phase !== 'over' && (
              <output className="tt-touch-feedback" aria-live="off">
                {shot} · {Math.round(power * 100)}%
                <span className="tt-power-track">
                  <span style={{ width: `${power * 100}%` }} />
                </span>
              </output>
            )}
          {modeRef.current === 'career' && (
            <div className="tt-match-mission">
              {careerRound(matchCareer.current).name} · Rally challenge{' '}
              {Math.min(r.bestRally, rallyGoal(matchCareer.current.tour))}/
              {rallyGoal(matchCareer.current.tour)}
            </div>
          )}
          {online && <span className="tt-connection">{network}</span>}
        </>
      )}
      {view === 'setup' && (
        <section className="tt-panel">
          <button className="tt-back" onClick={() => setView('home')}>
            ← Back
          </button>
          <span className="tt-eyebrow">MAKE IT YOUR GAME</span>
          <h2>Players & arena</h2>
          <label>
            Human player
            <select
              value={character}
              onChange={(e) => setCharacter(e.target.value)}
            >
              {characterChoices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.description}
                </option>
              ))}
            </select>
          </label>
          <label>
            Competition arena
            <select value={arena} onChange={(e) => setArena(e.target.value)}>
              {arenaChoices.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            AI level
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(+e.target.value)}
            >
              <option value="0">Club</option>
              <option value="1">Tour</option>
              <option value="2">Pro</option>
            </select>
          </label>
          <label>
            Match length
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="quick">One game to 11</option>
              <option value="set">Best of three games</option>
              <option value="full">Best of five games</option>
            </select>
          </label>
          <button className="tt-primary" onClick={() => setView('home')}>
            BACK TO TABLE <span>↗</span>
          </button>
        </section>
      )}
      {view === 'career' && (
        <section className="tt-panel tt-career-panel">
          <button
            className="tt-back"
            onClick={() => (onLobby ? onLobby() : setView('home'))}
          >
            ← Lobby
          </button>
          <span className="tt-eyebrow">THE ROYAL TOUR</span>
          <h2>{career.completed ? 'Champion.' : currentTour.name}</h2>
          <p>
            {career.completed
              ? 'You won all five events.'
              : `${currentTour.place} · ${careerRound(career).name} vs ${currentTour.opponents[Math.min(2, career.round)]}`}
          </p>
          <div className="tt-career-stats">
            <span>{career.wins} wins</span>
            <span>{career.losses} losses</span>
            <span>{career.credits} skill points</span>
          </div>
          {!career.completed && (
            <div className="tt-next-match">
              <span className="tt-eyebrow">ROUND {career.round + 1} / 3</span>
              <h3>{careerRound(career).name}</h3>
              <p>{careerRound(career).detail}</p>
              <button
                className="tt-primary"
                disabled={busy || !graphics}
                onClick={() => start('career')}
              >
                PLAY {careerRound(career).name.toUpperCase()} <span>↗</span>
              </button>
            </div>
          )}
          <div className="tt-mission-card">
            <span className="tt-eyebrow">SIDE MISSION · +1 SKILL POINT</span>
            <b>
              {career.medals.includes(`rally-${career.tour}`)
                ? '✓ Rally medal earned'
                : `Build a ${rallyGoal(career.tour)}-shot rally`}
            </b>
            <p>
              Keep the ball in play during any match at this event. Earn the
              medal once, even if you lose.
            </p>
          </div>
          <ol className="tt-tour">
            {TOUR.map((t, i) => (
              <li key={t.name} data-active={career.tour === i}>
                <span>{i < career.tour || career.completed ? '✓' : i + 1}</span>
                <b>{t.name}</b>
                <small>{t.place}</small>
              </li>
            ))}
          </ol>
          <div className="tt-training">
            {['Footwork', 'Power', 'Reach'].map((n, i) => (
              <button
                key={n}
                disabled={busy || career.credits < 2 || career.upgrades[i] >= 3}
                onClick={async () => {
                  setBusy(true);
                  try {
                    setCareer(normalizeCareer(await services.upgrade(i)));
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {n} {career.upgrades[i]}/3 <small>Train · 2 points</small>
              </button>
            ))}
          </div>
          <small>
            {services.online
              ? 'Career saves to your TPC account.'
              : 'Preview career lasts for this session.'}{' '}
            Skill points are for training; no wallet stake.
          </small>
        </section>
      )}
      {view === 'online' && (
        <section className="tt-panel">
          <button className="tt-back" onClick={() => setView('home')}>
            ← Back
          </button>
          <span className="tt-eyebrow">HEAD TO HEAD</span>
          <h2>Your TPC arena.</h2>
          <p>
            Online opponents and stake matchmaking are available through the
            Table Tennis Royal lobby in TonPlaygram. This preview supports AI
            and career play.
          </p>
          <button className="tt-primary" onClick={() => start()}>
            PLAY VS AI <span>↗</span>
          </button>
        </section>
      )}
      {view === 'credits' && (
        <section className="tt-panel">
          <button className="tt-back" onClick={() => setView('home')}>
            ← Back
          </button>
          <h2>Behind the rally</h2>
          <p>
            Chess veteran: the Ready Player Me human already used by Chess
            Battle Royal, preserved with original attribution.
          </p>
          <p>
            Adrian and Maya:{' '}
            <a
              href="https://quaternius.com/packs/universalbasecharacters.html"
              target="_blank"
              rel="noreferrer"
            >
              Quaternius Universal Base Characters
            </a>
            , CC0. Luca and Nadia are sports-kit variations of these two models.
          </p>
          <p>
            Original indoor competition arenas, table, paddle, procedural
            animation, synthesized audio and shared table tennis simulation.
          </p>
        </section>
      )}
      {help && (
        <div className="tt-modal">
          <div>
            <span className="tt-eyebrow">YOUR FIRST RALLY</span>
            <h2>Serve. Aim. Spin.</h2>
            <p>
              Tap the table for a soft shot. Swipe faster for more power. The
              ball follows the direction of your finger on the screen, including
              diagonals.
            </p>
            <p>
              Footwork is assisted while you aim and hit. Drag between your
              shots to reposition. Fast swipes add topspin, a fast swipe on a
              high ball smashes, and a two-finger swipe adds backspin. Slightly
              early swipes wait for the legal bounce.
            </p>
            <p>
              Tap with two fingers for settings. Tap empty space to resume;
              swipe down with two fingers while in settings to return to the
              lobby. Space plays a soft shot and Escape opens settings.
            </p>
            <p>
              Win by two at 11. Two serves each; alternate every point from
              10–10. A serve clips the net and lands correctly? Replay it. No
              volleys.
            </p>
            <button className="tt-primary" onClick={() => setHelp(false)}>
              GOT IT <span>↗</span>
            </button>
          </div>
        </div>
      )}
      {paused && (
        <div className="tt-modal">
          <div>
            <h2>{online ? 'Leave this match?' : 'Take a breather.'}</h2>
            {!online && (
              <div className="tt-pause-appearance">
                <label>
                  Player
                  <select
                    aria-label="Human player"
                    value={character}
                    onChange={(e) => {
                      setCharacter(e.target.value);
                      if (!inline)
                        try {
                          localStorage.setItem(
                            'tableTennisSelectedHumanCharacter',
                            e.target.value
                          );
                        } catch {
                          /* Session choice still works. */
                        }
                    }}
                  >
                    {characterChoices.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Arena
                  <select
                    aria-label="Arena"
                    value={arena}
                    onChange={(e) => {
                      setArena(e.target.value);
                      if (!inline)
                        try {
                          localStorage.setItem(
                            'tableTennisSelectedHdri',
                            e.target.value
                          );
                        } catch {
                          /* Session choice still works. */
                        }
                    }}
                  >
                    {arenaChoices.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {online && (
              <p>
                Leaving counts as retirement. Your opponent wins the staked
                match.
              </p>
            )}
            <div className="tt-touch-settings">
              <label>
                <input
                  type="checkbox"
                  checked={sound}
                  onChange={(e) => {
                    audio.current?.unlock();
                    setSound(e.target.checked);
                    if (audio.current) audio.current.enabled = e.target.checked;
                  }}
                />{' '}
                Sound
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={auto}
                  onChange={(e) => {
                    setAuto(e.target.checked);
                    input.current.autoHit = e.target.checked;
                  }}
                />{' '}
                Automatic hitting
              </label>
            </div>
            <p className="tt-gesture-guide">
              One-finger swipe: drive or topspin.
              <br />
              Fast swipe on a high ball: smash.
              <br />
              Two-finger swipe: backspin.
            </p>
            <button className="tt-primary" onClick={resume}>
              RESUME
            </button>
            <button className="tt-secondary" onClick={exit}>
              {online ? 'Retire from match' : 'Return to lobby'}
            </button>
            <p className="tt-touch-return">
              Tap empty space to resume.
              <br />
              Swipe down with two fingers to{' '}
              {online ? 'retire from this match' : 'return to the lobby'}.
            </p>
          </div>
        </div>
      )}
      {view === 'match' && r.phase === 'over' && !paused && (
        <div className="tt-modal">
          <div>
            <span className="tt-eyebrow">MATCH COMPLETE</span>
            <h2>
              {r.winner === seat
                ? 'You win.'
                : r.winner === null
                  ? 'Match refunded.'
                  : 'Next rally. Next chance.'}
            </h2>
            <p>
              {r.score.history.map((p) => `${p[seat]}–${p[other]}`).join(' · ')}{' '}
              · Best rally {r.bestRally}
            </p>
            {online && (
              <p>
                {room.current?.settlement?.status === 'finished'
                  ? 'TPC settlement complete.'
                  : room.current?.settlement?.status === 'refunded'
                    ? 'Stakes refunded.'
                    : 'TPC settlement pending.'}
              </p>
            )}
            {modeRef.current === 'career' && (
              <p>{careerSaved ? 'Career saved.' : 'Saving career result…'}</p>
            )}
            <p className="tt-touch-return">
              {error.includes('Retry save')
                ? 'Tap to retry saving this result'
                : online || modeRef.current === 'career'
                  ? 'Tap to return to the lobby'
                  : 'Tap to play again · two-finger tap for the lobby'}
            </p>
          </div>
        </div>
      )}
      {online && !room.current?.joined && r.phase !== 'over' && (
        <div className="tt-wait" role="status">
          Match found · waiting for your opponent to load the table
        </div>
      )}
      {(error || notice) && (
        <div className="tt-toast" role={error ? 'alert' : 'status'}>
          <span>{error || notice}</span>
          {view !== 'match' && error.includes('Retry save') && (
            <button
              onClick={() => {
                saved.current = false;
                setError('');
                void saveCareer();
              }}
            >
              Retry save
            </button>
          )}
          {view !== 'match' && (
            <button
              aria-label="Dismiss message"
              onClick={() => {
                setError('');
                setNotice('');
              }}
            >
              ×
            </button>
          )}
        </div>
      )}
    </div>
  );
}
