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
  TOUR
} from './career';
import { CHARACTERS, ARENAS, type AppearanceChoices } from './options';
import {
  beginSwipe,
  sampleSwipe,
  readSwipe,
  TAP_POWER,
  type SwipeGesture
} from '../../../../shared/tabletennis/swipe';
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
    [network, setNetwork] = useState(''),
    [careerSaved, setCareerSaved] = useState(false),
    [help, setHelp] = useState(false),
    [graphics, setGraphics] = useState(true);
  const active = useRef(false),
    pauseRef = useRef(false),
    mounted = useRef(true),
    lastEvent = useRef(0),
    seat = room.current?.seat ?? 0;
  const gesture = useRef<{
    id: number;
    swipe: SwipeGesture;
    element: HTMLElement;
  } | null>(null);
  function cancelGesture() {
    const current = gesture.current;
    gesture.current = null;
    if (current?.element.hasPointerCapture(current.id))
      current.element.releasePointerCapture(current.id);
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
      if (mounted.current) setError('Result not saved. Tap Retry save.');
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
      if (mode === 'career') {
        const r = await services.startCareer();
        if (generation !== epoch.current) return;
        careerId.current = r.id;
        r.career = normalizeCareer(r.career);
        setCareer(r.career);
        const tour = TOUR[r.career.tour];
        setArena(tour.arena);
        config = {
          ...config,
          difficulty: tour.difficulty,
          gamesToWin: 1,
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
    setPower(TAP_POWER);
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
        if (frame.current.phase === 'point' || frame.current.phase === 'over') {
          cancelGesture();
          input.current.direction = null;
        }
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
            audio.current?.play(e.type);
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
  const pointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary || e.button !== 0 || gesture.current || !canSwing())
      return;
    audio.current?.unlock();
    gesture.current = {
      id: e.pointerId,
      element: e.currentTarget,
      swipe: beginSwipe(
        e.clientX,
        e.clientY,
        e.timeStamp,
        e.currentTarget.clientWidth
      )
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setPower(TAP_POWER);
  };
  const pointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    sampleSwipe(g.swipe, e.clientX, e.clientY, e.timeStamp);
    setPower(readSwipe(g.swipe).power);
  };
  const pointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    sampleSwipe(g.swipe, e.clientX, e.clientY, e.timeStamp);
    const stroke = readSwipe(g.swipe);
    cancelGesture();
    if (!canSwing()) return;
    input.current.power = stroke.power;
    input.current.direction =
      renderer.current?.shotDirection(stroke.dx, stroke.dy, frame.current) ??
      null;
    input.current.swing++;
    setPower(stroke.power);
  };
  const currentTour = TOUR[career.tour],
    r = score,
    other = 1 - seat,
    online = modeRef.current === 'online' && view === 'match';
  return (
    <div className={`tt-game ${inline ? 'tt-inline' : ''}`} data-view={view}>
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
      <div
        className="tt-scene"
        ref={host}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={(e) => {
          if (gesture.current?.id === e.pointerId) cancelGesture();
        }}
        onLostPointerCapture={(e) => {
          if (gesture.current?.id === e.pointerId) cancelGesture();
        }}
      />
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
                          ? currentTour.opponents[career.round]
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
          <div className="tt-controls">
            <div className="tt-control-top">
              <button onClick={pause}>{online ? 'Leave' : 'Pause'}</button>
              <span>{online ? network : 'Tap soft · swipe for speed'}</span>
              <button
                aria-pressed={auto}
                onClick={() => {
                  cancelGesture();
                  setAuto(!auto);
                  input.current.autoHit = !auto;
                }}
              >
                Auto hit {auto ? 'on' : 'off'}
              </button>
            </div>
            <div className="tt-shots">
              {(['drive', 'topspin', 'backspin', 'smash'] as Shot[]).map(
                (s) => (
                  <button
                    key={s}
                    aria-pressed={shot === s}
                    onClick={() => {
                      setShot(s);
                      input.current.shot = s;
                    }}
                  >
                    {s}
                  </button>
                )
              )}
            </div>
            <div className="tt-swipe-meter">
              <div>
                <span>
                  SWIPE POWER <b>{Math.round(power * 100)}%</b>
                </span>
                <div
                  className="tt-power-track"
                  role="meter"
                  aria-label="Swipe power"
                  aria-valuenow={Math.round(power * 100)}
                  aria-valuemin={10}
                  aria-valuemax={100}
                >
                  <i style={{ width: `${power * 100}%` }} />
                </div>
                <small>Follow your finger · automatic footwork</small>
              </div>
              <button
                className="tt-hit"
                disabled={
                  r.phase === 'point' ||
                  r.phase === 'over' ||
                  r.phase === 'toss' ||
                  (r.phase === 'serve' && r.score.server !== seat)
                }
                onClick={hit}
              >
                {r.phase === 'serve' ? 'SOFT SERVE' : 'SOFT HIT'}
              </button>
            </div>
          </div>
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
            Shared HDRI arena
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
        <section className="tt-panel">
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
              : `${currentTour.place} · ${['Quarter-final', 'Semi-final', 'Final'][career.round]} vs ${currentTour.opponents[career.round]}`}
          </p>
          <div className="tt-career-stats">
            <span>{career.wins} wins</span>
            <span>{career.losses} losses</span>
            <span>{career.credits} skill points</span>
          </div>
          <ol className="tt-tour">
            {TOUR.map((t, i) => (
              <li key={t.name} data-active={career.tour === i}>
                <span>{i < career.tour ? '✓' : i + 1}</span>
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
          <button
            className="tt-primary"
            disabled={busy || career.completed}
            onClick={() => start('career')}
          >
            PLAY NEXT MATCH <span>↗</span>
          </button>
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
            Arenas:{' '}
            <a
              href="https://polyhaven.com/license"
              target="_blank"
              rel="noreferrer"
            >
              Poly Haven
            </a>{' '}
            HDRIs, CC0, from the shared game catalog. Original table, paddle,
            procedural animation, audio and table tennis simulation.
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
              Your player handles footwork. Swipe as the ball arrives; a
              slightly early swipe waits for its legal bounce. Choose topspin,
              backspin or smash. Auto hit is optional.
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
            <button
              className="tt-primary"
              onClick={() => {
                setPaused(false);
                pauseRef.current = false;
              }}
            >
              KEEP PLAYING <span>↗</span>
            </button>
            <button className="tt-secondary" onClick={exit}>
              {online ? 'Retire from match' : 'Return to lobby'}
            </button>
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
            <button className="tt-primary" onClick={exit}>
              {modeRef.current === 'career'
                ? 'BACK TO CAREER'
                : 'BACK TO LOBBY'}{' '}
              <span>↗</span>
            </button>
            {!online && modeRef.current !== 'career' && (
              <button className="tt-secondary" onClick={() => start()}>
                Rematch
              </button>
            )}
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
          {error.includes('Retry save') && (
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
          <button
            aria-label="Dismiss message"
            onClick={() => {
              setError('');
              setNotice('');
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
